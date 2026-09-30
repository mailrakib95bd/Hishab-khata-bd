// হিসাব-খাতা — optional cloud account / backup layer.
//
// This is a native ES module (loaded via <script type="module">), so it can
// use `import` straight from a CDN URL — no bundler, no Babel. It sets up
// window.FB with the small set of methods the app already expects, then
// fires a "fb-ready" event. If there's no internet or the CDN is
// unreachable, the imports below simply fail and window.FB is never set —
// the app already treats that as "local-only mode" and keeps working.
//
// Firestore data model (kept intentionally simple — one document per user,
// matching how the app already treats all of its data as a single local
// blob): users/{uid} → { transactions, budget, tasks, specialDays, debts,
// expenseCats, incomeCats, categoryBudgets, accountOpening, transfers,
// updatedAt }. The device PIN is deliberately never synced.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  initializeFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
  where,
  limit,
  increment,
  arrayUnion,
  arrayRemove,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCdP50tFbtAH5vPT8fAr6c6H0DUY6TrJk0",
  authDomain: "rakib-hossen-55e03.firebaseapp.com",
  projectId: "rakib-hossen-55e03",
  storageBucket: "rakib-hossen-55e03.firebasestorage.app",
  messagingSenderId: "387454418900",
  appId: "1:387454418900:web:4872a9d1b17caba6b46041",
  measurementId: "G-TSDY7NXNQX",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Firestore's default streaming transport (WebChannel/gRPC-Web) is built
// for real browsers and can silently fail inside an Android WebView (writes
// still go through, since those use a simpler request, but reads never
// sync — exactly "নতুন ট্রানজেকশন যোগ হয় কিন্তু পুরোনো ইতিহাস/ডেটা আসে না",
// which only ever showed up in the packaged APK, never on the web). Forcing
// long-polling here is the documented fix for Firestore inside WebViews —
// it's a bit chattier than streaming but works reliably everywhere,
// browser included, so this is safe to always turn on rather than only for
// native builds.
let db;
try {
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
} catch (e) {
  // initializeFirestore throws if something (e.g. a hot-reload in dev)
  // already initialized Firestore for this app — fall back to the
  // already-initialized instance rather than crash the whole module.
  db = getFirestore(app);
}

async function signInGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    // popups are blocked in some mobile in-app browsers — fall back to a
    // full-page redirect flow instead of failing outright
    if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) {
      await signInWithRedirect(auth, provider);
    } else {
      throw e;
    }
  }
}

let famCache = { at: 0, uid: null, ids: [] };

