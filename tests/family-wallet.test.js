// Run: node tests/family-wallet.test.js
// ফ্যামিলি বাজার ↔ Wallet: (১) টাকা না থাকলে কেনাকাটা আটকায়, (২) যে অ্যাকাউন্ট থেকে খরচ, ঠিক সেই অ্যাকাউন্টেই যাচাই ও কাটা,
// (৩) একই ক্রয় দু'বার গোনা হয় না, (৪) Wallet কখনো কৃত্রিমভাবে মাইনাস হয় না, (৫) Header ও Dashboard-এর মোট একই সংখ্যা।
// আসল কোড js/app/app.js থেকে vm-এ তুলে চালানো হয় — কোড কপি করা নেই, তাই টেস্ট আর কোড আলাদা হয়ে যেতে পারে না।
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert");
const rd = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const src = rd("js/app/app.js"), bazar = rd("js/family/family-bazar.js"), shop = rd("js/family/family-shopping.js");
const fn = (s, name) => { const a = s.indexOf("function " + name + "("); assert(a !== -1, name + " not found"); return s.slice(a, s.indexOf("\n}\n", a) + 3); };
const cst = (s, name) => { const a = s.indexOf("const " + name + " ="); assert(a !== -1, name + " not found"); const b = s.indexOf("\n];", a); const c = s.indexOf(";\n", a); return s.slice(a, (s.slice(a, a + 40).includes("[") && b !== -1 && b < c + 400 ? b + 3 : c + 2)); };
const ctx = {}; vm.createContext(ctx);
vm.runInContext([cst(src, "METHODS"), cst(src, "DEBT_METHODS"), cst(src, "toPaisa"), cst(src, "hasEnough"), cst(src, "payValueOfTx"), cst(src, "payFieldsOf"), fn(src, "methodLabel"),
  fn(src, "computeAccountBalances"), fn(src, "computeDynamicAccountBalances"), fn(src, "legacyWalletBalance"), fn(src, "dynamicWalletBalance"),
  fn(src, "computeWalletTotal"), fn(src, "makeFamilyWallet"), fn(src, "applyFamilyPurchaseToTransactions"),
  "this.api = { toPaisa, hasEnough, payValueOfTx, payFieldsOf, computeAccountBalances, computeDynamicAccountBalances, computeWalletTotal, makeFamilyWallet, applyFamilyPurchaseToTransactions };"].join("\n"), ctx);
const A = ctx.api;
let passed = 0;
const t = (name, f) => { try { f(); passed++; console.log("  ✓", name); } catch (e) { console.error("  ✗", name, "\n   ", e.message); process.exitCode = 1; } };

const ACCTS = [{ id: "dbbl", name: "DBBL", openingBalance: 1000, active: true }];
const CAT = "family_bazar";
let idn = 0; const mkId = () => "tx" + ++idn;
// ঠিক অ্যাপের মতো: একটি অবস্থা → দুই ব্যালেন্স ইঞ্জিন → Wallet মোট + familyWallet
const state = (o) => Object.assign({ transactions: [], opening: {}, transfers: [], debts: [], accts: ACCTS }, o);
const calc = (st) => {
  const accounts = A.computeAccountBalances(st.transactions, st.opening, st.transfers, st.debts);
  const dyn = A.computeDynamicAccountBalances(st.transactions, st.accts, st.transfers, st.debts);
  return { accounts, dyn, total: A.computeWalletTotal(accounts, dyn),
    wallet: A.makeFamilyWallet({ accounts, dynamicBalances: dyn, accountOpening: st.opening, transactions: st.transactions, transfers: st.transfers, debts: st.debts, userAccounts: st.accts }) };
};
const bal = (c, key) => c.accounts.find((a) => a.key === key).balance;
const purchase = (id, total, extra) => Object.assign({ purchaseId: id, total, date: "2026-11-10", market: "সুন্দরগঞ্জ বাজার", location: "গাইবান্ধা", familyId: "f1" }, extra);
// একটি ক্রয় সংরক্ষণের পুরো পথ: যাচাই → (সফল হলে) Wallet-এ খরচ হিসেবে ঢোকা — ফ্যামিলি বাজারের PurchaseSheet যা করে
const buy = (st, p, payment) => {
  const c = calc(st), r = c.wallet.check(payment, p.total, p.purchaseId);
  if (!r.ok) return { ok: false, r, st };
  return { ok: true, r, st: Object.assign({}, st, { transactions: A.applyFamilyPurchaseToTransactions(st.transactions, null, p, payment, CAT, mkId, 1) }) };
};

