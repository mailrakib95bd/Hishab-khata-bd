// Tests for the row-table বাল্ক ইমপোর্ট (special-day bulk import), rebuilt
// to match খসড়া খাতা's fast, one-page, Enter-to-add-row UX. Extracts the
// real functions straight out of app.js so these tests can never drift from
// the shipped code.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

function resolvePath(name) {
  return fs.existsSync(path.join(__dirname, name)) ? path.join(__dirname, name) : path.join(__dirname, "..", name);
}
const appSrc = fs.readFileSync(resolvePath("app.js"), "utf8");

let passed = 0;
function t(name, fn) { try { fn(); passed++; console.log("  ✓ " + name); } catch (e) { console.error("  ✗ " + name + "\n    " + e.message); process.exitCode = 1; } }

// ---- extract the pure row-table helpers -----------------------------
const f0 = appSrc.indexOf("function newBulkSpecialDayRow()");
const f1 = appSrc.indexOf("function BulkSpecialDayImport(");
assert(f0 !== -1 && f1 !== -1, "bulk-import row helpers not found in app.js — did they move?");
const helperSrc = appSrc.slice(f0, f1);
const uidSrc = appSrc.slice(appSrc.indexOf("function uid() {"), appSrc.indexOf("function uid() {") + 200).split("\n}")[0] + "\n}";
const ctx = { crypto: require("crypto"), Date, Math, Array, String };
vm.createContext(ctx);
vm.runInContext(uidSrc + "\n" + helperSrc + "\nthis.H = { newBulkSpecialDayRow, newBulkSpecialDayRows, isBlankBulkSpecialDayRow, bulkSpecialDayEnterNav };", ctx);
const H = ctx.H;

t("newBulkSpecialDayRows(10) makes exactly 10 empty rows, matching the spec's one-page ১০ সিরিয়াল", () => {
  const rows = H.newBulkSpecialDayRows(10);
  assert.strictEqual(rows.length, 10);
  rows.forEach((r) => assert.strictEqual(H.isBlankBulkSpecialDayRow(r), true));
  const ids = new Set(rows.map((r) => r.id));
  assert.strictEqual(ids.size, 10, "each row must get its own unique id");
});
t("a row is blank only by its title — date-only or details-only doesn't count as used", () => {
  assert.strictEqual(H.isBlankBulkSpecialDayRow({ title: "", gDate: "2026-09-10", details: "x" }), true);
  assert.strictEqual(H.isBlankBulkSpecialDayRow({ title: "  ", details: "x" }), true, "whitespace-only title is still blank");
  assert.strictEqual(H.isBlankBulkSpecialDayRow({ title: "ঈদ" }), false);
});

// ---- Enter-to-add-row behaviour (spec: title Enter with text → new row;
// title Enter while empty → nothing; matches খসড়া খাতার enterNav()) -----
t("Enter on a non-last row's title just moves focus to the next row — never adds", () => {
  const rows = H.newBulkSpecialDayRows(3);
  rows[0].title = "ক";
  const act = H.bulkSpecialDayEnterNav(0, rows);
  assert.strictEqual(act.type, "focus"); assert.strictEqual(act.index, 1);
});
t("Enter on the LAST row with a non-empty title adds a new row and focuses it", () => {
  const rows = H.newBulkSpecialDayRows(3);
  rows[2].title = "ঈদুল ফিতর";
  const act = H.bulkSpecialDayEnterNav(2, rows);
  assert.strictEqual(act.type, "add"); assert.strictEqual(act.index, 3);
});
t("Enter on the LAST row with an EMPTY title does nothing — no new row", () => {
  const rows = H.newBulkSpecialDayRows(3);
  const act = H.bulkSpecialDayEnterNav(2, rows);
  assert.strictEqual(act.type, "none");
});
t("line 10 gets a title + Enter → line 11 is created (spec's own worked example)", () => {
  const rows = H.newBulkSpecialDayRows(10);
  rows[9].title = "শবে বরাত";
  const act = H.bulkSpecialDayEnterNav(9, rows);
  assert.strictEqual(act.type, "add");
  assert.strictEqual(act.index, 10);
});

