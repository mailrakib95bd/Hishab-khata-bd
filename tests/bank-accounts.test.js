// Run: node tests/bank-accounts.test.js
// The money logic of the "ব্যাংক / অ্যাকাউন্ট" system: wallet (cash/bank/bKash…) and named-account
// balances, and the "enough money?" checks. The real functions are cut out of js/app/app.js.
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "app", "app.js"), "utf8");
const fn = (name) => { const a = src.indexOf("function " + name + "("); assert(a !== -1, name + " not found"); return src.slice(a, src.indexOf("\n}\n", a) + 3); };
const cst = (name) => { const a = src.indexOf("const " + name + " ="); assert(a !== -1, name + " not found"); const b = src.indexOf("\n];", a); const c = src.indexOf(";\n", a); return src.slice(a, (src.slice(a, a + 40).includes("[") && b !== -1 && b < c + 400 ? b + 3 : c + 2)); };
const ctx = {}; vm.createContext(ctx);
vm.runInContext([cst("METHODS"), cst("toPaisa"), cst("hasEnough"), fn("computeAccountBalances"), fn("computeDynamicAccountBalances"), fn("legacyWalletBalance"), fn("dynamicWalletBalance"), fn("dashboardTransactions"), fn("debtCashEffect"),
  "this.api = { METHODS, toPaisa, hasEnough, computeAccountBalances, computeDynamicAccountBalances, legacyWalletBalance, dynamicWalletBalance, dashboardTransactions, debtCashEffect };"].join("\n"), ctx);
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

console.log("showing a negative balance");
t("an overdrawn balance keeps its minus sign (it used to look like added money)", () => {
  const c = {}; vm.createContext(c);
  vm.runInContext(["function toBnDigits(s) { return s; }", fn("formatTaka"), fn("formatBalance"), "this.f = { formatTaka, formatBalance };"].join("\n"), c);
  assert.strictEqual(c.f.formatTaka(-500), "500\u09f3", "formatTaka alone drops the sign — that was the trap");
  assert.strictEqual(c.f.formatBalance(-500), "\u2212 500\u09f3"); assert.strictEqual(c.f.formatBalance(500), "500\u09f3"); assert.strictEqual(c.f.formatBalance(0), "0\u09f3"); assert.strictEqual(c.f.formatBalance(-0.2), "0\u09f3", "−0.2 rounds to 0 — no stray minus");
  for (const f of ["app.js", "reports-search.js", "settings.js"]) { const s = fs.readFileSync(path.join(__dirname, "..", "js", "app", f), "utf8"); assert(!/formatTaka\((a|acc|headerStats)\.balance\)/.test(s), f + " still prints a balance with formatTaka"); }
});


console.log("dashboard — bank-type named accounts are outside the total");
{
  const accs = [{ id: "dbbl", type: "bank" }, { id: "bk", type: "mfs" }];
  const net = (list) => list.reduce((x, t) => x + (t.type === "income" ? t.amount : -t.amount), 0);
  t("income/expense tagged to a bank account is not added to the dashboard; mfs accounts still count", () => {
    const tx = [{ id: "a", type: "income", amount: 100000, accountId: "dbbl", date: "2026-10-01" }, { id: "b", type: "income", amount: 500, accountId: "bk", date: "2026-10-01" }, { id: "c", type: "income", amount: 200, date: "2026-10-01" }];
    assert.strictEqual(net(A.dashboardTransactions(tx, [], accs)), 700);
  });
  t("wallet -> bank account shows as an expense; bank account -> wallet shows as income", () => {
    const trs = [{ id: "x1", amount: 3000, fromMethod: "cash", toAccountId: "dbbl", date: "2026-10-02" }, { id: "x2", amount: 1000, fromAccountId: "dbbl", toMethod: "bkash", date: "2026-10-03" }];
    const out = A.dashboardTransactions([{ id: "i", type: "income", amount: 5000, method: "cash" }], trs, accs);
    assert.strictEqual(net(out), 5000 - 3000 + 1000);
    assert.strictEqual(out.find((o) => o.transferId === "x2").category, "bank_withdraw");
  });
  t("bank -> bank, or no bank account at all, changes nothing", () => {
    assert.strictEqual(A.dashboardTransactions([], [{ id: "y", amount: 5, fromAccountId: "dbbl", toAccountId: "dbbl2" }], [...accs, { id: "dbbl2", type: "bank" }]).length, 0);
    const tx = [{ id: "z", type: "income", amount: 9 }];
    assert.deepStrictEqual(A.dashboardTransactions(tx, [{ id: "q", amount: 1, fromMethod: "cash", toMethod: "bank" }], []), tx);
  });
}

