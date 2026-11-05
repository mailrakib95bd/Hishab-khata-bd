// Run: node tests/debt-wallet.test.js
// দেনা-পাওনা ↔ Wallet সমন্বয়: ধার নেওয়া/দেওয়া/পরিশোধ — প্রতিটি লেনদেন Wallet ব্যালেন্সে ঠিক একবার প্রভাব ফেলে,
// এবং একই লেনদেন সাম্প্রতিক/টাইমলাইন/রিপোর্টে (debtCashEntries) দেখানো হয়, কিন্তু ব্যালেন্সে দু'বার গোনা হয় না।
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "app", "app.js"), "utf8");
const fn = (name) => { const a = src.indexOf("function " + name + "("); assert(a !== -1, name + " not found"); return src.slice(a, src.indexOf("\n}\n", a) + 3); };
const cst = (name) => { const a = src.indexOf("const " + name + " ="); assert(a !== -1, name + " not found"); const b = src.indexOf("\n];", a); const c = src.indexOf(";\n", a); return src.slice(a, (src.slice(a, a + 40).includes("[") && b !== -1 && b < c + 400 ? b + 3 : c + 2)); };
const ctx = {}; vm.createContext(ctx);
vm.runInContext([cst("METHODS"), cst("DEBT_METHODS"), cst("toPaisa"), cst("hasEnough"), fn("methodLabel"), fn("computeAccountBalances"), fn("computeDynamicAccountBalances"), fn("legacyWalletBalance"), fn("dynamicWalletBalance"), fn("debtCashEntries"), fn("debtNetCash"), fn("debtEntryTitle"),
  "this.api = { METHODS, toPaisa, hasEnough, computeAccountBalances, computeDynamicAccountBalances, legacyWalletBalance, dynamicWalletBalance, debtCashEntries, debtNetCash, debtEntryTitle };"].join("\n"), ctx);
const A = ctx.api;
let passed = 0;
const t = (name, f) => { try { f(); passed++; console.log("  \u2713", name); } catch (e) { console.error("  \u2717", name, "\n   ", e.message); process.exitCode = 1; } };
const wallet = (arr, k) => arr.find((x) => x.key === k).balance, acct = (arr, id) => arr.find((x) => x.id === id).balance;
const ACCTS = [{ id: "dbbl", name: "DBBL", openingBalance: 10000 }];
const base = (o) => Object.assign({ id: "d1", person: "রহিম", amount: 1000, date: "2026-11-01", repayments: [] }, o);

console.log("Wallet — the four rules");
t("আমি ধার নিলে (দেনা) Wallet বাড়ে", () => {
  assert.strictEqual(wallet(A.computeAccountBalances([], { cash: 500 }, [], [base({ type: "payable", method: "cash" })]), "cash"), 1500);
});
t("আমি ধার দিলে (পাওনা) Wallet কমে", () => {
  assert.strictEqual(wallet(A.computeAccountBalances([], { cash: 5000 }, [], [base({ type: "receivable", method: "cash" })]), "cash"), 4000);
});
t("আমি ধার পরিশোধ করলে Wallet কমে (নেওয়ার পর: +1000 − 400)", () => {
  const d = base({ type: "payable", method: "bank", repayments: [{ id: "r1", amount: 400, method: "bank" }] });
  assert.strictEqual(wallet(A.computeAccountBalances([], { bank: 0 }, [], [d]), "bank"), 600);
});
t("কেউ আমার ধার পরিশোধ করলে Wallet বাড়ে (দেওয়ার পর: −1000 + 400)", () => {
  const d = base({ type: "receivable", method: "bank", repayments: [{ id: "r1", amount: 400, method: "bank" }] });
  assert.strictEqual(wallet(A.computeAccountBalances([], { bank: 2000 }, [], [d]), "bank"), 1400);
});
t("নামযুক্ত অ্যাকাউন্টেও একই নিয়ম — এবং ক্যাশ Wallet ছোঁয়া হয় না", () => {
  const debts = [base({ type: "receivable", method: null, accountId: "dbbl", repayments: [{ id: "r1", amount: 300, accountId: "dbbl" }] })];
  assert.strictEqual(acct(A.computeDynamicAccountBalances([], ACCTS, [], debts), "dbbl"), 10000 - 1000 + 300);
  assert.strictEqual(wallet(A.computeAccountBalances([], { cash: 100 }, [], debts), "cash"), 100);
});
t("পুরোনো ধার (method নেই) Wallet-এ কিছু বদলায় না — আগের ব্যালেন্স অপরিবর্তিত", () => {
  assert.strictEqual(wallet(A.computeAccountBalances([], { cash: 700 }, [], [base({ type: "payable" })]), "cash"), 700);
});

