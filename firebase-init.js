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
const db = getFirestore(app);

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

  async updateFamily(familyId, patch) {
    const allowed = {};
    ["name", "photoURL", "settings"].forEach((k) => { if (k in patch) allowed[k] = patch[k]; });
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
    for (const name of ["purchases", "priceHistory", "locations", "memberMonthly", "memberCategoryMonthly", "products", "categories", "budgets"]) {
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

  // manager changing role / permissions / relation, or a person editing their own name/relation
  async updateFamilyMember(familyId, memberUid, patch) {
    const allowed = {};
    ["role", "permissions", "relation", "name", "photoURL"].forEach((k) => { if (k in patch) allowed[k] = patch[k]; });
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
  async sendInvitation({ familyId, familyName, invitedEmail, relation, role, permissions }) {
    const now = Date.now();
    const ref = await addDoc(collection(db, "invitations"), {
      familyId, familyName, invitedBy: auth.currentUser.uid,
      invitedByName: auth.currentUser.displayName || auth.currentUser.email || "",
      invitedEmail: String(invitedEmail).trim().toLowerCase(), relation, role,
      permissions: window.FBCore.normalizePermissions(permissions),
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

  // ---- shopping lists ---------------------------------------------------
  // A household "to-buy" list assigned to one member, with an optional
  // reminder. Small collection; the security rules already filter every
  // read down to lists this account created, is assigned, or manages, so a
  // plain collection read is enough (a `where` here couldn't add privacy
  // beyond what the rule already enforces).
  async familyShoppingLists(familyId) {
    const snap = await getDocs(collection(db, "families", familyId, "shoppingLists"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
