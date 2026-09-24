// হিসাব-খাতা — Family Bazar: pure logic core.
//
// No React, no Firebase, no DOM in here — only data in, data out. That keeps
// every rule about money, dates, permissions, price analysis and statistics
// in one place that can be unit-tested in Node (see tests/core.test.js) and
// reused unchanged by the UI (family-bazar.js) and the data layer
// (firebase-init.js).
//
// Loaded as a classic <script>; exposes window.FBCore (and module.exports
// under Node).
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FBCore = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * constants
   * ------------------------------------------------------------------ */
  const RELATIONS = [
    { key: "self", label: "আমি" },
    { key: "father", label: "বাবা" }, { key: "mother", label: "মা" },
    { key: "brother", label: "ভাই" }, { key: "sister", label: "বোন" },
    { key: "husband", label: "স্বামী" }, { key: "wife", label: "স্ত্রী" },
    { key: "son", label: "ছেলে" }, { key: "daughter", label: "মেয়ে" },
    { key: "grandfather", label: "দাদা/নানা" }, { key: "grandmother", label: "দাদি/নানি" },
    { key: "other", label: "অন্যান্য" },
  ];
  // "self" is only for the creator's own row; it is not offered when inviting
  const INVITE_RELATIONS = RELATIONS.filter((r) => r.key !== "self");

  const ROLES = {
    owner: { key: "owner", label: "মালিক", hint: "সম্পূর্ণ নিয়ন্ত্রণ" },
    admin: { key: "admin", label: "এডমিন", hint: "সদস্য, ক্যাটাগরি ও বাজেট পরিচালনা করতে পারেন" },
    member: { key: "member", label: "সদস্য", hint: "নিজের বাজার যোগ/সম্পাদনা করতে পারেন" },
    viewer: { key: "viewer", label: "ভিউয়ার", hint: "শুধু অনুমতি পাওয়া তথ্য দেখতে পারেন" },
  };
  const INVITABLE_ROLES = ["admin", "member", "viewer"];

  const PERMISSIONS = [
    { key: "monthlyTotal", label: "মাসিক মোট খরচ", hint: "অন্য সদস্যদের মাসিক/দৈনিক মোট খরচ দেখা" },
    { key: "categorySummary", label: "ক্যাটাগরি অনুযায়ী সারাংশ", hint: "কোন ক্যাটাগরিতে কত খরচ — শুধু যোগফল" },
    { key: "purchaseDetails", label: "প্রতিটি কেনাকাটার বিস্তারিত", hint: "অন্যদের কোন দিন কী কিনেছেন তার পূর্ণ তালিকা" },
    { key: "priceHistory", label: "পণ্যের দামের ইতিহাস", hint: "পণ্যের দাম কখন কত ছিল" },
    { key: "locationComparison", label: "এলাকাভিত্তিক দাম তুলনা", hint: "বাজার/এলাকা অনুযায়ী দামের তুলনা" },
    { key: "reports", label: "রিপোর্ট", hint: "পরিবারের মাসিক রিপোর্ট দেখা" },
    { key: "memberManagement", label: "সদস্য পরিচালনা", hint: "সদস্য Invite ও সদস্য/ভিউয়ারের পারমিশন পরিবর্তন" },
  ];
  const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

  function permissionPreset(role) {
    const none = {};
    PERMISSION_KEYS.forEach((k) => (none[k] = false));
    if (role === "owner") { PERMISSION_KEYS.forEach((k) => (none[k] = true)); return none; }
    if (role === "admin") {
      PERMISSION_KEYS.forEach((k) => (none[k] = true));
      none.purchaseDetails = false; // private by default, even for admins
      return none;
    }
    if (role === "viewer") return Object.assign(none, { monthlyTotal: true, categorySummary: true, reports: true });
    // member
    return Object.assign(none, { monthlyTotal: true, categorySummary: true, priceHistory: true, reports: true });
  }
  function normalizePermissions(p) {
    const out = {};
    PERMISSION_KEYS.forEach((k) => (out[k] = !!(p && p[k] === true)));
    return out;
  }

  // Built-in categories. They are constants (stable ids, no seeding writes);
  // families add their own custom ones in families/{id}/categories.
  const DEFAULT_CATEGORIES = [
    { id: "def_rice", name: "চাল", icon: "🍚", group: "grocery" },
    { id: "def_lentil", name: "ডাল", icon: "🫘", group: "grocery" },
    { id: "def_oil", name: "তেল", icon: "🛢️", group: "grocery" },
    { id: "def_salt", name: "লবণ", icon: "🧂", group: "grocery" },
    { id: "def_spice", name: "মসলা", icon: "🌶️", group: "grocery" },
    { id: "def_vegetable", name: "সবজি", icon: "🥦", group: "grocery" },
    { id: "def_fish", name: "মাছ", icon: "🐟", group: "grocery" },
    { id: "def_meat", name: "মাংস", icon: "🥩", group: "grocery" },
    { id: "def_egg", name: "ডিম", icon: "🥚", group: "grocery" },
    { id: "def_milk", name: "দুধ", icon: "🥛", group: "grocery" },
    { id: "def_fruit", name: "ফল", icon: "🍎", group: "grocery" },
    { id: "def_potato", name: "আলু", icon: "🥔", group: "grocery" },
    { id: "def_onion", name: "পেঁয়াজ", icon: "🧅", group: "grocery" },
    { id: "def_garlic", name: "রসুন", icon: "🧄", group: "grocery" },
    { id: "def_grocery_other", name: "মুদি — অন্যান্য", icon: "🛒", group: "grocery" },
    { id: "def_soap", name: "সাবান", icon: "🧼", group: "household" },
    { id: "def_detergent", name: "ডিটারজেন্ট", icon: "🧴", group: "household" },
    { id: "def_tissue", name: "টিস্যু", icon: "🧻", group: "household" },
    { id: "def_cleaning", name: "পরিষ্কারের সামগ্রী", icon: "🧹", group: "household" },
    { id: "def_kitchen", name: "রান্নাঘরের সামগ্রী", icon: "🍳", group: "household" },
    { id: "def_household_other", name: "গৃহস্থালী — অন্যান্য", icon: "🧺", group: "household" },
  ];
  const CATEGORY_GROUPS = [
    { key: "grocery", label: "মুদি ও খাবার" },
    { key: "household", label: "গৃহস্থালী" },
  ];
  // words people actually type → default category id (Bangla + English)
  const CATEGORY_HINTS = [
    ["def_rice", ["চাল", "rice", "মিনিকেট", "নাজিরশাইল", "আটা", "ময়দা"]],
    ["def_lentil", ["ডাল", "lentil", "মসুর", "মুগ", "ছোলা"]],
    ["def_oil", ["তেল", "oil", "সয়াবিন", "সরিষা"]],
    ["def_salt", ["লবণ", "salt"]],
    ["def_spice", ["মসলা", "spice", "হলুদ", "মরিচ", "জিরা", "ধনিয়া"]],
    ["def_vegetable", ["সবজি", "শাক", "বেগুন", "টমেটো", "লাউ", "কুমড়া", "vegetable", "শসা", "কাঁচামরিচ"]],
    ["def_fish", ["মাছ", "fish", "ইলিশ", "রুই", "তেলাপিয়া", "চিংড়ি"]],
    ["def_meat", ["মাংস", "meat", "গরু", "খাসি", "মুরগি", "chicken", "beef"]],
    ["def_egg", ["ডিম", "egg"]],
    ["def_milk", ["দুধ", "milk", "দই"]],
    ["def_fruit", ["ফল", "fruit", "কলা", "আম", "আপেল", "কমলা", "পেঁপে"]],
    ["def_potato", ["আলু", "potato"]],
    ["def_onion", ["পেঁয়াজ", "piaj", "onion"]],
    ["def_garlic", ["রসুন", "garlic", "আদা"]],
    ["def_soap", ["সাবান", "soap", "শ্যাম্পু"]],
    ["def_detergent", ["ডিটারজেন্ট", "detergent", "সার্ফ", "ভিম"]],
    ["def_tissue", ["টিস্যু", "tissue"]],
    ["def_cleaning", ["ফিনাইল", "হারপিক", "cleaning", "ঝাড়ু"]],
  ];

  const UNITS = ["kg", "g", "L", "ml", "pcs", "হালি", "ডজন", "প্যাকেট"];

  const BUDGET_LEVELS = { ok: "ok", w80: "w80", w90: "w90", over: "over" };

  /* ------------------------------------------------------------------ *
   * small helpers
   * ------------------------------------------------------------------ */
  const BN2EN = { "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9" };
  // people on a Bangla keyboard type Bengali digits; accept them everywhere
  function parseNum(v) {
    if (typeof v === "number") return isFinite(v) ? v : NaN;
    if (v == null) return NaN;
    const s = String(v).replace(/[০-৯]/g, (d) => BN2EN[d]).replace(/[,\s৳]/g, "").replace("।", ".");
    if (s === "" || !/^-?\d*\.?\d*$/.test(s)) return NaN;
    return parseFloat(s);
  }
  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const pad2 = (n) => String(n).padStart(2, "0");

  function nameKey(s) {
    return String(s == null ? "" : s).normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
  }
  // short stable hash → base36 (FNV-1a, 32-bit). Used for deterministic ids.
  function hash36(s) {
    let h = 0x811c9dc5;
    const str = nameKey(s);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(36);
  }
  // same product name → same id, on every device, even created concurrently
  const productIdFor = (name) => "p_" + hash36(name);
  const locKey = (loc) => hash36(loc);
  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || "").trim());
  function randomId() {
    const a = "abcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < 16; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  }

  /* ---- dates (all "YYYY-MM-DD" strings in the user's local calendar) ---- */
  function ymdToDate(s) { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); }
  function dateToYmd(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
  function isValidYmd(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    return dateToYmd(ymdToDate(s)) === s;
  }
  function addDays(s, n) { const d = ymdToDate(s); d.setDate(d.getDate() + n); return dateToYmd(d); }
  const monthOf = (s) => String(s).slice(0, 7);
  function addMonths(m, n) {
    const [y, mo] = m.split("-").map(Number);
    const d = new Date(y, mo - 1 + n, 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  }
  function daysInMonth(m) { const [y, mo] = m.split("-").map(Number); return new Date(y, mo, 0).getDate(); }
  // weeks start on Saturday (Bangladesh convention)
  function weekStart(s) {
    const d = ymdToDate(s);
    d.setDate(d.getDate() - ((d.getDay() - 6 + 7) % 7));
    return dateToYmd(d);
  }
  function monthsBack(m, count) { const out = []; for (let i = count - 1; i >= 0; i--) out.push(addMonths(m, -i)); return out; }

  /* ------------------------------------------------------------------ *
   * permissions & roles
   * ------------------------------------------------------------------ */
  const isActive = (m) => !!m && (m.status || "active") === "active";
  const hasPerm = (m, key) => isActive(m) && !!m.permissions && m.permissions[key] === true;
  const isOwner = (m) => isActive(m) && m.role === "owner";
  const isOwnerOrAdmin = (m) => isActive(m) && (m.role === "owner" || m.role === "admin");
  // mirrors canManageMembers() in firestore.rules
  const canManageMembers = (m) => isOwnerOrAdmin(m) || hasPerm(m, "memberManagement");
  const canWritePurchases = (m) => isActive(m) && m.role !== "viewer";
  // what the rules allow `actor` to do to `target` — the UI hides buttons with
  // this, the rules re-check it on the server
  function canEditMember(actor, target) {
    if (!actor || !target || actor.uid === target.uid) return false;
    if (!canManageMembers(actor) || target.role === "owner") return false;
    if (target.role === "admin" && !isOwner(actor)) return false;
    return true;
  }
  function assignableRoles(actor) {
    return isOwner(actor) ? ["admin", "member", "viewer"] : ["member", "viewer"];
  }

  /* ------------------------------------------------------------------ *
   * categories & products
   * ------------------------------------------------------------------ */
  function allCategories(custom) {
    const cust = (custom || []).map((c) => ({ id: c.id, name: c.name, icon: c.icon || "🏷️", group: c.group || "grocery", custom: true }));
    return DEFAULT_CATEGORIES.concat(cust);
  }
  function categoryById(id, custom) {
    return allCategories(custom).find((c) => c.id === id) || null;
  }
  function guessCategoryId(productName, custom) {
    const k = nameKey(productName);
    if (!k) return null;
    for (const c of custom || []) if (nameKey(c.name) === k) return c.id;
    for (const [id, words] of CATEGORY_HINTS) {
      if (words.some((w) => k.includes(nameKey(w)))) return id;
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   * purchase validation & shaping
   * ------------------------------------------------------------------ */
  function calcLineTotal(qty, unitPrice) {
    const q = parseNum(qty), p = parseNum(unitPrice);
    return isNaN(q) || isNaN(p) ? 0 : round2(q * p);
  }
  function itemsTotal(items) { return round2((items || []).reduce((s, it) => s + (Number(it.total) || 0), 0)); }

  // draft rows come straight from the form (strings); returns cleaned items
  function validatePurchaseDraft(draft, today) {
    const errors = [];
    if (!isValidYmd(draft.date)) errors.push("সঠিক তারিখ দিন");
    else if (today && draft.date > today) errors.push("ভবিষ্যতের তারিখে বাজার যোগ করা যাবে না");
    const items = [];
    (draft.items || []).forEach((row, i) => {
      const empty = !String(row.productName || "").trim() && !String(row.quantity || "").trim() && !String(row.unitPrice || "").trim() && !String(row.total || "").trim();
      if (empty) return;
      const n = i + 1;
      const name = String(row.productName || "").trim();
      const qty = parseNum(row.quantity);
      let unitPrice = parseNum(row.unitPrice);
      let total = parseNum(row.total);
      if (!name) { errors.push(`${n} নম্বর পণ্যের নাম লিখুন`); return; }
      if (name.length > 80) { errors.push(`${n} নম্বর পণ্যের নাম অনেক বড়`); return; }
      if (isNaN(qty) || qty <= 0) { errors.push(`${n} নম্বর পণ্যের পরিমাণ ০-এর বেশি হতে হবে`); return; }
      if (isNaN(unitPrice) && isNaN(total)) { errors.push(`${n} নম্বর পণ্যের দাম দিন`); return; }
      if (isNaN(unitPrice)) unitPrice = round2(total / qty);
      if (unitPrice < 0 || (!isNaN(total) && total < 0)) { errors.push(`${n} নম্বর পণ্যের দাম ঋণাত্মক হতে পারে না`); return; }
      if (isNaN(total)) total = round2(qty * unitPrice);
      items.push({
        itemId: row.itemId || randomId(),
        // stable ids + name snapshots: history stays readable after renames/deletes
        productId: row.productId || productIdFor(name),
        productName: name,
        categoryId: row.categoryId || null,
        category: row.categoryName || null,
        quantity: round2(qty),
        unit: row.unit || "pcs",
        unitPrice: round2(unitPrice),
        total: round2(total),
      });
    });
    if (items.length === 0 && errors.length === 0) errors.push("অন্তত একটা পণ্য দিন");
    if (items.length > 40) errors.push("একবারে সর্বোচ্চ ৪০টি পণ্য যোগ করা যায়");
    return { ok: errors.length === 0, errors, items };
  }

  /* ------------------------------------------------------------------ *
   * statistics (monthly per-member aggregate documents)
   *
   * Firestore layout (see firestore.rules):
   *   memberMonthly/{uid}_{YYYY-MM}          → { memberId, month, total, count, days:{ "YYYY-MM-DD": amount } }
   *   memberCategoryMonthly/{uid}_{YYYY-MM}  → { memberId, month, categories:{ catId:{ name, total } } }
   * They are kept in step with purchases by *deltas* applied in the same
   * batch as the purchase write, so a dashboard read is a handful of tiny
   * documents instead of every purchase.
   * ------------------------------------------------------------------ */
  const catKeyOf = (it) => it.categoryId || "uncategorized";
  const catNameOf = (it) => it.category || "অন্যান্য";

  function statDeltas(oldP, newP) {
    const out = {};
    const slot = (m) => out[m] || (out[m] = { total: 0, count: 0, days: {}, cats: {} });
    const add = (p, sign) => {
      if (!p || !p.date) return;
      const o = slot(monthOf(p.date));
      const tot = itemsTotal(p.items);
      o.total += sign * tot;
      o.count += sign;
      o.days[p.date] = (o.days[p.date] || 0) + sign * tot;
      (p.items || []).forEach((it) => {
        const k = catKeyOf(it);
        const c = o.cats[k] || (o.cats[k] = { name: catNameOf(it), total: 0 });
        c.total += sign * (Number(it.total) || 0);
        c.name = catNameOf(it);
      });
    };
    add(oldP, -1);
    add(newP, 1);
    // drop entries that cancel out exactly (e.g. edit that only changed the note)
    Object.keys(out).forEach((m) => {
      const o = out[m];
      o.total = round2(o.total);
      Object.keys(o.days).forEach((d) => { o.days[d] = round2(o.days[d]); if (o.days[d] === 0) delete o.days[d]; });
      Object.keys(o.cats).forEach((k) => { o.cats[k].total = round2(o.cats[k].total); if (o.cats[k].total === 0) delete o.cats[k]; });
      if (o.total === 0 && o.count === 0 && !Object.keys(o.days).length && !Object.keys(o.cats).length) delete out[m];
    });
    return out;
  }

  // full rebuild from a list of purchases (own purchases) → per-month docs
  function buildStatsFromPurchases(purchases) {
    const acc = {};
    (purchases || []).forEach((p) => {
      const d = statDeltas(null, p);
      Object.keys(d).forEach((m) => {
        const a = acc[m] || (acc[m] = { total: 0, count: 0, days: {}, cats: {} });
        a.total += d[m].total; a.count += d[m].count;
        Object.keys(d[m].days).forEach((k) => (a.days[k] = (a.days[k] || 0) + d[m].days[k]));
        Object.keys(d[m].cats).forEach((k) => {
          const c = a.cats[k] || (a.cats[k] = { name: d[m].cats[k].name, total: 0 });
          c.total += d[m].cats[k].total;
        });
      });
    });
    Object.keys(acc).forEach((m) => {
      acc[m].total = round2(acc[m].total);
      Object.keys(acc[m].days).forEach((k) => (acc[m].days[k] = round2(acc[m].days[k])));
      Object.keys(acc[m].cats).forEach((k) => (acc[m].cats[k].total = round2(acc[m].cats[k].total)));
    });
    return acc;
  }

  function mergeDays(docs) {
    const map = {};
    (docs || []).forEach((d) => Object.entries(d.days || {}).forEach(([k, v]) => (map[k] = round2((map[k] || 0) + (Number(v) || 0)))));
    return map;
  }
  function sumRange(daysMap, from, to) {
    let s = 0;
    for (const k in daysMap) if (k >= from && k <= to) s += daysMap[k];
    return round2(s);
  }
  function periodTotals(docs, today) {
    const map = mergeDays(docs);
    const ws = weekStart(today);
    const m = monthOf(today), pm = addMonths(m, -1);
    return {
      today: sumRange(map, today, today),
      yesterday: sumRange(map, addDays(today, -1), addDays(today, -1)),
      thisWeek: sumRange(map, ws, today),
      prevWeek: sumRange(map, addDays(ws, -7), addDays(ws, -1)),
      thisMonth: sumRange(map, m + "-01", m + "-31"),
      prevMonth: sumRange(map, pm + "-01", pm + "-31"),
    };
  }
  function memberMonthTotals(docs, month) {
    const out = {};
    (docs || []).filter((d) => d.month === month).forEach((d) => {
      out[d.memberId] = round2((out[d.memberId] || 0) + sumRange(d.days || {}, month + "-01", month + "-31"));
    });
    return out;
  }
  function pctChange(cur, prev) {
    if (!prev || prev <= 0) return null;
    return Math.round(((cur - prev) / prev) * 100);
  }
  function categoryRows(catDocs, month, prevMonth) {
    const collect = (m) => {
      const map = {};
      (catDocs || []).filter((d) => d.month === m).forEach((d) => Object.entries(d.categories || {}).forEach(([k, v]) => {
        const c = map[k] || (map[k] = { name: v.name, total: 0 });
        c.total = round2(c.total + (Number(v.total) || 0));
        c.name = v.name || c.name;
      }));
      return map;
    };
    const cur = collect(month), prev = prevMonth ? collect(prevMonth) : {};
    const total = Object.values(cur).reduce((s, c) => s + Math.max(0, c.total), 0) || 0;
    return Object.entries(cur)
      .filter(([, c]) => c.total > 0)
      .map(([id, c]) => ({
        id, name: c.name, total: c.total,
        pct: total ? Math.round((c.total / total) * 100) : 0,
        prevTotal: prev[id] ? prev[id].total : 0,
        change: pctChange(c.total, prev[id] ? prev[id].total : 0),
      }))
      .sort((a, b) => b.total - a.total);
  }

  // chart series ------------------------------------------------------
  function dailySeries(docs, today, count) {
    const map = mergeDays(docs);
    const out = [];
    for (let i = count - 1; i >= 0; i--) { const d = addDays(today, -i); out.push({ key: d, value: map[d] || 0 }); }
    return out;
  }
  function weeklySeries(docs, today, count) {
    const map = mergeDays(docs);
    const ws = weekStart(today), out = [];
    for (let i = count - 1; i >= 0; i--) {
      const from = addDays(ws, -7 * i), to = addDays(from, 6);
      out.push({ key: from, value: sumRange(map, from, to) });
    }
    return out;
  }
  function monthlySeries(docs, today, count) {
    const map = mergeDays(docs);
    return monthsBack(monthOf(today), count).map((m) => ({ key: m, value: sumRange(map, m + "-01", m + "-31") }));
  }

  /* ---- budget ---- */
  function budgetStatus(amount, spent) {
    const a = Number(amount) || 0;
    if (a <= 0) return null;
    const raw = (spent / a) * 100;
    const pct = Math.round(raw);
    const level = raw >= 100 ? "over" : raw >= 90 ? "w90" : raw >= 80 ? "w80" : "ok";
    return { amount: a, spent: round2(spent), remaining: round2(Math.max(0, a - spent)), over: round2(Math.max(0, spent - a)), pct, level };
  }

  /* ---- estimation: deliberately conservative, always labelled as an estimate ---- */
  function estimateNext7(docs, today) {
    const map = mergeDays(docs);
    const weeks = [];
    let activeDays = 0;
    for (let k = 1; k <= 4; k++) {
      const from = addDays(today, -7 * k), to = addDays(today, -7 * (k - 1) - 1);
      weeks.push(sumRange(map, from, to));
      for (let i = 0; i < 7; i++) if ((map[addDays(from, i)] || 0) > 0) activeDays++;
    }
    const withData = weeks.filter((w) => w > 0);
    if (withData.length < 3 || activeDays < 6) return { ok: false, reason: "not-enough-data" };
    const mean = withData.reduce((s, v) => s + v, 0) / withData.length;
    const sd = Math.sqrt(withData.reduce((s, v) => s + (v - mean) * (v - mean), 0) / withData.length);
    const half = Math.max(sd * 0.5, mean * 0.08);
    const round50 = (n) => Math.round(n / 50) * 50;
    const low = Math.max(0, round50(mean - half)), high = Math.max(low + 50, round50(mean + half));
    return { ok: true, low, high, weeksUsed: withData.length };
  }

  /* ------------------------------------------------------------------ *
   * price history
   * ------------------------------------------------------------------ */
  function priceRowsFromPurchase(p, memberId) {
    if (p.trackPrice === false) return [];
    return (p.items || []).filter((it) => it.itemId && Number(it.unitPrice) > 0).map((it) => ({
      id: `${p.purchaseId}_${it.itemId}`,
      data: {
        productId: it.productId || productIdFor(it.productName), productName: it.productName,
        memberId, price: it.unitPrice, unit: it.unit || null, date: p.date, month: monthOf(p.date), purchaseId: p.purchaseId,
      },
    }));
  }
  function locationDocsFromPurchase(p, memberId) {
    if (p.trackPrice === false || !p.location || !String(p.location).trim()) return [];
    return (p.items || []).filter((it) => it.itemId && Number(it.unitPrice) > 0).map((it) => {
      const pid = it.productId || productIdFor(it.productName);
      return {
        id: `${pid}_${locKey(p.location)}_${hash36(it.unit || "")}`,
        data: {
          productId: pid, productName: it.productName, location: String(p.location).trim(), market: p.market || null,
          price: it.unitPrice, unit: it.unit || null, date: p.date, memberId, purchaseId: p.purchaseId, itemId: it.itemId,
        },
      };
    });
  }

  function sortPriceRows(rows) {
    return rows.filter((r) => typeof r.price === "number" && r.date)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0) || String(a.id || "").localeCompare(String(b.id || "")));
  }

  function analyzePrices(rows, today) {
    const sorted = sortPriceRows(rows || []);
    if (!sorted.length) return null;
    const unit = sorted[sorted.length - 1].unit || "";
    const same = sorted.filter((r) => (r.unit || "") === unit);
    const latest = same[same.length - 1];
    const previous = same.length > 1 ? same[same.length - 2] : null;
    const prices = same.map((r) => r.price);
    const avgOf = (arr) => (arr.length ? round2(arr.reduce((s, r) => s + r.price, 0) / arr.length) : null);
    const on = (ymd) => { let f = null; for (const r of same) if (r.date <= ymd) f = r; return f; };
    const p7 = on(addDays(today, -7)), p30 = on(addDays(today, -30));
    const cm = monthOf(today), pm = addMonths(cm, -1);
    const curMonthRows = same.filter((r) => monthOf(r.date) === cm);
    const prevMonthRows = same.filter((r) => monthOf(r.date) === pm);
    return {
      unit, count: same.length, otherUnitCount: sorted.length - same.length,
      latest, previous,
      avg: avgOf(same), min: Math.min(...prices), max: Math.max(...prices),
      price7dAgo: p7 ? p7.price : null,
      price30dAgo: p30 ? p30.price : null,
      change30: p30 ? round2(latest.price - p30.price) : null,
      changeVsPrevious: previous ? round2(latest.price - previous.price) : null,
      curMonthAvg: avgOf(curMonthRows), prevMonthAvg: avgOf(prevMonthRows),
      series7: same.filter((r) => r.date >= addDays(today, -7)),
      series30: same.filter((r) => r.date >= addDays(today, -30)),
      seriesAll: same,
    };
  }

  // products whose latest recorded price differs from the one before it
  function priceMovers(rows, minPct) {
    const groups = {};
    sortPriceRows(rows || []).forEach((r) => {
      const k = (r.productId || nameKey(r.productName)) + "|" + (r.unit || "");
      (groups[k] || (groups[k] = [])).push(r);
    });
    const out = [];
    Object.values(groups).forEach((g) => {
      if (g.length < 2) return;
      const latest = g[g.length - 1], prev = g[g.length - 2];
      if (!(prev.price > 0)) return;
      const pct = ((latest.price - prev.price) / prev.price) * 100;
      if (Math.abs(pct) < (minPct == null ? 3 : minPct)) return;
      out.push({ productId: latest.productId || null, productName: latest.productName, unit: latest.unit || "", latest: latest.price, previous: prev.price, pct: Math.round(pct), date: latest.date });
    });
    return out.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  }

  function locationComparison(locRows) {
    const byLoc = {};
    (locRows || []).forEach((r) => {
      const k = nameKey(r.location) + "|" + (r.unit || "");
      if (!byLoc[k] || r.date >= byLoc[k].date) byLoc[k] = r;
    });
    return Object.values(byLoc).sort((a, b) => a.price - b.price);
  }

  /* ---- search (client-side, over whatever the caller is allowed to see) ---- */
  function matches(text, q) { return nameKey(text).includes(nameKey(q)); }

  /* ------------------------------------------------------------------ *
   * purchase write plan
   *
   * Everything a purchase create / edit / delete has to touch, computed as
   * plain data so it can be unit-tested without Firebase. firebase-init.js
   * executes the plan in ONE atomic batch (except `locationSet` /
   * `locationRelease`, which are best-effort because their doc ids are
   * shared by all members). Numeric deltas are { $inc: n } markers that
   * firebase-init turns into increment().
   * ------------------------------------------------------------------ */
  const INC = (n) => ({ $inc: round2(n) });

  function buildPurchase(o) {
    const items = o.items || [];
    const now = o.now || Date.now();
    return {
      purchaseId: o.purchaseId || randomId(),
      memberId: o.memberId,
      memberName: o.memberName || "",
      date: o.date,
      month: monthOf(o.date),
      market: String(o.market || "").trim(),
      location: String(o.location || "").trim(),
      note: String(o.note || "").trim(),
      trackPrice: o.trackPrice !== false,
      items,
      total: itemsTotal(items),
      createdAt: o.createdAt || now,
      updatedAt: now,
    };
  }

  function planPurchaseChange(oldP, newP, memberId) {
    const ref = newP || oldP;
    const deltas = statDeltas(oldP, newP);
    const monthly = [], categories = [];
    Object.keys(deltas).forEach((m) => {
      const d = deltas[m];
      const id = `${memberId}_${m}`;
      const days = {};
      Object.keys(d.days).forEach((k) => (days[k] = INC(d.days[k])));
      monthly.push({ id, data: { memberId, month: m, total: INC(d.total), count: INC(d.count), days } });
      const cats = {};
      Object.keys(d.cats).forEach((k) => (cats[k] = { name: d.cats[k].name, total: INC(d.cats[k].total) }));
      if (Object.keys(cats).length) categories.push({ id, data: { memberId, month: m, categories: cats } });
    });
    const newPrice = newP ? priceRowsFromPurchase(newP, memberId) : [];
    const oldPrice = oldP ? priceRowsFromPurchase(oldP, memberId) : [];
    const keep = new Set(newPrice.map((r) => r.id));
    const newLoc = newP ? locationDocsFromPurchase(newP, memberId) : [];
    const oldLoc = oldP ? locationDocsFromPurchase(oldP, memberId) : [];
    const keepLoc = new Set(newLoc.map((r) => r.id));
    const products = newP ? (newP.items || []).map((it) => ({
      id: it.productId || productIdFor(it.productName),
      data: { name: it.productName, categoryId: it.categoryId || null, category: it.category || null, defaultUnit: it.unit || null },
    })) : [];
    return {
      purchaseId: ref.purchaseId,
      monthly, categories,
      priceSet: newPrice, priceDelete: oldPrice.map((r) => r.id).filter((id) => !keep.has(id)),
      locationSet: newLoc, locationRelease: oldLoc.map((r) => r.id).filter((id) => !keepLoc.has(id)),
      products,
    };
  }

  // the most serious budget threshold that spending crossed going from
  // `before` to `after` (null when nothing new was crossed)
  function budgetCrossing(amount, before, after) {
    const b = budgetStatus(amount, before), a = budgetStatus(amount, after);
    if (!a) return null;
    const rank = { ok: 0, w80: 1, w90: 2, over: 3 };
    const prev = b ? rank[b.level] : 0;
    return rank[a.level] > prev ? a.level : null;
  }

  // may `actor` hand out exactly `perms`? A manager can never grant a
  // permission they don't hold themselves (mirrors canGrant() in the rules)
  function canGrant(actor, perms) {
    if (isOwner(actor)) return true;
    return PERMISSION_KEYS.every((k) => !(perms && perms[k] === true) || hasPerm(actor, k));
  }

  // shape of a member's visibility, used by every screen
  function visibilityFor(member) {
    const owner = isOwner(member);
    const can = (k) => owner || hasPerm(member, k);
    return {
      totals: can("monthlyTotal"), categories: can("categorySummary"), details: can("purchaseDetails"),
      prices: can("priceHistory"), locations: can("locationComparison"), reports: can("reports"),
      manage: canManageMembers(member), write: canWritePurchases(member), admin: isOwnerOrAdmin(member), owner,
    };
  }

  /* ------------------------------------------------------------------ *
   * invitations
   * ------------------------------------------------------------------ */
  function inviteState(inv, now) {
    if (!inv) return "expired";
    if (inv.status !== "pending") return inv.status;
    return inv.expiresAt && inv.expiresAt <= (now || Date.now()) ? "expired" : "pending";
  }
  const INVITE_STATUS_LABEL = { pending: "অপেক্ষমাণ", accepted: "গৃহীত", rejected: "প্রত্যাখ্যাত", expired: "মেয়াদ শেষ", cancelled: "বাতিল" };

  return {
    RELATIONS, INVITE_RELATIONS, ROLES, INVITABLE_ROLES, PERMISSIONS, PERMISSION_KEYS, DEFAULT_CATEGORIES, CATEGORY_GROUPS, UNITS, BUDGET_LEVELS, INVITE_STATUS_LABEL,
    permissionPreset, normalizePermissions,
    parseNum, round2, nameKey, hash36, productIdFor, locKey, isValidEmail, randomId,
    ymdToDate, dateToYmd, isValidYmd, addDays, monthOf, addMonths, daysInMonth, weekStart, monthsBack,
    isActive, hasPerm, isOwner, isOwnerOrAdmin, canManageMembers, canWritePurchases, canEditMember, assignableRoles,
    allCategories, categoryById, guessCategoryId,
    calcLineTotal, itemsTotal, validatePurchaseDraft,
    statDeltas, buildStatsFromPurchases, mergeDays, sumRange, periodTotals, memberMonthTotals, pctChange, categoryRows,
    dailySeries, weeklySeries, monthlySeries, budgetStatus, estimateNext7,
    priceRowsFromPurchase, locationDocsFromPurchase, sortPriceRows, analyzePrices, priceMovers, locationComparison, matches,
    inviteState,
    buildPurchase, planPurchaseChange, budgetCrossing, canGrant, visibilityFor,
  };
});
