// Run: node tests/transfer-wallet.test.js
// ব্যাংক ↔ বিকাশ/নগদ/রকেট স্থানান্তর + Wallet মোট: স্থানান্তরে দুই পাশের ব্যালেন্স ঠিক বদলায়, মোট Wallet বদলায় না,
// একই টাকা দু'বার গোনা হয় না, স্থানান্তর টাইমলাইন/ড্যাশবোর্ড/রিপোর্টের এন্ট্রিতে আছে, আর হেডার ও হোমের মোট একই উৎস থেকে আসে।
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert");
const rd = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const src = rd("js/app/app.js"), rep = rd("js/app/reports-search.js");
const fn = (s, name) => { const a = s.indexOf("function " + name + "("); assert(a !== -1, name + " not found"); return s.slice(a, s.indexOf("\n}\n", a) + 3); };
const cst = (s, name) => { const a = s.indexOf("const " + name + " ="); assert(a !== -1, name + " not found"); const b = s.indexOf("\n];", a); const c = s.indexOf(";\n", a); return s.slice(a, (s.slice(a, a + 40).includes("[") && b !== -1 && b < c + 400 ? b + 3 : c + 2)); };
const ctx = {}; vm.createContext(ctx);
vm.runInContext([cst(src, "METHODS"), cst(src, "DEBT_METHODS"), cst(src, "toPaisa"), cst(src, "hasEnough"), fn(src, "methodLabel"),
  fn(src, "computeAccountBalances"), fn(src, "computeDynamicAccountBalances"), fn(src, "legacyWalletBalance"), fn(src, "dynamicWalletBalance"),
  fn(src, "computeWalletTotal"), fn(src, "transferCashEntries"), fn(src, "debtNetCash"), cst(rep, "netOf"),
  "this.api = { METHODS, toPaisa, hasEnough, computeAccountBalances, computeDynamicAccountBalances, legacyWalletBalance, dynamicWalletBalance, computeWalletTotal, transferCashEntries, debtNetCash, netOf };"].join("\n"), ctx);
const A = ctx.api;
let passed = 0;
const t = (name, f) => { try { f(); passed++; console.log("  \u2713", name); } catch (e) { console.error("  \u2717", name, "\n   ", e.message); process.exitCode = 1; } };
const wallet = (arr, k) => arr.find((x) => x.key === k).balance, acct = (arr, id) => arr.find((x) => x.id === id).balance;
const ACCTS = [{ id: "dbbl", name: "DBBL", openingBalance: 10000 }, { id: "city", name: "City", openingBalance: 0 }];
const total = (tx, opening, trs, debts) => A.computeWalletTotal(A.computeAccountBalances(tx, opening, trs, debts), A.computeDynamicAccountBalances(tx, ACCTS, trs, debts));

console.log("ব্যালেন্সের নিয়ম");
for (const m of ["bkash", "nagad", "rocket"]) {
  t(`ব্যাংক (মাধ্যম) → ${m}: ব্যাংক কমে, ${m} বাড়ে, মোট Wallet অপরিবর্তিত`, () => {
    const opening = { bank: 5000, [m]: 100 }, tr = [{ id: "x", amount: 1500, fromMethod: "bank", toMethod: m, fromAccountId: null, toAccountId: null }];
    const L = A.computeAccountBalances([], opening, tr, []);
    assert.strictEqual(wallet(L, "bank"), 3500); assert.strictEqual(wallet(L, m), 1600);
    assert.strictEqual(total([], opening, tr, []), total([], opening, [], []), "মোট বদলায়নি");
  });
  t(`নামযুক্ত অ্যাকাউন্ট DBBL → ${m}: DBBL কমে, ${m} বাড়ে (একবারই), মোট অপরিবর্তিত`, () => {
    const tr = [{ id: "x", amount: 2000, fromAccountId: "dbbl", toMethod: m, fromMethod: null, toAccountId: null }];
    assert.strictEqual(acct(A.computeDynamicAccountBalances([], ACCTS, tr, []), "dbbl"), 8000);
    assert.strictEqual(wallet(A.computeAccountBalances([], { [m]: 0 }, tr, []), m), 2000);
    assert.strictEqual(total([], {}, tr, []), 10000);
  });
}
t("অপর্যাপ্ত ব্যালেন্সে স্থানান্তর আটকায় (সম্পাদনায় নিজের আগের প্রভাব বাদ)", () => {
  const data = { accountOpening: { bank: 1000 }, transactions: [], transfers: [{ id: "x", amount: 800, fromMethod: "bank", toMethod: "bkash" }], debts: [], userAccounts: ACCTS };
  assert(!A.hasEnough(A.legacyWalletBalance("bank", data), 500), "বাকি ২০০ — ৫০০ যাবে না");
  assert(A.hasEnough(A.legacyWalletBalance("bank", data, { transferId: "x" }), 1000), "নিজেরটা বাদ দিলে ১০০০ আছে");
  const d2 = { transactions: [], transfers: [{ id: "y", amount: 9000, fromAccountId: "dbbl", toMethod: "nagad" }], debts: [], userAccounts: ACCTS };
  assert(!A.hasEnough(A.dynamicWalletBalance("dbbl", d2), 2000)); assert(A.hasEnough(A.dynamicWalletBalance("dbbl", d2, { transferId: "y" }), 10000));
});
t("property: যত স্থানান্তরই হোক, মোট Wallet = শুরুর টাকা + আয় − ব্যয় + দেনা-পাওনার নিট (স্থানান্তর যোগ-বিয়োগ হয় না)", () => {
  let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const pick = (a) => a[Math.floor(rnd() * a.length)];
  const methods = A.METHODS.map((m) => m.key), ids = ACCTS.map((a) => a.id), money = () => Math.round(rnd() * 5000) / 100;
  for (let run = 0; run < 200; run++) {
    const tx = Array.from({ length: 6 }, (_, i) => { const acc = rnd() < 0.4; return { id: "t" + i, type: pick(["income", "expense"]), amount: money(), method: acc ? undefined : pick(methods), accountId: acc ? pick(ids) : undefined }; });
    const trs = Array.from({ length: 5 }, (_, i) => { const fa = rnd() < 0.4, ta = rnd() < 0.4; return { id: "x" + i, amount: money(), fromMethod: fa ? null : pick(methods), fromAccountId: fa ? pick(ids) : null, toMethod: ta ? null : pick(methods), toAccountId: ta ? pick(ids) : null }; });
    const debts = [{ id: "d", type: pick(["payable", "receivable"]), amount: money(), method: pick(methods), accountId: null, repayments: [{ id: "r", amount: money(), method: pick(methods), accountId: null }] }];
    const opening = { cash: money(), bank: money(), bkash: money() };
    const income = tx.filter((x) => x.type === "income").reduce((s, x) => s + x.amount, 0), expense = tx.filter((x) => x.type === "expense").reduce((s, x) => s + x.amount, 0);
    const expected = opening.cash + opening.bank + opening.bkash + 10000 + income - expense + A.debtNetCash(debts);
    assert.strictEqual(A.toPaisa(total(tx, opening, trs, debts)), A.toPaisa(expected), "run " + run);
  }
});

