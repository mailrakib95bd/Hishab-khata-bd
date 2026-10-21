// ফ্যামিলি বাজার তালিকা (Family Shopping List) — UI.
//
// একজন সদস্য তালিকা বানান, আরেকজন (বা একই জন) সেই তালিকা ধরে বাজার করেন। স্ক্রিন:
//   Home (চলমান / সম্পন্ন-ইতিহাস) · নতুন তালিকা (+ আগের তালিকা থেকে কপি) ·
//   এক পাতার চেকলিস্ট (দ্রুত পণ্য যোগ, অবস্থা, দাম, যোগাযোগ) · পণ্য আপডেট (অবস্থা/দাম/কারণ/বিকল্প) ·
//   সারাংশ ও সম্পন্ন করা · তালিকা সম্পাদনা।
// লজিক: js/family/family-shopping-core.js (window.FSCore, ইউনিট-টেস্টেড)।
// ডেটা: Firestore families/{f}/shoppingLists (+ /items) — firebase-init.js, নিরাপত্তা: firestore.rules।
// Needs (load order): React, family-shopping-core.js, family-bazar.js (window.FBShared).
// Exposes: window.FamilyShopping = { Home, renderSheet, isShopSheet, pendingForShopper, logic }
(function () {
  "use strict";
  const { useState, useEffect, useMemo } = React;
  const SH = window.FBShared;
  const C = window.FSCore;
  if (!SH || !C) { console.warn("family-shopping.js: needs family-shopping-core.js and family-bazar.js loaded first"); return; }
  const { h, bn, today, F, SERIF, S, Sheet, Empty, HBar, friendlyError, Core, taka, unitText, qtyText, dateBn, CallButtons } = SH;

  /* ------------------------------ small pieces ------------------------------ */
  const TONE = { success: ["var(--hk-success)", "#fff"], danger: ["var(--hk-danger)", "#fff"], warn: ["#c77d0a", "#fff"], info: ["#2f6fb5", "#fff"], gold: ["var(--hk-gold)", "#1a1a1a"], muted: ["var(--hk-border)", "var(--hk-text)"] };
  const statusChip = (st) => { const [bg, fg] = TONE[C.ITEM_STATUS_TONE[st]] || TONE.muted; return h("span", { style: S.pill(bg, fg) }, C.ITEM_STATUS_LABEL[st] || st); };
  const listChip = (l) => { const [bg, fg] = l.status === "completed" ? TONE.success : l.status === "partial" ? TONE.gold : TONE.info; return h("span", { style: S.pill(bg, fg) }, C.LIST_STATUS_LABEL[l.status] || l.status); };
  const money = (n) => (n == null ? "—" : taka(n));
  const errBox = (msgs) => (msgs && msgs.length ? h("div", { role: "alert", style: { color: "var(--hk-danger)", fontSize: 13, margin: "6px 0" } }, msgs.map((m, i) => h("div", { key: i }, "• " + m))) : null);
  const fieldErr = (e) => (e ? h("div", { role: "alert", style: { color: "var(--hk-danger)", fontSize: 12, marginTop: -4, marginBottom: 6 } }, e) : null);
  const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
  const catsOf = (ctx) => Core.allCategories(ctx.fam.categories);
  const catIcon = (ctx, id) => { const c = Core.categoryById(id, ctx.fam.categories); return c ? c.icon : "🏷️"; };
  const catName = (ctx, id) => { const c = Core.categoryById(id, ctx.fam.categories); return c ? c.name : ""; };
  const memberName = (ctx, uid, fallback) => { const m = (ctx.fam.members || []).find((x) => x.uid === uid); return (m && m.name) || fallback || "সদস্য"; };
  const activeMembers = (ctx) => (ctx.fam.members || []).filter((m) => m.status === "active");

  // live products of one list (its own Firestore sub-collection)
  function useShopItems(ctx, listId) {
    const [items, setItems] = useState(null);
    useEffect(() => {
      if (!ctx.familyId || !listId || !window.FB || !window.FB.subscribeShoppingItems) { setItems([]); return undefined; }
      setItems(null);
      const un = window.FB.subscribeShoppingItems(ctx.familyId, listId, (rows) => setItems(rows.slice().sort((a, b) => (a.order || 0) - (b.order || 0))));
      return () => { if (typeof un === "function") un(); };
    }, [ctx.familyId, listId]);
    return items;
  }
  const findList = (ctx, id) => (ctx.fam.shopLists || []).find((l) => l.id === id) || null;
  const run = async (setBusy, setErr, fn) => { setBusy(true); setErr([]); try { await fn(); setBusy(false); return true; } catch (e) { setErr([friendlyError(e)]); setBusy(false); return false; } };

  /* ================================ 1. HOME ================================ */
  function ShoppingHome({ ctx }) {
    const [tab, setTab] = useState("active");
    const lists = ctx.fam.shopLists || [];
    const shown = useMemo(() => C.filterLists(lists, tab), [lists, tab]);
    const nActive = lists.filter((l) => l.status === "in_progress").length, nHist = lists.length - nActive;
    const mine = C.pendingForShopper(lists, ctx.uid);
    const canCreate = C.canCreateList(ctx.me);
    return h("div", null,
      canCreate && h("button", { style: S.btn, onClick: () => ctx.openSheet({ type: "shop-create" }) }, "+ নতুন তালিকা তৈরি"),
      !canCreate && h("div", { style: Object.assign({}, S.card, S.muted) }, "আপনার শুধু দেখার অনুমতি আছে — নতুন তালিকা তৈরি করতে মালিক/এডমিনকে বলুন।"),
      mine > 0 && h("div", { style: Object.assign({}, S.card, { marginTop: 12, borderColor: "var(--hk-gold)" }) }, h("b", null, `🛒 আপনাকে ${bn(mine)}টি তালিকা দিয়ে বাজার করতে বলা হয়েছে`)),
      h("div", { role: "tablist", style: { display: "flex", gap: 4, background: "var(--hk-card)", border: "1px solid var(--hk-border)", borderRadius: 14, padding: 4, margin: "12px 0" } },
        [["active", `বাজার তালিকা (${bn(nActive)})`], ["history", `সম্পন্ন তালিকা (${bn(nHist)})`]].map(([k, label]) => h("button", { key: k, role: "tab", "aria-selected": tab === k, onClick: () => setTab(k),
          style: { flex: 1, minHeight: 42, border: "none", borderRadius: 10, fontFamily: F, fontWeight: 700, fontSize: 13, background: tab === k ? "var(--hk-gold)" : "transparent", color: tab === k ? "#1a1a1a" : "var(--hk-text-muted)" } }, label))),
      shown.length === 0 ? h(Empty, { icon: "🧾", title: tab === "active" ? "কোনো চলমান তালিকা নেই" : "এখনো কোনো সম্পন্ন তালিকা নেই",
          text: tab === "active" ? "নতুন তালিকা বানিয়ে পরিবারের কাউকে বাজার করতে দিন।" : "বাজার সম্পন্ন করলে তালিকা এখানে সংরক্ষিত থাকবে।", action: tab === "active" && canCreate ? "+ নতুন তালিকা তৈরি" : null, onAction: () => ctx.openSheet({ type: "shop-create" }) })
        : shown.map((l) => h(ListCard, { key: l.id, ctx, l })));
  }
  function ListCard({ ctx, l }) {
    const st = l.stats || C.listStats([]);
    const pct = C.progressPct(st);
    return h("button", { onClick: () => ctx.openSheet({ type: "shop-list", listId: l.id }), style: Object.assign({}, S.card, { display: "block", width: "100%", textAlign: "left", cursor: "pointer", fontFamily: F, color: "inherit" }) },
      h("div", { style: S.row }, h("b", { style: { fontSize: 15.5 } }, "🧾 " + l.title), listChip(l)),
      h("div", { style: Object.assign({}, S.muted, { marginTop: 3 }) }, `${dateBn(l.shoppingDate)}${l.shoppingTime ? " · " + l.shoppingTime : ""}`),
      h("div", { style: S.muted }, `তৈরি করেছেন: ${l.createdByName || memberName(ctx, l.createdBy)} → বাজার: ${l.assignedToName || memberName(ctx, l.assignedToUid)}${l.assignedToUid === ctx.uid ? " (আপনি)" : ""}`),
      h("div", { style: { margin: "8px 0 4px" } }, h(HBar, { pct, color: "var(--hk-success)" })),
      h("div", { style: S.row }, h("span", { style: S.muted }, `${bn(st.purchased)}/${bn(st.total)} কেনা হয়েছে · ${bn(pct)}%`), h("b", { style: { fontFamily: SERIF } }, "≈ " + taka(st.estTotal))));
  }

  /* ========================= 2. CREATE (or copy from a past list) ========================= */
  function CreateSheet({ ctx, close, from }) {
    const src = from ? findList(ctx, from) : null;
    const srcItems = useShopItems(ctx, src ? src.id : null);
    const members = activeMembers(ctx);
    const others = members.filter((m) => m.uid !== ctx.uid);
    const [title, setTitle] = useState(src ? src.title : "");
    const [date, setDate] = useState(today());
    const [time, setTime] = useState("");
    const [to, setTo] = useState(src ? src.assignedToUid : (others[0] ? others[0].uid : ctx.uid));
    const [note, setNote] = useState("");
    const [copyProducts, setCopyProducts] = useState(true), [copyQtyPrice, setCopyQtyPrice] = useState(true);
    const [errors, setErrors] = useState({}); const [errs, setErrs] = useState([]); const [busy, setBusy] = useState(false);
    const meName = (ctx.me && ctx.me.name) || (ctx.user && (ctx.user.displayName || ctx.user.email)) || "সদস্য";

    const submit = () => {
      if (busy) return;
      const v = C.validateListDraft({ title, shoppingDate: date, shoppingTime: time, assignedToUid: to, note });
      const toM = members.find((m) => m.uid === to);
      if (!v.ok || !toM) { setErrors(Object.assign({}, v.errors, toM ? {} : { assignedToUid: "বাজার করার সদস্য বেছে নিন" })); return; }
      setErrors({});
      let items = [];
      if (src) {
        const d = C.copyDraft(src, srcItems || [], { copyProducts, copyQtyPrice, newTitle: title });
        for (const r of d.rows) { const rv = C.validateItemDraft(r); if (rv.ok) items.push(rv.item); }
      }
      const list = C.buildList(Object.assign({ familyId: ctx.familyId, createdBy: ctx.uid, createdByName: meName, assignedToName: toM.name || "সদস্য", items, copiedFrom: src ? src.id : null }, v.fields));
      run(setBusy, setErrs, async () => {
        await window.FB.createShoppingList(ctx.familyId, list, items);
        ctx.toast(src ? "আগের তালিকা থেকে নতুন তালিকা তৈরি হয়েছে ✓" : "তালিকা তৈরি হয়েছে — এবার পণ্য যোগ করুন ✓");
        close(); ctx.openSheet({ type: "shop-list", listId: list.id });
      });
    };
    return h(Sheet, { title: src ? "আগের তালিকা থেকে তৈরি" : "নতুন বাজার তালিকা", onClose: close,
      footer: h("div", null, errBox(errs), h("button", { style: S.btn, disabled: busy || (src && srcItems === null), onClick: submit }, busy ? "তৈরি হচ্ছে…" : src ? "তৈরি করুন" : "তৈরি করে পণ্য যোগ করুন")) },
      src && h("div", { style: S.card },
        h("div", { style: Object.assign({}, S.muted, { marginBottom: 8 }) }, `"${src.title}" তালিকা থেকে:`),
        [[copyProducts, setCopyProducts, "পণ্য কপি করুন"], [copyQtyPrice, setCopyQtyPrice, "পরিমাণ ও দাম কপি করুন"]].map(([v, set, label], i) =>
          h("label", { key: i, style: { display: "flex", alignItems: "center", gap: 10, minHeight: 40 } }, h("input", { type: "checkbox", checked: v, disabled: i === 1 && !copyProducts, onChange: (e) => set(e.target.checked), style: { width: 20, height: 20 } }), label))),
      h("label", { style: S.label }, "তালিকার নাম *"), h("input", { style: S.input, value: title, maxLength: 60, placeholder: "আজকের বাজার / সাপ্তাহিক বাজার / বিশেষ বাজার", onChange: (e) => setTitle(e.target.value) }), fieldErr(errors.title),
      h("div", { style: grid2 },
        h("div", null, h("label", { style: S.label }, "বাজারের তারিখ *"), h("input", { style: S.input, type: "date", value: date, onChange: (e) => setDate(e.target.value) }), fieldErr(errors.shoppingDate)),
        h("div", null, h("label", { style: S.label }, "সম্ভাব্য সময়"), h("input", { style: S.input, type: "time", value: time, onChange: (e) => setTime(e.target.value) }), fieldErr(errors.shoppingTime))),
      h("label", { style: S.label }, "বাজার করার দায়িত্বপ্রাপ্ত সদস্য *"),
      h("select", { style: S.input, value: to, onChange: (e) => setTo(e.target.value) },
        others.map((m) => h("option", { key: m.uid, value: m.uid }, m.name || m.email || "সদস্য")), h("option", { value: ctx.uid }, "নিজে (আমি)")),
      fieldErr(errors.assignedToUid),
      h("div", { style: Object.assign({}, S.muted, { marginBottom: 8 }) }, `তালিকা তৈরিকারী: ${meName}`),
      h("label", { style: S.label }, "মন্তব্য (ঐচ্ছিক)"),
      h("textarea", { style: Object.assign({}, S.input, { minHeight: 64 }), value: note, maxLength: 300, placeholder: "যেমন: মাছ, ডিম, সবজি অবশ্যই নেবেন", onChange: (e) => setNote(e.target.value) }));
  }

  /* ========================= 3. ONE-PAGE LIST (checklist) ========================= */
  function QuickAdd({ ctx, list, items }) {
    const cats = catsOf(ctx);
    const blank = () => C.blankItemDraft();
    const [d, setD] = useState(blank); const [touched, setTouched] = useState(false);
    const [errors, setErrors] = useState({}); const [err, setErr] = useState([]); const [busy, setBusy] = useState(false);
    const set = (p) => setD((x) => Object.assign({}, x, p));
    const onName = (v) => { const guess = !touched ? Core.guessCategoryId(v, ctx.fam.categories) : null; set(guess ? { name: v, categoryId: guess } : { name: v }); };
    const add = () => {
      if (busy) return;
      const v = C.validateItemDraft(d);
      if (!v.ok) { setErrors(v.errors); return; }
      if (items.length >= 200) { setErr(["একটি তালিকায় সর্বোচ্চ ২০০টি পণ্য রাখা যায়"]); return; }
      setErrors({});
      const item = Object.assign(v.item, { order: items.length });
      run(setBusy, setErr, async () => {
        await window.FB.addShoppingItem(ctx.familyId, list.id, item, C.listStats(items.concat([item])));
        // ready for the next product at once: keep category + unit, clear the rest
        setD((x) => Object.assign(blank(), { categoryId: x.categoryId, unit: x.unit })); setTouched(false);
      });
    };
    return h("div", { style: S.card },
      h("div", { style: { fontWeight: 700, marginBottom: 8 } }, "➕ পণ্য যোগ করুন"),
      h("input", { style: S.input, value: d.name, maxLength: 60, placeholder: "পণ্যের নাম (যেমন: চাল)", "aria-label": "পণ্যের নাম", onChange: (e) => onName(e.target.value), onKeyDown: (e) => { if (e.key === "Enter") add(); } }), fieldErr(errors.name),
      h("select", { style: S.input, value: d.categoryId, "aria-label": "ক্যাটাগরি", onChange: (e) => { setTouched(true); set({ categoryId: e.target.value }); } },
        h("option", { value: "" }, "ক্যাটাগরি বেছে নিন *"), cats.map((c) => h("option", { key: c.id, value: c.id }, `${c.icon} ${c.name}`))), fieldErr(errors.categoryId),
      h("div", { style: grid2 },
        h("div", null, h("input", { style: S.input, inputMode: "decimal", value: d.quantity, placeholder: "পরিমাণ (যেমন ২)", "aria-label": "পরিমাণ", onChange: (e) => set({ quantity: e.target.value }) }), fieldErr(errors.quantity)),
        h("div", null, h("select", { style: S.input, value: d.unit, "aria-label": "একক", onChange: (e) => set({ unit: e.target.value }) }, C.UNITS.map((u) => h("option", { key: u, value: u }, unitText(u)))), fieldErr(errors.unit))),
      h("input", { style: S.input, inputMode: "decimal", value: d.estUnitPrice, placeholder: "আনুমানিক একক দাম ৳ (ঐচ্ছিক)", "aria-label": "আনুমানিক একক দাম", onChange: (e) => set({ estUnitPrice: e.target.value }) }), fieldErr(errors.estUnitPrice),
      h("input", { style: S.input, value: d.note, maxLength: 200, placeholder: "মন্তব্য (ঐচ্ছিক, যেমন: ভালো মানের)", "aria-label": "মন্তব্য", onChange: (e) => set({ note: e.target.value }) }),
      errBox(err),
      h("button", { style: S.btn, disabled: busy, onClick: add }, busy ? "যোগ হচ্ছে…" : "যোগ করুন"));
  }

  // the add form takes a lot of screen: open at once for a brand-new (empty) list,
  // otherwise folded away so the shopper sees the checklist first
  function AddProducts({ ctx, list, items }) {
    const [open, setOpen] = useState(items.length === 0);
    return open
      ? h("div", null, h(QuickAdd, { ctx, list, items }), items.length > 0 && h("button", { style: Object.assign({}, S.btn2, { width: "100%", marginBottom: 10 }), onClick: () => setOpen(false) }, "▲ ফর্ম বন্ধ করুন"))
      : h("button", { style: Object.assign({}, S.btn2, { width: "100%", marginBottom: 10 }), onClick: () => setOpen(true) }, "➕ পণ্য যোগ করুন");
  }

  function ItemCard({ ctx, list, it, canShop, onToggle }) {
    const est = C.estLineTotal(it), act = C.actualLineTotal(it), purchased = C.isPurchased(it), noPrice = C.needsPrice(it);
    const checked = it.status === "bought" || it.status === "alternative";
    const open = () => ctx.openSheet({ type: "shop-item", listId: list.id, itemId: it.id });
    return h("div", { style: Object.assign({}, S.card, { padding: "12px 12px", opacity: it.status === "cancelled" ? 0.6 : 1 }) },
      h("div", { style: { display: "flex", alignItems: "flex-start", gap: 10 } },
        h("button", { role: "checkbox", "aria-checked": checked, "aria-label": it.name + (checked ? " — কেনা হয়েছে" : " — কেনা বাকি"), disabled: !canShop || it.status === "cancelled", onClick: () => onToggle(it),
          style: { width: 32, height: 32, minWidth: 32, borderRadius: 8, border: "2px solid " + (checked ? "var(--hk-success)" : "var(--hk-border-strong)"), background: checked ? "var(--hk-success)" : "transparent", color: "#fff", fontSize: 18, lineHeight: 1, marginTop: 2 } }, checked ? "✓" : ""),
        h("button", { onClick: open, "aria-label": it.name + " — বিস্তারিত", style: { flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, fontFamily: F, color: "inherit", cursor: "pointer" } },
          h("div", { style: S.row }, h("b", { style: { fontSize: 15, textDecoration: it.status === "cancelled" ? "line-through" : "none" } }, `${catIcon(ctx, it.categoryId)} ${it.name}`), statusChip(it.status)),
          h("div", { style: S.muted }, [it.quantity != null ? `${qtyText(it.quantity)} ${unitText(it.unit)}` : "পরিমাণ নেই", it.estUnitPrice != null ? `আনু. ${taka(it.estUnitPrice)}/${unitText(it.unit)}` : null, est != null ? `মোট ≈ ${taka(est)}` : null].filter(Boolean).join(" · ")),
          purchased && h("div", { style: { fontSize: 13, marginTop: 3 } }, noPrice ? h("span", { style: { color: "var(--hk-danger)", fontWeight: 600 } }, "⚠ প্রকৃত দাম দেওয়া হয়নি") : h("span", null, "প্রকৃত: ", h("b", null, taka(act)))),
          it.status === "alternative" && it.alternative && h("div", { style: { fontSize: 13, marginTop: 2 } }, `বিকল্প: ${it.alternative.name}${it.alternative.quantity != null ? " · " + qtyText(it.alternative.quantity) + " " + unitText(it.alternative.unit) : ""}`),
          it.note && h("div", { style: Object.assign({}, S.muted, { marginTop: 3 }) }, "📝 " + it.note),
          it.reason && h("div", { style: Object.assign({}, S.muted, { marginTop: 2 }) }, "💬 " + it.reason))));
  }

  function ContactBox({ ctx, list }) {
    const people = [["তালিকা প্রস্তুতকারী", list.createdBy, list.createdByName], ["বাজার করার দায়িত্বে", list.assignedToUid, list.assignedToName]];
    return h("div", { style: S.card },
      people.map(([role, uid, name], i) => {
        const m = (ctx.fam.members || []).find((x) => x.uid === uid); const me = uid === ctx.uid;
        return h("div", { key: i, style: { paddingBottom: i === 0 ? 10 : 0, marginBottom: i === 0 ? 10 : 0, borderBottom: i === 0 ? "1px solid var(--hk-border)" : "none" } },
          h("div", { style: S.muted }, role), h("div", { style: { fontWeight: 700 } }, (m && m.name) || name || "সদস্য", me ? " (আপনি)" : ""),
          // the number is shown only to members of this family and only if that member saved one (same rule as the member screen)
          !me && m && m.phone ? h(CallButtons, { phone: m.phone }) : null);
      }));
  }

  function ListSheet({ ctx, listId, close }) {
    const list = findList(ctx, listId);
    const items = useShopItems(ctx, listId);
    const [filter, setFilter] = useState("all"); const [err, setErr] = useState([]); const [busy, setBusy] = useState(false);
    if (!list) return h(Sheet, { title: "বাজার তালিকা", onClose: close }, h(Empty, { icon: "🧾", title: "তালিকাটি পাওয়া যায়নি", text: "এটি মুছে ফেলা হয়ে থাকতে পারে।" }));
    const m = ctx.me, uid = ctx.uid;
    const canShop = C.canShop(list, m, uid), canEdit = C.canEditStructure(list, m, uid), canDel = C.canDeleteList(list, m, uid);
    const rows = items || [];
    const st = C.listStats(rows); const pct = C.progressPct(st);
    const counts = { all: rows.length, pending: rows.filter((i) => i.status === "pending").length };
    C.ITEM_STATUS.forEach((s) => { if (s !== "pending") counts[s] = rows.filter((i) => i.status === s).length; });
    const shownRows = filter === "all" ? rows : rows.filter((i) => i.status === filter);
    const toggle = (it) => {
      if (busy) return;
      if (it.status !== "pending" && it.status !== "bought") { ctx.openSheet({ type: "shop-item", listId, itemId: it.id }); return; }
      const next = it.status === "bought" ? { status: "pending", actualUnitPrice: null, actualQuantity: null, alternative: null, reason: "" } : { status: "bought", actualUnitPrice: it.actualUnitPrice, actualQuantity: it.actualQuantity, alternative: null, reason: "" };
      const nextRows = rows.map((r) => (r.id === it.id ? Object.assign({}, r, next) : r));
      run(setBusy, setErr, () => window.FB.updateShoppingItem(ctx.familyId, listId, it.id, next, C.listStats(nextRows)));
    };
    const remove = () => {
      if (!window.confirm(`"${list.title}" তালিকাটি এবং এর সব পণ্য মুছে ফেলবেন? এটি ফেরানো যাবে না।`)) return;
      run(setBusy, setErr, async () => { await window.FB.deleteShoppingList(ctx.familyId, listId, rows.map((r) => r.id)); ctx.toast("তালিকা মুছে ফেলা হয়েছে"); close(); });
    };
    const addToAccounts = () => ctx.openSheet({ type: "purchase", seed: C.purchaseSeed(rows) });
    const reopen = () => run(setBusy, setErr, () => window.FB.updateShoppingList(ctx.familyId, listId, { status: "in_progress", completedAt: null, completedBy: null }));
    const chips = [["all", "সব"]].concat(["pending", "bought", "not_found", "too_expensive", "alternative", "awaiting", "cancelled"].filter((s) => counts[s] > 0).map((s) => [s, C.ITEM_STATUS_LABEL[s]]));

    return h(Sheet, { title: list.title, onClose: close,
      footer: canShop ? h("div", null, errBox(err), h("button", { style: S.btn, disabled: busy || items === null, onClick: () => ctx.openSheet({ type: "shop-summary", listId }) }, "বাজার সম্পন্ন করুন")) : null },
      h("div", { style: Object.assign({}, S.hero, { textAlign: "center" }) },
        h("div", { style: S.muted }, `${dateBn(list.shoppingDate)}${list.shoppingTime ? " · " + list.shoppingTime : ""}`),
        h("div", { style: { margin: "8px 0 4px" } }, h(HBar, { pct, color: "var(--hk-success)" })),
        h("div", { style: { fontWeight: 700 } }, `${bn(st.purchased)}/${bn(st.total)} কেনা হয়েছে · ${bn(pct)}%`),
        h("div", { style: { marginTop: 8 } }, listChip(list))),
      list.note && h("div", { style: S.card }, h("div", { style: S.muted }, "📝 " + list.note)),
      h(ContactBox, { ctx, list }),
      canEdit && items !== null && h(AddProducts, { ctx, list, items: rows }),
      items === null ? h("div", { style: S.muted }, "পণ্য লোড হচ্ছে…")
        : rows.length === 0 ? h(Empty, { icon: "🛒", title: "এখনো কোনো পণ্য নেই", text: canEdit ? "ওপরের ফর্মে পণ্য লিখে \"যোগ করুন\" চাপুন।" : "তালিকা প্রস্তুতকারী পণ্য যোগ করলে এখানে দেখা যাবে।" })
        : h("div", null,
          // chips wrap onto several lines — no sideways scrolling on a phone
          h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 } }, chips.map(([k, label]) => h("button", { key: k, onClick: () => setFilter(k), "aria-pressed": filter === k, style: S.chip(filter === k) }, `${label} (${bn(counts[k])})`))),
          shownRows.map((it) => h(ItemCard, { key: it.id, ctx, list, it, canShop, onToggle: toggle }))),
      !canShop && list.status === "in_progress" && h("div", { style: Object.assign({}, S.card, S.muted) }, "এই তালিকা শুধু দেখার জন্য — শুধু বাজার করার দায়িত্বপ্রাপ্ত সদস্য ও তালিকা প্রস্তুতকারী পণ্যের অবস্থা বদলাতে পারেন।"),
      h("div", { style: S.card },
        h("div", { style: { fontWeight: 700, marginBottom: 8 } }, "সারাংশ"),
        [["মোট পণ্য", bn(st.total)], ["কেনা হয়েছে", bn(st.purchased)], ["কেনা বাকি", bn(st.pending)], ["পাওয়া যায়নি", bn(st.notFound)]].map(([a, b], i) => h("div", { key: i, style: Object.assign({}, S.row, { marginBottom: 4 }) }, h("span", { style: S.muted }, a), h("b", null, b))),
        h("div", { style: Object.assign({}, S.row, { marginTop: 8 }) }, h("span", { style: S.muted }, "আনুমানিক মোট খরচ"), h("b", { style: { fontFamily: SERIF } }, taka(st.estTotal))),
        h("div", { style: S.row }, h("span", { style: S.muted }, "কেনা পণ্যের প্রকৃত খরচ"), h("b", { style: { fontFamily: SERIF } }, taka(st.actualTotal))),
        st.incompletePrice > 0 && h("div", { style: { color: "var(--hk-danger)", fontSize: 12.5, marginTop: 6 } }, `⚠ ${bn(st.incompletePrice)}টি কেনা পণ্যের প্রকৃত দাম দেওয়া হয়নি — এগুলো প্রকৃত খরচে ধরা হয়নি।`)),
      h("div", { style: { display: "grid", gap: 8, marginTop: 4 } },
        list.status !== "in_progress" && ctx.vis.write && h("button", { style: S.btn2, onClick: () => ctx.openSheet({ type: "shop-create", from: listId }) }, "↻ এই তালিকা থেকে নতুন তালিকা"),
        list.status !== "in_progress" && ctx.vis.write && st.purchased > 0 && h("button", { style: S.btn2, onClick: addToAccounts }, "💰 বাজারের হিসাবে যোগ করুন"),
        canEdit && h("button", { style: S.btn2, onClick: () => ctx.openSheet({ type: "shop-edit", listId }) }, "✏️ তালিকার তথ্য সম্পাদনা"),
        C.canReopen(list, m) && h("button", { style: S.btn2, disabled: busy, onClick: reopen }, "↩ আবার চালু করুন"),
        canDel && h("button", { style: Object.assign({}, S.danger, { width: "100%" }), disabled: busy, onClick: remove }, "🗑 তালিকা মুছুন")));
  }

  /* ==================== 4. UPDATE ONE PRODUCT (status / price / reason / alternative) ==================== */
  function ItemSheet({ ctx, listId, itemId, close }) {
    const list = findList(ctx, listId); const items = useShopItems(ctx, listId);
    const it = (items || []).find((x) => x.id === itemId);
    if (!list || !it) return h(Sheet, { title: "পণ্য", onClose: close }, items === null ? h("div", { style: S.muted }, "লোড হচ্ছে…") : h(Empty, { icon: "🛒", title: "পণ্যটি পাওয়া যায়নি", text: "" }));
    return h(ItemForm, { key: it.id + ":" + (it.updatedAt || ""), ctx, list, it, items, close });
  }
  function ItemForm({ ctx, list, it, items, close }) {
    const canShop = C.canShop(list, ctx.me, ctx.uid), canEdit = C.canEditStructure(list, ctx.me, ctx.uid);
    const [status, setStatus] = useState(it.status);
    const [price, setPrice] = useState(it.actualUnitPrice != null ? String(it.actualUnitPrice) : "");
    const [qty, setQty] = useState(it.actualQuantity != null ? String(it.actualQuantity) : "");
    const [reason, setReason] = useState(it.reason || "");
    const alt0 = it.alternative || {};
    const [altName, setAltName] = useState(alt0.name || ""), [altQty, setAltQty] = useState(alt0.quantity != null ? String(alt0.quantity) : ""), [altPrice, setAltPrice] = useState(alt0.unitPrice != null ? String(alt0.unitPrice) : "");
    const [errors, setErrors] = useState({}); const [err, setErr] = useState([]); const [busy, setBusy] = useState(false);
    const cats = catsOf(ctx);
    const [e, setE] = useState({ name: it.name, categoryId: it.categoryId, quantity: it.quantity != null ? String(it.quantity) : "", unit: it.unit, estUnitPrice: it.estUnitPrice != null ? String(it.estUnitPrice) : "", note: it.note || "" });
    const [eErrors, setEErrors] = useState({});
    const live = C.actualLineTotal(Object.assign({}, it, { status, actualUnitPrice: C.parseNum(price) >= 0 ? C.parseNum(price) : null, actualQuantity: C.parseNum(qty) > 0 ? C.parseNum(qty) : null, alternative: status === "alternative" ? { name: altName, quantity: C.parseNum(altQty) > 0 ? C.parseNum(altQty) : null, unitPrice: C.parseNum(altPrice) >= 0 ? C.parseNum(altPrice) : null } : null }));
    const statuses = C.SHOPPER_STATUSES.concat(canEdit ? ["cancelled"] : []);
    const apply = (patch) => { const nextRows = items.map((r) => (r.id === it.id ? Object.assign({}, r, patch) : r)); return window.FB.updateShoppingItem(ctx.familyId, list.id, it.id, patch, C.listStats(nextRows)); };

    const saveStatus = () => {
      if (busy) return;
      const v = C.validateStatusUpdate(it, { status, actualUnitPrice: price, actualQuantity: qty, reason, alternative: { name: altName, quantity: altQty, unitPrice: altPrice, unit: it.unit } }, { manager: canEdit });
      if (!v.ok) { setErrors(v.errors); return; }
      setErrors({});
      run(setBusy, setErr, async () => { await apply(v.patch); ctx.toast("সংরক্ষিত হয়েছে ✓"); close(); });
    };
    const saveInfo = () => {
      if (busy) return;
      const v = C.validateItemDraft(Object.assign({ id: it.id }, e));
      if (!v.ok) { setEErrors(v.errors); return; }
      setEErrors({});
      const { name, categoryId, quantity, unit, estUnitPrice, note } = v.item;
      run(setBusy, setErr, async () => { await apply({ name, categoryId, quantity, unit, estUnitPrice, note }); ctx.toast("পণ্যের তথ্য সংরক্ষিত হয়েছে ✓"); close(); });
    };
    const radio = (s) => h("label", { key: s, style: { display: "flex", alignItems: "center", gap: 10, minHeight: 44, padding: "6px 10px", borderRadius: 10, border: "1px solid " + (status === s ? "var(--hk-gold)" : "var(--hk-border)"), marginBottom: 6, opacity: canShop ? 1 : 0.6 } },
      h("input", { type: "radio", name: "st", checked: status === s, disabled: !canShop, onChange: () => setStatus(s), style: { width: 20, height: 20 } }), h("span", { style: { flex: 1 } }, s === "cancelled" ? "বাতিল (কারণসহ)" : C.ITEM_STATUS_LABEL[s]), statusChip(s));

    return h(Sheet, { title: "পণ্য আপডেট", onClose: close, footer: canShop ? h("div", null, errBox(err), h("button", { style: S.btn, disabled: busy, onClick: saveStatus }, busy ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ করুন")) : null },
      h("div", { style: S.card },
        h("div", { style: { fontWeight: 700, fontSize: 16 } }, `${catIcon(ctx, it.categoryId)} ${it.name}`),
        h("div", { style: S.muted }, [it.quantity != null ? `${qtyText(it.quantity)} ${unitText(it.unit)}` : "পরিমাণ নেই", it.estUnitPrice != null ? `আনু. ${taka(it.estUnitPrice)}/${unitText(it.unit)}` : "আনুমানিক দাম নেই", catName(ctx, it.categoryId)].filter(Boolean).join(" · ")),
        it.note && h("div", { style: Object.assign({}, S.muted, { marginTop: 4 }) }, "📝 নির্দেশনা: " + it.note)),
      !canShop && h("div", { style: Object.assign({}, S.card, S.muted) }, list.status !== "in_progress" ? "তালিকা সম্পন্ন হয়ে গেছে — আর বদলানো যাবে না।" : "শুধু বাজার করার দায়িত্বপ্রাপ্ত সদস্য ও তালিকা প্রস্তুতকারী অবস্থা বদলাতে পারেন।"),
      h("label", { style: S.label }, "অবস্থা নির্বাচন করুন *"), statuses.map(radio), fieldErr(errors.status),
      status === "bought" && h("div", null,
        h("div", { style: grid2 },
          h("div", null, h("label", { style: S.label }, "প্রকৃত একক দাম (৳)"), h("input", { style: S.input, inputMode: "decimal", disabled: !canShop, value: price, placeholder: it.estUnitPrice != null ? String(it.estUnitPrice) : "দাম", onChange: (ev) => setPrice(ev.target.value) }), fieldErr(errors.actualUnitPrice)),
          h("div", null, h("label", { style: S.label }, `কেনা পরিমাণ (${unitText(it.unit)})`), h("input", { style: S.input, inputMode: "decimal", disabled: !canShop, value: qty, placeholder: it.quantity != null ? String(it.quantity) : "পরিমাণ", onChange: (ev) => setQty(ev.target.value) }), fieldErr(errors.actualQuantity))),
        h("div", { style: Object.assign({}, S.row, { marginBottom: 8 }) }, h("span", { style: S.muted }, "মোট দাম"), h("b", { style: { fontFamily: SERIF } }, live == null ? "দাম দিলে হিসাব হবে" : taka(live)))),
      status === "alternative" && h("div", null,
        h("label", { style: S.label }, "বিকল্প পণ্যের নাম *"), h("input", { style: S.input, value: altName, maxLength: 60, disabled: !canShop, placeholder: "যেমন: ইলিশ (ফ্রোজেন)", onChange: (ev) => setAltName(ev.target.value) }), fieldErr(errors.altName),
        h("div", { style: grid2 },
          h("div", null, h("label", { style: S.label }, "কেনা পরিমাণ"), h("input", { style: S.input, inputMode: "decimal", disabled: !canShop, value: altQty, placeholder: "যেমন ১", onChange: (ev) => setAltQty(ev.target.value) }), fieldErr(errors.altQuantity)),
          h("div", null, h("label", { style: S.label }, "প্রকৃত একক দাম (৳)"), h("input", { style: S.input, inputMode: "decimal", disabled: !canShop, value: altPrice, placeholder: "যেমন ২৮০", onChange: (ev) => setAltPrice(ev.target.value) }), fieldErr(errors.altUnitPrice))),
        h("div", { style: Object.assign({}, S.row, { marginBottom: 8 }) }, h("span", { style: S.muted }, "মোট দাম"), h("b", { style: { fontFamily: SERIF } }, live == null ? "দাম দিলে হিসাব হবে" : taka(live)))),
      status !== "pending" && h("div", null,
        h("label", { style: S.label }, status === "cancelled" ? "বাতিলের কারণ *" : "কারণ / মন্তব্য (ঐচ্ছিক)"),
        h("textarea", { style: Object.assign({}, S.input, { minHeight: 64 }), value: reason, maxLength: 300, disabled: !canShop, placeholder: status === "not_found" ? "যেমন: আজকে বাজারে মাছ ছিল না।" : status === "too_expensive" ? "যেমন: দাম নির্ধারিত বাজেটের চেয়ে বেশি।" : "মন্তব্য লিখুন", onChange: (ev) => setReason(ev.target.value) }), fieldErr(errors.reason)),
      canEdit && h("details", { style: Object.assign({}, S.card, { marginTop: 12 }) },
        h("summary", { style: { fontWeight: 700, cursor: "pointer", minHeight: 36 } }, "✏️ পণ্যের তথ্য সম্পাদনা (তালিকা প্রস্তুতকারী)"),
        h("div", { style: { marginTop: 10 } },
          h("input", { style: S.input, value: e.name, maxLength: 60, "aria-label": "পণ্যের নাম", onChange: (ev) => setE((x) => Object.assign({}, x, { name: ev.target.value })) }), fieldErr(eErrors.name),
          h("select", { style: S.input, value: e.categoryId, "aria-label": "ক্যাটাগরি", onChange: (ev) => setE((x) => Object.assign({}, x, { categoryId: ev.target.value })) }, h("option", { value: "" }, "ক্যাটাগরি *"), cats.map((c) => h("option", { key: c.id, value: c.id }, `${c.icon} ${c.name}`))), fieldErr(eErrors.categoryId),
          h("div", { style: grid2 },
            h("input", { style: S.input, inputMode: "decimal", value: e.quantity, placeholder: "পরিমাণ", "aria-label": "পরিমাণ", onChange: (ev) => setE((x) => Object.assign({}, x, { quantity: ev.target.value })) }),
            h("select", { style: S.input, value: e.unit, "aria-label": "একক", onChange: (ev) => setE((x) => Object.assign({}, x, { unit: ev.target.value })) }, C.UNITS.map((u) => h("option", { key: u, value: u }, unitText(u))))),
          fieldErr(eErrors.quantity),
          h("input", { style: S.input, inputMode: "decimal", value: e.estUnitPrice, placeholder: "আনুমানিক একক দাম", "aria-label": "আনুমানিক একক দাম", onChange: (ev) => setE((x) => Object.assign({}, x, { estUnitPrice: ev.target.value })) }), fieldErr(eErrors.estUnitPrice),
          h("input", { style: S.input, value: e.note, maxLength: 200, placeholder: "মন্তব্য / নির্দেশনা", "aria-label": "মন্তব্য", onChange: (ev) => setE((x) => Object.assign({}, x, { note: ev.target.value })) }),
          h("button", { style: S.btn2, disabled: busy, onClick: saveInfo }, "তথ্য সংরক্ষণ করুন"))));
  }

  /* ============================ 5. SUMMARY & COMPLETE ============================ */
  function SummarySheet({ ctx, listId, close }) {
    const list = findList(ctx, listId); const items = useShopItems(ctx, listId);
    const [err, setErr] = useState([]); const [busy, setBusy] = useState(false);
    if (!list || items === null) return h(Sheet, { title: "তালিকার সারাংশ", onClose: close }, h("div", { style: S.muted }, "লোড হচ্ছে…"));
    const st = C.listStats(items); const next = C.completionStatus(st);
    const undecided = items.filter((i) => i.status === "pending" || i.status === "awaiting");
    const canShop = C.canShop(list, ctx.me, ctx.uid);
    const finish = () => run(setBusy, setErr, async () => {
      await window.FB.updateShoppingList(ctx.familyId, listId, { status: next, stats: st, completedAt: new Date().toISOString(), completedBy: ctx.uid });
      ctx.toast(next === "completed" ? "বাজার সম্পন্ন হয়েছে ✓" : "তালিকা আংশিক সম্পন্ন হিসেবে সংরক্ষিত হয়েছে ✓"); close();
    });
    const pct = C.progressPct(st);
    const cell = (label, val, tone) => h("div", { style: { background: "var(--hk-card)", border: "1px solid var(--hk-border)", borderRadius: 12, padding: "10px 6px", textAlign: "center" } }, h("div", { style: Object.assign({}, S.muted, { fontSize: 11.5 }) }, label), h("div", { style: { fontFamily: SERIF, fontSize: 22, color: tone || "inherit" } }, bn(val)));
    return h(Sheet, { title: "তালিকার সারাংশ", onClose: close,
      footer: canShop ? h("div", null, errBox(err), h("button", { style: S.btn, disabled: busy, onClick: finish }, busy ? "সংরক্ষণ হচ্ছে…" : "নিশ্চিত করে বাজার সম্পন্ন করুন")) : null },
      h("div", { style: Object.assign({}, S.hero, { textAlign: "center" }) }, h("div", { style: { fontFamily: SERIF, fontSize: 18 } }, list.title), h("div", { style: { margin: "8px 0 4px" } }, h(HBar, { pct, color: "var(--hk-success)" })), h("div", null, `${bn(pct)}% সম্পন্ন`)),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 } },
        cell("মোট পণ্য", st.total), cell("কেনা হয়েছে", st.purchased, "var(--hk-success)"), cell("কেনা বাকি", st.pending), cell("পাওয়া যায়নি", st.notFound, "var(--hk-danger)"), cell("দাম বেশি", st.tooExpensive, "#c77d0a"), cell("অসম্পূর্ণ দাম", st.incompletePrice, "var(--hk-danger)")),
      h("div", { style: S.card },
        h("div", { style: S.row }, h("span", { style: S.muted }, "আনুমানিক মোট খরচ"), h("b", { style: { fontFamily: SERIF } }, taka(st.estTotal))),
        h("div", { style: Object.assign({}, S.row, { marginTop: 6 }) }, h("span", { style: S.muted }, "কেনা পণ্যের প্রকৃত খরচ"), h("b", { style: { fontFamily: SERIF } }, taka(st.actualTotal))),
        st.awaiting > 0 && h("div", { style: Object.assign({}, S.muted, { marginTop: 6 }) }, `${bn(st.awaiting)}টি পণ্য ক্রেতার মন্তব্যের অপেক্ষায়`),
        st.cancelled > 0 && h("div", { style: S.muted }, `${bn(st.cancelled)}টি পণ্য বাতিল (হিসাবে ধরা হয়নি)`),
        st.incompletePrice > 0 && h("div", { style: { color: "var(--hk-danger)", fontSize: 12.5, marginTop: 6 } }, `⚠ ${bn(st.incompletePrice)}টি কেনা পণ্যের প্রকৃত দাম নেই — এগুলো প্রকৃত খরচে ধরা হয়নি।`)),
      undecided.length > 0 && h("div", { style: Object.assign({}, S.card, { borderColor: "var(--hk-danger)" }) },
        h("div", { style: { fontWeight: 700, color: "var(--hk-danger)", marginBottom: 6 } }, `${bn(undecided.length)}টি পণ্যের সিদ্ধান্ত বাকি — কোনোটা বাদ পড়েনি তো?`),
        undecided.map((i) => h("div", { key: i.id, style: S.muted }, `• ${i.name} — ${C.ITEM_STATUS_LABEL[i.status]}`))),
      h("div", { style: S.muted }, next === "completed" ? "সব পণ্যের সিদ্ধান্ত হয়েছে — তালিকা \"সম্পন্ন\" হিসেবে ইতিহাসে সংরক্ষিত হবে।" : "সিদ্ধান্ত বাকি থাকা পণ্যসহ তালিকা \"আংশিক সম্পন্ন\" হিসেবে ইতিহাসে সংরক্ষিত হবে।"));
  }

  /* ================================ 6. EDIT LIST ================================ */
  function EditSheet({ ctx, listId, close }) {
    const list = findList(ctx, listId);
    const members = activeMembers(ctx);
    const [title, setTitle] = useState(list ? list.title : ""), [date, setDate] = useState(list ? list.shoppingDate : today()), [time, setTime] = useState(list && list.shoppingTime ? list.shoppingTime : ""), [to, setTo] = useState(list ? list.assignedToUid : ""), [note, setNote] = useState(list ? list.note || "" : "");
    const [errors, setErrors] = useState({}); const [err, setErr] = useState([]); const [busy, setBusy] = useState(false);
    if (!list) return h(Sheet, { title: "তালিকা সম্পাদনা", onClose: close }, h(Empty, { icon: "🧾", title: "তালিকাটি পাওয়া যায়নি", text: "" }));
    const save = () => {
      const v = C.validateListDraft({ title, shoppingDate: date, shoppingTime: time, assignedToUid: to, note }); const toM = members.find((m) => m.uid === to);
      if (!v.ok || !toM) { setErrors(Object.assign({}, v.errors, toM ? {} : { assignedToUid: "বাজার করার সদস্য বেছে নিন" })); return; }
      setErrors({});
      run(setBusy, setErr, async () => { await window.FB.updateShoppingList(ctx.familyId, listId, Object.assign({}, v.fields, { assignedToName: toM.name || "সদস্য" })); ctx.toast("সংরক্ষিত হয়েছে ✓"); close(); });
    };
    return h(Sheet, { title: "তালিকা সম্পাদনা", onClose: close, footer: h("div", null, errBox(err), h("button", { style: S.btn, disabled: busy, onClick: save }, busy ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ করুন")) },
      h("label", { style: S.label }, "তালিকার নাম *"), h("input", { style: S.input, value: title, maxLength: 60, onChange: (e) => setTitle(e.target.value) }), fieldErr(errors.title),
      h("div", { style: grid2 },
        h("div", null, h("label", { style: S.label }, "বাজারের তারিখ *"), h("input", { style: S.input, type: "date", value: date, onChange: (e) => setDate(e.target.value) }), fieldErr(errors.shoppingDate)),
        h("div", null, h("label", { style: S.label }, "সম্ভাব্য সময়"), h("input", { style: S.input, type: "time", value: time, onChange: (e) => setTime(e.target.value) }), fieldErr(errors.shoppingTime))),
      h("label", { style: S.label }, "বাজার করার সদস্য *"), h("select", { style: S.input, value: to, onChange: (e) => setTo(e.target.value) }, members.map((m) => h("option", { key: m.uid, value: m.uid }, (m.name || m.email || "সদস্য") + (m.uid === ctx.uid ? " (আমি)" : "")))), fieldErr(errors.assignedToUid),
      h("label", { style: S.label }, "মন্তব্য"), h("textarea", { style: Object.assign({}, S.input, { minHeight: 64 }), value: note, maxLength: 300, onChange: (e) => setNote(e.target.value) }));
  }

  const isShopSheet = (sheet) => !!(sheet && /^shop-/.test(sheet.type));
  function renderSheet(sheet, ctx, close) {
    switch (sheet.type) {
      case "shop-create": return h(CreateSheet, { ctx, close, from: sheet.from || null });
      case "shop-list": return h(ListSheet, { ctx, listId: sheet.listId, close });
      case "shop-item": return h(ItemSheet, { ctx, listId: sheet.listId, itemId: sheet.itemId, close });
      case "shop-summary": return h(SummarySheet, { ctx, listId: sheet.listId, close });
      case "shop-edit": return h(EditSheet, { ctx, listId: sheet.listId, close });
      default: return null;
    }
  }

  window.FamilyShopping = { Home: ShoppingHome, renderSheet, isShopSheet, pendingForShopper: C.pendingForShopper, logic: C };
})();