console.log("স্ক্রিনশটের দৃশ্য: আয় ১,৫০০, বাজার ৬২৫");
t("আয় নেই, ক্যাশ ৳০ → ৳৬২৫-এর বাজার আটকায়; Wallet কৃত্রিমভাবে −৬২৫ হয় না", () => {
  const st = state({ accts: [] }), r = buy(st, purchase("p1", 625), "m:cash");
  assert.strictEqual(r.ok, false); assert.strictEqual(r.r.label, "ক্যাশ"); assert.strictEqual(r.r.balance, 0);
  assert.strictEqual(r.st.transactions.length, 0, "কিছুই সংরক্ষণ হয়নি"); assert.strictEqual(calc(r.st).total, 0, "Wallet ০ থাকে, মাইনাস নয়");
});
t("৳১,৫০০ আয়ের পর ৳৬২৫ বাজার চলে → Wallet ৳৮৭৫; আয় ১৫০০, ব্যয় ৬২৫ — Header ও Dashboard একই সংখ্যা (একই walletTotal)", () => {
  let st = state({ accts: [], transactions: [{ id: "i1", type: "income", amount: 1500, method: "cash", date: "2026-11-10", category: "salary" }] });
  const r = buy(st, purchase("p1", 625), "m:cash"); assert(r.ok); st = r.st;
  const c = calc(st); assert.strictEqual(c.total, 875); assert.strictEqual(bal(c, "cash"), 875);
  const income = st.transactions.filter((x) => x.type === "income").reduce((s, x) => s + x.amount, 0), expense = st.transactions.filter((x) => x.type === "expense").reduce((s, x) => s + x.amount, 0);
  assert.strictEqual(income - expense, c.total, "আয় − ব্যয় = Wallet মোট: দুই জায়গার সংখ্যা মিলে যায়");
});