console.log("debts — lending takes money out of the wallet, getting it back puts it in");
{
  const lend = { trackBalance: true, id: "d1", type: "receivable", amount: 1000, method: "cash", repayments: [{ id: "r1", amount: 400, method: "cash" }] };
  const borrow = { trackBalance: true, id: "d2", type: "payable", amount: 500, method: "bkash", repayments: [{ id: "r2", amount: 100, method: "bkash" }] };
  t("lent money leaves the wallet; repayment received comes back", () => {
    assert.strictEqual(wallet(A.computeAccountBalances([], { cash: 5000 }, [], [lend]), "cash"), 5000 - 1000 + 400);
  });
  t("borrowed money enters the wallet; repaying it leaves", () => {
    assert.strictEqual(wallet(A.computeAccountBalances([], {}, [], [borrow]), "bkash"), 500 - 100);
  });
  t("the lend check sees the reduced balance, and editing ignores the debt's own old amount", () => {
    const data = { accountOpening: { cash: 1000 }, debts: [{ trackBalance: true, id: "d3", type: "receivable", amount: 800, method: "cash", repayments: [] }] };
    assert.strictEqual(A.legacyWalletBalance("cash", data), 200);
    assert.strictEqual(A.legacyWalletBalance("cash", data, { debtId: "d3" }), 1000);
  });
  t("old debts (no trackBalance flag) keep the balances they always had", () => {
    const old = [{ id: "old", type: "receivable", amount: 1000, method: "cash", repayments: [] }];
    assert.strictEqual(wallet(A.computeAccountBalances([], { cash: 5000 }, [], old), "cash"), 5000);
    assert.strictEqual(A.debtCashEffect(old, []), 0);
  });
  t('"other" or method-less debts touch no wallet and not the dashboard', () => {
    const o = [{ trackBalance: true, id: "o", type: "receivable", amount: 700, method: "other", repayments: [{ id: "x", amount: 50, method: "other" }] }, { trackBalance: true, id: "n", type: "receivable", amount: 300, repayments: [] }];
    assert.strictEqual(A.debtCashEffect(o, []), 0);
    assert(A.computeAccountBalances([], { cash: 10 }, [], o).every((w) => w.key !== "cash" || w.balance === 10));
  });
  t("dashboard effect = -lent + received back + borrowed - repaid; bank-account repayments are left out", () => {
    assert.strictEqual(A.debtCashEffect([lend, borrow], []), -1000 + 400 + 500 - 100);
    const bankRep = { trackBalance: true, id: "d4", type: "receivable", amount: 100, method: "cash", repayments: [{ id: "r", amount: 100, accountId: "dbbl" }] };
    assert.strictEqual(A.debtCashEffect([bankRep], [{ id: "dbbl", type: "bank" }]), -100);
  });
}
console.log("ledger — debts and bank moves become real records everywhere");
{
  const D = [{ id: "d1", person: "রহিম", type: "receivable", amount: 1000, method: "cash", date: "2026-10-30", trackBalance: true, repayments: [{ id: "r1", amount: 300, method: "cash", date: "2026-10-31" }] },
             { id: "d2", person: "করিম", type: "payable", amount: 500, method: "bkash", date: "2026-10-30", trackBalance: true, repayments: [] },
             { id: "d0", person: "পুরনো", type: "receivable", amount: 9000, method: "cash", date: "2026-10-01", repayments: [{ id: "r0", amount: 100, method: "cash", date: "2026-10-02" }] }];
  const net = (l) => l.reduce((x, e) => x + (e.type === "income" ? e.amount : -e.amount), 0);
  t("lend/borrow/repayments appear as entries; old debt principal does not, its repayment does", () => {
    const L = A.dashboardTransactions([], [], [], D);
    assert.deepStrictEqual(L.map((e) => e.category).sort(), ["debt_borrow", "debt_lend", "debt_recv", "debt_recv"]);
    assert.strictEqual(net(L), -1000 + 300 + 500 + 100);
    assert(L.every((e) => e.virtual && e.debtId));
  });
  t("ledger total = wallet-based effect (debtCashEffect) — one source of truth", () => {
    assert.strictEqual(net(A.dashboardTransactions([], [], [], D)), A.debtCashEffect(D, []));
  });
  t("search mode (all) keeps bank-account transactions and tags bank moves with the account", () => {
    const accs = [{ id: "dbbl", type: "bank" }];
    const tx = [{ id: "a", type: "income", amount: 50, accountId: "dbbl", date: "2026-10-01" }];
    const trs = [{ id: "x", amount: 7, fromMethod: "cash", toAccountId: "dbbl", date: "2026-10-02" }];
    assert.strictEqual(A.dashboardTransactions(tx, trs, accs, [], { all: true }).length, 2);
    assert.strictEqual(A.dashboardTransactions(tx, trs, accs, [], { all: true }).find((e) => e.virtual).accountId, "dbbl");
    assert.strictEqual(A.dashboardTransactions(tx, trs, accs, []).length, 1);
  });
}
console.log(`\n${passed} passed${process.exitCode ? " — WITH FAILURES" : ""}`);
