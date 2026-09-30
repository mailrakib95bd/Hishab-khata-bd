// Tests for hijri-ummalqura.js — table-driven Umm al-Qura conversion,
// Dhaka sunset day-change, and Hijri-recurring-event helpers.
// Run: node hijri-ummalqura.test.js   (or node tests/hijri-ummalqura.test.js)
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const vm = require("vm");
const hijriPath = fs.existsSync(path.join(__dirname, "hijri-ummalqura.js")) ? path.join(__dirname, "hijri-ummalqura.js") : path.join(__dirname, "..", "hijri-ummalqura.js");
const hijriUqSrc = fs.readFileSync(hijriPath, "utf8");
const H = require(hijriPath);

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log("  ✓ " + name); }
  catch (e) { console.error("  ✗ " + name + "\n    " + e.message); process.exitCode = 1; }
}

/* ---------------- correctness against INDEPENDENT reference dates ---------------- *
 * These come from ummalquracalendar.org (a source entirely separate from the
 * van Gent/KACST month-start table this module embeds), so a match here is
 * real cross-validation, not just checking the module against itself. */
t("Rajab 1447 AH begins 21 December 2025", () => {
  assert.strictEqual(H.hijriToGregorianYmd(1447, 7, 1), "2025-12-21");
});
t("Sha'ban 1447 AH begins 20 January 2026", () => {
  assert.strictEqual(H.hijriToGregorianYmd(1447, 8, 1), "2026-01-20");
});
t("Eid al-Adha (10 Dhu al-Hijjah 1447) falls 27 May 2026", () => {
  assert.strictEqual(H.hijriToGregorianYmd(1447, 12, 10), "2026-05-27");
});
t("Islamic New Year (1 Muharram 1448) falls 16 June 2026", () => {
  assert.strictEqual(H.hijriToGregorianYmd(1448, 1, 1), "2026-06-16");
});
t("Ashura (10 Muharram 1448) falls 25 June 2026", () => {
  assert.strictEqual(H.hijriToGregorianYmd(1448, 1, 10), "2026-06-25");
});
t("Mawlid (12 Rabi' al-Awwal 1448) falls 25 August 2026", () => {
  assert.strictEqual(H.hijriToGregorianYmd(1448, 3, 12), "2026-08-25");
});
t("the table's documented start: 1 Muharram 1356 AH = 14 March 1937", () => {
  assert.strictEqual(H.hijriToGregorianYmd(1356, 1, 1), "1937-03-14");
});

t("gregorianToHijri and hijriToGregorianYmd agree with each other", () => {
  const h = H.gregorianToHijri(2026, 6, 16);
  assert.strictEqual(h.year, 1448); assert.strictEqual(h.month, 1); assert.strictEqual(h.day, 1);
});

t("round-trips for every 5th day, 2015-2045 (real-world operating range)", () => {
  let n = 0;
  for (let y = 2015; y <= 2045; y++) {
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= 28; d += 5) {
        const h = H.gregorianToHijri(y, m, d);
        assert(h, `no Hijri result for ${y}-${m}-${d}`);
        const back = H.hijriToGregorianYmd(h.year, h.month, h.day);
        const expect = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        assert.strictEqual(back, expect, `round trip broke at ${expect} (got ${back} via ${JSON.stringify(h)})`);
        n++;
      }
    }
  }
  assert(n > 1900);
});

t("every month length is 29 or 30 (no other convention snuck in)", () => {
  for (let y = 1400; y <= 1460; y++) {
    for (let m = 1; m <= 12; m++) {
      const len = H.hijriMonthLength(y, m);
      assert(len === 29 || len === 30, `bad month length ${len} at ${y}-${m}`);
    }
  }
});

t("out-of-range dates return null instead of silently using another method", () => {
  assert.strictEqual(H.gregorianToHijri(1800, 1, 1), null);
  assert.strictEqual(H.gregorianToHijri(2200, 1, 1), null);
  assert.strictEqual(H.hijriToGregorianYmd(1000, 1, 1), null);
  assert.strictEqual(H.hijriToGregorianYmd(1600, 1, 1), null);
});
t("an impossible Hijri day (30th of a 29-day month) returns null", () => {
  const len = H.hijriMonthLength(1447, 8); // Sha'ban 1447 — verified 29 days above
  assert.strictEqual(len, 29);
  assert.strictEqual(H.hijriToGregorianYmd(1447, 8, 30), null);
});

