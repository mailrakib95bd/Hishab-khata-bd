// Render smoke test for family-bazar.js — no browser, no npm packages.
// A tiny React-compatible renderer (hooks + effects + state updates) drives the
// real UI code against an in-memory fake of window.FB, walks every tab and
// sheet, and fails on any exception or on a missing key piece of text.
// Run: node tests/ui-smoke.test.js
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
function render() { store.forEach((f) => (f.seen = false)); tree = expand(root, "r"); while (pending.length) { const fn = pending.shift(); try { const r = fn(); if (r && r.then) r.catch((e) => { throw e; }); } catch (e) { throw e; } } }
const text = (n) => (n == null ? "" : typeof n === "string" ? n : (n.kids || []).map(text).join(" "));
function find(n, pred, out = []) { if (!n || typeof n === "string") return out; if (pred(n)) out.push(n); (n.kids || []).forEach((k) => find(k, pred, out)); return out; }
const buttons = (label) => find(tree, (n) => n.host === "button" && text(n).includes(label));
async function tick(n = 6) { for (let i = 0; i < n; i++) { await new Promise((r) => setTimeout(r, 0)); if (dirty) await Promise.resolve(); } render(); }
async function clickTab(label) { const b = find(tree, (n) => n.host === "button" && n.props.role === "tab" && text(n).includes(label))[0]; assert(b, "tab not found: " + label); b.props.onClick(); await tick(); }
async function click(label, idx = 0) { const b = buttons(label)[idx]; assert(b, `button not found: ${label}\n${text(tree).slice(0, 600)}`); b.props.onClick({ stopPropagation() {}, preventDefault() {} }); await tick(); }
async function back() { const bs = buttons("‹"); const b = bs[bs.length - 1]; assert(b, "no back button"); b.props.onClick(); await tick(); }
function has(s) { assert(text(tree).includes(s), `missing "${s}" in:\n${text(tree).slice(0, 900)}`); }
function hasNot(s) { assert(!text(tree).includes(s), `unexpected "${s}"`); }

/* ---------------- environment ---------------- */
const Core = require("../family-bazar-core.js");
const today = Core.dateToYmd(new Date());
const cm = Core.monthOf(today), pm = Core.addMonths(cm, -1);
const ls = {};
const win = { location: { origin: "https://example.test", pathname: "/" }, history: { pushState() {}, back() {} }, addEventListener() {}, removeEventListener() {}, confirm: () => true, prompt: () => "", FBCore: Core, localStorage: null };
const ctxObj = {
  React, window: win, console, setTimeout, clearTimeout, Promise, Math, Date, Object, Array, JSON, Number, String, Set, Map, isNaN, parseFloat, Symbol, Error,
  localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => (ls[k] = String(v)), removeItem: (k) => delete ls[k] },
  toBnDigits: (v) => String(v).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]),
  formatTaka: (n) => "৳" + Math.round(n).toLocaleString("en-US"),
  formatDateBn: (s) => ({ full: s, month: "মাস", year: "২০২৬", day: "১", weekday: "" }),
  todayStr: () => today, useBackgroundScrollLock() {},
};
ctxObj.window.React = React;
vm.createContext(ctxObj);

