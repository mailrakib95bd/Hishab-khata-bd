// হিসাব-খাতা — Family Bazar: UI.
//
// Plain JavaScript (React.createElement, no JSX, no build step) so it sits next
// to app.js exactly like the rest of the app. Loaded as a classic script AFTER
// family-bazar-core.js (pure logic) and BEFORE app.js; everything is wrapped in
// an IIFE so it can't collide with app.js's top-level `const`s. It borrows a
// few app.js helpers at call time (formatTaka, toBnDigits, formatDateBn,
// todayStr) and talks to Firestore only through window.FB (firebase-init.js).
//
// Exposes: window.FamilyBazar = { Module, useFamilyAlerts }
(function () {
  "use strict";
  const { useState, useEffect, useMemo, useRef, useCallback } = React;
  const h = React.createElement;
  const R_Fragment = React.Fragment;
  const Core = window.FBCore;

  /* ------------------------------------------------------------------ *
   * formatting
   * ------------------------------------------------------------------ */
  const bn = (v) => toBnDigits(String(v));
  const taka = (n) => formatTaka(Number(n) || 0);
  // unit prices can have paise; whole amounts use the app's grouping
  function money(n) {
    n = Number(n) || 0;
    return Number.isInteger(n) ? taka(n) : "৳" + bn(n.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));
  }
  const qtyText = (q) => bn(Number(q)); // 2.5 → ২.৫
  const dateBn = (ymd) => formatDateBn(ymd).full;
  const monthBn = (m) => { const d = formatDateBn(m + "-01"); return `${d.month} ${d.year}`; };
  const today = () => todayStr();
  const UNIT_LABEL = { kg: "কেজি", g: "গ্রাম", L: "লিটার", ml: "মি.লি.", pcs: "পিস", "হালি": "হালি", "ডজন": "ডজন", "প্যাকেট": "প্যাকেট" };
  const unitText = (u) => UNIT_LABEL[u] || u || "";
  const pctText = (p) => (p == null ? "" : `${p > 0 ? "+" : p < 0 ? "−" : ""}${bn(Math.abs(p))}%`);

  function friendlyError(e) {
    const c = (e && (e.code || e.message)) || "";
    if (/permission-denied|insufficient/i.test(c)) return "এই কাজটির অনুমতি নেই (Firestore নিয়ম আটকে দিয়েছে)।";
    if (/unavailable|network|offline/i.test(c)) return "ইন্টারনেট সংযোগ নেই — একটু পরে আবার চেষ্টা করুন।";
    if (/failed-precondition/i.test(c) && /index/i.test(String(e.message))) return "Firestore-এ একটি index দরকার — ব্রাউজার কনসোলের লিংকে ক্লিক করে তৈরি করুন।";
    return (e && e.message) || "কিছু একটা ভুল হয়েছে।";
  }

  /* ------------------------------------------------------------------ *
   * tiny per-user preference store (hints only — never a copy of Firestore
   * data): last market / place, and last unit + category used per product
   * ------------------------------------------------------------------ */
  const prefKey = (uid) => `hk-fb-pref:${uid}`;
  function readPrefs(uid) {
    try { return JSON.parse(localStorage.getItem(prefKey(uid)) || "{}") || {}; } catch (e) { return {}; }
  }
  function rememberPrefs(uid, draft) {
    try {
      const p = readPrefs(uid);
      const bump = (arr, v) => (v ? [v].concat((arr || []).filter((x) => x !== v)).slice(0, 8) : arr || []);
      p.markets = bump(p.markets, draft.market);
      p.locations = bump(p.locations, draft.location);
      p.products = p.products || {};
      (draft.items || []).forEach((it) => {
        p.products[Core.nameKey(it.productName)] = { name: it.productName, unit: it.unit, categoryId: it.categoryId || null, at: Date.now() };
      });
      const keys = Object.keys(p.products).sort((a, b) => p.products[b].at - p.products[a].at).slice(0, 60);
      const trimmed = {}; keys.forEach((k) => (trimmed[k] = p.products[k])); p.products = trimmed;
      localStorage.setItem(prefKey(uid), JSON.stringify(p));
    } catch (e) { /* storage full / private mode — hints only */ }
  }
  const activeKey = (uid) => `hk-fb-active:${uid}`;

  /* ------------------------------------------------------------------ *
   * back-button handling for the ONE sheet this module shows at a time.
   * Uses the capture phase + stopImmediatePropagation so the app's own
   * overlay handlers (e.g. the one that closes this whole module when it's
   * opened from the ☰ menu) never see the same "back" press.
   * ------------------------------------------------------------------ */
  function useSheetBack(isOpen, onClose) {
    const st = useRef({ pushed: false, swallow: 0 });
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
      const s = st.current;
      if (isOpen && !s.pushed) { window.history.pushState({ hkFbSheet: true }, ""); s.pushed = true; }
      else if (!isOpen && s.pushed) { s.pushed = false; s.swallow++; window.history.back(); }
    }, [isOpen]);
    useEffect(() => {
      const onPop = (e) => {
        const s = st.current;
        if (s.swallow > 0) { s.swallow--; e.stopImmediatePropagation(); return; }
        if (s.pushed) { s.pushed = false; e.stopImmediatePropagation(); closeRef.current(); }
      };
      window.addEventListener("popstate", onPop, true);
      return () => window.removeEventListener("popstate", onPop, true);
    }, []);
  }

  /* ------------------------------------------------------------------ *
   * styles (existing --hk-* design tokens only)
   * ------------------------------------------------------------------ */
  const F = "'Hind Siliguri', sans-serif";
  const SERIF = "'Tiro Bangla', serif";
  const S = {
    card: { background: "var(--hk-card)", border: "1px solid var(--hk-border)", borderRadius: 14, padding: "14px 16px", marginBottom: 12 },
    hero: { background: "var(--hk-header-bg)", color: "var(--hk-text-on-dark)", borderRadius: 16, padding: "18px 18px 16px", marginBottom: 12 },
    h2: { fontFamily: SERIF, fontSize: 16.5, color: "var(--hk-text)", margin: "4px 0 10px" },
    muted: { color: "var(--hk-text-muted)", fontSize: 12.5, lineHeight: 1.5 },
    row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
    input: { width: "100%", minHeight: 44, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--hk-border-strong)", background: "var(--hk-bg)", color: "var(--hk-text)", fontSize: 15, fontFamily: F, boxSizing: "border-box", marginBottom: 10 },
    label: { display: "block", fontSize: 12.5, color: "var(--hk-text-muted-2)", margin: "2px 0 5px", fontWeight: 600 },
    btn: { minHeight: 46, width: "100%", padding: "11px 14px", borderRadius: 12, border: "none", background: "var(--hk-gold)", color: "#1a1a1a", fontWeight: 700, fontSize: 15, fontFamily: F },
    btn2: { minHeight: 44, padding: "10px 14px", borderRadius: 12, border: "1px solid var(--hk-border-med)", background: "transparent", color: "var(--hk-text)", fontWeight: 600, fontSize: 14, fontFamily: F },
    danger: { minHeight: 44, padding: "10px 14px", borderRadius: 12, border: "1px solid var(--hk-danger)", background: "transparent", color: "var(--hk-danger)", fontWeight: 600, fontSize: 14, fontFamily: F },
    chip: (on) => ({ padding: "7px 13px", minHeight: 36, borderRadius: 999, border: "1px solid var(--hk-border-med)", background: on ? "var(--hk-gold)" : "var(--hk-card)", color: on ? "#1a1a1a" : "var(--hk-text)", fontSize: 13, fontFamily: F, whiteSpace: "nowrap" }),
    pill: (bg, fg) => ({ display: "inline-block", padding: "2px 9px", borderRadius: 999, background: bg, color: fg, fontSize: 11.5, fontWeight: 600 }),
    big: { fontFamily: SERIF, fontSize: 34, lineHeight: 1.15 },
  };
  const LEVEL = {
    ok: { color: "var(--hk-success)", text: "" },
    w80: { color: "var(--hk-gold)", text: "বাজেটের ৮০% ছাড়িয়েছে" },
    w90: { color: "var(--hk-danger-mid)", text: "বাজেটের ৯০% ছাড়িয়েছে — এবার সাবধান" },
    over: { color: "var(--hk-danger)", text: "বাজেট ছাড়িয়ে গেছে" },
  };

  /* ------------------------------------------------------------------ *
   * primitives: states, sheet, charts
   * ------------------------------------------------------------------ */
  function Loading({ text }) {
    return h("div", { style: { padding: "36px 0", textAlign: "center", color: "var(--hk-text-muted)", fontSize: 13.5 } },
      h("div", { style: { width: 26, height: 26, margin: "0 auto 10px", border: "3px solid var(--hk-border-strong)", borderTopColor: "var(--hk-gold)", borderRadius: "50%", animation: "hkspin 0.8s linear infinite" } }),
      text || "লোড হচ্ছে…");
  }
  function ErrorBox({ msg, onRetry }) {
    return h("div", { style: Object.assign({}, S.card, { borderColor: "var(--hk-danger)" }) },
      h("div", { style: { color: "var(--hk-danger)", fontWeight: 600, marginBottom: 6 } }, "সমস্যা হয়েছে"),
      h("div", { style: S.muted }, msg),
      onRetry && h("button", { style: Object.assign({}, S.btn2, { marginTop: 10 }), onClick: onRetry }, "আবার চেষ্টা করুন"));
  }
  function Empty({ icon, title, text, action, onAction }) {
    return h("div", { style: { textAlign: "center", padding: "30px 18px" } },
      h("div", { style: { fontSize: 40, marginBottom: 8 } }, icon || "🛒"),
      title && h("div", { style: { fontWeight: 700, fontSize: 15.5, marginBottom: 6 } }, title),
      h("div", { style: Object.assign({}, S.muted, { marginBottom: action ? 14 : 0 }) }, text),
      action && h("button", { style: Object.assign({}, S.btn, { width: "auto", padding: "11px 22px" }), onClick: onAction }, action));
  }
  function Lock({ text }) {
    return h("div", { style: Object.assign({}, S.card, { textAlign: "center", padding: "22px 16px" }) },
      h("div", { style: { fontSize: 26 } }, "🔒"),
      h("div", { style: Object.assign({}, S.muted, { marginTop: 6 }) }, text || "এই তথ্য দেখার অনুমতি আপনাকে দেওয়া হয়নি। পরিবারের মালিক/এডমিনকে বলুন।"));
  }

  // full-screen page used for every form / detail. Only one is ever open.
  function Sheet({ title, onClose, children, footer }) {
    useBackgroundScrollLock();
    return h("div", { style: { position: "fixed", inset: 0, zIndex: 60, background: "var(--hk-bg)", display: "flex", justifyContent: "center" } },
      h("div", { style: { width: "100%", maxWidth: 480, height: "100%", display: "flex", flexDirection: "column", fontFamily: F, color: "var(--hk-text)" } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 6, padding: "calc(10px + env(safe-area-inset-top)) 12px 10px", borderBottom: "1px solid var(--hk-border)", background: "var(--hk-card)" } },
          h("button", { onClick: onClose, "aria-label": "ফিরে যান", style: { background: "none", border: "none", fontSize: 26, lineHeight: 1, padding: "4px 10px", color: "var(--hk-text)", minHeight: 44 } }, "‹"),
          h("div", { style: { fontFamily: SERIF, fontSize: 17, flex: 1 } }, title)),
        h("div", { style: { flex: 1, overflowY: "auto", overscrollBehaviorY: "contain", padding: "14px 16px 24px" } }, children),
        footer && h("div", { style: { padding: "10px 16px calc(12px + env(safe-area-inset-bottom))", borderTop: "1px solid var(--hk-border)", background: "var(--hk-card)" } }, footer)));
  }

  function Toggle({ on, onChange, disabled, label, hint }) {
    return h("label", { style: { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--hk-border-light)", opacity: disabled ? 0.5 : 1 } },
      h("div", { style: { flex: 1 } }, h("div", { style: { fontSize: 14, fontWeight: 600 } }, label), hint && h("div", { style: S.muted }, hint)),
      h("input", { type: "checkbox", checked: !!on, disabled, onChange: (e) => onChange(e.target.checked), style: { width: 22, height: 22, accentColor: "var(--hk-success)" } }));
  }

  // bars: [{key,label,value,hi}] — scaled into a viewBox so it never overflows
  function BarChart({ data, height = 110, color = "var(--hk-success-mid)", labelEvery = 1 }) {
    const W = 320, pad = 4, max = Math.max(1, ...data.map((d) => d.value));
    const bw = (W - pad * 2) / data.length;
    return h("svg", { viewBox: `0 0 ${W} ${height + 18}`, width: "100%", role: "img", style: { display: "block" } },
      data.map((d, i) => {
        const bh = Math.max(d.value > 0 ? 2 : 0, (d.value / max) * height);
        return h("g", { key: d.key },
          h("rect", { x: pad + i * bw + bw * 0.15, y: height - bh, width: bw * 0.7, height: bh, rx: 2, fill: d.hi ? "var(--hk-gold)" : color }),
          i % labelEvery === 0 && h("text", { x: pad + i * bw + bw / 2, y: height + 13, fontSize: 9, textAnchor: "middle", fill: "var(--hk-text-muted)" }, d.label));
      }));
  }
  function LineChart({ points, height = 120 }) {
    if (!points || points.length < 2) return h("div", { style: S.muted }, "লাইন চার্টের জন্য অন্তত দুইবারের দাম লাগবে।");
    const W = 320, L = 8, R = 8, T = 10, B = 20;
    const ys = points.map((p) => p.y), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
    const x = (i) => L + (i * (W - L - R)) / (points.length - 1);
    const y = (v) => T + (1 - (v - lo) / span) * (height - T - B);
    const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
    return h("svg", { viewBox: `0 0 ${W} ${height}`, width: "100%", role: "img", "aria-label": "দামের লাইন চার্ট", style: { display: "block" } },
      h("path", { d: path, fill: "none", stroke: "var(--hk-success-mid)", strokeWidth: 2.2, strokeLinejoin: "round", strokeLinecap: "round" }),
      points.map((p, i) => h("circle", { key: i, cx: x(i), cy: y(p.y), r: 3.2, fill: "var(--hk-gold)" })),
      h("text", { x: L, y: height - 4, fontSize: 9, fill: "var(--hk-text-muted)" }, points[0].label),
      h("text", { x: W - R, y: height - 4, fontSize: 9, textAnchor: "end", fill: "var(--hk-text-muted)" }, points[points.length - 1].label),
      h("text", { x: W - R, y: T - 1, fontSize: 9, textAnchor: "end", fill: "var(--hk-text-muted)" }, money(hi)),
      lo !== hi && h("text", { x: W - R, y: height - B - 3, fontSize: 9, textAnchor: "end", fill: "var(--hk-text-muted)" }, money(lo)));
  }
  function HBar({ pct, color }) {
    return h("div", { style: { height: 7, background: "var(--hk-track)", borderRadius: 4, overflow: "hidden" } },
      h("div", { style: { width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: color || "var(--hk-success-mid)", borderRadius: 4 } }));
  }
  function Delta({ pct, invert }) {
    if (pct == null) return h("span", { style: S.muted }, "গত মাসের তথ্য নেই");
    const up = pct > 0, flat = pct === 0;
    // for spending, "up" is the worrying direction
    const color = flat ? "var(--hk-text-muted)" : (up !== !!invert) ? "var(--hk-danger)" : "var(--hk-success)";
    return h("span", { style: { color, fontWeight: 700 } }, flat ? "একই" : `${up ? "▲" : "▼"} ${pctText(pct)}`);
  }
  function Avatar({ m, size = 40 }) {
    const initial = ((m && m.name) || "?").trim().charAt(0).toUpperCase();
    if (m && m.photoURL) return h("img", { src: m.photoURL, alt: "", referrerPolicy: "no-referrer", style: { width: size, height: size, borderRadius: "50%", objectFit: "cover", flex: "none" } });
    return h("div", { style: { width: size, height: size, borderRadius: "50%", background: "var(--hk-header-bg)", color: "var(--hk-text-on-dark)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.42, flex: "none" } }, initial);
  }
  const relLabel = (k, custom) => (k === "custom" || (custom && k === "other") ? custom || "অন্যান্য" : ((Core.RELATIONS.find((r) => r.key === k) || {}).label || k || ""));
  const roleChip = (role) => {
    const bg = role === "owner" ? "var(--hk-gold)" : role === "admin" ? "var(--hk-success-mid)" : "var(--hk-track)";
    const fg = role === "owner" ? "#1a1a1a" : role === "admin" ? "#fff" : "var(--hk-text-muted-2)";
    return h("span", { style: S.pill(bg, fg) }, (Core.ROLES[role] || {}).label || role);
  };

  /* ------------------------------------------------------------------ *
   * data hook — loads only what THIS member is allowed to see
   * ------------------------------------------------------------------ */
  const safe = async (p, fallback) => { try { return await p; } catch (e) { return fallback; } };
  const EMPTY_FAM = { loading: false, error: "", members: [], budget: null, categories: [], products: [], stats: { monthly: [], cats: [] }, prices: [], shoppingLists: [] };

  function useFamilyData(user) {
    const uid = user && user.uid;
    const [top, setTop] = useState({ loading: !!uid, error: "", families: [], incoming: [] });
    const [activeId, setActiveIdRaw] = useState(null);
    const [fam, setFam] = useState(Object.assign({}, EMPTY_FAM, { loading: true }));
    const seq = useRef(0);

    const loadTop = useCallback(async (preferId) => {
      if (!uid || !window.FB) return;
      setTop((t) => Object.assign({}, t, { loading: true, error: "" }));
      try {
        const [families, incoming] = await Promise.all([window.FB.myFamilies(), safe(window.FB.myIncomingInvitations(), [])]);
        setTop({ loading: false, error: "", families, incoming });
        setActiveIdRaw((cur) => {
          const stored = (() => { try { return localStorage.getItem(activeKey(uid)); } catch (e) { return null; } })();
          const pick = [preferId, cur, stored].find((id) => id && families.some((f) => f.id === id));
          return pick || (families[0] && families[0].id) || null;
        });
      } catch (e) {
        setTop((t) => Object.assign({}, t, { loading: false, error: friendlyError(e) }));
      }
    }, [uid]);

    const setActive = useCallback((id) => {
      try { localStorage.setItem(activeKey(uid), id); } catch (e) { /* ignore */ }
      setActiveIdRaw(id);
    }, [uid]);

    const loadFam = useCallback(async (familyId) => {
      if (!familyId || !window.FB) return;
      const mine = ++seq.current;
      setFam((f) => Object.assign({}, f, { loading: true, error: "" }));
      try {
        const members = await window.FB.familyMembers(familyId);
        const me = members.find((m) => m.uid === uid);
        if (!me) throw new Error("আপনি এই পরিবারের সদস্য নন।");
        const vis = Core.visibilityFor(me);
        const cm = Core.monthOf(today()), pm = Core.addMonths(cm, -1);
        const [budget, categories, products, stats, prices, shoppingLists] = await Promise.all([
          safe(window.FB.getFamilyBudget(familyId), null),
          safe(window.FB.familyCategories(familyId), []),
          safe(window.FB.familyProducts(familyId), []),
          safe(window.FB.monthlyStats(familyId, Core.monthsBack(cm, 6), { totals: vis.totals, categories: vis.categories }), { monthly: [], cats: [] }),
          safe(window.FB.priceRows(familyId, { months: [cm, pm], seeAll: vis.prices, max: 300 }), []),
          safe(window.FB.familyShoppingLists(familyId), []),
        ]);
        if (mine !== seq.current) return;
        setFam({ loading: false, error: "", members, budget, categories, products, stats, prices, shoppingLists });
      } catch (e) {
        if (mine !== seq.current) return;
        setFam((f) => Object.assign({}, f, { loading: false, error: friendlyError(e) }));
      }
    }, [uid]);

    useEffect(() => { if (uid) loadTop(); }, [uid]);
    useEffect(() => { if (activeId) loadFam(activeId); }, [activeId]);

    const family = top.families.find((f) => f.id === activeId) || null;
    const myMember = fam.members.find((m) => m.uid === uid) || null;
    const vis = useMemo(() => Core.visibilityFor(myMember), [myMember]);
    return { top, family, activeId, setActive, fam, myMember, vis, loadTop, reload: () => loadFam(activeId) };
  }

  /* ------------------------------------------------------------------ *
   * invitations: card + details (used for incoming AND sent)
   * ------------------------------------------------------------------ */
  function PermissionList({ perms }) {
    return h("div", null, Core.PERMISSIONS.map((p) => h("div", { key: p.key, style: { display: "flex", gap: 8, padding: "5px 0", fontSize: 13.5, color: perms && perms[p.key] ? "var(--hk-text)" : "var(--hk-text-muted)" } },
      h("span", null, perms && perms[p.key] ? "✅" : "🚫"), h("span", null, p.label))));
  }

  function InvitationDetails({ ctx, inv, incoming, close }) {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const state = Core.inviteState(inv);
    const act = async (fn, msg, after) => {
      if (busy) return;
      setBusy(true); setErr("");
      try { await fn(); ctx.toast(msg); await after(); close(); } catch (e) { setErr(friendlyError(e)); setBusy(false); }
    };
    return h(Sheet, { title: incoming ? "পরিবারের Invitation" : "Invitation-এর তথ্য", onClose: close },
      h("div", { style: Object.assign({}, S.hero, { textAlign: "center" }) },
        h("div", { style: { fontSize: 34 } }, "📩"),
        h("div", { style: { fontFamily: SERIF, fontSize: 21, marginTop: 4 } }, inv.familyName),
        h("div", { style: { fontSize: 13, opacity: 0.85, marginTop: 4 } }, incoming ? `${inv.invitedByName || "একজন সদস্য"} আপনাকে যোগ করতে চান` : inv.invitedEmail)),
      h("div", { style: S.card },
        h("div", { style: S.row }, h("span", { style: S.muted }, "সম্পর্ক"), h("strong", null, relLabel(inv.relation))),
        h("div", { style: Object.assign({}, S.row, { marginTop: 8 }) }, h("span", { style: S.muted }, "ভূমিকা"), roleChip(inv.role)),
        h("div", { style: Object.assign({}, S.row, { marginTop: 8 }) }, h("span", { style: S.muted }, "অবস্থা"), h("strong", null, Core.INVITE_STATUS_LABEL[state] || state)),
        h("div", { style: Object.assign({}, S.row, { marginTop: 8 }) }, h("span", { style: S.muted }, "মেয়াদ"), h("span", null, dateBn(Core.dateToYmd(new Date(inv.expiresAt)))))),
      h("div", { style: S.h2 }, incoming ? "যোগ দিলে আপনি যা দেখতে পাবেন" : "এই সদস্য যা দেখতে পাবেন"),
      h("div", { style: S.card }, h(PermissionList, { perms: inv.permissions }),
        h("div", { style: Object.assign({}, S.muted, { marginTop: 8 }) }, "আপনার নিজের কেনাকাটা সবসময় আপনি দেখবেন। অন্যের বিস্তারিত শুধু অনুমতি থাকলেই দেখা যায়।")),
      err && h(ErrorBox, { msg: err }),
      state === "pending" && incoming && h("div", { style: { display: "flex", gap: 10 } },
        h("button", { style: S.btn, disabled: busy, onClick: () => act(() => window.FB.acceptInvitation(inv), "পরিবারে যোগ দিয়েছেন 🎉", () => ctx.afterAccept(inv.familyId)) }, busy ? "অপেক্ষা করুন…" : "গ্রহণ করুন"),
        h("button", { style: S.btn2, disabled: busy, onClick: () => act(() => window.FB.rejectInvitation(inv.id), "Invitation বাতিল করা হয়েছে", () => ctx.loadTop()) }, "প্রত্যাখ্যান")),
      state === "pending" && !incoming && h("button", { style: S.danger, disabled: busy, onClick: () => act(() => window.FB.cancelInvitation(inv.id), "Invitation বাতিল হয়েছে", () => ctx.reloadInvites()) }, "Invitation বাতিল করুন"));
  }

  function IncomingCards({ ctx }) {
    const list = ctx.incoming;
    if (!list || !list.length) return null;
    return h("div", { style: Object.assign({}, S.card, { borderColor: "var(--hk-gold)" }) },
      h("div", { style: { fontWeight: 700, marginBottom: 8 } }, `📩 নতুন Invitation (${bn(list.length)})`),
      list.map((inv) => h("button", { key: inv.id, onClick: () => ctx.openSheet({ type: "invite-details", inv, incoming: true }), style: { display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 8, background: "none", border: "none", borderTop: "1px solid var(--hk-border-light)", padding: "10px 0", textAlign: "left", color: "var(--hk-text)", fontFamily: F, minHeight: 48 } },
        h("span", null, h("div", { style: { fontWeight: 600 } }, inv.familyName), h("div", { style: S.muted }, `${inv.invitedByName || "একজন সদস্য"} • ${relLabel(inv.relation)}`)),
        h("span", { style: S.pill("var(--hk-gold)", "#1a1a1a") }, "দেখুন"))));
  }

  /* ------------------------------------------------------------------ *
   * entry / no-family / create / switcher
   * ------------------------------------------------------------------ */
  function EntryScreen({ ctx }) {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    return h("div", { style: { padding: "18px 4px" } },
      h("div", { style: Object.assign({}, S.hero, { textAlign: "center" }) },
        h("div", { style: { fontSize: 44 } }, "🛒"),
        h("div", { style: { fontFamily: SERIF, fontSize: 22, margin: "6px 0" } }, "ফ্যামিলি বাজার"),
        h("div", { style: { fontSize: 13.5, opacity: 0.9, lineHeight: 1.6 } }, "পরিবারের সবাই নিজের বাজার লিখবেন। কে কত খরচ করল, কোন জিনিসের দাম কেমন বদলাল — এক জায়গায় দেখা যাবে।")),
      h("div", { style: S.card },
        h("div", { style: { fontWeight: 700, marginBottom: 6 } }, "শুরু করতে Google দিয়ে Sign In করুন"),
        h("div", { style: S.muted }, "সদস্যদের Invite করা ও একসাথে হিসাব রাখার জন্য অ্যাকাউন্ট লাগে। আপনার ব্যক্তিগত হিসাব-খাতা এতে বদলাবে না।"),
        err && h("div", { style: { color: "var(--hk-danger)", fontSize: 12.5, marginTop: 8 } }, err),
        h("button", { style: Object.assign({}, S.btn, { marginTop: 14 }), disabled: busy || !window.FB, onClick: async () => { setBusy(true); setErr(""); try { await window.FB.signInGoogle(); } catch (e) { setErr(friendlyError(e)); } setBusy(false); } }, window.FB ? "Google দিয়ে Sign In" : "ইন্টারনেট সংযোগ দরকার")));
  }

  function NoFamily({ ctx }) {
    return h("div", null,
      h(IncomingCards, { ctx }),
      !ctx.emailVerified && h("div", { style: Object.assign({}, S.card, { borderColor: "var(--hk-gold)" }) }, h("div", { style: S.muted }, "Invitation পেতে ও গ্রহণ করতে Google (Gmail) দিয়ে Sign In করা লাগে — ইমেইল/পাসওয়ার্ড অ্যাকাউন্টের ইমেইল যাচাই করা থাকে না।")),
      h(Empty, { icon: "👨‍👩‍👧‍👦", title: "আপনার এখনো কোনো পরিবার নেই", text: "নিজের পরিবার তৈরি করুন, অথবা কেউ Invite পাঠালে এখানে দেখতে পাবেন।", action: "+ পরিবার তৈরি করুন", onAction: () => ctx.openSheet({ type: "create-family" }) }));
  }

  const FAMILY_ICONS = ["🏠", "👨‍👩‍👧‍👦", "🏡", "🌾", "🕌", "🍚", "🛒", "❤️"];
  function CreateFamilySheet({ ctx, close }) {
    const [name, setName] = useState("");
    const [icon, setIcon] = useState("🏠");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const submit = async () => {
      if (busy) return;
      const n = name.trim();
      if (!n) { setErr("পরিবারের নাম লিখুন"); return; }
      if (n.length > 60) { setErr("নাম একটু ছোট করুন"); return; }
      setBusy(true); setErr("");
      try { const id = await window.FB.createFamily(n, icon); await ctx.loadTop(id); ctx.setActive(id); ctx.toast("পরিবার তৈরি হয়েছে 🎉"); close(); }
      catch (e) { setErr(friendlyError(e)); setBusy(false); }
    };
    return h(Sheet, { title: "নতুন পরিবার", onClose: close, footer: h("button", { style: S.btn, disabled: busy, onClick: submit }, busy ? "তৈরি হচ্ছে…" : "পরিবার তৈরি করুন") },
      h("label", { style: S.label }, "পরিবারের নাম *"),
      h("input", { style: S.input, value: name, placeholder: "যেমন: হোসেন পরিবার", maxLength: 60, onChange: (e) => setName(e.target.value), autoFocus: true }),
      h("label", { style: S.label }, "আইকন (ঐচ্ছিক)"),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 } }, FAMILY_ICONS.map((ic) => h("button", { key: ic, onClick: () => setIcon(ic), "aria-label": ic, style: Object.assign({}, S.chip(icon === ic), { fontSize: 22, padding: "6px 12px" }) }, ic))),
      h("div", { style: S.muted }, "আপনি এই পরিবারের মালিক হবেন। পরে সদস্যদের Gmail দিয়ে Invite করতে পারবেন।"),
      err && h("div", { style: { color: "var(--hk-danger)", fontSize: 13, marginTop: 10 } }, err));
  }

  function SwitcherSheet({ ctx, close }) {
    return h(Sheet, { title: "পরিবার বদলান", onClose: close },
      ctx.families.map((f) => h("button", { key: f.id, onClick: () => { ctx.setActive(f.id); close(); }, style: Object.assign({}, S.card, { display: "flex", width: "100%", alignItems: "center", gap: 12, textAlign: "left", color: "var(--hk-text)", fontFamily: F, borderColor: f.id === ctx.activeId ? "var(--hk-gold)" : "var(--hk-border)" }) },
        h("span", { style: { fontSize: 26 } }, (f.settings && f.settings.icon) || "🏠"),
        h("span", { style: { flex: 1 } }, h("div", { style: { fontWeight: 700 } }, f.name), h("div", { style: S.muted }, `${bn((f.memberUids || []).length)} জন সদস্য`)),
        f.id === ctx.activeId && h("span", null, "✓"))),
      h(IncomingCards, { ctx }),
      h("button", { style: Object.assign({}, S.btn2, { width: "100%", marginTop: 6 }), onClick: () => ctx.openSheet({ type: "create-family" }) }, "+ নতুন পরিবার তৈরি করুন"));
  }

  /* ------------------------------------------------------------------ *
   * shared numbers for Home / Reports / Budget
   * ------------------------------------------------------------------ */
  function useNumbers(ctx) {
    const { fam, vis } = ctx;
    return useMemo(() => {
      const t = today(), cm = Core.monthOf(t), pm = Core.addMonths(cm, -1);
      const docs = fam.stats.monthly;
      const totals = Core.periodTotals(docs, t);
      const byMember = Core.memberMonthTotals(docs, cm);
      const budget = fam.budget && fam.budget.monthlyAmount ? Core.budgetStatus(fam.budget.monthlyAmount, totals.thisMonth) : null;
      return { t, cm, pm, docs, totals, byMember, budget, scopeAll: vis.totals };
    }, [fam.stats, fam.budget, vis.totals]);
  }

  function BudgetBanner({ budget, scopeAll, onOpen }) {
    if (!budget || !scopeAll || budget.level === "ok") return null;
    const L = LEVEL[budget.level];
    return h("button", { onClick: onOpen, style: { display: "block", width: "100%", textAlign: "left", background: "var(--hk-card)", border: `1.5px solid ${L.color}`, borderRadius: 12, padding: "11px 14px", marginBottom: 12, color: "var(--hk-text)", fontFamily: F } },
      h("div", { style: { fontWeight: 700, color: L.color } }, `⚠ ${L.text}`),
      h("div", { style: S.muted }, budget.over > 0 ? `বাজেটের চেয়ে ${taka(budget.over)} বেশি খরচ হয়েছে` : `আর ${taka(budget.remaining)} বাকি (${bn(budget.pct)}% খরচ)`));
  }

  function MoverRow({ m, ctx }) {
    const up = m.pct > 0;
    return h("button", { onClick: () => ctx.openSheet({ type: "product", productId: m.productId, name: m.productName }), style: { display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 8, background: "none", border: "none", borderBottom: "1px solid var(--hk-border-light)", padding: "10px 0", color: "var(--hk-text)", fontFamily: F, textAlign: "left", minHeight: 48 } },
      h("span", null, h("div", { style: { fontWeight: 600 } }, m.productName), h("div", { style: S.muted }, `${money(m.previous)} → ${money(m.latest)} / ${unitText(m.unit)}`)),
      h("span", { style: { fontWeight: 700, color: up ? "var(--hk-danger)" : "var(--hk-success)", whiteSpace: "nowrap" } }, `${up ? "▲" : "▼"} ${pctText(m.pct)}`));
  }

  function EstimateCard({ docs, scopeAll }) {
    const est = useMemo(() => Core.estimateNext7(docs, today()), [docs]);
    return h("div", { style: S.card },
      h("div", { style: S.h2 }, "আগামী ৭ দিনের সম্ভাব্য খরচ"),
      est.ok
        ? h("div", { style: { fontFamily: SERIF, fontSize: 24 } }, `${taka(est.low)} – ${taka(est.high)}`)
        : h("div", { style: { fontWeight: 600 } }, "নির্ভরযোগ্য অনুমানের মতো যথেষ্ট তথ্য নেই।"),
      h("div", { style: Object.assign({}, S.muted, { marginTop: 6 }) }, `আগের খরচের ধরন থেকে অনুমান করা হয়েছে${scopeAll ? "" : " (শুধু আপনার খরচ)"}। এটা নিশ্চিত খরচ বা দাম নয়।`));
  }

  /* ------------------------------------------------------------------ *
   * HOME
   * ------------------------------------------------------------------ */
  function HomeTab({ ctx }) {
    const { fam, vis, uid } = ctx;
    const N = useNumbers(ctx);
    const movers = useMemo(() => Core.priceMovers(fam.prices, 3).slice(0, 6), [fam.prices]);
    const daily = useMemo(() => Core.dailySeries(N.docs, N.t, 14).map((d, i) => ({ key: d.key, value: d.value, label: bn(Number(d.key.slice(8))), hi: d.key === N.t })), [N.docs, N.t]);
    const has = N.docs.length > 0 && (N.totals.thisMonth > 0 || N.totals.prevMonth > 0 || daily.some((d) => d.value > 0));
    const pct = Core.pctChange(N.totals.thisMonth, N.totals.prevMonth);
    const scope = vis.totals ? "পরিবারে" : "আপনার";
    const rows = ctx.fam.members.map((m) => ({ m, v: vis.totals || m.uid === uid ? N.byMember[m.uid] || 0 : null })).sort((a, b) => (b.v == null ? -1 : b.v) - (a.v == null ? -1 : a.v));
    const maxV = Math.max(1, ...rows.map((r) => r.v || 0));

    const myLists = Core.myShoppingLists(fam.shoppingLists, uid);
    const myPending = myLists.reduce((s, l) => s + Core.pendingShoppingItems(l).length, 0);

    return h("div", null,
      h(IncomingCards, { ctx }),
      myPending > 0 && h("button", { onClick: () => ctx.openSheet({ type: "shopping" }), style: Object.assign({}, S.card, { display: "flex", width: "100%", alignItems: "center", gap: 10, textAlign: "left", color: "var(--hk-text)", fontFamily: F, borderColor: "var(--hk-gold)" }) },
        h("span", { style: { fontSize: 22 } }, "📝"),
        h("span", { style: { flex: 1 } }, h("div", { style: { fontWeight: 700 } }, "আজকের বাজার"), h("div", { style: S.muted }, `আপনার তালিকায় ${bn(myPending)}টি পণ্য বাকি`)),
        h("span", { style: S.muted }, "›")),
      h(BudgetBanner, { budget: N.budget, scopeAll: N.scopeAll, onOpen: () => ctx.goMore("budget") }),
      h("div", { style: S.hero },
        h("div", { style: { fontSize: 13, opacity: 0.85 } }, `এই মাসে ${scope} বাজার খরচ`),
        h("div", { style: Object.assign({}, S.big, { margin: "4px 0 6px" }) }, taka(N.totals.thisMonth)),
        h("div", { style: { fontSize: 13 } }, pct == null ? "গত মাসের সাথে তুলনার তথ্য নেই" : h("span", null, h("b", null, pctText(pct)), " গত মাসের তুলনায় (গত মাস ", taka(N.totals.prevMonth), ")")),
        vis.write && h("button", { style: Object.assign({}, S.btn, { marginTop: 14 }), onClick: () => ctx.openSheet({ type: "purchase" }) }, "+ বাজার যোগ করুন")),
      !vis.totals && h("div", { style: Object.assign({}, S.card, { padding: "10px 14px" }) }, h("div", { style: S.muted }, "🔒 অন্যদের মোট খরচ দেখার অনুমতি নেই, তাই শুধু আপনার নিজের খরচ দেখাচ্ছে।")),
      !has && h("div", { style: S.card }, h(Empty, { icon: "🛒", title: "কোনো বাজার এখনো যোগ হয়নি", text: "আজকের বাজারের হিসাব এখনো যোগ করা হয়নি।", action: vis.write ? "+ বাজার যোগ করুন" : null, onAction: () => ctx.openSheet({ type: "purchase" }) })),
      fam.members.length <= 1 && vis.manage && h("div", { style: Object.assign({}, S.card, { borderColor: "var(--hk-gold)" }) },
        h("div", { style: { fontWeight: 700 } }, "👥 আপনার পরিবারের সদস্যদের Invite করুন"),
        h("div", { style: Object.assign({}, S.muted, { margin: "4px 0 10px" }) }, "Gmail দিয়ে Invite করলে তারা নিজের বাজার নিজেই লিখতে পারবে।"),
        h("button", { style: S.btn2, onClick: () => ctx.openSheet({ type: "invite" }) }, "সদস্যকে Invite করুন")),
      has && h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 } },
        [["আজ", N.totals.today, Core.pctChange(N.totals.today, N.totals.yesterday), "গতকাল"], ["এই সপ্তাহ", N.totals.thisWeek, Core.pctChange(N.totals.thisWeek, N.totals.prevWeek), "গত সপ্তাহ"], ["গত মাস", N.totals.prevMonth, null, ""]].map(([label, v, p, vs]) =>
          h("div", { key: label, style: Object.assign({}, S.card, { marginBottom: 0, padding: "11px 10px" }) },
            h("div", { style: S.muted }, label),
            h("div", { style: { fontFamily: SERIF, fontSize: 18, margin: "2px 0" } }, taka(v)),
            vs ? h("div", { style: { fontSize: 11.5 } }, p == null ? "" : h(Delta, { pct: p }), p == null ? "" : ` ${vs}ের তুলনায়`) : null))),
      N.budget && N.scopeAll && h("div", { style: S.card },
        h("div", { style: S.row }, h("div", { style: S.h2 }, "মাসের বাজেট"), h("button", { style: { background: "none", border: "none", color: "var(--hk-gold)", fontFamily: F, fontWeight: 600, minHeight: 36 }, onClick: () => ctx.goMore("budget") }, "বিস্তারিত")),
        h(HBar, { pct: N.budget.pct, color: LEVEL[N.budget.level].color }),
        h("div", { style: Object.assign({}, S.row, { marginTop: 8, fontSize: 13.5 }) }, h("span", null, `খরচ ${taka(N.budget.spent)}`), h("span", null, `বাকি ${taka(N.budget.remaining)}`), h("b", null, `${bn(N.budget.pct)}%`))),
      fam.budget && !N.scopeAll && h("div", { style: S.card }, h("div", { style: S.muted }, `মাসিক বাজেট ${taka(fam.budget.monthlyAmount)} — মোট খরচ দেখার অনুমতি না থাকায় কতটা খরচ হয়েছে দেখানো যাচ্ছে না।`)),
      has && h("div", { style: S.card },
        h("div", { style: S.h2 }, "কে কত খরচ করেছে"),
        rows.map(({ m, v }) => h("div", { key: m.uid, style: { marginBottom: 12 } },
          h("div", { style: Object.assign({}, S.row, { marginBottom: 4 }) },
            h("span", { style: { display: "flex", alignItems: "center", gap: 8 } }, h(Avatar, { m, size: 26 }), h("span", { style: { fontWeight: 600 } }, m.uid === uid ? `${m.name} (আপনি)` : m.name)),
            v == null ? h("span", { style: S.muted }, "🔒 অনুমতি নেই") : h("b", null, taka(v))),
          v != null && h(HBar, { pct: (v / maxV) * 100 })))),
      has && h("div", { style: S.card }, h("div", { style: S.h2 }, "গত ১৪ দিনের খরচ"), h(BarChart, { data: daily, labelEvery: 2 })),
      (vis.prices || movers.length > 0) && h("div", { style: S.card },
        h("div", { style: S.h2 }, "কোন পণ্যের দাম বাড়ল/কমল"),
        movers.length === 0 ? h("div", { style: S.muted }, "এখনো তুলনা করার মতো একই পণ্য দুইবার কেনা হয়নি।") : movers.map((m) => h(MoverRow, { key: (m.productId || m.productName) + m.unit, m, ctx })),
        movers.length > 0 && h("div", { style: Object.assign({}, S.muted, { marginTop: 8 }) }, "প্রতিটি পণ্যের সর্বশেষ কেনা দাম আগের বারের সাথে তুলনা।")),
      has && h(EstimateCard, { docs: N.docs, scopeAll: N.scopeAll }));
  }

  /* ------------------------------------------------------------------ *
   * ADD / EDIT PURCHASE
   * ------------------------------------------------------------------ */
  const blankRow = () => ({ key: Core.randomId(), productName: "", productId: null, categoryId: "", quantity: "", unit: "kg", unitPrice: "", total: "", totalManual: false, itemId: null, catTouched: false, unitTouched: false });
  const rowTotalOf = (r) => (r.totalManual ? Core.parseNum(r.total) : Core.calcLineTotal(r.quantity, r.unitPrice));

  function findProduct(products, name) {
    const k = Core.nameKey(name);
    if (!k) return null;
    return products.find((p) => !p.archived && (Core.nameKey(p.name) === k || (p.aliases || []).some((a) => Core.nameKey(a) === k))) || null;
  }

  // seed = list of { name, quantity, unit, categoryId } from a shopping-list
  // item, used to prefill one or more blank rows (price left empty for the
  // user to fill in); fromList = { listId, itemIds } — once the purchase
  // saves, those items are removed from that list (bought)
  function PurchaseSheet({ ctx, initial, seed, fromList, close }) {
    const { uid, fam, vis } = ctx;
    const prefs = useMemo(() => readPrefs(uid), [uid]);
    const cats = useMemo(() => Core.allCategories(fam.categories), [fam.categories]);
    const purchaseId = useRef(initial ? initial.purchaseId : Core.randomId());
    const [date, setDate] = useState(initial ? initial.date : today());
    const [market, setMarket] = useState(initial ? initial.market : (prefs.markets && prefs.markets[0]) || "");
    const [location, setLocation] = useState(initial ? initial.location : (prefs.locations && prefs.locations[0]) || "");
    const [note, setNote] = useState(initial ? initial.note : "");
    const [trackPrice, setTrackPrice] = useState(initial ? initial.trackPrice !== false : true);
    const [rows, setRows] = useState(() => initial && initial.items && initial.items.length
      ? initial.items.map((it) => ({ key: it.itemId, productName: it.productName, productId: it.productId, categoryId: it.categoryId || "", quantity: String(it.quantity), unit: it.unit, unitPrice: String(it.unitPrice), total: "", totalManual: false, itemId: it.itemId, catTouched: true, unitTouched: true }))
      : seed && seed.length
        ? seed.map((s) => Object.assign(blankRow(), { productName: s.name || "", categoryId: s.categoryId || "", catTouched: !!s.categoryId, quantity: s.quantity != null ? String(s.quantity) : "", unit: s.unit || blankRow().unit, unitTouched: !!s.unit }))
        : [blankRow()]);
    const [errors, setErrors] = useState([]);
    const [busy, setBusy] = useState(false);
    const [dirty, setDirty] = useState(false);
    const busyRef = useRef(false);

    const productNames = useMemo(() => {
      const set = new Map();
      fam.products.filter((p) => !p.archived).forEach((p) => set.set(Core.nameKey(p.name), p.name));
      Object.values(prefs.products || {}).forEach((p) => { if (!set.has(Core.nameKey(p.name))) set.set(Core.nameKey(p.name), p.name); });
      return Array.from(set.values());
    }, [fam.products, prefs]);
    const quick = useMemo(() => Object.values(prefs.products || {}).sort((a, b) => b.at - a.at).slice(0, 8), [prefs]);

    const patchRow = (i, patch) => { setDirty(true); setRows((rs) => rs.map((r, j) => (j === i ? Object.assign({}, r, patch) : r))); };
    const onName = (i, v) => {
      const known = findProduct(fam.products, v);
      const pref = (prefs.products || {})[Core.nameKey(v)];
      setDirty(true);
      setRows((rs) => rs.map((r, j) => {
        if (j !== i) return r;
        const n = Object.assign({}, r, { productName: v, productId: known ? known.id : null });
        if (!r.catTouched) n.categoryId = (known && known.categoryId) || (pref && pref.categoryId) || Core.guessCategoryId(v, fam.categories) || n.categoryId;
        if (!r.unitTouched && ((known && known.defaultUnit) || (pref && pref.unit))) n.unit = (pref && pref.unit) || known.defaultUnit;
        return n;
      }));
    };
    const addQuick = (p) => {
      setDirty(true);
      setRows((rs) => {
        const blank = rs.findIndex((r) => !r.productName.trim() && !r.quantity && !r.unitPrice);
        const filled = Object.assign(blankRow(), { productName: p.name, unit: p.unit || "kg", categoryId: p.categoryId || Core.guessCategoryId(p.name, fam.categories) || "", catTouched: !!p.categoryId, unitTouched: true });
        if (blank >= 0) return rs.map((r, j) => (j === blank ? Object.assign(filled, { key: r.key }) : r));
        return rs.concat(filled);
      });
    };

    const runningTotal = Core.round2(rows.reduce((s, r) => s + (isNaN(rowTotalOf(r)) ? 0 : rowTotalOf(r)), 0));

    const submit = async () => {
      if (busyRef.current) return;                  // no double submission
      const draft = {
        date,
        items: rows.map((r) => ({
          itemId: r.itemId, productName: r.productName, productId: r.productId, categoryId: r.categoryId || null,
          categoryName: (cats.find((c) => c.id === r.categoryId) || {}).name || null,
          quantity: r.quantity, unit: r.unit, unitPrice: r.totalManual ? "" : r.unitPrice, total: r.totalManual ? r.total : "",
        })),
      };
      const v = Core.validatePurchaseDraft(draft, today());
      if (!v.ok) { setErrors(v.errors); return; }
      // reuse an existing product's stable id when the typed name matches it
      v.items.forEach((it) => { const k = findProduct(fam.products, it.productName); if (k) it.productId = k.id; });
      setErrors([]);
      const p = Core.buildPurchase({ purchaseId: purchaseId.current, memberId: uid, memberName: ctx.me.name, date, market, location, note, trackPrice, items: v.items, createdAt: initial && initial.createdAt });
      busyRef.current = true; setBusy(true);
      try {
        const old = initial ? Object.assign({}, initial) : null;
        if (old) delete old.id;
        await window.FB.savePurchase(ctx.familyId, old, p);
        rememberPrefs(uid, p);
        if (fromList) window.FB.removeShoppingItems(ctx.familyId, fromList.listId, fromList.itemIds).catch(() => {});
        ctx.afterPurchaseChange(old, p);
        close(true);
      } catch (e) { setErrors([friendlyError(e)]); busyRef.current = false; setBusy(false); }
    };

    const guardedClose = () => { if (dirty && !window.confirm("লেখা তথ্য সংরক্ষণ হয়নি। ফিরে গেলে মুছে যাবে।")) return; close(); };

    const sel = Object.assign({}, S.input, { marginBottom: 0 });
    return h(Sheet, { title: initial ? "কেনাকাটা সম্পাদনা" : "নতুন বাজার যোগ করুন", onClose: guardedClose,
      footer: h("div", null,
        errors.length > 0 && h("div", { style: { color: "var(--hk-danger)", fontSize: 13, marginBottom: 8, lineHeight: 1.5 } }, errors.map((e, i) => h("div", { key: i }, "• " + e))),
        h("div", { style: Object.assign({}, S.row, { marginBottom: 8 }) }, h("span", { style: S.muted }, "সর্বমোট"), h("span", { style: { fontFamily: SERIF, fontSize: 24 } }, money(runningTotal))),
        h("button", { style: S.btn, disabled: busy, onClick: submit }, busy ? "সংরক্ষণ হচ্ছে…" : initial ? "পরিবর্তন সংরক্ষণ করুন" : "সংরক্ষণ করুন")) },
      h("datalist", { id: "fb-products" }, productNames.map((n) => h("option", { key: n, value: n }))),
      h("datalist", { id: "fb-markets" }, (prefs.markets || []).map((n) => h("option", { key: n, value: n }))),
      h("datalist", { id: "fb-locations" }, (prefs.locations || []).map((n) => h("option", { key: n, value: n }))),
      h("label", { style: S.label }, "তারিখ"),
      h("input", { type: "date", style: S.input, value: date, max: today(), onChange: (e) => { setDate(e.target.value); setDirty(true); } }),
      !initial && quick.length > 0 && h("div", { style: { marginBottom: 12 } },
        h("div", { style: S.label }, "দ্রুত যোগ — আগে কেনা পণ্য"),
        h("div", { style: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 } }, quick.map((p) => h("button", { key: p.name, style: S.chip(false), onClick: () => addQuick(p) }, "+ " + p.name)))),
      rows.map((r, i) => h("div", { key: r.key, style: Object.assign({}, S.card, { padding: "12px 12px 4px" }) },
        h("div", { style: Object.assign({}, S.row, { marginBottom: 6 }) }, h("b", { style: { fontSize: 13 } }, `পণ্য ${bn(i + 1)}`),
          rows.length > 1 && h("button", { "aria-label": "পণ্য বাদ দিন", onClick: () => { setRows((rs) => rs.filter((_, j) => j !== i)); setDirty(true); }, style: { background: "none", border: "none", color: "var(--hk-danger)", fontSize: 13, minHeight: 36, fontFamily: F } }, "✕ বাদ দিন")),
        h("input", { style: S.input, list: "fb-products", placeholder: "পণ্যের নাম (যেমন: চাল)", value: r.productName, maxLength: 80, onChange: (e) => onName(i, e.target.value) }),
        h("select", { style: S.input, value: r.categoryId, onChange: (e) => patchRow(i, { categoryId: e.target.value, catTouched: true }), "aria-label": "ক্যাটাগরি" },
          h("option", { value: "" }, "ক্যাটাগরি (ঐচ্ছিক)"),
          Core.CATEGORY_GROUPS.map((g) => h("optgroup", { key: g.key, label: g.label }, cats.filter((c) => c.group === g.key).map((c) => h("option", { key: c.id, value: c.id }, `${c.icon} ${c.name}`))))),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
          h("div", null, h("label", { style: S.label }, "পরিমাণ"), h("input", { style: S.input, inputMode: "decimal", placeholder: "৫", value: r.quantity, onChange: (e) => patchRow(i, { quantity: e.target.value }) })),
          h("div", null, h("label", { style: S.label }, "একক"), h("select", { style: S.input, value: r.unit, onChange: (e) => patchRow(i, { unit: e.target.value, unitTouched: true }) }, Core.UNITS.map((u) => h("option", { key: u, value: u }, unitText(u))))),
          h("div", null, h("label", { style: S.label }, "একক দাম (৳)"), h("input", { style: S.input, inputMode: "decimal", placeholder: "৬৪", value: r.totalManual ? (Core.parseNum(r.quantity) > 0 && !isNaN(Core.parseNum(r.total)) ? String(Core.round2(Core.parseNum(r.total) / Core.parseNum(r.quantity))) : "") : r.unitPrice, onChange: (e) => patchRow(i, { unitPrice: e.target.value, totalManual: false }) })),
          h("div", null, h("label", { style: S.label }, "মোট (৳)"), h("input", { style: S.input, inputMode: "decimal", placeholder: "৩২০", value: r.totalManual ? r.total : (rowTotalOf(r) > 0 ? String(rowTotalOf(r)) : ""), onChange: (e) => patchRow(i, { total: e.target.value, totalManual: true }) }))))),
      h("button", { style: Object.assign({}, S.btn2, { width: "100%", marginBottom: 14 }), onClick: () => { setRows((rs) => rs.concat(blankRow())); setDirty(true); } }, "+ আরেকটি পণ্য যোগ করুন"),
      h("label", { style: S.label }, "বাজার / দোকান"),
      h("input", { style: S.input, list: "fb-markets", placeholder: "যেমন: সুন্দরগঞ্জ বাজার", value: market, maxLength: 60, onChange: (e) => { setMarket(e.target.value); setDirty(true); } }),
      h("label", { style: S.label }, "এলাকা / শহর"),
      h("input", { style: S.input, list: "fb-locations", placeholder: "যেমন: গাইবান্ধা", value: location, maxLength: 60, onChange: (e) => { setLocation(e.target.value); setDirty(true); } }),
      h("label", { style: S.label }, "নোট"),
      h("input", { style: S.input, value: note, maxLength: 200, onChange: (e) => { setNote(e.target.value); setDirty(true); } }),
      h(Toggle, { on: trackPrice, onChange: (v) => { setTrackPrice(v); setDirty(true); }, label: "দামের ইতিহাসে যোগ হবে", hint: "বন্ধ করলে খরচ গোনা হবে, কিন্তু পণ্যের দামের তুলনায় আসবে না" }));
  }

  /* ------------------------------------------------------------------ *
   * PURCHASE DETAILS
   * ------------------------------------------------------------------ */
  function PurchaseDetailsSheet({ ctx, purchase, close }) {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const mine = purchase.memberId === ctx.uid;
    const who = ctx.fam.members.find((m) => m.uid === purchase.memberId);
    const del = async () => {
      if (busy || !window.confirm("এই কেনাকাটা মুছে ফেলবেন? মোট ও দামের ইতিহাস থেকেও বাদ যাবে।")) return;
      setBusy(true); setErr("");
      try { const old = Object.assign({}, purchase); delete old.id; await window.FB.savePurchase(ctx.familyId, old, null); ctx.afterPurchaseChange(old, null); close(); }
      catch (e) { setErr(friendlyError(e)); setBusy(false); }
    };
    return h(Sheet, { title: "বাজারের বিস্তারিত", onClose: close },
      h("div", { style: S.hero },
        h("div", { style: { fontSize: 13, opacity: 0.85 } }, `${dateBn(purchase.date)} • ${who ? (mine ? "আপনি" : who.name) : (purchase.memberName || "সদস্য")}`),
        h("div", { style: Object.assign({}, S.big, { margin: "4px 0" }) }, taka(purchase.total)),
        (purchase.market || purchase.location) && h("div", { style: { fontSize: 13 } }, "📍 " + [purchase.market, purchase.location].filter(Boolean).join(", "))),
      h("div", { style: S.card },
        (purchase.items || []).map((it) => h("div", { key: it.itemId, style: { padding: "9px 0", borderBottom: "1px solid var(--hk-border-light)" } },
          h("div", { style: S.row },
            h("button", { onClick: () => ctx.openSheet({ type: "product", productId: it.productId, name: it.productName }), style: { background: "none", border: "none", padding: 0, fontWeight: 600, fontSize: 14.5, color: "var(--hk-text)", fontFamily: F, textAlign: "left" } }, it.productName),
            h("b", null, taka(it.total))),
          h("div", { style: S.muted }, `${qtyText(it.quantity)} ${unitText(it.unit)} × ${money(it.unitPrice)}`, it.category ? ` • ${it.category}` : ""))),
        purchase.note && h("div", { style: Object.assign({}, S.muted, { marginTop: 10 }) }, "📝 " + purchase.note),
        purchase.trackPrice === false && h("div", { style: Object.assign({}, S.muted, { marginTop: 8 }) }, "দামের ইতিহাসে যোগ করা হয়নি")),
      err && h(ErrorBox, { msg: err }),
      mine && h("div", { style: { display: "flex", gap: 10 } },
        h("button", { style: S.btn, onClick: () => ctx.openSheet({ type: "purchase", initial: purchase }) }, "সম্পাদনা"),
        h("button", { style: S.danger, disabled: busy, onClick: del }, "মুছুন")));
  }

  /* ------------------------------------------------------------------ *
   * SHOPPING LISTS — "কী কী কিনতে হবে" reminders, assignable to any member.
   * Buying an item from a list opens the exact same add-purchase form
   * (seeded), and a successful purchase removes it from the list.
   * ------------------------------------------------------------------ */
  const REPEAT_LABEL = { none: "শুধু একবার", once: "নির্দিষ্ট তারিখে একবার", daily: "প্রতিদিন" };

  function ShoppingListRow({ ctx, list }) {
    const { fam, uid } = ctx;
    const pending = Core.pendingShoppingItems(list);
    const assignee = fam.members.find((m) => m.uid === list.assignedTo);
    const who = list.assignedTo === uid ? "আপনার জন্য" : (assignee ? `${assignee.name}-এর জন্য` : "একজন সদস্যের জন্য");
    return h("button", { onClick: () => ctx.openSheet({ type: "shopping-detail", listId: list.id }), style: Object.assign({}, S.card, { display: "block", width: "100%", textAlign: "left", color: "var(--hk-text)", fontFamily: F, marginBottom: 8 }) },
      h("div", { style: S.row },
        h("span", { style: { fontWeight: 700 } }, list.title),
        list.status === "done" ? h("span", { style: S.pill("var(--hk-track)", "var(--hk-text-muted-2)") }, "সম্পন্ন") : h("span", { style: S.pill("var(--hk-gold)", "#1a1a1a") }, `${bn(pending.length)}টি বাকি`)),
      h("div", { style: S.muted }, [who, list.reminder && list.reminder.enabled ? `🔔 ${bn(list.reminder.time)}${list.reminder.repeat === "daily" ? " • প্রতিদিন" : ""}` : null].filter(Boolean).join(" • ")));
  }

  function ShoppingListsSheet({ ctx, close }) {
    const { fam, uid, vis } = ctx;
    const lists = fam.shoppingLists || [];
    const mine = lists.filter((l) => l.assignedTo === uid);
    const forOthers = lists.filter((l) => l.createdBy === uid && l.assignedTo !== uid);
    return h(Sheet, { title: "আজকের বাজার তালিকা", onClose: close,
      footer: vis.write && h("button", { style: S.btn, onClick: () => ctx.openSheet({ type: "shopping-create" }) }, "+ নতুন তালিকা") },
      lists.length === 0 && h(Empty, { icon: "📝", title: "কোনো তালিকা নেই", text: "কী কী বাজার করতে হবে তার একটি তালিকা বানিয়ে রাখুন — নিজের জন্য বা পরিবারের কারও জন্য, রিমাইন্ডার সহ।" }),
      mine.length > 0 && h("div", { style: { marginBottom: 16 } }, h("div", { style: S.h2 }, "আপনার জন্য"), mine.map((l) => h(ShoppingListRow, { key: l.id, ctx, list: l }))),
      forOthers.length > 0 && h("div", null, h("div", { style: S.h2 }, "আপনি অন্যদের জন্য তৈরি করেছেন"), forOthers.map((l) => h(ShoppingListRow, { key: l.id, ctx, list: l }))));
  }

  const blankShopRow = () => ({ key: Core.randomId(), name: "", categoryId: "", quantity: "", unit: "kg" });

  function ShoppingCreateSheet({ ctx, close }) {
    const { fam, uid, familyId, vis } = ctx;
    const cats = useMemo(() => Core.allCategories(fam.categories), [fam.categories]);
    const others = fam.members.filter((m) => m.uid !== uid && Core.isActive(m));
    const [assignedTo, setAssignedTo] = useState(uid);
    const [title, setTitle] = useState("আজকের বাজার");
    const [rows, setRows] = useState([blankShopRow()]);
    const [remindOn, setRemindOn] = useState(false);
    const [repeat, setRepeat] = useState("daily");
    const [time, setTime] = useState("18:00");
    const [rdate, setRdate] = useState(today());
    const [errors, setErrors] = useState([]);
    const [busy, setBusy] = useState(false);
    const patch = (i, p) => setRows((rs) => rs.map((r, j) => (j === i ? Object.assign({}, r, p) : r)));
    const save = async () => {
      if (busy) return;
      const v = Core.validateShoppingDraft({ title, assignedTo, items: rows });
      if (!v.ok) { setErrors(v.errors); return; }
      setErrors([]); setBusy(true);
      try {
        await window.FB.saveShoppingList(familyId, {
          title: v.title, createdBy: uid, assignedTo, items: v.items,
          reminder: remindOn ? { enabled: true, time, repeat, date: repeat === "once" ? rdate : null } : null,
        });
        ctx.toast("তালিকা সংরক্ষণ করা হয়েছে ✓");
        ctx.reload(); close();
      } catch (e) { setErrors([friendlyError(e)]); setBusy(false); }
    };
    return h(Sheet, { title: "নতুন বাজার তালিকা", onClose: close,
      footer: h("div", null,
        errors.length > 0 && h("div", { style: { color: "var(--hk-danger)", fontSize: 13, marginBottom: 8, lineHeight: 1.5 } }, errors.map((e, i) => h("div", { key: i }, "• " + e))),
        h("button", { style: S.btn, disabled: busy, onClick: save }, busy ? "সংরক্ষণ হচ্ছে…" : "তালিকা সংরক্ষণ করুন")) },
      h("label", { style: S.label }, "তালিকার নাম"),
      h("input", { style: S.input, value: title, maxLength: 60, onChange: (e) => setTitle(e.target.value) }),
      others.length > 0 && h("div", null,
        h("label", { style: S.label }, "কার জন্য এই তালিকা?"),
        h("select", { style: S.input, value: assignedTo, onChange: (e) => setAssignedTo(e.target.value) },
          h("option", { value: uid }, "নিজের জন্য"),
          others.map((m) => h("option", { key: m.uid, value: m.uid }, m.name)))),
      rows.map((r, i) => h("div", { key: r.key, style: Object.assign({}, S.card, { padding: "12px 12px 4px" }) },
        h("div", { style: Object.assign({}, S.row, { marginBottom: 6 }) }, h("b", { style: { fontSize: 13 } }, `পণ্য ${bn(i + 1)}`),
          rows.length > 1 && h("button", { "aria-label": "পণ্য বাদ দিন", onClick: () => setRows((rs) => rs.filter((_, j) => j !== i)), style: { background: "none", border: "none", color: "var(--hk-danger)", fontSize: 13, minHeight: 32 } }, "মুছুন")),
        h("input", { style: S.input, placeholder: "পণ্যের নাম (যেমন: দুধ)", value: r.name, maxLength: 80, onChange: (e) => { const v = e.target.value; patch(i, { name: v, categoryId: r.categoryId || Core.guessCategoryId(v, fam.categories) || "" }); } }),
        h("select", { style: S.input, value: r.categoryId, onChange: (e) => patch(i, { categoryId: e.target.value }), "aria-label": "ক্যাটাগরি" },
          h("option", { value: "" }, "ক্যাটাগরি (ঐচ্ছিক)"),
          Core.CATEGORY_GROUPS.map((g) => h("optgroup", { key: g.key, label: g.label }, cats.filter((c) => c.group === g.key).map((c) => h("option", { key: c.id, value: c.id }, `${c.icon} ${c.name}`))))),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
          h("div", null, h("label", { style: S.label }, "পরিমাণ (ঐচ্ছিক)"), h("input", { style: S.input, inputMode: "decimal", placeholder: "২", value: r.quantity, onChange: (e) => patch(i, { quantity: e.target.value }) })),
          h("div", null, h("label", { style: S.label }, "একক"), h("select", { style: S.input, value: r.unit, onChange: (e) => patch(i, { unit: e.target.value }) }, Core.UNITS.map((u) => h("option", { key: u, value: u }, unitText(u)))))))),
      h("button", { style: Object.assign({}, S.btn2, { width: "100%", marginBottom: 14 }), onClick: () => setRows((rs) => rs.concat(blankShopRow())) }, "+ আরেকটি পণ্য যোগ করুন"),
      h(Toggle, { on: remindOn, onChange: setRemindOn, label: "রিমাইন্ডার", hint: "নির্ধারিত সময়ে মনে করিয়ে দেওয়া হবে, যতক্ষণ তালিকায় বাকি পণ্য থাকবে" }),
      remindOn && h("div", null,
        h("label", { style: S.label }, "কখন?"),
        h("div", { style: { display: "flex", gap: 6, marginBottom: 10 } }, [["daily", "প্রতিদিন"], ["once", "নির্দিষ্ট তারিখে"]].map(([k, l]) => h("button", { key: k, style: S.chip(repeat === k), onClick: () => setRepeat(k) }, l))),
        h("div", { style: { display: "grid", gridTemplateColumns: repeat === "once" ? "1fr 1fr" : "1fr", gap: 8 } },
          repeat === "once" && h("input", { type: "date", style: S.input, value: rdate, min: today(), onChange: (e) => setRdate(e.target.value) }),
          h("input", { type: "time", style: S.input, value: time, onChange: (e) => setTime(e.target.value) }))));
  }

  function ShoppingDetailSheet({ ctx, listId, close }) {
    const { fam, uid, familyId, vis } = ctx;
    const list = (fam.shoppingLists || []).find((l) => l.id === listId);
    const [busy, setBusy] = useState(false);
    if (!list) return h(Sheet, { title: "বাজারের তালিকা", onClose: close }, h(Empty, { icon: "📝", title: "তালিকা পাওয়া যায়নি", text: "সম্ভবত এটি মুছে ফেলা হয়েছে বা সম্পন্ন হয়ে গেছে।" }));
    const assignee = fam.members.find((m) => m.uid === list.assignedTo);
    const canManage = list.createdBy === uid || list.assignedTo === uid || vis.admin;
    const pending = Core.pendingShoppingItems(list);
    const toggle = async (it) => { try { await window.FB.toggleShoppingItem(familyId, listId, it.id, !it.checked); ctx.reload(); } catch (e) { ctx.toast(friendlyError(e)); } };
    const buyOne = (it) => ctx.openSheet({ type: "purchase", seed: [{ name: it.name, quantity: it.quantity, unit: it.unit, categoryId: it.categoryId }], fromList: { listId, itemIds: [it.id] } });
    const buyAll = () => ctx.openSheet({ type: "purchase", seed: pending.map((it) => ({ name: it.name, quantity: it.quantity, unit: it.unit, categoryId: it.categoryId })), fromList: { listId, itemIds: pending.map((it) => it.id) } });
    const removeList = async () => {
      if (busy || !window.confirm("এই তালিকাটি পুরোপুরি মুছে ফেলবেন?")) return;
      setBusy(true);
      try { await window.FB.deleteShoppingList(familyId, listId); ctx.toast("তালিকা মুছে ফেলা হয়েছে"); ctx.reload(); close(); }
      catch (e) { ctx.toast(friendlyError(e)); setBusy(false); }
    };
    return h(Sheet, { title: list.title, onClose: close,
      footer: pending.length > 1 && h("button", { style: S.btn, onClick: buyAll }, `সবগুলো (${bn(pending.length)}টি) দিয়ে একসাথে বাজার যোগ করুন`) },
      h("div", { style: S.muted }, list.assignedTo !== uid ? `${(assignee && assignee.name) || "একজন সদস্য"}-এর জন্য` : "আপনার জন্য",
        list.reminder && list.reminder.enabled ? ` • 🔔 ${bn(list.reminder.time)} (${REPEAT_LABEL[list.reminder.repeat] || ""})` : ""),
      h("div", { style: Object.assign({}, S.card, { marginTop: 10 }) },
        (list.items || []).length === 0 ? h("div", { style: S.muted }, "তালিকাটি খালি — সব কেনা হয়ে গেছে।") :
        (list.items || []).map((it) => h("div", { key: it.id, style: { display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--hk-border-light)" } },
          h("input", { type: "checkbox", checked: !!it.checked, onChange: () => toggle(it), style: { width: 22, height: 22, accentColor: "var(--hk-success)", flex: "none" } }),
          h("button", { onClick: () => buyOne(it), style: { flex: 1, textAlign: "left", background: "none", border: "none", color: "var(--hk-text)", fontFamily: F, padding: 0, textDecoration: it.checked ? "line-through" : "none", opacity: it.checked ? 0.55 : 1 } },
            h("div", { style: { fontWeight: 600, fontSize: 14.5 } }, it.name),
            (it.quantity || it.unit) && h("div", { style: S.muted }, [it.quantity != null ? qtyText(it.quantity) : null, it.unit ? unitText(it.unit) : null].filter(Boolean).join(" ") + " — কিনতে চাপ দিন")))),
        h("div", { style: Object.assign({}, S.muted, { marginTop: 8 }) }, "✓ দিলে শুধু সম্পন্ন হিসেবে চিহ্নিত হবে। নামের ওপর চাপ দিলে দাম সহ বাজার হিসেবে যোগ হবে ও তালিকা থেকে সরে যাবে।")),
      canManage && h("button", { style: S.danger, disabled: busy, onClick: removeList }, "তালিকাটি মুছে ফেলুন"));
  }

  /* ------------------------------------------------------------------ *
   * BAZAR (purchase list, one month at a time — keeps reads small)
   * ------------------------------------------------------------------ */
  function BazarTab({ ctx }) {
    const { vis, uid, familyId } = ctx;
    const [month, setMonth] = useState(Core.monthOf(today()));
    const [who, setWho] = useState("all");
    const [st, setSt] = useState({ loading: true, error: "", rows: [] });
    const load = useCallback(async () => {
      setSt((s) => Object.assign({}, s, { loading: true, error: "" }));
      try { const rows = await window.FB.purchasesForMonth(familyId, month, vis.details); setSt({ loading: false, error: "", rows }); }
      catch (e) { setSt({ loading: false, error: friendlyError(e), rows: [] }); }
    }, [familyId, month, vis.details, ctx.purchaseTick]);
    useEffect(() => { load(); }, [load]);
    const cur = Core.monthOf(today());
    const rows = st.rows.filter((p) => who === "all" || p.memberId === who);
    const total = Core.round2(rows.reduce((s, p) => s + (p.total || 0), 0));
    const groups = useMemo(() => { const g = {}; rows.forEach((p) => (g[p.date] = g[p.date] || []).push(p)); return Object.keys(g).sort().reverse().map((d) => ({ date: d, list: g[d] })); }, [rows]);

    return h("div", null,
      h("div", { style: Object.assign({}, S.row, { marginBottom: 10 }) },
        h("button", { style: S.btn2, "aria-label": "আগের মাস", onClick: () => setMonth(Core.addMonths(month, -1)) }, "‹"),
        h("div", { style: { fontFamily: SERIF, fontSize: 17 } }, monthBn(month)),
        h("button", { style: Object.assign({}, S.btn2, { opacity: month >= cur ? 0.35 : 1 }), disabled: month >= cur, "aria-label": "পরের মাস", onClick: () => setMonth(Core.addMonths(month, 1)) }, "›")),
      vis.details && ctx.fam.members.length > 1 && h("div", { style: { display: "flex", gap: 6, overflowX: "auto", marginBottom: 10 } },
        [{ uid: "all", name: "সবাই" }].concat(ctx.fam.members).map((m) => h("button", { key: m.uid, style: S.chip(who === m.uid), onClick: () => setWho(m.uid) }, m.uid === uid ? "আমি" : m.name))),
      !vis.details && h("div", { style: Object.assign({}, S.card, { padding: "10px 14px" }) }, h("div", { style: S.muted }, "🔒 অন্যদের কেনাকাটার বিস্তারিত দেখার অনুমতি নেই — শুধু আপনার নিজের বাজার দেখাচ্ছে।")),
      st.loading ? h(Loading) : st.error ? h(ErrorBox, { msg: st.error, onRetry: load }) :
        rows.length === 0 ? h(Empty, { icon: "🧺", title: "এই মাসে কোনো বাজার নেই", text: month === cur ? "আজকের বাজারের হিসাব এখনো যোগ করা হয়নি।" : "এই মাসের কোনো কেনাকাটা পাওয়া যায়নি।", action: vis.write && month === cur ? "+ বাজার যোগ করুন" : null, onAction: () => ctx.openSheet({ type: "purchase" }) }) :
        h("div", null,
          h("div", { style: Object.assign({}, S.card, S.row) }, h("span", { style: S.muted }, `${bn(rows.length)}টি বাজার`), h("b", { style: { fontFamily: SERIF, fontSize: 20 } }, taka(total))),
          groups.map((g) => h("div", { key: g.date },
            h("div", { style: Object.assign({}, S.row, { margin: "10px 2px 6px" }) }, h("b", { style: { fontSize: 13 } }, dateBn(g.date)), h("span", { style: S.muted }, taka(g.list.reduce((s, p) => s + p.total, 0)))),
            g.list.map((p) => {
              const m = ctx.fam.members.find((x) => x.uid === p.memberId);
              return h("button", { key: p.id, onClick: () => ctx.openSheet({ type: "purchase-details", purchase: p }), style: Object.assign({}, S.card, { display: "flex", width: "100%", alignItems: "center", gap: 10, textAlign: "left", color: "var(--hk-text)", fontFamily: F, padding: "11px 12px", marginBottom: 8 }) },
                h(Avatar, { m: m || { name: p.memberName }, size: 34 }),
                h("span", { style: { flex: 1, minWidth: 0 } },
                  h("div", { style: { fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, (p.items || []).slice(0, 3).map((i) => i.productName).join(", ") + ((p.items || []).length > 3 ? ` +${bn(p.items.length - 3)}` : "")),
                  h("div", { style: S.muted }, (p.memberId === uid ? "আপনি" : (m ? m.name : p.memberName)) + (p.market ? ` • ${p.market}` : ""))),
                h("b", null, taka(p.total)));
            })))));
  }

  /* ------------------------------------------------------------------ *
   * REPORTS
   * ------------------------------------------------------------------ */
  function ReportsTab({ ctx }) {
    const { fam, vis, uid } = ctx;
    const cm = Core.monthOf(today());
    const [month, setMonth] = useState(cm);
    const pm = Core.addMonths(month, -1);
    const docs = fam.stats.monthly;
    const R = useMemo(() => {
      const cur = Core.memberMonthTotals(docs, month), prev = Core.memberMonthTotals(docs, pm);
      const sum = (o) => Core.round2(Object.values(o).reduce((s, v) => s + v, 0));
      const t = today();
      const ref = month === cm ? t : `${month}-${String(Core.daysInMonth(month)).padStart(2, "0")}`;
      const map = Core.mergeDays(docs);
      const days = [];
      for (let d = 1; d <= Core.daysInMonth(month); d++) { const k = `${month}-${String(d).padStart(2, "0")}`; days.push({ key: k, value: map[k] || 0, label: bn(d), hi: k === t }); }
      const movers = Core.priceMovers(fam.prices.filter((r) => (r.month || Core.monthOf(r.date)) <= month), 3).slice(0, 8);
      return {
        cur, total: sum(cur), prevTotal: sum(prev),
        cats: Core.categoryRows(fam.stats.cats, month, pm),
        days, weeks: Core.weeklySeries(docs, ref, 5).map((w) => ({ key: w.key, value: w.value, label: bn(Number(w.key.slice(8))) + "/" + bn(Number(w.key.slice(5, 7))) })),
        trend: Core.monthlySeries(docs, t, 6).map((m) => ({ key: m.key, value: m.value, label: formatDateBn(m.key + "-01").month.slice(0, 3), hi: m.key === month })),
        movers,
      };
    }, [docs, fam.stats.cats, fam.prices, month]);
    const budget = fam.budget && fam.budget.monthlyAmount ? Core.budgetStatus(fam.budget.monthlyAmount, R.total) : null;
    const pct = Core.pctChange(R.total, R.prevTotal);
    const scope = vis.totals ? "পরিবারের" : "আপনার";
    const months = Core.monthsBack(cm, 6).reverse();
    const rows = fam.members.map((m) => ({ m, v: vis.totals || m.uid === uid ? R.cur[m.uid] || 0 : null })).sort((a, b) => (b.v == null ? -1 : b.v) - (a.v == null ? -1 : a.v));
    const maxV = Math.max(1, ...rows.map((r) => r.v || 0));

    if (!vis.reports) return h(Lock, { text: "পরিবারের রিপোর্ট দেখার অনুমতি আপনাকে দেওয়া হয়নি।" });
    return h("div", null,
      h("div", { style: { display: "flex", gap: 6, overflowX: "auto", marginBottom: 12 } }, months.map((m) => h("button", { key: m, style: S.chip(m === month), onClick: () => setMonth(m) }, monthBn(m)))),
      h("div", { style: S.hero },
        h("div", { style: { fontSize: 13, opacity: 0.85 } }, `${monthBn(month)} — ${scope} মোট বাজার খরচ`),
        h("div", { style: Object.assign({}, S.big, { margin: "4px 0 6px" }) }, taka(R.total)),
        h("div", { style: { fontSize: 13 } }, pct == null ? `গত মাস (${monthBn(pm)}) — কোনো তথ্য নেই` : h("span", null, h("b", null, pctText(pct)), ` গত মাসের তুলনায় (${taka(R.prevTotal)})`))),
      R.total === 0 && R.prevTotal === 0 && h(Empty, { icon: "📊", title: "রিপোর্টের জন্য তথ্য নেই", text: "বাজার যোগ করলে এখানে হিসাব দেখা যাবে।" }),
      R.total > 0 && h("div", null,
        h("div", { style: S.card }, h("div", { style: S.h2 }, "সদস্যভিত্তিক খরচ"),
          rows.map(({ m, v }) => h("div", { key: m.uid, style: { marginBottom: 10 } },
            h("div", { style: Object.assign({}, S.row, { marginBottom: 4 }) }, h("span", null, m.name), v == null ? h("span", { style: S.muted }, "🔒") : h("b", null, `${taka(v)}${R.total ? ` • ${bn(Math.round((v / R.total) * 100))}%` : ""}`)),
            v != null && h(HBar, { pct: (v / maxV) * 100 })))),
        vis.categories ? h("div", { style: S.card }, h("div", { style: S.h2 }, "ক্যাটাগরি অনুযায়ী"),
          R.cats.length === 0 ? h("div", { style: S.muted }, "এই মাসের ক্যাটাগরি তথ্য নেই।") : R.cats.map((c) => h("div", { key: c.id, style: { marginBottom: 10 } },
            h("div", { style: S.row }, h("span", null, c.name), h("b", null, `${taka(c.total)} • ${bn(c.pct)}%`)),
            h(HBar, { pct: c.pct }),
            h("div", { style: { fontSize: 11.5, marginTop: 2 } }, c.change == null ? h("span", { style: S.muted }, "গত মাসে এই ক্যাটাগরিতে খরচ ছিল না") : h("span", null, h(Delta, { pct: c.change }), h("span", { style: S.muted }, ` গত মাস ${taka(c.prevTotal)}`)))))) :
          h(Lock, { text: "ক্যাটাগরি অনুযায়ী সারাংশ দেখার অনুমতি নেই।" }),
        budget && h("div", { style: S.card }, h("div", { style: S.h2 }, "বাজেট"), h(HBar, { pct: budget.pct, color: LEVEL[budget.level].color }),
          h("div", { style: Object.assign({}, S.row, { marginTop: 8, fontSize: 13.5 }) }, h("span", null, `${taka(budget.spent)} / ${taka(budget.amount)}`), h("b", { style: { color: LEVEL[budget.level].color } }, `${bn(budget.pct)}%`)),
          LEVEL[budget.level].text && h("div", { style: { color: LEVEL[budget.level].color, fontSize: 13, marginTop: 4 } }, LEVEL[budget.level].text)),
        h("div", { style: S.card }, h("div", { style: S.h2 }, "দিনভিত্তিক খরচ"), h(BarChart, { data: R.days, labelEvery: 5 })),
        h("div", { style: S.card }, h("div", { style: S.h2 }, "সাপ্তাহিক খরচ (শনি–শুক্র)"), h(BarChart, { data: R.weeks, color: "var(--hk-success)" })),
        h("div", { style: S.card }, h("div", { style: S.h2 }, "শেষ ৬ মাস"), h(BarChart, { data: R.trend }))),
      (vis.prices || R.movers.length > 0) && h("div", { style: S.card }, h("div", { style: S.h2 }, "পণ্যের দামের পরিবর্তন"),
        R.movers.length === 0 ? h("div", { style: S.muted }, month < ctx.prevMonthKey ? "এই মাসের দামের তথ্য এখানে লোড করা হয়নি — পণ্যের পাতায় ইতিহাস দেখুন।" : "দাম পরিবর্তনের মতো তথ্য এখনো নেই।") : R.movers.map((m) => h(MoverRow, { key: (m.productId || m.productName) + m.unit, m, ctx }))),
      month === cm && R.total > 0 && h(EstimateCard, { docs, scopeAll: vis.totals }));
  }

  /* ------------------------------------------------------------------ *
   * BUDGET
   * ------------------------------------------------------------------ */
  function BudgetView({ ctx }) {
    const N = useNumbers(ctx);
    const [val, setVal] = useState(ctx.fam.budget && ctx.fam.budget.monthlyAmount ? String(ctx.fam.budget.monthlyAmount) : "");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const save = async () => {
      const n = val.trim() === "" ? 0 : Core.parseNum(val);
      if (isNaN(n) || n < 0 || n > 10000000) { setErr("সঠিক পরিমাণ লিখুন"); return; }
      setBusy(true); setErr("");
      try { await window.FB.setFamilyBudget(ctx.familyId, Core.round2(n)); ctx.toast(n ? "বাজেট সংরক্ষিত হয়েছে" : "বাজেট সরানো হয়েছে"); await ctx.reload(); }
      catch (e) { setErr(friendlyError(e)); }
      setBusy(false);
    };
    return h("div", null,
      N.budget && N.scopeAll ? h("div", { style: S.hero },
        h("div", { style: { fontSize: 13, opacity: 0.85 } }, `${monthBn(N.cm)}-এর বাজেট ${taka(N.budget.amount)}`),
        h("div", { style: Object.assign({}, S.big, { margin: "4px 0 10px" }) }, `${bn(N.budget.pct)}% খরচ`),
        h(HBar, { pct: N.budget.pct, color: LEVEL[N.budget.level].color }),
        h("div", { style: Object.assign({}, S.row, { marginTop: 10, fontSize: 14 }) }, h("span", null, `খরচ ${taka(N.budget.spent)}`), h("span", null, N.budget.over > 0 ? `বেশি ${taka(N.budget.over)}` : `বাকি ${taka(N.budget.remaining)}`)),
        LEVEL[N.budget.level].text && h("div", { style: { marginTop: 8, fontWeight: 700 } }, "⚠ " + LEVEL[N.budget.level].text)) :
        h("div", { style: S.card }, h("div", { style: S.muted }, ctx.fam.budget && ctx.fam.budget.monthlyAmount ? `মাসিক বাজেট ${taka(ctx.fam.budget.monthlyAmount)}। মোট খরচ দেখার অনুমতি না থাকায় কতটা খরচ হয়েছে দেখানো যাচ্ছে না।` : "এখনো কোনো মাসিক বাজেট ঠিক করা হয়নি।")),
      ctx.vis.admin ? h("div", { style: S.card },
        h("label", { style: S.label }, "মাসিক পারিবারিক বাজার বাজেট (৳)"),
        h("input", { style: S.input, inputMode: "decimal", placeholder: "যেমন: ২৫০০০", value: val, onChange: (e) => setVal(e.target.value) }),
        err && h("div", { style: { color: "var(--hk-danger)", fontSize: 13, marginBottom: 8 } }, err),
        h("button", { style: S.btn, disabled: busy, onClick: save }, busy ? "সংরক্ষণ হচ্ছে…" : "বাজেট সংরক্ষণ"),
        h("div", { style: Object.assign({}, S.muted, { marginTop: 8 }) }, "ফাঁকা রেখে সংরক্ষণ করলে বাজেট সরে যাবে।")) :
        h("div", { style: S.muted }, "বাজেট শুধু মালিক ও এডমিন বদলাতে পারেন।"),
      h("div", { style: Object.assign({}, S.card, { marginTop: 12 }) }, h("div", { style: S.h2 }, "সতর্কতা কখন আসে"),
        h("div", { style: S.muted }, "খরচ ৮০%, ৯০% ছুঁলে এবং বাজেট ছাড়ালে হোম স্ক্রিনে ও নোটিফিকেশনে জানানো হয়।")));
  }

  /* ------------------------------------------------------------------ *
   * FAMILY TAB, MEMBER, INVITE, SETTINGS
   * ------------------------------------------------------------------ */
  function FamilyTab({ ctx }) {
    const { fam, vis, uid, family } = ctx;
    const N = useNumbers(ctx);
    const [sent, setSent] = useState({ loading: false, rows: [], error: "" });
    const loadSent = useCallback(async () => {
      if (!vis.manage) return;
      setSent((s) => Object.assign({}, s, { loading: true }));
      try { setSent({ loading: false, rows: await window.FB.familySentInvitations(ctx.familyId), error: "" }); }
      catch (e) { setSent({ loading: false, rows: [], error: friendlyError(e) }); }
    }, [ctx.familyId, vis.manage, ctx.inviteTick]);
    useEffect(() => { loadSent(); }, [loadSent]);
    ctx.reloadInvites = loadSent;
    const shown = sent.rows.filter((i) => Core.inviteState(i) !== "accepted").slice(0, 8);

    return h("div", null,
      h("div", { style: Object.assign({}, S.card, { display: "flex", alignItems: "center", gap: 12 }) },
        h("span", { style: { fontSize: 34 } }, (family && family.settings && family.settings.icon) || "🏠"),
        h("div", { style: { flex: 1 } }, h("div", { style: { fontFamily: SERIF, fontSize: 19 } }, family ? family.name : ""), h("div", { style: S.muted }, `${bn(fam.members.length)} জন সদস্য`)),
        h("button", { style: S.btn2, onClick: () => ctx.openSheet({ type: "settings" }) }, "⚙ সেটিংস")),
      vis.manage && h("button", { style: Object.assign({}, S.btn, { marginBottom: 12 }), onClick: () => ctx.openSheet({ type: "invite" }) }, "+ সদস্যকে Invite করুন"),
      fam.members.length <= 1 && h("div", { style: Object.assign({}, S.card, { borderColor: "var(--hk-gold)" }) }, h("div", { style: S.muted }, "আপনার পরিবারের সদস্যদের Invite করুন।")),
      h("div", { style: S.h2 }, "পরিবারের সদস্য"),
      fam.members.map((m) => {
        const showAmt = vis.totals || m.uid === uid;
        return h("button", { key: m.uid, onClick: () => ctx.openSheet({ type: "member", uid: m.uid }), style: Object.assign({}, S.card, { display: "flex", width: "100%", alignItems: "center", gap: 12, textAlign: "left", color: "var(--hk-text)", fontFamily: F, padding: "12px 14px", marginBottom: 8 }) },
          h(Avatar, { m }),
          h("span", { style: { flex: 1, minWidth: 0 } }, h("div", { style: { fontWeight: 700 } }, m.uid === uid ? `${m.name} (আপনি)` : m.name), h("div", { style: S.muted }, relLabel(m.relation === "self" ? "" : m.relation) || "")),
          h("span", { style: { textAlign: "right" } }, roleChip(m.role), h("div", { style: { fontSize: 12.5, marginTop: 3, fontWeight: 600 } }, showAmt ? taka(N.byMember[m.uid] || 0) : "🔒")));
      }),
      vis.manage && h("div", { style: { marginTop: 14 } },
        h("div", { style: S.h2 }, "পাঠানো Invitation"),
        sent.error ? h(ErrorBox, { msg: sent.error, onRetry: loadSent }) : sent.loading && !sent.rows.length ? h(Loading) : shown.length === 0 ? h("div", { style: S.muted }, "কোনো অপেক্ষমাণ Invitation নেই।") :
        shown.map((i) => h("button", { key: i.id, onClick: () => ctx.openSheet({ type: "invite-details", inv: i, incoming: false }), style: Object.assign({}, S.card, { display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", textAlign: "left", color: "var(--hk-text)", fontFamily: F, padding: "10px 14px", marginBottom: 8 }) },
          h("span", null, h("div", { style: { fontWeight: 600, fontSize: 14 } }, i.invitedEmail), h("div", { style: S.muted }, `${relLabel(i.relation)} • ${(Core.ROLES[i.role] || {}).label}`)),
          h("span", { style: S.pill("var(--hk-track)", "var(--hk-text-muted-2)") }, Core.INVITE_STATUS_LABEL[Core.inviteState(i)])))));
  }

  const CUSTOM_REL = "__custom";
  function RelationPicker({ value, onChange }) {
    const known = Core.INVITE_RELATIONS.some((r) => r.key === value) || value === "self";
    const [custom, setCustom] = useState(!known && !!value);
    return h("div", null,
      h("select", { style: S.input, value: custom ? CUSTOM_REL : value, onChange: (e) => { if (e.target.value === CUSTOM_REL) { setCustom(true); onChange(""); } else { setCustom(false); onChange(e.target.value); } } },
        Core.INVITE_RELATIONS.map((r) => h("option", { key: r.key, value: r.key }, r.label)),
        h("option", { value: CUSTOM_REL }, "অন্য সম্পর্ক (নিজে লিখুন)")),
      custom && h("input", { style: S.input, placeholder: "যেমন: চাচা", maxLength: 30, value: value, onChange: (e) => onChange(e.target.value) }));
  }

  function PermissionEditor({ actor, perms, onChange }) {
    return h("div", null, Core.PERMISSIONS.map((p) => {
      const on = !!perms[p.key];
      const locked = !on && !Core.isOwner(actor) && !Core.hasPerm(actor, p.key); // can't hand out what you lack
      return h(Toggle, { key: p.key, on, disabled: locked, label: p.label, hint: locked ? "আপনার নিজের এই অনুমতি নেই, তাই দিতে পারবেন না" : p.hint, onChange: (v) => onChange(Object.assign({}, perms, { [p.key]: v })) });
    }));
  }

  function MemberSheet({ ctx, uid: memberUid, close }) {
    const { fam, vis, uid } = ctx;
    const m = fam.members.find((x) => x.uid === memberUid);
    const self = memberUid === uid;
    const canEdit = m && Core.canEditMember(ctx.me, m);
    const [role, setRole] = useState(m ? m.role : "member");
    const [relation, setRelation] = useState(m ? (m.relation === "self" ? "" : m.relation) : "");
    const [perms, setPerms] = useState(m ? Core.normalizePermissions(m.permissions) : {});
    const [name, setName] = useState(m ? m.name : "");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const N = useNumbers(ctx);
    if (!m) return h(Sheet, { title: "সদস্য", onClose: close }, h(Empty, { icon: "👤", text: "সদস্যকে পাওয়া যায়নি।" }));
    const show = vis.totals || self;
    const week = show ? Core.periodTotals(N.docs.filter((d) => d.memberId === m.uid), N.t).thisWeek : null;
    const prev = show ? Core.memberMonthTotals(N.docs, N.pm)[m.uid] || 0 : null;
    const count = show ? N.docs.filter((d) => d.memberId === m.uid && d.month === N.cm).reduce((s, d) => s + (d.count || 0), 0) : null;
    const cats = (vis.categories || self) ? Core.categoryRows(fam.stats.cats.filter((d) => d.memberId === m.uid), N.cm, N.pm) : null;

    const run = async (fn, msg) => { if (busy) return; setBusy(true); setErr(""); try { await fn(); ctx.toast(msg); await ctx.reload(); close(); } catch (e) { setErr(friendlyError(e)); setBusy(false); } };
    const save = () => {
      if (!relation.trim() && !self) { setErr("সম্পর্ক লিখুন"); return; }
      run(() => window.FB.updateFamilyMember(ctx.familyId, m.uid, { role, permissions: Core.normalizePermissions(perms), relation: relation.trim() }), "সংরক্ষিত হয়েছে");
    };
    const changeRole = (r) => {
      setRole(r);
      const preset = Core.permissionPreset(r), next = {};
      Core.PERMISSION_KEYS.forEach((k) => (next[k] = preset[k] && (Core.isOwner(ctx.me) || Core.hasPerm(ctx.me, k))));
      setPerms(next);
    };

    return h(Sheet, { title: "সদস্যের প্রোফাইল", onClose: close },
      h("div", { style: Object.assign({}, S.card, { display: "flex", alignItems: "center", gap: 14 }) },
        h(Avatar, { m, size: 54 }),
        h("div", { style: { flex: 1, minWidth: 0 } }, h("div", { style: { fontWeight: 700, fontSize: 17 } }, m.name), h("div", { style: Object.assign({}, S.muted, { wordBreak: "break-all" }) }, m.email), h("div", { style: { marginTop: 4 } }, roleChip(m.role), " ", h("span", { style: S.muted }, relLabel(m.relation === "self" ? "" : m.relation))))),
      h("div", { style: S.card },
        h("div", { style: S.h2 }, "এই মাসের হিসাব"),
        show ? h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } },
          [["এই মাস", taka(N.byMember[m.uid] || 0)], ["গত মাস", taka(prev)], ["এই সপ্তাহ", taka(week)], ["বাজারের সংখ্যা", `${bn(count)}টি`]].map(([l, v]) => h("div", { key: l }, h("div", { style: S.muted }, l), h("div", { style: { fontFamily: SERIF, fontSize: 19 } }, v)))) :
          h("div", { style: S.muted }, "🔒 এই সদস্যের মোট খরচ দেখার অনুমতি আপনার নেই।")),
      (vis.categories || self) && h("div", { style: S.card }, h("div", { style: S.h2 }, "ক্যাটাগরি অনুযায়ী (এই মাস)"),
        cats && cats.length ? cats.map((c) => h("div", { key: c.id, style: Object.assign({}, S.row, { padding: "4px 0" }) }, h("span", null, c.name), h("b", null, `${taka(c.total)} • ${bn(c.pct)}%`))) : h("div", { style: S.muted }, "এই মাসে কোনো খরচ নেই।")),
      !vis.details && !self && h("div", { style: Object.assign({}, S.muted, { marginBottom: 12 }) }, "🔒 প্রতিটি কেনাকাটার বিস্তারিত দেখার অনুমতি নেই।"),
      self && h("div", { style: S.card }, h("label", { style: S.label }, "আমার নাম"), h("input", { style: S.input, value: name, maxLength: 40, onChange: (e) => setName(e.target.value) }),
        h("button", { style: S.btn2, disabled: busy || !name.trim(), onClick: () => run(() => window.FB.updateFamilyMember(ctx.familyId, uid, { name: name.trim() }), "নাম বদলানো হয়েছে") }, "নাম সংরক্ষণ")),
      canEdit && h("div", null,
        h("div", { style: S.h2 }, "সম্পর্ক ও ভূমিকা"),
        h("div", { style: S.card },
          h("label", { style: S.label }, "সম্পর্ক"), h(RelationPicker, { value: relation, onChange: setRelation }),
          h("label", { style: S.label }, "ভূমিকা"),
          h("select", { style: S.input, value: role, onChange: (e) => changeRole(e.target.value) }, Core.assignableRoles(ctx.me).map((r) => h("option", { key: r, value: r }, `${Core.ROLES[r].label} — ${Core.ROLES[r].hint}`)))),
        h("div", { style: S.h2 }, "কী কী দেখতে পারবেন (Permissions)"),
        h("div", { style: S.card }, h(PermissionEditor, { actor: ctx.me, perms, onChange: setPerms }),
          h("div", { style: Object.assign({}, S.muted, { marginTop: 8 }) }, "এই অনুমতিগুলো Firestore-এর নিয়মে সার্ভারেও আটকানো — শুধু অ্যাপে লুকানো নয়।")),
        err && h(ErrorBox, { msg: err }),
        h("button", { style: Object.assign({}, S.btn, { marginBottom: 10 }), disabled: busy, onClick: save }, busy ? "সংরক্ষণ হচ্ছে…" : "পরিবর্তন সংরক্ষণ"),
        h("button", { style: Object.assign({}, S.danger, { width: "100%" }), disabled: busy, onClick: () => { if (window.confirm(`${m.name}-কে পরিবার থেকে সরিয়ে দেবেন? তার আগের কেনাকাটা থেকে যাবে।`)) run(() => window.FB.removeFamilyMember(ctx.familyId, m.uid), "সদস্যকে সরানো হয়েছে"); } }, "পরিবার থেকে সরান")),
      !canEdit && err && h(ErrorBox, { msg: err }));
  }

  function InviteSheet({ ctx, close }) {
    const { me, fam } = ctx;
    const roles = Core.assignableRoles(me);
    const [email, setEmail] = useState("");
    const [relation, setRelation] = useState("brother");
    const [role, setRole] = useState("member");
    const [perms, setPerms] = useState(() => { const p = Core.permissionPreset("member"), o = {}; Core.PERMISSION_KEYS.forEach((k) => (o[k] = p[k] && (Core.isOwner(me) || Core.hasPerm(me, k)))); return o; });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [done, setDone] = useState(null);
    const changeRole = (r) => { setRole(r); const p = Core.permissionPreset(r), o = {}; Core.PERMISSION_KEYS.forEach((k) => (o[k] = p[k] && (Core.isOwner(me) || Core.hasPerm(me, k)))); setPerms(o); };
    const submit = async () => {
      if (busy) return;
      const e = email.trim().toLowerCase();
      if (!Core.isValidEmail(e)) { setErr("সঠিক Gmail / ইমেইল ঠিকানা লিখুন"); return; }
      if (!relation.trim()) { setErr("সম্পর্ক বেছে নিন"); return; }
      if (fam.members.some((m) => (m.email || "").toLowerCase() === e)) { setErr("এই ইমেইলের সদস্য আগে থেকেই পরিবারে আছেন"); return; }
      setBusy(true); setErr("");
      try {
        const existing = await window.FB.familySentInvitations(ctx.familyId);
        if (existing.some((i) => i.invitedEmail === e && Core.inviteState(i) === "pending")) { setErr("এই ইমেইলে আগেই একটি Invitation পাঠানো আছে"); setBusy(false); return; }
        await window.FB.sendInvitation({ familyId: ctx.familyId, familyName: ctx.family.name, invitedEmail: e, relation: relation.trim(), role, permissions: Core.normalizePermissions(perms) });
        ctx.bumpInvites();
        setDone(e);
      } catch (x) { setErr(friendlyError(x)); }
      setBusy(false);
    };
    const link = window.location.origin + window.location.pathname;
    if (done) return h(Sheet, { title: "Invitation পাঠানো হয়েছে", onClose: close },
      h(Empty, { icon: "✅", title: done, text: "এই Gmail দিয়ে Google Sign In করে অ্যাপ খুললেই Invitation দেখা যাবে। আলাদা ইমেইল স্বয়ংক্রিয়ভাবে যায় না — তাই তাকে অ্যাপের লিংকটা পাঠিয়ে দিন।" }),
      navigator.share && h("button", { style: Object.assign({}, S.btn, { marginBottom: 10 }), onClick: () => navigator.share({ title: "হিসাব-খাতা — ফ্যামিলি বাজার", text: `${ctx.family.name}-এ যোগ দিতে ${done} দিয়ে Google Sign In করুন`, url: link }).catch(() => {}) }, "লিংক শেয়ার করুন"),
      h("button", { style: Object.assign({}, S.btn2, { width: "100%" }), onClick: close }, "ঠিক আছে"));

    return h(Sheet, { title: "সদস্যকে Invite করুন", onClose: close, footer: h("div", null, err && h("div", { style: { color: "var(--hk-danger)", fontSize: 13, marginBottom: 8 } }, err), h("button", { style: S.btn, disabled: busy, onClick: submit }, busy ? "পাঠানো হচ্ছে…" : "Invitation পাঠান")) },
      h("label", { style: S.label }, "Gmail / Google ইমেইল *"),
      h("input", { style: S.input, type: "email", inputMode: "email", autoCapitalize: "none", placeholder: "abbu@gmail.com", value: email, onChange: (e) => setEmail(e.target.value) }),
      h("label", { style: S.label }, "সম্পর্ক"), h(RelationPicker, { value: relation, onChange: setRelation }),
      h("label", { style: S.label }, "ভূমিকা"),
      h("select", { style: S.input, value: role, onChange: (e) => changeRole(e.target.value) }, roles.map((r) => h("option", { key: r, value: r }, `${Core.ROLES[r].label} — ${Core.ROLES[r].hint}`))),
      h("div", { style: S.h2 }, "কী কী দেখতে পারবেন"),
      h("div", { style: S.card }, h(PermissionEditor, { actor: me, perms, onChange: setPerms }),
        h("div", { style: Object.assign({}, S.muted, { marginTop: 8 }) }, "Invitation গ্রহণের আগে পরিবারের কোনো তথ্যই দেখা যায় না। গোপনীয়তার জন্য বিস্তারিত কেনাকাটা দেখার অনুমতি ডিফল্টে বন্ধ।")));
  }

  function SettingsSheet({ ctx, close }) {
    const { family, vis } = ctx;
    const [name, setName] = useState(family.name);
    const [icon, setIcon] = useState((family.settings && family.settings.icon) || "🏠");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [confirmName, setConfirmName] = useState("");
    const run = async (fn, msg, after) => { if (busy) return; setBusy(true); setErr(""); try { await fn(); if (msg) ctx.toast(msg); if (after) await after(); } catch (e) { setErr(friendlyError(e)); } setBusy(false); };
    return h(Sheet, { title: "পরিবারের সেটিংস", onClose: close },
      vis.admin ? h("div", { style: S.card },
        h("label", { style: S.label }, "পরিবারের নাম"), h("input", { style: S.input, value: name, maxLength: 60, onChange: (e) => setName(e.target.value) }),
        h("label", { style: S.label }, "আইকন"), h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 } }, FAMILY_ICONS.map((ic) => h("button", { key: ic, onClick: () => setIcon(ic), style: Object.assign({}, S.chip(icon === ic), { fontSize: 22 }) }, ic))),
        h("button", { style: S.btn, disabled: busy || !name.trim(), onClick: () => run(() => window.FB.updateFamily(ctx.familyId, { name: name.trim(), settings: Object.assign({}, family.settings || {}, { icon }) }), "সংরক্ষিত হয়েছে", async () => { await ctx.loadTop(); close(); }) }, "সংরক্ষণ")) :
        h("div", { style: S.card }, h("div", { style: { fontWeight: 700 } }, family.name), h("div", { style: S.muted }, "নাম ও আইকন শুধু মালিক/এডমিন বদলাতে পারেন।")),
      h("div", { style: S.card },
        h("div", { style: S.h2 }, "মেরামত"),
        h("div", { style: Object.assign({}, S.muted, { marginBottom: 10 }) }, "কোনো কারণে আপনার মাসিক মোট খরচ ভুল দেখালে আপনার নিজের কেনাকাটা থেকে নতুন করে গণনা করুন।"),
        h("button", { style: S.btn2, disabled: busy, onClick: () => run(async () => { const n = await window.FB.rebuildMyStats(ctx.familyId); ctx.toast(`${bn(n)} মাসের হিসাব নতুন করে গণনা হয়েছে`); }, "", () => ctx.reload()) }, "আমার হিসাব নতুন করে গণনা করুন")),
      err && h(ErrorBox, { msg: err }),
      !vis.owner && h("button", { style: Object.assign({}, S.danger, { width: "100%" }), disabled: busy, onClick: () => { if (window.confirm(`"${family.name}" পরিবার ছেড়ে যাবেন?`)) run(() => window.FB.removeFamilyMember(ctx.familyId, ctx.uid), "পরিবার ছেড়েছেন", async () => { await ctx.loadTop(); close(); }); } }, "এই পরিবার ছেড়ে যান"),
      vis.owner && h("div", { style: Object.assign({}, S.card, { borderColor: "var(--hk-danger)" }) },
        h("div", { style: { color: "var(--hk-danger)", fontWeight: 700, marginBottom: 6 } }, "পরিবার মুছে ফেলুন"),
        h("div", { style: Object.assign({}, S.muted, { marginBottom: 8 }) }, "সব সদস্য, কেনাকাটা ও দামের তথ্য স্থায়ীভাবে মুছে যাবে। নিশ্চিত করতে পরিবারের নাম লিখুন।"),
        h("input", { style: S.input, placeholder: family.name, value: confirmName, onChange: (e) => setConfirmName(e.target.value) }),
        h("button", { style: Object.assign({}, S.danger, { width: "100%" }), disabled: busy || confirmName.trim() !== family.name, onClick: () => run(() => window.FB.deleteFamily(ctx.familyId), "পরিবার মুছে ফেলা হয়েছে", async () => { await ctx.loadTop(); close(); }) }, busy ? "মোছা হচ্ছে…" : "স্থায়ীভাবে মুছুন")));
  }

  /* ------------------------------------------------------------------ *
   * PRODUCT DETAILS + PRICE HISTORY + LOCATION COMPARISON
   * ------------------------------------------------------------------ */
  const shortDate = (ymd) => `${bn(Number(String(ymd).slice(8, 10)))}/${bn(Number(String(ymd).slice(5, 7)))}`;

  function ProductSheet({ ctx, productId, name, close }) {
    const { vis, familyId, fam } = ctx;
    const pid = productId || Core.productIdFor(name);
    const product = fam.products.find((p) => p.id === pid) || null;
    const title = (product && product.name) || name || "পণ্য";
    const [st, setSt] = useState({ loading: true, error: "", rows: [], locs: [] });
    const [range, setRange] = useState("30");
    const [newName, setNewName] = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const load = useCallback(async () => {
      setSt((s) => Object.assign({}, s, { loading: true, error: "" }));
      try {
        const [rows, locs] = await Promise.all([
          window.FB.priceRows(familyId, { productId: pid, seeAll: vis.prices, max: 300 }),
          safe(window.FB.locationRows(familyId, { productId: pid, seeAll: vis.locations, max: 100 }), []),
        ]);
        setSt({ loading: false, error: "", rows, locs });
      } catch (e) { setSt({ loading: false, error: friendlyError(e), rows: [], locs: [] }); }
    }, [familyId, pid, vis.prices, vis.locations]);
    useEffect(() => { load(); }, [load]);

    const A = useMemo(() => (st.rows.length ? Core.analyzePrices(st.rows, today()) : null), [st.rows]);
    const places = useMemo(() => Core.locationComparison(st.locs), [st.locs]);
    const memberName = (id) => { const m = fam.members.find((x) => x.uid === id); return m ? (id === ctx.uid ? "আপনি" : m.name) : "সদস্য"; };
    const series = A ? (range === "7" ? A.series7 : range === "30" ? A.series30 : A.seriesAll) : [];
    const points = (series || []).map((r) => ({ y: r.price, label: shortDate(r.date) }));
    const hist = useMemo(() => Core.sortPriceRows(st.rows).slice().reverse().slice(0, 25), [st.rows]);
    const cheapest = places.length ? Math.min(...places.map((p) => p.price)) : null;
    const run = async (fn, msg) => { if (busy) return; setBusy(true); setErr(""); try { await fn(); ctx.toast(msg); await ctx.reload(); close(); } catch (e) { setErr(friendlyError(e)); setBusy(false); } };

    const cmp = A ? [
      ["এখনকার দাম", A.latest && A.latest.price], ["আগের বার", A.previous && A.previous.price],
      ["৭ দিন আগে", A.price7dAgo], ["৩০ দিন আগে", A.price30dAgo],
      ["গত মাসের গড়", A.prevMonthAvg], ["এই মাসের গড়", A.curMonthAvg],
    ].filter((r) => r[1] != null) : [];

    return h(Sheet, { title, onClose: close },
      !vis.prices && h("div", { style: Object.assign({}, S.card, { padding: "10px 14px" }) }, h("div", { style: S.muted }, "🔒 অন্যদের কেনা দাম দেখার অনুমতি নেই — শুধু আপনার নিজের কেনা দাম দেখাচ্ছে।")),
      st.loading ? h(Loading) : st.error ? h(ErrorBox, { msg: st.error, onRetry: load }) :
      !A ? h(Empty, { icon: "🏷️", title: "দামের তথ্য নেই", text: "এই পণ্যের কোনো দাম এখনো জমা হয়নি। দাম সহ বাজার যোগ করলে এখানে ইতিহাস দেখা যাবে।" }) :
      h("div", null,
        h("div", { style: S.hero },
          h("div", { style: { fontSize: 13, opacity: 0.85 } }, `সর্বশেষ দাম • ${dateBn(A.latest.date)} • ${memberName(A.latest.memberId)}`),
          h("div", { style: Object.assign({}, S.big, { margin: "4px 0" }) }, `${money(A.latest.price)}/${unitText(A.unit)}`),
          h("div", { style: { fontSize: 13 } },
            A.change30 != null ? `৩০ দিনে ${A.change30 > 0 ? "+" : A.change30 < 0 ? "−" : ""}${money(Math.abs(A.change30))}` : "৩০ দিনের তুলনার তথ্য নেই",
            A.previous ? ` • আগের বার ${money(A.previous.price)}` : "")),
        A.otherUnitCount > 0 && h("div", { style: Object.assign({}, S.muted, { marginBottom: 10 }) }, `ℹ️ ${bn(A.otherUnitCount)}টি দাম অন্য ইউনিটে কেনা, তাই তুলনায় ধরা হয়নি।`),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 } },
          [["গড়", A.avg], ["সবচেয়ে কম", A.min], ["সবচেয়ে বেশি", A.max]].map(([l, v]) => h("div", { key: l, style: Object.assign({}, S.card, { marginBottom: 0, padding: "10px 8px", textAlign: "center" }) }, h("div", { style: S.muted }, l), h("div", { style: { fontFamily: SERIF, fontSize: 17 } }, money(v))))),
        h("div", { style: S.card },
          h("div", { style: S.row }, h("div", { style: S.h2 }, "দামের ওঠানামা"),
            h("div", { style: { display: "flex", gap: 6 } }, [["7", "৭ দিন"], ["30", "৩০ দিন"], ["all", "সব"]].map(([k, l]) => h("button", { key: k, style: Object.assign({}, S.chip(range === k), { padding: "4px 10px", minHeight: 30 }), onClick: () => setRange(k) }, l)))),
          h(LineChart, { points }),
          h("div", { style: Object.assign({}, S.muted, { marginTop: 8 }) }, "এটি শুধু আগের কেনা দামের ইতিহাস। ভবিষ্যতের দামের নিশ্চিত পূর্বাভাস নয়।")),
        cmp.length > 0 && h("div", { style: S.card }, h("div", { style: S.h2 }, "দামের তুলনা"),
          cmp.map(([l, v]) => h("div", { key: l, style: Object.assign({}, S.row, { padding: "7px 0", borderBottom: "1px solid var(--hk-border-light)", fontSize: 14 }) }, h("span", { style: { color: "var(--hk-text-muted-2)" } }, l), h("b", null, `${money(v)}/${unitText(A.unit)}`)))),
        h("div", { style: S.card }, h("div", { style: S.h2 }, "কেনার ইতিহাস"),
          hist.map((r) => h("div", { key: r.id, style: Object.assign({}, S.row, { padding: "7px 0", borderBottom: "1px solid var(--hk-border-light)", fontSize: 13.5 }) },
            h("span", null, dateBn(r.date), h("span", { style: S.muted }, ` • ${memberName(r.memberId)}`)), h("b", null, `${money(r.price)}/${unitText(r.unit)}`))))),
      !st.loading && !st.error && h("div", { style: S.card },
        h("div", { style: S.h2 }, "বাজার/এলাকা অনুযায়ী দাম"),
        !vis.locations && places.length === 0 ? h("div", { style: S.muted }, "🔒 অন্য সদস্যদের এলাকাভিত্তিক দাম দেখার অনুমতি নেই।") :
        places.length === 0 ? h("div", { style: S.muted }, "এলাকা লিখে বাজার যোগ করলে এখানে এলাকাভেদে দাম তুলনা করা যাবে।") :
        places.map((p) => h("div", { key: p.id || p.location + p.unit, style: { padding: "8px 0", borderBottom: "1px solid var(--hk-border-light)" } },
          h("div", { style: S.row }, h("span", { style: { fontWeight: 600 } }, p.location, p.price === cheapest && places.length > 1 ? h("span", { style: Object.assign({}, S.pill("var(--hk-success-mid)", "#fff"), { marginLeft: 8 }) }, "সবচেয়ে কম") : null), h("b", null, `${money(p.price)}/${unitText(p.unit)}`)),
          h("div", { style: S.muted }, [p.market, dateBn(p.date), p.memberId ? memberName(p.memberId) : ""].filter(Boolean).join(" • "))))),
      err && h(ErrorBox, { msg: err }),
      product && vis.admin && h("div", { style: S.card },
        h("div", { style: S.h2 }, "পণ্য ব্যবস্থাপনা"),
        newName === null ? h("div", { style: { display: "flex", gap: 8 } },
          h("button", { style: S.btn2, onClick: () => setNewName(product.name) }, "নাম বদলান"),
          h("button", { style: S.danger, disabled: busy, onClick: () => { if (window.confirm("পণ্যটি তালিকা থেকে সরানো হবে। আগের কেনাকাটা ও দামের ইতিহাস অক্ষত থাকবে।")) run(() => window.FB.setProductArchived(familyId, pid, true), "পণ্যটি সরানো হয়েছে"); } }, "তালিকা থেকে সরান")) :
        h("div", null,
          h("input", { style: S.input, value: newName, maxLength: 80, onChange: (e) => setNewName(e.target.value) }),
          h("div", { style: { display: "flex", gap: 8 } },
            h("button", { style: S.btn, disabled: busy || !newName.trim() || newName.trim() === product.name, onClick: () => run(() => window.FB.renameProduct(familyId, pid, product.name, newName.trim()), "নাম বদলানো হয়েছে") }, "সংরক্ষণ"),
            h("button", { style: S.btn2, onClick: () => setNewName(null) }, "বাতিল")),
          h("div", { style: Object.assign({}, S.muted, { marginTop: 8 }) }, "আগের কেনাকাটায় পুরনো নামই থাকবে, ইতিহাস ভাঙবে না।"))));
  }

  /* ------------------------------------------------------------------ *
   * PRODUCT LIST · CATEGORIES · SEARCH
   * ------------------------------------------------------------------ */
  function ProductsView({ ctx }) {
    const [q, setQ] = useState("");
    const [cat, setCat] = useState("all");
    const cats = Core.allCategories(ctx.fam.categories);
    const list = ctx.fam.products.filter((p) => !p.archived && (!q.trim() || Core.matches(p.name, q) || (p.aliases || []).some((a) => Core.matches(a, q))) && (cat === "all" || p.categoryId === cat))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "bn"));
    return h("div", null,
      h("input", { style: S.input, placeholder: "পণ্য খুঁজুন…", value: q, onChange: (e) => setQ(e.target.value) }),
      h("div", { style: { display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 2 } },
        [{ id: "all", name: "সব", icon: "" }].concat(cats).map((c) => h("button", { key: c.id, style: Object.assign({}, S.chip(cat === c.id), { whiteSpace: "nowrap" }), onClick: () => setCat(c.id) }, `${c.icon || ""} ${c.name}`.trim()))),
      ctx.fam.products.length === 0 ? h(Empty, { icon: "📦", title: "এখনো কোনো পণ্য নেই", text: "বাজার যোগ করলে পণ্য এখানে নিজে থেকেই জমা হবে।", action: ctx.vis.write ? "+ বাজার যোগ করুন" : null, onAction: () => ctx.openSheet({ type: "purchase" }) }) :
      list.length === 0 ? h("div", { style: S.muted }, "কোনো পণ্য মেলেনি।") :
      list.map((p) => { const c = Core.categoryById(p.categoryId, ctx.fam.categories); return h("button", { key: p.id, onClick: () => ctx.openSheet({ type: "product", productId: p.id, name: p.name }), style: Object.assign({}, S.card, { display: "flex", width: "100%", alignItems: "center", gap: 12, textAlign: "left", color: "var(--hk-text)", fontFamily: F, padding: "11px 14px", marginBottom: 8 }) },
        h("span", { style: { fontSize: 22 } }, (c && c.icon) || "📦"),
        h("span", { style: { flex: 1 } }, h("div", { style: { fontWeight: 600 } }, p.name), h("div", { style: S.muted }, (c && c.name) || p.category || "")),
        h("span", { style: S.muted }, p.defaultUnit ? unitText(p.defaultUnit) : "›")); }));
  }

  function CategoriesView({ ctx }) {
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const custom = ctx.fam.categories;
    const run = async (fn, msg) => { if (busy) return; setBusy(true); setErr(""); try { await fn(); ctx.toast(msg); setEditing(null); await ctx.reload(); } catch (e) { setErr(friendlyError(e)); } setBusy(false); };
    const save = () => {
      const n = (editing.name || "").trim();
      if (!n) { setErr("ক্যাটাগরির নাম লিখুন"); return; }
      if (Core.allCategories(custom).some((c) => c.id !== editing.id && Core.nameKey(c.name) === Core.nameKey(n))) { setErr("এই নামে ক্যাটাগরি আগেই আছে"); return; }
      run(() => editing.id ? window.FB.updateFamilyCategory(ctx.familyId, editing.id, { name: n, icon: editing.icon }) : window.FB.addFamilyCategory(ctx.familyId, { name: n, icon: editing.icon, group: editing.group }), "সংরক্ষিত হয়েছে");
    };
    const rowFor = (c, isCustom) => h("div", { key: c.id, style: Object.assign({}, S.row, { padding: "9px 0", borderBottom: "1px solid var(--hk-border-light)" }) },
      h("span", null, `${c.icon || "🏷️"}  ${c.name}`),
      isCustom && ctx.vis.admin && h("span", { style: { display: "flex", gap: 6 } },
        h("button", { style: Object.assign({}, S.btn2, { minHeight: 34, padding: "4px 10px" }), onClick: () => { setErr(""); setEditing({ id: c.id, name: c.name, icon: c.icon, group: c.group }); } }, "বদলান"),
        h("button", { style: Object.assign({}, S.danger, { minHeight: 34, padding: "4px 10px" }), disabled: busy, onClick: () => { if (window.confirm(`"${c.name}" ক্যাটাগরি মুছবেন? আগের কেনাকাটায় নামটি থেকে যাবে।`)) run(() => window.FB.deleteFamilyCategory(ctx.familyId, c.id), "মুছে ফেলা হয়েছে"); } }, "মুছুন")));
    return h("div", null,
      ctx.vis.admin && !editing && h("button", { style: Object.assign({}, S.btn, { marginBottom: 12 }), onClick: () => { setErr(""); setEditing({ id: null, name: "", icon: "🏷️", group: "grocery" }); } }, "+ নতুন ক্যাটাগরি"),
      editing && h("div", { style: S.card },
        h("label", { style: S.label }, "নাম"), h("input", { style: S.input, value: editing.name, maxLength: 40, autoFocus: true, onChange: (e) => setEditing(Object.assign({}, editing, { name: e.target.value })) }),
        h("label", { style: S.label }, "আইকন (ইমোজি)"), h("input", { style: S.input, value: editing.icon || "", maxLength: 4, onChange: (e) => setEditing(Object.assign({}, editing, { icon: e.target.value })) }),
        !editing.id && h("div", { style: { display: "flex", gap: 6, marginBottom: 12 } }, (Core.CATEGORY_GROUPS || []).map((g) => h("button", { key: g.key, style: S.chip(editing.group === g.key), onClick: () => setEditing(Object.assign({}, editing, { group: g.key })) }, g.label))),
        err && h("div", { style: { color: "var(--hk-danger)", fontSize: 13, marginBottom: 8 } }, err),
        h("div", { style: { display: "flex", gap: 8 } }, h("button", { style: S.btn, disabled: busy, onClick: save }, "সংরক্ষণ"), h("button", { style: S.btn2, onClick: () => setEditing(null) }, "বাতিল"))),
      !editing && err && h(ErrorBox, { msg: err }),
      custom.length > 0 && h("div", { style: S.card }, h("div", { style: S.h2 }, "আপনাদের ক্যাটাগরি"), custom.map((c) => rowFor(c, true))),
      (Core.CATEGORY_GROUPS || []).map((g) => h("div", { key: g.key, style: S.card }, h("div", { style: S.h2 }, g.label), Core.DEFAULT_CATEGORIES.filter((c) => c.group === g.key).map((c) => rowFor(c, false)))),
      !ctx.vis.admin && h("div", { style: S.muted }, "নতুন ক্যাটাগরি শুধু মালিক ও এডমিন যোগ করতে পারেন।"));
  }

  function SearchView({ ctx }) {
    const { vis, familyId, fam } = ctx;
    const [q, setQ] = useState("");
    const [dq, setDq] = useState("");
    const [places, setPlaces] = useState(null);
    const [priceMap, setPriceMap] = useState({});
    useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 250); return () => clearTimeout(t); }, [q]);
    useEffect(() => { if (dq && places === null) safe(window.FB.locationRows(familyId, { seeAll: vis.locations, max: 300 }), []).then(setPlaces); }, [dq]);

    const cats = Core.allCategories(fam.categories);
    const prods = useMemo(() => (dq ? fam.products.filter((p) => !p.archived && (Core.matches(p.name, dq) || (p.aliases || []).some((a) => Core.matches(a, dq)) || Core.matches((Core.categoryById(p.categoryId, fam.categories) || {}).name || "", dq))).slice(0, 12) : []), [dq, fam.products]);
    const catHits = dq ? cats.filter((c) => Core.matches(c.name, dq)) : [];
    const memHits = dq ? fam.members.filter((m) => Core.matches(m.name, dq) || Core.matches(relLabel(m.relation), dq)) : [];
    const placeHits = useMemo(() => (dq && places ? places.filter((l) => Core.matches(l.location, dq) || Core.matches(l.market || "", dq)) : []), [dq, places]);
    const placeGroups = useMemo(() => { const g = {}; placeHits.forEach((l) => { const k = `${l.location}|${l.market || ""}`; (g[k] = g[k] || { location: l.location, market: l.market, rows: [] }).rows.push(l); }); return Object.values(g).slice(0, 6); }, [placeHits]);
    const top = prods.slice(0, 3);
    useEffect(() => {
      top.forEach((p) => {
        if (priceMap[p.id]) return;
        setPriceMap((m) => Object.assign({}, m, { [p.id]: "loading" }));
        safe(window.FB.priceRows(familyId, { productId: p.id, seeAll: vis.prices, max: 100 }), []).then((rows) => setPriceMap((m) => Object.assign({}, m, { [p.id]: rows })));
      });
    }, [prods]);

    const who = (id) => { const m = fam.members.find((x) => x.uid === id); return m ? (id === ctx.uid ? "আপনি" : m.name) : ""; };
    const catRows = useMemo(() => (vis.categories && catHits.length ? Core.categoryRows(fam.stats.cats, Core.monthOf(today()), Core.addMonths(Core.monthOf(today()), -1)) : []), [catHits.length, fam.stats.cats]);
    const none = dq && !prods.length && !catHits.length && !memHits.length && !placeGroups.length && places !== null;

    return h("div", null,
      h("input", { style: S.input, placeholder: "পণ্য, ক্যাটাগরি, সদস্য, বাজার বা এলাকা…", value: q, autoFocus: true, onChange: (e) => setQ(e.target.value) }),
      !dq && h("div", { style: S.muted }, "যেমন লিখুন: চাল, তেল, রংপুর…"),
      prods.length > 0 && h("div", { style: S.card }, h("div", { style: S.h2 }, "পণ্য"),
        prods.map((p, i) => {
          const rows = priceMap[p.id];
          const A = Array.isArray(rows) && rows.length ? Core.analyzePrices(rows, today()) : null;
          const place = A && (places || []).filter((l) => l.productId === p.id).sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
          return h("button", { key: p.id, onClick: () => ctx.openSheet({ type: "product", productId: p.id, name: p.name }), style: { display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--hk-border-light)", padding: "10px 0", color: "var(--hk-text)", fontFamily: F } },
            h("div", { style: S.row }, h("b", null, p.name), A ? h("b", null, `${money(A.latest.price)}/${unitText(A.unit)}`) : h("span", { style: S.muted }, i < 3 && rows === "loading" ? "…" : "›")),
            A && h("div", { style: S.muted }, [A.previous ? `আগের বার ${money(A.previous.price)}` : null, who(A.latest.memberId) ? `কিনেছেন ${who(A.latest.memberId)}` : null, place ? `📍 ${place.location}` : null, `${bn(A.count)}বার কেনা`].filter(Boolean).join(" • ")));
        })),
      catHits.length > 0 && h("div", { style: S.card }, h("div", { style: S.h2 }, "ক্যাটাগরি"),
        catHits.map((c) => { const r = catRows.find((x) => x.id === c.id); return h("div", { key: c.id, style: Object.assign({}, S.row, { padding: "7px 0" }) }, h("span", null, `${c.icon || ""} ${c.name}`), vis.categories ? h("b", null, r ? taka(r.total) : taka(0)) : h("span", { style: S.muted }, "🔒")); })),
      memHits.length > 0 && h("div", { style: S.card }, h("div", { style: S.h2 }, "সদস্য"),
        memHits.map((m) => h("button", { key: m.uid, onClick: () => ctx.openSheet({ type: "member", uid: m.uid }), style: { display: "flex", width: "100%", alignItems: "center", gap: 10, background: "none", border: "none", padding: "7px 0", color: "var(--hk-text)", fontFamily: F, textAlign: "left" } }, h(Avatar, { m, size: 30 }), h("span", { style: { flex: 1 } }, m.name), roleChip(m.role)))),
      placeGroups.length > 0 && h("div", { style: S.card }, h("div", { style: S.h2 }, "বাজার / এলাকা"),
        placeGroups.map((g) => h("div", { key: g.location + g.market, style: { padding: "8px 0", borderBottom: "1px solid var(--hk-border-light)" } },
          h("div", { style: { fontWeight: 600 } }, `📍 ${g.location}${g.market ? " • " + g.market : ""}`),
          g.rows.slice(0, 5).map((r) => h("button", { key: r.id, onClick: () => ctx.openSheet({ type: "product", productId: r.productId, name: r.productName }), style: Object.assign({}, S.row, { width: "100%", background: "none", border: "none", padding: "4px 0", color: "var(--hk-text)", fontFamily: F, fontSize: 13.5 }) }, h("span", null, r.productName), h("span", null, `${money(r.price)}/${unitText(r.unit)}`)))))),
      dq && !vis.locations && places !== null && placeGroups.length === 0 && h("div", { style: S.muted }, "🔒 বাজার/এলাকা খোঁজায় শুধু আপনার নিজের তথ্য ধরা হয়েছে।"),
      none && h(Empty, { icon: "🔎", title: "কিছু পাওয়া যায়নি", text: `"${dq}" নামে কোনো পণ্য, সদস্য বা এলাকা মেলেনি।` }));
  }

  /* ------------------------------------------------------------------ *
   * MORE
   * ------------------------------------------------------------------ */
  const MORE_TITLES = { products: "পণ্য তালিকা", categories: "ক্যাটাগরি", search: "খুঁজুন", budget: "মাসিক বাজেট" };
  function MoreTab({ ctx, view, setView }) {
    if (view) return h("div", null,
      h("button", { onClick: () => setView(null), style: { background: "none", border: "none", color: "var(--hk-gold)", fontFamily: F, fontWeight: 600, fontSize: 14, minHeight: 40, padding: "0 4px 6px" } }, "‹ আরও"),
      h("div", { style: Object.assign({}, S.h2, { fontSize: 19, marginTop: 0 }) }, MORE_TITLES[view]),
      view === "products" ? h(ProductsView, { ctx }) : view === "categories" ? h(CategoriesView, { ctx }) : view === "search" ? h(SearchView, { ctx }) : h(BudgetView, { ctx }));
    const myPending = Core.pendingShoppingCount(ctx.fam.shoppingLists, ctx.uid);
    const items = [
      ["🔎", "খুঁজুন", "পণ্য, সদস্য, বাজার বা এলাকা", () => setView("search")],
      ["📝", "বাজারের তালিকা", "কী কিনতে হবে, রিমাইন্ডার সহ", () => ctx.openSheet({ type: "shopping" }), myPending],
      ["📦", "পণ্য তালিকা", "সব পণ্য ও তাদের দামের ইতিহাস", () => setView("products")],
      ["🏷️", "ক্যাটাগরি", "গ্রোসারি ও গৃহস্থালির ক্যাটাগরি", () => setView("categories")],
      ["💰", "মাসিক বাজেট", "সীমা ঠিক করুন, সতর্কতা দেখুন", () => setView("budget")],
      ["⚙️", "পরিবারের সেটিংস", "নাম, আইকন, মেরামত, পরিবার ছাড়া", () => ctx.openSheet({ type: "settings" })],
      ["🔁", "পরিবার বদলান", `${ctx.families.length}টি পরিবার`, () => ctx.openSheet({ type: "switcher" })],
    ];
    return h("div", null, items.map(([ic, t, sub, fn, badge]) => h("button", { key: t, onClick: fn, style: Object.assign({}, S.card, { display: "flex", width: "100%", alignItems: "center", gap: 14, textAlign: "left", color: "var(--hk-text)", fontFamily: F, padding: "13px 16px", marginBottom: 8 }) },
      h("span", { style: { fontSize: 24 } }, ic), h("span", { style: { flex: 1 } }, h("div", { style: { fontWeight: 700 } }, t), h("div", { style: S.muted }, sub)),
      badge > 0 ? h("span", { style: S.pill("var(--hk-gold)", "#1a1a1a") }, bn(badge)) : h("span", { style: S.muted }, "›"))));
  }

  /* ------------------------------------------------------------------ *
   * MODULE SHELL
   *   mode "full"     — opened from the ☰ menu: own full-screen frame + bottom nav
   *   mode "embedded" — the Family tab: sits inside the app page, nav on top
   * ------------------------------------------------------------------ */
  const TABS = [["home", "🏠", "হোম"], ["bazar", "🛒", "বাজার"], ["reports", "📊", "রিপোর্ট"], ["family", "👥", "পরিবার"], ["more", "⚙️", "আরও"]];

  function useToast() {
    const [t, setT] = useState(null);
    const timer = useRef(null);
    const show = useCallback((msg) => { setT({ msg, k: Date.now() }); clearTimeout(timer.current); timer.current = setTimeout(() => setT(null), 3000); }, []);
    useEffect(() => () => clearTimeout(timer.current), []);
    return [t, show];
  }

  function FullFrame({ children }) {
    useBackgroundScrollLock();
    return children;
  }

  function Module({ user, onClose, mode, onExpenseSync }) {
    const embedded = mode === "embedded";
    const D = useFamilyData(user);
    const [tab, setTab] = useState("home");
    const [moreView, setMoreView] = useState(null);
    const [sheet, setSheet] = useState(null);
    const [purchaseTick, setPurchaseTick] = useState(0);
    const [inviteTick, setInviteTick] = useState(0);
    const [toastObj, toast] = useToast();
    const ctxRef = useRef({});
    const closeSheet = useCallback(() => setSheet(null), []);
    useSheetBack(!!sheet, closeSheet);
    const uid = user && user.uid;
    const cm = Core.monthOf(today());

    // shopping-list reminders — fires while this module is open (same
    // 20-second, exact-minute-match approach the app's own Task reminders
    // use; a client-only PWA can't reliably wake up in the background)
    useEffect(() => {
      const id = setInterval(() => {
        const lists = D.fam.shoppingLists || [];
        const now = new Date();
        const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const dstr = today();
        lists.filter((l) => l.assignedTo === uid && Core.shoppingReminderDue(l, dstr, hhmm)).forEach((l) => {
          const n = Core.pendingShoppingItems(l).length;
          toast(`🔔 আজকের বাজার: "${l.title}" — ${bn(n)}টি বাকি`);
          try {
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              const body = `${l.title} — ${bn(n)}টি পণ্য বাকি`;
              if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                navigator.serviceWorker.ready.then((reg) => reg.showNotification("আজকের বাজার", { body, icon: "./icon-192.png" })).catch(() => { new Notification("আজকের বাজার", { body }); });
              } else new Notification("আজকের বাজার", { body });
            }
          } catch (e) { /* Notification API unavailable — the in-app toast still shows */ }
          window.FB.markShoppingReminderFired(D.activeId, l.id, l.reminder, dstr).catch(() => {});
        });
      }, 20 * 1000);
      return () => clearInterval(id);
    }, [D.fam.shoppingLists, D.activeId, uid, toast]);

    // one stable object (FamilyTab hangs `reloadInvites` on it), refreshed every render
    const ctx = Object.assign(ctxRef.current, {
      uid, user, familyId: D.activeId, activeId: D.activeId, families: D.top.families, family: D.family, incoming: D.top.incoming,
      emailVerified: !!(window.FB && window.FB.emailVerified && window.FB.emailVerified()),
      fam: D.fam, vis: D.vis, me: D.myMember, purchaseTick, inviteTick, prevMonthKey: Core.addMonths(cm, -1),
      toast, openSheet: setSheet, loadTop: D.loadTop, reload: D.reload,
      setActive: (id) => { D.setActive(id); setTab("home"); setMoreView(null); },
      goMore: (v) => { setTab("more"); setMoreView(v); },
      bumpInvites: () => setInviteTick((n) => n + 1),
      afterAccept: async (fid) => { await D.loadTop(fid); D.setActive(fid); setTab("home"); },
      afterPurchaseChange: (oldP, newP) => {
        const amount = D.fam.budget && D.fam.budget.monthlyAmount;
        let lvl = null;
        if (amount && D.vis.totals) {
          const before = Core.periodTotals(D.fam.stats.monthly, today()).thisMonth;
          const mine = (p) => (p && p.month === cm ? p.total : 0);
          lvl = Core.budgetCrossing(amount, before, Core.round2(before - mine(oldP) + mine(newP)));
        }
        toast(lvl ? `⚠ ${LEVEL[lvl].text}` : newP ? (oldP ? "কেনাকাটা আপডেট হয়েছে" : "বাজার যোগ হয়েছে ✓") : "কেনাকাটা মুছে ফেলা হয়েছে");
        setPurchaseTick((n) => n + 1);
        D.reload();
        // always this account's own purchase (Firestore rules require
        // memberId === uid), so it also belongs in this account's own
        // personal expense ledger, in addition to the shared family view
        if (onExpenseSync) onExpenseSync(oldP, newP ? Object.assign({}, newP, { familyId: D.activeId }) : null);
      },
    });

    const wrap = (inner, extra) => embedded ? h("div", { style: { fontFamily: F, color: "var(--hk-text)", paddingBottom: 96 } }, inner)
      : h(FullFrame, null, h("div", { style: { position: "fixed", inset: 0, zIndex: 40, background: "var(--hk-bg)", display: "flex", justifyContent: "center" } },
        h("div", { style: { width: "100%", maxWidth: 480, height: "100%", display: "flex", flexDirection: "column", fontFamily: F, color: "var(--hk-text)", position: "relative" } }, inner)));

    // ---- not signed in / loading / error / no family -------------------
    const header = (title, sub, right) => h("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: embedded ? "4px 2px 10px" : "calc(10px + env(safe-area-inset-top)) 14px 10px", background: embedded ? "transparent" : "var(--hk-header-bg)", color: embedded ? "var(--hk-text)" : "var(--hk-text-on-dark)" } },
      h("div", { style: { flex: 1, minWidth: 0 } }, h("div", { style: { fontFamily: SERIF, fontSize: 18, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, title), sub && h("div", { style: { fontSize: 12, opacity: 0.8 } }, sub)), right);
    const closeBtn = !embedded && onClose ? h("button", { onClick: onClose, "aria-label": "বন্ধ করুন", style: { background: "none", border: "none", fontSize: 22, color: "inherit", minHeight: 44, minWidth: 44 } }, "✕") : null;
    const scroller = (children) => h("div", { style: embedded ? {} : { flex: 1, overflowY: "auto", overscrollBehaviorY: "contain", padding: "12px 14px 24px" } }, children);

    if (!uid) return wrap(h("div", null, header("🛒 ফ্যামিলি বাজার", null, closeBtn), scroller(h(EntryScreen, { ctx }))));
    if (D.top.loading && !D.top.families.length) return wrap(h("div", null, header("🛒 ফ্যামিলি বাজার", null, closeBtn), scroller(h(Loading))));
    if (D.top.error) return wrap(h("div", null, header("🛒 ফ্যামিলি বাজার", null, closeBtn), scroller(h(ErrorBox, { msg: D.top.error, onRetry: () => D.loadTop() }))));

    const sheetEl = sheet && (
      sheet.type === "create-family" ? h(CreateFamilySheet, { ctx, close: closeSheet }) :
      sheet.type === "switcher" ? h(SwitcherSheet, { ctx, close: closeSheet }) :
      sheet.type === "invite-details" ? h(InvitationDetails, { ctx, inv: sheet.inv, incoming: !!sheet.incoming, close: closeSheet }) :
      (D.myMember && (
        sheet.type === "invite" ? h(InviteSheet, { ctx, close: closeSheet }) :
        sheet.type === "member" ? h(MemberSheet, { ctx, uid: sheet.uid, close: closeSheet }) :
        sheet.type === "product" ? h(ProductSheet, { ctx, productId: sheet.productId, name: sheet.name, close: closeSheet }) :
        sheet.type === "purchase" ? h(PurchaseSheet, { ctx, initial: sheet.initial || null, seed: sheet.seed || null, fromList: sheet.fromList || null, close: closeSheet }) :
        sheet.type === "purchase-details" ? h(PurchaseDetailsSheet, { ctx, purchase: sheet.purchase, close: closeSheet }) :
        sheet.type === "settings" ? h(SettingsSheet, { ctx, close: closeSheet }) :
        sheet.type === "shopping" ? h(ShoppingListsSheet, { ctx, close: closeSheet }) :
        sheet.type === "shopping-create" ? h(ShoppingCreateSheet, { ctx, close: closeSheet }) :
        sheet.type === "shopping-detail" ? h(ShoppingDetailSheet, { ctx, listId: sheet.listId, close: closeSheet }) : null)));
    const toastEl = toastObj && h("div", { key: toastObj.k, role: "status", style: { position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "calc(90px + env(safe-area-inset-bottom))", zIndex: 90, background: "var(--hk-header-bg)", color: "var(--hk-text-on-dark)", padding: "10px 18px", borderRadius: 999, fontSize: 14, fontFamily: F, maxWidth: "90vw", textAlign: "center", boxShadow: "0 4px 16px rgba(0,0,0,.25)" } }, toastObj.msg);

    if (!D.family) return h(R_Fragment, null, wrap(h("div", null, header("🛒 ফ্যামিলি বাজার", null, closeBtn), scroller(h(NoFamily, { ctx })))), sheetEl, toastEl);

    // ---- main -----------------------------------------------------------
    const nameSub = `${bn(D.fam.members.length || (D.family.memberUids || []).length)} জন সদস্য`;
    const myPending = Core.pendingShoppingCount(D.fam.shoppingLists, uid);
    const switcher = h("div", { style: { display: "flex", alignItems: "center" } },
      h("button", { onClick: () => setSheet({ type: "switcher" }), "aria-label": "পরিবার বদলান", style: { background: "none", border: "none", color: "inherit", fontSize: 20, minHeight: 44, minWidth: 40 } }, D.top.families.length > 1 || D.top.incoming.length ? "🔁" : ""),
      h("button", { onClick: () => setSheet({ type: "shopping" }), "aria-label": "বাজারের তালিকা", style: { position: "relative", background: "none", border: "none", color: "inherit", fontSize: 20, minHeight: 44, minWidth: 40 } },
        "📝", myPending > 0 && h("span", { style: { position: "absolute", top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 999, background: "var(--hk-gold)", color: "#1a1a1a", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" } }, bn(myPending))),
      h("button", { onClick: () => { setTab("more"); setMoreView("search"); }, "aria-label": "খুঁজুন", style: { background: "none", border: "none", color: "inherit", fontSize: 20, minHeight: 44, minWidth: 40 } }, "🔎"),
      closeBtn);
    const famTitle = `${(D.family.settings && D.family.settings.icon) || "🏠"} ${D.family.name}`;

    const tabBar = h("div", { role: "tablist", style: embedded
      ? { display: "flex", gap: 4, background: "var(--hk-card)", border: "1px solid var(--hk-border)", borderRadius: 14, padding: 4, marginBottom: 12 }
      : { display: "flex", background: "var(--hk-card)", borderTop: "1px solid var(--hk-border)", padding: "6px 4px calc(6px + env(safe-area-inset-bottom))" } },
      TABS.map(([k, ic, label]) => h("button", { key: k, role: "tab", "aria-selected": tab === k, onClick: () => { if (k === tab && k === "more") setMoreView(null); setTab(k); }, style: { flex: 1, minHeight: 48, border: "none", borderRadius: 10, background: embedded && tab === k ? "var(--hk-gold)" : "transparent", color: tab === k ? (embedded ? "#1a1a1a" : "var(--hk-gold)") : "var(--hk-text-muted)", fontFamily: F, fontSize: 11.5, fontWeight: tab === k ? 700 : 500, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, padding: 0 } },
        h("span", { style: { fontSize: 19, lineHeight: 1 } }, ic), label)));

    const body = D.fam.loading && !D.myMember ? h(Loading) : D.fam.error ? h(ErrorBox, { msg: D.fam.error, onRetry: D.reload }) :
      !D.myMember ? h(Loading) :
      tab === "home" ? h(HomeTab, { ctx }) :
      tab === "bazar" ? h(BazarTab, { ctx }) :
      tab === "reports" ? (D.vis.reports ? h(ReportsTab, { ctx }) : h(Lock, { text: "পরিবারের রিপোর্ট দেখার অনুমতি আপনাকে দেওয়া হয়নি। মালিক/এডমিনকে বলুন।" })) :
      tab === "family" ? h(FamilyTab, { ctx }) :
      h(MoreTab, { ctx, view: moreView, setView: setMoreView });

    const fab = D.myMember && D.vis.write && (tab === "home" || tab === "bazar") && !sheet && h("div", { style: { position: "fixed", left: 0, right: 0, bottom: embedded ? "calc(74px + env(safe-area-inset-bottom))" : "calc(74px + env(safe-area-inset-bottom))", zIndex: 41, display: "flex", justifyContent: "center", pointerEvents: "none" } },
      h("div", { style: { width: "100%", maxWidth: 480, display: "flex", justifyContent: "flex-end", padding: "0 16px" } },
        h("button", { onClick: () => setSheet({ type: "purchase" }), "aria-label": "বাজার যোগ করুন", style: { pointerEvents: "auto", width: 58, height: 58, borderRadius: "50%", border: "none", background: "var(--hk-gold)", color: "#1a1a1a", fontSize: 30, lineHeight: 1, boxShadow: "0 4px 14px rgba(0,0,0,.3)" } }, "+")));

    const frame = embedded
      ? wrap(h("div", null, header(famTitle, nameSub, switcher), tabBar, body))
      : wrap(h(R_Fragment, null, header(famTitle, nameSub, switcher), scroller(body), tabBar));
    return h(R_Fragment, null, frame, fab, sheetEl, toastEl);
  }

  /* ------------------------------------------------------------------ *
   * pending-invitation badge for the app's own menu / notifications
   * ------------------------------------------------------------------ */
  function useFamilyAlerts(user) {
    const uid = user && user.uid;
    const [invites, setInvites] = useState([]);
    const [tick, setTick] = useState(0);
    useEffect(() => {
      if (!uid) { setInvites([]); return undefined; }
      let dead = false;
      const go = () => { if (window.FB && window.FB.myIncomingInvitations) window.FB.myIncomingInvitations().then((r) => { if (!dead) setInvites(r); }).catch(() => {}); };
      go();
      window.addEventListener("fb-ready", go);
      return () => { dead = true; window.removeEventListener("fb-ready", go); };
    }, [uid, tick]);
    return { invites, count: invites.length, refresh: () => setTick((n) => n + 1) };
  }

  window.FamilyBazar = { Module, useFamilyAlerts };
})();
