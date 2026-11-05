// Run: node tests/family-members-sync.test.js
// পরিবারের সদস্যের নাম/ক্যাটাগরি সংক্রান্ত নিয়ম: নাম বদলালে সবখানে নতুন নাম, ক্যাটাগরি সবার জন্য,
// পণ্যের নাম থেকে ক্যাটাগরি স্বয়ংক্রিয়ভাবে তৈরি/নির্বাচন হয় না, এক ইমেইলে একাধিক সদস্য নয়।
"use strict";
const fs = require("fs"), path = require("path"), assert = require("assert");
const P = require("../js/family/family-planning-core.js");
const rd = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
let passed = 0;
const t = (name, f) => { try { f(); passed++; console.log("  \u2713", name); } catch (e) { console.error("  \u2717", name, "\n   ", e.message); process.exitCode = 1; } };

console.log("নাম বদলালে পুরোনো নাম থাকে না");
t("অবদানের সদস্য-সারণি বর্তমান সদস্য-তালিকা থেকে নতুন নাম নেয় (জমা থাকা পুরোনো নাম নয়)", () => {
  const plan = { contributions: [{ memberUid: "u2", memberName: "পুরোনো নাম", claimedAmount: 100, receivedAmount: 100, status: "approved" }] };
  const rows = P.memberContributionRows(plan, [{ uid: "u2", name: "নতুন নাম" }]);
  assert.strictEqual(rows[0].name, "নতুন নাম");
});
t("যে সদস্য আর নেই, তার জমা রাখা নামই দেখায় (ইতিহাস ভাঙে না)", () => {
  const plan = { contributions: [{ memberUid: "gone", memberName: "আগের সদস্য", claimedAmount: 50, receivedAmount: 50, status: "approved" }] };
  assert.strictEqual(P.memberContributionRows(plan, [])[0].name, "আগের সদস্য");
});
t("UI: পরিকল্পনা ও বাজার তালিকা জমা-করা নামের বদলে লাইভ সদস্য-নাম আগে দেখায়", () => {
  const pl = rd("js/family/family-planning.js"), sh = rd("js/family/family-shopping.js");
  assert(/function liveName\(/.test(pl));
  assert(!/h\("span", null, c\.memberName\)/.test(pl), "stored contributor name must not be rendered directly");
  assert(sh.includes("memberName(ctx, l.createdBy, l.createdByName)") && !sh.includes("l.createdByName || memberName"), "list header must prefer the live name");
});
t("সদস্যের email/uid বদলানো যায় না — শুধু নাম, ছবি, সম্পর্ক, ফোন, role, permissions", () => {
  const fb = rd("js/services/firebase-init.js");
  const a = fb.indexOf("async updateFamilyMember"); const body = fb.slice(a, fb.indexOf("\n  },", a));
  assert(body.includes('["role", "permissions", "relation", "name", "photoURL", "phone"]') && !/"email"|"uid"/.test(body));
  assert(body.includes("নাম খালি রাখা যাবে না"));
});
t("নিজের নাম বদলালে Settings থেকে পরিবারের সদস্য-তথ্যেও যায়", () => {
  assert(rd("js/services/firebase-init.js").includes("async syncMyNameToFamilies"));
  assert(rd("js/app/app.js").includes("syncMyNameToFamilies(trimmed)"));
});

console.log("এক ইমেইল = এক সদস্য");
t("accept: আগে থেকে সদস্য হলে নতুন সদস্য তৈরি/ওভাররাইট হয় না; ইমেইল ছোট হাতের অক্ষরে সংরক্ষিত", () => {
  const fb = rd("js/services/firebase-init.js"); const a = fb.indexOf("async acceptInvitation");
  const body = fb.slice(a, fb.indexOf("async rejectInvitation", a));
  assert(body.includes("already") && body.includes('status: "accepted"') && body.includes(".toLowerCase()"));
});
t("invite পাঠানোর আগে: বিদ্যমান সদস্য ও pending invitation উভয়ের ডুপ্লিকেট আটকানো", () => {
  const bz = rd("js/family/family-bazar.js");
  assert(bz.includes("এই ইমেইলের সদস্য আগে থেকেই পরিবারে আছেন") && bz.includes("এই ইমেইলে আগেই একটি Invitation পাঠানো আছে"));
});

console.log("ক্যাটাগরি");
t("Firestore rules: Admin ও User (viewer বাদে) ক্যাটাগরি বানাতে পারে; সবাই পড়তে পারে", () => {
  const r = rd("firebase/firestore.rules"); const a = r.indexOf("match /families/{familyId}/categories/{categoryId}");
  const block = r.slice(a, r.indexOf("}\n", r.indexOf("allow update, delete", a)) + 2);
  assert(/allow read: if isMember\(familyId\)/.test(block) && /allow create: if canWrite\(familyId\)/.test(block) && block.includes("createdBy == request.auth.uid"));
});
t("ক্যাটাগরি সবার স্ক্রিনে লাইভ আসে (onSnapshot) এবং তৈরির সময় createdBy থাকে", () => {
  const fb = rd("js/services/firebase-init.js");
  assert(fb.includes("subscribeFamilyCategories(familyId, cb)") && fb.includes("createdBy: me ? me.uid : null"));
  assert(rd("js/family/family-bazar.js").includes("subscribeFamilyCategories(activeId"));
});
t("পণ্যের নাম লিখলে ক্যাটাগরি নিজে নির্বাচিত/তৈরি হয় না (guessCategoryId কোথাও ব্যবহৃত নয়)", () => {
  for (const f of ["js/family/family-bazar.js", "js/family/family-shopping.js"]) assert(!rd(f).includes("guessCategoryId"), f);
});
t("ক্যাটাগরি ম্যানেজমেন্টে লিখতে পারা সব সদস্য নতুন ক্যাটাগরি যোগ করতে পারে", () => {
  const bz = rd("js/family/family-bazar.js");
  assert(bz.includes("(ctx.vis.admin || ctx.vis.write) && !editing"));
});

console.log(passed + " passed" + (process.exitCode ? " — WITH FAILURES" : ""));