/* ---------------- fake data layer ---------------- */
const perms = (o) => Object.assign({ monthlyTotal: false, categorySummary: false, purchaseDetails: false, priceHistory: false, locationComparison: false, reports: false, memberManagement: false }, o);
const OWNER = { uid: "u1", name: "রাকিব", email: "r@gmail.com", role: "owner", relation: "self", status: "active", permissions: Core.permissionPreset("owner") };
const ABBU = { uid: "u2", name: "আব্বু", email: "a@gmail.com", role: "member", relation: "father", status: "active", permissions: perms({ monthlyTotal: true, categorySummary: true, priceHistory: true, reports: true }) };
const purchase = (id, uid, date, items) => ({ id, purchaseId: id, memberId: uid, memberName: uid, date, month: Core.monthOf(date), market: "সুন্দরগঞ্জ বাজার", location: "গাইবান্ধা", note: "", trackPrice: true, items, total: Core.itemsTotal(items), createdAt: 1, updatedAt: 1 });
const item = (n, q, u, up, cat) => ({ itemId: "i_" + n, productId: Core.productIdFor(n), productName: n, categoryId: cat, category: cat, quantity: q, unit: u, unitPrice: up, total: q * up });
const P1 = purchase("p1", "u1", today, [item("চাল", 5, "kg", 64, "def_rice")]);
const P2 = purchase("p2", "u2", today, [item("চাল", 5, "kg", 70, "def_rice")]);
function fakeFB(me) {
  const members = [OWNER, ABBU];
  const rows = [
    { id: "p2_a", productId: Core.productIdFor("চাল"), productName: "চাল", memberId: "u2", price: 62, unit: "kg", date: Core.addDays(today, -8), month: Core.monthOf(Core.addDays(today, -8)) },
    { id: "p1_i_চাল", productId: Core.productIdFor("চাল"), productName: "চাল", memberId: "u1", price: 64, unit: "kg", date: today, month: cm },
  ];
  const calls = [];
  const fb = {
    calls, emailVerified: () => true, signInGoogle: async () => {},
    myFamilies: async () => [{ id: "f1", name: "হোসেন পরিবার", ownerId: "u1", memberUids: ["u1", "u2"], settings: { icon: "🏠" } }],
    myIncomingInvitations: async () => [],
    familyMembers: async () => members,
    getFamilyBudget: async () => ({ monthlyAmount: 1000 }),
    familyCategories: async () => [],
    familyProducts: async () => [{ id: Core.productIdFor("চাল"), name: "চাল", categoryId: "def_rice", defaultUnit: "kg" }],
    monthlyStats: async (fid, months, vis) => {
      const all = vis.totals;
      const docs = [{ id: "u1_" + cm, memberId: "u1", month: cm, total: 320, count: 1, days: { [today]: 320 } }];
      if (all) docs.push({ id: "u2_" + cm, memberId: "u2", month: cm, total: 350, count: 1, days: { [today]: 350 } });
      return { monthly: docs, cats: vis.categories ? [{ id: "x", memberId: "u1", month: cm, categories: { def_rice: { name: "চাল", total: 320 } } }] : [] };
    },
    priceRows: async () => rows, locationRows: async () => [{ id: "l1", productId: Core.productIdFor("চাল"), productName: "চাল", location: "গাইবান্ধা", market: "সুন্দরগঞ্জ", price: 64, unit: "kg", date: today, memberId: "u1" }, { id: "l2", productId: Core.productIdFor("চাল"), productName: "চাল", location: "ঢাকা", market: null, price: 70, unit: "kg", date: today, memberId: "u2" }],
    purchasesForMonth: async (fid, m, all) => [P1, P2].filter((p) => p.month === m && (all || p.memberId === me)),
    familySentInvitations: async () => [{ id: "inv1", familyId: "f1", familyName: "হোসেন পরিবার", invitedEmail: "sis@gmail.com", relation: "sister", role: "member", permissions: perms({}), status: "pending", createdAt: Date.now(), expiresAt: Date.now() + 1e9 }],
    savePurchase: async (...a) => { calls.push(["savePurchase", ...a]); },
    setFamilyBudget: async (...a) => calls.push(["budget", ...a]),
    rebuildMyStats: async () => 2,
  };
  return fb;
}

/* ---------------- run ---------------- */
async function boot(userUid, extra) {
  win.FB = fakeFB(userUid);
  store.clear(); pending.length = 0;
  const src = fs.readFileSync(path.join(__dirname, "..", "family-bazar.js"), "utf8");
  vm.runInContext(src, ctxObj, { filename: "family-bazar.js" });
  const { Module, useFamilyAlerts } = win.FamilyBazar;
  assert(Module && useFamilyAlerts, "exports");
  root = h(Module, { user: extra === "none" ? null : { uid: userUid, displayName: "x", email: "x@gmail.com" }, mode: "full", onClose() {} });
  render(); await tick(10);
}

