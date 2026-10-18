// ফ্যামিলি প্লানিং (Family Planning) — UI module, kept in its OWN file, separate
// from ফ্যামিলি বাজার (family-bazar.js).
//
// Needs (load order): React, family-planning-core.js (window.FPCore) and
// family-bazar.js (window.FBShared = shared UI building blocks + data hook).
// Exposes: window.FamilyPlanning = { Home, CreateButton, renderSheet, isPlanSheet }
//   Home          — the planning dashboard (body only, no frame)
//   CreateButton  — "+ নতুন পরিকল্পনা" button (owner/admin only)
//   renderSheet   — router for ctx.openSheet({ type: "plan-…" })
(function () {
  "use strict";
  const { useState, useEffect, useMemo, useRef, useCallback } = React;
  const SH = window.FBShared;
  if (!SH) { console.warn("family-planning.js: family-bazar.js must load first"); return; }
  const { Avatar, Empty, F, FPCore, HBar, R_Fragment, S, SERIF, Sheet, Toggle, bn, friendlyError, h, today } = SH;

  /* ======================================================================
   * FAMILY PLANNING — 18-screen goal-based family savings module.
   * UI lives here (family-planning.js); the shared building blocks (ctx,
   * Sheet, Toggle, Avatar, role system) come from family-bazar.js through
   * window.FBShared; logic lives in FPCore (family-planning-core.js),
   * already unit-tested there.
   * Every screen is pushed onto the SAME sheet stack the family Module
   * already has (ctx.openSheet pushes, close pops one level), so "←" naturally
   * walks back exactly like the mockups show, with no extra routing code.
   * ====================================================================== */
  const FP_TONE = { ok: ["var(--hk-success-mid)", "#fff"], warn: ["var(--hk-gold)", "#1a1a1a"], danger: ["var(--hk-danger)", "#fff"], neutral: ["var(--hk-track)", "var(--hk-text-muted-2)"] };
  function FPStatusPill({ status }) {
    const meta = FPCore.PLAN_STATUS_LABEL[status] || { label: status, tone: "neutral" };
    return h("span", { style: S.pill(...FP_TONE[meta.tone]) }, meta.label);
  }
  const FP_PALETTE = ["#FDE8D7", "#DCEFE3", "#E6E0F8", "#FCE4EC", "#E3F2FD", "#FFF4D6"];
  function FPIcon({ plan, size = 44 }) {
    const idx = Math.abs((plan.type || "").split("").reduce((s, c) => s + c.charCodeAt(0), 0)) % FP_PALETTE.length;
    return h("div", { style: { width: size, height: size, borderRadius: "50%", background: FP_PALETTE[idx], display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.48, flex: "none" } }, plan.icon);
  }
  // card used in Home's "সম্প্রতি পরিকল্পনা", All Plans, My Planning
  function FPPlanCard({ plan, onOpen }) {
    const pct = FPCore.progressPct(plan);
    return h("button", { onClick: onOpen, style: Object.assign({}, S.card, { display: "flex", width: "100%", alignItems: "center", gap: 12, textAlign: "left", color: "var(--hk-text)", fontFamily: F, border: "1px solid var(--hk-border)" }) },
      h(FPIcon, { plan }),
      h("div", { style: { flex: 1, minWidth: 0 } },
        h("div", { style: Object.assign({}, S.row, { marginBottom: 4 }) },
          h("span", { style: { fontWeight: 700, fontSize: 14.5 } }, plan.title),
          h(FPStatusPill, { status: plan.status })),
        h(HBar, { pct }),
        h("div", { style: Object.assign({}, S.muted, { marginTop: 3, display: "flex", justifyContent: "space-between" }) },
          h("span", null, `৳${bn(FPCore.approvedTotal(plan))} / ${bn(plan.targetAmount)}`), h("span", null, `${bn(pct)}%`))));
  }
  function FPStatRow({ label, value }) {
    return h("div", { style: Object.assign({}, S.card, { textAlign: "center", padding: "12px 8px" }) },
      h("div", { style: S.muted }, label), h("div", { style: { fontFamily: SERIF, fontSize: 19, marginTop: 2 } }, value));
  }
  function FPActionRow({ icon, label, onClick }) {
    return h("button", { onClick, style: { display: "flex", width: "100%", alignItems: "center", gap: 10, background: "none", border: "none", borderBottom: "1px solid var(--hk-border-light)", padding: "11px 0", color: "var(--hk-text)", fontFamily: F, textAlign: "left", fontSize: 14 } },
      h("span", { style: { fontSize: 18 } }, icon), h("span", { style: { flex: 1 } }, label), h("span", { style: S.muted }, "›"));
  }
  function monthsBetween(a, b) {
    if (!a || !b) return "";
    const d1 = new Date(a + "T00:00:00"), d2 = new Date(b + "T00:00:00");
    const m = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24 * 30)));
    return `${bn(m)} মাস`;
  }

  /* ---------------------------- 1. Home ---------------------------- */
  function FPHomeBody({ ctx }) {
    const plans = FPCore.sortPlansNewest(ctx.fam.plans);
    const totals = FPCore.dashboardTotals(plans);
    const recent = plans.slice(0, 4);
    const pendingApprovals = FPCore.pendingApprovalPlans(plans).length;
    return h(R_Fragment, null,
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 } },
        h(FPStatRow, { label: "মোট পরিকল্পনা", value: bn(totals.totalPlans) }),
        h(FPStatRow, { label: "সক্রিয় পরিকল্পনা", value: bn(totals.activePlans) }),
        h(FPStatRow, { label: "মোট লক্ষ্য টাকা", value: `৳${bn(totals.totalTarget)}` }),
        h(FPStatRow, { label: "মোট সংগ্রহ", value: `৳${bn(totals.totalApprovedCollection)}` })),
      h("div", { style: { display: "flex", gap: 8, marginBottom: 14 } },
        h("button", { style: Object.assign({}, S.btn2, { flex: 1 }), onClick: () => ctx.openSheet({ type: "plan-mine" }) }, "👤 আমার পরিকল্পনা"),
        ctx.vis.admin && h("button", { style: Object.assign({}, S.btn2, { flex: 1, position: "relative" }), onClick: () => ctx.openSheet({ type: "plan-owner-center" }) },
          "🔔 অনুমোদন কেন্দ্র", pendingApprovals > 0 && h("span", { style: { marginLeft: 6 } }, h("span", { style: S.pill("var(--hk-gold)", "#1a1a1a") }, bn(pendingApprovals))))),
      h("div", { style: Object.assign({}, S.row, { marginBottom: 8 }) },
        h("div", { style: S.h2 }, "সম্প্রতি পরিকল্পনা"),
        plans.length > 4 && h("button", { onClick: () => ctx.openSheet({ type: "plan-list" }), style: { background: "none", border: "none", color: "var(--hk-gold)", fontFamily: F, fontSize: 13 } }, "সব দেখুন ›")),
      recent.length === 0
        ? h(Empty, { icon: "🏠", title: "এখনো কোনো পরিকল্পনা নেই", text: "পরিবারের কোনো লক্ষ্য বা স্বপ্নের জন্য প্রথম পরিকল্পনা তৈরি করুন।" })
        : recent.map((p) => h(FPPlanCard, { key: p.id, plan: p, onOpen: () => ctx.openSheet({ type: "plan-detail", planId: p.id }) })));
  }

  function FPHomeCreateBtn({ ctx }) {
    return ctx.vis.write ? h("button", { style: S.btn, onClick: () => ctx.openSheet({ type: "plan-create" }) }, "+ নতুন পরিকল্পনা তৈরি করুন") : null;
  }
  function FPHomeSheet({ ctx, close }) {
    return h(Sheet, { title: "ফ্যামিলি প্লানিং", onClose: close, footer: FPHomeCreateBtn({ ctx }) },
      h(FPHomeBody, { ctx }));
  }

  /* ---------------------------- 2. All Plans ---------------------------- */
  function FPAllPlansSheet({ ctx, close }) {
    const [tabKey, setTabKey] = useState("all");
    const [q, setQ] = useState("");
    const plans = ctx.fam.plans || [];
    const tabs = [["all", "সব"], ["active", "সক্রিয়"], ["pending", "পেন্ডিং"], ["completed", "সম্পন্ন"]];
    const shown = FPCore.sortPlansNewest(FPCore.searchPlans(FPCore.plansInStatusTab(plans, tabKey), q));
    return h(Sheet, { title: "পরিকল্পনার তালিকা", onClose: close,
      footer: ctx.vis.write && h("button", { style: S.btn, onClick: () => ctx.openSheet({ type: "plan-create" }) }, "+ নতুন পরিকল্পনা") },
      h("div", { style: { display: "flex", gap: 6, marginBottom: 10, overflowX: "auto" } },
        tabs.map(([k, label]) => h("button", { key: k, onClick: () => setTabKey(k), style: S.chip(tabKey === k) },
          `${label} (${bn(FPCore.plansInStatusTab(plans, k).length)})`))),
      h("input", { style: S.input, placeholder: "পরিকল্পনা খুঁজুন…", value: q, onChange: (e) => setQ(e.target.value) }),
      shown.length === 0
        ? h(Empty, { icon: "🔎", title: "কিছু পাওয়া যায়নি", text: "এই বিভাগে কোনো পরিকল্পনা নেই।" })
        : shown.map((p) => h(FPPlanCard, { key: p.id, plan: p, onOpen: () => ctx.openSheet({ type: "plan-detail", planId: p.id }) })));
  }

  /* ---------------------------- 3. Plan Details ---------------------------- */
  function FPPlanDetailsSheet({ ctx, planId, close }) {
    const plan = (ctx.fam.plans || []).find((p) => p.id === planId);
    const [busy, setBusy] = useState(false);
    if (!plan) return h(Sheet, { title: "পরিকল্পনা", onClose: close }, h(Empty, { icon: "🏠", title: "পরিকল্পনা পাওয়া যায়নি", text: "সম্ভবত এটি মুছে ফেলা হয়েছে।" }));
    const creator = ctx.fam.members.find((m) => m.uid === plan.createdBy);
    const approver = ctx.fam.members.find((m) => m.uid === plan.approvedBy);
    const participants = plan.participantMode === "all" ? ctx.fam.members : ctx.fam.members.filter((m) => (plan.participantUids || []).includes(m.uid));
    const isCreator = plan.createdBy === ctx.uid;
    const canEdit = isCreator || ctx.vis.admin;
    const canContribute = ctx.vis.write && ["active", "target_achieved"].includes(plan.status) && FPCore.isParticipant(plan, ctx.uid);
    const del = async () => {
      if (busy || !window.confirm(`"${plan.title}" পরিকল্পনাটি পুরোপুরি মুছে ফেলবেন?`)) return;
      setBusy(true);
      try { await window.FB.deletePlan(ctx.familyId, plan.id); ctx.toast("পরিকল্পনা মুছে ফেলা হয়েছে"); close(); }
      catch (e) { ctx.toast(friendlyError(e)); setBusy(false); }
    };
    const resubmit = async () => {
      setBusy(true);
      try { await window.FB.resubmitPlan(ctx.familyId, plan.id, ctx.uid, ctx.me.name); ctx.toast("আবার জমা দেওয়া হয়েছে"); }
      catch (e) { ctx.toast(friendlyError(e)); } finally { setBusy(false); }
    };
    return h(Sheet, { title: plan.title, onClose: close },
      h("div", { style: { textAlign: "center", marginBottom: 10 } }, h(FPIcon, { plan, size: 64 })),
      h("div", { style: Object.assign({}, S.row, { marginBottom: 4 }) }, h("div", { style: { fontFamily: SERIF, fontSize: 19 } }, plan.title), h(FPStatusPill, { status: plan.status })),
      h("div", { style: Object.assign({}, S.muted, { marginBottom: 10 }) }, `${FPCore.PLAN_TYPE_MAP[plan.type].label} ${plan.endDate ? "| " + formatDateBn(plan.endDate).full + " পর্যন্ত" : ""}`),
      plan.description && h("div", { style: Object.assign({}, S.card) }, plan.description),
      plan.status === "pending_approval" && h("div", { style: Object.assign({}, S.card, { borderColor: "var(--hk-gold)" }) }, "⏳ এই পরিকল্পনাটি এখনো পরিবারের মালিকের অনুমোদনের অপেক্ষায় — অনুমোদনের আগে কোনো টাকা সরকারিভাবে যোগ হবে না।"),
      plan.status === "changes_requested" && h("div", { style: Object.assign({}, S.card, { borderColor: "var(--hk-gold)" }) },
        h("div", { style: { fontWeight: 700, marginBottom: 4 } }, "পরিবর্তন চাওয়া হয়েছে"),
        plan.changesRequestNote && h("div", { style: S.muted }, plan.changesRequestNote),
        isCreator && h("button", { style: Object.assign({}, S.btn2, { marginTop: 10, width: "100%" }), disabled: busy, onClick: () => ctx.openSheet({ type: "plan-edit", planId: plan.id }) }, "✏️ সম্পাদনা করে আবার জমা দিন")),
      h("div", { style: S.card },
        [["লক্ষ্য টাকা", `৳${bn(plan.targetAmount)}`], ["জমা হয়েছে", `৳${bn(FPCore.approvedTotal(plan))}`], ["অবশিষ্ট", `৳${bn(FPCore.remainingTarget(plan))}`],
         ["সময়কাল", `${plan.startDate ? formatDateBn(plan.startDate).full : "?"} – ${plan.endDate ? formatDateBn(plan.endDate).full : "?"}`],
         ["ধরন", FPCore.PLAN_TYPE_MAP[plan.type].label], ["তৈরি করেছেন", `${(creator && creator.name) || "?"}${isCreator ? " (আপনি)" : ""}`],
         ["অনুমোদন করেছেন", (approver && approver.name) || "—"]].map(([k, v], i) => h("div", { key: i, style: Object.assign({}, S.row, { padding: "7px 0", borderBottom: "1px solid var(--hk-border-light)" }) }, h("span", { style: S.muted }, k), h("span", { style: { fontWeight: 600 } }, v)))),
      h("div", { style: S.card },
        h("div", { style: Object.assign({}, S.muted, { marginBottom: 8 }) }, "সদস্যদের অংশগ্রহণ"),
        h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
          participants.slice(0, 5).map((m) => h(Avatar, { key: m.uid, m, size: 30 })),
          h("span", { style: Object.assign({}, S.muted, { marginLeft: 4 }) }, `${bn(participants.length)} জন সদস্য`))),
      canContribute && h("button", { style: Object.assign({}, S.btn, { marginBottom: 10 }), onClick: () => ctx.openSheet({ type: "plan-contribute", planId: plan.id }) }, "টাকা যোগ করুন"),
      h("div", { style: S.card },
        h(FPActionRow, { icon: "👨‍👩‍👧", label: "সদস্যদের অবদান", onClick: () => ctx.openSheet({ type: "plan-members", planId: plan.id }) }),
        h(FPActionRow, { icon: "🧾", label: "খরচের হিসাব", onClick: () => ctx.openSheet({ type: "plan-expenses", planId: plan.id }) }),
        h(FPActionRow, { icon: "📜", label: "ইতিহাস / অডিট লগ", onClick: () => ctx.openSheet({ type: "plan-history", planId: plan.id }) }),
        plan.status === "pending_approval" && ctx.vis.admin && h(FPActionRow, { icon: "✅", label: "অনুমোদন করুন", onClick: () => ctx.openSheet({ type: "plan-approval", planId: plan.id }) }),
        plan.status === "target_achieved" && ctx.vis.admin && h(FPActionRow, { icon: "🎉", label: "সম্পন্ন করুন", onClick: () => ctx.openSheet({ type: "plan-complete", planId: plan.id }) }),
        canEdit && ["active", "target_achieved"].includes(plan.status) && h(FPActionRow, { icon: "✏️", label: "সম্পাদনা", onClick: () => ctx.openSheet({ type: "plan-edit", planId: plan.id }) })),
      canEdit && h("button", { style: S.danger, disabled: busy, onClick: del }, "পরিকল্পনাটি মুছে ফেলুন"));
  }

  /* ---------------------------- 4. Create New Plan ---------------------------- */
  function FPCreatePlanSheet({ ctx, close }) {
    const [title, setTitle] = useState("");
    const [type, setType] = useState("");
    const [targetAmount, setTargetAmount] = useState("");
    const [startDate, setStartDate] = useState(today());
    const [endDate, setEndDate] = useState("");
    const [description, setDescription] = useState("");
    const [participantMode, setParticipantMode] = useState("all");
    const [participantUids, setParticipantUids] = useState([]);
    const [contributionMode, setContributionMode] = useState("both");
    const [perMemberTarget, setPerMemberTarget] = useState("");
    const [errors, setErrors] = useState([]);
    const [busy, setBusy] = useState(false);
    const toggleParticipant = (uid2) => setParticipantUids((us) => (us.includes(uid2) ? us.filter((u) => u !== uid2) : [...us, uid2]));
    const save = async () => {
      const draft = { title, type, targetAmount, startDate, endDate, description, participantMode, participantUids, perMemberTarget };
      const v = FPCore.validatePlanDraft(draft);
      if (!v.ok) { setErrors(v.errors); return; }
      setErrors([]); setBusy(true);
      const p = FPCore.plan({
        title: v.title, type, icon: FPCore.PLAN_TYPE_MAP[type].icon, targetAmount: v.targetAmount, startDate, endDate,
        description: description.trim(), participantMode, participantUids, contributionMode, perMemberTarget: perMemberTarget || null,
        createdBy: ctx.uid, createdByName: ctx.me.name,
        auditLog: [FPCore.auditEntry(ctx.uid, ctx.me.name, "plan_created", `"${v.title}" তৈরি করেছেন`)],
      });
      try { const id = await window.FB.createPlan(ctx.familyId, p); ctx.toast("পরিকল্পনা জমা দেওয়া হয়েছে — মালিকের অনুমোদনের অপেক্ষায়"); close(); }
      catch (e) { setErrors([friendlyError(e)]); } finally { setBusy(false); }
    };
    return h(Sheet, { title: "নতুন পরিকল্পনা তৈরি করুন", onClose: close,
      footer: h("button", { style: S.btn, disabled: busy, onClick: save }, busy ? "জমা হচ্ছে…" : "পরিকল্পনা জমা দিন") },
      errors.length > 0 && h("div", { style: { color: "var(--hk-danger)", fontSize: 13, marginBottom: 10 } }, errors.map((e, i) => h("div", { key: i }, "• " + e))),
      h("label", { style: S.label }, "পরিকল্পনার নাম *"),
      h("input", { style: S.input, placeholder: "যেমন: Family Tour 2027", value: title, maxLength: 60, onChange: (e) => setTitle(e.target.value) }),
      h("label", { style: S.label }, "ধরন নির্বাচন করুন *"),
      h("select", { style: S.input, value: type, onChange: (e) => setType(e.target.value) },
        h("option", { value: "" }, "বেছে নিন"), FPCore.PLAN_TYPES.map((t) => h("option", { key: t.key, value: t.key }, `${t.icon} ${t.label}`))),
      h("label", { style: S.label }, "লক্ষ্য টাকা *"),
      h("input", { style: S.input, inputMode: "decimal", placeholder: "যেমন: 50000", value: targetAmount, onChange: (e) => setTargetAmount(e.target.value) }),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } },
        h("div", null, h("label", { style: S.label }, "শুরুর তারিখ *"), h("input", { type: "date", style: S.input, value: startDate, onChange: (e) => setStartDate(e.target.value) })),
        h("div", null, h("label", { style: S.label }, "শেষ তারিখ *"), h("input", { type: "date", style: S.input, min: startDate, value: endDate, onChange: (e) => setEndDate(e.target.value) }))),
      h("label", { style: S.label }, "বিবরণ"),
      h("textarea", { style: Object.assign({}, S.input, { minHeight: 70 }), placeholder: "পরিকল্পনার বিস্তারিত লিখুন…", value: description, onChange: (e) => setDescription(e.target.value) }),
      h("label", { style: S.label }, "কারা অংশ নেবে"),
      h("div", { style: { display: "flex", gap: 8, marginBottom: 10 } },
        h("button", { style: S.chip(participantMode === "all"), onClick: () => setParticipantMode("all") }, "সকল সদস্য"),
        h("button", { style: S.chip(participantMode === "selected"), onClick: () => setParticipantMode("selected") }, "নির্বাচিত সদস্য")),
      participantMode === "selected" && h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 } },
        ctx.fam.members.map((m) => h("button", { key: m.uid, onClick: () => toggleParticipant(m.uid), style: { background: "none", border: "none", padding: 0, opacity: participantUids.includes(m.uid) ? 1 : 0.35 } }, h(Avatar, { m, size: 38 })))),
      h("label", { style: S.label }, "টাকা জমা হবে কীভাবে?"),
      h("div", { style: { display: "flex", gap: 8, marginBottom: 10 } },
        FPCore.CONTRIBUTION_MODES.map((c) => h("button", { key: c.key, style: S.chip(contributionMode === c.key), onClick: () => setContributionMode(c.key) }, c.label))),
      h("label", { style: S.label }, "সদস্য প্রতি লক্ষ্য (ঐচ্ছিক)"),
      h("input", { style: S.input, inputMode: "decimal", placeholder: "যেমন: 10000", value: perMemberTarget, onChange: (e) => setPerMemberTarget(e.target.value) }));
  }

  /* ---------------------------- 5. Plan Approval ---------------------------- */
  function FPPlanApprovalSheet({ ctx, planId, close }) {
    const plan = (ctx.fam.plans || []).find((p) => p.id === planId);
    const [note, setNote] = useState("");
    const [showReject, setShowReject] = useState(false);
    const [showChanges, setShowChanges] = useState(false);
    const [busy, setBusy] = useState(false);
    if (!plan) return h(Sheet, { title: "পরিকল্পনা অনুমোদন", onClose: close }, h(Empty, { icon: "🏠", title: "পাওয়া যায়নি", text: "" }));
    const creator = ctx.fam.members.find((m) => m.uid === plan.createdBy);
    const act = async (fn) => { setBusy(true); try { await fn(); close(); } catch (e) { ctx.toast(friendlyError(e)); setBusy(false); } };
    return h(Sheet, { title: "পরিকল্পনা অনুমোদন", onClose: close },
      h("div", { style: S.card },
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 } }, h(Avatar, { m: creator, size: 40 }),
          h("div", null, h("div", { style: { fontWeight: 700 } }, (creator && creator.name) || "?"), h("div", { style: { fontFamily: SERIF, fontSize: 16 } }, plan.title))),
        h("div", { style: S.muted }, `৳${bn(plan.targetAmount)} | ${plan.startDate ? formatDateBn(plan.startDate).full : ""} – ${plan.endDate ? formatDateBn(plan.endDate).full : ""}`),
        plan.description && h("div", { style: { marginTop: 8 } }, plan.description)),
      h("div", { style: S.card }, h("div", { style: Object.assign({}, S.muted, { marginBottom: 6 }) }, "পরিকল্পনার বিবরণ"),
        [["ধরন", FPCore.PLAN_TYPE_MAP[plan.type].label], ["লক্ষ্য টাকা", `৳${bn(plan.targetAmount)}`], ["টাইমলাইন", monthsBetween(plan.startDate, plan.endDate)]]
          .map(([k, v], i) => h("div", { key: i, style: Object.assign({}, S.row, { padding: "5px 0" }) }, h("span", { style: S.muted }, k), h("span", { style: { fontWeight: 600 } }, v)))),
      !showReject && !showChanges && h("div", null,
        h("button", { style: Object.assign({}, S.btn, { marginBottom: 10 }), disabled: busy, onClick: () => act(() => window.FB.approvePlan(ctx.familyId, plan.id, ctx.uid, ctx.me.name).then(() => ctx.toast("অনুমোদন করা হয়েছে"))) }, "অনুমোদন করুন"),
        h("button", { style: Object.assign({}, S.btn2, { width: "100%", marginBottom: 10, borderColor: "var(--hk-gold)", color: "var(--hk-gold)" }), disabled: busy, onClick: () => setShowChanges(true) }, "পরিবর্তন চেয়ে নিন"),
        h("button", { style: S.danger, disabled: busy, onClick: () => setShowReject(true) }, "প্রত্যাখ্যান করুন")),
      showChanges && h("div", null,
        h("label", { style: S.label }, "কী পরিবর্তন দরকার?"),
        h("textarea", { style: Object.assign({}, S.input, { minHeight: 70 }), autoFocus: true, value: note, onChange: (e) => setNote(e.target.value) }),
        h("button", { style: Object.assign({}, S.btn, { marginBottom: 8 }), disabled: busy, onClick: () => act(() => window.FB.requestPlanChanges(ctx.familyId, plan.id, ctx.uid, ctx.me.name, note).then(() => ctx.toast("পরিবর্তন চাওয়া হয়েছে"))) }, "পাঠিয়ে দিন"),
        h("button", { style: S.btn2, onClick: () => setShowChanges(false) }, "বাতিল")),
      showReject && h("div", null,
        h("label", { style: S.label }, "প্রত্যাখ্যানের কারণ (ঐচ্ছিক)"),
        h("textarea", { style: Object.assign({}, S.input, { minHeight: 70 }), autoFocus: true, value: note, onChange: (e) => setNote(e.target.value) }),
        h("button", { style: Object.assign({}, S.danger, { marginBottom: 8, width: "100%" }), disabled: busy, onClick: () => act(() => window.FB.rejectPlan(ctx.familyId, plan.id, ctx.uid, ctx.me.name, note).then(() => ctx.toast("প্রত্যাখ্যান করা হয়েছে"))) }, "নিশ্চিত — প্রত্যাখ্যান করুন"),
        h("button", { style: S.btn2, onClick: () => setShowReject(false) }, "বাতিল")));
  }

  /* ---------------------------- 6. Add Contribution ---------------------------- */
  function FPAddContributionSheet({ ctx, planId, close }) {
    const plan = (ctx.fam.plans || []).find((p) => p.id === planId);
    const [claimedAmount, setClaimedAmount] = useState("");
    const [date, setDate] = useState(today());
    const [paymentMethod, setPaymentMethod] = useState(FPCore.PAYMENT_METHODS[0]);
    const [note, setNote] = useState("");
    const [errors, setErrors] = useState([]);
    const [busy, setBusy] = useState(false);
    if (!plan) return h(Sheet, { title: "অবদান যোগ করুন", onClose: close }, h(Empty, { icon: "🏠", title: "পাওয়া যায়নি", text: "" }));
    const save = async () => {
      const v = FPCore.validateContributionDraft({ claimedAmount, date });
      if (!v.ok) { setErrors(v.errors); return; }
      setErrors([]); setBusy(true);
      try {
        await window.FB.addContribution(ctx.familyId, plan.id, { claimedAmount: v.claimedAmount, date, paymentMethod, note }, ctx.uid, ctx.me.name);
        ctx.toast("অবদান জমা দেওয়া হয়েছে — যাচাইয়ের অপেক্ষায়"); close();
      } catch (e) { setErrors([friendlyError(e)]); } finally { setBusy(false); }
    };
    return h(Sheet, { title: "অবদান যোগ করুন", onClose: close,
      footer: h("button", { style: S.btn, disabled: busy, onClick: save }, busy ? "জমা হচ্ছে…" : "জমা দিন") },
      h("div", { style: Object.assign({}, S.card, { display: "flex", alignItems: "center", gap: 10 }) },
        h(FPIcon, { plan, size: 40 }),
        h("div", { style: { flex: 1 } }, h("div", { style: { fontWeight: 700 } }, plan.title), h(HBar, { pct: FPCore.progressPct(plan) }),
          h("div", { style: S.muted }, `৳${bn(FPCore.approvedTotal(plan))} / ${bn(plan.targetAmount)}`))),
      errors.length > 0 && h("div", { style: { color: "var(--hk-danger)", fontSize: 13, marginBottom: 10 } }, errors.map((e, i) => h("div", { key: i }, "• " + e))),
      h("label", { style: S.label }, "টাকার পরিমাণ *"),
      h("input", { style: S.input, inputMode: "decimal", autoFocus: true, value: claimedAmount, onChange: (e) => setClaimedAmount(e.target.value) }),
      h("label", { style: S.label }, "তারিখ *"),
      h("input", { type: "date", style: S.input, max: today(), value: date, onChange: (e) => setDate(e.target.value) }),
      h("label", { style: S.label }, "পেমেন্ট মাধ্যম"),
      h("select", { style: S.input, value: paymentMethod, onChange: (e) => setPaymentMethod(e.target.value) }, FPCore.PAYMENT_METHODS.map((m) => h("option", { key: m, value: m }, m))),
      h("label", { style: S.label }, "নোট (ঐচ্ছিক)"),
      h("input", { style: S.input, value: note, onChange: (e) => setNote(e.target.value) }));
  }

  /* ---------------------------- 7. Contribution Verification ---------------------------- */
  function FPVerifyRow({ ctx, plan, c }) {
    const [amt, setAmt] = useState(String(c.claimedAmount));
    const [showReject, setShowReject] = useState(false);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const confirm = async () => {
      const received = FPCore.parseNum(amt);
      if (!(received > 0)) { ctx.toast("সঠিক পরিমাণ দিন"); return; }
      const status = received < c.claimedAmount ? "partial" : "approved";
      setBusy(true);
      try { await window.FB.verifyContribution(ctx.familyId, plan.id, c.id, status, received, ctx.uid, ctx.me.name); ctx.toast("যাচাই সম্পন্ন হয়েছে"); }
      catch (e) { ctx.toast(friendlyError(e)); } finally { setBusy(false); }
    };
    const reject = async () => {
      setBusy(true);
      try { await window.FB.verifyContribution(ctx.familyId, plan.id, c.id, "rejected", null, ctx.uid, ctx.me.name, reason); ctx.toast("প্রত্যাখ্যান করা হয়েছে"); }
      catch (e) { ctx.toast(friendlyError(e)); } finally { setBusy(false); }
    };
    return h("div", { style: S.card },
      h("div", { style: S.row }, h("span", { style: { fontWeight: 700 } }, c.memberName), h("b", null, `৳${bn(c.claimedAmount)}`)),
      h("div", { style: Object.assign({}, S.muted, { marginBottom: 8 }) }, `${c.date ? formatDateBn(c.date).full : ""}${c.paymentMethod ? " · " + c.paymentMethod : ""}${c.note ? " · " + c.note : ""}`),
      !showReject ? h("div", null,
        h("div", { style: { display: "flex", gap: 6, marginBottom: 8 } },
          h("input", { style: Object.assign({}, S.input, { marginBottom: 0, flex: 1 }), inputMode: "decimal", value: amt, onChange: (e) => setAmt(e.target.value) }),
          h("span", { style: { alignSelf: "center", fontSize: 12 } }, "প্রাপ্ত পরিমাণ")),
        h("div", { style: { display: "flex", gap: 8 } },
          h("button", { style: Object.assign({}, S.btn, { flex: 1 }), disabled: busy, onClick: confirm }, "✓ টাকা পেয়েছি"),
          h("button", { style: Object.assign({}, S.danger, { flex: 1 }), disabled: busy, onClick: () => setShowReject(true) }, "✕ প্রত্যাখ্যান")))
        : h("div", null,
          h("input", { style: S.input, placeholder: "প্রত্যাখ্যানের কারণ (ঐচ্ছিক)", autoFocus: true, value: reason, onChange: (e) => setReason(e.target.value) }),
          h("div", { style: { display: "flex", gap: 8 } },
            h("button", { style: Object.assign({}, S.danger, { flex: 1 }), disabled: busy, onClick: reject }, "নিশ্চিত প্রত্যাখ্যান"),
            h("button", { style: Object.assign({}, S.btn2, { flex: 1 }), onClick: () => setShowReject(false) }, "বাতিল"))));
  }
  function FPVerificationSheet({ ctx, planId, close }) {
    const plan = (ctx.fam.plans || []).find((p) => p.id === planId);
    if (!plan) return h(Sheet, { title: "অবদান যাচাই", onClose: close }, h(Empty, { icon: "🏠", title: "পাওয়া যায়নি", text: "" }));
    const pending = (plan.contributions || []).filter((c) => c.status === "pending");
    const resolved = (plan.contributions || []).filter((c) => c.status !== "pending").slice().reverse();
    return h(Sheet, { title: "অবদান যাচাই", onClose: close },
      h("div", { style: Object.assign({}, S.card, { display: "flex", alignItems: "center", gap: 10 }) },
        h(FPIcon, { plan, size: 40 }),
        h("div", { style: { flex: 1 } }, h("div", { style: { fontWeight: 700 } }, plan.title), h(HBar, { pct: FPCore.progressPct(plan) }),
          h("div", { style: S.muted }, `৳${bn(FPCore.approvedTotal(plan))} / ${bn(plan.targetAmount)}`))),
      pending.length === 0 && resolved.length === 0 && h(Empty, { icon: "✅", title: "কোনো অবদান নেই", text: "এখনো কেউ অবদান জমা দেয়নি।" }),
      pending.map((c) => h(FPVerifyRow, { key: c.id, ctx, plan, c })),
      resolved.length > 0 && h("div", { style: Object.assign({}, S.muted, { margin: "14px 0 6px" }) }, "আগের যাচাইকৃত অবদান"),
      resolved.map((c) => h("div", { key: c.id, style: Object.assign({}, S.card, { opacity: 0.8 }) },
        h("div", { style: S.row }, h("span", null, c.memberName), h("span", { style: { display: "flex", alignItems: "center", gap: 6 } },
          h("b", null, `৳${bn(c.status === "rejected" ? c.claimedAmount : c.receivedAmount)}`),
          h("span", { style: S.pill(...FP_TONE[FPCore.CONTRIBUTION_STATUS_LABEL[c.status].tone]) }, FPCore.CONTRIBUTION_STATUS_LABEL[c.status].label))))));
  }

  /* ---------------------------- 8. Member Contributions ---------------------------- */
  function FPMemberContributionsSheet({ ctx, planId, close }) {
    const plan = (ctx.fam.plans || []).find((p) => p.id === planId);
    if (!plan) return h(Sheet, { title: "সদস্যদের অবদান", onClose: close }, h(Empty, { icon: "🏠", title: "পাওয়া যায়নি", text: "" }));
    const rows = FPCore.memberContributionRows(plan, ctx.fam.members);
    return h(Sheet, { title: "সদস্যদের অবদান", onClose: close },
      rows.length === 0 ? h(Empty, { icon: "👨‍👩‍👧", title: "কোনো অবদান নেই", text: "" }) : h("div", { style: S.card },
        h("div", { style: Object.assign({}, S.row, { padding: "6px 0", fontWeight: 700, fontSize: 12, color: "var(--hk-text-muted)", borderBottom: "2px solid var(--hk-border-strong)" }) },
          h("span", null, "সদস্য"), h("span", null, "পরিমাণ"), h("span", null, "স্থিতি")),
        rows.map((r) => h("div", { key: r.uid || r.name, style: Object.assign({}, S.row, { padding: "8px 0", borderBottom: "1px solid var(--hk-border-light)" }) },
          h("span", null, r.name), h("span", null, `৳${bn(r.approved)}`),
          h("span", null, r.pending > 0 ? h("span", { style: S.pill(...FP_TONE.warn) }, `যাচাই অপেক্ষায় ৳${bn(r.pending)}`) : h("span", { style: S.pill(...FP_TONE.ok) }, "অনুমোদিত"))))),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 } },
        h(FPStatRow, { label: "মোট সংগ্রহ (অনুমোদিত)", value: `৳${bn(FPCore.approvedTotal(plan))}` }),
        h(FPStatRow, { label: "লক্ষ্য টাকা", value: `৳${bn(plan.targetAmount)}` })));
  }

  /* ---------------------------- 9. Expense / Spending ---------------------------- */
  function FPExpensesSheet({ ctx, planId, close }) {
    const plan = (ctx.fam.plans || []).find((p) => p.id === planId);
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState(""); const [amount, setAmount] = useState(""); const [date, setDate] = useState(today()); const [note, setNote] = useState("");
    const [errors, setErrors] = useState([]); const [busy, setBusy] = useState(false);
    if (!plan) return h(Sheet, { title: "ব্যয়/খরচের হিসাব", onClose: close }, h(Empty, { icon: "🏠", title: "পাওয়া যায়নি", text: "" }));
    const canAdd = ctx.vis.write;
    const add = async () => {
      const v = FPCore.validateExpenseDraft({ title, amount, date });
      if (!v.ok) { setErrors(v.errors); return; }
      setErrors([]); setBusy(true);
      try {
        await window.FB.addExpense(ctx.familyId, plan.id, { title: v.title, amount: v.amount, date, note }, ctx.uid, ctx.me.name, ctx.vis.admin);
        setTitle(""); setAmount(""); setNote(""); setShowForm(false); ctx.toast("খরচ যোগ করা হয়েছে");
      } catch (e) { setErrors([friendlyError(e)]); } finally { setBusy(false); }
    };
    const expenses = (plan.expenses || []).slice().reverse();
    return h(Sheet, { title: "ব্যয়/খরচের হিসাব", onClose: close,
      footer: canAdd && !showForm && h("button", { style: S.btn, onClick: () => setShowForm(true) }, "+ খরচ যোগ করুন") },
      h("div", { style: Object.assign({}, S.card, { display: "flex", alignItems: "center", gap: 10 }) },
        h(FPIcon, { plan, size: 40 }), h("div", { style: { fontWeight: 700 } }, plan.title)),
      expenses.length === 0 ? h(Empty, { icon: "🧾", title: "এখনো কোনো খরচ নেই", text: "" }) : h("div", { style: S.card },
        h("div", { style: Object.assign({}, S.row, { padding: "6px 0", fontWeight: 700, fontSize: 12, color: "var(--hk-text-muted)", borderBottom: "2px solid var(--hk-border-strong)" }) },
          h("span", null, "খরচের নাম"), h("span", null, "পরিমাণ"), h("span", null, "তারিখ")),
        expenses.map((e) => h("div", { key: e.id, style: Object.assign({}, S.row, { padding: "8px 0", borderBottom: "1px solid var(--hk-border-light)" }) },
          h("span", null, e.title, e.status === "pending" && h("span", { style: Object.assign({}, S.pill(...FP_TONE.warn), { marginLeft: 6 }) }, "পেন্ডিং")),
          h("span", null, `৳${bn(e.amount)}`), h("span", { style: S.muted }, e.date ? formatDateBn(e.date).full : "")))),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "12px 0" } },
        h(FPStatRow, { label: "মোট খরচ", value: `৳${bn(FPCore.spentTotal(plan))}` }),
        h(FPStatRow, { label: "বাকি আছে", value: `৳${bn(FPCore.remainingAfterSpend(plan))}` })),
      showForm && h("div", { style: S.card },
        errors.length > 0 && h("div", { style: { color: "var(--hk-danger)", fontSize: 13, marginBottom: 8 } }, errors.map((e, i) => h("div", { key: i }, "• " + e))),
        h("label", { style: S.label }, "খরচের নাম *"), h("input", { style: S.input, autoFocus: true, value: title, onChange: (e) => setTitle(e.target.value) }),
        h("label", { style: S.label }, "পরিমাণ *"), h("input", { style: S.input, inputMode: "decimal", value: amount, onChange: (e) => setAmount(e.target.value) }),
        h("label", { style: S.label }, "তারিখ *"), h("input", { type: "date", style: S.input, max: today(), value: date, onChange: (e) => setDate(e.target.value) }),
        h("label", { style: S.label }, "নোট (ঐচ্ছিক)"), h("input", { style: S.input, value: note, onChange: (e) => setNote(e.target.value) }),
        h("div", { style: { display: "flex", gap: 8 } },
          h("button", { style: Object.assign({}, S.btn, { flex: 1 }), disabled: busy, onClick: add }, busy ? "যোগ হচ্ছে…" : "যোগ করুন"),
          h("button", { style: Object.assign({}, S.btn2, { flex: 1 }), onClick: () => setShowForm(false) }, "বাতিল"))));
  }

  /* ---------------------------- 10. My Planning ---------------------------- */
  function FPMySheet({ ctx, close }) {
    const [tabKey, setTabKey] = useState("created");
    const created = FPCore.sortPlansNewest(FPCore.plansCreatedBy(ctx.fam.plans, ctx.uid));
    const participating = FPCore.sortPlansNewest(FPCore.plansParticipatingIn(ctx.fam.plans, ctx.uid));
    const shown = tabKey === "created" ? created : participating;
    return h(Sheet, { title: "আমার পরিকল্পনা", onClose: close },
      h("div", { style: { display: "flex", gap: 8, marginBottom: 12 } },
        h("button", { style: S.chip(tabKey === "created"), onClick: () => setTabKey("created") }, `তৈরি করেছি (${bn(created.length)})`),
        h("button", { style: S.chip(tabKey === "participating"), onClick: () => setTabKey("participating") }, `অংশ নিচ্ছি (${bn(participating.length)})`)),
      shown.length === 0 ? h(Empty, { icon: "👤", title: "কিছু নেই", text: "" })
        : shown.map((p) => h(FPPlanCard, { key: p.id, plan: p, onOpen: () => ctx.openSheet({ type: "plan-detail", planId: p.id }) })));
  }

  /* ---------------------------- 11. Owner Approval Center ---------------------------- */
  function FPOwnerCenterSheet({ ctx, close }) {
    const [tabKey, setTabKey] = useState("plans");
    const plans = ctx.fam.plans || [];
    const pendingPlans = FPCore.pendingApprovalPlans(plans);
    const pendingContribs = FPCore.pendingVerificationContributions(plans);
    return h(Sheet, { title: "অনুমোদন কেন্দ্র", onClose: close },
      h("div", { style: { display: "flex", gap: 8, marginBottom: 12 } },
        h("button", { style: S.chip(tabKey === "plans"), onClick: () => setTabKey("plans") }, `নতুন পরিকল্পনা (${bn(pendingPlans.length)})`),
        h("button", { style: S.chip(tabKey === "contribs"), onClick: () => setTabKey("contribs") }, `অবদান যাচাই (${bn(pendingContribs.length)})`)),
      tabKey === "plans"
        ? (pendingPlans.length === 0 ? h(Empty, { icon: "✅", title: "কোনো পেন্ডিং পরিকল্পনা নেই", text: "" })
          : pendingPlans.map((p) => {
              const creator = ctx.fam.members.find((m) => m.uid === p.createdBy);
              return h("div", { key: p.id, style: S.card },
                h("button", { onClick: () => ctx.openSheet({ type: "plan-approval", planId: p.id }), style: { display: "flex", width: "100%", alignItems: "center", gap: 10, background: "none", border: "none", textAlign: "left", fontFamily: F, color: "var(--hk-text)", marginBottom: 10 } },
                  h(Avatar, { m: creator, size: 34 }),
                  h("div", { style: { flex: 1 } }, h("div", { style: { fontWeight: 700 } }, (creator && creator.name) || "?"), h("div", { style: { fontFamily: SERIF } }, p.title), h("div", { style: S.muted }, `৳${bn(p.targetAmount)} | ${FPCore.PLAN_TYPE_MAP[p.type].label}`))),
                h("div", { style: { display: "flex", gap: 8 } },
                  h("button", { style: Object.assign({}, S.btn, { flex: 1, padding: "9px" }), onClick: async () => { try { await window.FB.approvePlan(ctx.familyId, p.id, ctx.uid, ctx.me.name); ctx.toast("অনুমোদন করা হয়েছে"); } catch (e) { ctx.toast(friendlyError(e)); } } }, "Approve"),
                  h("button", { style: Object.assign({}, S.danger, { flex: 1, padding: "9px" }), onClick: async () => { try { await window.FB.rejectPlan(ctx.familyId, p.id, ctx.uid, ctx.me.name, ""); ctx.toast("প্রত্যাখ্যান করা হয়েছে"); } catch (e) { ctx.toast(friendlyError(e)); } } }, "Reject")));
            }))
        : (pendingContribs.length === 0 ? h(Empty, { icon: "✅", title: "কোনো পেন্ডিং অবদান নেই", text: "" })
          : pendingContribs.map(({ plan, contribution: c }) => h("div", { key: c.id, style: S.card },
              h("div", { style: S.row }, h("span", { style: { fontWeight: 700 } }, `${c.memberName} → ${plan.title}`), h("b", null, `৳${bn(c.claimedAmount)}`)),
              h("button", { onClick: () => ctx.openSheet({ type: "plan-verify", planId: plan.id }), style: { background: "none", border: "none", color: "var(--hk-gold)", fontFamily: F, fontSize: 13, padding: "6px 0" } }, "যাচাই করুন ›")))));
  }

  /* ---------------------------- 13. History / Audit Log ---------------------------- */
  function FPHistorySheet({ ctx, planId, close }) {
    const plan = (ctx.fam.plans || []).find((p) => p.id === planId);
    if (!plan) return h(Sheet, { title: "ইতিহাস / অডিট লগ", onClose: close }, h(Empty, { icon: "🏠", title: "পাওয়া যায়নি", text: "" }));
    const log = (plan.auditLog || []).slice().reverse();
    return h(Sheet, { title: "ইতিহাস / অডিট লগ", onClose: close },
      h("div", { style: Object.assign({}, S.card, { display: "flex", alignItems: "center", gap: 10 }) }, h(FPIcon, { plan, size: 36 }), h("div", { style: { fontWeight: 700 } }, plan.title)),
      log.length === 0 ? h(Empty, { icon: "📜", title: "কোনো ইতিহাস নেই", text: "" }) : h("div", { style: { borderLeft: "2px solid var(--hk-border-strong)", marginLeft: 6, paddingLeft: 16 } },
        log.map((e) => h("div", { key: e.id, style: { position: "relative", marginBottom: 16 } },
          h("div", { style: { position: "absolute", left: -21, top: 3, width: 10, height: 10, borderRadius: "50%", background: "var(--hk-gold)" } }),
          h("div", { style: S.muted }, `${new Date(e.ts).toLocaleDateString("bn-BD")} ${new Date(e.ts).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" })}`),
          h("div", { style: { fontWeight: 600 } }, e.actorName), h("div", null, e.details)))));
  }

  /* ---------------------------- 14. Edit Plan ---------------------------- */
  function FPEditPlanSheet({ ctx, planId, close }) {
    const plan = (ctx.fam.plans || []).find((p) => p.id === planId);
    const [title, setTitle] = useState(plan ? plan.title : "");
    const [type, setType] = useState(plan ? plan.type : "");
    const [targetAmount, setTargetAmount] = useState(plan ? String(plan.targetAmount) : "");
    const [endDate, setEndDate] = useState(plan ? plan.endDate : "");
    const [description, setDescription] = useState(plan ? plan.description : "");
    const [errors, setErrors] = useState([]); const [busy, setBusy] = useState(false);
    if (!plan) return h(Sheet, { title: "পরিকল্পনা সম্পাদনা", onClose: close }, h(Empty, { icon: "🏠", title: "পাওয়া যায়নি", text: "" }));
    const isResubmit = plan.status === "changes_requested";
    const save = async () => {
      const v = FPCore.validatePlanDraft({ title, type, targetAmount, startDate: plan.startDate, endDate, participantMode: plan.participantMode, participantUids: plan.participantUids });
      if (!v.ok) { setErrors(v.errors); return; }
      setErrors([]); setBusy(true);
      try {
        const patch = { title: v.title, type, icon: FPCore.PLAN_TYPE_MAP[type].icon, targetAmount: v.targetAmount, endDate, description: description.trim() };
        if (isResubmit) await window.FB.resubmitPlan(ctx.familyId, plan.id, ctx.uid, ctx.me.name, patch);
        else await window.FB.editPlan(ctx.familyId, plan.id, ctx.uid, ctx.me.name, patch);
        ctx.toast("পরিবর্তন সংরক্ষিত হয়েছে"); close();
      } catch (e) { setErrors([friendlyError(e)]); } finally { setBusy(false); }
    };
    return h(Sheet, { title: "পরিকল্পনা সম্পাদনা", onClose: close,
      footer: h("button", { style: S.btn, disabled: busy, onClick: save }, busy ? "সংরক্ষণ হচ্ছে…" : (isResubmit ? "পরিবর্তন করে আবার জমা দিন" : "পরিবর্তন সংরক্ষণ")) },
      errors.length > 0 && h("div", { style: { color: "var(--hk-danger)", fontSize: 13, marginBottom: 10 } }, errors.map((e, i) => h("div", { key: i }, "• " + e))),
      h("label", { style: S.label }, "পরিকল্পনার নাম"), h("input", { style: S.input, value: title, onChange: (e) => setTitle(e.target.value) }),
      h("label", { style: S.label }, "ধরন"), h("select", { style: S.input, value: type, onChange: (e) => setType(e.target.value) }, FPCore.PLAN_TYPES.map((t) => h("option", { key: t.key, value: t.key }, `${t.icon} ${t.label}`))),
      h("label", { style: S.label }, "লক্ষ্য টাকা"), h("input", { style: S.input, inputMode: "decimal", value: targetAmount, onChange: (e) => setTargetAmount(e.target.value) }),
      h("label", { style: S.label }, "শেষ তারিখ"), h("input", { type: "date", style: S.input, value: endDate, onChange: (e) => setEndDate(e.target.value) }),
      h("label", { style: S.label }, "বিবরণ"), h("textarea", { style: Object.assign({}, S.input, { minHeight: 70 }), value: description, onChange: (e) => setDescription(e.target.value) }));
  }

  /* ---------------------------- 15. Complete Plan ---------------------------- */
  function FPCompletePlanSheet({ ctx, planId, close }) {
    const plan = (ctx.fam.plans || []).find((p) => p.id === planId);
    const [done, setDone] = useState(plan && plan.status === "completed");
    const firedRef = useRef(false);
    useEffect(() => {
      if (!plan || done || firedRef.current) return;
      firedRef.current = true;
      window.FB.completePlan(ctx.familyId, plan.id, ctx.uid, ctx.me.name).then(() => setDone(true)).catch((e) => ctx.toast(friendlyError(e)));
    }, [plan && plan.id]);
    if (!plan) return h(Sheet, { title: "পরিকল্পনা সম্পন্ন করুন", onClose: close }, h(Empty, { icon: "🏠", title: "পাওয়া যায়নি", text: "" }));
    const contributorCount = FPCore.memberContributionRows(plan, ctx.fam.members).filter((r) => r.approved > 0).length;
    return h(Sheet, { title: "পরিকল্পনা সম্পন্ন করুন", onClose: close,
      footer: h("button", { style: S.btn, onClick: () => ctx.openSheet({ type: "plan-home" }) }, "হোমে ফিরুন") },
      h("div", { style: { textAlign: "center", padding: "20px 0" } },
        h("div", { style: { fontSize: 50 } }, "🎉"),
        h("div", { style: { fontFamily: SERIF, fontSize: 19, marginTop: 10 } }, plan.title),
        h("span", { style: Object.assign({}, S.pill(...FP_TONE.ok), { marginTop: 6, display: "inline-block" }) }, "সম্পন্ন")),
      h("div", { style: S.card },
        [["লক্ষ্য টাকা", `৳${bn(plan.targetAmount)}`], ["মোট সংগ্রহ", `৳${bn(FPCore.approvedTotal(plan))}`], ["মোট সদস্য", `${bn(contributorCount)} জন`], ["সম্পন্নের তারিখ", formatDateBn(today()).full]]
          .map(([k, v], i) => h("div", { key: i, style: Object.assign({}, S.row, { padding: "7px 0", borderBottom: "1px solid var(--hk-border-light)" }) }, h("span", { style: S.muted }, k), h("span", { style: { fontWeight: 600 } }, v)))),
      h("button", { style: Object.assign({}, S.btn2, { width: "100%", marginTop: 10 }), onClick: () => ctx.openSheet({ type: "plan-members", planId: plan.id }) }, "সারাংশ দেখুন"));
  }

  // router for ctx.openSheet({type: "plan-..."}) — called from Module's sheet
  // switch (see FP_SHEET usage there). Returns null for any non-FP sheet type.
  function FP_SHEET(sheet, ctx, close) {
    const t = sheet && sheet.type;
    if (t === "plan-home") return h(FPHomeSheet, { ctx, close });
    if (t === "plan-list") return h(FPAllPlansSheet, { ctx, close });
    if (t === "plan-detail") return h(FPPlanDetailsSheet, { ctx, planId: sheet.planId, close });
    if (t === "plan-create") return h(FPCreatePlanSheet, { ctx, close });
    if (t === "plan-approval") return h(FPPlanApprovalSheet, { ctx, planId: sheet.planId, close });
    if (t === "plan-contribute") return h(FPAddContributionSheet, { ctx, planId: sheet.planId, close });
    if (t === "plan-verify") return h(FPVerificationSheet, { ctx, planId: sheet.planId, close });
    if (t === "plan-members") return h(FPMemberContributionsSheet, { ctx, planId: sheet.planId, close });
    if (t === "plan-expenses") return h(FPExpensesSheet, { ctx, planId: sheet.planId, close });
    if (t === "plan-mine") return h(FPMySheet, { ctx, close });
    if (t === "plan-owner-center") return h(FPOwnerCenterSheet, { ctx, close });
    if (t === "plan-history") return h(FPHistorySheet, { ctx, planId: sheet.planId, close });
    if (t === "plan-edit") return h(FPEditPlanSheet, { ctx, planId: sheet.planId, close });
    if (t === "plan-complete") return h(FPCompletePlanSheet, { ctx, planId: sheet.planId, close });
    return null;
  }

  window.FamilyPlanning = {
    Home: FPHomeBody,
    CreateButton: FPHomeCreateBtn,
    renderSheet: FP_SHEET,
    isPlanSheet: (sheet) => !!(sheet && /^plan-/.test(sheet.type)),
  };
})();
