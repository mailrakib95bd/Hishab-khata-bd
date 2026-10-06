// Render + interaction smoke test for khasra-khata.js (খসড়া খাতা).
// Same tiny React-compatible renderer as ui-smoke.test.js — no browser, no npm
// packages. Drives the REAL UI code: typing, Enter-key navigation, dynamic
// rows, totals, save, history search, detail screen, back-stepping.
// Run: node khasra-ui.test.js   (or node tests/khasra-ui.test.js)
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

/* ---------------- mini React ---------------- */
const Fragment = Symbol("Fragment");
let root = null, dirty = false, tree = null;
const store = new Map();
let cur = null;
function h(type, props, ...kids) { props = props || {}; const children = kids.length === 1 ? kids[0] : kids; return { type, props: Object.assign({}, props, kids.length ? { children } : {}) }; }
function slot() { const s = cur.slots; const i = cur.i++; return { s, i }; }
const React = {
  createElement: h, Fragment,
  useState(init) { const { s, i } = slot(); if (!(i in s)) s[i] = typeof init === "function" ? init() : init; const fiber = cur;
    return [s[i], (v) => { const nv = typeof v === "function" ? v(s[i]) : v; if (nv !== s[i]) { s[i] = nv; schedule(); } }]; },
  useRef(init) { const { s, i } = slot(); if (!(i in s)) s[i] = { current: init }; return s[i]; },
  useMemo(fn, deps) { const { s, i } = slot(); if (!s[i] || !same(s[i].deps, deps)) s[i] = { v: fn(), deps }; return s[i].v; },
  useCallback(fn, deps) { const { s, i } = slot(); if (!s[i] || !same(s[i].deps, deps)) s[i] = { v: fn, deps }; return s[i].v; },
  useEffect(fn, deps) { const { s, i } = slot(); if (!s[i] || !deps || !same(s[i].deps, deps)) { s[i] = { deps }; pending.push(fn); } },
};
const pending = [];
function same(a, b) { return a && b && a.length === b.length && a.every((x, k) => Object.is(x, b[k])); }
function schedule() { if (!dirty) { dirty = true; Promise.resolve().then(() => { dirty = false; render(); }); } }
function expand(el, p) {
  if (el == null || el === false || el === true) return null;
  if (typeof el === "string" || typeof el === "number") return String(el);
  if (Array.isArray(el)) return { host: "list", kids: el.map((k, n) => expand(k, p + "." + n)) };
  if (typeof el.type === "function") {
    const pk = p + "#" + (el.type.name || "anon"); let f = store.get(pk); if (!f) store.set(pk, (f = { slots: [] }));
    const prev = cur; cur = f; f.i = 0;
    let out; try { out = el.type(el.props); } finally { cur = prev; }
    return { comp: el.type.name, kids: [expand(out, p + "/c")] };
  }
  const ch = el.props.children;
  return { host: el.type === Fragment ? "frag" : el.type, props: el.props, kids: [].concat(ch == null ? [] : ch).map((k, n) => expand(k, p + "/" + n)) };
}
function render() { store.forEach((f) => (f.seen = false)); tree = expand(root, "r"); bindRefs(tree); while (pending.length) { const fn = pending.shift(); try { const r = fn(); if (r && r.then) r.catch((e) => { throw e; }); } catch (e) { throw e; } } }
const text = (n) => (n == null ? "" : typeof n === "string" ? n : (n.kids || []).map(text).join(" "));
function find(n, pred, out = []) { if (!n || typeof n === "string") return out; if (pred(n)) out.push(n); (n.kids || []).forEach((k) => find(k, pred, out)); return out; }
const buttons = (label) => find(tree, (n) => n.host === "button" && text(n).includes(label));
async function tick(n = 6) { for (let i = 0; i < n; i++) { await new Promise((r) => setTimeout(r, 0)); if (dirty) await Promise.resolve(); } render(); }
async function setv(ph, v) { const el = find(tree, (x) => x.host === "input" && x.props.placeholder === ph)[0]; assert(el, "input " + ph); el.props.onChange({ target: { value: v } }); await tick(); }
async function clickTab(label) { const b = find(tree, (n) => n.host === "button" && n.props.role === "tab" && text(n).includes(label))[0]; assert(b, "tab not found: " + label); b.props.onClick(); await tick(); }
async function click(label, idx = 0) { const b = buttons(label)[idx]; assert(b, `button not found: ${label}\n${text(tree).slice(0, 600)}`); b.props.onClick({ stopPropagation() {}, preventDefault() {} }); await tick(); }
async function back() { const bs = buttons("‹"); const b = bs[bs.length - 1]; assert(b, "no back button"); b.props.onClick(); await tick(); }
function has(s) { assert(text(tree).includes(s), `missing "${s}" in:\n${text(tree).slice(0, 900)}`); }
function hasNot(s) { assert(!text(tree).includes(s), `unexpected "${s}"`); }


