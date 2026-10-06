// Run: node tests/family-planning.test.js
"use strict";
const assert = require("assert");
const C = require("../family-planning-core.js");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ✓", name); } catch (e) { console.error("  ✗", name, "\n   ", e.message); process.exitCode = 1; } };

console.log("plan() / contribution() / expense() constructors");
t("a fresh plan starts pending_approval, with no approver and empty logs", () => {
  const p = C.plan({ title: "Family Tour 2027", type: "travel", targetAmount: "60000", startDate: "2026-10-01", endDate: "2027-06-30", createdBy: "u1", createdByName: "রাকিব" });
  assert.strictEqual(p.status, "pending_approval");
  assert.strictEqual(p.approvedBy, null);
  assert.deepStrictEqual(p.contributions, []);
  assert.deepStrictEqual(p.expenses, []);
  assert.strictEqual(p.icon, "✈️");
});
t("an unknown plan type falls back to 'other' (and its icon), never crashes", () => {
  const p = C.plan({ title: "X", type: "not-a-real-type", targetAmount: 1000, startDate: "2026-01-01", endDate: "2026-02-01" });
  assert.strictEqual(p.type, "other");
  assert.strictEqual(p.icon, C.PLAN_TYPE_MAP.other.icon);
});
t("a contribution defaults to pending with no receivedAmount yet", () => {
  const c = C.contribution({ memberUid: "u1", memberName: "রাকিব", claimedAmount: "৫০০০", date: "2026-10-03" });
  assert.strictEqual(c.status, "pending");
  assert.strictEqual(c.claimedAmount, 5000); // Bengali digits parsed
  assert.strictEqual(c.receivedAmount, null);
});
t("an expense defaults to 'approved' status (expenseApprovalRequired off by default)", () => {
  const e = C.expense({ title: "Cement", amount: 25000, date: "2026-10-05" });
  assert.strictEqual(e.status, "approved");
});

console.log("validatePlanDraft()");
t("a complete, valid draft passes", () => {
  const v = C.validatePlanDraft({ title: "Family Tour 2027", type: "travel", targetAmount: "60000", startDate: "2026-10-01", endDate: "2027-06-30" });
  assert.strictEqual(v.ok, true);
  assert.strictEqual(v.targetAmount, 60000);
});
t("rejects missing title / type / target / dates, one error each", () => {
  assert.ok(C.validatePlanDraft({ type: "travel", targetAmount: 1000, startDate: "2026-01-01", endDate: "2026-02-01" }).errors.some((e) => e.includes("নাম")));
  assert.ok(C.validatePlanDraft({ title: "X", targetAmount: 1000, startDate: "2026-01-01", endDate: "2026-02-01" }).errors.some((e) => e.includes("ধরন")));
  assert.ok(C.validatePlanDraft({ title: "X", type: "travel", startDate: "2026-01-01", endDate: "2026-02-01" }).errors.some((e) => e.includes("লক্ষ্য")));
  assert.ok(C.validatePlanDraft({ title: "X", type: "travel", targetAmount: 1000, endDate: "2026-02-01" }).errors.some((e) => e.includes("শুরুর")));
  assert.ok(C.validatePlanDraft({ title: "X", type: "travel", targetAmount: 1000, startDate: "2026-01-01" }).errors.some((e) => e.includes("শেষ তারিখ")));
});
t("end date before start date is rejected", () => {
  const v = C.validatePlanDraft({ title: "X", type: "travel", targetAmount: 1000, startDate: "2026-06-01", endDate: "2026-01-01" });
  assert.strictEqual(v.ok, false);
  assert.ok(v.errors.some((e) => e.includes("আগে হতে পারে না")));
});
t("participantMode 'selected' with no uids chosen is rejected", () => {
  const v = C.validatePlanDraft({ title: "X", type: "travel", targetAmount: 1000, startDate: "2026-01-01", endDate: "2026-02-01", participantMode: "selected", participantUids: [] });
  assert.strictEqual(v.ok, false);
  assert.ok(v.errors.some((e) => e.includes("সদস্য")));
});
t("participantMode 'selected' with at least one uid passes", () => {
  const v = C.validatePlanDraft({ title: "X", type: "travel", targetAmount: 1000, startDate: "2026-01-01", endDate: "2026-02-01", participantMode: "selected", participantUids: ["u1"] });
  assert.strictEqual(v.ok, true);
});

