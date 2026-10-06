// Hijri ⇄ English conversion used throughout app.js (dashboard, calendar
// grid, Admin "বিশেষ দিবস" form), and the recurring-Hijri special-day
// helpers. Extracts the real functions from app.js so the test can't drift
// from the app; loads the real hijri-ummalqura.js as window.HijriUQ so the
// extracted wrapper functions run exactly as they do in the browser.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

function resolvePath(name) {
  return fs.existsSync(path.join(__dirname, name)) ? path.join(__dirname, name) : path.join(__dirname, "..", name);
}
const appSrc = fs.readFileSync(resolvePath("app.js"), "utf8");
const hijriUqSrc = fs.readFileSync(resolvePath("hijri-ummalqura.js"), "utf8");

const a = appSrc.indexOf("const HIJRI_MONTHS = [");
const b = appSrc.indexOf("function monthKeyOf(dateStr)");
assert(a !== -1 && b !== -1, "Hijri wrapper block not found in app.js — did it move?");
const block = appSrc.slice(a, b);
["gregorianToHijri", "hijriToGregorianYmd", "ymdToHijriParts", "islamicEffectiveDate"].forEach((fn) =>
  assert(block.includes("function " + fn), "app.js no longer defines " + fn + " where expected"));

const win = {};
const ctx = { window: win, module: undefined, globalThis: undefined, Intl, Math, Date, String, parseInt, isFinite };
vm.createContext(ctx);
vm.runInContext(hijriUqSrc, ctx, { filename: "hijri-ummalqura.js" });
assert(win.HijriUQ, "hijri-ummalqura.js did not attach window.HijriUQ");
vm.runInContext(block + "\nthis.F={gregorianToHijri,hijriToGregorianYmd,ymdToHijriParts,islamicEffectiveDate,HIJRI_MONTHS};", ctx);
const F = ctx.F;

let passed = 0;
function t(name, fn) { try { fn(); passed++; console.log("  ✓ " + name); } catch (e) { console.error("  ✗ " + name + "\n    " + e.message); process.exitCode = 1; } }

t("gregorianToHijri(date) matches the underlying Umm al-Qura table", () => {
  const g = F.gregorianToHijri(new Date(2026, 8, 28));
  const h = win.HijriUQ.gregorianToHijri(2026, 9, 28);
  assert.strictEqual(g.day, h.day); assert.strictEqual(g.year, h.year); assert.strictEqual(F.HIJRI_MONTHS[h.month - 1], g.month);
});
t("ymdToHijriParts agrees with gregorianToHijri for the same date", () => {
  const h = F.ymdToHijriParts("2026-09-28");
  const g = F.gregorianToHijri(new Date(2026, 8, 28));
  assert.strictEqual(h.day, g.day); assert.strictEqual(F.HIJRI_MONTHS[h.month - 1], g.month); assert.strictEqual(h.year, g.year);
});
t("hijriToGregorianYmd round-trips through ymdToHijriParts", () => {
  const h = F.ymdToHijriParts("2026-09-28");
  assert.strictEqual(F.hijriToGregorianYmd(h.year, h.month, h.day), "2026-09-28");
});
t("a known, independently-sourced date: 1 Muharram 1448 = 16 June 2026", () => {
  assert.strictEqual(F.hijriToGregorianYmd(1448, 1, 1), "2026-06-16");
});
t("impossible or out-of-range Hijri dates are rejected, not silently guessed", () => {
  assert.strictEqual(F.hijriToGregorianYmd(1448, 13, 1), null);
  assert.strictEqual(F.hijriToGregorianYmd(1448, 1, 31), null);
  assert.strictEqual(F.hijriToGregorianYmd(1000, 1, 1), null); // outside 1356-1500 AH table
});
t("islamicEffectiveDate returns the plain Gregorian date before Dhaka sunset", () => {
  const before = new Date(Date.UTC(2026, 5, 16, 10, 0, 0)); // 16:00 Dhaka
  const eff = F.islamicEffectiveDate(before);
  assert.strictEqual(eff.getFullYear(), 2026); assert.strictEqual(eff.getMonth(), 5); assert.strictEqual(eff.getDate(), 16);
});
t("islamicEffectiveDate rolls to the next Gregorian date after Dhaka sunset", () => {
  const after = new Date(Date.UTC(2026, 5, 16, 15, 0, 0)); // 21:00 Dhaka
  const eff = F.islamicEffectiveDate(after);
  assert.strictEqual(eff.getFullYear(), 2026); assert.strictEqual(eff.getMonth(), 5); assert.strictEqual(eff.getDate(), 17);
});
t("gregorianToHijri(islamicEffectiveDate(now)) — the app's own 'today' pattern — advances across Dhaka sunset", () => {
  const before = F.gregorianToHijri(F.islamicEffectiveDate(new Date(Date.UTC(2026, 5, 16, 10, 0, 0))));
  const after = F.gregorianToHijri(F.islamicEffectiveDate(new Date(Date.UTC(2026, 5, 16, 15, 0, 0))));
  assert.notStrictEqual(before.day + "-" + before.month + "-" + before.year, after.day + "-" + after.month + "-" + after.year);
});

