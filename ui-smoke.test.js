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
async function setv(ph, v) { const el = find(tree, (x) => x.host === "input" && x.props.placeholder === ph)[0]; assert(el, "input " + ph); el.props.onChange({ target: { value: v } }); await tick(); }
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
  React, window: win, console, setTimeout, clearTimeout, setInterval, clearInterval, Promise, Math, Date, Object, Array, JSON, Number, String, Set, Map, isNaN, parseFloat, Symbol, Error,
  Notification: undefined, navigator: { serviceWorker: null },
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
const OWNER = { uid: "u1", name: "রাকিব", email: "r@gmail.com", role: "owner", relation: "self", status: "active", phone: "01711111111", permissions: Core.permissionPreset("owner") };
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
  const shoppingLists = [
    { id: "sl1", title: "আজকের বাজার", createdBy: "u1", assignedTo: "u2", items: [Core.shoppingItem({ id: "it1", name: "দুধ", quantity: 1, unit: "l", categoryId: "def_milk" }), Core.shoppingItem({ id: "it2", name: "ডিম", quantity: 12, unit: "pcs", categoryId: "def_egg" })], reminder: { enabled: true, time: "18:00", repeat: "daily" }, status: "active" },
  ];
  // real Firestore listeners re-fire on every write, including the writer's
  // own — this mock mirrors that so a save-then-reopen-the-list flow (point
  // 8) sees the updated list, not a frozen first snapshot
  const listSubs = [];
  const emitLists = () => listSubs.forEach((cb) => cb(shoppingLists.slice()));
  const memberSubs = [];
  const emitMembers = () => memberSubs.forEach((cb) => cb(members.slice()));
  const fb = {
    calls, emailVerified: () => true, signInGoogle: async () => {},
    myFamilies: async () => [{ id: "f1", name: "হোসেন পরিবার", ownerId: "u1", memberUids: ["u1", "u2"], settings: { icon: "🏠" } }],
    myIncomingInvitations: async () => [],
    familyMembers: async () => members,
    subscribeFamilyMembers: (fid, cb) => { memberSubs.push(cb); cb(members.slice()); return () => { memberSubs.splice(memberSubs.indexOf(cb), 1); }; },
    updateFamilyMember: async (fid, memberUid, patch) => {
      calls.push(["updateFamilyMember", fid, memberUid, patch]);
      const i = members.findIndex((m) => m.uid === memberUid);
      if (i !== -1) members[i] = Object.assign({}, members[i], patch);
      emitMembers();
    },
    getFamilyBudget: async () => ({ monthlyAmount: 1000 }),
    familyCategories: async () => [],
    familyProducts: async () => [{ id: Core.productIdFor("চাল"), name: "চাল", categoryId: "def_rice", defaultUnit: "kg" }],
    monthlyStats: async (fid, months, vis) => {
      const all = vis.totals;
      const docs = [{ id: "u1_" + cm, memberId: "u1", month: cm, total: 320, count: 1, days: { [Core.addDays(today, -1)]: 120, [today]: 200 } }];
      if (all) docs.push({ id: "u2_" + cm, memberId: "u2", month: cm, total: 350, count: 1, days: { [today]: 350 } });
      return { monthly: docs, cats: vis.categories ? [{ id: "x", memberId: "u1", month: cm, categories: { def_rice: { name: "চাল", total: 320 } } }] : [] };
    },
    subscribeMonthlyStats: (fid, months, vis, cb) => {
      const all = vis.totals;
      const docs = [{ id: "u1_" + cm, memberId: "u1", month: cm, total: 320, count: 1, days: { [Core.addDays(today, -1)]: 120, [today]: 200 } }];
      if (all) docs.push({ id: "u2_" + cm, memberId: "u2", month: cm, total: 350, count: 1, days: { [today]: 350 } });
      cb({ monthly: docs, cats: vis.categories ? [{ id: "x", memberId: "u1", month: cm, categories: { def_rice: { name: "চাল", total: 320 } } }] : [] });
      return () => {};
    },
    priceRows: async () => rows, locationRows: async () => [{ id: "l1", productId: Core.productIdFor("চাল"), productName: "চাল", location: "গাইবান্ধা", market: "সুন্দরগঞ্জ", price: 64, unit: "kg", date: today, memberId: "u1" }, { id: "l2", productId: Core.productIdFor("চাল"), productName: "চাল", location: "ঢাকা", market: null, price: 70, unit: "kg", date: today, memberId: "u2" }],
    purchasesForMonth: async (fid, m, all) => [P1, P2].filter((p) => p.month === m && (all || p.memberId === me)),
    familySentInvitations: async () => [{ id: "inv1", familyId: "f1", familyName: "হোসেন পরিবার", invitedEmail: "sis@gmail.com", relation: "sister", role: "member", permissions: perms({}), status: "pending", createdAt: Date.now(), expiresAt: Date.now() + 1e9 }],
    familyShoppingLists: async () => shoppingLists,
    subscribeShoppingLists: (fid, cb) => { listSubs.push(cb); cb(shoppingLists.slice()); return () => { listSubs.splice(listSubs.indexOf(cb), 1); }; },
    addShoppingItems: async (fid, listId, newItems) => { calls.push(["addShoppingItems", fid, listId, newItems]); const l = shoppingLists.find((x) => x.id === listId); if (l) l.items = l.items.concat(newItems); emitLists(); },
    setProductCategory: async (fid, pid, catId) => { calls.push(["setProductCategory", fid, pid, catId]); },
    saveShoppingList: async (fid, list) => { const id = "sl" + (shoppingLists.length + 1); shoppingLists.push(Object.assign({ id }, list)); calls.push(["saveShoppingList", fid, list]); emitLists(); return id; },
    deleteShoppingList: async (fid, id) => { calls.push(["deleteShoppingList", fid, id]); shoppingLists.splice(shoppingLists.findIndex((l) => l.id === id), 1); emitLists(); },
    toggleShoppingItem: async (fid, listId, itemId, checked) => { calls.push(["toggleShoppingItem", fid, listId, itemId, checked]); const l = shoppingLists.find((x) => x.id === listId); if (l) l.items = l.items.map((it) => (it.id === itemId ? Object.assign({}, it, { checked }) : it)); emitLists(); },
    removeShoppingItems: async (fid, listId, itemIds) => { calls.push(["removeShoppingItems", fid, listId, itemIds]); const l = shoppingLists.find((x) => x.id === listId); if (l) l.items = l.items.filter((it) => !itemIds.includes(it.id)); emitLists(); },
    markShoppingReminderFired: async (fid, listId, reminder, d) => { calls.push(["markShoppingReminderFired", fid, listId, d]); const l = shoppingLists.find((x) => x.id === listId); if (l) l.reminder = Object.assign({}, reminder, { lastFiredDate: d }); },
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
  await win.FB.updateFamilyMember("f1", "u2", { name: "আব্বু-জান" }); await tick(6);
  has("আব্বু-জান"); ok("point 1: a name change (as if from another device) shows up live, no manual reload needed");
  has("বাজেট"); ok("budget shown (67%)");
  has("চাল"); ok("price mover listed");
  has("১২০ + ২০০"); ok("point 3: per-day running-total shown next to member spending (১২০+২০০=৳320 pattern)");
  for (const [tab, expect] of [["বাজার", "২টি বাজার"], ["রিপোর্ট", "রিপোর্ট"], ["পরিবার", "পরিবারের সদস্য"], ["আরও", "পণ্য তালিকা"]]) {
    await clickTab(tab); has(expect); ok("tab: " + tab);
  }
  await click("পণ্য তালিকা"); has("চাল"); ok("product list");
  await click("কেজি"); await tick(8); has("সর্বশেষ দাম"); has("গাইবান্ধা"); has("ঢাকা"); has("সবচেয়ে কম"); ok("product sheet: price + location comparison");
  { const catSel = find(tree, (x) => x.host === "select")[0];
    assert(catSel, "product category select not found");
    catSel.props.onChange({ target: { value: "def_egg" } }); await tick();
  }
  await click("ক্যাটাগরি সংরক্ষণ"); await tick(6);
  const catCall = win.FB.calls.find((c) => c[0] === "setProductCategory");
  assert(catCall, "setProductCategory not called");
  assert.strictEqual(catCall[2], Core.productIdFor("চাল")); assert.strictEqual(catCall[3], "def_egg");
  ok("point 9: family owner can reassign a mis-categorized product's category");
  await click("‹ আরও"); await click("ক্যাটাগরি"); has("নতুন ক্যাটাগরি"); ok("categories");
  await click("‹ আরও"); await click("খুঁজুন"); ok("search view");
  const inp = find(tree, (x) => x.host === "input")[0]; inp.props.onChange({ target: { value: "চাল" } }); await new Promise((r) => setTimeout(r, 320)); await tick(10);
  has("পণ্য"); has("চাল"); ok("search: চাল");
  await clickTab("পরিবার"); await click("সদস্যকে Invite"); has("Gmail"); ok("invite sheet");
  await back();
  await click("আব্বু"); await tick(); has("অনুমতি"); ok("member sheet + permissions");
  has("প্রোফাইল তথ্য সম্পাদনা"); ok("point 5: family owner sees a section to edit another member's info");
  { const nameInp = find(tree, (x) => x.host === "input" && x.props.maxLength === 40)[0];
    const phoneInp = find(tree, (x) => x.host === "input" && x.props.type === "tel")[0];
    assert(nameInp && phoneInp, "owner-info name/phone inputs not found");
    nameInp.props.onChange({ target: { value: "আব্বু (সংশোধিত)" } });
    phoneInp.props.onChange({ target: { value: "01888888888" } });
    await tick();
  }
  await click("তথ্য সংরক্ষণ"); await tick(6);
  const infoCall = win.FB.calls.find((c) => c[0] === "updateFamilyMember" && c[2] === "u2" && "phone" in c[3]);
  assert(infoCall, "owner editing another member's name/phone did not call updateFamilyMember");
  assert.strictEqual(infoCall[3].name, "আব্বু (সংশোধিত)"); assert.strictEqual(infoCall[3].phone, "01888888888");
  ok("point 5: owner can change another member's name + phone number");
  await click("সেটিংস"); has("পরিবারের সেটিংস"); ok("family settings sheet");
  await back();
  await clickTab("হোম"); await click("বাজার যোগ করুন"); has("নতুন বাজার যোগ করুন"); ok("add-purchase sheet"); await back();

  // ---- shopping lists: owner made a list ("আজকের বাজার") for Abbu ----------
  await click("📝"); has("আজকের বাজার তালিকা"); has("আজকের বাজার"); has("আপনি অন্যদের জন্য তৈরি করেছেন"); ok("shopping overview: list I made for Abbu shows up");
  await click("আজকের বাজার"); has("দুধ"); has("ডিম"); ok("shopping list detail: both items visible");
  await back(); // sheets aren't stacked — one back() returns straight to the app
  await clickTab("আরও"); await click("‹ আরও"); await click("বাজারের তালিকা"); has("আজকের বাজার তালিকা"); ok("more-tab entry opens the same overview");
  await click("+ নতুন তালিকা"); has("নতুন বাজার তালিকা"); ok("create-list sheet");
  await click("তালিকা সংরক্ষণ করুন"); has("অন্তত একটি পণ্য"); ok("empty create-list is rejected");
  await setv("পণ্যের নাম (যেমন: দুধ)", "চিনি");
  const sel = find(tree, (x) => x.host === "select" && text(x).includes("নিজের জন্য"))[0];
  assert(sel, "assignee select not found");
  has("⭐ আব্বু"); ok("point 7: sl1 (created by Rakib for Abbu) makes Abbu the ★ favorite assignee");
  sel.props.onChange({ target: { value: "u2" } }); await tick();
  await click("তালিকা সংরক্ষণ করুন"); await tick(6);
  const savedList = win.FB.calls.find((c) => c[0] === "saveShoppingList");
  assert(savedList, "saveShoppingList not called");
  assert.strictEqual(savedList[2].assignedTo, "u2"); assert.strictEqual(savedList[2].items[0].name, "চিনি");
  ok("new list created, assigned to Abbu, with one item");

  // ---- Abbu opens his list, buys দুধ from it -------------------------------
  await boot("u2");
  has("আজকের বাজার"); has("২টি পণ্য বাকি"); ok("home tab: pending-shopping prompt card for the assignee");
  await click("📝"); has("আপনার জন্য"); ok("header badge opens shopping overview, count shown");
  await click("প্রতিদিন"); has("দুধ"); has("ডিম"); ok("Abbu sees the list Rakib made for him");
  has("পাঠিয়েছেন"); has("রাকিব"); ok("point 10: shows who sent the list");
  { const callLink = find(tree, (x) => x.host === "a" && text(x).includes("কল করুন"))[0];
    assert(callLink, "call button not found");
    assert(callLink.props.href.includes("01711111111"), "tel: link should carry the sender's phone number");
    const waLink = find(tree, (x) => x.host === "a" && text(x).includes("WhatsApp"))[0];
    assert(waLink && waLink.props.href.startsWith("https://wa.me/"), "WhatsApp link not found");
  }
  ok("point 10: call/WhatsApp buttons for the sender's phone number");
  await click("+ নতুন পণ্য যোগ করুন");
  await setv("পণ্যের নাম (যেমন: চিনি)", "লবণ");
  await click("তালিকায় যোগ করুন"); await tick(6);
  const addItemCall = win.FB.calls.find((c) => c[0] === "addShoppingItems");
  assert(addItemCall, "addShoppingItems not called");
  assert.strictEqual(addItemCall[3][0].name, "লবণ");
  has("লবণ"); ok("point 6: the assignee (Abbu) can add a new item to a list someone else made for him");
  await click("দুধ"); has("নতুন বাজার যোগ করুন"); ok("tapping an item opens the normal add-purchase form, seeded");
  await setv("৬৪", "70"); await click("সংরক্ষণ করুন"); await tick(8);
  const removeCall = win.FB.calls.find((c) => c[0] === "removeShoppingItems");
  assert(removeCall, "removeShoppingItems not called after buying from a list");
  assert.strictEqual(removeCall[3].length, 1); assert.strictEqual(removeCall[3][0], "it1"); // cross-realm array (vm context) — compare by value, not deepStrictEqual
  const boughtPurchase = win.FB.calls.find((c) => c[0] === "savePurchase");
  assert.strictEqual(boughtPurchase[3].items[0].productName, "দুধ");
  ok("buying দুধ from the list creates the purchase and removes just that item");
  has("ডিম"); hasNot("দুধ"); ok("point 8: after buying, returns to the list (বাকি ডিম দেখা যাচ্ছে), not the dashboard");

  // member with limited permissions: no purchase details for others
  await boot("u2");
  has("৳670"); ok("member with monthlyTotal sees family total");
  await clickTab("বাজার"); await tick(6);
  hasNot("সবাই"); ok("member without purchaseDetails: no all-members filter");
  await clickTab("রিপোর্ট"); has("রিপোর্ট"); ok("member with reports permission");


  // ---- spec scenario 4: Rakib adds চাল — 5 kg — ৳64 = ৳320 ----------------
  await boot("u1");
  await click("বাজার যোগ করুন"); has("নতুন বাজার যোগ করুন");
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
  process.exit(0); // the fake renderer never runs real effect cleanups, so
                    // Module's setInterval (shopping reminders) is still
                    // live and would otherwise keep the process open forever
})().catch((e) => { console.error("\nFAIL:", e.message); process.exit(1); });