// ---- Hijri-recurring dedup key (server-side, in adminBulkImportSpecialDays)
const dupStart = appSrc.indexOf("const specialDayDupKey = (s) =>");
const dupEnd = appSrc.indexOf("\n", appSrc.indexOf(": `${s.date}"));
assert(dupStart !== -1, "specialDayDupKey not found — did bulk-import dedup move?");
const dupSrc = appSrc.slice(dupStart, dupEnd + 2).replace("const specialDayDupKey", "var specialDayDupKey");
const ctx2 = {};
vm.createContext(ctx2);
vm.runInContext(dupSrc + "\nthis.dupKey = specialDayDupKey;", ctx2);

t("dedup key for a fixed-date entry is date+title, as before", () => {
  assert.strictEqual(ctx2.dupKey({ date: "2026-09-10", title: "ঈদ মিলাদুন্নবী" }), "2026-09-10|ঈদ মিলাদুন্নবী");
});
t("dedup key for a Hijri-recurring entry uses hijriMonth/hijriDay instead of the (always-null) date, so a repeated bulk import of ১৪ রজব is still caught as a duplicate", () => {
  const a = ctx2.dupKey({ recurrence: "hijri", hijriMonth: 7, hijriDay: 14, title: "শবে মিরাজ", date: null });
  const b = ctx2.dupKey({ recurrence: "hijri", hijriMonth: 7, hijriDay: 14, title: "শবে মিরাজ", date: null });
  assert.strictEqual(a, b);
  assert.strictEqual(a, "hijri:7-14|শবে মিরাজ");
});
t("a fixed-date entry and a recurring entry with the same title never collide on dedup key", () => {
  const fixed = ctx2.dupKey({ date: null, title: "ক" });
  const recurring = ctx2.dupKey({ recurrence: "hijri", hijriMonth: 1, hijriDay: 1, title: "ক", date: null });
  assert.notStrictEqual(fixed, recurring);
});

// ---- structural checks on the component itself ------------------------
const compSrc = appSrc.slice(appSrc.indexOf("function BulkSpecialDayImport("), appSrc.indexOf("function AdminPanel("));
t("the bulk-import screen starts with 10 rows and offers an English/Hijri toggle at the top", () => {
  assert(compSrc.includes("newBulkSpecialDayRows(10)"), "doesn't start with 10 rows");
  assert(compSrc.includes('"gregorian"') && compSrc.includes('"hijri"'), "missing the English/Hijri date-mode toggle");
});
t("saving with a title but no date (in either mode) is blocked with an inline error, not silently skipped", () => {
  assert(compSrc.includes("incomplete.push(serial)"), "incomplete rows should be reported, not silently dropped");
  assert(compSrc.includes('তারিখ দেওয়া হয়নি'), "missing the incomplete-date error message");
});
t("a Hijri-mode row is always saved as a recurring entry (month/day only, no date), matching the single-entry admin form's own schema", () => {
  const hijriPushBlock = compSrc.slice(compSrc.indexOf("const hm = parseInt"), compSrc.indexOf("if (incomplete.length)"));
  assert(hijriPushBlock.includes('recurrence: "hijri"') && hijriPushBlock.includes("date: null"));
});
t("Enter-to-add is wired to the বিবরণ/শিরোনাম (title) input specifically, not the details or date field", () => {
  assert(compSrc.includes('onKeyDown: onTitleEnter(i)'));
  const titleInputLine = compSrc.split("\n").find((l) => l.includes("onTitleEnter(i)"));
  assert(titleInputLine.includes('placeholder: "যেমন: ঈদ মিলাদুন্নবী"'), "Enter handler attached to the wrong input");
});

console.log(`\n${passed} passed${process.exitCode ? " — WITH FAILURES" : ""}`);
