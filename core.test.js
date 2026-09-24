// Run: node tests/core.test.js   (no dependencies)
const assert = require("assert");
const C = require("../family-bazar-core.js");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ✓", name); } catch (e) { console.error("  ✗", name, "\n   ", e.message); process.exitCode = 1; } };

console.log("dates");
t("weekStart is Saturday", () => { assert.strictEqual(C.weekStart("2026-09-24"), "2026-09-19"); assert.strictEqual(C.weekStart("2026-09-19"), "2026-09-19"); assert.strictEqual(C.weekStart("2026-09-25"), "2026-09-19"); assert.strictEqual(C.weekStart("2026-09-26"), "2026-09-26"); });
t("addMonths crosses years", () => { assert.strictEqual(C.addMonths("2026-01", -1), "2025-12"); assert.strictEqual(C.addMonths("2026-11", 3), "2027-02"); });
t("isValidYmd", () => { assert.ok(C.isValidYmd("2026-02-28")); assert.ok(!C.isValidYmd("2026-02-30")); assert.ok(!C.isValidYmd("26-1-1")); });

console.log("numbers");
t("parseNum handles Bengali digits", () => { assert.strictEqual(C.parseNum("৬৪"), 64); assert.strictEqual(C.parseNum("১,২৫০.৫"), 1250.5); assert.ok(isNaN(C.parseNum("abc"))); assert.ok(isNaN(C.parseNum(""))); });

console.log("purchase validation");
const today = "2026-09-24";
t("rice example: 5kg x 64 = 320", () => {
  const r = C.validatePurchaseDraft({ date: today, items: [{ productName: "চাল", quantity: "5", unit: "kg", unitPrice: "64" }] }, today);
  assert.ok(r.ok); assert.strictEqual(r.items[0].total, 320); assert.strictEqual(C.itemsTotal(r.items), 320);
});
t("spec sample session totals ৳824", () => {
  const r = C.validatePurchaseDraft({ date: today, items: [
    { productName: "Rice", quantity: "5", unit: "kg", unitPrice: "64" },
    { productName: "Oil", quantity: "2", unit: "L", unitPrice: "180" },
    { productName: "Egg", quantity: "12", unit: "pcs", unitPrice: "12" },
    { productName: "", quantity: "", unitPrice: "" }] }, today);
  assert.ok(r.ok); assert.strictEqual(r.items.length, 3); assert.strictEqual(C.itemsTotal(r.items), 824);
});
t("total-only entry derives unit price", () => {
  const r = C.validatePurchaseDraft({ date: today, items: [{ productName: "মাছ", quantity: "2", unit: "kg", total: "700" }] }, today);
  assert.ok(r.ok); assert.strictEqual(r.items[0].unitPrice, 350);
});
t("rejects qty<=0, negative price, bad/future date, empty", () => {
  assert.ok(!C.validatePurchaseDraft({ date: today, items: [{ productName: "x", quantity: "0", unitPrice: "5" }] }, today).ok);
  assert.ok(!C.validatePurchaseDraft({ date: today, items: [{ productName: "x", quantity: "1", unitPrice: "-5" }] }, today).ok);
  assert.ok(!C.validatePurchaseDraft({ date: "2026-13-01", items: [{ productName: "x", quantity: "1", unitPrice: "5" }] }, today).ok);
  assert.ok(!C.validatePurchaseDraft({ date: "2026-09-30", items: [{ productName: "x", quantity: "1", unitPrice: "5" }] }, today).ok);
  assert.ok(!C.validatePurchaseDraft({ date: today, items: [] }, today).ok);
  assert.ok(C.validatePurchaseDraft({ date: today, items: [{ productName: "x", quantity: "1", unitPrice: "0" }] }, today).ok, "price 0 is allowed (>=0)");
});
t("same product name → same id; different casing too", () => { assert.strictEqual(C.productIdFor("Rice "), C.productIdFor("rice")); assert.notStrictEqual(C.productIdFor("চাল"), C.productIdFor("ডাল")); });

