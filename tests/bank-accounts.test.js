// Run: node tests/bank-accounts.test.js
// The money logic of the "ব্যাংক / অ্যাকাউন্ট" system: wallet (cash/bank/bKash…) and named-account
// balances, and the "enough money?" checks. The real functions are cut out of js/app/app.js.
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "app", "app.js"), "utf8");
const fn = (name) => { const a = src.indexOf("function " + name + "("); assert(a !== -1, name + " not found"); return src.slice(a, src.indexOf("\n}\n", a) + 3); };
const cst = (name) => { const a = src.indexOf("const " + name + " ="); assert(a !== -1, name + " not found"); const b = src.indexOf("\n];", a); const c = src.indexOf(";\n", a); return src.slice(a, (src.slice(a, a + 40).includes("[") && b !== -1 && b < c + 400 ? b + 3 : c + 2)); };
const ctx = {}; vm.createContext(ctx);
vm.runInContext([cst("METHODS"), cst("toPaisa"), cst("hasEnough"), fn("computeAccountBalances"), fn("computeDynamicAccountBalances"), fn("legacyWalletBalance"), fn("dynamicWalletBalance"),
  "this.api = { METHODS, toPaisa, hasEnough, computeAccountBalances, computeDynamicAccountBalances, legacyWalletBalance, dynamicWalletBalance };"].join("\n"), ctx);
const A = ctx.api;
let passed = 0;
const t = (name, f) => { try { f(); passed++; console.log("  \u2713", name); } catch (e) { console.error("  \u2717", name, "\n   ", e.message); process.exitCode = 1; } };
const wallet = (arr, k) => arr.find((x) => x.key === k).balance, acct = (arr, id) => arr.find((x) => x.id === id).balance;
const ACCTS = [{ id: "dbbl", name: "DBBL", openingBalance: 10000 }, { id: "city", name: "City", openingBalance: 2000 }];

console.log("balances — one taka is counted once");
t("an expense paid from a NAMED account leaves only that account (cash wallet untouched)", () => {
  const tx = [{ id: "t1", type: "expense", amount: 1000, method: "cash", accountId: "dbbl" }]; // exactly what the transaction form saves
  assert.strictEqual(wallet(A.computeAccountBalances(tx, { cash: 5000 }, [], []), "cash"), 5000, "cash must stay 5000");
  assert.strictEqual(acct(A.computeDynamicAccountBalances(tx, ACCTS, [], []), "dbbl"), 9000);
});
t("income into a named account is not also added to the cash wallet", () => {
  const tx = [{ id: "t1", type: "income", amount: 700, method: "cash", accountId: "city" }];
  assert.strictEqual(wallet(A.computeAccountBalances(tx, { cash: 0 }, [], []), "cash"), 0); assert.strictEqual(acct(A.computeDynamicAccountBalances(tx, ACCTS, [], []), "city"), 2700);
});
t("a transaction with no method (old data, Family Bazar sync) is cash — in the display AND in the check", () => {
  const tx = [{ id: "t2", type: "expense", amount: 300 }];
  assert.strictEqual(wallet(A.computeAccountBalances(tx, { cash: 1000 }, [], []), "cash"), 700);
  assert.strictEqual(A.legacyWalletBalance("cash", { accountOpening: { cash: 1000 }, transactions: tx }), 700);
});
t("transfers and debt repayments still work for wallets and named accounts", () => {
  const trs = [{ id: "x1", amount: 500, fromAccountId: "dbbl", toMethod: "bank" }, { id: "x2", amount: 200, fromMethod: "cash", toAccountId: "city" }];
  const debts = [{ id: "d1", type: "payable", repayments: [{ id: "r1", amount: 100, method: "bank" }, { id: "r2", amount: 50, accountId: "city" }] }, { id: "d2", type: "receivable", repayments: [{ id: "r3", amount: 80, method: "cash" }] }];
  const L = A.computeAccountBalances([], { cash: 1000, bank: 0 }, trs, debts), D = A.computeDynamicAccountBalances([], ACCTS, trs, debts);
  assert.strictEqual(wallet(L, "cash"), 1000 - 200 + 80); assert.strictEqual(wallet(L, "bank"), 500 - 100); assert.strictEqual(acct(D, "dbbl"), 9500); assert.strictEqual(acct(D, "city"), 2000 + 200 - 50);
});

