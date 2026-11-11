// Run: node tests/wallet-integrity.test.js
// Wallet-এর অখণ্ডতা: (১) টাকা কখনো নীরবে হারায় না — আয়/ব্যয়ের যোগফল আর "মোট সম্পদ" সবসময় মেলে, অ্যাকাউন্ট-তালিকা হারালেও;
// (২) সব অ্যাকাউন্ট-জোড়ার মধ্যে স্থানান্তরে দুই পাশ ঠিক বদলায়, মোট অপরিবর্তিত, রেকর্ড ঠিক একটি, সব তথ্যসহ;
// (৩) ব্যর্থ/অপেক্ষমাণ স্থানান্তর কোনো ব্যালেন্স বদলায় না; (৪) প্রদর্শিত ব্যালেন্স আর যাচাইয়ের ব্যালেন্স সবসময় একই সংখ্যা।
// আসল কোড js/app/app.js থেকে vm-এ তুলে চালানো হয় — কোড কপি করা নেই।
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "..", "js/app/app.js"), "utf8");
const fn = (name) => { const a = src.indexOf("function " + name + "("); assert(a !== -1, name + " not found"); return src.slice(a, src.indexOf("\n}\n", a) + 3); };
const cst = (name) => { const a = src.indexOf("const " + name + " ="); assert(a !== -1, name + " not found"); const b = src.indexOf("\n];", a); const c = src.indexOf(";\n", a); return src.slice(a, (src.slice(a, a + 40).includes("[") && b !== -1 && b < c + 400 ? b + 3 : c + 2)); };
const ctx = {}; vm.createContext(ctx);
vm.runInContext([cst("METHODS"), cst("DEBT_METHODS"), cst("toPaisa"), cst("hasEnough"), fn("methodLabel"),
  fn("computeAccountBalances"), fn("computeDynamicAccountBalances"), fn("legacyWalletBalance"), fn("dynamicWalletBalance"),
  fn("computeWalletTotal"), fn("transferCashEntries"), fn("debtNetCash"),
  "this.api = { METHODS, toPaisa, hasEnough, computeAccountBalances, computeDynamicAccountBalances, legacyWalletBalance, dynamicWalletBalance, computeWalletTotal, transferCashEntries, debtNetCash };"].join("\n"), ctx);
const A = ctx.api;
let passed = 0;
const t = (name, f) => { try { f(); passed++; console.log("  ✓", name); } catch (e) { console.error("  ✗", name, "\n   ", e.message); process.exitCode = 1; } };

const ACCTS = [{ id: "dbbl", name: "DBBL", openingBalance: 3000, active: true }, { id: "city", name: "City", openingBalance: 500, active: true }];
const calc = (st) => {
  const accounts = A.computeAccountBalances(st.transactions || [], st.opening || {}, st.transfers || [], st.debts || [], st.accts);
  const dyn = A.computeDynamicAccountBalances(st.transactions || [], st.accts || [], st.transfers || [], st.debts || []);
  return { accounts, dyn, total: A.computeWalletTotal(accounts, dyn) };
};
const bal = (c, k) => c.accounts.find((a) => a.key === k).balance;
const sum = (tx, type) => tx.filter((x) => x.type === type).reduce((s, x) => s + x.amount, 0);