/* ---------------- fake DOM refs: record what gets focus() ---------------- */
const focusLog = [];
const COLS4 = ["desc", "qty", "rate", "discount"];
function refInputs() { return find(tree, (n) => n.host === "input" && typeof n.props.ref === "function"); }
function bindRefs(t) { refInputs().forEach((n, k) => { const key = COLS4[k % 4] + "-" + Math.floor(k / 4); n.props.ref({ focus() { focusLog.push(key); } }); }); }
const cell = (col, row) => refInputs()[row * 4 + COLS4.indexOf(col)];
async function type(col, row, v) { cell(col, row).props.onChange({ target: { value: v } }); await tick(); }
async function enter(col, row) { focusLog.length = 0; cell(col, row).props.onKeyDown({ key: "Enter", preventDefault() {}, nativeEvent: {} }); await tick(); }
const lastFocus = () => focusLog[focusLog.length - 1];

/* ---------------- environment ---------------- */
const ls = {};
const win = { location: { origin: "https://example.test" }, history: { pushState() {}, back() {} }, addEventListener() {}, removeEventListener() {}, localStorage: null };
const ctxObj = { React, window: win, console, setTimeout, clearTimeout, Promise, Math, Date, Object, Array, JSON, Number, String, Set, Map, isNaN, parseFloat, parseInt, isFinite, Symbol, Error, Intl,
  Uint8Array, Buffer, btoa: (s) => Buffer.from(s, "binary").toString("base64") };
win.localStorage = { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => (ls[k] = String(v)), removeItem: (k) => delete ls[k] };
ctxObj.window.React = React;
vm.createContext(ctxObj);
const kkPath = fs.existsSync(path.join(__dirname, "khasra-khata.js")) ? path.join(__dirname, "khasra-khata.js") : path.join(__dirname, "..", "khasra-khata.js");
vm.runInContext(fs.readFileSync(kkPath, "utf8"), ctxObj, { filename: "khasra-khata.js" });
const Module = win.KhasraKhata && win.KhasraKhata.Module;
assert(Module, "window.KhasraKhata.Module must be exported");

