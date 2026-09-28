// Tests for khasra-khata.js core logic (no browser needed).
// Run: node khasra-khata.test.js   (or node tests/khasra-khata.test.js)
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const K = require(fs.existsSync(path.join(__dirname, "khasra-khata.js")) ? "./khasra-khata.js" : "../khasra-khata.js");

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log("  ✓ " + name); }
  catch (e) { console.error("  ✗ " + name + "\n    " + e.message); process.exitCode = 1; }
}
const row = (desc, qty, unit, rate, discount) => ({ desc, qty, unit: unit || "kg", rate, discount: discount == null ? "" : discount });

t("spec examples: চাল 25kg×80 = 2000, সয়াবিন তেল 5ltr×180−50 = 850", () => {
  assert.strictEqual(K.lineTotal(row("চাল", "25", "kg", "80", "0")), 2000);
  assert.strictEqual(K.lineTotal(row("তেল", "5", "ltr", "180", "50")), 850);
});
t("grand total and total discount are sums over all lines", () => {
  const rows = [row("চাল", "25", "kg", "80", "0"), row("তেল", "5", "ltr", "180", "50"), row("", "", "kg", "", "")];
  assert.deepStrictEqual(K.totals(rows), { discount: 50, grand: 2850 });
});
t("Bangla digits and commas are understood", () => {
  assert.strictEqual(K.lineTotal(row("x", "২৫", "kg", "৮০", "")), 2000);
  assert.strictEqual(K.parseNum("1,200"), 1200);
});
t("percent discount is taken from that line's gross", () => {
  const r = row("x", "10", "kg", "50", "10%");
  assert.strictEqual(K.lineDiscount(r), 50);
  assert.strictEqual(K.lineTotal(r), 450);
});
t("discount can never make a line negative; garbage counts as 0", () => {
  assert.strictEqual(K.lineTotal(row("x", "1", "kg", "10", "999")), 0);
  assert.strictEqual(K.lineTotal(row("x", "1", "kg", "10", "abc")), 10);
  assert.strictEqual(K.lineTotal(row("x", "1", "kg", "10", "500%")), 0);
});
t("decimals are handled without float noise", () => {
  assert.strictEqual(K.lineTotal(row("x", "0.1", "kg", "3", "")), 0.3);
  assert.strictEqual(K.fmtNum(1234567.5), "১২,৩৪,৫৬৭.৫");
  assert.strictEqual(K.fmtNum(0), "০");
});

// ---- Enter navigation ----
const mk = (n, filledUpTo) => Array.from({ length: n }, (_, i) => row(i < filledUpTo ? "আইটেম" + i : "", "", "kg", "", ""));
t("description Enter moves to the next row's description", () => {
  assert.deepStrictEqual(K.enterNav("desc", 0, mk(10, 1)), { type: "focus", col: "desc", index: 1 });
});
t("Enter on the last row WITH text adds a new row (row 10 → row 11)", () => {
  assert.deepStrictEqual(K.enterNav("desc", 9, mk(10, 10)), { type: "add", col: "desc", index: 10 });
});
t("keeps growing: row 11 → 12", () => {
  assert.deepStrictEqual(K.enterNav("desc", 10, mk(11, 11)), { type: "add", col: "desc", index: 11 });
});
t("Enter on an EMPTY last description creates nothing (stop typing = stop growing)", () => {
  assert.deepStrictEqual(K.enterNav("desc", 9, mk(10, 9)), { type: "none" });
});
t("qty / rate / discount Enter go down the SAME column", () => {
  ["qty", "rate", "discount"].forEach((c) => assert.deepStrictEqual(K.enterNav(c, 0, mk(10, 3)), { type: "focus", col: c, index: 1 }));
});
t("qty / rate / discount Enter never creates rows and stops at the last existing row", () => {
  ["qty", "rate", "discount"].forEach((c) => assert.deepStrictEqual(K.enterNav(c, 9, mk(10, 10)), { type: "none" }));
});

