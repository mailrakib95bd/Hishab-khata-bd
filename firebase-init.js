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
};

// finish a redirect-based Google sign-in, if one is in progress
getRedirectResult(auth).catch(() => {});

window.dispatchEvent(new Event("fb-ready"));