window.FB = {
  onAuthChange(cb) {
    return onAuthStateChanged(auth, cb);
  },
  signInGoogle,
  async signInEmail(email, password) {
    await signInWithEmailAndPassword(auth, email, password);
  },
  async signUpEmail(email, password) {
    await createUserWithEmailAndPassword(auth, email, password);
  },
  async resetPassword(email) {
    await sendPasswordResetEmail(auth, email);
  },
  async logOut() {
    await signOut(auth);
  },
  async loadCloudData(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  },
  async saveCloudData(uid, data) {
    await setDoc(doc(db, "users", uid), { ...data, updatedAt: Date.now() });
  },
  // ---- admin-managed global collections: notices, dailyMessages,
  // adminSpecialDays. Reads are allowed for any signed-in user; writes are
  // rejected server-side by firestore.rules unless request.auth.uid matches
  // the primary admin UID — the isAdmin() check the UI does before calling
  // these is only for hiding the buttons, never the actual security
  // boundary. See firestore.rules for the enforced rule.
  async listCollection(name) {
    const snap = await getDocs(query(collection(db, name), orderBy("createdAt", "desc")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  async addDocTo(name, data) {
    const ref = await addDoc(collection(db, name), { ...data, createdAt: Date.now() });
    return ref.id;
  },
  async updateDocIn(name, id, patch) {
    await updateDoc(doc(db, name, id), { ...patch, updatedAt: Date.now() });
  },
  async deleteDocFrom(name, id) {
    await deleteDoc(doc(db, name, id));
  },
  // bulk-import special days in one atomic batch (max 500 per Firestore
  // batch — the caller chunks larger imports)
  async batchAddTo(name, items) {
    const batch = writeBatch(db);
    items.forEach((item) => {
      const ref = doc(collection(db, name));
      batch.set(ref, { ...item, createdAt: Date.now() });
    });
    await batch.commit();
  },

  // ---- Family Bazar ----------------------------------------------------
  // Thin data layer. The SECURITY BOUNDARY is firestore.rules — nothing here
  // is trusted. All money maths / write planning lives in family-bazar-core.js
  // (pure + unit-tested); this file only turns a plan into Firestore writes.
  //
  //   families/{f}                      name, ownerId, memberUids[], photoURL …
  //   families/{f}/members/{uid}        role, permissions, relation …
  //   invitations/{id}                  top level: an invitee finds theirs by e-mail
  //   families/{f}/purchases/{id}       one doc per shopping trip; items[] embedded
  //   families/{f}/priceHistory/{p_i}   one row per item, id = purchaseId_itemId
  //   families/{f}/locations/{id}       latest price per product × place × unit
  //   families/{f}/memberMonthly/{u_m}  per-member monthly totals (+ per day)
  //   families/{f}/memberCategoryMonthly/{u_m}
  //   families/{f}/products | categories | budgets

  currentUser() {
    return auth.currentUser;
  },
  // invitations are only honoured for a verified e-mail (Google sign-in)
  emailVerified() {
    return !!(auth.currentUser && auth.currentUser.emailVerified);
  },

  async myFamilies() {
    const uid = auth.currentUser.uid;
    const snap = await getDocs(query(collection(db, "families"), where("memberUids", "array-contains", uid)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  // family doc + the owner's own member doc in ONE batch (the rules check them together)
  async createFamily(name, icon) {
    const u = auth.currentUser;
    const now = Date.now();
    const fref = doc(collection(db, "families"));
    const batch = writeBatch(db);
    batch.set(fref, {
      name: String(name).trim(), photoURL: null, ownerId: u.uid, memberUids: [u.uid],
      active: true, settings: { icon: icon || "🏠" }, createdAt: now, updatedAt: now,
    });
    batch.set(doc(db, "families", fref.id, "members", u.uid), {
      uid: u.uid, name: u.displayName || (u.email || "").split("@")[0] || "আমি", email: u.email || "",
      photoURL: u.photoURL || null, relation: "self", role: "owner",
      permissions: window.FBCore.permissionPreset("owner"), status: "active", joinedAt: now, updatedAt: now,
    });
    await batch.commit();
    return fref.id;
  },

  // live family document (name / icon / settings) for everyone in the family
  subscribeFamily(familyId, cb) {
    return onSnapshot(doc(db, "families", familyId), (snap) => { if (snap.exists()) cb({ id: snap.id, ...snap.data() }); }, () => {});
  },

  async updateFamily(familyId, patch) {
    const allowed = {};
    ["name", "photoURL", "settings"].forEach((k) => { if (k in patch && patch[k] !== undefined) allowed[k] = patch[k]; });
    if (allowed.settings) allowed.settings = JSON.parse(JSON.stringify(allowed.settings)); // drops any undefined inside
    await updateDoc(doc(db, "families", familyId), { ...allowed, updatedAt: Date.now() });
  },

  // owner only. Family data is removed collection by collection (Firestore has
  // no recursive delete from a client); members' docs go first, the family doc
  // next, and the owner's own member doc last.
  async deleteFamily(familyId) {
    const uid = auth.currentUser.uid;
    const wipe = async (refs) => {
      for (let i = 0; i < refs.length; i += 400) {
        const b = writeBatch(db);
        refs.slice(i, i + 400).forEach((r) => b.delete(r));
        await b.commit();
      }
    };
    for (const name of ["purchases", "priceHistory", "locations", "memberMonthly", "memberCategoryMonthly", "memberOtherMonthly", "products", "categories", "budgets"]) {
      const snap = await getDocs(collection(db, "families", familyId, name));
      await wipe(snap.docs.map((d) => d.ref));
    }
    const inv = await getDocs(query(collection(db, "invitations"), where("invitedBy", "==", uid), where("familyId", "==", familyId)));
    await wipe(inv.docs.map((d) => d.ref));
    const mem = await getDocs(collection(db, "families", familyId, "members"));
    await wipe(mem.docs.filter((d) => d.id !== uid).map((d) => d.ref));
    await deleteDoc(doc(db, "families", familyId));
    await deleteDoc(doc(db, "families", familyId, "members", uid));
  },

  async familyMembers(familyId) {
    const snap = await getDocs(collection(db, "families", familyId, "members"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  // live member list — so a name (or phone/role/permission) change is seen
  // by every other family member immediately, not just on next reload
  subscribeFamilyMembers(familyId, cb) {
    return onSnapshot(collection(db, "families", familyId, "members"), (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => cb(null)); // null = the listener failed (e.g. no longer a member) — distinct from a real empty list
  },

  // manager changing role / permissions / relation, or a person editing
  // their own name/photo/relation/phone; the family OWNER may additionally
  // edit ANY member's name/photo/relation/phone (not just role/permissions)
  async updateFamilyMember(familyId, memberUid, patch) {
    const allowed = {};
    ["role", "permissions", "relation", "name", "photoURL", "phone"].forEach((k) => { if (k in patch) allowed[k] = patch[k]; });
    await updateDoc(doc(db, "families", familyId, "members", memberUid), { ...allowed, updatedAt: Date.now() });
  },

  // remove someone (manager) or leave (memberUid === me): member doc + memberUids in one batch
  async removeFamilyMember(familyId, memberUid) {
    const batch = writeBatch(db);
    batch.update(doc(db, "families", familyId), { memberUids: arrayRemove(memberUid), lastRemovedUid: memberUid, updatedAt: Date.now() });
    batch.delete(doc(db, "families", familyId, "members", memberUid));
    await batch.commit();
  },

  // ---- invitations ----
  async sendInvitation({ familyId, familyName, invitedEmail, relation, role, permissions, phone }) {
    const now = Date.now();
    const ref = await addDoc(collection(db, "invitations"), {
      familyId, familyName, invitedBy: auth.currentUser.uid,
      invitedByName: auth.currentUser.displayName || auth.currentUser.email || "",
      invitedEmail: String(invitedEmail).trim().toLowerCase(), relation, role,
      permissions: window.FBCore.normalizePermissions(permissions),
      phone: String(phone || "").trim().slice(0, 20),
      status: "pending", createdAt: now, expiresAt: now + 7 * 24 * 60 * 60 * 1000,
    });
    return ref.id;
  },

  // pending, unexpired invitations addressed to MY verified e-mail
  async myIncomingInvitations() {
    const u = auth.currentUser;
    const email = (u.email || "").toLowerCase();
    if (!email || !u.emailVerified) return [];
    const snap = await getDocs(query(collection(db, "invitations"), where("invitedEmail", "==", email)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((i) => i.status === "pending" && i.expiresAt > Date.now())
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  // invitations I sent for one family (pending / accepted / …)
  async familySentInvitations(familyId) {
    const snap = await getDocs(query(collection(db, "invitations"), where("invitedBy", "==", auth.currentUser.uid), where("familyId", "==", familyId)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt);
  },

  // ONE atomic batch: member doc + memberUids + invitation status. The rules
  // validate the member doc against the invitation, so role/permissions can't be forged.
  async acceptInvitation(invite) {
    const u = auth.currentUser;
    const now = Date.now();
    const batch = writeBatch(db);
    batch.set(doc(db, "families", invite.familyId, "members", u.uid), {
      uid: u.uid, name: u.displayName || (u.email || "").split("@")[0], email: u.email || "",
      photoURL: u.photoURL || null, relation: invite.relation, role: invite.role,
      permissions: invite.permissions, status: "active", joinedAt: now, updatedAt: now, inviteId: invite.id,
      phone: String(invite.phone || "").trim().slice(0, 20),
    });
    batch.update(doc(db, "families", invite.familyId), { memberUids: arrayUnion(u.uid), updatedAt: now });
    batch.update(doc(db, "invitations", invite.id), { status: "accepted", respondedAt: now });
    await batch.commit();
  },
  async rejectInvitation(inviteId) {
    await updateDoc(doc(db, "invitations", inviteId), { status: "rejected", respondedAt: Date.now() });
  },
  async cancelInvitation(inviteId) {
    await updateDoc(doc(db, "invitations", inviteId), { status: "cancelled", respondedAt: Date.now() });
  },

  // ---- catalogues ----
  async familyProducts(familyId) {
    const snap = await getDocs(collection(db, "families", familyId, "products"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  async renameProduct(familyId, productId, oldName, newName) {
    await updateDoc(doc(db, "families", familyId, "products", productId), { name: newName.trim(), aliases: arrayUnion(oldName), updatedAt: Date.now() });
  },
  async setProductArchived(familyId, productId, archived) {
    await updateDoc(doc(db, "families", familyId, "products", productId), { archived: !!archived, updatedAt: Date.now() });
  },
  // owner/admin fixing a product that landed in the wrong category (e.g. a
  // typo created a near-duplicate item under "অন্যান্য") — purchases and
  // price history keep pointing at the same productId, so nothing else
  // needs to change; only future totals-by-category use this going forward.
  async setProductCategory(familyId, productId, categoryId) {
    await updateDoc(doc(db, "families", familyId, "products", productId), { categoryId: categoryId || null, updatedAt: Date.now() });
  },
  async familyCategories(familyId) {
    const snap = await getDocs(collection(db, "families", familyId, "categories"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  async addFamilyCategory(familyId, { name, icon, group }) {
    const ref = await addDoc(collection(db, "families", familyId, "categories"), { name: name.trim(), icon: icon || "🏷️", group: group || "grocery", createdAt: Date.now() });
    return ref.id;
  },
  async updateFamilyCategory(familyId, id, { name, icon }) {
    await updateDoc(doc(db, "families", familyId, "categories", id), { name: name.trim(), icon: icon || "🏷️", updatedAt: Date.now() });
  },
  async deleteFamilyCategory(familyId, id) {
    await deleteDoc(doc(db, "families", familyId, "categories", id));
  },
  async getFamilyBudget(familyId) {
    const snap = await getDoc(doc(db, "families", familyId, "budgets", "current"));
    return snap.exists() ? snap.data() : null;
  },
  async setFamilyBudget(familyId, monthlyAmount) {
    await setDoc(doc(db, "families", familyId, "budgets", "current"), { monthlyAmount, updatedAt: Date.now(), updatedBy: auth.currentUser.uid });
  },

  // ---- purchases ----
  // month view: everyone's purchases if allowed, otherwise just mine
  async purchasesForMonth(familyId, month, seeAll) {
    const cs = [where("month", "==", month)];
    if (!seeAll) cs.push(where("memberId", "==", auth.currentUser.uid));
    const snap = await getDocs(query(collection(db, "families", familyId, "purchases"), ...cs, limit(400)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || 0) - (a.createdAt || 0));
  },

  // create / edit / delete a purchase. oldP = null → create; newP = null → delete.
  // Everything that must stay consistent (purchase, my monthly totals, my
  // category totals, price-history rows, product catalogue) is ONE atomic batch.
  // Shared "latest price per place" docs are best-effort afterwards, because
  // any member may own that id and a stale write must never fail the purchase.
  async savePurchase(familyId, oldP, newP) {
    const uid = auth.currentUser.uid;
    const plan = window.FBCore.planPurchaseChange(oldP, newP, uid);
    const now = Date.now();
    const F = (name, id) => doc(db, "families", familyId, name, id);
    const batch = writeBatch(db);
    if (newP) batch.set(F("purchases", newP.purchaseId), newP);
    else batch.delete(F("purchases", oldP.purchaseId));
    plan.monthly.forEach((m) => batch.set(F("memberMonthly", m.id), { ...resolveIncs(m.data), updatedAt: now }, { merge: true }));
    plan.categories.forEach((m) => batch.set(F("memberCategoryMonthly", m.id), { ...resolveIncs(m.data), updatedAt: now }, { merge: true }));
    plan.priceSet.forEach((r) => batch.set(F("priceHistory", r.id), { ...r.data, createdAt: now }));
    plan.priceDelete.forEach((id) => batch.delete(F("priceHistory", id)));
    plan.products.forEach((p) => batch.set(F("products", p.id), { ...p.data, archived: false, updatedAt: now }, { merge: true }));
    await batch.commit();

    for (const l of plan.locationSet) {
      try {
        const cur = await getDoc(F("locations", l.id)).catch(() => null);
        if (cur && cur.exists() && (cur.data().date || "") > l.data.date) continue;
        await setDoc(F("locations", l.id), { ...l.data, updatedAt: now });
      } catch (e) { /* best effort */ }
    }
    for (const id of plan.locationRelease) {
      try {
        const cur = await getDoc(F("locations", id));
        if (cur.exists() && cur.data().purchaseId === plan.purchaseId) await deleteDoc(F("locations", id));
      } catch (e) { /* best effort */ }
    }
    return newP;
  },

  // ---- aggregates & price data (each call asks only for what the caller may see) ----
  async monthlyStats(familyId, months, { totals, categories }) {
    const uid = auth.currentUser.uid;
    const load = async (coll, seeAll) => {
      if (seeAll) {
        const snap = await getDocs(query(collection(db, "families", familyId, coll), where("month", "in", months)));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      const out = [];
      for (const m of months) {
        try {
          const s = await getDoc(doc(db, "families", familyId, coll, `${uid}_${m}`));
          if (s.exists()) out.push({ id: s.id, ...s.data() });
        } catch (e) { /* nothing recorded */ }
      }
      return out;
    };
    const [monthly, cats] = await Promise.all([load("memberMonthly", totals), load("memberCategoryMonthly", categories)]);
    return { monthly, cats };
  },

  // live monthly totals/category-totals — this is what makes the "কে কত
  // খরচ করেছে" dashboard update the instant anyone in the family (with
  // permission to be seen) logs a purchase, on every device, not just the
  // one that made the change. `totals`/`categories` gate visibility exactly
  // like monthlyStats above: seeing all members' docs, or only your own.
  subscribeMonthlyStats(familyId, months, { totals, categories }, cb) {
    const uid = auth.currentUser.uid;
    const state = { monthly: [], cats: [], other: [] };
    const emit = () => cb({ monthly: state.monthly, cats: state.cats, other: state.other });
    const watch = (coll, seeAll, key) => {
      if (seeAll) {
        return onSnapshot(query(collection(db, "families", familyId, coll), where("month", "in", months)), (snap) => {
          state[key] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          emit();
        }, () => { state[key] = []; emit(); });
      }
      const rows = {};
      const unsubs = months.map((m) => onSnapshot(doc(db, "families", familyId, coll, `${uid}_${m}`), (snap) => {
        if (snap.exists()) rows[m] = { id: snap.id, ...snap.data() }; else delete rows[m];
        state[key] = Object.values(rows);
        emit();
      }, () => {}));
      return () => unsubs.forEach((u) => u());
    };
    const stopMonthly = watch("memberMonthly", totals, "monthly");
    const stopCats = watch("memberCategoryMonthly", categories, "cats");
    const stopOther = watch("memberOtherMonthly", totals, "other");
    return () => { stopMonthly(); stopCats(); stopOther(); };
  },

  // price rows: by product and/or by month(s); mine only unless allowed to see all
  async priceRows(familyId, { productId, months, seeAll, max }) {
    const cs = [];
    if (productId) cs.push(where("productId", "==", productId));
    if (months && months.length) cs.push(where("month", "in", months));
    if (!seeAll) cs.push(where("memberId", "==", auth.currentUser.uid));
    const snap = await getDocs(query(collection(db, "families", familyId, "priceHistory"), ...cs, limit(max || 300)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  async locationRows(familyId, { productId, seeAll, max }) {
    const cs = [];
    if (productId) cs.push(where("productId", "==", productId));
    if (!seeAll) cs.push(where("memberId", "==", auth.currentUser.uid));
    const snap = await getDocs(query(collection(db, "families", familyId, "locations"), ...cs, limit(max || 300)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  // repair: rebuild MY monthly aggregates from MY purchases (drift can only
  // come from an interrupted client; this makes them exact again)
  async rebuildMyStats(familyId) {
    const uid = auth.currentUser.uid;
    const snap = await getDocs(query(collection(db, "families", familyId, "purchases"), where("memberId", "==", uid), limit(3000)));
    const built = window.FBCore.buildStatsFromPurchases(snap.docs.map((d) => d.data()));
    const today = window.FBCore.dateToYmd(new Date());
    const months = new Set(Object.keys(built));
    window.FBCore.monthsBack(window.FBCore.monthOf(today), 12).forEach((m) => months.add(m));
    let written = 0;
    for (const m of months) {
      const b = built[m] || { total: 0, count: 0, days: {}, cats: {} };
      const categories = {};
      Object.keys(b.cats).forEach((k) => (categories[k] = b.cats[k]));
      const has = built[m] || (await getDoc(doc(db, "families", familyId, "memberMonthly", `${uid}_${m}`)).then((s) => s.exists()).catch(() => false));
      if (!has) continue;
      await setDoc(doc(db, "families", familyId, "memberMonthly", `${uid}_${m}`), { memberId: uid, month: m, total: b.total, count: b.count, days: b.days, updatedAt: Date.now() });
      await setDoc(doc(db, "families", familyId, "memberCategoryMonthly", `${uid}_${m}`), { memberId: uid, month: m, categories, updatedAt: Date.now() });
      written++;
    }
    return written;
  },

  // Publishes THIS account's personal expense total (everything in the
  // dashboard timeline except what came from Family Bazar, which is already
  // counted there) for the given months, to every family it belongs to —
  // so "কে কত খরচ করেছে" can show  বাজার + অন্যান্য = মোট. Members who hold the
  // "মাসিক মোট" permission can see it (rules), nobody else. byMonth: {"2026-09": 6500}
  async publishOtherExpense(byMonth) {
    const u = auth.currentUser;
    if (!u) return 0;
    const now = Date.now();
    if (!famCache.at || now - famCache.at > 10 * 60 * 1000 || famCache.uid !== u.uid) {
      const snap = await getDocs(query(collection(db, "families"), where("memberUids", "array-contains", u.uid)));
      famCache = { at: now, uid: u.uid, ids: snap.docs.map((d) => d.id) };
    }
    let wrote = 0;
    for (const fid of famCache.ids) {
      for (const m of Object.keys(byMonth)) {
        try {
          await setDoc(doc(db, "families", fid, "memberOtherMonthly", `${u.uid}_${m}`), { memberId: u.uid, month: m, total: Number(byMonth[m]) || 0, updatedAt: now });
          wrote++;
        } catch (e) { /* not (or no longer) a member here, or rules not published yet — harmless */ }
      }
    }
    return wrote;
  },

  // ---- shopping lists ---------------------------------------------------
  // A household "to-buy" list assigned to one member, with an optional
  // reminder. Small collection; the security rules already filter every
  // read down to lists this account created, is assigned, or manages, so a
  // plain collection read is enough (a `where` here couldn't add privacy
  // beyond what the rule already enforces).
  // IMPORTANT: Firestore security rules are not filters. The rule lets you
  // read a list only if you created it or it's assigned to you, so a query
  // over the WHOLE collection is rejected outright for anyone but an
  // owner/admin (that's why lists "weren't showing" for ordinary members).
  // The query itself has to prove it: one query per condition, merged here.
  async familyShoppingLists(familyId) {
    const uid = auth.currentUser.uid;
    const col = collection(db, "families", familyId, "shoppingLists");
    const [a, c] = await Promise.all([
      getDocs(query(col, where("assignedTo", "==", uid))),
      getDocs(query(col, where("createdBy", "==", uid))),
    ]);
    const map = {};
    a.docs.concat(c.docs).forEach((d) => { map[d.id] = { id: d.id, ...d.data() }; });
    return Object.values(map);
  },

  // live version of the above — the person a list was made FOR (or who made
  // it) sees it, and every later edit, immediately
  subscribeShoppingLists(familyId, cb) {
    const uid = auth.currentUser.uid;
    const col = collection(db, "families", familyId, "shoppingLists");
    const parts = { a: [], c: [] };
    const emit = () => {
      const map = {};
      parts.a.concat(parts.c).forEach((l) => { map[l.id] = l; });
      cb(Object.values(map));
    };
    const grab = (key) => (snap) => { parts[key] = snap.docs.map((d) => ({ id: d.id, ...d.data() })); emit(); };
    const fail = (key) => () => { parts[key] = []; emit(); };
    const u1 = onSnapshot(query(col, where("assignedTo", "==", uid)), grab("a"), fail("a"));
    const u2 = onSnapshot(query(col, where("createdBy", "==", uid)), grab("c"), fail("c"));
    return () => { u1(); u2(); };
  },

  async saveShoppingList(familyId, list) {
    const now = Date.now();
    const id = list.id || doc(collection(db, "families", familyId, "shoppingLists")).id;
    const items = list.items || [];
    const data = {
      title: list.title || "আজকের বাজার", createdBy: list.createdBy, assignedTo: list.assignedTo,
      items, reminder: list.reminder || null,
      status: !items.length || items.some((it) => !it.checked) ? "active" : "done",
      createdAt: list.createdAt || now, updatedAt: now,
    };
    await setDoc(doc(db, "families", familyId, "shoppingLists", id), data);
    return id;
  },

  async deleteShoppingList(familyId, listId) {
    await deleteDoc(doc(db, "families", familyId, "shoppingLists", listId));
  },

  // manual checkbox — marks an item done without buying it (stays in the
  // list, struck through) or un-marks it
  async toggleShoppingItem(familyId, listId, itemId, checked) {
    const ref = doc(db, "families", familyId, "shoppingLists", listId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const items = (snap.data().items || []).map((it) => (it.id === itemId ? { ...it, checked } : it));
    await updateDoc(ref, { items, updatedAt: Date.now() });
  },

  // called once those item(s) turn into an actual purchase — removes them
  // from the list entirely; whatever wasn't bought stays for next time
  async removeShoppingItems(familyId, listId, itemIds) {
    const ref = doc(db, "families", familyId, "shoppingLists", listId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const items = (snap.data().items || []).filter((it) => !itemIds.includes(it.id));
    await updateDoc(ref, { items, status: items.length ? "active" : "done", updatedAt: Date.now() });
  },

  // creator, assignee, or a manager can add more items to an existing list
  // (e.g. "also need onions" while the list is already out with someone) —
  // appended, existing items untouched
  async addShoppingItems(familyId, listId, newItems) {
    const ref = doc(db, "families", familyId, "shoppingLists", listId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const items = [...(snap.data().items || []), ...newItems];
    await updateDoc(ref, { items, status: "active", updatedAt: Date.now() });
  },

  // records that today's reminder already fired, so the 20-second check
  // loop (see family-bazar.js) doesn't show the same notification twice
  async markShoppingReminderFired(familyId, listId, reminder, dateStr) {
    await updateDoc(doc(db, "families", familyId, "shoppingLists", listId), {
      reminder: Object.assign({}, reminder, { lastFiredDate: dateStr }), updatedAt: Date.now(),
    });
  },
};

// { $inc: n } markers from FBCore.planPurchaseChange → Firestore increment()
function resolveIncs(v) {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    if (Object.keys(v).length === 1 && typeof v.$inc === "number") return increment(v.$inc);
    const out = {};
    Object.keys(v).forEach((k) => (out[k] = resolveIncs(v[k])));
    return out;
  }
  return v;
}

// finish a redirect-based Google sign-in, if one is in progress
getRedirectResult(auth).catch(() => {});

window.dispatchEvent(new Event("fb-ready"));
