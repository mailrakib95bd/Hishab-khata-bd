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
  // See firestore.rules for the enforced security boundary; everything
  // here is a thin wrapper, not itself the security layer.

  currentUser() {
    return auth.currentUser;
  },

  async createFamily(name, photoURL) {
    const uid = auth.currentUser.uid;
    const ref = await addDoc(collection(db, "families"), {
      name, photoURL: photoURL || null, ownerId: uid, memberUids: [uid],
      createdAt: Date.now(), updatedAt: Date.now(),
    });
    await setDoc(doc(db, "families", ref.id, "members", uid), {
      uid, name: auth.currentUser.displayName || "", email: auth.currentUser.email || "",
      photoURL: auth.currentUser.photoURL || null, relation: "other", role: "owner",
      permissions: { monthlyTotal: true, categorySummary: true, purchaseDetails: true, priceHistory: true, locationComparison: true, reports: true, memberManagement: true },
      status: "active", joinedAt: Date.now(), updatedAt: Date.now(),
    });
    return ref.id;
  },

  // families the signed-in user currently belongs to
  async myFamilies() {
    const uid = auth.currentUser.uid;
    const snap = await getDocs(query(collection(db, "families")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((f) => (f.memberUids || []).includes(uid));
  },

  async familyMembers(familyId) {
    const snap = await getDocs(collection(db, "families", familyId, "members"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async updateFamilyMember(familyId, uid, patch) {
    await updateDoc(doc(db, "families", familyId, "members", uid), { ...patch, updatedAt: Date.now() });
  },

  async removeFamilyMember(familyId, uid) {
    const fref = doc(db, "families", familyId);
    const fsnap = await getDoc(fref);
    const memberUids = (fsnap.data().memberUids || []).filter((x) => x !== uid);
    await updateDoc(fref, { memberUids, updatedAt: Date.now() });
    await deleteDoc(doc(db, "families", familyId, "members", uid));
  },

  async sendInvitation({ familyId, familyName, invitedEmail, relation, role, permissions }) {
    const ref = await addDoc(collection(db, "invitations"), {
      familyId, familyName, invitedBy: auth.currentUser.uid, invitedByName: auth.currentUser.displayName || "",
      invitedEmail: invitedEmail.trim().toLowerCase(), relation, role, permissions,
      status: "pending", createdAt: Date.now(), expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    return ref.id;
  },

  // invitations addressed to the signed-in user's own email, still pending
  async myIncomingInvitations() {
    const email = (auth.currentUser.email || "").toLowerCase();
    if (!email) return [];
    const snap = await getDocs(query(collection(db, "invitations")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((i) => i.invitedEmail === email && i.status === "pending" && i.expiresAt > Date.now());
  },

  // invitations THIS user has sent for one family (to show pending state /
  // let them cancel)
  async familySentInvitations(familyId) {
    const snap = await getDocs(query(collection(db, "invitations")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((i) => i.familyId === familyId);
  },

  async acceptInvitation(invite) {
    const uid = auth.currentUser.uid;
    const fref = doc(db, "families", invite.familyId);
    const fsnap = await getDoc(fref);
    const memberUids = fsnap.data().memberUids || [];
    if (!memberUids.includes(uid)) {
      await updateDoc(fref, { memberUids: [...memberUids, uid], updatedAt: Date.now() });
    }
    await setDoc(doc(db, "families", invite.familyId, "members", uid), {
      uid, name: auth.currentUser.displayName || "", email: auth.currentUser.email || "",
      photoURL: auth.currentUser.photoURL || null, relation: invite.relation, role: invite.role,
      permissions: invite.permissions, status: "active", joinedAt: Date.now(), updatedAt: Date.now(),
    });
    await updateDoc(doc(db, "invitations", invite.id), { status: "accepted", respondedAt: Date.now() });
  },

  async rejectInvitation(inviteId) {
    await updateDoc(doc(db, "invitations", inviteId), { status: "rejected", respondedAt: Date.now() });
  },

  async cancelInvitation(inviteId) {
    await updateDoc(doc(db, "invitations", inviteId), { status: "cancelled" });
  },

  async familyProducts(familyId) {
    const snap = await getDocs(collection(db, "families", familyId, "products"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async upsertFamilyProduct(familyId, product) {
    if (product.id) {
      await updateDoc(doc(db, "families", familyId, "products", product.id), { ...product, updatedAt: Date.now() });
      return product.id;
    }
    const ref = await addDoc(collection(db, "families", familyId, "products"), { ...product, createdAt: Date.now() });
    return ref.id;
  },

  // last N purchases for a family (client-side sort avoids needing a
  // composite index for a simple recency query)
  async familyPurchases(familyId, limitN) {
    const snap = await getDocs(collection(db, "families", familyId, "purchases"));
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.createdAt - a.createdAt);
    return typeof limitN === "number" ? rows.slice(0, limitN) : rows;
  },

  async addFamilyPurchase(familyId, purchase) {
    const ref = await addDoc(collection(db, "families", familyId, "purchases"), { ...purchase, createdAt: Date.now(), updatedAt: Date.now() });
    // one priceHistory row per line item, so price trends can be read back
    // per-product without re-scanning every purchase
    for (const item of purchase.items || []) {
      if (!item.unitPrice) continue;
      await addDoc(collection(db, "families", familyId, "priceHistory"), {
        productId: item.productId || null, productName: item.productName, memberId: purchase.memberId,
        price: item.unitPrice, unit: item.unit || null, location: purchase.location || null, market: purchase.market || null,
        date: purchase.date, purchaseId: ref.id, createdAt: Date.now(),
      });
    }
    return ref.id;
  },

  async updateFamilyPurchase(familyId, purchaseId, patch) {
    await updateDoc(doc(db, "families", familyId, "purchases", purchaseId), { ...patch, updatedAt: Date.now() });
  },

  async deleteFamilyPurchase(familyId, purchaseId) {
    await deleteDoc(doc(db, "families", familyId, "purchases", purchaseId));
  },

  async familyPriceHistory(familyId, productName) {
    const snap = await getDocs(collection(db, "families", familyId, "priceHistory"));
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return (productName ? rows.filter((r) => r.productName === productName) : rows).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  },

  async getFamilyBudget(familyId) {
    const snap = await getDoc(doc(db, "families", familyId, "budgets", "current"));
    return snap.exists() ? snap.data() : null;
  },

  async setFamilyBudget(familyId, monthlyAmount) {
    await setDoc(doc(db, "families", familyId, "budgets", "current"), { monthlyAmount, updatedAt: Date.now() });
  },
};

// finish a redirect-based Google sign-in, if one is in progress
getRedirectResult(auth).catch(() => {});

window.dispatchEvent(new Event("fb-ready"));
