// Tests the optional Amount/টাকা field on personal Tasks: addTask should
// accept a numeric string, an empty string, or an invalid string and always
// store either a clean number or null — and the old plain-string quick-add
// call (typeof data === "string") must keep working unchanged. Runs the
// exact source straight out of app.js so this can never silently drift.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const START = "const addTask = (data) => {";
const END = "const updateTask = (id, patch) => {";
const start = src.indexOf(START);
const end = src.indexOf(END);
assert(start !== -1 && end !== -1, "markers not found in app.js — did addTask move or get renamed?");
const snippet = src.slice(start, end).replace("const addTask", "var addTask");

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log("  ✓ " + name); }
  catch (e) { console.error("  ✗ " + name + "\n    " + e.message); process.exitCode = 1; }
}

function makeState() {
  const state = { tasks: [] };
  const ctx = {
    tasks: state.tasks, MAX_TASKS: 500,
    setTasks: (v) => { state.tasks = v; ctx.tasks = v; },
    persistAll: () => {},
    uid: (() => { let n = 0; return () => "t" + (++n); })(),
    isNaN, parseFloat, Object, Array,
  };
  vm.createContext(ctx);
  vm.runInContext(snippet, ctx, { filename: "addTask.js" });
  return { state, add: (data) => ctx.addTask(data) };
}

t("a numeric amount string is stored as a number", () => {
  const { state, add } = makeState();
  add({ text: "দুধ কিনুন", amount: "150" });
  assert.strictEqual(state.tasks[0].amount, 150);
});
t("no amount, blank amount, and an invalid amount all store null (field is optional)", () => {
  const { state, add } = makeState();
  add({ text: "A" });
  add({ text: "B", amount: "" });
  add({ text: "C", amount: "abc" });
  const amounts = state.tasks.map((x) => x.amount); // cross-realm array (vm context) — compare by value, not deepStrictEqual
  assert.strictEqual(amounts.length, 3);
  amounts.forEach((a) => assert.strictEqual(a, null));
});
t("the old plain-string quick-add call still works and has no amount", () => {
  const { state, add } = makeState();
  add("বাজারে যাও");
  assert.strictEqual(state.tasks[0].text, "বাজারে যাও");
  assert.strictEqual(state.tasks[0].amount, null);
});
t("a zero amount is kept (0 is a valid, meaningful amount — not treated as missing)", () => {
  const { state, add } = makeState();
  add({ text: "D", amount: "0" });
  assert.strictEqual(state.tasks[0].amount, 0);
});

console.log(`\n${passed} passed${process.exitCode ? " — WITH FAILURES" : ""}`);