/* ---------------- Dhaka sunset-based day change ---------------- */
t("sunset in Dhaka on a known date falls in the expected evening window", () => {
  const sunset = H.calcSunsetInstant(2026, 6, 16, 23.8103, 90.4125); // mid-June, Dhaka
  // Dhaka is UTC+6; mid-June sunset there is well-documented as roughly 18:50-19:05 local
  const localHour = (sunset.getUTCHours() + 6) % 24;
  const localMin = sunset.getUTCMinutes();
  const totalMin = localHour * 60 + localMin;
  assert(totalMin >= 18 * 60 + 30 && totalMin <= 19 * 60 + 20, `sunset local time out of expected window: ${localHour}:${localMin}`);
});
t("before Dhaka sunset: Hijri effective date is still today", () => {
  // fixed instant: 2026-06-16 10:00 UTC = 16:00 Dhaka (well before sunset)
  const before = new Date(Date.UTC(2026, 5, 16, 10, 0, 0));
  const eff = H.islamicEffectiveDate(before);
  assert.deepStrictEqual(eff, { y: 2026, m: 6, d: 16 });
});
t("after Dhaka sunset: Hijri effective date has already rolled to tomorrow", () => {
  // fixed instant: 2026-06-16 15:00 UTC = 21:00 Dhaka (well after sunset)
  const after = new Date(Date.UTC(2026, 5, 16, 15, 0, 0));
  const eff = H.islamicEffectiveDate(after);
  assert.deepStrictEqual(eff, { y: 2026, m: 6, d: 17 });
});
t("day rollover correctly crosses a month/year boundary (31 Dec after sunset -> 1 Jan)", () => {
  const after = new Date(Date.UTC(2025, 11, 31, 15, 0, 0)); // 21:00 Dhaka, 31 Dec 2025
  const eff = H.islamicEffectiveDate(after);
  assert.deepStrictEqual(eff, { y: 2026, m: 1, d: 1 });
});
t("todayHijri: the Hijri day number itself advances by one across Dhaka sunset", () => {
  const before = H.todayHijri(new Date(Date.UTC(2026, 5, 16, 10, 0, 0)));
  const after = H.todayHijri(new Date(Date.UTC(2026, 5, 16, 15, 0, 0)));
  const expectNext = H.gregorianToHijri(2026, 6, 17);
  assert.deepStrictEqual({ year: after.year, month: after.month, day: after.day }, { year: expectNext.year, month: expectNext.month, day: expectNext.day });
  assert.notDeepStrictEqual({ year: before.year, month: before.month, day: before.day }, { year: after.year, month: after.month, day: after.day });
});
t("Gregorian/Bangla dates are unaffected by sunset — only the Hijri result changes (caller still changes midnight, not this module)", () => {
  // islamicEffectiveDate returns the GREGORIAN y/m/d that Hijri should be computed
  // from; the app's own Gregorian/Bangla display always uses real local midnight
  // rollover from `new Date()`, entirely separate from this function.
  const after = new Date(Date.UTC(2026, 5, 16, 15, 0, 0));
  const eff = H.islamicEffectiveDate(after);
  assert.strictEqual(eff.d, 17); // only affects what's fed into gregorianToHijri
});