console.log("stats deltas");
const P = (id, date, items) => ({ purchaseId: id, date, items });
const it = (name, cat, total) => ({ itemId: name, productName: name, categoryId: cat, category: cat, quantity: 1, unitPrice: total, total });
t("create then delete cancels to nothing", () => {
  const p = P("a", "2026-09-24", [it("চাল", "def_rice", 320)]);
  const add = C.statDeltas(null, p), del = C.statDeltas(p, null);
  assert.strictEqual(add["2026-09"].total, 320); assert.strictEqual(add["2026-09"].count, 1); assert.strictEqual(add["2026-09"].days["2026-09-24"], 320);
  assert.strictEqual(del["2026-09"].total, -320);
  const both = C.statDeltas(p, p); assert.deepStrictEqual(both, {});
});
t("edit that moves date across months touches both months", () => {
  const a = P("a", "2026-08-31", [it("চাল", "def_rice", 320)]), b = P("a", "2026-09-01", [it("চাল", "def_rice", 350)]);
  const d = C.statDeltas(a, b);
  assert.strictEqual(d["2026-08"].total, -320); assert.strictEqual(d["2026-08"].count, -1);
  assert.strictEqual(d["2026-09"].total, 350); assert.strictEqual(d["2026-09"].count, 1);
});
t("edit that changes category only moves category totals", () => {
  const a = P("a", "2026-09-24", [it("x", "def_rice", 100)]), b = P("a", "2026-09-24", [it("x", "def_oil", 100)]);
  const d = C.statDeltas(a, b)["2026-09"];
  assert.strictEqual(d.total, 0); assert.strictEqual(d.cats.def_rice.total, -100); assert.strictEqual(d.cats.def_oil.total, 100);
});
t("rebuild equals sum of deltas", () => {
  const ps = [P("a", "2026-09-24", [it("চাল", "def_rice", 320)]), P("b", "2026-09-24", [it("তেল", "def_oil", 360), it("ডিম", "def_egg", 144)]), P("c", "2026-08-30", [it("চাল", "def_rice", 100)])];
  const s = C.buildStatsFromPurchases(ps);
  assert.strictEqual(s["2026-09"].total, 824); assert.strictEqual(s["2026-09"].count, 2); assert.strictEqual(s["2026-08"].total, 100);
});

console.log("dashboard maths");
const docs = [
  { memberId: "rakib", month: "2026-09", days: { "2026-09-24": 320, "2026-09-23": 100, "2026-09-19": 50, "2026-09-10": 900 } },
  { memberId: "abbu", month: "2026-09", days: { "2026-09-24": 350 } },
  { memberId: "rakib", month: "2026-08", days: { "2026-08-30": 400, "2026-08-15": 600 } },
];
t("period totals", () => {
  const p = C.periodTotals(docs, "2026-09-24");
  assert.strictEqual(p.today, 670); assert.strictEqual(p.yesterday, 100);
  assert.strictEqual(p.thisWeek, 670 + 100 + 50); // Sat 19th .. Thu 24th
  assert.strictEqual(p.prevWeek, 0); // 12..18 Sept: nothing
  assert.strictEqual(p.thisMonth, 320 + 100 + 50 + 900 + 350); assert.strictEqual(p.prevMonth, 1000);
});
t("member totals + pct change", () => {
  const m = C.memberMonthTotals(docs, "2026-09"); assert.strictEqual(m.rakib, 1370); assert.strictEqual(m.abbu, 350);
  assert.strictEqual(C.pctChange(1120, 1000), 12); assert.strictEqual(C.pctChange(5, 0), null);
});
t("category rows with percentages", () => {
  const cd = [{ memberId: "r", month: "2026-09", categories: { def_rice: { name: "চাল", total: 300 }, def_oil: { name: "তেল", total: 100 } } }, { memberId: "a", month: "2026-09", categories: { def_rice: { name: "চাল", total: 100 } } }, { memberId: "r", month: "2026-08", categories: { def_rice: { name: "চাল", total: 200 } } }];
  const rows = C.categoryRows(cd, "2026-09", "2026-08");
  assert.strictEqual(rows[0].id, "def_rice"); assert.strictEqual(rows[0].total, 400); assert.strictEqual(rows[0].pct, 80); assert.strictEqual(rows[0].change, 100);
});
t("budget levels: 75% ok, 80% w80, 90% w90, 100% over", () => {
  assert.strictEqual(C.budgetStatus(25000, 18750).level, "ok"); assert.strictEqual(C.budgetStatus(25000, 18750).pct, 75); assert.strictEqual(C.budgetStatus(25000, 18750).remaining, 6250);
  assert.strictEqual(C.budgetStatus(25000, 20000).level, "w80"); assert.strictEqual(C.budgetStatus(25000, 22500).level, "w90");
  assert.strictEqual(C.budgetStatus(25000, 26000).level, "over"); assert.strictEqual(C.budgetStatus(0, 10), null);
});