console.log("validateContributionDraft() / validateExpenseDraft()");
t("a contribution needs a positive amount and a date", () => {
  assert.strictEqual(C.validateContributionDraft({ claimedAmount: "৫০০০", date: "2026-10-03" }).ok, true);
  assert.strictEqual(C.validateContributionDraft({ claimedAmount: "0", date: "2026-10-03" }).ok, false);
  assert.strictEqual(C.validateContributionDraft({ claimedAmount: "৫০০০" }).ok, false);
});
t("an expense needs a title, positive amount and a date", () => {
  assert.strictEqual(C.validateExpenseDraft({ title: "Cement", amount: 25000, date: "2026-10-05" }).ok, true);
  assert.strictEqual(C.validateExpenseDraft({ amount: 25000, date: "2026-10-05" }).ok, false);
});

console.log("money calculations — the heart of Owner Approval (sections 4-7 of the spec)");
function samplePlan() {
  return C.plan({
    title: "Family Tour 2027", type: "travel", targetAmount: 60000, startDate: "2026-10-01", endDate: "2027-06-30",
    contributions: [
      C.contribution({ memberUid: "u1", memberName: "রাকিব", claimedAmount: 15000, date: "2026-10-03", status: "approved", receivedAmount: 15000 }),
      C.contribution({ memberUid: "u2", memberName: "বাবা", claimedAmount: 10000, date: "2026-10-03", status: "pending" }),
      C.contribution({ memberUid: "u3", memberName: "ভাই", claimedAmount: 5000, date: "2026-10-02", status: "approved", receivedAmount: 5000 }),
      C.contribution({ memberUid: "u4", memberName: "বোন", claimedAmount: 3000, date: "2026-10-01", status: "approved", receivedAmount: 3000 }),
    ],
  });
}
t("Pending contributions are never counted toward the family's official collected total (Rule 4)", () => {
  const p = samplePlan();
  assert.strictEqual(C.approvedTotal(p), 23000); // 15000+5000+3000, the ৳10,000 pending excluded
  assert.strictEqual(C.pendingTotal(p), 10000);
});
t("a partial-approval credits only the Owner-confirmed received amount, not the member's claim (section 7)", () => {
  const p = C.plan({ targetAmount: 10000, contributions: [
    C.contribution({ memberUid: "u2", memberName: "বাবা", claimedAmount: 10000, date: "2026-10-03", status: "partial", receivedAmount: 8000 }),
  ] });
  assert.strictEqual(C.approvedTotal(p), 8000, "a ৳10,000 claim partially-approved at ৳8,000 must credit exactly ৳8,000");
});
t("a rejected contribution contributes nothing at all", () => {
  const p = C.plan({ targetAmount: 10000, contributions: [C.contribution({ claimedAmount: 10000, date: "2026-10-03", status: "rejected" })] });
  assert.strictEqual(C.approvedTotal(p), 0);
});
t("remainingTarget / progressPct match the worked example in section 6 of the spec (৳33,000 of ৳60,000 → ... wait, our sample is ৳23,000)", () => {
  const p = samplePlan();
  assert.strictEqual(C.remainingTarget(p), 60000 - 23000);
  assert.strictEqual(C.progressPct(p), Math.round((23000 / 60000) * 100));
});
t("progressPct never exceeds 100 even if collection overshoots the target", () => {
  const p = C.plan({ targetAmount: 1000, contributions: [C.contribution({ claimedAmount: 5000, date: "2026-10-03", status: "approved", receivedAmount: 5000 })] });
  assert.strictEqual(C.progressPct(p), 100);
  assert.strictEqual(C.remainingTarget(p), 0, "remaining never goes negative");
});
t("a plan with targetAmount 0 never divides by zero", () => {
  const p = C.plan({ targetAmount: 0 });
  assert.strictEqual(C.progressPct(p), 0);
});
t("spentTotal only counts approved expenses; remainingAfterSpend is collected minus spent (section 14)", () => {
  const p = C.plan({ targetAmount: 100000, contributions: [C.contribution({ claimedAmount: 100000, date: "2026-10-01", status: "approved", receivedAmount: 100000 })],
    expenses: [C.expense({ title: "Cement", amount: 25000, date: "2026-10-05" }), C.expense({ title: "Pending one", amount: 9999, date: "2026-10-06", status: "pending" })] });
  assert.strictEqual(C.spentTotal(p), 25000, "a still-pending expense must not count as spent yet");
  assert.strictEqual(C.remainingAfterSpend(p), 75000);
});
t("isTargetAchieved flips true exactly at 100% approved collection, not before", () => {
  const p = C.plan({ targetAmount: 80000, contributions: [C.contribution({ claimedAmount: 79999, date: "2026-10-01", status: "approved", receivedAmount: 79999 })] });
  assert.strictEqual(C.isTargetAchieved(p), false);
  p.contributions.push(C.contribution({ claimedAmount: 1, date: "2026-10-02", status: "approved", receivedAmount: 1 }));
  assert.strictEqual(C.isTargetAchieved(p), true);
});

