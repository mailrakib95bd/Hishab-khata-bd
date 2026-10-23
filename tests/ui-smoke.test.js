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
const Core = require("../js/family/family-bazar-core.js");
const FPCore = require("../js/family/family-planning-core.js");
const FSCore = require("../js/family/family-shopping-core.js");
const today = Core.dateToYmd(new Date());
const cm = Core.monthOf(today), pm = Core.addMonths(cm, -1);
const ls = {};
const win = { location: { origin: "https://example.test", pathname: "/" }, history: { pushState() {}, back() {}, go() {} }, addEventListener() {}, removeEventListener() {}, confirm: () => true, prompt: () => "", FBCore: Core, FPCore, FSCore, localStorage: null };
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
  const plans = [];
  const planSubs = [];
  // বাজার তালিকা: L1 আব্বু → রাকিব (running) · L2 রাকিব → আব্বু (running) · L3 রাকিব → আব্বু (completed)
  const mkItem = (id, name, q, unit, est, extra) => Object.assign(FSCore.item({ id, name, categoryId: Core.DEFAULT_CATEGORIES[0].id, quantity: q, unit, estUnitPrice: est, note: "" }), extra || {});
  const shopItems = {
    L1: [mkItem("i1", "চাল", 5, "kg", 70), mkItem("i2", "আলু", 2, "kg", 30), mkItem("i3", "মাছ", 1, "kg", 250), mkItem("i4", "ডিম", 12, "pcs", 12), mkItem("i5", "পেঁয়াজ", 1, "kg", 60)],
    L2: [mkItem("j1", "সেমাই", 1, "kg", 180), mkItem("j2", "দুধ", 2, "L", 90)],
    L3: [mkItem("k1", "চিনি", 2, "kg", 120, { status: "bought", actualUnitPrice: 125 }), mkItem("k2", "লবণ", 1, "kg", 40, { status: "not_found", reason: "দোকানে নেই" })],
  };
  const mkList = (id, title, by, byName, to, toName, status) => ({ id, familyId: "f1", title, shoppingDate: today, shoppingTime: null, note: id === "L1" ? "ব্যাগ নিও" : "", createdBy: by, createdByName: byName, assignedToUid: to, assignedToName: toName, status, createdAt: "2026-10-16T08:0" + id.slice(1) + ":00.000Z", completedAt: null, completedBy: null });
  const shopLists = [mkList("L1", "সাপ্তাহিক বাজার", "u2", "আব্বু", "u1", "রাকিব", "in_progress"), mkList("L2", "ঈদের বাজার", "u1", "রাকিব", "u2", "আব্বু", "in_progress"), mkList("L3", "গত মাসের বাজার", "u1", "রাকিব", "u2", "আব্বু", "completed")];
  shopLists.forEach((l) => { l.stats = FSCore.listStats(shopItems[l.id]); });
  const shopSubs = [], itemSubs = {};
  const emitShop = () => shopSubs.forEach((cb) => cb(shopLists.map((l) => Object.assign({}, l))));
  const emitItems = (id) => (itemSubs[id] || []).forEach((cb) => cb((shopItems[id] || []).map((i) => Object.assign({}, i))));
  const emitPlans = () => planSubs.forEach((cb) => cb(plans.slice()));
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
    subscribeShoppingLists: (fid, cb) => { shopSubs.push(cb); cb(shopLists.map((l) => Object.assign({}, l))); return () => { shopSubs.splice(shopSubs.indexOf(cb), 1); }; },
    subscribeShoppingItems: (fid, id, cb) => { (itemSubs[id] = itemSubs[id] || []).push(cb); cb((shopItems[id] || []).map((i) => Object.assign({}, i))); return () => { itemSubs[id].splice(itemSubs[id].indexOf(cb), 1); }; },
    createShoppingList: async (fid, list, items) => { calls.push(["createShoppingList", fid, list, items]); shopLists.push(Object.assign({}, list)); shopItems[list.id] = (items || []).map((i) => Object.assign({}, i)); emitShop(); return list.id; },
    addShoppingItem: async (fid, id, item, stats) => { calls.push(["addShoppingItem", fid, id, item, stats]); (shopItems[id] = shopItems[id] || []).push(Object.assign({}, item)); shopLists.find((l) => l.id === id).stats = stats; emitItems(id); emitShop(); },
    updateShoppingItem: async (fid, id, itemId, patch, stats) => { calls.push(["updateShoppingItem", fid, id, itemId, patch, stats]); const k = shopItems[id].findIndex((i) => i.id === itemId); shopItems[id][k] = Object.assign({}, shopItems[id][k], patch, { updatedBy: me, updatedAt: "now" }); shopLists.find((l) => l.id === id).stats = stats; emitItems(id); emitShop(); },
    updateShoppingList: async (fid, id, patch) => { calls.push(["updateShoppingList", fid, id, patch]); const k = shopLists.findIndex((l) => l.id === id); shopLists[k] = Object.assign({}, shopLists[k], patch); emitShop(); },
    deleteShoppingList: async (fid, id, itemIds) => { calls.push(["deleteShoppingList", fid, id, itemIds]); const k = shopLists.findIndex((l) => l.id === id); if (k !== -1) shopLists.splice(k, 1); delete shopItems[id]; emitShop(); },
    familyPlans: async () => plans,
    subscribePlans: (fid, cb) => { planSubs.push(cb); cb(plans.slice()); return () => { planSubs.splice(planSubs.indexOf(cb), 1); }; },
    // mirrors the real window.FB Family Planning functions exactly: read →
    // apply the SAME FPCore pure transform the real app uses → write back —
    // so this mock exercises the real approve/verify/etc logic, not a
    // simplified stand-in for it.
    createPlan: async (fid, p) => { calls.push(["createPlan", fid, p]); const id = "pl" + (plans.length + 1); plans.push(Object.assign({}, p, { id })); emitPlans(); return id; },
    // every real window.FB.* Family Planning method is async (reads
    // Firestore first) — family-bazar.js chains .then()/await on all of
    // them, so this mock must return real Promises too, not plain values
    async _mutatePlan(fid, planId, mutate) { const i = plans.findIndex((p) => p.id === planId); if (i === -1) return null; const next = mutate(plans[i]); plans[i] = Object.assign({}, plans[i], next); emitPlans(); return plans[i]; },
    approvePlan(fid, id, uid2, name) { calls.push(["approvePlan", fid, id]); return this._mutatePlan(fid, id, (p) => FPCore.approvePlan(p, uid2, name)); },
    rejectPlan(fid, id, uid2, name, reason) { calls.push(["rejectPlan", fid, id, reason]); return this._mutatePlan(fid, id, (p) => FPCore.rejectPlan(p, uid2, name, reason)); },
    requestPlanChanges(fid, id, uid2, name, note) { calls.push(["requestPlanChanges", fid, id, note]); return this._mutatePlan(fid, id, (p) => FPCore.requestPlanChanges(p, uid2, name, note)); },
    resubmitPlan(fid, id, uid2, name, patch) { calls.push(["resubmitPlan", fid, id, patch]); return this._mutatePlan(fid, id, (p) => Object.assign(FPCore.resubmitPlan(p, uid2, name), patch || {})); },
    editPlan(fid, id, uid2, name, patch) { calls.push(["editPlan", fid, id, patch]); return this._mutatePlan(fid, id, (p) => Object.assign({}, p, patch)); },
    completePlan(fid, id, uid2, name) { calls.push(["completePlan", fid, id]); return this._mutatePlan(fid, id, (p) => FPCore.completePlan(p, uid2, name)); },
    deletePlan: async (fid, id) => { calls.push(["deletePlan", fid, id]); const i = plans.findIndex((p) => p.id === id); if (i !== -1) plans.splice(i, 1); emitPlans(); },
    addContribution(fid, id, draft, uid2, name) {
      calls.push(["addContribution", fid, id, draft]);
      return this._mutatePlan(fid, id, (p) => {
        const c = FPCore.contribution(Object.assign({}, draft, { memberUid: uid2, memberName: name }));
        return { contributions: [...(p.contributions || []), c] };
      });
    },
    verifyContribution(fid, id, cid, status, receivedAmount, uid2, name, reason) {
      calls.push(["verifyContribution", fid, id, cid, status, receivedAmount]);
      return this._mutatePlan(fid, id, (p) => {
        const contributions = (p.contributions || []).map((c) => (c.id !== cid ? c : Object.assign({}, c, {
          status, receivedAmount: status === "rejected" ? null : FPCore.round2(receivedAmount != null ? receivedAmount : c.claimedAmount),
          verifiedBy: uid2, verifiedByName: name, rejectionReason: status === "rejected" ? (reason || "") : "",
        })));
        return FPCore.refreshAchievedStatus(Object.assign({}, p, { contributions }));
      });
    },
    addExpense(fid, id, draft, uid2, name, autoApprove) {
      calls.push(["addExpense", fid, id, draft]);
      return this._mutatePlan(fid, id, (p) => {
        const e = FPCore.expense(Object.assign({}, draft, { addedBy: uid2, addedByName: name, status: (autoApprove || !p.expenseApprovalRequired) ? "approved" : "pending" }));
        return { expenses: [...(p.expenses || []), e] };
      });
    },
    setProductCategory: async (fid, pid, catId) => { calls.push(["setProductCategory", fid, pid, catId]); },
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
  const src = fs.readFileSync(path.join(__dirname, "..", "js", "family", "family-bazar.js"), "utf8");
  vm.runInContext(src, ctxObj, { filename: "family-bazar.js" });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "family", "family-planning.js"), "utf8"), ctxObj, { filename: "family-planning.js" });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "family", "family-shopping.js"), "utf8"), ctxObj, { filename: "family-shopping.js" });
  const { Module, useFamilyAlerts } = win.FamilyBazar;
  assert(Module && useFamilyAlerts, "exports");
  root = h(Module, { user: extra === "none" ? null : { uid: userUid, displayName: "x", email: "x@gmail.com" }, mode: /^embedded/.test(extra || "") ? "embedded" : "full", startView: /dashboard$/.test(extra || "") ? "dashboard" : /planning$/.test(extra || "") ? "planning" : /lists$/.test(extra || "") ? "lists" : "bazar", onClose() {} });
  render(); await tick(10);
}