console.log("১. টাকা নীরবে হারায় না (স্ক্রিনশটের দৃশ্য: আয় গোনা হয়েছে, কিন্তু সম্পদে ঢোকেনি)");
t("আয় ১,৫০০ + বাজার ৬২৫ (ক্যাশ): সম্পদ ৳৮৭৫ = আয় − ব্যয়; হেডার/হোম একই walletTotal", () => {
  const tx = [{ id: "i", type: "income", amount: 1500, method: "cash" }, { id: "e", type: "expense", amount: 625, familyPurchaseId: "p1", source: "family-bazar" }];
  assert.strictEqual(calc({ transactions: tx, accts: [] }).total, 875);
});
t("যে নামযুক্ত অ্যাকাউন্ট তালিকায় নেই তার আয় আগে সম্পদ থেকে বাদ পড়ত (−৬২৫); এখন আয়ের মাধ্যমে (ক্যাশে) গোনা হয় → ৳৮৭৫", () => {
  const tx = [{ id: "i", type: "income", amount: 1500, method: "cash", accountId: "ghost" }, { id: "e", type: "expense", amount: 625 }];
  const old = A.computeAccountBalances(tx, {}, [], []); // পুরোনো আচরণ (userAccounts না দিলে): accountId থাকলেই বাদ
  assert.strictEqual(A.computeWalletTotal(old, A.computeDynamicAccountBalances(tx, [], [], [])), -625, "সমস্যাটির পুনরুৎপাদন");
  assert.strictEqual(calc({ transactions: tx, accts: [] }).total, 875, "এখন টাকা হারায় না");
});
t("মাধ্যম ছাড়া আয় ক্যাশ ধরা হয়; অ্যাকাউন্ট থাকলে সেই অ্যাকাউন্টে যায় (ক্যাশে নয়) — দু'বার গোনা হয় না", () => {
  const tx = [{ id: "a", type: "income", amount: 100 }, { id: "b", type: "income", amount: 700, method: "cash", accountId: "dbbl" }];
  const c = calc({ transactions: tx, accts: ACCTS });
  assert.strictEqual(bal(c, "cash"), 100); assert.strictEqual(c.dyn.find((a) => a.id === "dbbl").balance, 3700); assert.strictEqual(c.total, 100 + 3700 + 500);
});
t("হারানো অ্যাকাউন্টের স্থানান্তর ও দেনা-পাওনাও মোট সম্পদ বদলায় না / হারায় না", () => {
  const opening = { bank: 1000 }, ghostTr = [{ id: "x", amount: 400, fromMethod: "bank", toMethod: null, fromAccountId: null, toAccountId: "ghost" }];
  assert.strictEqual(calc({ opening, transfers: ghostTr, accts: [] }).total, 1000, "ব্যাংক −৪০০, হারানো গন্তব্য → ক্যাশ +৪০০: মোট একই");
  const debts = [{ id: "d", type: "payable", amount: 300, method: "bkash", accountId: "ghost", repayments: [{ id: "r", amount: 100, method: null, accountId: "ghost" }] }];
  assert.strictEqual(calc({ debts, accts: [] }).total, 300 - 100, "ধার ৩০০ ঢুকেছে, ১০০ শোধ — টাকা হারায়নি");
});
t("property: ২০০ এলোমেলো দৃশ্য (হারানো অ্যাকাউন্টসহ) — মোট সম্পদ = শুরুর টাকা + আয় − ব্যয় + দেনা-পাওনার নিট (স্থানান্তর যোগ-বিয়োগ নয়)", () => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const pick = (a) => a[Math.floor(rnd() * a.length)];
  const methods = ["cash", "bank", "bkash", "nagad", "rocket", "card"], accIds = [null, null, "dbbl", "city", "ghost"];
  for (let run = 0; run < 200; run++) {
    const opening = {}; methods.forEach((m) => { opening[m] = Math.round(rnd() * 3000); });
    const tx = [], trs = [], debts = [];
    for (let i = 0; i < 8; i++) tx.push({ id: "t" + i, type: rnd() < 0.5 ? "income" : "expense", amount: 1 + Math.round(rnd() * 900), method: rnd() < 0.15 ? undefined : pick(methods), accountId: pick(accIds) });
    for (let i = 0; i < 4; i++) { const f = pick(methods.concat(["a:dbbl", "a:city", "a:ghost"])), to = pick(methods.concat(["a:dbbl", "a:city", "a:ghost"]));
      trs.push({ id: "s" + i, amount: 1 + Math.round(rnd() * 500), fromMethod: f[0] === "a" ? null : f, fromAccountId: f[0] === "a" ? f.slice(2) : null, toMethod: to[0] === "a" ? null : to, toAccountId: to[0] === "a" ? to.slice(2) : null }); }
    for (let i = 0; i < 2; i++) debts.push({ id: "d" + i, type: pick(["payable", "receivable"]), amount: 50 + Math.round(rnd() * 400), method: rnd() < 0.5 ? pick(methods) : null, accountId: pick(accIds), repayments: [] });
    const c = calc({ transactions: tx, opening, transfers: trs, debts, accts: ACCTS });
    const principal = ACCTS.reduce((s, a) => s + a.openingBalance, 0) + methods.reduce((s, m) => s + opening[m], 0);
    // দেনা-পাওনা: মাধ্যম/অ্যাকাউন্ট কিছুই না থাকলে (পুরোনো রেকর্ড) টাকার উৎস অজানা — আগের নিয়মে বাদ রাখা হয়েছে (documented)
    const counted = debts.filter((d) => d.method || d.accountId);
    const expected = principal + sum(tx, "income") - sum(tx, "expense") + A.debtNetCash(counted);
    assert(Math.abs(c.total - expected) < 0.005, `run ${run}: মোট ${c.total} ≠ প্রত্যাশিত ${expected}`);
  }
});