t("the admin form offers both English and Hijri date creation", () => {
  const f0 = appSrc.indexOf("function AdminSpecialDayForm(");
  const form = appSrc.slice(f0, appSrc.indexOf("function TaskAdminForm(", f0));
  ["ইংরেজি তারিখ", "হিজরি তারিখ", "dateType: mode", "hijri: mode ===", "hijriToGregorianYmd"].forEach((k) => assert(form.includes(k), "missing: " + k));
});
t("the admin form's Hijri mode offers a recurring-every-Hijri-year toggle", () => {
  const f0 = appSrc.indexOf("function AdminSpecialDayForm(");
  const form = appSrc.slice(f0, appSrc.indexOf("function TaskAdminForm(", f0));
  ["প্রতি হিজরি বছর", "recurrence: \"hijri\"", "hijriMonth:", "hijriDay:", "nextHijriOccurrence"].forEach((k) => assert(form.includes(k), "missing: " + k));
});
t("saving a recurring entry never includes a fixed `date`", () => {
  const f0 = appSrc.indexOf("function AdminSpecialDayForm(");
  const form = appSrc.slice(f0, appSrc.indexOf("function TaskAdminForm(", f0));
  const saveBlock = form.slice(form.indexOf('mode === "hijri" && recurring'), form.indexOf('const finalDate ='));
  assert(saveBlock.includes("date: null"), "recurring save must not persist a fixed date as identity");
});

t("resolveSpecialDayDate: a fixed entry returns its own date", () => {
  const f0 = appSrc.indexOf("function resolveSpecialDayDate(");
  const f1 = appSrc.indexOf("function resolveSpecialDayInMonth(");
  assert(f0 !== -1 && f1 !== -1, "resolve helpers not found in app.js");
  const src2 = appSrc.slice(f0, f1);
  const ctx2 = { window: win };
  vm.createContext(ctx2);
  vm.runInContext(src2 + "\nthis.F2={resolveSpecialDayDate};", ctx2);
  assert.strictEqual(ctx2.F2.resolveSpecialDayDate({ date: "2026-03-01", recurrence: null }), "2026-03-01");
});
t("resolveSpecialDayDate: a recurring entry computes next occurrence live from hijriMonth/hijriDay only", () => {
  const f0 = appSrc.indexOf("function resolveSpecialDayDate(");
  const f2end = appSrc.indexOf("function AdminPanel(");
  const src2 = appSrc.slice(f0, f2end);
  const ctx2 = { window: win, todayStr: () => "2025-12-01" };
  vm.createContext(ctx2);
  vm.runInContext(src2 + "\nthis.F2={resolveSpecialDayDate, resolveSpecialDayInMonth};", ctx2);
  const got = ctx2.F2.resolveSpecialDayDate({ recurrence: "hijri", hijriMonth: 7, hijriDay: 14 }, "2025-12-01");
  const expect = win.HijriUQ.nextHijriOccurrence(7, 14, "2025-12-01");
  assert.strictEqual(got, expect);
  assert(got >= "2025-12-01");
});
t("resolveSpecialDayInMonth: only returns a date when the recurring day actually falls in that Gregorian month", () => {
  const f0 = appSrc.indexOf("function resolveSpecialDayDate(");
  const f2end = appSrc.indexOf("function AdminPanel(");
  const src2 = appSrc.slice(f0, f2end);
  const ctx2 = { window: win };
  vm.createContext(ctx2);
  vm.runInContext(src2 + "\nthis.F2={resolveSpecialDayInMonth};", ctx2);
  const rajab14 = win.HijriUQ.hijriToGregorianYmd(1447, 7, 14);
  const [ry, rm] = rajab14.split("-").map(Number);
  assert.strictEqual(ctx2.F2.resolveSpecialDayInMonth({ recurrence: "hijri", hijriMonth: 7, hijriDay: 14 }, ry, rm), rajab14);
  const farMonth = rm + 4 > 12 ? rm + 4 - 12 : rm + 4;
  const farYear = rm + 4 > 12 ? ry + 1 : ry;
  assert.strictEqual(ctx2.F2.resolveSpecialDayInMonth({ recurrence: "hijri", hijriMonth: 7, hijriDay: 14 }, farYear, farMonth), null);
});

console.log(`\n${passed} passed${process.exitCode ? " — WITH FAILURES" : ""}`);