console.log("estimation");
t("not enough data → not ok", () => { assert.strictEqual(C.estimateNext7(docs, "2026-09-24").ok, false); });
t("regular spending → range, never a single number", () => {
  const days = {}; for (let i = 1; i <= 28; i++) if (i % 2 === 0) days[C.addDays("2026-09-24", -i)] = 600 + (i % 3) * 50;
  const e = C.estimateNext7([{ month: "x", days }], "2026-09-24");
  assert.ok(e.ok); assert.ok(e.high > e.low); assert.ok(e.low > 0);
});

console.log("price analysis");
const rows = [
  { productId: "rice", productName: "চাল", price: 58, unit: "kg", date: "2026-08-20", memberId: "r" },
  { productId: "rice", productName: "চাল", price: 60, unit: "kg", date: "2026-09-17", memberId: "r" },
  { productId: "rice", productName: "চাল", price: 62, unit: "kg", date: "2026-09-23", memberId: "a" },
  { productId: "rice", productName: "চাল", price: 64, unit: "kg", date: "2026-09-24", memberId: "r" },
  { productId: "rice", productName: "চাল", price: 9, unit: "g", date: "2026-09-24", memberId: "r" },
];
t("latest/previous/30d change (the spec's rice example)", () => {
  const a = C.analyzePrices(rows.slice(0, 4), "2026-09-24");
  assert.strictEqual(a.latest.price, 64); assert.strictEqual(a.previous.price, 62); assert.strictEqual(a.price7dAgo, 60);
  assert.strictEqual(a.price30dAgo, 58); assert.strictEqual(a.change30, 6); assert.strictEqual(a.min, 58); assert.strictEqual(a.max, 64);
  assert.strictEqual(a.prevMonthAvg, 58); assert.strictEqual(a.curMonthAvg, 62);
});
t("mixed units are not averaged together", () => { const a = C.analyzePrices(rows.slice(0, 4).concat([{ productId: "rice", productName: "চাল", price: 5, unit: "pcs", date: "2026-09-01" }]), "2026-09-24"); assert.strictEqual(a.unit, "kg"); assert.strictEqual(a.otherUnitCount, 1); assert.strictEqual(a.max, 64); });
t("movers", () => { const m = C.priceMovers(rows.slice(0, 4), 3); assert.strictEqual(m.length, 1); assert.strictEqual(m[0].pct, 3); });
t("location comparison sorts cheapest first, latest per location", () => {
  const l = C.locationComparison([{ location: "Dhaka", unit: "kg", price: 70, date: "2026-09-01" }, { location: "Gaibandha", unit: "kg", price: 64, date: "2026-09-02" }, { location: "Rangpur", unit: "kg", price: 66, date: "2026-09-02" }, { location: "dhaka", unit: "kg", price: 72, date: "2026-09-10" }]);
  assert.deepStrictEqual(l.map((x) => x.price), [64, 66, 72]);
});
t("price rows are skipped when trackPrice is off", () => {
  const p = { purchaseId: "p1", date: today, market: "M", location: "Gaibandha", items: [{ itemId: "i1", productName: "চাল", unit: "kg", unitPrice: 64 }] };
  assert.strictEqual(C.priceRowsFromPurchase(p, "u").length, 1); assert.strictEqual(C.priceRowsFromPurchase(Object.assign({}, p, { trackPrice: false }), "u").length, 0);
  assert.strictEqual(C.priceRowsFromPurchase(p, "u")[0].id, "p1_i1");
});