console.log("২. সব অ্যাকাউন্ট-জোড়ার মধ্যে স্থানান্তর + পূর্ণ রেকর্ড");
const ENDS = ["m:bank", "m:bkash", "m:nagad", "m:rocket", "m:cash", "m:card", "a:dbbl", "a:city"];
const sideOf = (sel, p) => sel[0] === "a" ? { [p + "Method"]: null, [p + "AccountId"]: sel.slice(2) } : { [p + "Method"]: sel.slice(2), [p + "AccountId"]: null };
const balOf = (c, sel) => sel[0] === "a" ? c.dyn.find((a) => a.id === sel.slice(2)).balance : bal(c, sel.slice(2));
const opening0 = { bank: 5000, bkash: 800, nagad: 800, rocket: 800, cash: 800, card: 800 };
let pairs = 0;
t("৮টি প্রান্তের সব ৫৬টি ক্রমজোড়া (ব্যাংক↔বিকাশ/নগদ/রকেট, বিকাশ↔নগদ↔রকেট, নামযুক্ত অ্যাকাউন্টসহ…): উৎস −, গন্তব্য +, মোট একই", () => {
  const before = calc({ opening: opening0, accts: ACCTS });
  for (const from of ENDS) for (const to of ENDS) {
    if (from === to) continue; pairs++;
    const tr = Object.assign({ id: "x", amount: 250, date: "2026-11-11", time: "10:30", note: "", status: "success" }, sideOf(from, "from"), sideOf(to, "to"));
    const after = calc({ opening: opening0, transfers: [tr], accts: ACCTS });
    assert.strictEqual(balOf(after, from), balOf(before, from) - 250, from + " → " + to + ": উৎস কমেনি");
    assert.strictEqual(balOf(after, to), balOf(before, to) + 250, from + " → " + to + ": গন্তব্য বাড়েনি");
    assert.strictEqual(after.total, before.total, from + " → " + to + ": মোট সম্পদ বদলেছে");
    ENDS.filter((e) => e !== from && e !== to).forEach((e) => assert.strictEqual(balOf(after, e), balOf(before, e), e + " অকারণে বদলেছে"));
  }
  assert.strictEqual(pairs, 56);
});
t("প্রতিটি স্থানান্তরের রেকর্ড: কোথা থেকে, কোথায়, কত, তারিখ, সময়, ধরন = স্থানান্তর, অবস্থা = সফল — ঠিক একটি এন্ট্রি; আয়ও নয় ব্যয়ও নয়", () => {
  const tr = Object.assign({ id: "x", amount: 250, date: "2026-11-11", time: "10:30", note: "এটিএম", createdAt: 5, status: "success" }, sideOf("m:bkash", "from"), sideOf("m:nagad", "to"));
  const e = A.transferCashEntries([tr], ACCTS);
  assert.strictEqual(e.length, 1); const r = e[0];
  assert.deepStrictEqual([r.type, r.amount, r.date, r.time, r.status, r.fromLabel, r.toLabel, r.isTransferEntry], ["transfer", 250, "2026-11-11", "10:30", "success", "বিকাশ", "নগদ", true]);
  assert.strictEqual(A.transferCashEntries([Object.assign({}, tr, { status: undefined })], ACCTS)[0].status, "success", "পুরোনো স্থানান্তর (অবস্থা-ক্ষেত্রহীন) সফল হিসেবেই দেখায়");
  const named = A.transferCashEntries([Object.assign({ id: "y", amount: 9 }, sideOf("a:dbbl", "from"), sideOf("m:rocket", "to"))], ACCTS)[0];
  assert.deepStrictEqual([named.fromLabel, named.toLabel], ["DBBL", "রকেট"]);
});

