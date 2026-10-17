// ফ্যামিলি বাজারের তালিকা (Family Shopping List) — UI + logic in its OWN file.
//
// একজন সদস্য বাজারের তালিকা (পণ্য, পরিমাণ, আনুমানিক খরচ) বানিয়ে পরিবারের আরেকজন
// সদস্যকে পাঠাতে পারেন। প্রাপক তালিকা খুলে কেনা পণ্যে টিক দেন, আসল দাম লেখেন, শেষে
// "সম্পন্ন" করেন — চাইলে এক ট্যাপে "বাজার যোগ করুন" ফর্মে (খরচ হিসাবে) নিয়ে যান।
//
// Needs (load order): React, family-bazar-core.js (window.FamilyBazarCore) and
// family-bazar.js (window.FBShared). Data: families/{familyId}/shoppingLists/{id}
// (see firebase-init.js + firestore.rules).
// Exposes: window.FamilyShopping = { Tab, renderSheet, isShopSheet, pendingForMe, logic }
(function () {
  "use strict";
  const { useState, useMemo } = React;
  const SH = window.FBShared;
  if (!SH) { console.warn("family-shopping.js: family-bazar.js must load first"); return; }
  const { h, R_Fragment, bn, today, F, SERIF, S, Sheet, Empty, Avatar, friendlyError, Core, taka, unitText, qtyText, dateBn } = SH;

  /* ------------------------------ pure logic ------------------------------ */
  const num = (v) => { const n = Number(String(v == null ? "" : v).replace(/,/g, "").trim()); return isFinite(n) && n >= 0 ? n : NaN; };
  const round2 = (n) => Math.round(n * 100) / 100;
  const blankItem = () => ({ id: Core.randomId(), name: "", quantity: "", unit: "kg", estCost: "" });

  // rows (form strings) -> clean items; returns { items, errors }
  function cleanItems(rows) {
    const items = []; const errors = [];
    rows.forEach((r, i) => {
      const name = String(r.name || "").trim();
      const empty = !name && !String(r.quantity || "").trim() && !String(r.estCost || "").trim();
      if (empty) return;
      if (!name) { errors.push(`পণ্য ${bn(i + 1)}: নাম লিখুন`); return; }
      const q = String(r.quantity || "").trim() === "" ? null : num(r.quantity);
      const c = String(r.estCost || "").trim() === "" ? 0 : num(r.estCost);
      if (q !== null && (isNaN(q) || q <= 0)) { errors.push(`${name}: পরিমাণ সঠিক নয়`); return; }
      if (isNaN(c)) { errors.push(`${name}: আনুমানিক খরচ সঠিক নয়`); return; }
      items.push({ id: r.id || Core.randomId(), name: name.slice(0, 60), quantity: q, unit: r.unit || "kg", estCost: round2(c), bought: false, actualCost: null });
    });
    if (!items.length && !errors.length) errors.push("কমপক্ষে একটি পণ্য লিখুন");
    return { items, errors };
  }
  const estTotal = (items) => round2((items || []).reduce((s, i) => s + (Number(i.estCost) || 0), 0));
  // what was really spent: bought items count at actualCost (falls back to the estimate)
  const actualTotal = (items) => round2((items || []).filter((i) => i.bought).reduce((s, i) => s + (i.actualCost != null && i.actualCost !== "" ? Number(i.actualCost) || 0 : Number(i.estCost) || 0), 0));
  const boughtCount = (items) => (items || []).filter((i) => i.bought).length;
  const isOpen = (l) => l.status !== "done";
  const newestFirst = (lists) => (lists || []).slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const pendingForMe = (lists, uid) => (lists || []).filter((l) => isOpen(l) && l.assignedToUid === uid).length;
  // who sees what: owner/admin see all; everybody else only lists they sent or received
  const involves = (l, uid, isAdmin) => isAdmin || l.createdBy === uid || l.assignedToUid === uid;
  const filterLists = (lists, uid, isAdmin, view) => newestFirst(lists).filter((l) => {
    if (!involves(l, uid, isAdmin)) return false;
    if (view === "mine") return isOpen(l) && l.assignedToUid === uid;
    if (view === "sent") return isOpen(l) && l.createdBy === uid && l.assignedToUid !== uid;
    return !isOpen(l);
  });
  function shareText(l) {
    const lines = [`🧾 ${l.title}`, `${l.createdByName || ""} → ${l.assignedToName || ""}`, ""];
    (l.items || []).forEach((i, n) => lines.push(`${bn(n + 1)}. ${i.name}${i.quantity != null ? ` — ${qtyText(i.quantity)} ${unitText(i.unit)}` : ""}${i.estCost ? ` (≈ ${taka(i.estCost)})` : ""}`));
    lines.push("", `মোট আনুমানিক: ${taka(estTotal(l.items))}`);
    if (l.note) lines.push("", "📝 " + l.note);
    return lines.join("\n");
  }
  const logic = { cleanItems, estTotal, actualTotal, boughtCount, pendingForMe, filterLists, involves, shareText, newestFirst, blankItem };

  /* --------------------------------- UI ---------------------------------- */
  const isAdminOf = (ctx) => !!(ctx.vis && (ctx.vis.owner || ctx.vis.admin));
  const chipStyle = (on) => ({ flex: 1, minHeight: 42, border: "none", borderRadius: 10, fontFamily: F, fontWeight: 700, fontSize: 13, background: on ? "var(--hk-gold)" : "transparent", color: on ? "#1a1a1a" : "var(--hk-text-muted)" });
  const statusChip = (l) => l.status === "done"
    ? h("span", { style: S.pill("var(--hk-success)", "#fff") }, "সম্পন্ন")
    : boughtCount(l.items) > 0 ? h("span", { style: S.pill("var(--hk-gold)", "#1a1a1a") }, `${bn(boughtCount(l.items))}/${bn((l.items || []).length)} কেনা`)
    : h("span", { style: S.pill("var(--hk-border)", "var(--hk-text)") }, "নতুন");

  function ShoppingTab({ ctx }) {
    const [view, setView] = useState("mine");
    const lists = ctx.fam.shopLists || [];
    const admin = isAdminOf(ctx);
    const shown = useMemo(() => filterLists(lists, ctx.uid, admin, view), [lists, ctx.uid, admin, view]);
    const nMine = pendingForMe(lists, ctx.uid);
    const emptyText = view === "mine" ? "আপনার জন্য এখন কোনো বাজারের তালিকা নেই।" : view === "sent" ? "আপনি এখনো কাউকে কোনো তালিকা পাঠাননি।" : "এখনো কোনো সম্পন্ন তালিকা নেই।";
    return h("div", null,
      ctx.vis.write && h("button", { style: S.btn, onClick: () => ctx.openSheet({ type: "shop-create" }) }, "+ নতুন বাজারের তালিকা"),
      h("div", { role: "tablist", style: { display: "flex", gap: 4, background: "var(--hk-card)", border: "1px solid var(--hk-border)", borderRadius: 14, padding: 4, margin: "12px 0" } },
        [["mine", "আমার জন্য" + (nMine ? ` (${bn(nMine)})` : "")], ["sent", "আমি পাঠিয়েছি"], ["done", "সম্পন্ন"]].map(([k, label]) =>
          h("button", { key: k, role: "tab", "aria-selected": view === k, onClick: () => setView(k), style: chipStyle(view === k) }, label))),
      shown.length === 0 ? h(Empty, { icon: "🧾", title: "কোনো তালিকা নেই", text: emptyText, action: ctx.vis.write && view !== "done" ? "+ নতুন বাজারের তালিকা" : null, onAction: () => ctx.openSheet({ type: "shop-create" }) })
        : shown.map((l) => h("button", { key: l.id, onClick: () => ctx.openSheet({ type: "shop-details", listId: l.id }),
          style: Object.assign({}, S.card, { display: "block", width: "100%", textAlign: "left", cursor: "pointer", fontFamily: F, color: "inherit" }) },
          h("div", { style: S.row }, h("b", { style: { fontSize: 15.5 } }, "🧾 " + l.title), statusChip(l)),
          h("div", { style: Object.assign({}, S.muted, { marginTop: 4 }) }, `${l.createdByName || "—"} → ${l.assignedToName || "—"} · ${bn((l.items || []).length)}টি পণ্য`),
          h("div", { style: Object.assign({}, S.row, { marginTop: 6 }) }, h("span", { style: S.muted }, l.createdAt ? dateBn(String(l.createdAt).slice(0, 10)) : ""), h("b", { style: { fontFamily: SERIF } }, "≈ " + taka(estTotal(l.items)))))));
  }

  function CreateSheet({ ctx, close }) {
    const members = (ctx.fam.members || []).filter((m) => m.status !== "removed");
    const others = members.filter((m) => m.uid !== ctx.uid);
    const [title, setTitle] = useState("");
    const [to, setTo] = useState(others[0] ? others[0].uid : ctx.uid);
    const [note, setNote] = useState("");
    const [rows, setRows] = useState(() => [blankItem()]);
    const [errors, setErrors] = useState([]);
    const [busy, setBusy] = useState(false);
    const patch = (i, p) => setRows((rs) => rs.map((r, j) => (j === i ? Object.assign({}, r, p) : r)));
    const total = estTotal(rows.map((r) => ({ estCost: num(r.estCost) || 0 })));
    const meName = (ctx.me && ctx.me.name) || (ctx.user && (ctx.user.displayName || ctx.user.email)) || "আমি";
    const toMember = members.find((m) => m.uid === to);

    const send = async () => {
      if (busy) return;
      const t = title.trim();
      const { items, errors: errs } = cleanItems(rows);
      const all = (t ? [] : ["তালিকার একটি নাম দিন"]).concat(toMember ? [] : ["কাকে পাঠাবেন বেছে নিন"], errs);
      if (all.length) { setErrors(all); return; }
      setBusy(true); setErrors([]);
      try {
        await window.FB.createShoppingList(ctx.familyId, {
          title: t.slice(0, 60), note: note.trim().slice(0, 300), items,
          assignedToUid: toMember.uid, assignedToName: toMember.name || "সদস্য",
          createdBy: ctx.uid, createdByName: meName, status: "sent",
          estTotal: estTotal(items), createdAt: new Date().toISOString(),
        });
        ctx.toast(toMember.uid === ctx.uid ? "তালিকা সংরক্ষিত হয়েছে ✓" : `${toMember.name || "সদস্য"}-কে তালিকা পাঠানো হয়েছে ✓`);
        close();
      } catch (e) { setErrors([friendlyError(e)]); setBusy(false); }
    };

    return h(Sheet, { title: "নতুন বাজারের তালিকা", onClose: close,
      footer: h("div", null,
        errors.length > 0 && h("div", { role: "alert", style: { color: "var(--hk-danger)", fontSize: 13, marginBottom: 8 } }, errors.map((e, i) => h("div", { key: i }, "• " + e))),
        h("button", { style: S.btn, disabled: busy, onClick: send }, busy ? "পাঠানো হচ্ছে…" : "📤 তালিকা পাঠান")) },
      h("label", { style: S.label }, "তালিকার নাম"),
      h("input", { style: S.input, value: title, maxLength: 60, placeholder: "যেমন: সপ্তাহের বাজার", onChange: (e) => setTitle(e.target.value) }),
      h("label", { style: S.label }, "কাকে পাঠাবেন"),
      h("select", { style: S.input, value: to, onChange: (e) => setTo(e.target.value) },
        others.map((m) => h("option", { key: m.uid, value: m.uid }, m.name || m.email || "সদস্য")),
        h("option", { value: ctx.uid }, "নিজের জন্য (আমি)")),
      others.length === 0 && h("div", { style: Object.assign({}, S.muted, { marginBottom: 8 }) }, "পরিবারে এখনো অন্য সদস্য নেই — \"পরিবার\" ট্যাব থেকে Invite করুন।"),
      h("div", { style: Object.assign({}, S.row, { margin: "6px 0 8px" }) }, h("b", null, "পণ্য"), h("span", { style: S.muted }, "আনুমানিক মোট ", h("b", { style: { fontFamily: SERIF } }, taka(total)))),
      rows.map((r, i) => h("div", { key: r.id, style: Object.assign({}, S.card, { padding: "12px 12px 4px" }) },
        h("div", { style: Object.assign({}, S.row, { marginBottom: 6 }) }, h("b", { style: { fontSize: 13 } }, `পণ্য ${bn(i + 1)}`),
          rows.length > 1 && h("button", { onClick: () => setRows((rs) => rs.filter((_, j) => j !== i)), "aria-label": "পণ্য সরান", style: { background: "none", border: "none", color: "var(--hk-danger)", fontSize: 18, minHeight: 36, minWidth: 36 } }, "✕")),
        h("input", { style: S.input, value: r.name, maxLength: 60, placeholder: "পণ্যের নাম (যেমন: চাল)", onChange: (e) => patch(i, { name: e.target.value }) }),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
          h("div", null, h("label", { style: S.label }, "পরিমাণ"), h("input", { style: S.input, inputMode: "decimal", value: r.quantity, placeholder: "২", onChange: (e) => patch(i, { quantity: e.target.value }) })),
          h("div", null, h("label", { style: S.label }, "একক"), h("select", { style: S.input, value: r.unit, onChange: (e) => patch(i, { unit: e.target.value }) }, Core.UNITS.map((u) => h("option", { key: u, value: u }, unitText(u)))))),
        h("label", { style: S.label }, "আনুমানিক খরচ (৳)"),
        h("input", { style: S.input, inputMode: "decimal", value: r.estCost, placeholder: "০", onChange: (e) => patch(i, { estCost: e.target.value }) }))),
      h("button", { style: Object.assign({}, S.btn2, { width: "100%", marginBottom: 14 }), onClick: () => setRows((rs) => rs.concat(blankItem())) }, "+ আরেকটি পণ্য"),
      h("label", { style: S.label }, "নোট (ঐচ্ছিক)"),
      h("textarea", { style: Object.assign({}, S.input, { minHeight: 64 }), value: note, maxLength: 300, placeholder: "যেমন: বাজারের ব্যাগ নিয়ে যেও", onChange: (e) => setNote(e.target.value) }));
  }

  function DetailsSheet({ ctx, listId, close }) {
    const l = (ctx.fam.shopLists || []).find((x) => x.id === listId);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    if (!l) return h(Sheet, { title: "বাজারের তালিকা", onClose: close }, h(Empty, { icon: "🧾", title: "তালিকাটি পাওয়া যায়নি", text: "এটি মুছে ফেলা হয়ে থাকতে পারে।" }));
    const admin = isAdminOf(ctx);
    const iAmTo = l.assignedToUid === ctx.uid, iAmFrom = l.createdBy === ctx.uid;
    const canAct = (iAmTo || iAmFrom || admin) && ctx.vis.write;
    const open = isOpen(l);
    const run = async (fn) => { if (busy) return; setBusy(true); setErr(""); try { await fn(); } catch (e) { setErr(friendlyError(e)); } setBusy(false); };
    const saveItems = (items, extra) => run(() => window.FB.updateShoppingList(ctx.familyId, l.id, Object.assign({ items, estTotal: estTotal(items) }, extra || {})));
    const toggle = (id) => saveItems(l.items.map((i) => (i.id === id ? Object.assign({}, i, { bought: !i.bought }) : i)));
    const setActual = (id, v) => {
      const n = String(v).trim() === "" ? null : num(v);
      if (n !== null && isNaN(n)) { setErr("আসল দাম সঠিক নয়"); return; }
      saveItems(l.items.map((i) => (i.id === id ? Object.assign({}, i, { actualCost: n }) : i)));
    };
    const finish = () => run(async () => { await window.FB.updateShoppingList(ctx.familyId, l.id, { status: "done", doneAt: new Date().toISOString(), doneBy: ctx.uid }); ctx.toast("বাজার সম্পন্ন ✓"); });
    const reopen = () => run(() => window.FB.updateShoppingList(ctx.familyId, l.id, { status: "sent", doneAt: null, doneBy: null }));
    const remove = () => { if (!window.confirm(`"${l.title}" তালিকাটি মুছে ফেলবেন?`)) return; run(async () => { await window.FB.deleteShoppingList(ctx.familyId, l.id); ctx.toast("তালিকা মুছে ফেলা হয়েছে"); close(); }); };
    const addAsExpense = () => {
      const bought = (l.items || []).filter((i) => i.bought);
      ctx.openSheet({ type: "purchase", seed: (bought.length ? bought : l.items).map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit })) });
    };
    const share = () => {
      const text = shareText(l);
      if (navigator.share) navigator.share({ title: l.title, text }).catch(() => {});
      else window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
    };
    const est = estTotal(l.items), act = actualTotal(l.items);

    return h(Sheet, { title: "বাজারের তালিকা", onClose: close,
      footer: canAct && open ? h("div", null, err && h("div", { role: "alert", style: { color: "var(--hk-danger)", fontSize: 13, marginBottom: 8 } }, err),
        h("button", { style: S.btn, disabled: busy, onClick: finish }, "✅ বাজার শেষ — সম্পন্ন করুন")) : null },
      h("div", { style: Object.assign({}, S.hero, { textAlign: "center" }) },
        h("div", { style: { fontFamily: SERIF, fontSize: 20 } }, "🧾 " + l.title),
        h("div", { style: Object.assign({}, S.muted, { marginTop: 4 }) }, `${l.createdByName || "—"} → ${l.assignedToName || "—"}`),
        h("div", { style: { marginTop: 8 } }, statusChip(l))),
      l.note && h("div", { style: Object.assign({}, S.card, { marginTop: 10 }) }, h("div", { style: S.muted }, "📝 " + l.note)),
      h("div", { style: Object.assign({}, S.row, { margin: "12px 2px 6px" }) }, h("b", null, `পণ্য (${bn((l.items || []).length)})`), h("span", { style: S.muted }, `${bn(boughtCount(l.items))} কেনা হয়েছে`)),
      (l.items || []).map((i) => h("div", { key: i.id, style: Object.assign({}, S.card, { padding: "10px 12px" }) },
        h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
          h("button", { role: "checkbox", "aria-checked": !!i.bought, "aria-label": i.name + (i.bought ? " — কেনা হয়েছে" : " — কেনা বাকি"), disabled: !canAct || busy || !open, onClick: () => toggle(i.id),
            style: { width: 30, height: 30, minWidth: 30, borderRadius: 8, border: "2px solid " + (i.bought ? "var(--hk-success)" : "var(--hk-border)"), background: i.bought ? "var(--hk-success)" : "transparent", color: "#fff", fontSize: 18, lineHeight: 1 } }, i.bought ? "✓" : ""),
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { style: { fontWeight: 600, textDecoration: i.bought ? "line-through" : "none", opacity: i.bought ? 0.7 : 1 } }, i.name),
            h("div", { style: S.muted }, (i.quantity != null ? `${qtyText(i.quantity)} ${unitText(i.unit)}` : "পরিমাণ নেই") + (i.estCost ? ` · ≈ ${taka(i.estCost)}` : ""))),
          i.bought && h("input", { key: i.id + ":" + (i.actualCost == null ? "" : i.actualCost), style: Object.assign({}, S.input, { width: 92, marginBottom: 0 }), inputMode: "decimal", placeholder: "আসল ৳", "aria-label": i.name + " — আসল দাম",
            defaultValue: i.actualCost == null ? "" : String(i.actualCost), disabled: !canAct || busy || !open, onBlur: (e) => { if (String(e.target.value).trim() !== (i.actualCost == null ? "" : String(i.actualCost))) setActual(i.id, e.target.value); } })))),
      h("div", { style: S.card },
        h("div", { style: S.row }, h("span", { style: S.muted }, "আনুমানিক মোট"), h("b", { style: { fontFamily: SERIF } }, taka(est))),
        boughtCount(l.items) > 0 && h("div", { style: Object.assign({}, S.row, { marginTop: 6 }) }, h("span", { style: S.muted }, "কেনা পণ্যের মোট"), h("b", { style: { fontFamily: SERIF } }, taka(act)))),
      err && !(canAct && open) && h("div", { role: "alert", style: { color: "var(--hk-danger)", fontSize: 13, marginBottom: 8 } }, err),
      h("div", { style: { display: "grid", gap: 8, marginTop: 4 } },
        (canAct) && h("button", { style: S.btn2, onClick: addAsExpense }, "💰 খরচ হিসাবে বাজার যোগ করুন"),
        h("button", { style: S.btn2, onClick: share }, "📤 শেয়ার করুন (WhatsApp ইত্যাদি)"),
        canAct && !open && h("button", { style: S.btn2, disabled: busy, onClick: reopen }, "↩ আবার খুলুন"),
        (iAmFrom || admin) && h("button", { style: Object.assign({}, S.danger, { width: "100%" }), disabled: busy, onClick: remove }, "🗑 তালিকা মুছুন")));
  }

  const isShopSheet = (sheet) => !!(sheet && /^shop-/.test(sheet.type));
  function renderSheet(sheet, ctx, close) {
    if (sheet.type === "shop-create") return h(CreateSheet, { ctx, close });
    if (sheet.type === "shop-details") return h(DetailsSheet, { ctx, listId: sheet.listId, close });
    return null;
  }

  window.FamilyShopping = { Tab: ShoppingTab, renderSheet, isShopSheet, pendingForMe, logic };
})();