console.log("memberContributionRows() — section 6's table");
t("sums claimed/pending/approved per member, sorted by approved amount descending", () => {
  const rows = C.memberContributionRows(samplePlan());
  assert.strictEqual(rows.length, 4);
  assert.strictEqual(rows[0].name, "রাকিব"); assert.strictEqual(rows[0].approved, 15000); assert.strictEqual(rows[0].pending, 0);
  const baba = rows.find((r) => r.name === "বাবা");
  assert.strictEqual(baba.claimed, 10000); assert.strictEqual(baba.pending, 10000); assert.strictEqual(baba.approved, 0);
});

console.log("status transitions — the lifecycle in section 11 / 18");
t("approvePlan moves pending_approval → active, stamps approver, logs an audit entry", () => {
  const p = C.plan({ title: "X", status: "pending_approval" });
  const after = C.approvePlan(p, "owner1", "Owner");
  assert.strictEqual(after.status, "active");
  assert.strictEqual(after.approvedBy, "owner1");
  assert.strictEqual(after.auditLog.length, 1);
  assert.strictEqual(after.auditLog[0].action, "plan_approved");
});
t("rejectPlan moves to rejected and records the reason", () => {
  const after = C.rejectPlan(C.plan({ title: "X" }), "owner1", "Owner", "বাজেট মিলছে না");
  assert.strictEqual(after.status, "rejected");
  assert.strictEqual(after.rejectionReason, "বাজেট মিলছে না");
});
t("requestPlanChanges → changes_requested; resubmitPlan sends it back to pending_approval and clears the request", () => {
  const p1 = C.requestPlanChanges(C.plan({ title: "X" }), "owner1", "Owner", "তারিখ ঠিক করুন");
  assert.strictEqual(p1.status, "changes_requested");
  assert.strictEqual(p1.changesRequestNote, "তারিখ ঠিক করুন");
  const p2 = C.resubmitPlan(p1, "u1", "Creator");
  assert.strictEqual(p2.status, "pending_approval");
  assert.strictEqual(p2.changesRequestedBy, null);
  assert.strictEqual(p2.auditLog.length, 2, "both the request and the resubmit are logged");
});
t("refreshAchievedStatus flips active → target_achieved once collection reaches target, and back if it drops (e.g. a verified amount gets corrected down)", () => {
  const p = samplePlan();
  p.status = "active";
  p.contributions.push(C.contribution({ claimedAmount: 37000, date: "2026-10-04", status: "approved", receivedAmount: 37000 })); // 23000+37000=60000
  const achieved = C.refreshAchievedStatus(p);
  assert.strictEqual(achieved.status, "target_achieved");
  achieved.contributions[achieved.contributions.length - 1].receivedAmount = 30000; // corrected down, no longer 100%
  const back = C.refreshAchievedStatus(achieved);
  assert.strictEqual(back.status, "active");
});
t("completePlan sets status completed and stamps completedAt", () => {
  const after = C.completePlan(C.plan({ title: "X", status: "target_achieved" }), "owner1", "Owner");
  assert.strictEqual(after.status, "completed");
  assert.ok(after.completedAt > 0);
});

console.log("roles — Family Owner / Family Member / Viewer (section/screen 18)");
t("only owner and admin can approve plans — member and viewer cannot", () => {
  assert.strictEqual(C.canApprovePlan("owner"), true);
  assert.strictEqual(C.canApprovePlan("admin"), true);
  assert.strictEqual(C.canApprovePlan("member"), false);
  assert.strictEqual(C.canApprovePlan("viewer"), false);
});
t("owner/admin/member can all create plans and contribute (Rule 1) — viewer can do neither", () => {
  ["owner", "admin", "member"].forEach((r) => { assert.strictEqual(C.canCreatePlan(r), true); assert.strictEqual(C.canContribute(r), true); });
  assert.strictEqual(C.canCreatePlan("viewer"), false);
  assert.strictEqual(C.canContribute("viewer"), false);
});
t("isViewerRole / isOwnerRole are exact, not fuzzy", () => {
  assert.strictEqual(C.isViewerRole("viewer"), true);
  assert.strictEqual(C.isViewerRole("admin"), false);
  assert.strictEqual(C.isOwnerRole("owner"), true);
  assert.strictEqual(C.isOwnerRole("admin"), false);
});