console.log("যে অ্যাকাউন্ট থেকে খরচ, সেই অ্যাকাউন্টেই যাচাই");
t("ক্যাশে টাকা থাকলেও বিকাশে না থাকলে, বিকাশ থেকে বাজার আটকায় (ক্যাশের টাকা ধরা হয় না)", () => {
  const st = state({ accts: [], opening: { cash: 5000, bkash: 100 } });
  const r = buy(st, purchase("p1", 300), "m:bkash"); assert.strictEqual(r.ok, false); assert.strictEqual(r.r.label, "বিকাশ"); assert.strictEqual(r.r.balance, 100);
  assert(buy(st, purchase("p1", 300), "m:cash").ok, "ক্যাশে আছে");
});
for (const [m, label] of [["nagad", "নগদ"], ["rocket", "রকেট"], ["bank", "ব্যাংক"]]) {
  t(`${label}: কম থাকলে আটকায়, যথেষ্ট থাকলে ${label} থেকেই কাটে (ক্যাশ অপরিবর্তিত)`, () => {
    const st = state({ accts: [], opening: { cash: 900, [m]: 400 } });
    assert.strictEqual(buy(st, purchase("p1", 401), "m:" + m).ok, false);
    const r = buy(st, purchase("p1", 400), "m:" + m); assert(r.ok); const c = calc(r.st);
    assert.strictEqual(bal(c, m), 0); assert.strictEqual(bal(c, "cash"), 900); assert.strictEqual(c.total, 900);
  });
}
t("নামযুক্ত অ্যাকাউন্ট (DBBL ৳১০০০): ৳১০০১ আটকায়, ৳১০০০ চলে এবং শুধু DBBL থেকে কাটে", () => {
  const st = state({ opening: { cash: 50000 } });
  const bad = buy(st, purchase("p1", 1001), "a:dbbl"); assert.strictEqual(bad.ok, false); assert.strictEqual(bad.r.label, "DBBL");
  const ok = buy(st, purchase("p1", 1000), "a:dbbl"); assert(ok.ok); const c = calc(ok.st);
  assert.strictEqual(c.dyn.find((a) => a.id === "dbbl").balance, 0); assert.strictEqual(bal(c, "cash"), 50000, "ক্যাশ ছোঁয়া হয়নি");
  assert.strictEqual(ok.st.transactions[0].accountId, "dbbl");
});
t("স্থানান্তরের পরের ব্যালেন্সই যাচাই হয়: ব্যাংক→বিকাশ ৳৫০০ পাঠালে বিকাশ থেকে ৳৫০০-র বাজার চলে, ব্যাংক থেকে আটকায়", () => {
  const st = state({ accts: [], opening: { bank: 500 }, transfers: [{ id: "x", amount: 500, fromMethod: "bank", toMethod: "bkash" }] });
  assert(buy(st, purchase("p1", 500), "m:bkash").ok); assert.strictEqual(buy(st, purchase("p1", 1), "m:bank").ok, false);
});
t("দেনা-পাওনাও গোনা হয়: ধার নেওয়া ৳২০০ ক্যাশে ঢুকলে ৳২০০-র বাজার চলে", () => {
  const st = state({ accts: [], debts: [{ id: "d", type: "payable", amount: 200, method: "cash", accountId: null, repayments: [] }] });
  assert(buy(st, purchase("p1", 200), "m:cash").ok); assert.strictEqual(buy(st, purchase("p1", 201), "m:cash").ok, false);
});
t("পয়সা: ৳০.৭ − ৳০.১ − ৳০.২ − ৳০.৩ = ঠিক ৳০.১ ধরা হয় (ফ্লোটিং-পয়েন্টের ০.০৯৯৯… ভুলে আটকায় না)", () => {
  const st = state({ accts: [], opening: { cash: 0.7 }, transactions: [{ id: "a", type: "expense", amount: 0.1, method: "cash" }, { id: "b", type: "expense", amount: 0.2, method: "cash" }, { id: "c", type: "expense", amount: 0.3, method: "cash" }] });
  const raw = 0.7 - 0.1 - 0.2 - 0.3; assert(raw < 0.1, "ফ্লোটিং-পয়েন্টে সরাসরি তুলনা করলে ০.১ আটকে যেত (" + raw + ")");
  assert(buy(st, purchase("p1", 0.1), "m:cash").ok, "পয়সায় ঠিক ০.১ আছে — চলতে হবে"); assert(!buy(st, purchase("p1", 0.11), "m:cash").ok);
});