console.log("ব্যালেন্স যাচাই ও প্রদর্শন একই সংখ্যা");
t("সম্পাদনার সময় ধারের নিজের আগের প্রভাব বাদ দিয়ে ব্যালেন্স দেখা হয় (দু'বার কাটে না)", () => {
  const debts = [base({ type: "receivable", method: "cash" })];
  const data = { accountOpening: { cash: 1500 }, transactions: [], transfers: [], debts, userAccounts: ACCTS };
  assert.strictEqual(A.legacyWalletBalance("cash", data), 500);
  assert.strictEqual(A.legacyWalletBalance("cash", data, { debtId: "d1" }), 1500);
  const d2 = { transactions: [], transfers: [], userAccounts: ACCTS, debts: [base({ type: "receivable", method: null, accountId: "dbbl", repayments: [{ id: "r1", amount: 200, accountId: "dbbl" }] })] };
  assert.strictEqual(A.dynamicWalletBalance("dbbl", d2), 9200);
  assert.strictEqual(A.dynamicWalletBalance("dbbl", d2, { debtId: "d1" }), 10200, "শুধু মূল ধার বাদ, পরিশোধ থাকে");
});
t("property: যেকোনো মিশ্র ডেটায় check-balance == প্রদর্শিত ব্যালেন্স (ধারের মূল অংশসহ)", () => {
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const pick = (a) => a[Math.floor(rnd() * a.length)];
  const methods = A.METHODS.map((m) => m.key), money = () => Math.round(rnd() * 5000) / 100;
  for (let run = 0; run < 200; run++) {
    const debts = Array.from({ length: 3 }, (_, i) => { const acc = rnd() < 0.4; return { id: "d" + i, type: pick(["payable", "receivable"]), amount: money(), method: acc ? null : pick(methods), accountId: acc ? "dbbl" : null,
      repayments: [{ id: "r" + i, amount: money(), method: pick(methods), accountId: null }, { id: "q" + i, amount: money(), method: null, accountId: "dbbl" }] }; });
    const opening = { cash: money(), bank: money() }; const data = { accountOpening: opening, transactions: [], transfers: [], debts, userAccounts: ACCTS };
    const L = A.computeAccountBalances([], opening, [], debts), D = A.computeDynamicAccountBalances([], ACCTS, [], debts);
    methods.forEach((m) => assert.strictEqual(A.toPaisa(A.legacyWalletBalance(m, data)), A.toPaisa(wallet(L, m)), `run ${run} ${m}`));
    assert.strictEqual(A.toPaisa(A.dynamicWalletBalance("dbbl", data)), A.toPaisa(acct(D, "dbbl")), `run ${run} dbbl`);
  }
});

console.log("সাম্প্রতিক লেনদেন / টাইমলাইন / রিপোর্টের জন্য এন্ট্রি");
t("প্রতিটি ধার + প্রতিটি পরিশোধ একটি করে এন্ট্রি; দিক ঠিক (নিলে income, দিলে expense, পরিশোধে উল্টো)", () => {
  const debts = [
    base({ id: "a", type: "payable", method: "cash", repayments: [{ id: "r1", amount: 100, method: "cash", date: "2026-11-02" }] }),
    base({ id: "b", type: "receivable", method: "bank", repayments: [{ id: "r2", amount: 50, method: "bank", date: "2026-11-03" }] }),
  ];
  const e = A.debtCashEntries(debts, []);
  assert.strictEqual(e.length, 4);
  const by = (id) => e.find((x) => x.id === id);
  assert.strictEqual(by("debt:a").type, "income"); assert.strictEqual(by("debtrep:r1").type, "expense");
  assert.strictEqual(by("debt:b").type, "expense"); assert.strictEqual(by("debtrep:r2").type, "income");
  assert(e.every((x) => x.isDebtEntry && x.debtId));
  assert.strictEqual(JSON.stringify(Array.from(e, (x) => A.debtEntryTitle(x))), JSON.stringify(["ধার নেওয়া", "ধার পরিশোধ", "ধার দেওয়া", "ধার ফেরত পেয়েছি"]));
});
t("এন্ট্রির নিট যোগফল == Wallet-এ মোট প্রভাব (একই টাকা দু'বার গোনা হয় না)", () => {
  const debts = [base({ id: "a", type: "payable", method: "cash", repayments: [{ id: "r1", amount: 100, method: "cash" }] }), base({ id: "b", type: "receivable", method: "bank", amount: 300, repayments: [{ id: "r2", amount: 50, method: "bank" }] })];
  const fromEntries = A.debtCashEntries(debts, []).reduce((s, x) => s + (x.type === "income" ? x.amount : -x.amount), 0);
  assert.strictEqual(fromEntries, A.debtNetCash(debts));
  const L = A.computeAccountBalances([], { cash: 0, bank: 0 }, [], debts);
  assert.strictEqual(wallet(L, "cash") + wallet(L, "bank"), A.debtNetCash(debts));
});
t("নামযুক্ত অ্যাকাউন্টের নাম এন্ট্রিতে দেখা যায়", () => {
  const e = A.debtCashEntries([base({ type: "payable", method: null, accountId: "dbbl" })], ACCTS);
  assert.strictEqual(e[0].walletLabel, "DBBL");
});

console.log(passed + " passed" + (process.exitCode ? " — WITH FAILURES" : ""));