console.log("checks use the SAME numbers as the display");
t("property: for random mixed data, every wallet/account check-balance equals its displayed balance", () => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const pick = (a) => a[Math.floor(rnd() * a.length)];
  for (let run = 0; run < 200; run++) {
    const methods = A.METHODS.map((m) => m.key), ids = ACCTS.map((a) => a.id), money = () => Math.round(rnd() * 5000) / 100;
    const transactions = Array.from({ length: 8 }, (_, i) => ({ id: "t" + i, type: pick(["income", "expense"]), amount: money(), method: pick(methods.concat([undefined])), accountId: pick(ids.concat([null, null])) }));
    const transfers = Array.from({ length: 3 }, (_, i) => { const m = rnd() < 0.5; return { id: "x" + i, amount: money(), fromMethod: m ? pick(methods) : null, fromAccountId: m ? null : pick(ids), toMethod: m ? null : pick(methods), toAccountId: m ? pick(ids) : null }; });
    const debts = [{ id: "d", type: pick(["payable", "receivable"]), repayments: [{ id: "r1", amount: money(), method: pick(methods), accountId: null }, { id: "r2", amount: money(), method: null, accountId: pick(ids) }] }];
    const opening = { cash: money(), bank: money() }; const data = { accountOpening: opening, transactions, transfers, debts, userAccounts: ACCTS };
    const L = A.computeAccountBalances(transactions, opening, transfers, debts), D = A.computeDynamicAccountBalances(transactions, ACCTS, transfers, debts);
    methods.forEach((m) => assert.strictEqual(A.toPaisa(A.legacyWalletBalance(m, data)), A.toPaisa(wallet(L, m)), `run ${run} wallet ${m}`));
    ids.forEach((id) => assert.strictEqual(A.toPaisa(A.dynamicWalletBalance(id, data)), A.toPaisa(acct(D, id)), `run ${run} account ${id}`));
  }
});
t("editing an expense does not subtract its own old amount twice", () => {
  const data = { accountOpening: { cash: 1000 }, transactions: [{ id: "e1", type: "expense", amount: 900, method: "cash" }] };
  assert.strictEqual(A.legacyWalletBalance("cash", data), 100); assert.strictEqual(A.legacyWalletBalance("cash", data, { txId: "e1" }), 1000);
  const d2 = { transactions: [{ id: "e2", type: "expense", amount: 9000, accountId: "dbbl" }], userAccounts: ACCTS, transfers: [], debts: [] };
  assert.strictEqual(A.dynamicWalletBalance("dbbl", d2), 1000); assert.strictEqual(A.dynamicWalletBalance("dbbl", d2, { txId: "e2" }), 10000);
});
t("an expense from a named account is judged by THAT account, not by the cash wallet", () => {
  const data = { accountOpening: { cash: 0 }, transactions: [], transfers: [], debts: [], userAccounts: ACCTS };
  assert(A.hasEnough(A.dynamicWalletBalance("dbbl", data), 500), "DBBL has 10000 — allowed although cash is 0");
  const low = { accountOpening: { cash: 99999 }, transactions: [{ id: "a", type: "expense", amount: 9900, accountId: "dbbl" }], transfers: [], debts: [], userAccounts: ACCTS };
  assert(!A.hasEnough(A.dynamicWalletBalance("dbbl", low), 500), "DBBL has only 100 — blocked although cash is huge");
});
t("repayment edit: the old repayment's effect is excluded", () => {
  const data = { transactions: [], transfers: [], userAccounts: ACCTS, debts: [{ id: "d1", type: "payable", repayments: [{ id: "r1", amount: 10000, accountId: "dbbl" }] }] };
  assert.strictEqual(A.dynamicWalletBalance("dbbl", data), 0); assert.strictEqual(A.dynamicWalletBalance("dbbl", data, { repaymentId: "r1" }), 10000);
});

console.log("rounding — no false \"insufficient balance\"");
t("an exactly-sufficient balance is accepted despite floating-point noise (0.3 − 0.1, then 0.2)", () => {
  const data = { accountOpening: { cash: 0 }, transactions: [{ id: "a", type: "income", amount: 0.3, method: "cash" }, { id: "b", type: "expense", amount: 0.1, method: "cash" }] };
  assert(A.hasEnough(A.legacyWalletBalance("cash", data), 0.2), "0.2 available, 0.2 requested"); assert(!A.hasEnough(A.legacyWalletBalance("cash", data), 0.21), "0.21 is more than is available");
});
t("hasEnough compares whole paisa", () => { assert(A.hasEnough(100.1, 100.1)); assert(A.hasEnough(0.1 + 0.2, 0.3)); assert(!A.hasEnough(99.99, 100)); assert(A.hasEnough(0, 0)); });

console.log("transaction list");
t("an expense row is shown with a minus sign, an income row with a plus (the amount is stored positive)", () => {
  const a = src.indexOf("function TxRow("); const row = src.slice(a, src.indexOf("\n}\n", a));
  assert(/formatTaka\(isIncome \? tx\.amount : -tx\.amount, \{ sign: true/.test(row), "TxRow must pass a negative amount for expenses");
});

console.log(`\n${passed} passed${process.exitCode ? " — WITH FAILURES" : ""}`);
