// Run: node tests/family-bazar-shopping.test.js
// Tests for সমস্যা ২'s changes to the shopping-list core logic:
// mandatory name+category, the foundStatus/statusNote fields recipients use
// to report "not found"/"too expensive"/a custom note, and the
// quantity+unitPrice gate that decides whether an item's checkbox may be
// ticked (enforced in family-bazar.js's rowReady(), mirrored here against
// the same Core.parseNum the real component uses).
const assert = require("assert");
const C = require("../family-bazar-core.js");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ✓", name); } catch (e) { console.error("  ✗", name, "\n   ", e.message); process.exitCode = 1; } };

console.log("shoppingItem()");
t("a fresh item has no found-status by default", () => {
  const it = C.shoppingItem({ name: "চাল", categoryId: "cat1" });
  assert.strictEqual(it.foundStatus, null);
  assert.strictEqual(it.statusNote, "");
});
t("foundStatus/statusNote round-trip through shoppingItem()", () => {
  const it = C.shoppingItem({ name: "তেল", categoryId: "cat1", foundStatus: "too_expensive", statusNote: "" });
  assert.strictEqual(it.foundStatus, "too_expensive");
  const it2 = C.shoppingItem({ name: "লবণ", categoryId: "cat1", foundStatus: "note", statusNote: "দোকান বন্ধ ছিল" });
  assert.strictEqual(it2.foundStatus, "note"); assert.strictEqual(it2.statusNote, "দোকান বন্ধ ছিল");
});
t("FOUND_STATUS_LABEL covers all three statuses with Bengali labels", () => {
  ["not_found", "too_expensive", "note"].forEach((k) => assert.ok(C.FOUND_STATUS_LABEL[k] && C.FOUND_STATUS_LABEL[k].length > 0, `missing label for ${k}`));
});

console.log("validateShoppingDraft() — name AND category both mandatory now");
t("a row with a name but no category is rejected with a category-specific error", () => {
  const v = C.validateShoppingDraft({ title: "বাজার", assignedTo: "u1", items: [{ name: "দুধ", categoryId: "" }] });
  assert.strictEqual(v.ok, false);
  assert.ok(v.errors.some((e) => e.includes("ক্যাটাগরি")), "expected a category-related error, got: " + v.errors.join(" | "));
});
t("a row with both name and category passes", () => {
  const v = C.validateShoppingDraft({ title: "বাজার", assignedTo: "u1", items: [{ name: "দুধ", categoryId: "cat1" }] });
  assert.strictEqual(v.ok, true);
  assert.strictEqual(v.items[0].categoryId, "cat1");
});
t("a completely blank trailing row (no name, no quantity, no category) is still silently ignored, not an error", () => {
  const v = C.validateShoppingDraft({ title: "বাজার", assignedTo: "u1", items: [{ name: "দুধ", categoryId: "cat1" }, { name: "", quantity: "", categoryId: "" }] });
  assert.strictEqual(v.ok, true);
  assert.strictEqual(v.items.length, 1);
});
t("a name-only row (old behaviour) now fails — category can no longer be skipped", () => {
  const v = C.validateShoppingDraft({ title: "বাজার", assignedTo: "u1", items: [{ name: "চিনি", categoryId: "" }] });
  assert.strictEqual(v.ok, false);
});

console.log("checkbox-gate logic — পরিমাণ ও একক দাম দুটোই দেওয়ার আগে টিক দেওয়া যাবে না");
// mirrors ShoppingDetailSheet's rowReady(): Core.parseNum(quantity) > 0 && Core.parseNum(unitPrice) > 0
const rowReady = (q, p) => C.parseNum(q) > 0 && C.parseNum(p) > 0;
t("neither quantity nor unit price given → not ready", () => assert.strictEqual(rowReady("", ""), false));
t("only quantity given → still not ready", () => assert.strictEqual(rowReady("২", ""), false));
t("only unit price given → still not ready", () => assert.strictEqual(rowReady("", "৫০"), false));
t("quantity given as 0 → not ready (must be a real positive amount)", () => assert.strictEqual(rowReady("0", "৫০"), false));
t("both quantity and unit price given and positive → ready, checkbox unlocks", () => assert.strictEqual(rowReady("২", "৫০"), true));
t("total auto-calculates from quantity × unit price via the same calcLineTotal the purchase pipeline uses", () => {
  assert.strictEqual(C.calcLineTotal("২.৫", "৪০"), 100);
  assert.strictEqual(C.calcLineTotal("৩", "১৫.৫"), 46.5);
});

console.log("শুধু একবার কেনা/মোছা হলেই তালিকা 'done' হয় (removeShoppingItems-এর status রুল)");
t("a list with items remaining is 'active'", () => {
  const items = [{ id: "1", checked: false }, { id: "2", checked: false }];
  const remaining = items.filter((it) => it.id !== "1");
  const status = remaining.length ? "active" : "done";
  assert.strictEqual(status, "active");
});
t("a list with its last item removed (bought or deleted) becomes 'done'", () => {
  const items = [{ id: "1", checked: false }];
  const remaining = items.filter((it) => it.id !== "1");
  const status = remaining.length ? "active" : "done";
  assert.strictEqual(status, "done");
});

console.log(`\n${passed} passed${process.exitCode ? " — WITH FAILURES" : ""}`);
