// Hijri ⇄ English conversion used by the Admin "বিশেষ দিবস" form.
// Extracts the real functions from app.js so the test can't drift from the app.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
const appPath = fs.existsSync(path.join(__dirname, "app.js")) ? path.join(__dirname, "app.js") : path.join(__dirname, "..", "app.js");
const src = fs.readFileSync(appPath, "utf8");
const a = src.indexOf("function gregorianToJDN(");
const b = src.indexOf("// approximate sunset time");
assert(a !== -1 && b !== -1, "conversion block not found in app.js");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src.slice(src.indexOf("const HIJRI_MONTHS"), b) + "\nthis.F={gregorianToJDN,jdnToHijri,jdnToGregorian,hijriToGregorianYmd,ymdToHijriParts,gregorianToHijri,HIJRI_MONTHS};", ctx);
const F = ctx.F;

let passed = 0;
function t(name, fn) { try { fn(); passed++; console.log("  ✓ " + name); } catch (e) { console.error("  ✗ " + name + "\n    " + e.message); process.exitCode = 1; } }

t("English → Hijri → English round-trips for every day 1990–2060", () => {
  const d = new Date(1990, 0, 1);
  const end = new Date(2060, 11, 31);
  let n = 0;
  for (; d <= end; d.setDate(d.getDate() + 1)) {
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const h = F.ymdToHijriParts(ymd);
    assert.strictEqual(F.hijriToGregorianYmd(h.year, h.month, h.day), ymd, "mismatch at " + ymd);
    n++;
  }
  assert(n > 25000);
});
t("agrees with the app's own gregorianToHijri (what the calendar displays)", () => {
  const g = F.gregorianToHijri(new Date(2026, 8, 28));
  const h = F.ymdToHijriParts("2026-09-28");
  assert.strictEqual(g.day, h.day); assert.strictEqual(g.year, h.year); assert.strictEqual(F.HIJRI_MONTHS[h.month - 1], g.month);
});
t("a known date: 1 Muharram 1448 falls in June 2026", () => {
  const ymd = F.hijriToGregorianYmd(1448, 1, 1);
  assert(/^2026-06-(1[5-9]|2[0-1])$/.test(ymd), "got " + ymd);
});
t("impossible Hijri dates are rejected (day 30 of a 29-day month, bad month, bad year)", () => {
  let rejected = 0;
  for (let m = 1; m <= 12; m++) if (F.hijriToGregorianYmd(1448, m, 30) === null) rejected++;
  assert(rejected >= 1, "some months must have only 29 days");
  assert.strictEqual(F.hijriToGregorianYmd(1448, 13, 1), null);
  assert.strictEqual(F.hijriToGregorianYmd(1448, 1, 31), null);
  assert.strictEqual(F.hijriToGregorianYmd(0, 1, 1), null);
  assert.strictEqual(F.hijriToGregorianYmd("abc", 1, 1), null);
});
t("output is always a well-formed YYYY-MM-DD", () => {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(F.hijriToGregorianYmd(1447, 9, 1)));
});
t("the admin form offers both English and Hijri and stores dateType/hijri", () => {
  const f0 = src.indexOf("function AdminSpecialDayForm(");
  const form = src.slice(f0, src.indexOf("function TaskAdminForm(", f0));
  ["ইংরেজি তারিখ", "হিজরি তারিখ", 'dateType: mode', "hijri: mode ===", "hijriToGregorianYmd"].forEach((k) => assert(form.includes(k), "missing: " + k));
});

console.log(`\n${passed} passed${process.exitCode ? " — WITH FAILURES" : ""}`);