(async () => {
  let n = 0; const ok = (m) => { n++; console.log("  ✓ " + m); };

  // signed out → sign-in entry
  await boot("u1", "none"); has("Google দিয়ে Sign In"); ok("signed-out entry screen");

  const dig = (x) => String(x).replace(/[\u09e6-\u09ef]/g, (d) => "\u09e6\u09e7\u09e8\u09e9\u09ea\u09eb\u09ec\u09ed\u09ee\u09ef".indexOf(d));
  const lastCall = (name) => { const c = win.FB.calls.filter((x) => x[0] === name); return c[c.length - 1]; };
  const byAria = (a, root) => find(root || tree, (n) => n.host === "button" && n.props["aria-label"] === a)[0];
  const clickAria = async (a) => { const b = byAria(a); assert(b, "button (aria) not found: " + a); b.props.onClick({ stopPropagation() {}, preventDefault() {} }); await tick(); };
  const clickExact = async (label) => { const b = find(tree, (n) => n.host === "button" && text(n).trim() === label)[0]; assert(b, "exact button not found: " + label); b.props.onClick({ stopPropagation() {}, preventDefault() {} }); await tick(); };
  const setAria = async (a, v, host) => { const el = find(tree, (n) => n.host === (host || "input") && n.props["aria-label"] === a)[0]; assert(el, "field " + a); el.props.onChange({ target: { value: v } }); await tick(); };
  const pickStatus = async (label) => { const lab = find(tree, (n) => n.host === "label" && text(n).includes(label))[0]; assert(lab, "status " + label); find(lab, (n) => n.host === "input")[0].props.onChange({ target: { checked: true } }); await tick(); };
  const setTextarea = async (ph, v) => { const el = find(tree, (n) => n.host === "textarea" && n.props.placeholder === ph)[0]; assert(el, "textarea " + ph); el.props.onChange({ target: { value: v } }); await tick(); };

  // ===== ফ্যামিলি opens its Dashboard DIRECTLY (হোম/বাজার/রিপোর্ট/পরিবার/আরও) — no card menu =====
  await boot("u1", "embedded");
  has("কে কত খরচ করেছে"); ["হোম", "বাজার", "রিপোর্ট", "পরিবার", "আরও"].forEach(has); hasNot("ফ্যামিলি প্লানিং"); hasNot("খরচ ও রিপোর্ট"); ok("ফ্যামিলি opens the Dashboard straight away: the 5 tabs + family spending, no feature-card menu");
  // header icons, left → right: 📝 ব্যক্তিগত তালিকা · 🔁 পরিবার পরিবর্তন · 📦 বাজার তালিকা · 🔎 সার্চ
  const headerOrder = () => { const pl = byAria("ব্যক্তিগত তালিকা"), sw = byAria("পরিবার বদলান"), sh = byAria("বাজার তালিকা"), se = byAria("খুঁজুন");
    assert(pl && sw && sh && se, "all four header buttons exist"); assert.strictEqual(text(pl).trim(), "📝"); assert.strictEqual(text(sh).trim(), "📦"); assert.strictEqual(text(se).trim(), "🔎");
    const row = find(tree, (n) => n.host === "div" && Array.isArray(n.kids) && n.kids.includes(pl) && n.kids.includes(se))[0]; assert(row, "one header row");
    const k = row.kids; assert(k.indexOf(pl) < k.indexOf(sw) && k.indexOf(sw) < k.indexOf(sh) && k.indexOf(sh) === k.indexOf(se) - 1, "order must be 📝 · 🔁 · 📦 · 🔎"); return { pl, sh }; };
  { headerOrder(); } ok("header icons are ordered 📝 ব্যক্তিগত তালিকা · 🔁 · 📦 বাজার তালিকা · 🔎 (📦 directly left of the search)");
  { const { pl } = headerOrder(); await pl.props.onClick(); await tick(); }
  has("শীঘ্রই আসছে"); has("Upcoming"); hasNot("FAMILYVIEW"); hasNot("নতুন বাজার আইটেম"); ok("📝 ব্যক্তিগত তালিকা only shows \"শীঘ্রই আসছে / Upcoming\" — no working code behind it");
  await click("ফিরে যান"); await tick(); has("কে কত খরচ করেছে");
  { const { sh } = headerOrder(); await sh.props.onClick(); await tick(); }
  has("+ নতুন তালিকা তৈরি"); has("সাপ্তাহিক বাজার"); ok("📦 opens the বাজার তালিকা (create / send / shop)");
  await click("‹ ফ্যামিলি"); await tick(); has("কে কত খরচ করেছে"); ok("‹ ফ্যামিলি returns to the Dashboard");
  await boot("u1", "embedded-planning"); has("মোট পরিকল্পনা"); assert(!byAria("বাজার তালিকা") && !byAria("ব্যক্তিগত তালিকা") && !byAria("খুঁজুন"), "the planning page keeps its own plain header"); ok("ফ্যামিলি প্লানিং (its own tab) works as before, with no list/search icons");
  { const sig = (u) => ["ব্যক্তিগত তালিকা", "পরিবার বদলান", "বাজার তালিকা", "খুঁজুন"].map((a) => !!byAria(a)).join() + "|" + ["হোম", "বাজার", "রিপোর্ট", "পরিবার", "আরও"].map((l) => text(tree).includes(l)).join();
    await boot("u1", "embedded"); const a1 = sig(); await boot("u2", "embedded"); const a2 = sig(); assert.strictEqual(a1, a2, "owner and member differ: " + a1 + " vs " + a2); }
  ok("owner and ordinary member get the SAME Family layout (header icons + tabs)");
  await boot("u1", "none"); { const pl = byAria("ব্যক্তিগত তালিকা"); assert(pl, "📝 exists even before sign-in/family"); await pl.props.onClick(); await tick(); } has("শীঘ্রই আসছে"); ok("📝 is reachable even signed out / without a family");

  // ===== 🧾 বাজার তালিকা (family-shopping.js) — as the owner (u1: shopper of L1, creator of L2/L3) =====
  ABBU.phone = "01812345678";
  await boot("u1", "embedded-lists");
  has("+ নতুন তালিকা তৈরি"); has("সাপ্তাহিক বাজার"); has("ঈদের বাজার"); assert(dig(text(tree)).includes("বাজার তালিকা (2)") && dig(text(tree)).includes("সম্পন্ন তালিকা (1)"), "tab counts");
  has("আপনাকে"); ok("lists home: running lists, history count, and a note that I was asked to shop");
  await click("সাপ্তাহিক বাজার"); await tick(); has("ব্যাগ নিও"); has("তালিকা প্রস্তুতকারী"); has("বাজার করার দায়িত্বে"); has("০/৫"); 
  { const tel = find(tree, (n) => n.host === "a" && String(n.props.href || "").startsWith("tel:")); assert(tel.length >= 1, "a call button for the other member (phone saved on the member screen)"); }
  ok("list sheet: note, creator, shopper, progress, and a call button to the other member");
  has("➕ পণ্য যোগ করুন"); ok("the owner/admin can manage every list, including one made by someone else");
  // tick চাল -> কেনা হয়েছে but no price yet
  { const cb = find(tree, (n) => n.host === "button" && n.props.role === "checkbox" && String(n.props["aria-label"]).startsWith("চাল"))[0]; assert(cb, "checkbox"); cb.props.onClick(); await tick(8); }
  { const c = lastCall("updateShoppingItem"); assert(c && c[3] === "i1" && c[4].status === "bought" && c[4].actualUnitPrice === null && c[5].purchased === 1 && c[5].incompletePrice === 1, JSON.stringify(c && c[4])); }
  has("প্রকৃত দাম দেওয়া হয়নি"); ok("ticking a product marks it কেনা হয়েছে; with no price entered it is flagged and NOT counted in the actual total");
  await clickAria("চাল — বিস্তারিত"); has("পণ্য আপডেট"); await setv("70", "68"); await clickExact("সংরক্ষণ করুন"); await tick(8);
  { const c = lastCall("updateShoppingItem"); assert(c[4].actualUnitPrice === 68 && c[5].actualTotal === 340 && c[5].incompletePrice === 0, JSON.stringify(c[4]) + JSON.stringify(c[5])); }
  has("340"); ok("actual price 68 × 5 kg = 340 is computed and saved (estimated 350 stays separate)");
  await clickAria("মাছ — বিস্তারিত"); await pickStatus("বাজারে পাওয়া যায়নি"); await setTextarea("যেমন: আজকে বাজারে মাছ ছিল না।", "আজকে মাছ ছিল না"); await clickExact("সংরক্ষণ করুন"); await tick(8);
  { const c = lastCall("updateShoppingItem"); assert(c[3] === "i3" && c[4].status === "not_found" && c[4].reason === "আজকে মাছ ছিল না" && c[5].notFound === 1, JSON.stringify(c[4])); }
  has("আজকে মাছ ছিল না"); has("বাজারে পাওয়া যায়নি"); ok("না-পাওয়া product keeps its reason and is never shown as bought");
  await clickAria("ডিম — বিস্তারিত"); await pickStatus("বিকল্প পণ্য কেনা হয়েছে"); await clickExact("সংরক্ষণ করুন"); await tick(); has("বিকল্প পণ্যের নাম লিখুন");
  await setv("যেমন: ইলিশ (ফ্রোজেন)", "হাঁসের ডিম"); await setv("যেমন ১", "12"); await setv("যেমন ২৮০", "14"); await clickExact("সংরক্ষণ করুন"); await tick(8);
  { const c = lastCall("updateShoppingItem"); assert(c[3] === "i4" && c[4].status === "alternative" && c[4].alternative.name === "হাঁসের ডিম" && c[4].alternative.quantity === 12 && c[4].alternative.unitPrice === 14 && c[5].alternative === 1, JSON.stringify(c[4])); assert.strictEqual(c[5].actualTotal, 340 + 168, "alternative price 14 × 12 = 168 joins the actual total"); }
  ok("alternative product: name required; its name/quantity/price are saved and counted (14 × 12 = 168)");
  await click("বাজার সম্পন্ন করুন"); await tick(); has("তালিকার সারাংশ"); has("পেঁয়াজ"); has("সিদ্ধান্ত বাকি"); has("আংশিক সম্পন্ন");
  ok("completion summary warns that পেঁয়াজ is still undecided and the list will be আংশিক সম্পন্ন");
  await click("নিশ্চিত করে বাজার সম্পন্ন করুন"); await tick(8);
  { const c = lastCall("updateShoppingList"); assert(c[2] === "L1" && c[3].status === "partial" && c[3].completedBy === "u1" && c[3].stats.undecided === 2 && c[3].completedAt, JSON.stringify(c[3])); }
  ok("completing saves status, stats, who and when");
  await clickTab("সম্পন্ন তালিকা"); has("সাপ্তাহিক বাজার"); has("গত মাসের বাজার"); ok("finished lists move to the history tab");
  await click("সাপ্তাহিক বাজার"); await tick(); hasNot("বাজার সম্পন্ন করুন"); has("↻ এই তালিকা থেকে নতুন তালিকা"); has("💰 বাজারের হিসাবে যোগ করুন"); ok("a finished list is read-only and offers: new list from it · add to accounts");
  await click("💰 বাজারের হিসাবে যোগ করুন"); await tick(); has("নতুন বাজার যোগ করুন"); ok("→ opens the Family Bazar purchase form seeded with the bought lines");
  await back(); await click("↻ এই তালিকা থেকে নতুন তালিকা"); await tick(); has("আগের তালিকা থেকে তৈরি"); await setv("আজকের বাজার / সাপ্তাহিক বাজার / বিশেষ বাজার", "পরের সপ্তাহের বাজার"); await click("তৈরি করুন"); await tick(10);
  { const c = lastCall("createShoppingList"); assert(c && c[2].title === "পরের সপ্তাহের বাজার" && c[2].copiedFrom === "L1" && c[3].length === 5 && c[3][0].quantity === 5 && c[3][0].estUnitPrice === 70 && c[3].every((i) => i.status === "pending" && i.actualUnitPrice === null), JSON.stringify(c && c[2])); }
  ok("new list from a past one: products + quantity/price copied, every product starts কেনা বাকি, no actual prices carried over");

  // create a brand-new list + quick-add 12 products
  await boot("u1", "embedded-lists");
  await click("+ নতুন তালিকা তৈরি"); await tick(); await click("তৈরি করে পণ্য যোগ করুন"); await tick(); has("তালিকার নাম লিখুন"); assert(!lastCall("createShoppingList"), "an incomplete list is never saved"); ok("list form validates the name");
  await setv("আজকের বাজার / সাপ্তাহিক বাজার / বিশেষ বাজার", "আজকের বাজার"); await click("তৈরি করে পণ্য যোগ করুন"); await tick(10);
  { const c = lastCall("createShoppingList"); assert(c && c[2].assignedToUid === "u2" && c[2].createdBy === "u1" && c[2].status === "in_progress" && c[2].shoppingDate === today, JSON.stringify(c && c[2])); }
  has("➕ পণ্য যোগ করুন"); ok("list created for the chosen member; the list opens ready for products");
  await click("যোগ করুন"); await tick(); has("পণ্যের নাম লিখুন"); has("ক্যাটাগরি বেছে নিন"); assert(!lastCall("addShoppingItem"), "an incomplete product is rejected"); ok("product without name/category is rejected");
  await setAria("পণ্যের নাম", "চিনি"); await setAria("পরিমাণ", "abc"); await setAria("ক্যাটাগরি", Core.DEFAULT_CATEGORIES[0].id, "select"); await click("যোগ করুন"); await tick(); has("পরিমাণ সঠিক নয়"); assert(!lastCall("addShoppingItem")); ok("an invalid quantity is rejected (never silently 0)");
  for (let i = 1; i <= 12; i++) { await setAria("পণ্যের নাম", "পণ্য " + i); await setAria("পরিমাণ", String(i)); await setAria("আনুমানিক একক দাম", i % 2 ? String(10 * i) : ""); await setAria("ক্যাটাগরি", Core.DEFAULT_CATEGORIES[0].id, "select"); await click("যোগ করুন"); await tick(8); }
  assert.strictEqual(win.FB.calls.filter((x) => x[0] === "addShoppingItem").length, 12);
  { const last = lastCall("addShoppingItem"); assert(last[4].total === 12 && last[3].estUnitPrice === null, "a blank estimated price stays null"); const first = win.FB.calls.filter((x) => x[0] === "addShoppingItem")[0]; assert(first[3].quantity === 1 && first[3].estUnitPrice === 10 && first[3].status === "pending"); }
  has("পণ্য 12"); assert.strictEqual(find(tree, (n) => n.host === "input" && n.props["aria-label"] === "পণ্যের নাম")[0].props.value, "", "the form is empty and ready for the next product"); ok("12 products added one after another on the same screen; a blank price is stored as unknown, not 0");

  // ===== role-based behaviour — as u2 (ordinary member, shopper of L2, creator of nothing) =====
  await boot("u2", "embedded-lists");
  await click("ঈদের বাজার"); await tick();
  hasNot("➕ পণ্য যোগ করুন"); hasNot("🗑 তালিকা মুছুন"); hasNot("✏️ তালিকার তথ্য সম্পাদনা"); has("বাজার সম্পন্ন করুন");
  ok("the shopper can shop and finish, but cannot add products, edit the list or delete it");
  await clickAria("সেমাই — বিস্তারিত"); has("পণ্য আপডেট"); hasNot("বাতিল (কারণসহ)"); hasNot("পণ্যের তথ্য সম্পাদনা"); await pickStatus("কেনা হয়েছে"); await setv("180", "175"); await clickExact("সংরক্ষণ করুন"); await tick(8);
  { const c = lastCall("updateShoppingItem"); assert(c[3] === "j1" && c[4].status === "bought" && c[4].actualUnitPrice === 175, JSON.stringify(c[4])); }
  ok("the shopper can set status + price but has no cancel option and cannot edit the product itself");
  await boot("u2", "embedded-lists"); await clickTab("সম্পন্ন তালিকা"); await click("গত মাসের বাজার"); await tick(); hasNot("বাজার সম্পন্ন করুন"); hasNot("🗑 তালিকা মুছুন"); has("গত মাসের বাজার"); ok("a completed list is locked for the shopper (no finish/delete)");
  // manager: the creator can cancel with a reason, edit, delete (with confirm)
  await boot("u1", "embedded-lists"); await click("ঈদের বাজার"); await tick(); has("✏️ তালিকার তথ্য সম্পাদনা"); has("🗑 তালিকা মুছুন");
  await clickAria("দুধ — বিস্তারিত"); has("বাতিল (কারণসহ)"); has("পণ্যের তথ্য সম্পাদনা"); await pickStatus("বাতিল (কারণসহ)"); await clickExact("সংরক্ষণ করুন"); await tick(); has("বাতিলের কারণ লিখুন");
  await setTextarea("মন্তব্য লিখুন", "আর লাগবে না"); await clickExact("সংরক্ষণ করুন"); await tick(8);
  { const c = lastCall("updateShoppingItem"); assert(c[3] === "j2" && c[4].status === "cancelled" && c[4].reason === "আর লাগবে না" && c[5].cancelled === 1 && c[5].total === 1, JSON.stringify(c[4])); }
  ok("the creator cancels a product with a mandatory reason — it is marked বাতিল, not deleted");
  await click("🗑 তালিকা মুছুন"); await tick(8);
  { const c = lastCall("deleteShoppingList"); assert(c && c[2] === "L2" && c[3].length === 2, JSON.stringify(c)); } ok("deleting asks for confirmation, then removes the list and its products");
  ABBU.phone = undefined; delete ABBU.phone;

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

  // ---- Family Planning: create → approve → contribute → verify → complete ----
  await boot("u1", "full-planning"); has("মোট পরিকল্পনা"); ok("planning dashboard opens from its own place");
  await click("+ নতুন পরিকল্পনা তৈরি করুন"); has("নতুন পরিকল্পনা তৈরি করুন"); ok("create-plan sheet");
  await click("পরিকল্পনা জমা দিন"); has("নাম লিখুন"); ok("empty create-plan draft is rejected with field-level errors");
  await setv("যেমন: Family Tour 2027", "Family Tour 2027");
  { const typeSel = find(tree, (x) => x.host === "select")[0]; assert(typeSel, "plan type select not found");
    typeSel.props.onChange({ target: { value: "travel" } }); await tick(); }
  await setv("যেমন: 50000", "60000");
  { const dateInputs = find(tree, (x) => x.host === "input" && x.props.type === "date");
    assert.strictEqual(dateInputs.length, 2, "expected exactly start+end date inputs");
    dateInputs[1].props.onChange({ target: { value: "2027-06-30" } }); await tick(); }
  await click("পরিকল্পনা জমা দিন"); await tick(6);
  const createCall = win.FB.calls.find((c) => c[0] === "createPlan");
  assert(createCall, "createPlan not called");
  assert.strictEqual(createCall[2].status, "pending_approval"); assert.strictEqual(createCall[2].targetAmount, 60000);
  has("Family Tour 2027"); ok("new plan created (pending_approval) and shown back on the home screen");

  await click("Family Tour 2027"); has("পেন্ডিং"); has("অনুমোদনের অপেক্ষায়"); ok("plan details: pending-approval banner shown");
  await click("অনুমোদন করুন"); has("পরিকল্পনা অনুমোদন"); has("Family Tour 2027"); ok("plan-approval screen (owner view)");
  await click("অনুমোদন করুন"); await tick(6);
  assert(win.FB.calls.find((c) => c[0] === "approvePlan"), "approvePlan not called");
  has("সক্রিয়"); has("টাকা যোগ করুন"); ok("point: approving moves pending_approval → active, back on plan details, contribute button now shown");

  await click("টাকা যোগ করুন"); has("অবদান যোগ করুন");
  { const amt = find(tree, (x) => x.host === "input" && x.props.inputMode === "decimal")[0]; assert(amt, "contribution amount input not found");
    amt.props.onChange({ target: { value: "60000" } }); await tick(); }
  await click("জমা দিন"); await tick(6);
  const contribCall = win.FB.calls.find((c) => c[0] === "addContribution");
  assert(contribCall, "addContribution not called"); assert.strictEqual(contribCall[3].claimedAmount, 60000);
  ok("Rule 3: a submitted contribution starts pending, and does not need to be checked here — verified via Owner Approval Center next");

  await click("🔔 অনুমোদন কেন্দ্র"); has("অনুমোদন কেন্দ্র");
  await click("অবদান যাচাই (১)"); has("রাকিব"); has("Family Tour 2027"); ok("Owner Approval Center: pending contribution listed under অবদান যাচাই");
  await click("যাচাই করুন ›"); has("অবদান যাচাই"); ok("opens the verification screen for that plan");
  await click("✓ টাকা পেয়েছি"); await tick(6);
  const verifyCall = win.FB.calls.find((c) => c[0] === "verifyContribution");
  assert(verifyCall, "verifyContribution not called");
  assert.strictEqual(verifyCall[4], "approved"); assert.strictEqual(verifyCall[5], 60000);
  ok("Rule 4: Owner confirming ৳60,000 received moves it from pending straight to the official (approved) total");

  await click("Family Tour 2027"); has("লক্ষ্য পূর্ণ"); has("সম্পন্ন করুন"); ok("point: approved collection reaching the target auto-flips status to target_achieved, and shows সম্পন্ন করুন for the owner");
  await click("সম্পন্ন করুন"); await tick(6);
  assert(win.FB.calls.find((c) => c[0] === "completePlan"), "completePlan not called on opening the Complete Plan screen");
  has("🎉"); has("সম্পন্ন"); ok("Complete Plan screen auto-finalizes and shows the celebration summary");

  // member with limited permissions: no purchase details for others
  await boot("u2");
  has("৳670"); ok("member with monthlyTotal sees family total");
  await clickTab("বাজার"); await tick(6);
  hasNot("সবাই"); ok("member without purchaseDetails: no all-members filter");
  await clickTab("রিপোর্ট"); has("রিপোর্ট"); ok("member with reports permission");


  // ---- spec scenario 4: Rakib adds চাল — 5 kg — ৳64 = ৳320 ----------------
  await boot("u1");
  await click("বাজার যোগ করুন"); has("নতুন বাজার যোগ করুন");
  await clickExact("সংরক্ষণ করুন"); has("•"); assert(win.FB.calls.length === 0); ok("empty purchase is rejected, nothing saved");
  await setv("পণ্যের নাম (যেমন: চাল)", "চাল"); await setv("৫", "5"); await setv("৬৪", "64");
  has("৳320"); ok("total auto-calculated: 5 × 64 = ৳320");
  await setv("যেমন: সুন্দরগঞ্জ বাজার", "সুন্দরগঞ্জ বাজার"); await setv("যেমন: গাইবান্ধা", "গাইবান্ধা");
  await clickExact("সংরক্ষণ করুন"); await tick(10);
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
                    // any live subscription/listener is still "open" and
                    // would otherwise keep the process open forever
})().catch((e) => { console.error("\nFAIL:", e.message); process.exit(1); });
