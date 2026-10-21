// Run: node tests/family-shopping.test.js
"use strict";
const assert = require("assert");
const C = require("../js/family/family-shopping-core.js");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  \u2713", name); } catch (e) { console.error("  \u2717", name, "\n   ", e.message); process.exitCode = 1; } };
const draft = (o) => Object.assign({ id: "i1", name: "চাল", categoryId: "def_rice", quantity: "5", unit: "kg", estUnitPrice: "70", note: "" }, o);
const mk = (o) => C.validateItemDraft(draft(o)).item;

console.log("number parsing — a blank box is never silently 0");
t("blank, spaces and junk are NaN (not 0)", () => { ["", "  ", null, undefined, "abc", "."].forEach((v) => assert(isNaN(C.parseNum(v)), JSON.stringify(v))); });
t("Bengali digits, commas and ৳ are understood", () => { assert.strictEqual(C.parseNum("১২৫.৫"), 125.5); assert.strictEqual(C.parseNum("১,২০০"), 1200); assert.strictEqual(C.parseNum("৳৭০"), 70); });

console.log("product form validation (spec §4)");
t("name, category and unit are required — nothing incomplete is accepted", () => {
  const r = C.validateItemDraft(draft({ name: " ", categoryId: "", unit: "" }));
  assert(!r.ok); assert(r.errors.name && r.errors.categoryId && r.errors.unit);
});
t("quantity and estimated price are optional; blank stays null, never 0", () => {
  const r = C.validateItemDraft(draft({ quantity: "", estUnitPrice: "" }));
  assert(r.ok); assert.strictEqual(r.item.quantity, null); assert.strictEqual(r.item.estUnitPrice, null);
});
t("typed quantity/price must be valid (0 or negative quantity, negative or text price rejected)", () => {
  assert(C.validateItemDraft(draft({ quantity: "0" })).errors.quantity);
  assert(C.validateItemDraft(draft({ quantity: "-2" })).errors.quantity);
  assert(C.validateItemDraft(draft({ estUnitPrice: "abc" })).errors.estUnitPrice);
  assert(C.validateItemDraft(draft({ estUnitPrice: "-5" })).errors.estUnitPrice);
  assert(C.validateItemDraft(draft({ estUnitPrice: "0" })).ok, "a free item (price 0) is a real, valid value");
});
t("a new item starts as কেনা বাকি with no actual price/quantity", () => {
  const it = mk({}); assert.strictEqual(it.status, "pending"); assert.strictEqual(it.actualUnitPrice, null); assert.strictEqual(it.actualQuantity, null); assert.strictEqual(it.alternative, null);
});

console.log("money (spec §8)");
t("estimated line = quantity × estimated unit price; unknown if either is missing", () => {
  assert.strictEqual(C.estLineTotal(mk({})), 350);
  assert.strictEqual(C.estLineTotal(mk({ quantity: "" })), null);
  assert.strictEqual(C.estLineTotal(mk({ estUnitPrice: "" })), null);
});
t("decimals and fractions are exact (০.৫ কেজি × ১৩০, ১.২৫ × ৮০, ৩ × ৩৩.৩৩)", () => {
  const bought = (q, up, aq) => Object.assign(mk({ quantity: q }), { status: "bought", actualUnitPrice: up, actualQuantity: aq });
  assert.strictEqual(C.actualLineTotal(bought("0.5", 130, null)), 65);
  assert.strictEqual(C.actualLineTotal(bought("1.25", 80, null)), 100);
  assert.strictEqual(C.actualLineTotal(bought("3", 33.33, null)), 99.99);
});
t("actual total = actual unit price × bought quantity (bought quantity overrides the planned one)", () => {
  const it = Object.assign(mk({ quantity: "5" }), { status: "bought", actualUnitPrice: 68, actualQuantity: 4 });
  assert.strictEqual(C.actualLineTotal(it), 272);
});
t("a bought item without a price has NO actual total and is flagged incomplete", () => {
  const it = Object.assign(mk({}), { status: "bought" });
  assert.strictEqual(C.actualLineTotal(it), null); assert(C.needsPrice(it));
});
t("only purchased items have an actual total", () => {
  ["pending", "not_found", "too_expensive", "awaiting", "cancelled"].forEach((s) => assert.strictEqual(C.actualLineTotal(Object.assign(mk({}), { status: s, actualUnitPrice: 99 })), null, s));
});
t("an alternative product uses ITS name/quantity/price, not the original's", () => {
  const it = Object.assign(mk({ name: "মাছ" }), { status: "alternative", alternative: { name: "ইলিশ", quantity: 1, unit: "kg", unitPrice: 280 } });
  assert.strictEqual(C.actualLineTotal(it), 280);
  assert.deepStrictEqual(C.purchaseSeed([it]).map((r) => [r.name, r.quantity, r.unitPrice]), [["ইলিশ", 1, 280]]);
});