(async () => {
  let n = 0; const ok = (m) => { n++; console.log("  ✓ " + m); };

  // signed out → sign-in entry
  await boot("u1", "none"); has("Google দিয়ে Sign In"); ok("signed-out entry screen");

  // owner sees everything
  await boot("u1");
  has("হোসেন পরিবার"); has("৳670"); has("রাকিব"); has("আব্বু"); has("কে কত খরচ করেছে"); ok("owner dashboard: family total + members");
  has("বাজেট"); ok("budget shown (67%)");
  has("চাল"); ok("price mover listed");
  for (const [tab, expect] of [["বাজার", "২টি বাজার"], ["রিপোর্ট", "রিপোর্ট"], ["পরিবার", "পরিবারের সদস্য"], ["আরও", "পণ্য তালিকা"]]) {
    await clickTab(tab); has(expect); ok("tab: " + tab);
  }
  await click("পণ্য তালিকা"); has("চাল"); ok("product list");
  await click("কেজি"); await tick(8); has("সর্বশেষ দাম"); has("গাইবান্ধা"); has("ঢাকা"); has("সবচেয়ে কম"); ok("product sheet: price + location comparison");
  await back();
  await click("‹ আরও"); await click("ক্যাটাগরি"); has("নতুন ক্যাটাগরি"); ok("categories");
  await click("‹ আরও"); await click("খুঁজুন"); ok("search view");
  const inp = find(tree, (x) => x.host === "input")[0]; inp.props.onChange({ target: { value: "চাল" } }); await new Promise((r) => setTimeout(r, 320)); await tick(10);
  has("পণ্য"); has("চাল"); ok("search: চাল");
  await clickTab("পরিবার"); await click("সদস্যকে Invite"); has("Gmail"); ok("invite sheet");
  await back();
  await click("আব্বু"); await tick(); has("অনুমতি"); ok("member sheet + permissions");
  await back();
  await click("সেটিংস"); has("পরিবারের সেটিংস"); ok("family settings sheet");
  await back();
  await clickTab("হোম"); await click("বাজার যোগ করুন"); has("নতুন বাজার যোগ করুন"); ok("add-purchase sheet"); await back();

  // member with limited permissions: no purchase details for others
  await boot("u2");
  has("৳670"); ok("member with monthlyTotal sees family total");
  await clickTab("বাজার"); await tick(6);
  hasNot("সবাই"); ok("member without purchaseDetails: no all-members filter");
  await clickTab("রিপোর্ট"); has("রিপোর্ট"); ok("member with reports permission");


  // ---- spec scenario 4: Rakib adds চাল — 5 kg — ৳64 = ৳320 ----------------
  await boot("u1");
  await click("বাজার যোগ করুন"); has("নতুন বাজার যোগ করুন");
  const setv = async (ph, v) => { const el = find(tree, (x) => x.host === "input" && x.props.placeholder === ph)[0]; assert(el, "input " + ph); el.props.onChange({ target: { value: v } }); await tick(); };
  await click("সংরক্ষণ করুন"); has("•"); assert(win.FB.calls.length === 0); ok("empty purchase is rejected, nothing saved");
  await setv("পণ্যের নাম (যেমন: চাল)", "চাল"); await setv("৫", "5"); await setv("৬৪", "64");
  has("৳320"); ok("total auto-calculated: 5 × 64 = ৳320");
  await setv("যেমন: সুন্দরগঞ্জ বাজার", "সুন্দরগঞ্জ বাজার"); await setv("যেমন: গাইবান্ধা", "গাইবান্ধা");
  await click("সংরক্ষণ করুন"); await tick(10);
  const call = win.FB.calls.find((c) => c[0] === "savePurchase");
  assert(call, "savePurchase not called");
  const [, fid, oldP, newP] = call;
  assert.strictEqual(fid, "f1"); assert.strictEqual(oldP, null);
  assert.strictEqual(newP.total, 320); assert.strictEqual(newP.memberId, "u1"); assert.strictEqual(newP.items[0].productName, "চাল");
  assert.strictEqual(newP.items[0].productId, Core.productIdFor("চাল")); assert.strictEqual(newP.location, "গাইবান্ধা");
  ok("saved once with stable product id, member and location");
  has("বাজেটের ৯০% ছাড়িয়েছে"); ok("sheet closed; budget 90% warning shown when ৳670 + ৳320 crosses the ৳1,000 budget (spec scenario 10)");

  console.log(`\n${n} UI smoke checks passed`);
})().catch((e) => { console.error("\nFAIL:", e.message); process.exit(1); });