console.log("permissions");
const owner = { uid: "o", role: "owner", status: "active", permissions: C.permissionPreset("owner") };
const admin = { uid: "a", role: "admin", status: "active", permissions: C.permissionPreset("admin") };
const mem = { uid: "m", role: "member", status: "active", permissions: C.permissionPreset("member") };
t("presets: private by default", () => { assert.strictEqual(mem.permissions.purchaseDetails, false); assert.strictEqual(admin.permissions.purchaseDetails, false); assert.strictEqual(owner.permissions.purchaseDetails, true); });
t("who can edit whom", () => {
  assert.ok(C.canEditMember(owner, admin)); assert.ok(C.canEditMember(admin, mem)); assert.ok(!C.canEditMember(admin, owner)); assert.ok(!C.canEditMember(mem, admin));
  assert.ok(!C.canEditMember(owner, owner)); assert.ok(!C.canEditMember(admin, { uid: "z", role: "admin" }));
  assert.ok(C.canEditMember(Object.assign({}, mem, { permissions: Object.assign({}, mem.permissions, { memberManagement: true }) }), { uid: "v", role: "viewer" }));
});
t("guess category", () => { assert.strictEqual(C.guessCategoryId("মিনিকেট চাল"), "def_rice"); assert.strictEqual(C.guessCategoryId("Soap"), "def_soap"); assert.strictEqual(C.guessCategoryId("xyz"), null); });
t("invitation state", () => { assert.strictEqual(C.inviteState({ status: "pending", expiresAt: 5 }, 10), "expired"); assert.strictEqual(C.inviteState({ status: "pending", expiresAt: 50 }, 10), "pending"); assert.strictEqual(C.inviteState({ status: "accepted" }, 10), "accepted"); });


