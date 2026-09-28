// The optional পরিমাণ/টাকা field was REMOVED from personal Tasks. This test
// makes sure it stays gone: addTask must never store an `amount`, even if an
// old caller still passes one, and the plain-string quick add keeps working.
// Runs the exact source straight out of app.js so it can never drift.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const appPath = fs.existsSync(path.join(__dirname, "app.js")) ? path.join(__dirname, "app.js") : path.join(__dirname, "..", "app.js");
const src = fs.readFileSync(appPath, "utf8");
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

t("a task never stores an amount, even if the caller passes one", () => {
  const { state, add } = makeState();
  add({ text: "দুধ কিনুন", amount: "150" });
  assert.strictEqual(state.tasks.length, 1);
  assert.strictEqual("amount" in state.tasks[0], false);
});
t("the rest of the task is stored as before", () => {
  const { state, add } = makeState();
  add({ text: "A", date: "2026-10-01", time: "09:30", category: "food", note: "n", repeat: "daily" });
  const x = state.tasks[0];
  assert.strictEqual(x.text, "A"); assert.strictEqual(x.date, "2026-10-01"); assert.strictEqual(x.time, "09:30");
  assert.strictEqual(x.category, "food"); assert.strictEqual(x.note, "n"); assert.strictEqual(x.repeat, "daily");
  assert.strictEqual(x.done, false);
});
t("the old plain-string quick-add call still works", () => {
  const { state, add } = makeState();
  add("বাজারে যাও");
  assert.strictEqual(state.tasks[0].text, "বাজারে যাও");
});
t("the task form source no longer has a পরিমাণ field", () => {
  const f0 = src.indexOf("function TaskForm(");
  const f1 = src.indexOf("function Header(", f0);
  const form = src.slice(f0, f1);
  assert(!form.includes("পরিমাণ") && !form.includes("amount"), "TaskForm still mentions পরিমাণ/amount");
});

console.log(`\n${passed} passed${process.exitCode ? " — WITH FAILURES" : ""}`);
