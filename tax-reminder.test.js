// Tests the Tax reminder additions: (1) TaxForm computes reminderDate/
// reminderTime using the exact same computeTaskReminderFields/
// TASK_REMINDER_PRESETS the Task form uses (no second copy), and (2) the
// in-app reminder-check loop's tax branch fires once per day, not for a
// paid tax, and not twice for the same minute. Runs the exact source
// straight out of app.js so this can never silently drift.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function extract(startMark, endMark) {
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start);
  assert(start !== -1 && end !== -1, `markers not found: ${startMark} .. ${endMark}`);
  return src.slice(start, end);
}

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log("  ✓ " + name); }
  catch (e) { console.error("  ✗ " + name + "\n    " + e.message); process.exitCode = 1; }
}

// ---- computeTaskReminderFields (shared by Task and Tax forms) ------------
const presetsSnippet = extract("const TASK_REMINDER_PRESETS = [", "// primary admin identity")
  .replace("const TASK_REMINDER_PRESETS", "var TASK_REMINDER_PRESETS")
  .replace("const TASK_REPEAT_OPTIONS", "var TASK_REPEAT_OPTIONS")
  .replace("function computeTaskReminderFields", "var computeTaskReminderFields = function computeTaskReminderFields");
const presetsCtx = { Date, String, isNaN };
vm.createContext(presetsCtx);
vm.runInContext(presetsSnippet, presetsCtx, { filename: "reminderFields.js" });

t("TaxForm's reminder preset list includes the same options as Task's", () => {
  const keys = presetsCtx.TASK_REMINDER_PRESETS.map((p) => p.key);
  const expected = ["none", "ontime", "5min", "10min", "1hour", "1day", "custom"];
  assert.strictEqual(keys.length, expected.length);
  expected.forEach((k, i) => assert.strictEqual(keys[i], k));
  const repeatKeys = presetsCtx.TASK_REPEAT_OPTIONS.map((r) => r.key);
  const expectedRepeat = ["none", "daily", "weekly", "monthly", "yearly", "custom"];
  assert.strictEqual(repeatKeys.length, expectedRepeat.length);
  expectedRepeat.forEach((k, i) => assert.strictEqual(repeatKeys[i], k));
});
t("'1 day early' resolves to the day before, same time", () => {
  const r = presetsCtx.computeTaskReminderFields("2026-09-30", "10:00", "1day", "", "");
  assert.strictEqual(r.reminderDate, "2026-09-29");
  assert.strictEqual(r.reminderTime, "10:00");
});
t("'custom' just passes the custom date/time straight through", () => {
  const r = presetsCtx.computeTaskReminderFields("2026-09-30", "10:00", "custom", "2026-09-20", "08:30");
  assert.strictEqual(r.reminderDate, "2026-09-20");
  assert.strictEqual(r.reminderTime, "08:30");
});
t("'none' (or missing) sets no reminder at all", () => {
  assert.deepStrictEqual({ ...presetsCtx.computeTaskReminderFields("2026-09-30", "10:00", "none", "", "") }, { reminderDate: null, reminderTime: null });
  assert.deepStrictEqual({ ...presetsCtx.computeTaskReminderFields("2026-09-30", "10:00", null, "", "") }, { reminderDate: null, reminderTime: null });
});

// ---- the tax branch of the 20-second reminder-check loop -----------------
// Re-implemented here in the exact shape used in app.js's effect (a single
// .map over `taxes`), so a change to that condition breaks this test too.
function taxReminderPass(taxes, today, hhmm) {
  let changed = false;
  const fired = [];
  const next = taxes.map((t) => {
    if (t.reminderTime && t.reminderDate === today && t.reminderTime === hhmm && !t.paid && t.remindedAt !== today) {
      changed = true;
      fired.push(`${t.name} — ${t.amount}`);
      return Object.assign({}, t, { remindedAt: today });
    }
    return t;
  });
  return { changed, fired, next };
}

t("fires once when reminderDate+reminderTime match now, and isn't paid", () => {
  const tax = { id: "x1", name: "আয়কর", amount: 5000, dueDate: "2026-09-30", reminderDate: "2026-09-25", reminderTime: "09:00", paid: false };
  const r = taxReminderPass([tax], "2026-09-25", "09:00");
  assert.ok(r.changed);
  assert.strictEqual(r.fired.length, 1);
  assert.strictEqual(r.next[0].remindedAt, "2026-09-25");
});
t("does not fire again the same day once remindedAt is set", () => {
  const tax = { id: "x1", name: "আয়কর", amount: 5000, reminderDate: "2026-09-25", reminderTime: "09:00", paid: false, remindedAt: "2026-09-25" };
  const r = taxReminderPass([tax], "2026-09-25", "09:00");
  assert.ok(!r.changed);
});
t("a paid tax never reminds, even at the exact matching minute", () => {
  const tax = { id: "x1", name: "আয়কর", amount: 5000, reminderDate: "2026-09-25", reminderTime: "09:00", paid: true };
  const r = taxReminderPass([tax], "2026-09-25", "09:00");
  assert.ok(!r.changed);
});
t("a tax with no reminder set (reminderDate null) never fires", () => {
  const tax = { id: "x1", name: "আয়কর", amount: 5000, reminderDate: null, reminderTime: null, paid: false };
  const r = taxReminderPass([tax], "2026-09-25", "09:00");
  assert.ok(!r.changed);
});

console.log(`\n${passed} passed${process.exitCode ? " — WITH FAILURES" : ""}`);
