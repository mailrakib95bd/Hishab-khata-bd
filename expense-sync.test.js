// Tests syncFamilyBazarExpense — the function that copies a family purchase
// into the *purchasing member's own* personal expense ledger, in addition to
// the shared Family Bazar view. Runs the exact source straight out of
// app.js (extracted between two fixed markers) so this test can never
// silently drift from the real implementation.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const START = "const FAMILY_BAZAR_EXPENSE_CATEGORY";
const END_MARK = "persistAll(Object.assign({ transactions: next }, cats !== expenseCats ? { expenseCats: cats } : {}));";
const start = src.indexOf(START);
const endMark = src.indexOf(END_MARK);
assert(start !== -1 && endMark !== -1, "markers not found in app.js — did syncFamilyBazarExpense move or get renamed?");
const afterLine = src.indexOf("\n", endMark) + 1;
const closeBrace = src.indexOf("    };", afterLine) + "    };".length;
// `const` at vm top-level creates a lexical binding, not a global property,
// so the harness couldn't see it afterwards — swap just these two top-level
// declarations to `var` (functionally identical here) so they attach to the
// context object and the test can call them.
const snippet = src.slice(start, closeBrace)
  .replace("const FAMILY_BAZAR_EXPENSE_CATEGORY", "var FAMILY_BAZAR_EXPENSE_CATEGORY")
  .replace("const syncFamilyBazarExpense", "var syncFamilyBazarExpense");

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log("  ✓ " + name); }
  catch (e) { console.error("  ✗ " + name + "\n    " + e.message); process.exitCode = 1; }
}

// a tiny per-test "component instance": plain state + setters, mimicking
// React's actual semantics — a setState call schedules the new value but
// does NOT change what the *currently executing* closure sees (that's what
// makes the real code's `cats !== expenseCats` / `next !== transactions`
// checks meaningful); the sandbox's global only advances between calls,
// once the "render" that made the change has finished.
function makeState(initial) {
  const state = Object.assign({ expenseCats: [{ key: "food", label: "খাবার" }], transactions: [] }, initial);
  const persistCalls = [];
  const ctx = {
    expenseCats: state.expenseCats, transactions: state.transactions,
    setExpenseCats: (v) => { state.expenseCats = v; },
    setTransactions: (v) => { state.transactions = v; },
    persistAll: (patch) => { persistCalls.push(patch); },
    uid: (() => { let n = 0; return () => "tx" + (++n); })(),
    Object, Array,
  };
  vm.createContext(ctx);
  vm.runInContext(snippet, ctx, { filename: "syncFamilyBazarExpense.js" });
  return {
    state, persistCalls,
    run: (o, n) => {
      ctx.expenseCats = state.expenseCats; ctx.transactions = state.transactions; // "next render"
      ctx.syncFamilyBazarExpense(o, n);
    },
  };
}

const purchase = (over) => Object.assign({ purchaseId: "p1", total: 320, date: "2026-09-24", market: "সুন্দরগঞ্জ বাজার", location: "গাইবান্ধা", familyId: "f1" }, over);

t("first save: creates the category once and adds one expense transaction", () => {
  const { state, run } = makeState({});
  run(null, purchase());
  assert.strictEqual(state.expenseCats.length, 2);
  assert.strictEqual(state.expenseCats[1].key, "family_bazar");
  assert.strictEqual(state.transactions.length, 1);
  const tx = state.transactions[0];
  assert.strictEqual(tx.type, "expense");
  assert.strictEqual(tx.amount, 320);
  assert.strictEqual(tx.category, "family_bazar");
  assert.strictEqual(tx.familyPurchaseId, "p1");
  assert.strictEqual(tx.source, "family-bazar");
});

t("category is only created once, even across many purchases", () => {
  const { state, run } = makeState({});
  run(null, purchase({ purchaseId: "p1" }));
  run(null, purchase({ purchaseId: "p2", total: 100 }));
  assert.strictEqual(state.expenseCats.filter((c) => c.key === "family_bazar").length, 1);
  assert.strictEqual(state.transactions.length, 2);
});

t("editing a purchase updates the SAME transaction, not a second one", () => {
  const { state, run } = makeState({});
  run(null, purchase({ total: 320 }));
  run(purchase({ total: 320 }), purchase({ total: 350 }));
  assert.strictEqual(state.transactions.length, 1);
  assert.strictEqual(state.transactions[0].amount, 350);
});

t("deleting a purchase (newPurchase=null) removes its personal transaction, leaves others", () => {
  const { state, run } = makeState({});
  run(null, purchase({ purchaseId: "p1" }));
  run(null, purchase({ purchaseId: "p2", total: 50 }));
  run(purchase({ purchaseId: "p1" }), null);
  assert.strictEqual(state.transactions.length, 1);
  assert.strictEqual(state.transactions[0].familyPurchaseId, "p2");
});

t("deleting a purchase that was never synced (e.g. category already existed) is a harmless no-op", () => {
  const { state, run } = makeState({});
  run(purchase({ purchaseId: "ghost" }), null);
  assert.strictEqual(state.transactions.length, 0);
});

t("an existing family_bazar category (renamed by the user) is reused, never duplicated", () => {
  const { state, run } = makeState({ expenseCats: [{ key: "food", label: "খাবার" }, { key: "family_bazar", label: "আমার বাজার খরচ", icon: "🧺" }] });
  run(null, purchase());
  assert.strictEqual(state.expenseCats.length, 2);
  assert.strictEqual(state.expenseCats.find((c) => c.key === "family_bazar").label, "আমার বাজার খরচ");
});

t("persists exactly what changed — category patch only on first creation", () => {
  const { persistCalls, run } = makeState({});
  run(null, purchase());
  assert.ok("expenseCats" in persistCalls[0], "first sync should persist the new category too");
  run(purchase(), purchase({ total: 400 }));
  assert.ok(!("expenseCats" in persistCalls[persistCalls.length - 1]), "later syncs shouldn't touch expenseCats again");
});

console.log(`\n${passed} passed${process.exitCode ? " — WITH FAILURES" : ""}`);