console.log("summary & progress (spec §8–9)");
t("listStats counts every state and keeps estimated vs actual apart", () => {
  const a = Object.assign(mk({ id: "a", quantity: "5", estUnitPrice: "70" }), { status: "bought", actualUnitPrice: 68 });         // est 350 · actual 340
  const b = Object.assign(mk({ id: "b", name: "আলু", quantity: "2", estUnitPrice: "30" }), { status: "bought" });                    // est 60 · NO price
  const c = Object.assign(mk({ id: "c", name: "মাছ", quantity: "1", estUnitPrice: "250" }), { status: "not_found" });               // est 250
  const d = mk({ id: "d", name: "ডিম", quantity: "12", unit: "pcs", estUnitPrice: "12" });                                           // pending est 144
  const e = Object.assign(mk({ id: "e", name: "তেল" }), { status: "cancelled" });
  const s = C.listStats([a, b, c, d, e]);
  assert.strictEqual(s.total, 4, "cancelled items are not part of the total"); assert.strictEqual(s.cancelled, 1);
  assert.strictEqual(s.bought, 2); assert.strictEqual(s.notFound, 1); assert.strictEqual(s.pending, 1);
  assert.strictEqual(s.estTotal, 350 + 60 + 250 + 144);
  assert.strictEqual(s.actualTotal, 340, "the item without a price is NOT in the actual total");
  assert.strictEqual(s.incompletePrice, 1); assert.strictEqual(s.undecided, 1); assert.strictEqual(C.progressPct(s), 50);
});
t("an empty list has 0% progress (no divide-by-zero)", () => { const s = C.listStats([]); assert.strictEqual(s.total, 0); assert.strictEqual(C.progressPct(s), 0); });
t("finishing with undecided items = আংশিক সম্পন্ন, everything decided = সম্পন্ন", () => {
  const pend = mk({}); const done = Object.assign(mk({}), { status: "not_found" });
  assert.strictEqual(C.completionStatus(C.listStats([pend, done])), "partial");
  assert.strictEqual(C.completionStatus(C.listStats([done])), "completed");
  const waiting = Object.assign(mk({}), { status: "awaiting" });
  assert.strictEqual(C.completionStatus(C.listStats([waiting])), "partial", "waiting for the creator's reply is still undecided");
});