// ---- drafts / search / storage ----
t("blank rows are dropped on save; unit alone doesn't make a row 'used'", () => {
  const d = K.buildDraft({ name: " মিলাদ ", date: "2026-09-27", rows: [row("চাল", "25", "kg", "80", ""), row("", "", "ltr", "", ""), row("", "", "kg", "", "")] });
  assert.strictEqual(d.rows.length, 1);
  assert.strictEqual(d.name, "মিলাদ");
  assert.strictEqual(d.grandTotal, 2000);
});
t("validation asks for name, date and at least one item", () => {
  assert.ok(K.validateDraft({ name: "", date: "2026-01-01", rows: [row("a")] }));
  assert.ok(K.validateDraft({ name: "x", date: "", rows: [row("a")] }));
  assert.ok(K.validateDraft({ name: "x", date: "2026-01-01", rows: [row("", "5")] }));
  assert.strictEqual(K.validateDraft({ name: "x", date: "2026-01-01", rows: [row("a")] }), "");
});
t("editing keeps id and createdAt", () => {
  const a = K.buildDraft({ name: "a", date: "2026-01-01", rows: [row("x", "1", "kg", "5", "")] });
  const b = K.buildDraft({ name: "a2", date: "2026-01-01", rows: [row("x", "2", "kg", "5", "")] }, a);
  assert.strictEqual(b.id, a.id); assert.strictEqual(b.createdAt, a.createdAt); assert.strictEqual(b.grandTotal, 10);
});
t("date display matches the spec card format", () => {
  assert.strictEqual(K.dateBn("2026-09-27"), "২৭ সেপ্টেম্বর, ২০২৬");
  assert.strictEqual(K.dateBn("2026-08-15"), "১৫ আগস্ট, ২০২৬");
});
t("search by name, raw date, Bangla date text and Bangla digits; newest first", () => {
  const list = [
    K.buildDraft({ name: "বার্ষিক মিলাদ ও দোয়া মাহফিল", date: "2026-09-27", rows: [row("a", "1", "kg", "1", "")] }),
    K.buildDraft({ name: "সাপ্তাহিক অফিস সদাই", date: "2026-08-15", rows: [row("a", "1", "kg", "1", "")] }),
  ];
  assert.strictEqual(K.searchDrafts(list, "").map((x) => x.date).join(), "2026-09-27,2026-08-15");
  assert.strictEqual(K.searchDrafts(list, "মিলাদ").length, 1);
  assert.strictEqual(K.searchDrafts(list, "2026-08").length, 1);
  assert.strictEqual(K.searchDrafts(list, "আগস্ট").length, 1);
  assert.strictEqual(K.searchDrafts(list, "১৫ আগস্ট").length, 1);
  assert.strictEqual(K.searchDrafts(list, "নেই").length, 0);
});
t("storage is per identity and survives corrupt data", () => {
  const mem = {}; const st = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
  assert.deepStrictEqual(K.loadDrafts(st, "u1"), []);
  K.saveDrafts(st, "u1", [{ id: 1 }]);
  assert.strictEqual(K.loadDrafts(st, "u1").length, 1);
  assert.strictEqual(K.loadDrafts(st, "u2").length, 0);
  mem[K.storageKey("bad")] = "{oops";
  assert.deepStrictEqual(K.loadDrafts(st, "bad"), []);
});
t("print HTML contains the data and escapes user text", () => {
  const d = K.buildDraft({ name: "<b>X</b>", date: "2026-09-27", rows: [row("চাল", "25", "kg", "80", "")] });
  const html = K.printHtml(d);
  assert.ok(html.includes("&lt;b&gt;X&lt;/b&gt;") && !html.includes("<b>X</b>"));
  assert.ok(html.includes("২,০০০") && html.includes("সর্বমোট টাকা"));
});
t("PDF writer produces a structurally valid file (xref offsets match)", () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = K.buildPdf([{ jpeg, w: 10, h: 10 }, { jpeg, w: 10, h: 10 }]);
  const s = Buffer.from(pdf).toString("latin1");
  assert.ok(s.startsWith("%PDF-1.4") && s.trimEnd().endsWith("%%EOF"));
  const xrefPos = parseInt(/startxref\n(\d+)/.exec(s)[1], 10);
  assert.strictEqual(s.slice(xrefPos, xrefPos + 4), "xref");
  const entries = s.slice(xrefPos).split("\n").filter((l) => /^\d{10} 00000 n $/.test(l));
  assert.strictEqual(entries.length, 3 + 3 * 2 - 1);
  entries.forEach((e, i) => assert.ok(s.slice(parseInt(e, 10)).startsWith(i + 1 + " 0 obj"), "bad offset for obj " + (i + 1)));
});

console.log("\n" + passed + " passed" + (process.exitCode ? " — WITH FAILURES" : ""));