console.log("ড্যাশবোর্ড / টাইমলাইন / রিপোর্টে স্থানান্তর");
t("প্রতিটি স্থানান্তর ঠিক একটি এন্ট্রি; কোথা থেকে কোথায়, কত, কবে — সব সংরক্ষিত; type আয়ও নয় ব্যয়ও নয়", () => {
  const trs = [{ id: "x1", amount: 750, fromMethod: "bank", toMethod: "bkash", date: "2026-11-04", time: "14:30", note: "ক্যাশ-ইন", createdAt: 5 }, { id: "x2", amount: 200, fromAccountId: "dbbl", toMethod: "nagad", date: "2026-11-05", createdAt: 6 }];
  const e = A.transferCashEntries(trs, ACCTS);
  assert.strictEqual(e.length, 2);
  assert.strictEqual(e[0].fromLabel, "ব্যাংক"); assert.strictEqual(e[0].toLabel, "বিকাশ"); assert.strictEqual(e[0].amount, 750); assert.strictEqual(e[0].date, "2026-11-04"); assert.strictEqual(e[0].time, "14:30");
  assert.strictEqual(e[1].fromLabel, "DBBL"); assert.strictEqual(e[1].toLabel, "নগদ");
  assert(e.every((x) => x.isTransferEntry && x.type === "transfer" && A.netOf(x) === 0 && x.transferId));
});
t("টাইমলাইনের চলতি জমা: স্থানান্তর ০ ধরা হয়, আয় +, ব্যয় −", () => {
  assert.strictEqual(A.netOf({ type: "income", amount: 10 }), 10); assert.strictEqual(A.netOf({ type: "expense", amount: 10 }), -10); assert.strictEqual(A.netOf({ type: "transfer", amount: 10 }), 0);
});
t("সাম্প্রতিক লেনদেন ও টাইমলাইন ledger (স্থানান্তরসহ) থেকে আসে; রিপোর্টের আয়-ব্যয় থেকে স্থানান্তর বাদ", () => {
  assert(/\.\.\.transferCashEntries\(transfers, userAccounts\)/.test(src));
  assert(/const recent = useMemo\(\(\) => \[\.\.\.\(ledger \|\| transactions\)\]/.test(src));
  assert(rep.includes("!t.isDebtEntry && !t.isTransferEntry") && rep.includes("স্থানান্তর (এই সময়ে)"));
  assert(rep.includes('{ key: "transfer", label: "স্থানান্তর" }'));
});
t("অ্যাকাউন্টের ইতিহাস/সার্চ: স্থানান্তর দুই পাশের অ্যাকাউন্ট ও মাধ্যম দিয়ে খোঁজা যায়", () => {
  assert(rep.includes("t.fromAccountId !== accountId && t.toAccountId !== accountId") && rep.includes("t.fromMethod !== method && t.toMethod !== method"));
});

console.log("হেডার ও হোমের Wallet মোট — একই উৎস");
t("walletTotal একবারই হিসাব হয় এবং Header, Dashboard ও Timeline তিনজনই সেটাই দেখায়", () => {
  assert.strictEqual((src.match(/computeWalletTotal\(accounts, dynamicAccountBalances\)/g) || []).length, 1);
  assert(src.includes("React.createElement(Header, { transactions: transactions, walletTotal: walletTotal"));
  assert(src.includes("walletTotal: walletTotal, dynamicAccounts: dynamicAccountBalances"));
  assert(src.includes("React.createElement(Timeline, { transactions: ledger, walletTotal: walletTotal"));
  assert(src.includes("const balance = walletTotal != null ? walletTotal : fallbackBalance;"));
  assert(src.includes("const availableBalance = walletTotal != null ? walletTotal :"));
  assert(rep.includes("balance: walletTotal != null ? walletTotal"));
});

console.log(passed + " passed" + (process.exitCode ? " — WITH FAILURES" : ""));