console.log("purchase write plan");
const mk = (id, date, items, extra) => C.buildPurchase(Object.assign({ purchaseId: id, memberId: "rakib", date, items: C.validatePurchaseDraft({ date, items }, "2026-12-31").items }, extra || {}));
const rice = (price) => [{ productName: "চাল", quantity: "5", unit: "kg", unitPrice: String(price), categoryId: "def_rice", categoryName: "চাল" }];
t("create: aggregates, price row, location, product", () => {
  const p = mk("p1", "2026-09-24", rice(64), { location: "গাইবান্ধা", market: "সুন্দরগঞ্জ বাজার" });
  const plan = C.planPurchaseChange(null, p, "rakib");
  assert.strictEqual(p.total, 320); assert.strictEqual(p.month, "2026-09");
  assert.strictEqual(plan.monthly.length, 1); assert.strictEqual(plan.monthly[0].id, "rakib_2026-09");
  assert.deepStrictEqual(plan.monthly[0].data.total, { $inc: 320 });
  assert.deepStrictEqual(plan.monthly[0].data.days["2026-09-24"], { $inc: 320 });
  assert.deepStrictEqual(plan.categories[0].data.categories.def_rice.total, { $inc: 320 });
  assert.strictEqual(plan.priceSet.length, 1); assert.strictEqual(plan.priceSet[0].data.month, "2026-09");
  assert.strictEqual(plan.locationSet.length, 1); assert.strictEqual(plan.products.length, 1);
  assert.strictEqual(plan.priceDelete.length, 0);
});
t("delete: exactly cancels the create, price rows removed", () => {
  const p = mk("p1", "2026-09-24", rice(64), { location: "ঢাকা" });
  const plan = C.planPurchaseChange(p, null, "rakib");
  assert.deepStrictEqual(plan.monthly[0].data.total, { $inc: -320 });
  assert.deepStrictEqual(plan.monthly[0].data.count, { $inc: -1 });
  assert.strictEqual(plan.priceDelete.length, 1); assert.strictEqual(plan.priceSet.length, 0);
  assert.strictEqual(plan.locationRelease.length, 1);
});
t("edit price: net delta only, same price-row id is overwritten not duplicated", () => {
  const a = mk("p1", "2026-09-24", rice(64));
  const it = a.items[0];
  const b = mk("p1", "2026-09-24", [Object.assign({}, it, { unitPrice: "70", quantity: "5" })].map((x) => ({ itemId: x.itemId, productName: x.productName, quantity: "5", unit: "kg", unitPrice: "70" })));
  b.items[0].itemId = it.itemId;
  const plan = C.planPurchaseChange(a, b, "rakib");
  assert.deepStrictEqual(plan.monthly[0].data.total, { $inc: 30 });
  assert.strictEqual(plan.priceSet.length, 1); assert.strictEqual(plan.priceDelete.length, 0);
  assert.strictEqual(plan.priceSet[0].id, `p1_${it.itemId}`);
});
t("edit that moves month: both months touched, old price row kept only if same id", () => {
  const a = mk("p1", "2026-08-30", rice(60));
  const b = mk("p1", "2026-09-02", rice(60)); b.items[0].itemId = a.items[0].itemId;
  const plan = C.planPurchaseChange(a, b, "rakib");
  assert.deepStrictEqual(plan.monthly.map((m) => m.id).sort(), ["rakib_2026-08", "rakib_2026-09"]);
});
t("removing an item deletes only that item's price row", () => {
  const a = mk("p1", "2026-09-24", [{ productName: "চাল", quantity: "1", unit: "kg", unitPrice: "60" }, { productName: "ডাল", quantity: "1", unit: "kg", unitPrice: "120" }]);
  const b = mk("p1", "2026-09-24", []); b.items = [a.items[0]]; b.total = C.itemsTotal(b.items);
  const plan = C.planPurchaseChange(a, b, "rakib");
  assert.deepStrictEqual(plan.priceDelete, [`p1_${a.items[1].itemId}`]);
});
t("trackPrice=false writes no price history / location rows", () => {
  const p = mk("p1", "2026-09-24", rice(64), { trackPrice: false, location: "ঢাকা" });
  const plan = C.planPurchaseChange(null, p, "rakib");
  assert.strictEqual(plan.priceSet.length, 0); assert.strictEqual(plan.locationSet.length, 0);
  assert.strictEqual(plan.monthly.length, 1, "spending still counts");
});
t("budget crossing fires once per level", () => {
  assert.strictEqual(C.budgetCrossing(25000, 15000, 20000), "w80");
  assert.strictEqual(C.budgetCrossing(25000, 20000, 20500), null);
  assert.strictEqual(C.budgetCrossing(25000, 20000, 22600), "w90");
  assert.strictEqual(C.budgetCrossing(25000, 24000, 26000), "over");
  assert.strictEqual(C.budgetCrossing(0, 0, 100), null);
});
t("a manager cannot grant permissions they lack", () => {
  const owner = { uid: "o", role: "owner", status: "active", permissions: C.permissionPreset("owner") };
  const admin = { uid: "a", role: "admin", status: "active", permissions: C.permissionPreset("admin") };
  assert.ok(C.canGrant(owner, { purchaseDetails: true }));
  assert.ok(!C.canGrant(admin, { purchaseDetails: true }), "admin preset lacks purchaseDetails");
  assert.ok(C.canGrant(admin, { monthlyTotal: true, reports: true }));
});
t("visibilityFor: Abbu sees totals, not purchase details (spec scenario 8)", () => {
  const abbu = { uid: "abbu", role: "member", status: "active", permissions: Object.assign(C.permissionPreset("member"), { purchaseDetails: false, monthlyTotal: true }) };
  const v = C.visibilityFor(abbu);
  assert.ok(v.totals && !v.details && v.write && !v.admin);
});
t("dashboard: Rakib 320 + Abbu 350 = 670 (spec scenarios 4-6)", () => {
  const pr = C.planPurchaseChange(null, mk("a", "2026-09-24", rice(64)), "rakib");
  const pa = C.planPurchaseChange(null, C.buildPurchase({ purchaseId: "b", memberId: "abbu", date: "2026-09-24", items: C.validatePurchaseDraft({ date: "2026-09-24", items: rice(70) }, "2026-12-31").items }), "abbu");
  const asDoc = (m) => ({ memberId: m.data.memberId, month: m.data.month, days: { "2026-09-24": m.data.days["2026-09-24"].$inc } });
  const docs = [asDoc(pr.monthly[0]), asDoc(pa.monthly[0])];
  assert.strictEqual(C.periodTotals(docs, "2026-09-24").thisMonth, 670);
  assert.deepStrictEqual(C.memberMonthTotals(docs, "2026-09"), { rakib: 320, abbu: 350 });
});
console.log(`\n${passed} passed${process.exitCode ? " — WITH FAILURES" : ""}`);