console.log("filters / dashboards — screens 01, 02, 10, 11");
function threePlans() {
  return [
    C.plan({ id: "p1", title: "Family Tour", status: "active", createdBy: "u1", createdAt: 3 }),
    C.plan({ id: "p2", title: "House Repair", status: "pending_approval", createdBy: "u2", createdAt: 1, participantMode: "selected", participantUids: ["u1"] }),
    C.plan({ id: "p3", title: "Laptop Fund", status: "completed", createdBy: "u1", createdAt: 2 }),
  ];
}
t("plansInStatusTab groups active+target_achieved under 'active', pending_approval+changes_requested under 'pending'", () => {
  assert.strictEqual(C.plansInStatusTab(threePlans(), "active").length, 1);
  assert.strictEqual(C.plansInStatusTab(threePlans(), "pending").length, 1);
  assert.strictEqual(C.plansInStatusTab(threePlans(), "completed").length, 1);
  assert.strictEqual(C.plansInStatusTab(threePlans(), "all").length, 3);
});
t("searchPlans matches title or description, case-insensitively", () => {
  assert.strictEqual(C.searchPlans(threePlans(), "tour").length, 1);
  assert.strictEqual(C.searchPlans(threePlans(), "REPAIR").length, 1);
  assert.strictEqual(C.searchPlans(threePlans(), "nonexistent").length, 0);
});
t("sortPlansNewest orders by createdAt descending", () => {
  const sorted = C.sortPlansNewest(threePlans());
  assert.deepStrictEqual(sorted.map((p) => p.id), ["p1", "p3", "p2"]);
});
t("plansCreatedBy vs plansParticipatingIn (My Planning, screen 10) never double-counts the creator as a participant", () => {
  const plans = threePlans();
  assert.strictEqual(C.plansCreatedBy(plans, "u1").length, 2); // p1, p3
  const participating = C.plansParticipatingIn(plans, "u1");
  assert.strictEqual(participating.length, 1); // p2 (selected, u1 is a participant but NOT the creator)
  assert.strictEqual(participating[0].id, "p2");
});
t("pendingApprovalPlans / pendingVerificationContributions feed the Owner Approval Center (screen 11)", () => {
  assert.strictEqual(C.pendingApprovalPlans(threePlans()).length, 1);
  const withContribs = [C.plan({ id: "p1", status: "active", contributions: [C.contribution({ claimedAmount: 5000, date: "2026-10-03", status: "pending" })] })];
  assert.strictEqual(C.pendingVerificationContributions(withContribs).length, 1);
});
t("dashboardTotals matches the worked Home-screen example (screen 01 / section 8)", () => {
  const plans = [
    C.plan({ targetAmount: 100000, status: "active", contributions: [C.contribution({ claimedAmount: 75000, date: "2026-10-01", status: "approved", receivedAmount: 75000 })] }),
    C.plan({ targetAmount: 60000, status: "active", contributions: [C.contribution({ claimedAmount: 35000, date: "2026-10-01", status: "approved", receivedAmount: 35000 })] }),
    C.plan({ targetAmount: 80000, status: "active", contributions: [C.contribution({ claimedAmount: 20000, date: "2026-10-01", status: "approved", receivedAmount: 20000 })] }),
    C.plan({ targetAmount: 110000, status: "active", contributions: [C.contribution({ claimedAmount: 80000, date: "2026-10-01", status: "approved", receivedAmount: 80000 })] }),
    C.plan({ targetAmount: 50000, status: "pending_approval" }),
  ];
  const t = C.dashboardTotals(plans);
  assert.strictEqual(t.totalPlans, 5);
  assert.strictEqual(t.activePlans, 4);
  assert.strictEqual(t.totalTarget, 400000);
  assert.strictEqual(t.totalApprovedCollection, 210000);
});

console.log("audit log — section 3 & 16: capped at 200, nothing ever silently lost before the cap");
t("appendPlanAudit caps at 200 entries, dropping the oldest first (rolling log)", () => {
  let log = [];
  for (let i = 0; i < 205; i++) log = C.appendPlanAudit(log, C.auditEntry("u1", "U", "x", String(i)));
  assert.strictEqual(log.length, 200);
  assert.strictEqual(log[0].details, "5"); // entries 0-4 rolled off
  assert.strictEqual(log[199].details, "204");
});

console.log(`\n${passed} passed${process.exitCode ? " — WITH FAILURES" : ""}`);