(async () => {
  let n = 0; const ok = (m) => { n++; console.log("  ✓ " + m); };
  let backFn = null, closed = 0;
  root = h(Module, { onClose() { closed++; }, storageId: "tester", registerBack: (fn) => { backFn = fn; } });
  render(); await tick(10);

  has("বাজার সদাইয়ের হিসাব"); has("📜"); has("সংগঠন/অনুষ্ঠানের নাম"); has("তারিখ"); has("সর্বমোট ছাড়"); has("সর্বমোট টাকা"); has("💾 খসড়া সংরক্ষণ করুন");
  ["নং", "পণ্যের বিবরণ", "পরিমাণ", "একক", "দর (৳)", "ছাড় (৳/%)", "মোট (৳)"].forEach(has);
  ok("screen 1: header, 📜 icon, form, table columns, sticky totals, save button");
  assert.strictEqual(refInputs().length, 40, "starts with 10 rows"); ok("starts with 10 rows");
  const opts = find(tree, (x) => x.host === "option").map((o) => text(o));
  ["kg", "gm", "pcs", "ltr", "dozen"].forEach((u) => assert(opts.includes(u), "unit " + u)); ok("unit dropdown has kg/gm/pcs/ltr/dozen");

  // Enter on description → next row's description
  await type("desc", 0, "আলু"); await enter("desc", 0); assert.strictEqual(lastFocus(), "desc-1"); ok("বিবরণ Enter → next row's বিবরণ");

  // fill 1..10 then Enter on row 10 (index 9) creates row 11 and focuses it
  for (let i = 0; i < 10; i++) await type("desc", i, "পণ্য" + (i + 1));
  await enter("desc", 9);
  assert.strictEqual(refInputs().length, 44, "row 11 created"); assert.strictEqual(lastFocus(), "desc-10"); ok("Enter on row 10's বিবরণ creates row 11 and moves there");
  await type("desc", 10, "পণ্য১১"); await enter("desc", 10);
  assert.strictEqual(refInputs().length, 48); assert.strictEqual(lastFocus(), "desc-11"); ok("…and again: row 11 → 12 (unlimited)");

  // stop typing → stop growing
  await enter("desc", 11);
  assert.strictEqual(refInputs().length, 48); ok("Enter on an empty last বিবরণ creates no row");

  // qty / rate / discount: same column, next row, bounded by existing rows
  for (const c of ["qty", "rate", "discount"]) { await enter(c, 0); assert.strictEqual(lastFocus(), c + "-1"); }
  ok("পরিমাণ/দর/ছাড় Enter → same column, next row");
  for (const c of ["qty", "rate", "discount"]) { await enter(c, 11); assert.strictEqual(focusLog.length, 0, c + " must not move past the last row"); }
  assert.strictEqual(refInputs().length, 48); ok("…stops at the last existing row, never creates rows");

  // totals (spec example): চাল 25×80, তেল 5×180−50 → total 2,850, discount 50
  await type("qty", 0, "25"); await type("rate", 0, "80"); await type("qty", 1, "5"); await type("rate", 1, "180"); await type("discount", 1, "50");
  has("২,৮৫০৳"); has("৫০৳"); has("২,০০০"); has("৮৫০"); ok("live line totals + sticky footer totals (2000, 850 → 2,850; ছাড় 50)");
  await type("discount", 0, "10%"); has("২,৬৫০৳"); ok("percent discount (10% of 2000 = 200) works");
  await type("discount", 0, "");

  // save validation, then save
  await click("💾"); has("সংগঠন/অনুষ্ঠানের নাম লিখুন"); ok("save without a name is refused with a message");
  await setv("যেমন: বার্ষিক মিলাদ ও দোয়া মাহফিল", "বার্ষিক মিলাদ ও দোয়া মাহফিল");
  await click("💾"); has("খসড়া সংরক্ষিত হয়েছে");
  const stored = JSON.parse(ls["hisabkhata-khasra-v1:tester"]);
  assert.strictEqual(stored.length, 1); assert.strictEqual(stored[0].name, "বার্ষিক মিলাদ ও দোয়া মাহফিল");
  assert.strictEqual(stored[0].grandTotal, 2850); assert.strictEqual(stored[0].totalDiscount, 50); assert.strictEqual(stored[0].rows.length, 11);
  assert.strictEqual(refInputs().length, 40); ok("saved to storage (11 used rows, totals right), form reset to a fresh 10-row list");

  // history
  await click("📜"); has("ইতিহাস ও সামারি"); has("প্রসঙ্গ:"); has("বার্ষিক মিলাদ ও দোয়া মাহফিল"); has("মোট খরচ:"); has("২,৮৫০ টাকা"); has("বিস্তারিত দেখুন");
  ok("screen 2: history card (তারিখ, প্রসঙ্গ, মোট খরচ, বিস্তারিত দেখুন)");
  await setv("🔍 তারিখ বা অনুষ্ঠানের নাম দিয়ে খুঁজুন", "মিলাদ"); has("বার্ষিক মিলাদ");
  await setv("🔍 তারিখ বা অনুষ্ঠানের নাম দিয়ে খুঁজুন", "কিছুই-নেই"); has("কিছু পাওয়া যায়নি"); ok("search filters the list");
  await setv("🔍 তারিখ বা অনুষ্ঠানের নাম দিয়ে খুঁজুন", "");

  // detail
  await click("বিস্তারিত দেখুন"); has("🖨️ প্রিন্ট করুন"); has("📥 পিডিএফ ডাউনলোড"); has("পণ্য১১"); has("সর্বমোট টাকা"); has("২,৮৫০");
  ok("screen 3: detail table + প্রিন্ট + পিডিএফ buttons");

  // back stepping
  assert.strictEqual(backFn(), true); await tick(); has("ইতিহাস ও সামারি");
  assert.strictEqual(backFn(), true); await tick(); has("💾 খসড়া সংরক্ষণ করুন");
  assert.strictEqual(backFn(), false); ok("phone back: detail → history → input → (closes panel)");

  // edit from detail
  await click("📜"); await click("বিস্তারিত দেখুন"); await click("✎ সম্পাদনা");
  has("সংরক্ষিত তালিকা সম্পাদনা করা হচ্ছে");
  assert.strictEqual(cell("desc", 0).props.value, "পণ্য1"); ok("edit loads the saved list back into the form");
  await type("qty", 0, "30"); await click("💾"); has("খসড়া সংরক্ষিত হয়েছে");
  const s2 = JSON.parse(ls["hisabkhata-khasra-v1:tester"]); assert.strictEqual(s2.length, 1); assert.strictEqual(s2[0].rows[0].qty, "30"); ok("editing updates in place (no duplicate)");

  // delete with confirmation
  await click("📜"); await click("বিস্তারিত দেখুন"); await click("🗑️ মুছুন"); has("নিশ্চিত? মুছে ফেলুন"); await click("নিশ্চিত? মুছে ফেলুন");
  assert.strictEqual(JSON.parse(ls["hisabkhata-khasra-v1:tester"]).length, 0); has("এখনও কোনো খসড়া সংরক্ষণ করা হয়নি"); ok("delete needs a second tap, then removes it");

  // Android APK path: "প্রিন্ট" → PDF goes to cache + system share sheet;
  // "ডাউনলোড" → PDF is saved straight to Documents, no share sheet, and
  // falls back to the share flow if that direct write ever fails.
  const calls = [];
  win.Capacitor = { isNativePlatform: () => true, Plugins: {
    Filesystem: { writeFile: async (o) => { calls.push(["write", o]); return { uri: "file:///cache/" + o.path }; } },
    Share: { share: async (o) => { calls.push(["share", o]); } } } };
  assert.strictEqual(win.KhasraKhata._isNative(), true);
  await win.KhasraKhata._saveNative(Uint8Array.from([37, 80, 68, 70]), "x.pdf"); // default = share
  assert.strictEqual(calls[0][1].directory, "CACHE"); assert.strictEqual(calls[0][1].data, Buffer.from("%PDF").toString("base64"));
  assert.strictEqual(calls[1][1].url, "file:///cache/x.pdf"); ok("native APK প্রিন্ট: PDF written to cache, then system share sheet opened");

  calls.length = 0;
  const r = await win.KhasraKhata._saveNative(Uint8Array.from([37, 80, 68, 70]), "y.pdf", { share: false });
  assert.strictEqual(calls.length, 1); assert.strictEqual(calls[0][0], "write"); assert.strictEqual(calls[0][1].directory, "DOCUMENTS");
  assert.strictEqual(r.shared, false); ok("native APK ডাউনলোড: PDF saved straight to Documents, no share sheet opened");

  calls.length = 0;
  win.Capacitor.Plugins.Filesystem.writeFile = async (o) => {
    if (o.directory === "DOCUMENTS") throw new Error("scoped storage denied");
    calls.push(["write", o]); return { uri: "file:///cache/" + o.path };
  };
  const r2 = await win.KhasraKhata._saveNative(Uint8Array.from([37, 80, 68, 70]), "z.pdf", { share: false }).catch(() => "threw");
  assert.strictEqual(r2, "threw"); ok("if a direct Documents write fails, _saveNative itself throws (downloadPdf is what falls back to share, tested at the module level in khasra-khata.test.js)");
  win.Capacitor = undefined; assert.strictEqual(win.KhasraKhata._isNative(), false); ok("in a normal browser it stays on the download path");

  console.log(`\n${n} passed`);
})().catch((e) => { console.error("\nFAIL:", e.message); process.exit(1); });
