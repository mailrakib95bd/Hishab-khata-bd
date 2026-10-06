// হিসাব-খাতা — Family Planning: pure logic core.
//
// No React, no Firebase, no DOM — only data in, data out (same discipline as
// family-bazar-core.js, and unit-tested the same way: see
// family-planning.test.js). Loaded as a classic <script>; exposes
// window.FPCore (and module.exports under Node).
//
// এই ফাইলটা পরিবারের নিজস্ব permission/role ব্যবস্থা (owner/admin/member/
// viewer — family-bazar-core.js-এ আগে থেকেই আছে) পুনর্ব্যবহার করে, একটা
// সমান্তরাল নতুন সিস্টেম বানায়নি — তাই "Family Owner" মানে পরিবারের owner
// role, "Family Member" মানে member/admin, "Viewer" মানে viewer role।
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FPCore = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const BN2EN = { "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9" };
  function parseNum(v) {
    if (typeof v === "number") return isFinite(v) ? v : NaN;
    if (v == null) return NaN;
    const s = String(v).replace(/[০-৯]/g, (d) => BN2EN[d]).replace(/[,\s৳]/g, "").replace("।", ".");
    if (s === "" || !/^-?\d*\.?\d*$/.test(s)) return NaN;
    return parseFloat(s);
  }
  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  function randomId() {
    const a = "abcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < 16; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  }
  function isValidYmd(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + "T00:00:00").getTime()); }

  /* ------------------------------- constants ------------------------------ */
  const PLAN_TYPES = [
    { key: "travel", label: "ভ্রমণ", icon: "✈️" },
    { key: "home", label: "ঘর/মেরামত", icon: "🏠" },
    { key: "education", label: "শিক্ষা", icon: "🎓" },
    { key: "device", label: "ডিভাইস/ইলেকট্রনিক্স", icon: "💻" },
    { key: "vehicle", label: "যানবাহন", icon: "🚗" },
    { key: "livestock", label: "পশু/কুরবানি", icon: "🐄" },
    { key: "wedding", label: "বিবাহ", icon: "💍" },
    { key: "emergency", label: "জরুরি তহবিল", icon: "🏦" },
    { key: "device_family", label: "পরিবারের ডিভাইস", icon: "📱" },
    { key: "savings", label: "সঞ্চয়", icon: "💰" },
    { key: "other", label: "অন্যান্য", icon: "📌" },
  ];
  const PLAN_TYPE_MAP = {}; PLAN_TYPES.forEach((t) => (PLAN_TYPE_MAP[t.key] = t));

  // প্রতিটি স্ট্যাটাসের সাথে একটা রঙের ইঙ্গিত (UI pill-এর জন্য) — bg/fg আসল
  // CSS color না, শুধু semantic নাম; UI নিজের theme token-এ ম্যাপ করবে।
  const PLAN_STATUS = {
    pendingApproval: "pending_approval", changesRequested: "changes_requested", active: "active",
    targetAchieved: "target_achieved", completed: "completed", rejected: "rejected",
    paused: "paused", cancelled: "cancelled",
  };
  const PLAN_STATUS_LABEL = {
    pending_approval: { label: "পেন্ডিং", tone: "warn" },
    changes_requested: { label: "পরিবর্তন প্রয়োজন", tone: "warn" },
    active: { label: "সক্রিয়", tone: "ok" },
    target_achieved: { label: "লক্ষ্য পূর্ণ", tone: "ok" },
    completed: { label: "সম্পন্ন", tone: "neutral" },
    rejected: { label: "প্রত্যাখ্যাত", tone: "danger" },
    paused: { label: "স্থগিত", tone: "warn" },
    cancelled: { label: "বাতিল", tone: "danger" },
  };
  // "সব / সক্রিয় / পেন্ডিং / সম্পন্ন" ট্যাব (02_all_plans.png) — কোন
  // স্ট্যাটাসগুলো কোন ট্যাবে পড়ে
  const STATUS_TAB_GROUPS = {
    active: ["active", "target_achieved"],
    pending: ["pending_approval", "changes_requested"],
    completed: ["completed"],
  };

  const CONTRIBUTION_STATUS = { pending: "pending", approved: "approved", rejected: "rejected", partial: "partial" };
  const CONTRIBUTION_STATUS_LABEL = {
    pending: { label: "যাচাই অপেক্ষায়", tone: "warn" },
    approved: { label: "অনুমোদিত", tone: "ok" },
    rejected: { label: "প্রত্যাখ্যাত", tone: "danger" },
    partial: { label: "আংশিক পেয়েছি", tone: "warn" },
  };
  const PAYMENT_METHODS = ["নগদ", "বিকাশ", "নগদ (Nagad)", "রকেট", "ব্যাংক ট্রান্সফার", "অন্যান্য"];
  const CONTRIBUTION_MODES = [
    { key: "monthly", label: "মাসিক" }, { key: "once", label: "একবারে" }, { key: "both", label: "উভয়" },
  ];
  const PARTICIPANT_MODES = { all: "all", selected: "selected" };

  const EXPENSE_STATUS = { approved: "approved", pending: "pending" };

  /* --------------------------------- roles -------------------------------- */
  // পরিবারের বিদ্যমান owner/admin/member/viewer role-ব্যবস্থাই এখানে প্রযোজ্য
  const isOwnerRole = (role) => role === "owner";
  const canApprovePlan = (role) => role === "owner" || role === "admin"; // "Family Owner" অনুমোদন করে; admin-ও মালিকের প্রতিনিধি হিসেবে পারবে
  const canCreatePlan = (role) => role === "owner" || role === "admin" || role === "member"; // viewer বাদে সবাই
  const canContribute = (role) => role === "owner" || role === "admin" || role === "member";
  const isViewerRole = (role) => role === "viewer";

  /* ------------------------------ constructors ----------------------------- */
  function plan(row) {
    const r = row || {};
    return {
      id: r.id || randomId(),
      title: String(r.title || "").trim(),
      type: PLAN_TYPE_MAP[r.type] ? r.type : "other",
      icon: r.icon || (PLAN_TYPE_MAP[r.type] || PLAN_TYPE_MAP.other).icon,
      targetAmount: round2(parseNum(r.targetAmount) || 0),
      perMemberTarget: r.perMemberTarget != null && r.perMemberTarget !== "" ? round2(parseNum(r.perMemberTarget)) : null,
      startDate: r.startDate || null,
      endDate: r.endDate || null,
      description: String(r.description || "").trim(),
      participantMode: r.participantMode === PARTICIPANT_MODES.selected ? "selected" : "all",
      participantUids: Array.isArray(r.participantUids) ? r.participantUids.slice() : [],
      contributionMode: ["monthly", "once", "both"].includes(r.contributionMode) ? r.contributionMode : "both",
      expenseApprovalRequired: !!r.expenseApprovalRequired,
      status: r.status || PLAN_STATUS.pendingApproval,
      createdBy: r.createdBy || null, createdByName: r.createdByName || null, createdAt: r.createdAt || Date.now(),
      approvedBy: r.approvedBy || null, approvedByName: r.approvedByName || null, approvedAt: r.approvedAt || null,
      rejectedBy: r.rejectedBy || null, rejectedAt: r.rejectedAt || null, rejectionReason: r.rejectionReason || "",
      changesRequestedBy: r.changesRequestedBy || null, changesRequestedAt: r.changesRequestedAt || null, changesRequestNote: r.changesRequestNote || "",
      lastModifiedBy: r.lastModifiedBy || null, lastModifiedAt: r.lastModifiedAt || null,
      completedAt: r.completedAt || null,
      contributions: Array.isArray(r.contributions) ? r.contributions : [],
      expenses: Array.isArray(r.expenses) ? r.expenses : [],
      auditLog: Array.isArray(r.auditLog) ? r.auditLog : [],
    };
  }
  function contribution(row) {
    const r = row || {};
    return {
      id: r.id || randomId(),
      memberUid: r.memberUid || null, memberName: r.memberName || "",
      claimedAmount: round2(parseNum(r.claimedAmount) || 0),
      date: r.date || null, paymentMethod: r.paymentMethod || "", note: String(r.note || "").trim(),
      receiptName: r.receiptName || null,
      status: r.status || CONTRIBUTION_STATUS.pending,
      receivedAmount: r.receivedAmount != null ? round2(parseNum(r.receivedAmount)) : null,
      verifiedBy: r.verifiedBy || null, verifiedByName: r.verifiedByName || null, verifiedAt: r.verifiedAt || null,
      rejectionReason: r.rejectionReason || "",
      createdAt: r.createdAt || Date.now(),
    };
  }
  function expense(row) {
    const r = row || {};
    return {
      id: r.id || randomId(),
      title: String(r.title || "").trim(), amount: round2(parseNum(r.amount) || 0),
      date: r.date || null, note: String(r.note || "").trim(),
      addedBy: r.addedBy || null, addedByName: r.addedByName || "",
      status: r.status || EXPENSE_STATUS.approved,
      createdAt: r.createdAt || Date.now(),
    };
  }
  function auditEntry(actorUid, actorName, action, details) {
    return { id: randomId(), ts: Date.now(), actorUid: actorUid || null, actorName: actorName || "", action, details: details || "" };
  }
  // app.js-এর appendAudit()-এর ঠিক একই নিয়ম — ২০০-এ ক্যাপ করা, ঘূর্ণায়মান লগ
  function appendPlanAudit(log, entry) {
    const next = [...(log || []), entry];
    return next.length > 200 ? next.slice(next.length - 200) : next;
  }

  /* -------------------------------- validation ------------------------------ */
  function validatePlanDraft(draft, todayYmd) {
    const errors = [];
    const d = draft || {};
    const title = String(d.title || "").trim();
    if (!title) errors.push("পরিকল্পনার নাম লিখুন");
    else if (title.length > 60) errors.push("পরিকল্পনার নাম অনেক বড়");
    if (!PLAN_TYPE_MAP[d.type]) errors.push("ধরন বেছে নিন");
    const target = parseNum(d.targetAmount);
    if (!(target > 0)) errors.push("লক্ষ্য টাকা দিন");
    if (!isValidYmd(d.startDate)) errors.push("শুরুর তারিখ দিন");
    if (!isValidYmd(d.endDate)) errors.push("শেষ তারিখ দিন");
    if (isValidYmd(d.startDate) && isValidYmd(d.endDate) && d.endDate < d.startDate) errors.push("শেষ তারিখ শুরুর তারিখের আগে হতে পারে না");
    if (d.participantMode === PARTICIPANT_MODES.selected && (!Array.isArray(d.participantUids) || d.participantUids.length === 0))
      errors.push("অন্তত একজন সদস্য বেছে নিন");
    if (d.perMemberTarget != null && d.perMemberTarget !== "" && !(parseNum(d.perMemberTarget) > 0)) errors.push("সদস্য প্রতি লক্ষ্য সঠিক নয়");
    return { ok: errors.length === 0, errors, title, targetAmount: round2(target) };
  }
  function validateContributionDraft(draft) {
    const errors = [];
    const d = draft || {};
    const amt = parseNum(d.claimedAmount);
    if (!(amt > 0)) errors.push("টাকার পরিমাণ দিন");
    if (!isValidYmd(d.date)) errors.push("তারিখ দিন");
    return { ok: errors.length === 0, errors, claimedAmount: round2(amt) };
  }
  function validateExpenseDraft(draft) {
    const errors = [];
    const d = draft || {};
    const title = String(d.title || "").trim();
    if (!title) errors.push("খরচের নাম লিখুন");
    const amt = parseNum(d.amount);
    if (!(amt > 0)) errors.push("পরিমাণ দিন");
    if (!isValidYmd(d.date)) errors.push("তারিখ দিন");
    return { ok: errors.length === 0, errors, title, amount: round2(amt) };
  }

  /* -------------------------------- money calcs ------------------------------ */
  // অনুমোদিত অবদান — receivedAmount থাকলে সেটাই (আংশিক অনুমোদনের বেলায়), নাহলে claimedAmount
  function contributionCredit(c) {
    if (c.status === CONTRIBUTION_STATUS.approved || c.status === CONTRIBUTION_STATUS.partial)
      return round2(c.receivedAmount != null ? c.receivedAmount : c.claimedAmount);
    return 0;
  }
  function approvedTotal(p) { return round2((p.contributions || []).reduce((s, c) => s + contributionCredit(c), 0)); }
  function pendingTotal(p) { return round2((p.contributions || []).filter((c) => c.status === CONTRIBUTION_STATUS.pending).reduce((s, c) => s + round2(c.claimedAmount), 0)); }
  function spentTotal(p) { return round2((p.expenses || []).filter((e) => e.status === EXPENSE_STATUS.approved).reduce((s, e) => s + round2(e.amount), 0)); }
  function remainingTarget(p) { return round2(Math.max(0, p.targetAmount - approvedTotal(p))); }
  function remainingAfterSpend(p) { return round2(approvedTotal(p) - spentTotal(p)); }
  function progressPct(p) { return p.targetAmount > 0 ? Math.min(100, Math.round((approvedTotal(p) / p.targetAmount) * 100)) : 0; }
  function isTargetAchieved(p) { return p.targetAmount > 0 && approvedTotal(p) >= p.targetAmount; }

  // ৬নং পাতা (সদস্যদের অবদান): প্রতি সদস্যের দাবি/পেন্ডিং/অনুমোদিত সারাংশ
  function memberContributionRows(p, members) {
    const byUid = {};
    (p.contributions || []).forEach((c) => {
      const k = c.memberUid || c.memberName;
      if (!byUid[k]) byUid[k] = { uid: c.memberUid, name: c.memberName, claimed: 0, pending: 0, approved: 0 };
      byUid[k].claimed = round2(byUid[k].claimed + round2(c.claimedAmount));
      if (c.status === CONTRIBUTION_STATUS.pending) byUid[k].pending = round2(byUid[k].pending + round2(c.claimedAmount));
      if (c.status === CONTRIBUTION_STATUS.approved || c.status === CONTRIBUTION_STATUS.partial) byUid[k].approved = round2(byUid[k].approved + contributionCredit(c));
    });
    return Object.values(byUid).sort((a, b) => b.approved - a.approved);
  }

  /* ------------------------------ status transitions -------------------------- */
  function approvePlan(p, actorUid, actorName) {
    return Object.assign({}, p, {
      status: PLAN_STATUS.active, approvedBy: actorUid, approvedByName: actorName, approvedAt: Date.now(),
      auditLog: appendPlanAudit(p.auditLog, auditEntry(actorUid, actorName, "plan_approved", `"${p.title}" অনুমোদন করেছেন`)),
    });
  }
  function rejectPlan(p, actorUid, actorName, reason) {
    return Object.assign({}, p, {
      status: PLAN_STATUS.rejected, rejectedBy: actorUid, rejectedAt: Date.now(), rejectionReason: reason || "",
      auditLog: appendPlanAudit(p.auditLog, auditEntry(actorUid, actorName, "plan_rejected", reason ? `প্রত্যাখ্যান করেছেন: ${reason}` : "প্রত্যাখ্যান করেছেন")),
    });
  }
  function requestPlanChanges(p, actorUid, actorName, note) {
    return Object.assign({}, p, {
      status: PLAN_STATUS.changesRequested, changesRequestedBy: actorUid, changesRequestedAt: Date.now(), changesRequestNote: note || "",
      auditLog: appendPlanAudit(p.auditLog, auditEntry(actorUid, actorName, "changes_requested", note ? `পরিবর্তন চাওয়া হয়েছে: ${note}` : "পরিবর্তন চাওয়া হয়েছে")),
    });
  }
  // পরিবর্তন করে আবার জমা দিলে পেন্ডিং-এ ফিরে যায়
  function resubmitPlan(p, actorUid, actorName) {
    return Object.assign({}, p, {
      status: PLAN_STATUS.pendingApproval, changesRequestedBy: null, changesRequestedAt: null, changesRequestNote: "",
      auditLog: appendPlanAudit(p.auditLog, auditEntry(actorUid, actorName, "plan_resubmitted", "পরিবর্তন করে আবার জমা দিয়েছেন")),
    });
  }
  function completePlan(p, actorUid, actorName) {
    return Object.assign({}, p, {
      status: PLAN_STATUS.completed, completedAt: Date.now(),
      auditLog: appendPlanAudit(p.auditLog, auditEntry(actorUid, actorName, "plan_completed", "পরিকল্পনা সম্পন্ন হিসেবে চিহ্নিত করেছেন")),
    });
  }
  // প্রতিবার টাকা সংগ্রহ বাড়ার পর কল করা হয় — লক্ষ্য পূরণ হলে স্বয়ংক্রিয়ভাবে status আপডেট (completed নয়, completed owner নিজে করেন)
  function refreshAchievedStatus(p) {
    if (p.status === PLAN_STATUS.active && isTargetAchieved(p)) return Object.assign({}, p, { status: PLAN_STATUS.targetAchieved });
    if (p.status === PLAN_STATUS.targetAchieved && !isTargetAchieved(p)) return Object.assign({}, p, { status: PLAN_STATUS.active }); // যেমন partial-approve কমিয়ে দিলে
    return p;
  }

  /* --------------------------------- filters --------------------------------- */
  function plansInStatusTab(plans, tab) {
    if (!tab || tab === "all") return plans || [];
    const group = STATUS_TAB_GROUPS[tab];
    return (plans || []).filter((p) => group && group.includes(p.status));
  }
  function searchPlans(plans, q) {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return plans || [];
    return (plans || []).filter((p) => p.title.toLowerCase().includes(s) || (p.description || "").toLowerCase().includes(s));
  }
  function sortPlansNewest(plans) { return [...(plans || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); }

  function isParticipant(p, uid) { return p.participantMode === "all" || (p.participantUids || []).includes(uid); }
  function plansCreatedBy(plans, uid) { return (plans || []).filter((p) => p.createdBy === uid); }
  function plansParticipatingIn(plans, uid) { return (plans || []).filter((p) => isParticipant(p, uid) && p.createdBy !== uid); }
  function pendingApprovalPlans(plans) { return (plans || []).filter((p) => p.status === PLAN_STATUS.pendingApproval); }
  function pendingVerificationContributions(plans) {
    const out = [];
    (plans || []).forEach((p) => (p.contributions || []).forEach((c) => { if (c.status === CONTRIBUTION_STATUS.pending) out.push({ plan: p, contribution: c }); }));
    return out;
  }
  function dashboardTotals(plans) {
    const list = plans || [];
    const activeLike = list.filter((p) => [PLAN_STATUS.active, PLAN_STATUS.targetAchieved].includes(p.status));
    return {
      totalPlans: list.length,
      activePlans: activeLike.length,
      totalTarget: round2(list.reduce((s, p) => s + p.targetAmount, 0)),
      totalApprovedCollection: round2(list.reduce((s, p) => s + approvedTotal(p), 0)),
      pendingContributions: round2(list.reduce((s, p) => s + pendingTotal(p), 0)),
      remaining: round2(list.reduce((s, p) => s + remainingTarget(p), 0)),
    };
  }

  return {
    PLAN_TYPES, PLAN_TYPE_MAP, PLAN_STATUS, PLAN_STATUS_LABEL, STATUS_TAB_GROUPS,
    CONTRIBUTION_STATUS, CONTRIBUTION_STATUS_LABEL, PAYMENT_METHODS, CONTRIBUTION_MODES, PARTICIPANT_MODES, EXPENSE_STATUS,
    isOwnerRole, canApprovePlan, canCreatePlan, canContribute, isViewerRole,
    plan, contribution, expense, auditEntry, appendPlanAudit,
    validatePlanDraft, validateContributionDraft, validateExpenseDraft,
    contributionCredit, approvedTotal, pendingTotal, spentTotal, remainingTarget, remainingAfterSpend, progressPct, isTargetAchieved, memberContributionRows,
    approvePlan, rejectPlan, requestPlanChanges, resubmitPlan, completePlan, refreshAchievedStatus,
    plansInStatusTab, searchPlans, sortPlansNewest, isParticipant, plansCreatedBy, plansParticipatingIn, pendingApprovalPlans, pendingVerificationContributions, dashboardTotals,
    parseNum, round2, randomId, isValidYmd,
  };
});