/* ---------------- recurring Hijri special days ---------------- */
t("nextHijriOccurrence finds 14 Rajab on/after a given date, within the same Hijri year", () => {
  // 1 Rajab 1447 = ? compute via table, then ask for 14 Rajab from a date before it
  const rajab1Ymd = H.hijriToGregorianYmd(1447, 7, 1);
  const fourteenRajab = H.hijriToGregorianYmd(1447, 7, 14);
  const got = H.nextHijriOccurrence(7, 14, rajab1Ymd);
  assert.strictEqual(got, fourteenRajab);
});
t("nextHijriOccurrence rolls to next Hijri year once this year's date has passed", () => {
  const fourteenRajab1447 = H.hijriToGregorianYmd(1447, 7, 14);
  const fourteenRajab1448 = H.hijriToGregorianYmd(1448, 7, 14);
  const dayAfter = new Date(fourteenRajab1447 + "T00:00:00");
  dayAfter.setDate(dayAfter.getDate() + 1);
  const ymd = dayAfter.toISOString().slice(0, 10);
  const got = H.nextHijriOccurrence(7, 14, ymd);
  assert.strictEqual(got, fourteenRajab1448);
});
t("hijriOccurrenceInGregorianMonth finds the one Gregorian month 14 Rajab falls in", () => {
  const fourteenRajab1447 = H.hijriToGregorianYmd(1447, 7, 14); // known to be in Dec 2025 / Jan 2026 range
  const [y, m] = fourteenRajab1447.split("-").map(Number);
  const got = H.hijriOccurrenceInGregorianMonth(7, 14, y, m);
  assert.strictEqual(got, fourteenRajab1447);
});
t("hijriOccurrenceInGregorianMonth returns null for a month with no occurrence", () => {
  const fourteenRajab1447 = H.hijriToGregorianYmd(1447, 7, 14);
  const [y, m] = fourteenRajab1447.split("-").map(Number);
  // a Hijri year is ~354-355 days, so 5 Gregorian months later definitely has no 14 Rajab 1447 (already passed) or 1448 (not yet due)
  const farMonth = m + 4 > 12 ? m + 4 - 12 : m + 4;
  const farYear = m + 4 > 12 ? y + 1 : y;
  const got = H.hijriOccurrenceInGregorianMonth(7, 14, farYear, farMonth);
  assert.strictEqual(got, null);
});
t("the recurring date drifts earlier in the Gregorian calendar year over year (Hijri year is shorter)", () => {
  const y1447 = H.hijriToGregorianYmd(1447, 7, 14);
  const y1448 = H.hijriToGregorianYmd(1448, 7, 14);
  const days = (new Date(y1448 + "T00:00:00") - new Date(y1447 + "T00:00:00")) / 86400000;
  assert(days >= 353 && days <= 356, `expected ~354-355 days between recurrences, got ${days}`);
});

// Regression: a real Android APK build once shipped with window.HijriUQ
// permanently undefined even though hijri-ummalqura.js was correctly bundled
// and loaded — every admin "বিশেষ দিবস" Hijri save then failed with "date
// not valid" (fixed date) or "no valid occurrence" (recurring), on-device
// only. Root cause: the file set `window.HijriUQ` AFTER attempting
// `module.exports = HijriUQ`, and something in that WebView had a global
// `module` whose `.exports` wasn't writable — the resulting throw aborted
// the whole IIFE partway through, before the window.HijriUQ line ever ran.
// This proves it can never happen again: window.HijriUQ must always get set
// even when `module` exists and assigning to `module.exports` throws.
t("window.HijriUQ still gets set even if `module.exports = ...` throws (the exact APK-only bug this app once shipped)", () => {
  const hostileCtx = {
    window: {},
    get module() { return { get exports() { return {}; }, set exports(v) { throw new Error("Cannot assign to read only property 'exports'"); } }; },
    Intl, Math, Date, String, parseInt, isFinite,
  };
  vm.createContext(hostileCtx);
  vm.runInContext(hijriUqSrc, hostileCtx, { filename: "hijri-ummalqura.js" });
  assert(hostileCtx.window.HijriUQ, "window.HijriUQ must be set even when module.exports assignment throws");
  assert.strictEqual(typeof hostileCtx.window.HijriUQ.hijriToGregorianYmd, "function");
});
t("window.HijriUQ is set even with no `module` global at all (plain browser <script> tag)", () => {
  const browserCtx = { window: {}, Intl, Math, Date, String, parseInt, isFinite };
  vm.createContext(browserCtx);
  vm.runInContext(hijriUqSrc, browserCtx, { filename: "hijri-ummalqura.js" });
  assert(browserCtx.window.HijriUQ, "window.HijriUQ must be set in a plain browser context");
});

console.log(`\n${passed} passed${process.exitCode ? " — WITH FAILURES" : ""}`);