console.log("সম্পাদনা, ডুপ্লিকেট ও মোছা");
t("একই ক্রয় বারবার সিঙ্ক হলেও ঠিক একটিই খরচ (ডুপ্লিকেট নয়)", () => {
  let tx = [];
  for (let i = 0; i < 5; i++) tx = A.applyFamilyPurchaseToTransactions(tx, null, purchase("p1", 320), "m:cash", CAT, mkId, i);
  assert.strictEqual(tx.length, 1); assert.strictEqual(tx[0].amount, 320); assert.strictEqual(tx[0].source, "family-bazar");
});
t("সম্পাদনায় নিজের আগের খরচ বাদ দিয়ে যাচাই: ক্যাশ ৳৩২০, ক্রয় ৳৩২০ → ৳৩২০-ই থাকলে চলে, ৳৩২১ আটকায়", () => {
  const st0 = state({ accts: [], opening: { cash: 320 } }), r = buy(st0, purchase("p1", 320), "m:cash"); assert(r.ok);
  const c = calc(r.st); assert.strictEqual(c.total, 0);
  assert(c.wallet.check("m:cash", 320, "p1").ok, "নিজের ৳৩২০ বাদ দিলে ৳৩২০ আছে"); assert(!c.wallet.check("m:cash", 321, "p1").ok);
  assert.strictEqual(c.wallet.paymentFor("p1"), "m:cash");
});
t("সম্পাদনায় অ্যাকাউন্ট বদলালে আগের অ্যাকাউন্টে টাকা ফেরত যায়, নতুনটি থেকে কাটে — একবারই", () => {
  let st = state({ accts: [], opening: { cash: 1000, bkash: 1000 } }); st = buy(st, purchase("p1", 400), "m:cash").st;
  assert.strictEqual(bal(calc(st), "cash"), 600);
  st = Object.assign({}, st, { transactions: A.applyFamilyPurchaseToTransactions(st.transactions, purchase("p1", 400), purchase("p1", 400), "m:bkash", CAT, mkId, 2) });
  const c = calc(st); assert.strictEqual(st.transactions.length, 1); assert.strictEqual(bal(c, "cash"), 1000); assert.strictEqual(bal(c, "bkash"), 600); assert.strictEqual(c.total, 1600);
});
t("পেমেন্ট না দিয়ে সম্পাদনা করলে আগের অ্যাকাউন্টই থাকে (নীরবে ক্যাশে সরে যায় না)", () => {
  let st = state({ accts: [], opening: { nagad: 1000 } }); st = buy(st, purchase("p1", 100), "m:nagad").st;
  const next = A.applyFamilyPurchaseToTransactions(st.transactions, purchase("p1", 100), purchase("p1", 150), undefined, CAT, mkId, 3);
  assert.strictEqual(next.length, 1); assert.strictEqual(next[0].method, "nagad"); assert.strictEqual(next[0].amount, 150);
});
t("ক্রয় মুছলে খরচও মোছে এবং টাকা অ্যাকাউন্টে ফিরে আসে", () => {
  let st = state({ accts: [], opening: { cash: 500 } }); st = buy(st, purchase("p1", 500), "m:cash").st; assert.strictEqual(calc(st).total, 0);
  const tx = A.applyFamilyPurchaseToTransactions(st.transactions, purchase("p1", 500), null, undefined, CAT, mkId, 4);
  assert.strictEqual(tx.length, 0); assert.strictEqual(calc(Object.assign({}, st, { transactions: tx })).total, 500);
});
t("বাজারের খরচ অন্য লেনদেনের (আয়/ব্যক্তিগত ব্যয়) সঙ্গে মেশে না, আগের লেনদেন অক্ষত", () => {
  const old = [{ id: "i1", type: "income", amount: 1500, method: "cash" }, { id: "e1", type: "expense", amount: 80, method: "cash", category: "food" }];
  const next = A.applyFamilyPurchaseToTransactions(old, null, purchase("p1", 100), "m:cash", CAT, mkId, 5);
  assert.strictEqual(next.length, 3); assert.strictEqual(JSON.stringify(next.slice(0, 2)), JSON.stringify(old));
});
t("পেমেন্ট মান ↔ ক্ষেত্র: m:bkash → {method:bkash}, a:dbbl → {accountId:dbbl}; লেনদেন থেকে উল্টো পথেও একই", () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(A.payFieldsOf("m:bkash"))), { method: "bkash", accountId: null });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(A.payFieldsOf("a:dbbl"))), { method: "cash", accountId: "dbbl" });
  assert.strictEqual(A.payValueOfTx({ method: "rocket" }), "m:rocket"); assert.strictEqual(A.payValueOfTx({ method: "cash", accountId: "dbbl" }), "a:dbbl"); assert.strictEqual(A.payValueOfTx({}), "m:cash");
});