console.log("status update by the shopper (spec §6)");
t("কেনা হয়েছে may be saved with or without the price; a bad price is rejected", () => {
  const it = mk({});
  const ok = C.validateStatusUpdate(it, { status: "bought", actualUnitPrice: "65", actualQuantity: "" }); assert(ok.ok); assert.strictEqual(ok.patch.actualUnitPrice, 65); assert.strictEqual(ok.patch.actualQuantity, null);
  assert(C.validateStatusUpdate(it, { status: "bought", actualUnitPrice: "" }).ok);
  assert(C.validateStatusUpdate(it, { status: "bought", actualUnitPrice: "x" }).errors.actualUnitPrice);
  assert(C.validateStatusUpdate(it, { status: "bought", actualQuantity: "0" }).errors.actualQuantity);
});
t("পাওয়া যায়নি / দাম বেশি keep the reason; price fields are cleared", () => {
  const r = C.validateStatusUpdate(mk({}), { status: "not_found", reason: "আজকে বাজারে মাছ ছিল না।", actualUnitPrice: "99" });
  assert(r.ok); assert.strictEqual(r.patch.reason, "আজকে বাজারে মাছ ছিল না।"); assert.strictEqual(r.patch.actualUnitPrice, null);
});
t("বিকল্প পণ্য needs a name; its quantity and price are saved", () => {
  assert(C.validateStatusUpdate(mk({}), { status: "alternative", alternative: { name: " " } }).errors.altName);
  const r = C.validateStatusUpdate(mk({}), { status: "alternative", alternative: { name: "ইলিশ", quantity: "1", unitPrice: "280" } });
  assert(r.ok); assert.deepStrictEqual([r.patch.alternative.name, r.patch.alternative.quantity, r.patch.alternative.unitPrice], ["ইলিশ", 1, 280]);
});
t("only a manager can cancel a product, and a reason is mandatory", () => {
  assert(!C.validateStatusUpdate(mk({}), { status: "cancelled", reason: "x" }, { manager: false }).ok);
  assert(C.validateStatusUpdate(mk({}), { status: "cancelled", reason: "" }, { manager: true }).errors.reason);
  assert(C.validateStatusUpdate(mk({}), { status: "cancelled", reason: "আর লাগবে না" }, { manager: true }).ok);
});
t("an unknown status is rejected", () => { assert(!C.validateStatusUpdate(mk({}), { status: "hacked" }).ok); });

console.log("list form validation (spec §3)");
t("title, valid date and a shopper are required; time is optional but must look like HH:MM", () => {
  const bad = C.validateListDraft({ title: " ", shoppingDate: "2026-02-31", assignedToUid: "" });
  assert(!bad.ok); assert(bad.errors.title && bad.errors.shoppingDate && bad.errors.assignedToUid);
  assert(C.validateListDraft({ title: "x", shoppingDate: "2026-10-16", assignedToUid: "u2", shoppingTime: "25:00" }).errors.shoppingTime);
  const ok = C.validateListDraft({ title: " আজকের বাজার ", shoppingDate: "2026-10-16", assignedToUid: "u2", shoppingTime: "" });
  assert(ok.ok); assert.strictEqual(ok.fields.title, "আজকের বাজার"); assert.strictEqual(ok.fields.shoppingTime, null);
});
t("buildList: starts চলমান with zeroed stats, creator and shopper recorded", () => {
  const l = C.buildList({ familyId: "f1", title: "সাপ্তাহিক", shoppingDate: "2026-10-16", createdBy: "u1", createdByName: "রাকিব", assignedToUid: "u2", assignedToName: "হাবিবা", items: [] });
  assert.strictEqual(l.status, "in_progress"); assert.strictEqual(l.stats.total, 0); assert.strictEqual(l.createdBy, "u1"); assert.strictEqual(l.assignedToUid, "u2"); assert.strictEqual(l.completedAt, null);
});

