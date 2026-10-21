// হিসাব-খাতা — ফ্যামিলি বাজার তালিকা (Family Shopping List): pure logic core.
//
// No React, no Firebase, no DOM — data in, data out (same discipline as
// family-bazar-core.js / family-planning-core.js; unit-tested in
// tests/family-shopping.test.js). Classic <script>; exposes window.FSCore
// (and module.exports under Node).
//
// একজন সদস্য তালিকা বানান, আরেকজন (বা একই জন) বাজার করেন: প্রতিটি পণ্যের অবস্থা,
// প্রকৃত দাম/পরিমাণ, বিকল্প পণ্য ও মন্তব্য আপডেট হয়; আনুমানিক ও প্রকৃত খরচ আলাদা থাকে।
// Roles/permissions এখানে নতুন করে বানানো হয়নি — family-bazar-core.js-এর member
// (owner/admin/member/viewer, status active) ব্যবহার করা হয়।
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FSCore = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  /* ------------------------------ small helpers ------------------------------ */
  const BN2EN = { "\u09e6": "0", "\u09e7": "1", "\u09e8": "2", "\u09e9": "3", "\u09ea": "4", "\u09eb": "5", "\u09ec": "6", "\u09ed": "7", "\u09ee": "8", "\u09ef": "9" };
  // "" / null / garbage -> NaN  (a blank box is NEVER silently turned into 0)
  function parseNum(v) {
    if (typeof v === "number") return isFinite(v) ? v : NaN;
    if (v == null) return NaN;
    const s = String(v).replace(/[\u09e6-\u09ef]/g, (d) => BN2EN[d]).replace(/[,\s\u09f3]/g, "").replace("\u0964", ".");
    if (s === "" || !/^-?\d*\.?\d*$/.test(s) || s === "." || s === "-") return NaN;
    return parseFloat(s);
  }
  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  // quantities may be fractional (০.৫ কেজি) -> keep up to 3 decimals
  const round3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
  function randomId() {
    const a = "abcdefghijklmnopqrstuvwxyz0123456789"; let s = "";
    for (let i = 0; i < 16; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  }
  function isValidYmd(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + "T00:00:00Z");
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  }
  const isBlank = (v) => v == null || String(v).trim() === "";

  /* --------------------------------- statuses --------------------------------- */
  const ITEM_STATUS = ["pending", "bought", "not_found", "too_expensive", "alternative", "awaiting", "cancelled"];
  const ITEM_STATUS_LABEL = {
    pending: "কেনা বাকি", bought: "কেনা হয়েছে", not_found: "বাজারে পাওয়া যায়নি", too_expensive: "দাম বেশি",
    alternative: "বিকল্প পণ্য কেনা হয়েছে", awaiting: "ক্রেতার মন্তব্যের অপেক্ষায়", cancelled: "বাতিল",
  };
  // the statuses the shopper may choose (cancelled is a manager-only decision)
  const SHOPPER_STATUSES = ["pending", "bought", "not_found", "too_expensive", "alternative", "awaiting"];
  // semantic colour token per status (the UI maps tone -> --hk-* css variable)
  const ITEM_STATUS_TONE = { pending: "muted", bought: "success", not_found: "danger", too_expensive: "warn", alternative: "info", awaiting: "gold", cancelled: "muted" };
  const LIST_STATUS = ["in_progress", "partial", "completed"];
  const LIST_STATUS_LABEL = { in_progress: "চলমান", partial: "আংশিক সম্পন্ন", completed: "সম্পন্ন" };
  const UNITS = ["kg", "g", "L", "ml", "pcs", "\u09b9\u09be\u09b2\u09bf", "\u09a1\u099c\u09a8", "\u09aa\u09cd\u09af\u09be\u0995\u09c7\u099f"];

  /* ---------------------------- constructors / validation ---------------------------- */
  function blankItemDraft() { return { id: randomId(), name: "", categoryId: "", quantity: "", unit: "kg", estUnitPrice: "", note: "" }; }

  // form strings -> a clean item, or per-field errors. Name + category + unit are
  // required; quantity and estimated price are optional but, when typed, must be valid.
  function validateItemDraft(d) {
    const errors = {};
    const name = String((d && d.name) || "").trim();
    if (!name) errors.name = "পণ্যের নাম লিখুন";
    else if (name.length > 60) errors.name = "নাম ৬০ অক্ষরের মধ্যে রাখুন";
    if (!d || !d.categoryId) errors.categoryId = "ক্যাটাগরি বেছে নিন";
    if (!d || !d.unit) errors.unit = "একক বেছে নিন";
    let quantity = null;
    if (!isBlank(d && d.quantity)) { quantity = parseNum(d.quantity); if (isNaN(quantity) || quantity <= 0) errors.quantity = "পরিমাণ সঠিক নয়"; else quantity = round3(quantity); }
    let estUnitPrice = null;
    if (!isBlank(d && d.estUnitPrice)) { estUnitPrice = parseNum(d.estUnitPrice); if (isNaN(estUnitPrice) || estUnitPrice < 0) errors.estUnitPrice = "দাম সঠিক নয়"; else estUnitPrice = round2(estUnitPrice); }
    const note = String((d && d.note) || "").trim().slice(0, 200);
    if (Object.keys(errors).length) return { ok: false, errors };
    return { ok: true, errors, item: item({ id: d.id, name, categoryId: d.categoryId, quantity, unit: d.unit, estUnitPrice, note }) };
  }
  function item(p) {
    return {
      id: p.id || randomId(), name: p.name, categoryId: p.categoryId, quantity: p.quantity == null ? null : p.quantity, unit: p.unit,
      estUnitPrice: p.estUnitPrice == null ? null : p.estUnitPrice, actualUnitPrice: null, actualQuantity: null,
      status: "pending", alternative: null, note: p.note || "", reason: "", updatedBy: null, updatedAt: null,
    };
  }

  // list header form -> clean list fields, or errors
  function validateListDraft(d) {
    const errors = {};
    const title = String((d && d.title) || "").trim();
    if (!title) errors.title = "তালিকার নাম লিখুন"; else if (title.length > 60) errors.title = "নাম ৬০ অক্ষরের মধ্যে রাখুন";
    if (!d || !isValidYmd(d.shoppingDate)) errors.shoppingDate = "বাজারের তারিখ সঠিক নয়";
    if (!d || !d.assignedToUid) errors.assignedToUid = "বাজার করার সদস্য বেছে নিন";
    const time = String((d && d.shoppingTime) || "").trim();
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) errors.shoppingTime = "সময় সঠিক নয়";
    if (Object.keys(errors).length) return { ok: false, errors };
    return { ok: true, errors, fields: { title, shoppingDate: d.shoppingDate, shoppingTime: time || null, assignedToUid: d.assignedToUid, note: String(d.note || "").trim().slice(0, 300) } };
  }
  function buildList(p) {
    const now = p.now || new Date().toISOString();
    return {
      id: p.id || randomId(), familyId: p.familyId, title: p.title, shoppingDate: p.shoppingDate, shoppingTime: p.shoppingTime || null,
      note: p.note || "", createdBy: p.createdBy, createdByName: p.createdByName || "", assignedToUid: p.assignedToUid, assignedToName: p.assignedToName || "",
      status: "in_progress", stats: listStats(p.items || []), createdAt: now, updatedAt: now, completedAt: null, completedBy: null,
      copiedFrom: p.copiedFrom || null,
    };
  }

  /* --------------------------- status update (shopper) --------------------------- */
  // input: { status, actualUnitPrice, actualQuantity, reason, alternative:{name,quantity,unitPrice} }
  // returns { ok, errors, patch } — patch holds only the item fields that change
  function validateStatusUpdate(it, input, opts) {
    const errors = {}; const status = input && input.status;
    const manager = !!(opts && opts.manager);
    if (!ITEM_STATUS.includes(status)) return { ok: false, errors: { status: "অবস্থা বেছে নিন" } };
    if (status === "cancelled" && !manager) return { ok: false, errors: { status: "পণ্য বাতিল করার অনুমতি নেই" } };
    const reason = String((input && input.reason) || "").trim().slice(0, 300);
    if (status === "cancelled" && !reason) errors.reason = "বাতিলের কারণ লিখুন";
    const patch = { status, reason, actualUnitPrice: null, actualQuantity: null, alternative: null };
    if (status === "bought") {
      if (!isBlank(input.actualUnitPrice)) { const p = parseNum(input.actualUnitPrice); if (isNaN(p) || p < 0) errors.actualUnitPrice = "প্রকৃত দাম সঠিক নয়"; else patch.actualUnitPrice = round2(p); }
      if (!isBlank(input.actualQuantity)) { const q = parseNum(input.actualQuantity); if (isNaN(q) || q <= 0) errors.actualQuantity = "কেনা পরিমাণ সঠিক নয়"; else patch.actualQuantity = round3(q); }
    }
    if (status === "alternative") {
      const a = (input && input.alternative) || {}; const nm = String(a.name || "").trim();
      if (!nm) errors.altName = "বিকল্প পণ্যের নাম লিখুন";
      let aq = null, ap = null;
      if (!isBlank(a.quantity)) { aq = parseNum(a.quantity); if (isNaN(aq) || aq <= 0) errors.altQuantity = "বিকল্প পণ্যের পরিমাণ সঠিক নয়"; else aq = round3(aq); }
      if (!isBlank(a.unitPrice)) { ap = parseNum(a.unitPrice); if (isNaN(ap) || ap < 0) errors.altUnitPrice = "বিকল্প পণ্যের দাম সঠিক নয়"; else ap = round2(ap); }
      patch.alternative = { name: nm.slice(0, 60), quantity: aq, unit: String(a.unit || it.unit || ""), unitPrice: ap };
    }
    if (Object.keys(errors).length) return { ok: false, errors };
    return { ok: true, errors, patch };
  }

  /* --------------------------------- money --------------------------------- */
  const estLineTotal = (it) => (it.quantity != null && it.estUnitPrice != null ? round2(it.quantity * it.estUnitPrice) : null);
  const boughtQty = (it) => (it.actualQuantity != null ? it.actualQuantity : it.quantity);
  // actual money spent on one line; null = "price not entered yet" (never counted as 0)
  function actualLineTotal(it) {
    if (it.status === "bought") { const q = boughtQty(it); return it.actualUnitPrice != null && q != null ? round2(it.actualUnitPrice * q) : null; }
    if (it.status === "alternative") { const a = it.alternative; return a && a.unitPrice != null && a.quantity != null ? round2(a.unitPrice * a.quantity) : null; }
    return null;
  }
  const isPurchased = (it) => it.status === "bought" || it.status === "alternative";
  const needsPrice = (it) => isPurchased(it) && actualLineTotal(it) === null;

  // everything the summary screens show (denormalised onto the list doc as `stats`)
  function listStats(items) {
    const s = { total: 0, bought: 0, alternative: 0, pending: 0, awaiting: 0, notFound: 0, tooExpensive: 0, cancelled: 0, incompletePrice: 0, estTotal: 0, actualTotal: 0 };
    (items || []).forEach((it) => {
      if (it.status === "cancelled") { s.cancelled++; return; }
      s.total++;
      if (it.status === "bought") s.bought++;
      else if (it.status === "alternative") s.alternative++;
      else if (it.status === "not_found") s.notFound++;
      else if (it.status === "too_expensive") s.tooExpensive++;
      else if (it.status === "awaiting") s.awaiting++;
      else s.pending++;
      const e = estLineTotal(it); if (e !== null) s.estTotal += e;
      if (isPurchased(it)) { const a = actualLineTotal(it); if (a === null) s.incompletePrice++; else s.actualTotal += a; }
    });
    s.estTotal = round2(s.estTotal); s.actualTotal = round2(s.actualTotal);
    s.purchased = s.bought + s.alternative; s.undecided = s.pending + s.awaiting;
    return s;
  }
  const progressPct = (st) => (st && st.total > 0 ? Math.round((st.purchased / st.total) * 100) : 0);
  // completing with undecided items = "আংশিক সম্পন্ন"; everything decided = "সম্পন্ন"
  const completionStatus = (st) => (st.undecided > 0 ? "partial" : "completed");

  /* ------------------------------- permissions ------------------------------- */
  // member = a family member doc ({status, role, ...}) — same shape family-bazar-core.js uses
  const active = (m) => !!m && m.status === "active";
  const canWrite = (m) => active(m) && m.role !== "viewer";
  const isAdminRole = (m) => active(m) && (m.role === "owner" || m.role === "admin");
  const canCreateList = (m) => canWrite(m);
  const isManager = (list, m, uid) => canWrite(m) && !!list && (list.createdBy === uid || isAdminRole(m));
  const isShopper = (list, m, uid) => canWrite(m) && !!list && list.assignedToUid === uid;
  const isOpen = (list) => !!list && list.status === "in_progress";
  // may edit the list header / add or edit products / cancel a product
  const canEditStructure = (list, m, uid) => isOpen(list) && isManager(list, m, uid);
  // may change a product's status, price, quantity, note, alternative
  const canShop = (list, m, uid) => isOpen(list) && (isShopper(list, m, uid) || isManager(list, m, uid));
  // may delete the whole list: its creator or an owner/admin; a finished list only by owner/admin
  function canDeleteList(list, m, uid) {
    if (!list || !canWrite(m)) return false;
    if (list.status !== "in_progress") return isAdminRole(m);
    return list.createdBy === uid || isAdminRole(m);
  }
  const canReopen = (list, m) => !!list && list.status !== "in_progress" && isAdminRole(m);

  /* ------------------------------ history / reuse ------------------------------ */
  // "আগের তালিকা থেকে নতুন": opts { copyProducts, copyQtyPrice, newTitle }
  function copyDraft(list, items, opts) {
    const o = Object.assign({ copyProducts: true, copyQtyPrice: true, newTitle: "" }, opts || {});
    const rows = !o.copyProducts ? [] : (items || []).filter((it) => it.status !== "cancelled").map((it) => ({
      id: randomId(), name: it.name, categoryId: it.categoryId, unit: it.unit, note: it.note || "",
      quantity: o.copyQtyPrice && it.quantity != null ? String(it.quantity) : "",
      estUnitPrice: o.copyQtyPrice && it.estUnitPrice != null ? String(it.estUnitPrice) : "",
    }));
    return { title: String(o.newTitle || "").trim() || list.title, note: "", assignedToUid: list.assignedToUid, rows, copiedFrom: list.id };
  }
  // purchased lines -> rows for the existing Family Bazar purchase form (seed)
  function purchaseSeed(items) {
    return (items || []).filter(isPurchased).map((it) => it.status === "alternative"
      ? { name: it.alternative.name, categoryId: it.categoryId, quantity: it.alternative.quantity, unit: it.alternative.unit || it.unit, unitPrice: it.alternative.unitPrice }
      : { name: it.name, categoryId: it.categoryId, quantity: boughtQty(it), unit: it.unit, unitPrice: it.actualUnitPrice });
  }
  const sortNewest = (lists) => (lists || []).slice().sort((a, b) => String(b.shoppingDate || "").localeCompare(String(a.shoppingDate || "")) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const filterLists = (lists, tab) => sortNewest(lists).filter((l) => (tab === "history" ? l.status !== "in_progress" : l.status === "in_progress"));
  const pendingForShopper = (lists, uid) => (lists || []).filter((l) => l.status === "in_progress" && l.assignedToUid === uid).length;

  return {
    ITEM_STATUS, ITEM_STATUS_LABEL, ITEM_STATUS_TONE, SHOPPER_STATUSES, LIST_STATUS, LIST_STATUS_LABEL, UNITS,
    parseNum, round2, randomId, isValidYmd,
    blankItemDraft, validateItemDraft, item, validateListDraft, buildList, validateStatusUpdate,
    estLineTotal, boughtQty, actualLineTotal, isPurchased, needsPrice, listStats, progressPct, completionStatus,
    canCreateList, isManager, isShopper, canEditStructure, canShop, canDeleteList, canReopen, isOpen,
    copyDraft, purchaseSeed, sortNewest, filterLists, pendingForShopper,
  };
});