console.log("property: যে কোনো ক্রমে বাজার করলেও কোনো অ্যাকাউন্ট কখনো মাইনাস হয় না");
t("৩০০ এলোমেলো দৃশ্য: যাচাই পাস হওয়া ক্রয়ের পরে ঐ অ্যাকাউন্টের ব্যালেন্স ≥ ০; আটকানো ক্রয়ে কিছুই বদলায় না", () => {
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const pick = (a) => a[Math.floor(rnd() * a.length)];
  const methods = ["cash", "bkash", "nagad", "rocket", "bank"];
  for (let run = 0; run < 300; run++) {
    let st = state({ opening: { cash: Math.round(rnd() * 2000), bkash: Math.round(rnd() * 2000), nagad: Math.round(rnd() * 2000), rocket: 0, bank: Math.round(rnd() * 2000) } });
    for (let i = 0; i < 8; i++) {
      const pay = rnd() < 0.2 ? "a:dbbl" : "m:" + pick(methods), p = purchase("p" + i, Math.round(rnd() * 150000) / 100);
      const before = calc(st), res = buy(st, p, pay); st = res.st; const after = calc(st);
      if (!res.ok) assert.strictEqual(after.total, before.total, "আটকানো ক্রয়ে মোট বদলায়নি");
      const b = pay.startsWith("a:") ? after.dyn.find((a) => a.id === pay.slice(2)).balance : bal(after, pay.slice(2));
      assert(A.toPaisa(b) >= 0, `run ${run}: ${pay} মাইনাস ${b}`);
    }
  }
});

console.log("কোডের সংযোগ (UI ↔ Wallet)");
t("PurchaseSheet: ব্যালেন্স যাচাই savePurchase-এর আগে; সফল হলে payment সহ Wallet-এ পাঠায়", () => {
  const a = bazar.indexOf("wallet.check(payment, p.total, purchaseId.current)"), b = bazar.indexOf("await window.FB.savePurchase(ctx.familyId, old, p)");
  assert(a !== -1 && b !== -1 && a < b, "যাচাই সংরক্ষণের আগে");
  assert(bazar.includes("ctx.afterPurchaseChange(old, p, payment)") && bazar.includes("onExpenseSync(oldP, newP ? Object.assign({}, newP, { familyId: D.activeId }) : null, payment)"));
  assert(bazar.includes("অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই") && bazar.includes("কেনাকাটা সম্পন্ন করতে আগে টাকা যোগ করুন"));
});
t("বাজার তালিকা: কেনা-পণ্য সংরক্ষণ ও সম্পন্ন করা — দুটোই Wallet যাচাই করে; তালিকা তৈরি/পাঠানো খরচ ধরে না", () => {
  assert(shop.includes("walletShort(ctx, need)") && shop.includes("const short = walletShort(ctx, st.actualTotal)") && shop.includes("!!short"));
  assert(!/onExpenseSync|savePurchase|afterPurchaseChange/.test(shop.replace(/\/\/.*$/gm, "")), "তালিকা নিজে কোনো খরচ ঢোকায় না — শুধু PurchaseSheet-এর সফল পেমেন্টে");
});
t("App: wallet সব চার প্রবেশপথে (ট্যাব, মেনু, প্লানিং ট্যাব, প্লানিং মেনু) পৌঁছায়; ব্যালেন্স হিসাব একটাই (আলাদা ইঞ্জিন নেই)", () => {
  assert.strictEqual((src.match(/wallet: familyWallet/g) || []).length, 4);
  assert.strictEqual((src.match(/makeFamilyWallet\(\{/g) || []).length, 1);
  assert(src.includes("applyFamilyPurchaseToTransactions(transactions, oldPurchase, newPurchase, payment,"));
  assert(src.includes('if (!hasEnough(legacyWalletBalance("cash"'), "পুরোনো addBazarItemAsExpense-ও ব্যালেন্স যাচাই করে");
});

console.log(passed + " passed" + (process.exitCode ? " — WITH FAILURES" : ""));