console.log("permissions (spec §7, §10) — same rules the app already uses");
const M = (role, status) => ({ role, status: status || "active" });
const L = (o) => Object.assign({ createdBy: "creator", assignedToUid: "shopper", status: "in_progress" }, o);
t("any active non-viewer member may create a list; a viewer or removed member may not", () => {
  ["owner", "admin", "member"].forEach((r) => assert(C.canCreateList(M(r)), r));
  assert(!C.canCreateList(M("viewer"))); assert(!C.canCreateList(M("member", "removed"))); assert(!C.canCreateList(null));
});
t("the creator and owner/admin manage the list; other members and the shopper do not", () => {
  assert(C.canEditStructure(L(), M("member"), "creator"));
  assert(C.canEditStructure(L(), M("admin"), "someone")); assert(C.canEditStructure(L(), M("owner"), "someone"));
  assert(!C.canEditStructure(L(), M("member"), "shopper"), "the shopper cannot add/edit/delete products");
  assert(!C.canEditStructure(L(), M("member"), "other"));
});
t("the shopper (and managers) update product status; unrelated members and viewers cannot", () => {
  assert(C.canShop(L(), M("member"), "shopper")); assert(C.canShop(L(), M("member"), "creator")); assert(C.canShop(L(), M("admin"), "x"));
  assert(!C.canShop(L(), M("member"), "other")); assert(!C.canShop(L(), M("viewer"), "shopper"));
});
t("a finished list is locked for everybody", () => {
  ["completed", "partial"].forEach((st) => { assert(!C.canShop(L({ status: st }), M("owner"), "shopper")); assert(!C.canEditStructure(L({ status: st }), M("owner"), "creator")); });
});
t("deleting: creator/owner/admin while running; only owner/admin once finished; never the plain shopper", () => {
  assert(C.canDeleteList(L(), M("member"), "creator")); assert(C.canDeleteList(L(), M("admin"), "x"));
  assert(!C.canDeleteList(L(), M("member"), "shopper"));
  assert(!C.canDeleteList(L({ status: "completed" }), M("member"), "creator"), "creator alone cannot erase a finished list");
  assert(C.canDeleteList(L({ status: "completed" }), M("owner"), "x"));
});
t("only owner/admin can reopen a finished list", () => { assert(C.canReopen(L({ status: "completed" }), M("admin"))); assert(!C.canReopen(L({ status: "completed" }), M("member"))); assert(!C.canReopen(L(), M("admin"))); });

console.log("history / reuse (spec §9, screen 13)");
t("copyDraft copies products (skipping cancelled), optionally quantity+price, and a new name", () => {
  const items = [mk({ id: "a" }), Object.assign(mk({ id: "b", name: "আলু" }), { status: "cancelled" })];
  const list = { id: "L1", title: "সাপ্তাহিক বাজার", assignedToUid: "u2" };
  const full = C.copyDraft(list, items, { newTitle: "সাপ্তাহিক বাজার (নতুন)" });
  assert.strictEqual(full.rows.length, 1); assert.strictEqual(full.rows[0].quantity, "5"); assert.strictEqual(full.rows[0].estUnitPrice, "70"); assert.strictEqual(full.title, "সাপ্তাহিক বাজার (নতুন)"); assert.strictEqual(full.copiedFrom, "L1");
  const bare = C.copyDraft(list, items, { copyQtyPrice: false }); assert.strictEqual(bare.rows[0].quantity, ""); assert.strictEqual(bare.rows[0].estUnitPrice === "", true); assert.strictEqual(bare.title, "সাপ্তাহিক বাজার");
  assert.strictEqual(C.copyDraft(list, items, { copyProducts: false }).rows.length, 0);
});
t("filterLists: running vs history, newest shopping date first", () => {
  const ls = [{ id: "a", status: "in_progress", shoppingDate: "2026-10-10" }, { id: "b", status: "completed", shoppingDate: "2026-10-01" }, { id: "c", status: "in_progress", shoppingDate: "2026-10-16" }, { id: "d", status: "partial", shoppingDate: "2026-10-12" }];
  assert.deepStrictEqual(C.filterLists(ls, "active").map((l) => l.id), ["c", "a"]);
  assert.deepStrictEqual(C.filterLists(ls, "history").map((l) => l.id), ["d", "b"]);
  assert.strictEqual(C.pendingForShopper([{ status: "in_progress", assignedToUid: "u1" }, { status: "completed", assignedToUid: "u1" }, { status: "in_progress", assignedToUid: "u2" }], "u1"), 1);
});
t("purchaseSeed turns bought lines into rows for the Family Bazar purchase form (name, category, qty, unit, price)", () => {
  const it = Object.assign(mk({}), { status: "bought", actualUnitPrice: 68, actualQuantity: 4 });
  assert.deepStrictEqual(C.purchaseSeed([it, mk({ id: "p" })]), [{ name: "চাল", categoryId: "def_rice", quantity: 4, unit: "kg", unitPrice: 68 }]);
});

console.log(`\n${passed} passed${process.exitCode ? " — WITH FAILURES" : ""}`);