console.log("৩. ব্যর্থ / অপেক্ষমাণ স্থানান্তর কোনো ব্যালেন্স বদলায় না");
for (const status of ["failed", "pending"]) {
  t(`অবস্থা "${status}": ব্যাংক → বিকাশ ও DBBL → নগদ — কোনো পাশেই টাকা কাটে/যোগ হয় না; যাচাইয়ের ব্যালেন্সও একই`, () => {
    const trs = [{ id: "a", amount: 900, status, fromMethod: "bank", toMethod: "bkash" }, { id: "b", amount: 700, status, fromAccountId: "dbbl", toMethod: "nagad" }];
    const base = calc({ opening: opening0, accts: ACCTS }), c = calc({ opening: opening0, transfers: trs, accts: ACCTS });
    ["bank", "bkash", "nagad"].forEach((k) => assert.strictEqual(bal(c, k), bal(base, k), k)); assert.strictEqual(c.dyn.find((a) => a.id === "dbbl").balance, 3000);
    const data = { accountOpening: opening0, transactions: [], transfers: trs, debts: [], userAccounts: ACCTS };
    assert.strictEqual(A.legacyWalletBalance("bank", data), 5000); assert.strictEqual(A.dynamicWalletBalance("dbbl", data), 3000);
  });
}
t("সফল স্থানান্তর ঠিক আগের মতোই কাজ করে (অবস্থা 'success' বা ক্ষেত্র না থাকা)", () => {
  for (const st of [{ status: "success" }, {}]) {
    const c = calc({ opening: opening0, transfers: [Object.assign({ id: "a", amount: 900, fromMethod: "bank", toMethod: "bkash" }, st)], accts: ACCTS });
    assert.strictEqual(bal(c, "bank"), 4100); assert.strictEqual(bal(c, "bkash"), 1700);
  }
});

console.log("৪. প্রদর্শিত ব্যালেন্স = যাচাইয়ের ব্যালেন্স (একই নিয়ম, দুই ইঞ্জিনে)");
t("property: ২০০ এলোমেলো দৃশ্যে প্রতিটি মাধ্যম ও নামযুক্ত অ্যাকাউন্টের দেখানো ব্যালেন্স == যাচাইয়ে ব্যবহৃত ব্যালেন্স (হারানো অ্যাকাউন্ট ও অবস্থাসহ)", () => {
  let seed = 99; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const pick = (a) => a[Math.floor(rnd() * a.length)];
  const methods = ["cash", "bank", "bkash", "nagad", "rocket", "card"];
  for (let run = 0; run < 200; run++) {
    const opening = {}; methods.forEach((m) => { opening[m] = Math.round(rnd() * 2000); });
    const tx = [], trs = [], debts = [];
    for (let i = 0; i < 6; i++) tx.push({ id: "t" + i, type: rnd() < 0.5 ? "income" : "expense", amount: 1 + Math.round(rnd() * 600), method: pick(methods.concat([undefined])), accountId: pick([null, "dbbl", "ghost"]) });
    for (let i = 0; i < 3; i++) trs.push({ id: "s" + i, amount: 1 + Math.round(rnd() * 400), status: pick(["success", undefined, "failed", "pending"]), fromMethod: pick(methods), toMethod: pick(methods), fromAccountId: null, toAccountId: pick([null, "dbbl", "ghost"]) });
    debts.push({ id: "d", type: "payable", amount: 300, method: pick(methods), accountId: pick([null, "ghost"]), repayments: [{ id: "r", amount: 50, method: pick(methods), accountId: null }] });
    const st = { transactions: tx, opening, transfers: trs, debts, accts: ACCTS }, c = calc(st);
    const data = { accountOpening: opening, transactions: tx, transfers: trs, debts, userAccounts: ACCTS };
    methods.forEach((m) => assert(Math.abs(A.legacyWalletBalance(m, data) - bal(c, m)) < 0.005, `run ${run}: ${m} যাচাই ${A.legacyWalletBalance(m, data)} ≠ প্রদর্শিত ${bal(c, m)}`));
    ACCTS.forEach((a) => assert(Math.abs(A.dynamicWalletBalance(a.id, data) - c.dyn.find((x) => x.id === a.id).balance) < 0.005, `run ${run}: ${a.id}`));
  }
});

console.log(passed + " passed" + (process.exitCode ? " — WITH FAILURES" : ""));
