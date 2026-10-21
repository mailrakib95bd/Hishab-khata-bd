"use strict";
// ── ফাইল ভাগ ──────────────────────────────────────────────────────────
// এই ফাইলে আছে: constants, helpers, hooks, App, Dashboard, Header, Login/Lock,
// TransactionForm, AccountPanel, ModalShell ও শেষে <App/> রেন্ডার।
// আলাদা ফাইলে: styles.js, admin.js, debts.js, tax.js, settings.js,
// calendar-tasks.js, reports-search.js — সবগুলো এই ফাইলের আগে লোড হয়।
// ─────────────────────────────────────────────────────────────────────
const { useState, useEffect, useMemo, useCallback, useContext, createContext, useRef } = React;
/* ---------------- constants ---------------- */
const EXPENSE_CATS = [
    { key: "food", label: "খাবার", icon: "🍚" },
    { key: "home", label: "বাসা ভাড়া", icon: "🏠" },
    { key: "transport", label: "যাতায়াত", icon: "🚌" },
    { key: "mobile", label: "মোবাইল/নেট", icon: "📱" },
    { key: "education", label: "শিক্ষা", icon: "📚" },
    { key: "health", label: "চিকিৎসা", icon: "🏥" },
    { key: "shopping", label: "কেনাকাটা", icon: "🛍️" },
    { key: "family", label: "ফ্যামিলি", icon: "👪" },
    { key: "travel", label: "ভ্রমণ", icon: "✈️" },
    { key: "bill", label: "বিল", icon: "🧾" },
    { key: "donation", label: "দান", icon: "🤲" },
    { key: "other_expense", label: "অন্যান্য", icon: "🔧" },
];
const INCOME_CATS = [
    { key: "salary", label: "দৈনিক/বেতন", icon: "💰" },
    { key: "business", label: "ব্যবসা", icon: "💼" },
    { key: "gift", label: "হাদিয়া", icon: "🎁" },
    { key: "investment", label: "বিনিয়োগ", icon: "📈" },
    { key: "bill_income", label: "বিল", icon: "🧾" },
    { key: "other_income", label: "অন্যান্য", icon: "🔧" },
];
const METHODS = [
    { key: "cash", label: "ক্যাশ" },
    { key: "bank", label: "ব্যাংক" },
    { key: "bkash", label: "বিকাশ" },
    { key: "nagad", label: "নগদ" },
    { key: "rocket", label: "রকেট" },
    { key: "card", label: "কার্ড" },
];
// distinct accent color per wallet, used in the "মোট বর্তমান সম্পদ" row so
// each account is visually distinguishable at a glance
const ACCOUNT_COLORS = {
    cash: "var(--hk-text-muted)",
    bank: "#2F5D8A",
    bkash: "#C23574",
    nagad: "var(--hk-danger-mid)",
    rocket: "#5B3E96",
    card: "var(--hk-success-mid)",
};
const ACCOUNT_ICONS = {
    cash: "💵",
    bank: "🏦",
    bkash: "🟣",
    nagad: "🟠",
    rocket: "🚀",
    card: "💳",
};
// debt/repayment method picker also allows "অন্য মাধ্যম" since money can
// change hands through a third person, not just a wallet the app tracks
const DEBT_METHODS = [...METHODS, { key: "other", label: "অন্য মাধ্যম" }];
/* ---------------- custom categories (context) ---------------- */
const CatCtx = createContext(null);
function useCategories() {
    const ctx = useContext(CatCtx);
    return ctx || { expenseCats: EXPENSE_CATS, incomeCats: INCOME_CATS };
}
const CAT_ICON_CHOICES = [
    "🍚", "🏠", "🚌", "📱", "📚", "🏥", "🛍️", "👪", "✈️", "🧾", "🤲", "🔧",
    "💰", "💼", "🎁", "📈", "☕", "🎬", "⚽", "🐾", "🧴", "🛠️", "🎓", "💊",
    "🚗", "🔌", "💡", "🧺", "🪑", "📦", "🎉", "🕌", "💳", "🐄", "🌾", "⭐",
];
/* ---------------- custom SVG icon system ----------------
   A small, consistent outline-icon set (24×24, uniform stroke) used for
   navigation and category glyphs, replacing ad-hoc emoji where it matters
   most. Category data itself still stores an emoji (for custom
   user-created categories and backward compatibility with saved data) —
   CategoryIcon below only swaps in an SVG for the built-in category keys,
   so nothing about the existing data model changes. */
const ICON_PATHS = {
    home: (React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M3 11l9-8 9 8" }),
        React.createElement("path", { d: "M5 10v10h14V10" }),
        React.createElement("path", { d: "M9 20v-6h6v6" }))),
    food: (React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M6 3v6a2 2 0 0 0 2 2v10" }),
        React.createElement("path", { d: "M6 3v5M8 3v5M10 3v5" }),
        React.createElement("path", { d: "M10 3a2 2 0 0 1 0 5" }),
        React.createElement("path", { d: "M17 3c-1.6 0-2.5 1.2-2.5 3.2S15.4 9 17 9v12" }))),
    transport: (React.createElement(React.Fragment, null,
        React.createElement("rect", { x: "3", y: "6", width: "18", height: "10", rx: "2" }),
        React.createElement("path", { d: "M3 11h18" }),
        React.createElement("circle", { cx: "7.5", cy: "18.5", r: "1.5" }),
        React.createElement("circle", { cx: "16.5", cy: "18.5", r: "1.5" }))),
    mobile: (React.createElement(React.Fragment, null,
        React.createElement("rect", { x: "7", y: "2", width: "10", height: "20", rx: "2" }),
        React.createElement("path", { d: "M11 18h2" }))),
    education: (React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M4 5a2 2 0 0 1 2-2h6v18H6a2 2 0 0 1-2-2V5z" }),
        React.createElement("path", { d: "M20 5a2 2 0 0 0-2-2h-6v18h6a2 2 0 0 0 2-2V5z" }))),
    health: (React.createElement("path", { d: "M12 21s-7-4.35-9.5-8.5C.8 8.7 3 4.3 7 4.3c2 0 3.5 1.4 5 3.4 1.5-2 3-3.4 5-3.4 4 0 6.2 4.4 4.5 8.2C19 16.65 12 21 12 21z" })),
    shopping: (React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M6 8V6a6 6 0 0 1 12 0v2" }),
        React.createElement("rect", { x: "3", y: "8", width: "18", height: "13", rx: "2" }))),
    family: (React.createElement(React.Fragment, null,
        React.createElement("circle", { cx: "8", cy: "7", r: "3" }),
        React.createElement("path", { d: "M2 21v-2a6 6 0 0 1 12 0v2" }),
        React.createElement("circle", { cx: "17.5", cy: "8.5", r: "2.3" }),
        React.createElement("path", { d: "M14.5 21v-1.5a4.3 4.3 0 0 1 7.3-3.1" }))),
    box: (React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" }),
        React.createElement("path", { d: "M12 22V12" }),
        React.createElement("path", { d: "M3.29 7 12 12l8.71-5" }),
        React.createElement("path", { d: "m7.5 4.27 9 5.15" }))),
    travel: (React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M22 2 11 13" }),
        React.createElement("path", { d: "M22 2 15 22l-4-9-9-4 20-7z" }))),
    bill: (React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M6 2h12v20l-3-2-3 2-3-2-3 2V2z" }),
        React.createElement("path", { d: "M9 7h6M9 11h6M9 15h4" }))),
    gift: (React.createElement(React.Fragment, null,
        React.createElement("rect", { x: "3", y: "8", width: "18", height: "13", rx: "1" }),
        React.createElement("path", { d: "M3 12h18" }),
        React.createElement("path", { d: "M12 8v13" }),
        React.createElement("path", { d: "M7.5 8a2.3 2.3 0 1 1 4.5-1.3A2.3 2.3 0 1 1 16.5 8" }))),
    other: (React.createElement("path", { d: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.8 2.8-2-2z" })),
    salary: (React.createElement(React.Fragment, null,
        React.createElement("rect", { x: "2", y: "6", width: "20", height: "12", rx: "2" }),
        React.createElement("circle", { cx: "12", cy: "12", r: "3" }),
        React.createElement("path", { d: "M6 9v.01M18 15v.01" }))),
    business: (React.createElement(React.Fragment, null,
        React.createElement("rect", { x: "3", y: "7", width: "18", height: "13", rx: "2" }),
        React.createElement("path", { d: "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }),
        React.createElement("path", { d: "M3 12h18" }))),
    investment: (React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M3 17l6-6 4 4 8-8" }),
        React.createElement("path", { d: "M15 7h6v6" }))),
    wallet: (React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" }),
        React.createElement("rect", { x: "3", y: "7", width: "18", height: "13", rx: "2" }),
        React.createElement("path", { d: "M16 13h3a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-3a2 2 0 0 1 0-4z" }))),
    bank: (React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M2 10l10-6 10 6" }),
        React.createElement("path", { d: "M4 21V10M20 21V10" }),
        React.createElement("path", { d: "M8 21v-7M12 21v-7M16 21v-7" }),
        React.createElement("path", { d: "M3 21h18" }))),
    transfer: (React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M7 7h11l-3-3" }),
        React.createElement("path", { d: "M17 17H6l3 3" }))),
    debt: (React.createElement(React.Fragment, null,
        React.createElement("circle", { cx: "6", cy: "12", r: "3" }),
        React.createElement("circle", { cx: "18", cy: "12", r: "3" }),
        React.createElement("path", { d: "M9 12h6" }),
        React.createElement("path", { d: "M13 9l3 3-3 3" }))),
    reports: (React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M4 20V10M10 20V4M16 20v-7" }),
        React.createElement("path", { d: "M2 20h20" }))),
    search: (React.createElement(React.Fragment, null,
        React.createElement("circle", { cx: "11", cy: "11", r: "7" }),
        React.createElement("path", { d: "M21 21l-4.3-4.3" }))),
    calendar: (React.createElement(React.Fragment, null,
        React.createElement("rect", { x: "3", y: "5", width: "18", height: "16", rx: "2" }),
        React.createElement("path", { d: "M16 3v4M8 3v4M3 10h18" }))),
    settings: (React.createElement(React.Fragment, null,
        React.createElement("circle", { cx: "12", cy: "12", r: "3" }),
        React.createElement("path", { d: "M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" }))),
    security: (React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" }),
        React.createElement("path", { d: "M9 12l2 2 4-4" }))),
    backup: (React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M7 17a4 4 0 1 1 .5-7.96A5.5 5.5 0 0 1 17.5 10 3.5 3.5 0 0 1 17 17H7z" }),
        React.createElement("path", { d: "M12 12v6M9.5 14.5 12 12l2.5 2.5" }))),
    sync: (React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M4 4v5h5" }),
        React.createElement("path", { d: "M20 20v-5h-5" }),
        React.createElement("path", { d: "M20 9A8 8 0 0 0 6 5.3L4 9" }),
        React.createElement("path", { d: "M4 15a8 8 0 0 0 14 3.7l2-3.7" }))),
    timeline: (React.createElement(React.Fragment, null,
        React.createElement("circle", { cx: "12", cy: "13", r: "8" }),
        React.createElement("path", { d: "M12 9v4l3 2" }),
        React.createElement("path", { d: "M9 2h6" }))),
    edit: (React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M12 20h9" }),
        React.createElement("path", { d: "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" }))),
    delete: (React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M3 6h18" }),
        React.createElement("path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }),
        React.createElement("path", { d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" }),
        React.createElement("path", { d: "M10 11v6M14 11v6" }))),
    share: (React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M12 3v12" }),
        React.createElement("path", { d: "M7 8l5-5 5 5" }),
        React.createElement("path", { d: "M5 21h14" }))),
};
function Icon({ name, size = 20, color = "currentColor", strokeWidth = 1.8, style }) {
    const content = ICON_PATHS[name];
    if (!content)
        return null;
    return (React.createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", style: style }, content));
}
// built-in category key -> custom icon name. Only covers the app's default
// categories, so any user-created custom category keeps its chosen emoji —
// the underlying category data model is unchanged either way.
const CATEGORY_ICON_MAP = {
    food: "food", home: "home", transport: "transport", mobile: "mobile",
    education: "education", health: "health", shopping: "shopping",
    family: "family", travel: "travel", bill: "bill", donation: "gift",
    other_expense: "other",
    salary: "salary", business: "business", gift: "gift", investment: "investment",
    bill_income: "bill", other_income: "other",
};
function CategoryIcon({ catKey, emoji, size = 18, color }) {
    const iconName = CATEGORY_ICON_MAP[catKey];
    if (iconName)
        return React.createElement(Icon, { name: iconName, size: size, color: color || "currentColor" });
    return React.createElement("span", { style: { fontSize: size, lineHeight: 1 } }, emoji);
}
/* ---------------- accounts / wallets ---------------- */
const DEFAULT_ACCOUNTS = METHODS.map((m) => ({ key: m.key, label: m.label }));
// balance per payment-method "wallet" = opening balance + all income − all
// expense recorded against that method, plus/minus any transfers in/out.
// Only methods with any activity or a non-zero opening balance are
// returned, richest balance first.
function computeAccountBalances(transactions, accountOpening, transfers, debts) {
    const sums = {};
    for (const t of transactions) {
        const key = t.method || "cash";
        sums[key] = (sums[key] || 0) + (t.type === "income" ? t.amount : -t.amount);
    }
    // each side is resolved independently — a transfer can freely mix a
    // dynamic account on one side and a legacy method on the other (e.g.
    // Dynamic DBBL → Legacy Bank). Only touch this legacy sum when that
    // side actually used a legacy method; the dynamic side of the same
    // transfer is picked up separately by computeDynamicAccountBalances.
    for (const tr of transfers || []) {
        if (tr.fromMethod)
            sums[tr.fromMethod] = (sums[tr.fromMethod] || 0) - tr.amount;
        if (tr.toMethod)
            sums[tr.toMethod] = (sums[tr.toMethod] || 0) + tr.amount;
    }
    // debt repayments move real money too: paying off something you owe
    // (payable) leaves an account the same way an expense would; collecting
    // on something owed to you (receivable) adds to an account like income.
    // Only repayments that actually recorded which account are counted here
    // — older repayments with no method field are left out rather than
    // guessed, so past balances don't silently shift under existing data.
    for (const d of debts || []) {
        for (const r of d.repayments || []) {
            if (!r.method)
                continue;
            const sign = d.type === "receivable" ? 1 : -1;
            sums[r.method] = (sums[r.method] || 0) + sign * r.amount;
        }
    }
    return METHODS.map((m) => {
        const opening = (accountOpening && accountOpening[m.key]) || 0;
        const balance = opening + (sums[m.key] || 0);
        return { key: m.key, label: m.label, opening, balance, hasActivity: !!sums[m.key] };
    }).sort((a, b) => b.balance - a.balance);
}
// balances for the NEW dynamic named accounts (Phase 1) — a completely
// separate calculation from computeAccountBalances above, keyed by
// accountId instead of method. Only entries that actually carry an
// accountId are counted; nothing here is inferred or guessed onto old
// data, so this coexists safely with the untouched legacy METHODS system.
function computeDynamicAccountBalances(transactions, userAccounts, transfers, debts) {
    const sums = {};
    for (const t of transactions) {
        if (!t.accountId)
            continue;
        sums[t.accountId] = (sums[t.accountId] || 0) + (t.type === "income" ? t.amount : -t.amount);
    }
    for (const tr of transfers || []) {
        if (tr.fromAccountId)
            sums[tr.fromAccountId] = (sums[tr.fromAccountId] || 0) - tr.amount;
        if (tr.toAccountId)
            sums[tr.toAccountId] = (sums[tr.toAccountId] || 0) + tr.amount;
    }
    for (const d of debts || []) {
        for (const r of d.repayments || []) {
            if (!r.accountId)
                continue;
            const sign = d.type === "receivable" ? 1 : -1;
            sums[r.accountId] = (sums[r.accountId] || 0) + sign * r.amount;
        }
    }
    return (userAccounts || []).map((a) => {
        const balance = (a.openingBalance || 0) + (sums[a.id] || 0);
        return Object.assign(Object.assign({}, a), { balance, hasActivity: !!sums[a.id] });
    }).sort((a, b) => b.balance - a.balance);
}
const BN_MONTHS = [
    "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
];
const BN_WEEKDAYS = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const STORAGE_KEY = "hisabkhata-data-v1"; // legacy flat key — pre multi-user, kept only for one-time migration
const DEVICE_KEY = "hisabkhata-device-v1"; // pin / theme / autoSync — this device, unaffected by login/logout
// per-identity storage key for financial data — "guest" while signed out,
// the Firebase UID while signed in, so two accounts on one device/browser
// can never read or overwrite each other's records.
function userDataKey(identity) {
    return identity === "guest" ? "hisabkhata-data-v1:guest" : `hisabkhata-data-v1:${identity}`;
}
const MAX_TASKS = 10;
const BN_WEEKDAY_SHORT = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];
/* ---------------- helpers ---------------- */
function toBnDigits(str) {
    return String(str).replace(/[0-9]/g, (d) => BN_DIGITS[d]);
}
function formatTaka(amount, { sign = false, symbol = true } = {}) {
    const n = Math.round(Math.abs(amount));
    let s = n.toString();
    // south-asian style grouping: last 3 digits, then groups of 2
    let last3 = s.slice(-3);
    let rest = s.slice(0, -3);
    if (rest !== "") {
        rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
        s = rest + "," + last3;
    }
    const prefix = sign ? (amount < 0 ? "− " : amount > 0 ? "+ " : "") : "";
    return prefix + toBnDigits(s) + (symbol ? "৳" : "");
}
function todayStr(dateObj) {
    const d = dateObj || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
function nowTimeStr(dateObj) {
    const d = dateObj || new Date();
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
}
// converts "14:05" (24h) into Bangla "দুপুর ২:০৫"-style display text
function formatTimeBn(time) {
    if (!time)
        return "";
    const [hStr, mStr] = time.split(":");
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const period = h < 4 ? "রাত" : h < 6 ? "ভোর" : h < 12 ? "সকাল" : h < 16 ? "দুপুর" : h < 18 ? "বিকেল" : h < 20 ? "সন্ধ্যা" : "রাত";
    let h12 = h % 12;
    if (h12 === 0)
        h12 = 12;
    return `${period} ${toBnDigits(h12)}:${toBnDigits(String(m).padStart(2, "0"))}`;
}
// "রাকিব" -> "রাকিবের খাতা", "শেখ আশরাফুল" -> "শেখ আশরাফুলের খাতা" —
// falls back to a neutral title when no profile name is set yet
const APP_TAGLINE = "জীবনের হিসাব থেকে আখিরাতের হিসাব";
function dashboardTitle(name) {
    const trimmed = (name || "").trim();
    if (!trimmed)
        return "আমার খাতা";
    // Bengali possessive suffix "ের" attaches directly to a Bengali word
    // ("রাকিব" -> "রাকিবের"), but doing that to a Latin-script name reads
    // wrong ("Rakib Hossenের"). For a name ending in a non-Bengali
    // character, "এর" is used as its own word instead, with a space.
    const lastChar = trimmed[trimmed.length - 1];
    const lastIsBengali = /[\u0980-\u09FF]/.test(lastChar);
    return lastIsBengali ? `${trimmed}ের খাতা` : `${trimmed} এর খাতা`;
}
// formats a JS timestamp (ms) as "আজ, সকাল ১০:৩০" or a full date for older syncs
function formatSyncTime(ts) {
    if (!ts)
        return "";
    const d = new Date(ts);
    const dateStr = todayStr(d);
    const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const isToday = dateStr === todayStr();
    return isToday ? `আজ, ${formatTimeBn(timeStr)}` : `${formatDateBn(dateStr).full}, ${formatTimeBn(timeStr)}`;
}
function isGregLeap(y) {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
const BN_CAL_MONTHS = [
    "বৈশাখ", "জ্যৈষ্ঠ", "আষাঢ়", "শ্রাবণ", "ভাদ্র", "আশ্বিন",
    "কার্তিক", "অগ্রহায়ণ", "পৌষ", "মাঘ", "ফাল্গুন", "চৈত্র",
];
// Bengali calendar (Bangladesh, 2019 revision — Pohela Boishakh fixed on 14 April)
function gregorianToBangla(date) {
    const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
    let banglaYear, startOfYear;
    if (m > 4 || (m === 4 && d >= 14)) {
        banglaYear = y - 593;
        startOfYear = new Date(y, 3, 14);
    }
    else {
        banglaYear = y - 594;
        startOfYear = new Date(y - 1, 3, 14);
    }
    const diffDays = Math.round((new Date(y, m - 1, d) - startOfYear) / 86400000);
    const chaitraLen = isGregLeap(startOfYear.getFullYear() + 1) ? 31 : 30;
    const monthLens = [31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 30, chaitraLen];
    let remaining = diffDays, mi = 0;
    while (mi < 11 && remaining >= monthLens[mi]) {
        remaining -= monthLens[mi];
        mi++;
    }
    return { day: remaining + 1, month: BN_CAL_MONTHS[mi], year: banglaYear };
}
const HIJRI_MONTHS = [
    "মুহাররম", "সফর", "রবিউল আউয়াল", "রবিউস সানি", "জমাদিউল আউয়াল", "জমাদিউস সানি",
    "রজব", "শাবান", "রমজান", "শাওয়াল", "জিলকদ", "জিলহজ",
];
// হিজরি তারিখের একমাত্র উৎস — hijri-ummalqura.js (window.HijriUQ), উম্মুল
// কুরা (Umm al-Qura) সারণি-ভিত্তিক হিসাব, ঢাকার সূর্যাস্ত অনুযায়ী দিন
// পরিবর্তন। নিচের wrapper ফাংশনগুলো শুধু আগের নাম/সিগনেচার ধরে রাখে, যাতে
// বাকি পুরো অ্যাপ (ক্যালেন্ডার, অ্যাডমিন ফর্ম, ড্যাশবোর্ড) না বদলেও চলে।
function gregorianToHijri(date) {
    const h = window.HijriUQ && window.HijriUQ.gregorianToHijri(date.getFullYear(), date.getMonth() + 1, date.getDate());
    if (!h)
        return { day: 0, month: "", year: 0 }; // টেবিলের সীমার বাইরে (১৯৩৭-২০৭৭ এর বাইরে) — বাস্তবে ঘটে না
    return { day: h.day, month: HIJRI_MONTHS[h.month - 1], year: h.year };
}
function hijriToGregorianYmd(year, month, day) {
    if (!window.HijriUQ)
        return null;
    return window.HijriUQ.hijriToGregorianYmd(parseInt(year, 10), parseInt(month, 10), parseInt(day, 10));
}
function ymdToHijriParts(ymd) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || "");
    if (!m || !window.HijriUQ)
        return null;
    const h = window.HijriUQ.gregorianToHijri(+m[1], +m[2], +m[3]);
    return h ? { year: h.year, month: h.month, day: h.day } : null;
}
// ইসলামি দিন শুরু হয় ঢাকার সূর্যাস্তে — শুধু হিজরি হিসাবের জন্য প্রযোজ্য;
// ইংরেজি/বাংলা তারিখ এখনো রাত ১২টাতেই পরিবর্তিত হয় (এই ফাংশন সেগুলো ছোঁয় না)
function islamicEffectiveDate(now) {
    if (!window.HijriUQ)
        return now;
    const eff = window.HijriUQ.islamicEffectiveDate(now);
    return new Date(eff.y, eff.m - 1, eff.d);
}
function monthKeyOf(dateStr) {
    return dateStr.slice(0, 7);
}
function formatDateBn(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    const day = toBnDigits(d.getDate());
    const month = BN_MONTHS[d.getMonth()];
    const year = toBnDigits(d.getFullYear());
    const weekday = BN_WEEKDAYS[d.getDay()];
    return { day, month, year, weekday, full: `${day} ${month}, ${year}` };
}
function uid() {
    return (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
// appends one audit entry and caps the log at 200 — a rolling record of
// major changes, not a full undo history
function appendAudit(log, text) {
    const next = [...(log || []), { id: uid(), ts: Date.now(), text }];
    return next.length > 200 ? next.slice(next.length - 200) : next;
}
/* ---------------- personal task reminder/repeat presets ---------------- */
const TASK_REMINDER_PRESETS = [
    { key: "none", label: "কোনোটি না", minutesBefore: null },
    { key: "ontime", label: "নির্ধারিত সময়ে", minutesBefore: 0 },
    { key: "5min", label: "৫ মিনিট আগে", minutesBefore: 5 },
    { key: "10min", label: "১০ মিনিট আগে", minutesBefore: 10 },
    { key: "1hour", label: "১ ঘণ্টা আগে", minutesBefore: 60 },
    { key: "1day", label: "১ দিন আগে", minutesBefore: 1440 },
    { key: "custom", label: "নিজের মতো", minutesBefore: null },
];
const TASK_REPEAT_OPTIONS = [
    { key: "none", label: "নেই" },
    { key: "daily", label: "প্রতিদিন" },
    { key: "weekly", label: "প্রতি সপ্তাহে" },
    { key: "monthly", label: "প্রতি মাসে" },
    { key: "yearly", label: "প্রতি বছরে" },
    { key: "custom", label: "নিজের মতো" },
];
// derives the actual reminderDate/reminderTime fields the EXISTING firing
// loop already checks (unchanged), from the task's own date+time and the
// chosen preset offset — this way no new reminder-firing mechanism is
// needed, the preset is just resolved down to what already works.
function computeTaskReminderFields(taskDate, taskTime, preset, customDate, customTime) {
    if (!preset || preset === "none")
        return { reminderDate: null, reminderTime: null };
    if (preset === "custom")
        return { reminderDate: customDate || null, reminderTime: customTime || null };
    const p = TASK_REMINDER_PRESETS.find((x) => x.key === preset);
    if (!p || p.minutesBefore == null || !taskDate)
        return { reminderDate: null, reminderTime: null };
    const base = new Date(`${taskDate}T${taskTime || "00:00"}:00`);
    if (isNaN(base.getTime()))
        return { reminderDate: null, reminderTime: null };
    base.setMinutes(base.getMinutes() - p.minutesBefore);
    const y = base.getFullYear(), m = String(base.getMonth() + 1).padStart(2, "0"), d = String(base.getDate()).padStart(2, "0");
    const hh = String(base.getHours()).padStart(2, "0"), mm = String(base.getMinutes()).padStart(2, "0");
    return { reminderDate: `${y}-${m}-${d}`, reminderTime: `${hh}:${mm}` };
}
// primary admin identity — mirrors firestore.rules exactly. This check is a
// UI convenience only (which buttons render); it is NOT the security
// boundary. The real enforcement lives in firestore.rules, which
// independently rejects any write to notices/dailyMessages/adminSpecialDays
// from anyone whose auth uid isn't PRIMARY_ADMIN_UID, regardless of what
// the client sends.
const PRIMARY_ADMIN_UID = "gjObYYXi66eHmqIhtlDuvq29cJ42";
const PRIMARY_ADMIN_EMAIL = "mail.rakib95bd@gmail.com";
function isAdmin(user) {
    return !!user && (user.uid === PRIMARY_ADMIN_UID || (user.email && user.email.toLowerCase() === PRIMARY_ADMIN_EMAIL));
}
// ---------------- reusable overlay back-navigation guard ----------------
// Any overlay (modal, popup, dropdown, bottom sheet) anywhere in the app can
// call this with its own open/close state to get correct Android
// back-button / browser back-gesture behaviour for free: pressing back
// closes JUST this overlay and returns to the same underlying screen — it
// never falls through to the dashboard or exits the app. This is the same
// one-history-entry-per-overlay pattern App() already uses for its
// top-level modals, made reusable for overlays owned by nested components
// (e.g. Family Bazar's item form, admin panels, notification panels) so
// every new overlay gets this behaviour automatically instead of needing a
// bespoke wire-up in App().
function useBackOverlay(isOpen, onClose) {
    const pushedRef = useRef(false);
    const consumedByBackRef = useRef(false);
    useEffect(() => {
        if (isOpen && !pushedRef.current) {
            window.history.pushState({ hkOverlay: true }, "");
            pushedRef.current = true;
        }
        else if (!isOpen && pushedRef.current) {
            pushedRef.current = false;
            if (consumedByBackRef.current) {
                consumedByBackRef.current = false; // already popped by the back-press itself
            }
            else if (window.history.state && window.history.state.hkOverlay) {
                window.history.back();
            }
        }
    }, [isOpen]);
    useEffect(() => {
        if (!isOpen)
            return;
        const onPop = () => {
            consumedByBackRef.current = true;
            onClose();
        };
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, [isOpen, onClose]);
}
function catInfo(type, key, cats) {
    const list = cats
        ? (type === "income" ? cats.incomeCats : cats.expenseCats)
        : (type === "income" ? INCOME_CATS : EXPENSE_CATS);
    return list.find((c) => c.key === key) || { label: key, icon: "🔧" };
}
function methodLabel(key) {
    return (DEBT_METHODS.find((m) => m.key === key) || {}).label || key;
}
function shiftDate(dateStr, days) {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}
function normalizeSpecialDays(raw) {
    const out = {};
    Object.entries(raw || {}).forEach(([k, v]) => {
        out[k] = Array.isArray(v) ? v : [v];
    });
    return out;
}
/* ---------------- main app ---------------- */
function App() {
    const [loaded, setLoaded] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [budget, setBudget] = useState(0);
    const [tasks, setTasks] = useState([]);
    const [specialDays, setSpecialDays] = useState({});
    const [debts, setDebts] = useState([]);
    const [tab, setTab] = useState("dashboard");
    const [showAdd, setShowAdd] = useState(false);
    const [showBudget, setShowBudget] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [editingTx, setEditingTx] = useState(null);
    const [editingTransfer, setEditingTransfer] = useState(null);
    const [showCalendar, setShowCalendar] = useState(false);
    const [editingDebt, setEditingDebt] = useState(null);
    const [showAddDebt, setShowAddDebt] = useState(false);
    const [activeReminder, setActiveReminder] = useState(null);
    const [saveErr, setSaveErr] = useState(false);
    const [, forceTick] = useState(0);
    // premium additions: custom categories, per-category budgets, account
    // opening balances, PIN app-lock, undo-delete
    const [expenseCats, setExpenseCats] = useState(EXPENSE_CATS);
    const [incomeCats, setIncomeCats] = useState(INCOME_CATS);
    const [categoryBudgets, setCategoryBudgets] = useState({});
    const [accountOpening, setAccountOpening] = useState({});
    const [pin, setPin] = useState(null);
    const [unlocked, setUnlocked] = useState(true);
    const [quickAddType, setQuickAddType] = useState(null);
    const [theme, setTheme] = useState("light"); // "light" | "dark" | "auto"
    const [transfers, setTransfers] = useState([]);
    const [showTransfer, setShowTransfer] = useState(false);
    const [showTransferHistory, setShowTransferHistory] = useState(false);
    const [undoBuffer, setUndoBuffer] = useState(null); // { kind, item, index }
    const [profileName, setProfileName] = useState(null); // app-local display name, separate from Google's
    const [familyMembers, setFamilyMembers] = useState([]); // { id, name, relation, note, createdAt }
    const [bazarItems, setBazarItems] = useState([]); // family bazar / shopping-list items, see BAZAR_CATS
    const [taxes, setTaxes] = useState([]); // { id, name, amount, dueDate, paid, note, createdAt }
    // dynamic named accounts (e.g. "DBBL", "bKash Personal") — ADDITIVE to
    // the existing fixed METHODS system, never replacing it. A transaction
    // may optionally carry an accountId tagging which specific account it
    // belongs to, on top of its required method. Old transactions have no
    // accountId and are never guessed into one — see computeDynamicAccountBalances.
    const [userAccounts, setUserAccounts] = useState([]); // { id, name, type, openingBalance, openingBalanceDate, active, createdAt, updatedAt }
    // record of important changes — transaction/debt/account edits, major
    // deletions, restore/merge operations. Capped at 200 entries (oldest
    // dropped first) so it never grows the document unboundedly; this is a
    // log for "what happened recently", not a full undo history.
    const [auditLog, setAuditLog] = useState([]);
    // per-user read-tracking for admin-managed notices/daily messages (the
    // notices/messages themselves are fetched from Firestore separately,
    // further down — these three only need to exist before applyUserData
    // and persistAll, which both reference them)
    const [readNoticeIds, setReadNoticeIds] = useState([]);
    const [readDailyMessageIds, setReadDailyMessageIds] = useState([]);
    const [dismissedDailyMessageIds, setDismissedDailyMessageIds] = useState([]);
    // per-user completion tracking for admin-published tasks ("এডমিন টাস্ক") —
    // adminTasksCloud is a single shared/global list, so completion can't be
    // stored on the task itself (that would complete it for every user at
    // once). Same pattern as readNoticeIds/readDailyMessageIds above: an
    // array of ids this user has personally checked off, kept in their own
    // data and never written back to the shared adminTasks collection.
    const [completedAdminTaskIds, setCompletedAdminTaskIds] = useState([]);
    useEffect(() => {
        const id = setInterval(() => forceTick((n) => n + 1), 60 * 1000);
        return () => clearInterval(id);
    }, []);
    // resolve + apply the theme (light/dark/auto) to the document root so the
    // CSS custom properties defined in the injected stylesheet take effect
    useEffect(() => {
        const apply = () => {
            const resolved = theme === "auto"
                ? (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
                : theme;
            document.documentElement.setAttribute("data-theme", resolved);
        };
        apply();
        if (theme === "auto" && window.matchMedia) {
            const mq = window.matchMedia("(prefers-color-scheme: dark)");
            mq.addEventListener("change", apply);
            return () => mq.removeEventListener("change", apply);
        }
    }, [theme]);
    /* ---------------- storage layer — two independent layers ----------------
       1. DEVICE_KEY: pin / theme / autoSync — belongs to this device, never
          touched by login or logout.
       2. userDataKey(identity): every financial record — transactions,
          budget, debts, accounts, categories, transfers, profile name. This
          is namespaced per signed-in UID ("guest" when signed out), so two
          different Google accounts on the same device/browser can never see
          each other's data. STORAGE_KEY (the old flat, non-namespaced key)
          is kept only as a one-time migration source for people who used the
          app before this separation existed. ------------------------------- */
    const loadedIdentityRef = useRef(null); // uid of whichever identity's data is currently in state, or "guest"
    const applyUserData = useCallback((data) => {
        const d = data || {};
        setTransactions(d.transactions || []);
        setBudget(d.budget || 0);
        setTasks(d.tasks || []);
        setSpecialDays(normalizeSpecialDays(d.specialDays));
        setDebts(d.debts || []);
        setExpenseCats(d.expenseCats && d.expenseCats.length ? d.expenseCats : EXPENSE_CATS);
        setIncomeCats(d.incomeCats && d.incomeCats.length ? d.incomeCats : INCOME_CATS);
        setCategoryBudgets(d.categoryBudgets || {});
        setAccountOpening(d.accountOpening || {});
        setTransfers(d.transfers || []);
        setProfileName(d.profileName || null);
        setFamilyMembers(d.familyMembers || []);
        setBazarItems(d.bazarItems || []);
        setTaxes(d.taxes || []);
        setUserAccounts(d.userAccounts || []);
        setAuditLog(d.auditLog || []);
        setReadNoticeIds(d.readNoticeIds || []);
        setReadDailyMessageIds(d.readDailyMessageIds || []);
        setDismissedDailyMessageIds(d.dismissedDailyMessageIds || []);
        setCompletedAdminTaskIds(d.completedAdminTaskIds || []);
    }, []);
    const persist = useCallback(async (key, data) => {
        try {
            const result = await window.storage.set(key, JSON.stringify(data));
            setSaveErr(!result);
        }
        catch (e) {
            setSaveErr(true);
        }
    }, []);
    // writes every user-scoped field (financial data + profile name) to the
    // CURRENTLY LOADED identity's own key — every mutation below should route
    // through this so no field is ever dropped, and so User A's edits can
    // never land in User B's storage bucket.
    const persistAll = useCallback((overrides) => persist(userDataKey(loadedIdentityRef.current || "guest"), Object.assign({ transactions,
        budget,
        tasks,
        specialDays,
        debts,
        expenseCats,
        incomeCats,
        categoryBudgets,
        accountOpening,
        transfers,
        profileName,
        familyMembers,
        bazarItems,
        taxes,
        userAccounts,
        auditLog,
        readNoticeIds,
        readDailyMessageIds,
        dismissedDailyMessageIds,
        completedAdminTaskIds }, overrides)), [transactions, budget, tasks, specialDays, debts, expenseCats, incomeCats, categoryBudgets, accountOpening, transfers, profileName, familyMembers, bazarItems, taxes, userAccounts, auditLog, readNoticeIds, readDailyMessageIds, dismissedDailyMessageIds, completedAdminTaskIds, persist]);
    // pin / theme / autoSync only — deliberately NOT part of persistAll, since
    // these belong to the device, not to whichever account is signed in
    const [autoSync, setAutoSync] = useState(true);
    // browser/PWA notification permission — 'default' | 'granted' | 'denied',
    // or 'unsupported' if the Notification API doesn't exist in this
    // environment at all. Read once on mount; updated after each explicit
    // request (see requestNotificationPermission below)
    const [notificationPermission, setNotificationPermission] = useState(() => (typeof Notification !== "undefined" ? Notification.permission : "unsupported"));
    const requestNotificationPermission = useCallback(async () => {
        if (typeof Notification === "undefined") {
            setNotificationPermission("unsupported");
            return;
        }
        try {
            const result = await Notification.requestPermission();
            setNotificationPermission(result);
        }
        catch (e) {
            // some browsers reject if not called from a direct user gesture —
            // the Settings button below always calls this from a click, so
            // this catch is just a safety net
        }
    }, []);
    const persistDevice = useCallback((overrides) => persist(DEVICE_KEY, Object.assign({ pin, theme, autoSync }, overrides)), [pin, theme, autoSync, persist]);
    const saveTheme = (val) => {
        setTheme(val);
        persistDevice({ theme: val });
    };
    const saveAutoSync = (val) => {
        setAutoSync(val);
        persistDevice({ autoSync: val });
    };
    const saveProfileName = (name) => {
        const trimmed = (name || "").trim();
        setProfileName(trimmed || null);
        persistAll({ profileName: trimmed || null });
    };
    // full-fidelity JSON backup — every field, unlike the CSV export which is
    // transactions-only. This is what "Backup Export"/"Backup Restore" in
    // Settings use, independent of whether cloud sync is signed in or not.
    const exportBackupJSON = () => JSON.stringify({
        transactions, budget, tasks, specialDays, debts, expenseCats, incomeCats,
        categoryBudgets, accountOpening, transfers, profileName,
        familyMembers, bazarItems,
        taxes,
        userAccounts,
        auditLog,
        readNoticeIds, readDailyMessageIds, dismissedDailyMessageIds, completedAdminTaskIds,
        exportedAt: Date.now(),
    }, null, 2);
    const importBackupJSON = (jsonText) => {
        try {
            const data = JSON.parse(jsonText);
            applyUserData(data);
            const nextLog = appendAudit(data.auditLog || [], `JSON ব্যাকআপ থেকে পুনরুদ্ধার করা হয়েছে`);
            setAuditLog(nextLog);
            persistAll(Object.assign(Object.assign({}, data), { auditLog: nextLog }));
            return true;
        }
        catch (e) {
            return false;
        }
    };
    /* ---------------- Firebase auth + cloud backup (optional, best-effort) ----------------
       window.FB is set up by a <script type="module"> in index.html. If it never loads
       (no internet, blocked, etc.) every function below is a safe no-op and the app keeps
       working exactly as it does offline — cloud sync is strictly additive.
  
       Account-switching safety: every identity change (guest→user, user→guest,
       or user A→user B) goes through settleIdentity(), which ALWAYS clears
       in-memory state and shows the loading screen before loading the new
       identity's own data — so one account's data can never flash on screen
       while another account's data is still loading, and logging out always
       leaves the UI in a clean guest state. */
    const [user, setUser] = useState(null);
    const [syncStatus, setSyncStatus] = useState("offline"); // offline | syncing | synced | error
    const [lastSyncedAt, setLastSyncedAt] = useState(null);
    const [showLogin, setShowLogin] = useState(false);
    const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
    const [showNotificationCenter, setShowNotificationCenter] = useState(false);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [showFAQ, setShowFAQ] = useState(false);
    const [showTaxPanel, setShowTaxPanel] = useState(false);
    const [showKhasra, setShowKhasra] = useState(false);
    // খসড়া খাতা has its own inner screens (input → history → detail); the module
    // registers a "step back" function here so the phone's back button walks
    // detail → history → input first and only then closes the whole panel
    const khasraBackRef = useRef(null);
    const [showAccountPanel, setShowAccountPanel] = useState(false);
    const [showFamilyBazar, setShowFamilyBazar] = useState(false);
    // pending Family Bazar invitations for the signed-in Google account (badge on the ☰ menu)
    const famAlerts = (window.FamilyBazar && window.FamilyBazar.useFamilyAlerts) ? window.FamilyBazar.useFamilyAlerts(user) : { count: 0 };
    const [searchSeed, setSearchSeed] = useState(null);
    const [isOnline, setIsOnline] = useState(typeof navigator === "undefined" || navigator.onLine !== false);
    const [pendingChanges, setPendingChanges] = useState(0);
    const cloudPushTimer = useRef(null);
    const suppressNextPush = useRef(false);
    const localUpdatedAtRef = useRef(0);
    // track connectivity — used to show an "অফলাইন" state and to kick off an
    // automatic sync the moment the connection comes back, instead of making
    // the person remember to press "এখনই Sync করুন" themselves
    useEffect(() => {
        const goOnline = () => setIsOnline(true);
        const goOffline = () => setIsOnline(false);
        window.addEventListener("online", goOnline);
        window.addEventListener("offline", goOffline);
        return () => {
            window.removeEventListener("online", goOnline);
            window.removeEventListener("offline", goOffline);
        };
    }, []);
    // Android back button / browser back gesture — closes only the topmost
    // open overlay and stays on the current screen, instead of exiting the
    // app or jumping to the dashboard. We push exactly one history entry the
    // moment any top-level modal opens, and consume it again if the modal is
    // instead closed via its own X/outside-tap, so the back button never
    // needs pressing twice.
    const anyTopModalOpen = showAdd || showBudget || showSettings || !!editingTx || showCalendar ||
        !!editingDebt || showAddDebt || showTransfer || showTransferHistory || showLogin;
    const modalHistoryPushedRef = useRef(false);
    // lets CalendarModal register a "did I consume this back-press myself?"
    // function for its own nested special-day view — see the popstate
    // handler below for why this is needed
    const calendarBackConsumedRef = useRef(null);
    const debtDetailBackConsumedRef = useRef(null); // same pattern, for DebtDetail's edit-form view
    // tracks whether the currently-open top-level panel (Admin/Tax/Accounts/
    // FAQ/Calendar/Notifications/Settings) was reached FROM the 3-dot menu,
    // so closing it (tap-outside, X, or hardware back) can return to the
    // menu — the previous layer — instead of falling all the way through to
    // the Dashboard. Only set when a HamburgerMenu item is tapped; entry
    // points that bypass the menu (Header's calendar/bell/tax icons) leave
    // it false, so those keep closing straight to the Dashboard as before.
    const menuOriginRef = useRef(false);
    const closeMenuPanel = (setter) => {
        setter(false);
        if (menuOriginRef.current) {
            menuOriginRef.current = false;
            setShowHamburgerMenu(true);
        }
    };
    useEffect(() => {
        if (anyTopModalOpen && !modalHistoryPushedRef.current) {
            window.history.pushState({ hkModal: true }, "");
            modalHistoryPushedRef.current = true;
        }
        else if (!anyTopModalOpen && modalHistoryPushedRef.current) {
            modalHistoryPushedRef.current = false;
            if (window.history.state && window.history.state.hkModal) {
                window.history.back();
            }
        }
    }, [anyTopModalOpen]);
    useEffect(() => {
        const onPopState = () => {
            if (showLogin) {
                setShowLogin(false);
                return;
            }
            if (showTransferHistory) {
                setShowTransferHistory(false);
                return;
            }
            if (showTransfer) {
                setShowTransfer(false);
                return;
            }
            if (showAddDebt) {
                setShowAddDebt(false);
                return;
            }
            if (editingDebt) {
                if (debtDetailBackConsumedRef.current && debtDetailBackConsumedRef.current()) {
                    window.history.pushState({ hkModal: true }, "");
                    return;
                }
                setEditingDebt(null);
                return;
            }
            if (showCalendar) {
                // CalendarModal may itself be showing a nested special-day detail
                // view — if so, let IT consume this back-press (closing just that
                // detail, not the whole calendar), then restore the one history
                // entry the calendar relies on so the next back-press still works
                if (calendarBackConsumedRef.current && calendarBackConsumedRef.current()) {
                    window.history.pushState({ hkModal: true }, "");
                    return;
                }
                closeMenuPanel(setShowCalendar);
                return;
            }
            if (editingTx) {
                setEditingTx(null);
                return;
            }
            if (showSettings) {
                closeMenuPanel(setShowSettings);
                return;
            }
            if (showBudget) {
                setShowBudget(false);
                return;
            }
            if (showAdd) {
                setShowAdd(false);
                return;
            }
        };
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, [showAdd, showBudget, showSettings, editingTx, showCalendar, editingDebt, showAddDebt, showTransfer, showTransferHistory, showLogin]);
    useBackOverlay(showHamburgerMenu, () => setShowHamburgerMenu(false));
    useBackOverlay(showNotificationCenter, () => closeMenuPanel(setShowNotificationCenter));
    useBackOverlay(showAdminPanel, () => closeMenuPanel(setShowAdminPanel));
    useBackOverlay(showFAQ, () => closeMenuPanel(setShowFAQ));
    useBackOverlay(showTaxPanel, () => closeMenuPanel(setShowTaxPanel));
    // editingTransfer opens ON TOP of TransferHistoryModal (a nested
    // overlay, same shape as DebtDetail's repay/statement views) — back
    // must close just the edit form and return to the history list
    useBackOverlay(!!editingTransfer, () => setEditingTransfer(null));
    useBackOverlay(showAccountPanel, () => closeMenuPanel(setShowAccountPanel));
    useBackOverlay(showFamilyBazar, () => closeMenuPanel(setShowFamilyBazar));
    useEffect(() => {
        if (!showKhasra)
            return;
        window.history.pushState({ hkOverlay: true }, "");
        let poppedByBack = false;
        const onPop = () => {
            if (khasraBackRef.current && khasraBackRef.current()) {
                window.history.pushState({ hkOverlay: true }, "");
                return;
            }
            poppedByBack = true;
            closeMenuPanel(setShowKhasra);
        };
        window.addEventListener("popstate", onPop);
        return () => {
            window.removeEventListener("popstate", onPop);
            if (!poppedByBack && window.history.state && window.history.state.hkOverlay)
                window.history.back();
        };
    }, [showKhasra]);
    const loadIdentityData = useCallback(async (identity) => {
        try {
            const res = await window.storage.get(userDataKey(identity));
            if (res && res.value)
                return JSON.parse(res.value);
        }
        catch (e) {
            // fall through to legacy migration below
        }
        if (identity === "guest") {
            // one-time migration: people who used the app before per-account
            // storage existed have their data under the old flat key
            try {
                const legacy = await window.storage.get(STORAGE_KEY);
                if (legacy && legacy.value) {
                    const parsed = JSON.parse(legacy.value);
                    window.storage.set(userDataKey("guest"), legacy.value).catch(() => { });
                    return parsed;
                }
            }
            catch (e) {
                // no legacy data either — genuinely a fresh guest
            }
        }
        return null;
    }, []);
    const settleIdentity = useCallback(async (fbUser) => {
        const newIdentity = fbUser ? fbUser.uid : "guest";
        if (newIdentity === loadedIdentityRef.current) {
            // same identity re-announced (token refresh etc) — nothing to reset
            setUser(fbUser);
            return;
        }
        // switching identity: clear the screen's data BEFORE loading anything
        // new, so the previous identity's records can never be visible even
        // for a moment while the new identity's data is being fetched
        setLoaded(false);
        applyUserData(null);
        loadedIdentityRef.current = newIdentity;
        const localData = await loadIdentityData(newIdentity);
        applyUserData(localData);
        if (fbUser) {
            setUser(fbUser);
            try {
                setSyncStatus("syncing");
                const cloudData = await window.FB.loadCloudData(fbUser.uid);
                if (cloudData) {
                    applyUserData(cloudData);
                    window.storage.set(userDataKey(newIdentity), JSON.stringify(cloudData)).catch(() => { });
                }
                else if (localData) {
                    // first time this Google account has synced from this device —
                    // push its existing local data up rather than losing it
                    await window.FB.saveCloudData(fbUser.uid, localData);
                }
                setSyncStatus("synced");
                setLastSyncedAt(Date.now());
            }
            catch (e) {
                setSyncStatus("error");
            }
        }
        else {
            setUser(null);
            setSyncStatus("offline");
        }
        setLoaded(true);
    }, [applyUserData, loadIdentityData]);
    useEffect(() => {
        let mounted = true;
        let unsub = null;
        (async () => {
            // device-level prefs (pin/theme/autoSync) load independently of auth
            try {
                const res = await window.storage.get(DEVICE_KEY);
                if (res && res.value) {
                    const d = JSON.parse(res.value);
                    setPin(d.pin || null);
                    setUnlocked(!d.pin);
                    setTheme(d.theme || "light");
                    // Auto Sync is always on — no user-facing toggle exists anymore,
                    // so a legacy "false" saved by an older version is intentionally
                    // ignored rather than leaving sync silently disabled forever
                }
                else {
                    // migrate pin/theme out of the old flat key, if present
                    try {
                        const legacy = await window.storage.get(STORAGE_KEY);
                        if (legacy && legacy.value) {
                            const parsed = JSON.parse(legacy.value);
                            setPin(parsed.pin || null);
                            setUnlocked(!parsed.pin);
                            setTheme(parsed.theme || "light");
                        }
                    }
                    catch (e) {
                        // no legacy data — fine, defaults stand
                    }
                }
            }
            catch (e) {
                // no device prefs yet — defaults stand
            }
            if (!mounted)
                return;
            const attach = () => {
                unsub = window.FB.onAuthChange((fbUser) => {
                    settleIdentity(fbUser);
                });
            };
            if (window.FB) {
                attach();
            }
            else {
                // Firebase not ready yet (still loading, or offline) — don't block
                // the app waiting for it; settle as guest now, and if a real
                // session exists it will be picked up once fb-ready fires
                await settleIdentity(null);
                window.addEventListener("fb-ready", attach, { once: true });
            }
        })();
        return () => {
            mounted = false;
            if (unsub)
                unsub();
            window.removeEventListener("fb-ready", () => { });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    /* ---------------- admin-managed global content ----------------
       notices / dailyMessages / adminSpecialDays are NOT part of the
       per-user document — they're shared collections, readable by any
       signed-in user, writable only by the primary admin UID (enforced in
       firestore.rules, not just here). They're fetched fresh from
       Firestore rather than mirrored into local storage, since they're
       inherently server-owned content. Per-user READ TRACKING (which
       notices/messages this user has seen) IS personal data and lives in
       the normal per-user document via persistAll. */
    const [notices, setNotices] = useState([]);
    const [dailyMessages, setDailyMessages] = useState([]);
    const [adminSpecialDaysCloud, setAdminSpecialDaysCloud] = useState([]);
    const [adminTasksCloud, setAdminTasksCloud] = useState([]);
    const [faqCloud, setFaqCloud] = useState([]);
    const [adminContentLoading, setAdminContentLoading] = useState(false);
    const [adminContentError, setAdminContentError] = useState(false);
    // the FAQ collection used to be 3 items hard-coded directly in the
    // component. They're preserved here verbatim as seed data — the very
    // first time an admin loads the app and the /faq collection is still
    // empty, these get written once so nothing from the original content
    // is lost. This never runs again once /faq has at least one document.
    const FAQ_SEED = [
        { question: "আমার তথ্য কি নিরাপদ?", answer: "প্রতিটি ব্যবহারকারীর তথ্য আলাদাভাবে সংরক্ষিত হয় এবং শুধুমাত্র সংশ্লিষ্ট ব্যবহারকারী নিজের তথ্য দেখতে পারেন।" },
        { question: "অফলাইনে অ্যাপ কাজ করে কি?", answer: "হ্যাঁ, ইন্টারনেট সংযোগ ছাড়াও অ্যাপ ব্যবহার করা যায়; সংযোগ ফিরলে ডেটা স্বয়ংক্রিয়ভাবে সিঙ্ক হয়।" },
        { question: "ব্যাকআপ কীভাবে নেব?", answer: "সেটিংস থেকে JSON ব্যাকআপ ডাউনলোড করতে পারবেন।" },
    ];
    const fetchAdminContent = useCallback(async () => {
        if (!window.FB || !user)
            return;
        setAdminContentLoading(true);
        setAdminContentError(false);
        try {
            const [n, d, s, t, f] = await Promise.all([
                window.FB.listCollection("notices"),
                window.FB.listCollection("dailyMessages"),
                window.FB.listCollection("adminSpecialDays"),
                window.FB.listCollection("adminTasks"),
                window.FB.listCollection("faq"),
            ]);
            setNotices(n);
            setDailyMessages(d);
            setAdminSpecialDaysCloud(s);
            setAdminTasksCloud(t);
            if (f.length === 0 && isAdmin(user)) {
                // one-time seed, admin session only (matches Firestore
                // write rules) — re-fetch afterward so state reflects what
                // was actually written, not the empty pre-seed result
                await window.FB.batchAddTo("faq", FAQ_SEED);
                setFaqCloud(await window.FB.listCollection("faq"));
            }
            else {
                setFaqCloud(f);
            }
            return s;
        }
        catch (e) {
            setAdminContentError(true);
            return null;
        }
        finally {
            setAdminContentLoading(false);
        }
    }, [user]);
    useEffect(() => {
        if (user && window.FB)
            fetchAdminContent();
        if (!user) {
            setNotices([]);
            setDailyMessages([]);
            setAdminSpecialDaysCloud([]);
            setAdminTasksCloud([]);
            setFaqCloud([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);
    const markNoticeRead = (id) => {
        if (readNoticeIds.includes(id))
            return;
        const next = [...readNoticeIds, id];
        setReadNoticeIds(next);
        persistAll({ readNoticeIds: next });
    };
    const markDailyMessageRead = (id) => {
        if (readDailyMessageIds.includes(id))
            return;
        const next = [...readDailyMessageIds, id];
        setReadDailyMessageIds(next);
        persistAll({ readDailyMessageIds: next });
    };
    const dismissDailyMessage = (id) => {
        if (dismissedDailyMessageIds.includes(id))
            return;
        const next = [...dismissedDailyMessageIds, id];
        setDismissedDailyMessageIds(next);
        persistAll({ dismissedDailyMessageIds: next });
    };
    const markAllRead = () => {
        const allNoticeIds = notices.map((n) => n.id);
        const allMsgIds = dailyMessages.map((m) => m.id);
        setReadNoticeIds(allNoticeIds);
        setReadDailyMessageIds(allMsgIds);
        persistAll({ readNoticeIds: allNoticeIds, readDailyMessageIds: allMsgIds });
    };
    // toggles THIS user's own completion mark on a shared admin task —
    // never mutates adminTasksCloud itself (that's a single shared
    // document/collection every user reads), only this user's own
    // completedAdminTaskIds list, exactly mirroring how readNoticeIds
    // tracks per-user read state on shared notices above.
    const toggleAdminTaskComplete = (id) => {
        const next = completedAdminTaskIds.includes(id)
            ? completedAdminTaskIds.filter((x) => x !== id)
            : [...completedAdminTaskIds, id];
        setCompletedAdminTaskIds(next);
        persistAll({ completedAdminTaskIds: next });
    };
    // admin CRUD — the isAdmin(user) checks here only decide whether the UI
    // even attempts the call; if anyone bypasses the frontend and calls
    // Firestore directly, firestore.rules independently rejects the write
    // server-side unless request.auth.uid is the primary admin UID.
    // every admin write goes through this — never silently swallows a
    // Firestore failure (permission-denied, offline, etc.). Returns
    // { ok: true } or { ok: false, message } so the calling form can show
    // an actual error instead of just closing as if it worked.
    const runAdminOp = async (fn, friendlyLabel) => {
        if (!isAdmin(user))
            return { ok: false, message: "অ্যাডমিন অনুমতি নেই।" };
        try {
            await fn();
            await fetchAdminContent();
            return { ok: true };
        }
        catch (e) {
            const code = e && e.code ? String(e.code) : "";
            const message = code.includes("permission-denied")
                ? `${friendlyLabel} সংরক্ষণ করা যায়নি — অনুমতি নেই। (Firestore permission denied)`
                : `${friendlyLabel} সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।`;
            return { ok: false, message };
        }
    };
    const adminAddNotice = (data) => runAdminOp(() => window.FB.addDocTo("notices", data), "নোটিশ");
    const adminUpdateNotice = (id, patch) => runAdminOp(() => window.FB.updateDocIn("notices", id, patch), "নোটিশ");
    const adminDeleteNotice = (id) => runAdminOp(() => window.FB.deleteDocFrom("notices", id), "নোটিশ");
    const adminAddDailyMessage = (data) => runAdminOp(() => window.FB.addDocTo("dailyMessages", data), "দৈনিক বার্তা");
    const adminUpdateDailyMessage = (id, patch) => runAdminOp(() => window.FB.updateDocIn("dailyMessages", id, patch), "দৈনিক বার্তা");
    const adminDeleteDailyMessage = (id) => runAdminOp(() => window.FB.deleteDocFrom("dailyMessages", id), "দৈনিক বার্তা");
    const adminAddSpecialDay = (data) => runAdminOp(() => window.FB.addDocTo("adminSpecialDays", data), "বিশেষ দিবস");
    const adminUpdateSpecialDay = (id, patch) => runAdminOp(() => window.FB.updateDocIn("adminSpecialDays", id, patch), "বিশেষ দিবস");
    const adminDeleteSpecialDay = (id) => runAdminOp(() => window.FB.deleteDocFrom("adminSpecialDays", id), "বিশেষ দিবস");
    const adminAddTask = async (data) => {
        const result = await runAdminOp(() => window.FB.addDocTo("adminTasks", data), "টাস্ক");
        // Task Management → Add Task should also land in this admin's own
        // "আমার টাস্ক" list, using the SAME addTask function and the SAME
        // MAX_TASKS=10 cap as every other personal task — addTask already
        // silently no-ops past the cap, so that limit is preserved as-is.
        if (result && result.ok) {
            addTask({
                text: data.title, date: data.dueDate || null, time: data.time || null,
                category: data.category || null, note: data.description || "",
                repeat: data.repeat || null,
                reminderDate: data.reminderDate || null, reminderTime: data.reminderTime || null,
            });
        }
        return result;
    };
    const adminUpdateTask = (id, patch) => runAdminOp(() => window.FB.updateDocIn("adminTasks", id, patch), "টাস্ক");
    const adminDeleteTask = (id) => runAdminOp(() => window.FB.deleteDocFrom("adminTasks", id), "টাস্ক");
    const adminAddFaq = (data) => runAdminOp(() => window.FB.addDocTo("faq", data), "প্রশ্ন-উত্তর");
    const adminUpdateFaq = (id, patch) => runAdminOp(() => window.FB.updateDocIn("faq", id, patch), "প্রশ্ন-উত্তর");
    const adminDeleteFaq = (id) => runAdminOp(() => window.FB.deleteDocFrom("faq", id), "প্রশ্ন-উত্তর");
    // bulk import: rows already parsed+validated by the AdminPanel UI as
    // { date, title, description }. Duplicate (date+title already present
    // in adminSpecialDaysCloud) rows are skipped so re-importing the same
    // sheet twice never corrupts the calendar with repeats.
    // fixed-date entries key by their date; Hijri-recurring entries (date is
    // always null for those — see resolveSpecialDayDate) key by month+day
    // instead, so a recurring "১৪ রজব" bulk-imported twice is still caught
    // as a duplicate even though it has no fixed `date` to compare.
    const specialDayDupKey = (s) => (s && s.recurrence === "hijri"
        ? `hijri:${s.hijriMonth}-${s.hijriDay}|${(s.title || "").trim()}`
        : `${s.date}|${(s.title || "").trim()}`);
    const adminBulkImportSpecialDays = async (rows) => {
        if (!isAdmin(user))
            return { added: 0, skipped: 0, ok: false, message: "অ্যাডমিন অনুমতি নেই।" };
        const existingKey = new Set(adminSpecialDaysCloud.map(specialDayDupKey));
        const fresh = rows.filter((r) => !existingKey.has(specialDayDupKey(r)));
        try {
            if (fresh.length)
                await window.FB.batchAddTo("adminSpecialDays", fresh);
            let latest = await fetchAdminContent();
            // defensive re-check: a batch write of many documents can very
            // briefly lag behind an immediate read (Firestore eventual
            // consistency), which would otherwise look like "saved fine,
            // then some rows are missing" right after a large import. If
            // the freshly-fetched list doesn't yet contain everything we
            // just wrote, wait a moment and fetch once more before
            // reporting success. Uses fetchAdminContent's own return
            // value directly — never a stale closure of local state.
            const freshKeys = new Set(fresh.map(specialDayDupKey));
            const missingAfter = (list) => {
                const currentKeys = new Set((list || []).map(specialDayDupKey));
                return [...freshKeys].some((k) => !currentKeys.has(k));
            };
            if (fresh.length && missingAfter(latest)) {
                await new Promise((resolve) => setTimeout(resolve, 1200));
                latest = await fetchAdminContent();
            }
            return { added: fresh.length, skipped: rows.length - fresh.length, ok: true };
        }
        catch (e) {
            return { added: 0, skipped: 0, ok: false, message: "বাল্ক ইমপোর্ট ব্যর্থ হয়েছে। আবার চেষ্টা করুন।" };
        }
    };
    const unreadNoticeCount = notices.filter((n) => n.published !== false && !readNoticeIds.includes(n.id)).length;
    const unreadDailyCount = dailyMessages.filter((m) => !dismissedDailyMessageIds.includes(m.id) && !readDailyMessageIds.includes(m.id)).length;
    const totalUnreadCount = unreadNoticeCount + unreadDailyCount;
    const scheduleCloudPush = useCallback((data) => {
        if (!user || !window.FB || !autoSync)
            return;
        if (suppressNextPush.current) {
            suppressNextPush.current = false;
            return;
        }
        localUpdatedAtRef.current = Date.now();
        if (!isOnline) {
            // no point even trying — queue it and let the reconnect effect
            // below retry automatically the moment the connection is back
            setPendingChanges((n) => n + 1);
            return;
        }
        if (cloudPushTimer.current)
            clearTimeout(cloudPushTimer.current);
        setSyncStatus("syncing");
        cloudPushTimer.current = setTimeout(async () => {
            try {
                await window.FB.saveCloudData(user.uid, data);
                setSyncStatus("synced");
                setLastSyncedAt(Date.now());
                setPendingChanges(0);
            }
            catch (e) {
                setSyncStatus("error");
                setPendingChanges((n) => n + 1);
            }
        }, 1500);
    }, [user, autoSync, isOnline]);
    // whenever synced data changes (and the user is logged in, and auto-sync
    // is on), push it to the cloud — always sees the latest state, so no
    // stale-closure risk
    useEffect(() => {
        if (!loaded || !user || !autoSync)
            return;
        scheduleCloudPush({
            transactions, budget, tasks, specialDays, debts, expenseCats, incomeCats,
            categoryBudgets, accountOpening, transfers, profileName,
            familyMembers, bazarItems, taxes, userAccounts, auditLog,
            readNoticeIds, readDailyMessageIds, dismissedDailyMessageIds, completedAdminTaskIds,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transactions, budget, tasks, specialDays, debts, expenseCats, incomeCats, categoryBudgets, accountOpening, transfers, profileName, familyMembers, bazarItems, taxes, userAccounts, auditLog, readNoticeIds, readDailyMessageIds, dismissedDailyMessageIds, completedAdminTaskIds, user, loaded, autoSync]);
    // the moment the connection comes back, automatically flush any changes
    // that piled up while offline — the person never has to remember to sync
    const manualSyncRef = useRef(null);
    useEffect(() => {
        if (!isOnline || !user || !window.FB || !autoSync || pendingChanges === 0)
            return;
        manualSyncRef.current && manualSyncRef.current();
    }, [isOnline, user, autoSync, pendingChanges]);
    const manualSync = async () => {
        if (!user || !window.FB)
            return;
        if (!isOnline) {
            setSyncStatus("error");
            return;
        }
        try {
            setSyncStatus("syncing");
            await window.FB.saveCloudData(user.uid, {
                transactions, budget, tasks, specialDays, debts, expenseCats, incomeCats,
                categoryBudgets, accountOpening, transfers, profileName,
                familyMembers, bazarItems, taxes, userAccounts, auditLog,
                readNoticeIds, readDailyMessageIds, dismissedDailyMessageIds, completedAdminTaskIds,
            });
            setSyncStatus("synced");
            setLastSyncedAt(Date.now());
            setPendingChanges(0);
        }
        catch (e) {
            setSyncStatus("error");
            setPendingChanges((n) => Math.max(n, 1));
        }
    };
    manualSyncRef.current = manualSync;
    // restoring overwrites local data, so if there are unsynced local edits
    // (pendingChanges > 0) this could silently discard them — the caller
    // (Settings UI) checks pendingChanges first and confirms with the person
    // before calling this, exactly like any other destructive action in the app
    const restoreFromCloud = async () => {
        if (!user || !window.FB)
            return;
        if (!isOnline) {
            setSyncStatus("error");
            return;
        }
        setSyncStatus("syncing");
        try {
            const cloudData = await window.FB.loadCloudData(user.uid);
            if (cloudData) {
                suppressNextPush.current = true;
                const nextLog = appendAudit(cloudData.auditLog || [], `ক্লাউড থেকে পুনরুদ্ধার করা হয়েছে`);
                applyUserData(Object.assign(Object.assign({}, cloudData), { auditLog: nextLog }));
                window.storage.set(userDataKey(user.uid), JSON.stringify(Object.assign(Object.assign({}, cloudData), { auditLog: nextLog }))).catch(() => { });
                setPendingChanges(0);
            }
            setSyncStatus("synced");
            setLastSyncedAt(Date.now());
        }
        catch (e) {
            setSyncStatus("error");
        }
    };
    // fetches the cloud document WITHOUT applying it, purely so the Settings
    // screen can show "local vs cloud" counts before the user confirms an
    // overwrite. Local counts are read straight from current state.
    const previewCloudVsLocal = async () => {
        if (!user || !window.FB || !isOnline)
            return null;
        const cloud = await window.FB.loadCloudData(user.uid);
        return {
            local: {
                transactions: transactions.length,
                debts: debts.length,
                transfers: transfers.length,
                familyMembers: familyMembers.length,
                bazarItems: bazarItems.length,
                taxes: taxes.length,
            },
            cloud: cloud
                ? {
                    transactions: (cloud.transactions || []).length,
                    debts: (cloud.debts || []).length,
                    transfers: (cloud.transfers || []).length,
                    familyMembers: (cloud.familyMembers || []).length,
                    bazarItems: (cloud.bazarItems || []).length,
                    taxes: (cloud.taxes || []).length,
                    updatedAt: cloud.updatedAt || null,
                }
                : null,
        };
    };
    const logOut = async () => {
        if (window.FB) {
            try {
                await window.FB.logOut();
            }
            catch (e) {
                // ignore — onAuthChange below still fires with fbUser=null either way
            }
        }
        // settleIdentity (via the onAuthChange listener) handles clearing state
        // and switching back to the guest identity — not duplicated here, so
        // there's exactly one code path that can ever change identity.
    };
    const addTransaction = (tx) => {
        const next = [...transactions, Object.assign(Object.assign({}, tx), { id: uid(), createdAt: Date.now() })];
        setTransactions(next);
        persistAll({ transactions: next });
    };
    const updateTransaction = (id, patch) => {
        const next = transactions.map((t) => (t.id === id ? Object.assign(Object.assign({}, t), patch) : t));
        setTransactions(next);
        persistAll({ transactions: next });
    };
    const deleteTransaction = (id) => {
        const idx = transactions.findIndex((t) => t.id === id);
        if (idx === -1)
            return;
        const removed = transactions[idx];
        const next = transactions.filter((t) => t.id !== id);
        const nextLog = appendAudit(auditLog, `লেনদেন মুছে ফেলা হয়েছে: ${removed.type === "income" ? "আয়" : "ব্যয়"} ${formatTaka(removed.amount)} (${removed.date})`);
        setTransactions(next);
        setAuditLog(nextLog);
        persistAll({ transactions: next, auditLog: nextLog });
        setUndoBuffer({ kind: "transaction", item: removed, index: idx });
    };
    // Family Bazar → personal expense sync. Every purchase a person logs in
    // Family Bazar is *their own* (Firestore rules require memberId ===
    // that account's uid), so it always belongs in that same Google
    // account's own personal expense ledger too — not just the shared
    // family view. Kept in one dedicated category so it's easy to spot and
    // never collides with a category someone renamed or deleted by hand.
    // oldPurchase/newPurchase are Family Bazar's own purchase objects
    // (same `purchaseId` across an edit); newPurchase null means it was
    // deleted there, so the matching personal transaction is deleted too.
    const FAMILY_BAZAR_EXPENSE_CATEGORY = { key: "family_bazar", label: "ফ্যামিলি বাজার", icon: "🛒" };
    const syncFamilyBazarExpense = (oldPurchase, newPurchase) => {
        const purchaseId = (newPurchase || oldPurchase || {}).purchaseId;
        if (!purchaseId) return;
        let cats = expenseCats;
        if (!cats.some((c) => c.key === FAMILY_BAZAR_EXPENSE_CATEGORY.key)) {
            cats = [...cats, FAMILY_BAZAR_EXPENSE_CATEGORY];
            setExpenseCats(cats);
        }
        const existing = transactions.find((t) => t.familyPurchaseId === purchaseId);
        let next = transactions;
        if (!newPurchase) {
            if (existing) next = transactions.filter((t) => t.id !== existing.id);
        } else {
            const note = [newPurchase.market, newPurchase.location].filter(Boolean).join(" • ") || "ফ্যামিলি বাজার";
            const patch = {
                type: "expense", amount: newPurchase.total, date: newPurchase.date,
                category: FAMILY_BAZAR_EXPENSE_CATEGORY.key, note,
                familyPurchaseId: purchaseId, familyId: newPurchase.familyId || null, source: "family-bazar",
            };
            next = existing
                ? transactions.map((t) => (t.id === existing.id ? Object.assign({}, t, patch) : t))
                : [...transactions, Object.assign({ id: uid(), createdAt: Date.now() }, patch)];
        }
        if (next !== transactions) setTransactions(next);
        if (next !== transactions || cats !== expenseCats) persistAll(Object.assign({ transactions: next }, cats !== expenseCats ? { expenseCats: cats } : {}));
    };
    // Personal (non-Family-Bazar) expenses per month, straight from the
    // dashboard timeline. Family Bazar purchases are already in the timeline
    // as synced transactions (familyPurchaseId) — they're left out here so the
    // family view can show  বাজার + অন্যান্য  without counting anything twice.
    const otherExpenseByMonth = useMemo(() => {
        const out = {};
        transactions.forEach((t) => {
            if (t.type !== "expense" || t.familyPurchaseId) return;
            const m = String(t.date || "").slice(0, 7);
            if (m.length === 7) out[m] = Math.round(((out[m] || 0) + (Number(t.amount) || 0)) * 100) / 100;
        });
        return out;
    }, [transactions]);
    // publish this month's + last month's figure to the families this Google
    // account belongs to (members with the "মাসিক মোট" permission can see it)
    const lastPublishedOther = useRef("");
    useEffect(() => {
        if (!user || !window.FB || !window.FB.publishOtherExpense) return undefined;
        const now = new Date();
        const cm = todayStr().slice(0, 7);
        const pmDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const pm = `${pmDate.getFullYear()}-${String(pmDate.getMonth() + 1).padStart(2, "0")}`;
        const payload = { [cm]: otherExpenseByMonth[cm] || 0, [pm]: otherExpenseByMonth[pm] || 0 };
        const key = user.uid + JSON.stringify(payload);
        if (key === lastPublishedOther.current) return undefined;
        const timer = setTimeout(() => {
            window.FB.publishOtherExpense(payload).then(() => { lastPublishedOther.current = key; }).catch(() => { });
        }, 1500);
        return () => clearTimeout(timer);
    }, [otherExpenseByMonth, user && user.uid]);
    /* ---------------- family management ---------------- */
    const addFamilyMember = (member) => {
        const next = [...familyMembers, Object.assign(Object.assign({}, member), { id: uid(), createdAt: Date.now() })];
        setFamilyMembers(next);
        persistAll({ familyMembers: next });
    };
    const updateFamilyMember = (id, patch) => {
        const next = familyMembers.map((m) => (m.id === id ? Object.assign(Object.assign({}, m), patch) : m));
        setFamilyMembers(next);
        persistAll({ familyMembers: next });
    };
    // safe delete: unassign this member from any bazar items instead of
    // silently orphaning/deleting the items themselves
    const deleteFamilyMember = (id) => {
        const nextMembers = familyMembers.filter((m) => m.id !== id);
        const nextBazar = bazarItems.map((it) => (it.familyMemberId === id ? Object.assign(Object.assign({}, it), { familyMemberId: null }) : it));
        setFamilyMembers(nextMembers);
        setBazarItems(nextBazar);
        persistAll({ familyMembers: nextMembers, bazarItems: nextBazar });
    };
    /* ---------------- family bazar ---------------- */
    const addBazarItem = (item) => {
        const next = [...bazarItems, Object.assign(Object.assign({}, item), { id: uid(), createdAt: Date.now(), expenseAdded: false })];
        setBazarItems(next);
        persistAll({ bazarItems: next });
    };
    const updateBazarItem = (id, patch) => {
        const next = bazarItems.map((it) => (it.id === id ? Object.assign(Object.assign({}, it), patch) : it));
        setBazarItems(next);
        persistAll({ bazarItems: next });
    };
    const deleteBazarItem = (id) => {
        const next = bazarItems.filter((it) => it.id !== id);
        setBazarItems(next);
        persistAll({ bazarItems: next });
    };
    // "খরচ হিসেবে যোগ করুন" — converts one purchased bazar item into a real
    // expense transaction exactly once. expenseAdded guards against the item
    // ever creating a duplicate expense, even if pressed again or synced
    // from another device.
    const addBazarItemAsExpense = (item) => {
        if (item.expenseAdded)
            return;
        const amount = computeBazarTotal(item);
        if (!amount || amount <= 0)
            return;
        const txId = uid();
        const nextTx = [...transactions, {
                id: txId,
                type: "expense",
                amount,
                category: "family",
                date: item.purchaseDate || todayStr(),
                note: `বাজার: ${item.productName}`,
                method: "cash",
                familyMemberId: item.familyMemberId || null,
                bazarItemId: item.id,
                createdAt: Date.now(),
            }];
        const nextBazar = bazarItems.map((it) => (it.id === item.id ? Object.assign(Object.assign({}, it), { expenseAdded: true, expenseTxId: txId }) : it));
        setTransactions(nextTx);
        setBazarItems(nextBazar);
        persistAll({ transactions: nextTx, bazarItems: nextBazar });
    };
    /* ---------------- tax management ---------------- */
    const addTax = (tax) => {
        const next = [...taxes, Object.assign(Object.assign({}, tax), { id: uid(), createdAt: Date.now(), paid: false })];
        setTaxes(next);
        persistAll({ taxes: next });
    };
    const updateTax = (id, patch) => {
        const next = taxes.map((t) => (t.id === id ? Object.assign(Object.assign({}, t), patch) : t));
        setTaxes(next);
        persistAll({ taxes: next });
    };
    const deleteTax = (id) => {
        const next = taxes.filter((t) => t.id !== id);
        setTaxes(next);
        persistAll({ taxes: next });
    };
    const toggleTaxPaid = (id) => {
        const next = taxes.map((t) => (t.id === id ? Object.assign(Object.assign({}, t), { paid: !t.paid }) : t));
        setTaxes(next);
        persistAll({ taxes: next });
    };
    /* ---------------- dynamic accounts (Phase 1 — additive, alongside METHODS) ---------------- */
    const addUserAccount = (acc) => {
        const next = [...userAccounts, Object.assign(Object.assign({}, acc), { id: uid(), active: true, createdAt: Date.now(), updatedAt: Date.now() })];
        const nextLog = appendAudit(auditLog, `নতুন অ্যাকাউন্ট যোগ করা হয়েছে: ${acc.name}`);
        setUserAccounts(next);
        setAuditLog(nextLog);
        persistAll({ userAccounts: next, auditLog: nextLog });
    };
    const updateUserAccount = (id, patch) => {
        const next = userAccounts.map((a) => (a.id === id ? Object.assign(Object.assign(Object.assign({}, a), patch), { updatedAt: Date.now() }) : a));
        setUserAccounts(next);
        persistAll({ userAccounts: next });
    };
    // delete is only allowed once nothing references the account anymore —
    // otherwise historical transactions would point at a vanished account.
    // Deactivating (hiding it from pickers for new entries, keeping history
    // intact) is always available regardless of usage.
    const accountUsageCount = (id) => transactions.filter((t) => t.accountId === id).length
        + transfers.filter((tr) => tr.fromAccountId === id || tr.toAccountId === id).length
        + debts.reduce((s, d) => s + (d.repayments || []).filter((r) => r.accountId === id).length, 0);
    const deleteUserAccount = (id) => {
        if (accountUsageCount(id) > 0)
            return false; // caller should show the usage warning instead
        const removed = userAccounts.find((a) => a.id === id);
        const next = userAccounts.filter((a) => a.id !== id);
        const nextLog = removed ? appendAudit(auditLog, `অ্যাকাউন্ট মুছে ফেলা হয়েছে: ${removed.name}`) : auditLog;
        setUserAccounts(next);
        setAuditLog(nextLog);
        persistAll({ userAccounts: next, auditLog: nextLog });
        return true;
    };
    const toggleUserAccountActive = (id) => {
        const next = userAccounts.map((a) => (a.id === id ? Object.assign(Object.assign({}, a), { active: !a.active, updatedAt: Date.now() }) : a));
        setUserAccounts(next);
        persistAll({ userAccounts: next });
    };
    const dynamicAccountBalances = useMemo(() => computeDynamicAccountBalances(transactions, userAccounts, transfers, debts), [transactions, userAccounts, transfers, debts]);
    // wallets (cash/bank/bkash/নগদ/রকেট/card) must never go negative — computes
    // a method's current balance from opening balance + transactions + transfers,
    // optionally excluding one transaction/transfer (used when editing).
    // includes debt repayments in the legacy-method balance check — this
    // was previously missing here even though computeAccountBalances (the
    // DISPLAYED balance) already counted them, so a payable repayment
    // could silently let a later expense overdraw an account. excludeRepaymentId
    // lets repayment edit/validation exclude its own old effect, the same
    // way excludeTxId/excludeTransferId already worked for transactions/transfers.
    const accountBalanceExcluding = (method, excludeTxId, excludeTransferId, excludeRepaymentId) => {
        const opening = accountOpening[method] || 0;
        let sum = 0;
        for (const t of transactions) {
            if (excludeTxId && t.id === excludeTxId)
                continue;
            if (t.method !== method)
                continue;
            sum += t.type === "income" ? t.amount : -t.amount;
        }
        for (const tr of transfers) {
            if (excludeTransferId && tr.id === excludeTransferId)
                continue;
            if (tr.fromMethod === method)
                sum -= tr.amount;
            if (tr.toMethod === method)
                sum += tr.amount;
        }
        for (const d of debts) {
            for (const r of d.repayments || []) {
                if (excludeRepaymentId && r.id === excludeRepaymentId)
                    continue;
                if (r.method !== method)
                    continue;
                sum += (d.type === "receivable" ? 1 : -1) * r.amount;
            }
        }
        return opening + sum;
    };
    const checkAccountBalance = (method, type, amount, excludeId) => {
        if (type !== "expense")
            return true;
        return accountBalanceExcluding(method, excludeId, null) - amount >= 0;
    };
    const checkTransferBalance = (fromMethod, amount, excludeTransferId) => {
        return accountBalanceExcluding(fromMethod, null, excludeTransferId) - amount >= 0;
    };
    // repayment balance checks — payable repayments spend real money, so
    // they're checked the same way an expense/transfer is; receivable
    // repayments (collecting money owed to you) are never blocked, since
    // receiving money can't overdraw anything. Reuses the exact same two
    // engines as everywhere else — no third balance system.
    const checkRepaymentBalance = (debtType, method, amount, excludeRepaymentId) => {
        if (debtType === "receivable")
            return true;
        return accountBalanceExcluding(method, null, null, excludeRepaymentId) - amount >= 0;
    };
    const checkDynamicRepaymentBalance = (debtType, accountId, amount, debtId, excludeRepaymentId) => {
        if (debtType === "receivable")
            return true;
        const debtsForCheck = excludeRepaymentId
            ? debts.map((d) => d.id === debtId ? Object.assign(Object.assign({}, d), { repayments: (d.repayments || []).filter((r) => r.id !== excludeRepaymentId) }) : d)
            : debts;
        const balances = computeDynamicAccountBalances(transactions, userAccounts, transfers, debtsForCheck);
        const acc = balances.find((a) => a.id === accountId);
        return (acc ? acc.balance : 0) - amount >= 0;
    };
    // dynamic-account equivalent of checkTransferBalance — reuses
    // computeDynamicAccountBalances exactly as-is (no second balance
    // engine), just called with the being-edited transfer filtered out
    // first so editing never double-subtracts its own old effect
    const checkDynamicTransferBalance = (accountId, amount, excludeTransferId) => {
        const filtered = excludeTransferId ? transfers.filter((t) => t.id !== excludeTransferId) : transfers;
        const balances = computeDynamicAccountBalances(transactions, userAccounts, filtered, debts);
        const acc = balances.find((a) => a.id === accountId);
        return (acc ? acc.balance : 0) - amount >= 0;
    };
    const addTransfer = (transfer) => {
        const next = [...transfers, Object.assign(Object.assign({}, transfer), { id: uid(), createdAt: Date.now() })];
        setTransfers(next);
        persistAll({ transfers: next });
    };
    const updateTransfer = (id, patch) => {
        const next = transfers.map((t) => (t.id === id ? Object.assign(Object.assign({}, t), patch) : t));
        setTransfers(next);
        persistAll({ transfers: next });
    };
    const deleteTransfer = (id) => {
        const idx = transfers.findIndex((t) => t.id === id);
        if (idx === -1)
            return;
        const removed = transfers[idx];
        const next = transfers.filter((t) => t.id !== id);
        setTransfers(next);
        persistAll({ transfers: next });
        setUndoBuffer({ kind: "transfer", item: removed, index: idx });
    };
    const saveBudget = (val) => {
        setBudget(val);
        persistAll({ budget: val });
    };
    // clears EVERY user-scoped field (not just transactions/budget/tasks/
    // debts/transfers — special days, custom categories, category budgets,
    // wallet opening balances, and the profile name too), and — critically —
    // if signed in, also pushes the cleared state to Firestore so the next
    // auto-sync can't silently bring the old data back from the cloud
    const clearAll = () => {
        applyUserData(null); // resets every field to the same defaults applyUserData always uses
        const cleared = {
            transactions: [], budget: 0, tasks: [], specialDays: {}, debts: [],
            expenseCats: EXPENSE_CATS, incomeCats: INCOME_CATS, categoryBudgets: {},
            accountOpening: {}, transfers: [], profileName: null,
            familyMembers: [], bazarItems: [], taxes: [], auditLog: [],
            userAccounts: [],
            readNoticeIds: [], readDailyMessageIds: [], dismissedDailyMessageIds: [], completedAdminTaskIds: [],
        };
        persistAll(cleared);
        if (user && window.FB) {
            window.FB.saveCloudData(user.uid, cleared).catch(() => { });
        }
    };
    const addTask = (data) => {
        // backward compatible: a plain string still works exactly as
        // before (quick single-line add); an object carries the fuller
        // field set from the new detailed Task form
        const fields = typeof data === "string" ? { text: data } : data;
        const trimmed = (fields.text || "").trim();
        if (!trimmed || tasks.length >= MAX_TASKS)
            return;
        const next = [...tasks, {
                id: uid(), text: trimmed, done: false,
                date: fields.date || null, time: fields.time || null,
                category: fields.category || null, note: fields.note || "",
                repeat: fields.repeat || null,
                reminderDate: fields.reminderDate || null, reminderTime: fields.reminderTime || null, remindedAt: null,
            }];
        setTasks(next);
        persistAll({ tasks: next });
    };
    const updateTask = (id, patch) => {
        const next = tasks.map((t) => (t.id === id ? Object.assign(Object.assign({}, t), patch) : t));
        setTasks(next);
        persistAll({ tasks: next });
    };
    const toggleTask = (id) => {
        const next = tasks.map((t) => (t.id === id ? Object.assign(Object.assign({}, t), { done: !t.done }) : t));
        setTasks(next);
        persistAll({ tasks: next });
    };
    const deleteTask = (id) => {
        const next = tasks.filter((t) => t.id !== id);
        setTasks(next);
        persistAll({ tasks: next });
    };
    const setTaskReminder = (id, date, time) => {
        const next = tasks.map((t) => (t.id === id ? Object.assign(Object.assign({}, t), { reminderDate: date, reminderTime: time, remindedAt: null }) : t));
        setTasks(next);
        persistAll({ tasks: next });
    };
    const saveSpecialDays = (map) => {
        setSpecialDays(map);
        persistAll({ specialDays: map });
    };
    const addDebt = (debt) => {
        const next = [...debts, Object.assign(Object.assign({}, debt), { id: uid(), createdAt: Date.now(), repayments: [], dueNotified: null })];
        setDebts(next);
        persistAll({ debts: next });
    };
    const updateDebt = (id, patch) => {
        const next = debts.map((d) => (d.id === id ? Object.assign(Object.assign({}, d), patch) : d));
        setDebts(next);
        persistAll({ debts: next });
    };
    const deleteDebt = (id) => {
        const idx = debts.findIndex((d) => d.id === id);
        if (idx === -1)
            return;
        const removed = debts[idx];
        const next = debts.filter((d) => d.id !== id);
        const nextLog = appendAudit(auditLog, `${removed.type === "receivable" ? "পাওনা" : "দেনা"} মুছে ফেলা হয়েছে: ${removed.person} — ${formatTaka(removed.amount)}`);
        setDebts(next);
        setAuditLog(nextLog);
        persistAll({ debts: next, auditLog: nextLog });
        setUndoBuffer({ kind: "debt", item: removed, index: idx });
    };
    const undoLastDelete = () => {
        if (!undoBuffer)
            return;
        if (undoBuffer.kind === "transaction") {
            const next = [...transactions];
            next.splice(undoBuffer.index, 0, undoBuffer.item);
            setTransactions(next);
            persistAll({ transactions: next });
        }
        else if (undoBuffer.kind === "debt") {
            const next = [...debts];
            next.splice(undoBuffer.index, 0, undoBuffer.item);
            setDebts(next);
            persistAll({ debts: next });
        }
        else if (undoBuffer.kind === "transfer") {
            const next = [...transfers];
            next.splice(undoBuffer.index, 0, undoBuffer.item);
            setTransfers(next);
            persistAll({ transfers: next });
        }
        else if (undoBuffer.kind === "repayment") {
            const next = debts.map((d) => d.id === undoBuffer.debtId ? Object.assign(Object.assign({}, d), { repayments: (() => {
                    const r = [...d.repayments];
                    r.splice(undoBuffer.index, 0, undoBuffer.item);
                    return r;
                })() }) : d);
            setDebts(next);
            persistAll({ debts: next });
        }
        setUndoBuffer(null);
    };
    useEffect(() => {
        if (!undoBuffer)
            return;
        const id = setTimeout(() => setUndoBuffer(null), 6000);
        return () => clearTimeout(id);
    }, [undoBuffer]);
    /* ---- custom categories ---- */
    const addCategory = (type, label, icon) => {
        const trimmed = label.trim();
        if (!trimmed)
            return;
        const key = `custom_${type}_${uid().slice(0, 8)}`;
        const item = { key, label: trimmed, icon: icon || "🔧" };
        if (type === "income") {
            const next = [...incomeCats, item];
            setIncomeCats(next);
            persistAll({ incomeCats: next });
        }
        else {
            const next = [...expenseCats, item];
            setExpenseCats(next);
            persistAll({ expenseCats: next });
        }
    };
    const updateCategory = (type, key, patch) => {
        if (type === "income") {
            const next = incomeCats.map((c) => (c.key === key ? Object.assign(Object.assign({}, c), patch) : c));
            setIncomeCats(next);
            persistAll({ incomeCats: next });
        }
        else {
            const next = expenseCats.map((c) => (c.key === key ? Object.assign(Object.assign({}, c), patch) : c));
            setExpenseCats(next);
            persistAll({ expenseCats: next });
        }
    };
    const deleteCategory = (type, key) => {
        if (type === "income") {
            const next = incomeCats.filter((c) => c.key !== key);
            setIncomeCats(next);
            persistAll({ incomeCats: next });
        }
        else {
            const next = expenseCats.filter((c) => c.key !== key);
            setExpenseCats(next);
            persistAll({ expenseCats: next });
        }
    };
    // reassigns every transaction using fromKey to toKey, then removes
    // fromKey from the category list — used when a category that's already
    // in use needs to go away. Historical transactions keep their amounts
    // and dates; only the category tag changes, so nothing is lost.
    const migrateCategory = (type, fromKey, toKey) => {
        const nextTx = transactions.map((t) => (t.type === type && t.category === fromKey ? Object.assign(Object.assign({}, t), { category: toKey }) : t));
        setTransactions(nextTx);
        if (type === "income") {
            const next = incomeCats.filter((c) => c.key !== fromKey);
            setIncomeCats(next);
            persistAll({ transactions: nextTx, incomeCats: next });
        }
        else {
            const next = expenseCats.filter((c) => c.key !== fromKey);
            setExpenseCats(next);
            persistAll({ transactions: nextTx, expenseCats: next });
        }
    };
    /* ---- per-category budgets ---- */
    const saveCategoryBudgets = (map) => {
        setCategoryBudgets(map);
        persistAll({ categoryBudgets: map });
    };
    /* ---- accounts / wallets (opening balances on top of METHODS) ---- */
    const saveAccountOpening = (map) => {
        setAccountOpening(map);
        persistAll({ accountOpening: map });
    };
    /* ---- PIN app lock ---- */
    const savePin = (newPin) => {
        setPin(newPin);
        persistDevice({ pin: newPin });
    };
    const addRepayment = (debtId, repayment) => {
        const next = debts.map((d) => d.id === debtId ? Object.assign(Object.assign({}, d), { repayments: [...d.repayments, Object.assign(Object.assign({}, repayment), { id: uid(), createdAt: Date.now() })] }) : d);
        setDebts(next);
        persistAll({ debts: next });
    };
    const updateRepayment = (debtId, repaymentId, patch) => {
        const next = debts.map((d) => d.id === debtId
            ? Object.assign(Object.assign({}, d), { repayments: d.repayments.map((r) => (r.id === repaymentId ? Object.assign(Object.assign({}, r), patch) : r)) })
            : d);
        setDebts(next);
        persistAll({ debts: next });
    };
    const deleteRepayment = (debtId, repaymentId) => {
        const debt = debts.find((d) => d.id === debtId);
        if (!debt)
            return;
        const idx = debt.repayments.findIndex((r) => r.id === repaymentId);
        if (idx === -1)
            return;
        const removed = debt.repayments[idx];
        const next = debts.map((d) => d.id === debtId ? Object.assign(Object.assign({}, d), { repayments: d.repayments.filter((r) => r.id !== repaymentId) }) : d);
        setDebts(next);
        persistAll({ debts: next });
        setUndoBuffer({ kind: "repayment", debtId, item: removed, index: idx });
    };
    // in-app reminder check (fires while this tab is open — a web app can't
    // reliably wake up in the background like a real phone alarm)
    useEffect(() => {
        const id = setInterval(() => {
            const now = new Date();
            const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
            const today = todayStr(now);
            let tasksChanged = false;
            const fired = [];
            const nextTasks = tasks.map((t) => {
                if (t.reminderTime && t.reminderDate === today && t.reminderTime === hhmm && !t.done && t.remindedAt !== today) {
                    tasksChanged = true;
                    fired.push(t.text);
                    return Object.assign(Object.assign({}, t), { remindedAt: today });
                }
                return t;
            });
            let debtsChanged = false;
            const nextDebts = debts.map((d) => {
                const remaining = d.amount - d.repayments.reduce((s, r) => s + r.amount, 0);
                if (d.dueDate === today && remaining > 0 && d.dueNotified !== today) {
                    debtsChanged = true;
                    const label = d.type === "receivable" ? `${d.person} এর কাছে পাওনা আজ ফেরত পাওয়ার কথা` : `${d.person} কে আজ পরিশোধ করার কথা`;
                    fired.push(label);
                    return Object.assign(Object.assign({}, d), { dueNotified: today });
                }
                return d;
            });
            // taxes get the exact same reminderDate/reminderTime check as
            // tasks above (both are computed by the same
            // computeTaskReminderFields helper from the Tax form)
            let taxesChanged = false;
            const nextTaxes = taxes.map((t) => {
                if (t.reminderTime && t.reminderDate === today && t.reminderTime === hhmm && !t.paid && t.remindedAt !== today) {
                    taxesChanged = true;
                    fired.push(`${t.name} — ${formatTaka(t.amount)}`);
                    return Object.assign(Object.assign({}, t), { remindedAt: today });
                }
                return t;
            });
            if (fired.length > 0) {
                setActiveReminder(fired.join(" · "));
                try {
                    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                        const title = `${dashboardTitle(profileName)} — রিমাইন্ডার`;
                        const body = fired.join(", ");
                        // prefer the service worker's showNotification — more
                        // reliable for an installed PWA (survives the tab
                        // losing focus) than the raw Notification constructor.
                        // Still requires the page/SW to be alive, though —
                        // true notify-while-fully-closed needs a push
                        // server, which this client-only app doesn't have.
                        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                            navigator.serviceWorker.ready
                                .then((reg) => reg.showNotification(title, { body, icon: "./icon-192.png" }))
                                .catch(() => { new Notification(title, { body }); });
                        }
                        else {
                            new Notification(title, { body });
                        }
                    }
                }
                catch (e) {
                    // Notification API unavailable in this environment — the in-app banner still shows
                }
            }
            if (tasksChanged || debtsChanged || taxesChanged) {
                setTasks(nextTasks);
                setDebts(nextDebts);
                if (taxesChanged) setTaxes(nextTaxes);
                persistAll(Object.assign({ tasks: nextTasks, debts: nextDebts }, taxesChanged ? { taxes: nextTaxes } : {}));
            }
        }, 20 * 1000);
        return () => clearInterval(id);
    }, [tasks, debts, taxes, transactions, budget, specialDays, persist]);
    const accounts = useMemo(() => computeAccountBalances(transactions, accountOpening, transfers, debts), [transactions, accountOpening, transfers, debts]);
    if (!loaded) {
        return (React.createElement("div", { style: styles.loadingScreen },
            React.createElement(FontLoader, null),
            React.createElement("div", { style: styles.loadingMonogram }, "\u09F3"),
            React.createElement("div", { style: styles.loadingBrand }, "\u09B9\u09BF\u09B8\u09BE\u09AC-\u0996\u09BE\u09A4\u09BE"),
            React.createElement("div", { style: styles.loadingTagline }, "\u099C\u09C0\u09AC\u09A8\u09C7\u09B0 \u09B9\u09BF\u09B8\u09BE\u09AC \u09A5\u09C7\u0995\u09C7 \u0986\u0996\u09BF\u09B0\u09BE\u09A4\u09C7\u09B0 \u09B9\u09BF\u09B8\u09BE\u09AC"),
            React.createElement("div", { style: styles.loadingSpinner }),
            React.createElement("div", { style: { fontFamily: "'Hind Siliguri', sans-serif", color: "var(--hk-text-on-dark-soft)", marginTop: 14, fontSize: 12.5 } }, "\u0996\u09BE\u09A4\u09BE \u0996\u09CB\u09B2\u09BE \u09B9\u099A\u09CD\u099B\u09C7\u2026")));
    }
    if (pin && !unlocked) {
        return (React.createElement("div", { style: styles.app },
            React.createElement(FontLoader, null),
            React.createElement(LockScreen, { pin: pin, onUnlock: () => setUnlocked(true), profileName: profileName })));
    }
    return (React.createElement(CatCtx.Provider, { value: { expenseCats, incomeCats } },
        React.createElement("div", { style: styles.app },
            React.createElement(FontLoader, null),
            React.createElement(Header, { transactions: transactions, onSettings: () => setShowSettings(true), tasks: tasks, onAddTask: addTask, onUpdateTask: updateTask, onToggleTask: toggleTask, onDeleteTask: deleteTask, onSetReminder: setTaskReminder, onOpenCalendar: () => setShowCalendar(true), profileName: profileName, onOpenMenu: () => setShowHamburgerMenu(true), onOpenNotifications: () => setShowNotificationCenter(true), unreadCount: totalUnreadCount, adminTasksCloud: adminTasksCloud, completedAdminTaskIds: completedAdminTaskIds, onToggleAdminTaskComplete: toggleAdminTaskComplete }),
            React.createElement("main", { style: styles.main },
                tab === "dashboard" && (React.createElement(Dashboard, { transactions: transactions, budget: budget, categoryBudgets: categoryBudgets, debts: debts, accounts: accounts, onEditBudget: () => setShowBudget(true), onOpenTx: (t) => setEditingTx(t), onGoDebts: () => setTab("debts"), onGoReports: () => setTab("reports"), onQuickAdd: (type) => {
                        setQuickAddType(type);
                        setShowAdd(true);
                    }, onTransfer: () => setShowTransfer(true), onTransferHistory: () => setShowTransferHistory(true), profileName: profileName, taxes: taxes, bazarItems: bazarItems })),
                tab === "timeline" && (React.createElement(Timeline, { transactions: transactions, onOpenTx: (t) => setEditingTx(t) })),
                tab === "debts" && (React.createElement(DebtsView, { debts: debts, onOpenDebt: (d) => setEditingDebt(d), onAddDebt: () => setShowAddDebt(true) })),
                tab === "family" && (React.createElement(FamilyHub, { user: user, onExpenseSync: syncFamilyBazarExpense, otherByMonth: otherExpenseByMonth, legacyProps: { familyMembers: familyMembers, bazarItems: bazarItems, transactions: transactions, onAddMember: addFamilyMember, onUpdateMember: updateFamilyMember, onDeleteMember: deleteFamilyMember, onAddBazarItem: addBazarItem, onUpdateBazarItem: updateBazarItem, onDeleteBazarItem: deleteBazarItem, onAddBazarItemAsExpense: addBazarItemAsExpense } })),
                tab === "reports" && React.createElement(Reports, { transactions: transactions, categoryBudgets: categoryBudgets, budget: budget, onSearch: (from, to) => { setSearchSeed({ dateFrom: from, dateTo: to, ts: Date.now() }); setTab("search"); } }),
                tab === "search" && (React.createElement(SearchView, { transactions: transactions, accounts: accounts, onOpenTx: (t) => setEditingTx(t), seed: searchSeed, familyMembers: familyMembers, userAccounts: userAccounts, debts: debts }))),
            (tab === "dashboard" || tab === "timeline" || tab === "debts") && (React.createElement("button", { style: styles.fab, onClick: () => (tab === "debts" ? setShowAddDebt(true) : setShowAdd(true)), "aria-label": tab === "debts" ? "নতুন দেনা-পাওনা যোগ করুন" : "নতুন লেনদেন যোগ করুন" }, "+")),
            React.createElement(BottomNav, { tab: tab, setTab: setTab }),
            showAdd && (React.createElement(TransactionForm, { presetType: quickAddType, onClose: () => {
                    setShowAdd(false);
                    setQuickAddType(null);
                }, onSave: (tx) => {
                    addTransaction(tx);
                    setShowAdd(false);
                    setQuickAddType(null);
                }, onCheckBalance: checkAccountBalance, userAccounts: userAccounts })),
            editingTx && (React.createElement(TransactionForm, { initial: editingTx, onClose: () => setEditingTx(null), onSave: (patch) => {
                    updateTransaction(editingTx.id, patch);
                    setEditingTx(null);
                }, onDelete: () => {
                    deleteTransaction(editingTx.id);
                    setEditingTx(null);
                }, onCheckBalance: checkAccountBalance, userAccounts: userAccounts })),
            showTransfer && (React.createElement(TransferForm, { onClose: () => setShowTransfer(false), onSave: (tr) => {
                    addTransfer(tr);
                    setShowTransfer(false);
                }, onCheckBalance: checkTransferBalance, onCheckDynamicBalance: checkDynamicTransferBalance, userAccounts: userAccounts })),
            editingTransfer && (React.createElement(TransferForm, { initial: editingTransfer, onClose: () => setEditingTransfer(null), onSave: (patch) => {
                    updateTransfer(editingTransfer.id, patch);
                    setEditingTransfer(null);
                }, onDelete: () => {
                    deleteTransfer(editingTransfer.id);
                    setEditingTransfer(null);
                }, onCheckBalance: checkTransferBalance, onCheckDynamicBalance: checkDynamicTransferBalance, userAccounts: userAccounts })),
            showTransferHistory && (React.createElement(TransferHistoryModal, { transfers: transfers, onClose: () => setShowTransferHistory(false), onDelete: deleteTransfer, onEdit: (tr) => setEditingTransfer(tr), userAccounts: userAccounts })),
            showBudget && (React.createElement(BudgetModal, { current: budget, categoryBudgets: categoryBudgets, onClose: () => setShowBudget(false), onSave: (v) => {
                    saveBudget(v);
                    setShowBudget(false);
                }, onSaveCategoryBudgets: saveCategoryBudgets })),
            showCalendar && (React.createElement(CalendarModal, { specialDays: specialDays, onSaveSpecialDays: saveSpecialDays, onClose: () => closeMenuPanel(setShowCalendar), onRegisterBackHandler: (fn) => { calendarBackConsumedRef.current = fn; }, adminSpecialDays: adminSpecialDaysCloud })),
            showAddDebt && (React.createElement(DebtForm, { onClose: () => setShowAddDebt(false), onSave: (d) => {
                    addDebt(d);
                    setShowAddDebt(false);
                } })),
            editingDebt && (React.createElement(DebtDetail, { debt: debts.find((d) => d.id === editingDebt.id) || editingDebt, onClose: () => setEditingDebt(null), onUpdate: (patch) => updateDebt(editingDebt.id, patch), onDelete: () => {
                    deleteDebt(editingDebt.id);
                    setEditingDebt(null);
                }, onAddRepayment: (r) => addRepayment(editingDebt.id, r), onUpdateRepayment: (rid, patch) => updateRepayment(editingDebt.id, rid, patch), onDeleteRepayment: (rid) => deleteRepayment(editingDebt.id, rid), onRegisterBackHandler: (fn) => { debtDetailBackConsumedRef.current = fn; }, userAccounts: userAccounts, checkRepaymentBalance: checkRepaymentBalance, checkDynamicRepaymentBalance: checkDynamicRepaymentBalance })),
            showSettings && (React.createElement(SettingsModal, { transactions: transactions, budget: budget, specialDays: specialDays, onSaveSpecialDays: saveSpecialDays, onClose: () => closeMenuPanel(setShowSettings), onEditBudget: () => {
                    setShowSettings(false);
                    setShowBudget(true);
                }, onClearAll: () => {
                    clearAll();
                    setShowSettings(false);
                }, accounts: accounts, accountOpening: accountOpening, onSaveAccountOpening: saveAccountOpening, onAddCategory: addCategory, onUpdateCategory: updateCategory, onDeleteCategory: deleteCategory, onMigrateCategory: migrateCategory, pin: pin, onSavePin: savePin, onImportTransactions: (rows) => {
                    const next = [...transactions, ...rows.map((r) => (Object.assign(Object.assign({}, r), { id: uid(), createdAt: Date.now() })))];
                    setTransactions(next);
                    persistAll({ transactions: next });
                }, theme: theme, onSaveTheme: saveTheme, user: user, syncStatus: syncStatus, lastSyncedAt: lastSyncedAt, onShowLogin: () => {
                    setShowSettings(false);
                    setShowLogin(true);
                }, onLogout: logOut, onManualSync: manualSync, onRestoreFromCloud: restoreFromCloud, onPreviewCloudVsLocal: previewCloudVsLocal, isOnline: isOnline, pendingChanges: pendingChanges, onExportJSON: exportBackupJSON, onImportJSON: importBackupJSON, profileName: profileName, onSaveProfileName: saveProfileName, autoSync: autoSync, onSaveAutoSync: saveAutoSync, notificationPermission: notificationPermission, onRequestNotificationPermission: requestNotificationPermission, auditLog: auditLog })),
            showLogin && (React.createElement(LoginScreen, { onClose: () => setShowLogin(false), onSignedIn: () => setShowLogin(false) })),
            showHamburgerMenu && (React.createElement(HamburgerMenu, {
                onClose: () => setShowHamburgerMenu(false),
                // these five open a useBackOverlay-tracked overlay — closing
                // the hamburger (which pops its own history entry via
                // history.back()) and pushing a new entry for the next
                // overlay in the SAME synchronous batch is a real race:
                // history.back() targets a specific pre-recorded entry, and
                // if a pushState from the newly-opening overlay lands in
                // front of it before the browser processes the back
                // navigation, back() ends up traversing past the new
                // overlay's entry too, closing it immediately. Deferring
                // the open by one tick lets the hamburger's close (and its
                // real, async back-navigation) fully finish first, so the
                // new overlay's own push always lands cleanly on top.
                // onOpenSettings/onOpenCalendar are NOT changed — they use
                // the separate, pre-existing modal-stack system, not
                // useBackOverlay, and were not reported as affected.
                onOpenNotifications: () => { menuOriginRef.current = true; setShowHamburgerMenu(false); setTimeout(() => setShowNotificationCenter(true), 0); },
                onOpenSettings: () => { menuOriginRef.current = true; setShowHamburgerMenu(false); setShowSettings(true); },
                onOpenCalendar: () => { menuOriginRef.current = true; setShowHamburgerMenu(false); setShowCalendar(true); },
                onOpenFAQ: () => { menuOriginRef.current = true; setShowHamburgerMenu(false); setTimeout(() => setShowFAQ(true), 0); },
                onOpenTax: () => { menuOriginRef.current = true; setShowHamburgerMenu(false); setTimeout(() => setShowTaxPanel(true), 0); },
                onOpenAccounts: () => { menuOriginRef.current = true; setShowHamburgerMenu(false); setTimeout(() => setShowAccountPanel(true), 0); },
                familyInvites: famAlerts.count,
                onOpenFamilyBazar: () => { menuOriginRef.current = true; setShowHamburgerMenu(false); setTimeout(() => setShowFamilyBazar(true), 0); },
                onOpenKhasra: () => { menuOriginRef.current = true; setShowHamburgerMenu(false); setTimeout(() => setShowKhasra(true), 0); },
                isAdminUser: isAdmin(user),
                onOpenAdmin: () => { menuOriginRef.current = true; setShowHamburgerMenu(false); setTimeout(() => setShowAdminPanel(true), 0); },
                unreadCount: totalUnreadCount,
            })),
            showFAQ && React.createElement(FAQModal, { onClose: () => closeMenuPanel(setShowFAQ), faqCloud: faqCloud }),
            showTaxPanel && (React.createElement(TaxPanel, { onClose: () => closeMenuPanel(setShowTaxPanel), taxes: taxes, onAdd: addTax, onUpdate: updateTax, onDelete: deleteTax, onTogglePaid: toggleTaxPaid })),
            showAccountPanel && (React.createElement(AccountPanel, { onClose: () => closeMenuPanel(setShowAccountPanel), dynamicAccountBalances: dynamicAccountBalances, onAdd: addUserAccount, onUpdate: updateUserAccount, onDelete: deleteUserAccount, onToggleActive: toggleUserAccountActive, onViewTransactions: (id) => { setShowAccountPanel(false); setSearchSeed({ accountId: id, ts: Date.now() }); setTab("search"); } })),
            showKhasra && React.createElement(KhasraKhataModule, { onClose: () => closeMenuPanel(setShowKhasra), storageId: user && user.uid ? user.uid : "guest", registerBack: (fn) => { khasraBackRef.current = fn; } }),
            showFamilyBazar && React.createElement(FamilyBazarModule, { onClose: () => closeMenuPanel(setShowFamilyBazar), user: user, onExpenseSync: syncFamilyBazarExpense, otherByMonth: otherExpenseByMonth, legacyProps: { familyMembers: familyMembers, bazarItems: bazarItems, transactions: transactions, onAddMember: addFamilyMember, onUpdateMember: updateFamilyMember, onDeleteMember: deleteFamilyMember, onAddBazarItem: addBazarItem, onUpdateBazarItem: updateBazarItem, onDeleteBazarItem: deleteBazarItem, onAddBazarItemAsExpense: addBazarItemAsExpense } }),
            showNotificationCenter && (React.createElement(NotificationCenter, {
                onClose: () => closeMenuPanel(setShowNotificationCenter),
                notices: notices, dailyMessages: dailyMessages, tasks: tasks, debts: debts,
                specialDays: specialDays, adminSpecialDaysCloud: adminSpecialDaysCloud, adminTasksCloud: adminTasksCloud, taxes: taxes,
                readNoticeIds: readNoticeIds, readDailyMessageIds: readDailyMessageIds, dismissedDailyMessageIds: dismissedDailyMessageIds,
                onMarkNoticeRead: markNoticeRead, onMarkDailyMessageRead: markDailyMessageRead,
                onDismissDailyMessage: dismissDailyMessage, onMarkAllRead: markAllRead,
            })),
            showAdminPanel && isAdmin(user) && (React.createElement(AdminPanel, {
                onClose: () => closeMenuPanel(setShowAdminPanel),
                notices: notices, dailyMessages: dailyMessages, adminSpecialDaysCloud: adminSpecialDaysCloud, adminTasksCloud: adminTasksCloud, faqCloud: faqCloud,
                loading: adminContentLoading, error: adminContentError, onRefresh: fetchAdminContent,
                onAddNotice: adminAddNotice, onUpdateNotice: adminUpdateNotice, onDeleteNotice: adminDeleteNotice,
                onAddDailyMessage: adminAddDailyMessage, onUpdateDailyMessage: adminUpdateDailyMessage, onDeleteDailyMessage: adminDeleteDailyMessage,
                onAddSpecialDay: adminAddSpecialDay, onUpdateSpecialDay: adminUpdateSpecialDay, onDeleteSpecialDay: adminDeleteSpecialDay,
                onBulkImport: adminBulkImportSpecialDays,
                onAddTask: adminAddTask, onUpdateTask: adminUpdateTask, onDeleteTask: adminDeleteTask,
                onAddFaq: adminAddFaq, onUpdateFaq: adminUpdateFaq, onDeleteFaq: adminDeleteFaq,
            })),
            saveErr && (React.createElement("div", { style: styles.saveErrBanner }, "\u09B8\u0982\u09B0\u0995\u09CD\u09B7\u09A3\u09C7 \u09B8\u09AE\u09B8\u09CD\u09AF\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7, \u0986\u09AC\u09BE\u09B0 \u099A\u09C7\u09B7\u09CD\u099F\u09BE \u0995\u09B0\u09C1\u09A8")),
            activeReminder && (React.createElement("div", { style: styles.reminderBanner, onClick: () => setActiveReminder(null) },
                React.createElement("span", { style: { fontSize: 16 } }, "\u23F0"),
                React.createElement("span", { style: { flex: 1 } }, activeReminder),
                React.createElement("span", { style: styles.reminderBannerClose }, "\u2715"))),
            undoBuffer && (React.createElement("div", { style: styles.undoBanner },
                React.createElement("span", null, undoBuffer.kind === "transaction"
                    ? "এন্ট্রি মুছে ফেলা হয়েছে"
                    : undoBuffer.kind === "transfer"
                        ? "স্থানান্তর মুছে ফেলা হয়েছে"
                        : undoBuffer.kind === "repayment"
                            ? "পরিশোধ মুছে ফেলা হয়েছে"
                            : "দেনা-পাওনা মুছে ফেলা হয়েছে"),
                React.createElement("button", { style: styles.undoBtn, onClick: undoLastDelete }, "\u09AB\u09BF\u09B0\u09BF\u09AF\u09BC\u09C7 \u0986\u09A8\u09C1\u09A8"))))));
}
/* ---------------- fonts ---------------- */
function FontLoader() {
    useEffect(() => {
        if (document.getElementById("hk-fonts"))
            return;
        const link = document.createElement("link");
        link.id = "hk-fonts";
        link.rel = "stylesheet";
        link.href =
            "https://fonts.googleapis.com/css2?family=Tiro+Bangla&family=Hind+Siliguri:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap";
        document.head.appendChild(link);
    }, []);
    return null;
}
/* ---------------- pin lock screen ---------------- */
/* ---------------- login screen (Google + email/password) ---------------- */
function LoginScreen({ onClose, onSignedIn }) {
    const [mode, setMode] = useState("login"); // "login" | "signup" | "reset"
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");
    const [msg, setMsg] = useState("");
    const [busy, setBusy] = useState(false);
    const fbReady = typeof window !== "undefined" && !!window.FB;
    const runGoogle = async () => {
        setErr("");
        setBusy(true);
        try {
            await window.FB.signInGoogle();
            onSignedIn();
        }
        catch (e) {
            setErr(friendlyAuthError(e));
        }
        finally {
            setBusy(false);
        }
    };
    const submitEmail = async () => {
        setErr("");
        setMsg("");
        if (!email.trim() || (mode !== "reset" && !password)) {
            setErr("ইমেইল ও পাসওয়ার্ড লিখুন");
            return;
        }
        setBusy(true);
        try {
            if (mode === "login") {
                await window.FB.signInEmail(email.trim(), password);
                onSignedIn();
            }
            else if (mode === "signup") {
                await window.FB.signUpEmail(email.trim(), password);
                onSignedIn();
            }
            else if (mode === "reset") {
                await window.FB.resetPassword(email.trim());
                setMsg("পাসওয়ার্ড রিসেট লিংক ইমেইলে পাঠানো হয়েছে");
            }
        }
        catch (e) {
            setErr(friendlyAuthError(e));
        }
        finally {
            setBusy(false);
        }
    };
    return (React.createElement(ModalShell, { onClose: onClose, title: "\u09B9\u09BF\u09B8\u09BE\u09AC \u0996\u09BE\u09A4\u09BE" },
        React.createElement("div", { style: styles.loginTagline }, APP_TAGLINE),
        !fbReady && (React.createElement("div", { style: styles.formHint }, "\u0995\u09CD\u09B2\u09BE\u0989\u09A1 \u09B8\u0982\u09AF\u09CB\u0997 \u09B2\u09CB\u09A1 \u09B9\u099A\u09CD\u099B\u09C7 \u09AC\u09BE \u0987\u09A8\u09CD\u099F\u09BE\u09B0\u09A8\u09C7\u099F \u09A8\u09C7\u0987 \u2014 \u098F\u0995\u099F\u09C1 \u09AA\u09B0 \u0986\u09AC\u09BE\u09B0 \u099A\u09C7\u09B7\u09CD\u099F\u09BE \u0995\u09B0\u09C1\u09A8\u0964 \u098F\u09A6\u09BF\u0995\u09C7 \u0985\u09CD\u09AF\u09BE\u09AA \u09B8\u09CD\u09AC\u09BE\u09AD\u09BE\u09AC\u09BF\u0995\u09AD\u09BE\u09AC\u09C7\u0987 \u09B8\u09CD\u09A5\u09BE\u09A8\u09C0\u09AF\u09BC\u09AD\u09BE\u09AC\u09C7 (\u098F\u0987 \u09A1\u09BF\u09AD\u09BE\u0987\u09B8\u09C7) \u0995\u09BE\u099C \u0995\u09B0\u09AC\u09C7\u0964")),
        React.createElement("button", { style: styles.googleBtn, onClick: runGoogle, disabled: !fbReady || busy },
            React.createElement("span", { style: styles.googleG }, "G"),
            " Continue with Google"),
        React.createElement("div", { style: styles.loginDivider },
            React.createElement("span", null, "\u0985\u09A5\u09AC\u09BE")),
        React.createElement("div", { style: styles.formLabel }, "\u0987\u09AE\u09C7\u0987\u09B2"),
        React.createElement("input", { style: styles.textInput, type: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: "you@example.com" }),
        mode !== "reset" && (React.createElement(React.Fragment, null,
            React.createElement("div", { style: styles.formLabel }, "\u09AA\u09BE\u09B8\u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u09A1"),
            React.createElement("input", { style: styles.textInput, type: "password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" }))),
        err ? React.createElement("div", { style: styles.formErr }, err) : null,
        msg ? React.createElement("div", { style: styles.formHint }, msg) : null,
        React.createElement("div", { style: styles.formActions },
            React.createElement("button", { style: styles.saveBtn, onClick: submitEmail, disabled: !fbReady || busy }, mode === "login" ? "লগইন করুন" : mode === "signup" ? "নতুন অ্যাকাউন্ট খুলুন" : "রিসেট লিংক পাঠান")),
        React.createElement("div", { style: styles.loginLinksRow },
            mode !== "login" && React.createElement("button", { style: styles.loginLink, onClick: () => { setMode("login"); setErr(""); setMsg(""); } }, "\u09B2\u0997\u0987\u09A8 \u0995\u09B0\u09C1\u09A8"),
            mode !== "signup" && React.createElement("button", { style: styles.loginLink, onClick: () => { setMode("signup"); setErr(""); setMsg(""); } }, "\u09A8\u09A4\u09C1\u09A8 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u0996\u09C1\u09B2\u09C1\u09A8"),
            mode !== "reset" && React.createElement("button", { style: styles.loginLink, onClick: () => { setMode("reset"); setErr(""); setMsg(""); } }, "\u09AA\u09BE\u09B8\u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u09A1 \u09AD\u09C1\u09B2\u09C7 \u0997\u09C7\u099B\u09C7\u09A8?"))));
}
function friendlyAuthError(e) {
    const code = (e && e.code) || "";
    const map = {
        "auth/invalid-email": "সঠিক ইমেইল ঠিকানা দিন",
        "auth/user-not-found": "এই ইমেইলে কোনো অ্যাকাউন্ট নেই",
        "auth/wrong-password": "ভুল পাসওয়ার্ড",
        "auth/invalid-credential": "ইমেইল বা পাসওয়ার্ড ভুল",
        "auth/email-already-in-use": "এই ইমেইলে আগে থেকেই অ্যাকাউন্ট আছে",
        "auth/weak-password": "পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে",
        "auth/popup-closed-by-user": "সাইন-ইন বাতিল করা হয়েছে",
        "auth/network-request-failed": "ইন্টারনেট সংযোগ পরীক্ষা করুন",
    };
    return map[code] || "কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন";
}
function LockScreen({ pin, onUnlock, profileName }) {
    const [entry, setEntry] = useState("");
    const [err, setErr] = useState(false);
    const press = (d) => {
        if (entry.length >= 4)
            return;
        const next = entry + d;
        setEntry(next);
        setErr(false);
        if (next.length === 4) {
            if (next === pin) {
                setTimeout(() => onUnlock(), 120);
            }
            else {
                setErr(true);
                setTimeout(() => setEntry(""), 400);
            }
        }
    };
    return (React.createElement("div", { style: styles.lockScreen },
        React.createElement("div", { style: styles.lockTitle },
            React.createElement(Icon, { name: "security", size: 17, style: { verticalAlign: "-3px", marginRight: 5 } }),
            " ",
            dashboardTitle(profileName),
            " \u09B2\u0995 \u0995\u09B0\u09BE \u0986\u099B\u09C7"),
        React.createElement("div", { style: styles.lockSub }, err ? "ভুল পিন, আবার চেষ্টা করুন" : "৪ সংখ্যার পিন দিন"),
        React.createElement("div", { style: styles.lockDotsRow }, [0, 1, 2, 3].map((i) => (React.createElement("div", { key: i, style: Object.assign(Object.assign({}, styles.lockDot), { background: i < entry.length ? "var(--hk-gold)" : "transparent" }) })))),
        React.createElement("div", { style: styles.lockPad }, ["১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯", "", "০", "⌫"].map((d, i) => (React.createElement("button", { key: i, style: Object.assign(Object.assign({}, styles.lockKey), { visibility: d === "" ? "hidden" : "visible" }), onClick: () => {
                if (d === "⌫")
                    setEntry((v) => v.slice(0, -1));
                else if (d !== "")
                    press(String(BN_DIGITS.indexOf(d)));
            } }, d))))));
}
function Header({ transactions, onSettings, tasks, onAddTask, onUpdateTask, onToggleTask, onDeleteTask, onSetReminder, onOpenCalendar, profileName, onOpenMenu, onOpenNotifications, unreadCount, adminTasksCloud, completedAdminTaskIds, onToggleAdminTaskComplete }) {
    const [showTasks, setShowTasks] = useState(false);
    useBackOverlay(showTasks, () => setShowTasks(false));
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    useBackOverlay(showTaskForm, () => setShowTaskForm(false));
    const taskCats = useCategories();
    const [newTask, setNewTask] = useState("");
    const [newTaskCategory, setNewTaskCategory] = useState("");
    const [reminderEditId, setReminderEditId] = useState(null);
    const [reminderDateVal, setReminderDateVal] = useState("");
    const [reminderTimeVal, setReminderTimeVal] = useState("");
    // completing a task (check mark) marks it done but keeps it in `tasks`
    // (so the existing MAX_TASKS cap and history are unaffected) — it just
    // drops out of the visible active list immediately.
    const activeTasks = tasks.filter((t) => !t.done);
    const activeAdminTasks = (adminTasksCloud || []).filter((t) => t.published !== false && !(completedAdminTaskIds || []).includes(t.id));
    const balance = useMemo(() => transactions.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0), [transactions]);
    const doneCount = tasks.filter((t) => t.done).length;
    const submitTask = () => {
        if (!newTask.trim() || tasks.length >= MAX_TASKS)
            return;
        // quick-add now offers the same সাব-ক্যাটেগরি list as "বিস্তারিত
        // টাস্ক" and Admin Task Management (taskCats.expenseCats, below) —
        // so all 3 places a user can add a task share one identical list.
        onAddTask({ text: newTask, category: newTaskCategory || null });
        setNewTask("");
        setNewTaskCategory("");
    };
    const openReminderEdit = (t) => {
        setReminderEditId(t.id);
        setReminderDateVal(t.reminderDate || todayStr());
        setReminderTimeVal(t.reminderTime || "");
    };
    const saveReminder = () => {
        onSetReminder(reminderEditId, reminderDateVal || todayStr(), reminderTimeVal || null);
        setReminderEditId(null);
    };
    const clearReminder = (t) => {
        onSetReminder(t.id, null, null);
    };
    return (React.createElement("header", { style: styles.header },
        React.createElement("div", { style: styles.headerPerf }, Array.from({ length: 14 }).map((_, i) => (React.createElement("span", { key: i, style: styles.perfDot })))),
        React.createElement("button", { onClick: onOpenMenu, "aria-label": "\u09AE\u09C7\u09A8\u09C1", style: { position: "absolute", top: 14, left: 14, zIndex: 2, background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, width: 32, height: 32, color: "var(--hk-text-on-dark)", fontSize: 16, lineHeight: "32px" } }, "\u2630"),
        React.createElement("div", { style: styles.headerContent },
            React.createElement("div", { style: { marginLeft: 40 } },
                React.createElement("div", { style: styles.headerEyebrow }, dashboardTitle(profileName)),
                React.createElement("div", { style: styles.headerBalanceLabel }, "\u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8"),
                React.createElement("div", { style: Object.assign(Object.assign({}, styles.headerBalance), { color: balance < 0 ? "#E38477" : balance > 0 ? "#7FCB9D" : "var(--hk-text-on-dark)" }) }, formatTaka(balance, { sign: true, symbol: false }))),
            React.createElement("div", { style: { position: "relative", display: "flex", gap: 8 } },
                React.createElement("button", { style: styles.iconLabelBtn, onClick: onOpenCalendar },
                    React.createElement("span", { style: styles.iconLabelIcon }, "\uD83D\uDCC5"),
                    React.createElement("span", { style: styles.iconLabelText }, "Calendar")),
                React.createElement("button", { style: styles.iconLabelBtn, onClick: () => setShowTasks((v) => !v) },
                    React.createElement("span", { style: { position: "relative" } },
                        React.createElement("span", { style: styles.iconLabelIcon }, "\uD83D\uDCCB"),
                        tasks.length > 0 && (React.createElement("span", { style: styles.taskBadge },
                            toBnDigits(doneCount),
                            "/",
                            toBnDigits(tasks.length)))),
                    React.createElement("span", { style: styles.iconLabelText }, "Tasks")),
                React.createElement("button", { style: Object.assign(Object.assign({}, styles.settingsBtn), { position: "relative" }), onClick: onOpenNotifications, "aria-label": "\u09A8\u09CB\u099F\u09BF\u09AB\u09BF\u0995\u09C7\u09B6\u09A8" }, "\uD83D\uDD14", unreadCount > 0 && (React.createElement("span", { style: { position: "absolute", top: -3, right: -3, background: "var(--hk-danger)", color: "#fff", fontSize: 10, borderRadius: 999, padding: "0 4px", minWidth: 14, lineHeight: "15px", textAlign: "center" } }, unreadCount > 9 ? "9+" : unreadCount))),
                React.createElement("button", { style: styles.settingsBtn, onClick: onSettings, "aria-label": "\u09B8\u09C7\u099F\u09BF\u0982\u09B8" }, "\u2699"),
                showTasks && (React.createElement(React.Fragment, null,
                    React.createElement("div", { style: styles.taskBackdrop, onClick: () => { setShowTasks(false); setReminderEditId(null); } }),
                    React.createElement("div", { style: styles.taskDropdown },
                        React.createElement("div", { style: styles.taskDropdownTitle },
                            "\u099B\u09CB\u099F \u0995\u09BE\u099C (",
                            toBnDigits(tasks.length),
                            "/",
                            toBnDigits(MAX_TASKS),
                            ")"),
                        React.createElement("div", { style: { fontSize: 11.5, fontWeight: 700, color: "var(--hk-text-muted)", marginBottom: 4 } }, "\uD83D\uDC64 \u0986\u09AE\u09BE\u09B0 \u099F\u09BE\u09B8\u09CD\u0995"),
                        tasks.length === 0 ? (React.createElement("div", { style: styles.taskEmpty }, "\u098F\u0996\u09A8\u09CB \u0995\u09CB\u09A8\u09CB \u0995\u09BE\u099C \u09AF\u09CB\u0997 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09A8\u09BF\u0964")) : activeTasks.length === 0 ? (React.createElement("div", { style: styles.taskEmpty }, "\u09B8\u09AC \u0995\u09BE\u099C \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964")) : (React.createElement("div", { style: styles.taskList }, activeTasks.map((t) => (React.createElement("div", { key: t.id },
                            React.createElement("div", { style: styles.taskItem },
                                React.createElement("button", { style: styles.taskCheck, onClick: () => onToggleTask(t.id) }, t.done ? "☑" : "☐"),
                                React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                                    React.createElement("div", { style: Object.assign(Object.assign({}, styles.taskText), { textDecoration: t.done ? "line-through" : "none", color: t.done ? "var(--hk-border-med2)" : "var(--hk-text)" }) }, t.text),
                                    t.category && React.createElement("div", { style: { fontSize: 11, color: "var(--hk-text-muted)", marginTop: 1 } }, catInfo("expense", t.category, taskCats).label),
                                    t.note && React.createElement("div", { style: { fontSize: 11, color: "var(--hk-text-muted)", marginTop: 1 } }, t.note)),
                                React.createElement("button", { style: styles.taskDelete, onClick: () => { setEditingTask(t); setShowTaskForm(true); }, "aria-label": "\u09B8\u09AE\u09CD\u09AA\u09BE\u09A6\u09A8\u09BE" }, "\u270E"),
                                React.createElement("button", { style: Object.assign(Object.assign({}, styles.taskReminderBtn), { color: t.reminderTime ? "var(--hk-gold)" : "var(--hk-border-med)" }), onClick: () => openReminderEdit(t), "aria-label": "\u09B0\u09BF\u09AE\u09BE\u0987\u09A8\u09CD\u09A1\u09BE\u09B0" }, "\u23F0"),
                                React.createElement("button", { style: styles.taskDelete, onClick: () => onDeleteTask(t.id) }, "\u2715")),
                            t.reminderTime && reminderEditId !== t.id && (React.createElement("div", { style: styles.reminderTimeTag },
                                "\u09B0\u09BF\u09AE\u09BE\u0987\u09A8\u09CD\u09A1\u09BE\u09B0: ",
                                formatDateBn(t.reminderDate || todayStr()).day,
                                " ",
                                formatDateBn(t.reminderDate || todayStr()).month,
                                ", ",
                                toBnDigits(t.reminderTime),
                                React.createElement("button", { style: styles.reminderClearBtn, onClick: () => clearReminder(t) }, "\u09AC\u09BE\u09A4\u09BF\u09B2"))),
                            reminderEditId === t.id && (React.createElement("div", { style: styles.reminderEditRow },
                                React.createElement("input", { type: "date", style: styles.reminderTimeInput, value: reminderDateVal, min: todayStr(), onChange: (e) => setReminderDateVal(e.target.value) }),
                                React.createElement("input", { type: "time", style: styles.reminderTimeInput, value: reminderTimeVal, onChange: (e) => setReminderTimeVal(e.target.value) }),
                                React.createElement("button", { style: styles.taskAddBtn, onClick: saveReminder }, "\u2713")))))))),
                        activeAdminTasks.length > 0 && (React.createElement("div", { style: { marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--hk-border-light)" } },
                            React.createElement("div", { style: { fontSize: 11.5, fontWeight: 700, color: "var(--hk-gold)", marginBottom: 4 } }, "\u2B50 \u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u099F\u09BE\u09B8\u09CD\u0995"),
                            React.createElement("div", { style: styles.taskList }, activeAdminTasks.map((t) => (React.createElement("div", { key: t.id, style: styles.taskItem },
                                React.createElement("button", { style: styles.taskCheck, onClick: () => onToggleAdminTaskComplete(t.id) }, "\u2610"),
                                React.createElement("span", { style: Object.assign(Object.assign({}, styles.taskText), { flex: 1 }) }, t.title),
                                t.dueDate && React.createElement("span", { style: { fontSize: 11, color: "var(--hk-text-muted)" } }, formatDateBn(t.dueDate).full))))))),
                        React.createElement("div", { style: styles.reminderHint }, "\u0985\u09CD\u09AF\u09BE\u09AA \u0996\u09CB\u09B2\u09BE \u09A5\u09BE\u0995\u09BE \u0985\u09AC\u09B8\u09CD\u09A5\u09BE\u09AF\u09BC \u09A8\u09BF\u09B0\u09CD\u09A6\u09BF\u09B7\u09CD\u099F \u09B8\u09AE\u09AF\u09BC\u09C7 \u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09A8\u09C7 \u09B8\u09A4\u09B0\u09CD\u0995\u09A4\u09BE \u09A6\u09C7\u0996\u09BE\u09AC\u09C7\u0964"),
                        tasks.length < MAX_TASKS && (React.createElement("div", { style: styles.taskAddRow },
                            React.createElement("select", { style: styles.taskCatSelect, value: newTaskCategory, onChange: (e) => setNewTaskCategory(e.target.value), "aria-label": "সাব-ক্যাটেগরি" },
                                React.createElement("option", { value: "" }, "ক্যাটেগরি"),
                                (taskCats.expenseCats || []).map((c) => React.createElement("option", { key: c.key, value: c.key }, c.label))),
                            React.createElement("input", { style: styles.taskInput, placeholder: "\u09A8\u09A4\u09C1\u09A8 \u0995\u09BE\u099C \u09B2\u09BF\u0996\u09C1\u09A8\u2026", value: newTask, onChange: (e) => setNewTask(e.target.value), onKeyDown: (e) => e.key === "Enter" && submitTask() }),
                            React.createElement("button", { style: styles.taskAddBtn, onClick: submitTask }, "+")),
                        tasks.length < MAX_TASKS && (React.createElement("button", { style: { fontSize: 11.5, color: "var(--hk-gold)", background: "none", border: "none", marginTop: 6, padding: 0 }, onClick: () => { setEditingTask(null); setShowTaskForm(true); } }, "+ \u09AC\u09BF\u09B8\u09CD\u09A4\u09BE\u09B0\u09BF\u09A4 \u099F\u09BE\u09B8\u09CD\u0995 (\u09A4\u09BE\u09B0\u09BF\u0996, \u09B8\u09BE\u09AC-\u0995\u09CD\u09AF\u09BE\u099F\u09C7\u0997\u09B0\u09BF, \u09B0\u09BF\u09AE\u09BE\u0987\u09A8\u09CD\u09A1\u09BE\u09B0)")),
                        showTaskForm && (React.createElement(TaskForm, { initial: editingTask, onClose: () => setShowTaskForm(false), onSave: (data) => { editingTask ? onUpdateTask(editingTask.id, data) : onAddTask(data); setShowTaskForm(false); } }))))))))));
}
/* ---------------- dashboard ---------------- */
function Dashboard({ transactions, budget, categoryBudgets, debts, accounts, onEditBudget, onOpenTx, onGoDebts, onGoReports, onQuickAdd, onTransfer, onTransferHistory, profileName, taxes, bazarItems }) {
    const cats = useCategories();
    const today = todayStr();
    const thisMonthKey = monthKeyOf(today);
    const now = new Date();
    const daysInThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = monthKeyOf(todayStr(lastMonthDate));
    const sevenDaysAgo = shiftDate(today, -6);
    const stats = useMemo(() => {
        let monthIncome = 0, monthExpense = 0, todayIncome = 0, todayExpense = 0, lastMonthExpense = 0, allIncome = 0, allExpense = 0, last7Expense = 0;
        const catTotals = {};
        const lastMonthCatTotals = {};
        for (const t of transactions) {
            const inMonth = monthKeyOf(t.date) === thisMonthKey;
            const inLastMonth = monthKeyOf(t.date) === lastMonthKey;
            const isToday = t.date === today;
            if (t.type === "income")
                allIncome += t.amount;
            else
                allExpense += t.amount;
            if (inMonth) {
                if (t.type === "income")
                    monthIncome += t.amount;
                else {
                    monthExpense += t.amount;
                    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
                }
            }
            if (inLastMonth && t.type === "expense") {
                lastMonthExpense += t.amount;
                lastMonthCatTotals[t.category] = (lastMonthCatTotals[t.category] || 0) + t.amount;
            }
            if (isToday) {
                if (t.type === "income")
                    todayIncome += t.amount;
                else
                    todayExpense += t.amount;
            }
            if (t.type === "expense" && t.date >= sevenDaysAgo && t.date <= today)
                last7Expense += t.amount;
        }
        const topCats = Object.entries(catTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([key, amount]) => ({ key, amount, info: catInfo("expense", key, cats) }));
        return {
            monthIncome, monthExpense, todayIncome, todayExpense, lastMonthExpense,
            allIncome, allExpense, topCats, catTotals, lastMonthCatTotals, last7Expense,
        };
    }, [transactions, thisMonthKey, lastMonthKey, today, sevenDaysAgo, cats]);
    const availableBalance = stats.allIncome - stats.allExpense;
    const monthSavings = stats.monthIncome - stats.monthExpense;
    const budgetPct = budget > 0 ? Math.min(999, Math.round((stats.monthExpense / budget) * 100)) : null;
    const budgetLeft = budget - stats.monthExpense;
    const daysLeftInMonth = Math.max(1, daysInThisMonth - dayOfMonth + 1);
    const safeSpendToday = budget > 0 ? Math.max(0, budgetLeft / daysLeftInMonth) : null;
    const monthPctElapsed = Math.round((dayOfMonth / daysInThisMonth) * 100);
    const dailyAvgSoFar = dayOfMonth > 0 ? stats.monthExpense / dayOfMonth : 0;
    const forecastMonthExpense = dailyAvgSoFar * daysInThisMonth;
    const momChangePct = stats.lastMonthExpense > 0
        ? Math.round(((stats.monthExpense - stats.lastMonthExpense) / stats.lastMonthExpense) * 100)
        : null;
    const savingsRatePct = stats.monthIncome > 0 ? Math.round((monthSavings / stats.monthIncome) * 100) : null;
    const recent = useMemo(() => [...transactions]
        .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : b.createdAt - a.createdAt))
        .slice(0, 5), [transactions]);
    // fixed greeting (no time-of-day variants) — always the same Islamic
    // greeting with the person's own name, per their explicit preference
    const greeting = useMemo(() => ({ text: `আসসালামু আলাইকুম। 😊 ${(profileName || "").trim() || "স্বাগতম"}`, icon: "" }), [profileName]);
    const dateInfo = formatDateBn(today);
    const bangla = gregorianToBangla(now);
    const hijri = gregorianToHijri(islamicEffectiveDate(now));
    const debtStats = useMemo(() => {
        let receivable = 0, payable = 0;
        for (const d of debts) {
            const remaining = d.amount - d.repayments.reduce((s, r) => s + r.amount, 0);
            if (remaining <= 0)
                continue;
            if (d.type === "receivable")
                receivable += remaining;
            else
                payable += remaining;
        }
        return { receivable, payable, net: receivable - payable };
    }, [debts]);
    const debtRatio = debtStats.payable > 0 && availableBalance > 0 ? debtStats.payable / (availableBalance + debtStats.payable) : 0;
    const dueAlerts = useMemo(() => {
        return debts
            .map((d) => ({ d, info: debtDueInfo(d) }))
            .filter((x) => x.info && (x.info.key === "overdue" || x.info.key === "today" || x.info.key === "soon"))
            .sort((a, b) => a.info.daysLeft - b.info.daysLeft)
            .slice(0, 3);
    }, [debts]);
    // unpaid taxes due soon/overdue — same urgency window as debt alerts,
    // shown as its own small stack right under them (upcoming obligations)
    const taxAlerts = useMemo(() => {
        return (taxes || [])
            .map((t) => ({ t, info: taxDueInfo(t) }))
            .filter((x) => x.info && (x.info.key === "overdue" || x.info.key === "today" || x.info.key === "soon"))
            .sort((a, b) => a.info.daysLeft - b.info.daysLeft)
            .slice(0, 3);
    }, [taxes]);
    // this month's family bazar spending (purchased items only — matches
    // how the Family module counts "actual" spend)
    const bazarSpendThisMonth = useMemo(() => (bazarItems || [])
        .filter((it) => it.purchased && monthKeyOf(it.purchaseDate || "") === thisMonthKey)
        .reduce((s, it) => s + computeBazarTotal(it), 0), [bazarItems, thisMonthKey]);
    // simple 0-100 heuristic: savings rate (40pts) + budget adherence (35pts) + debt-free-ness (25pts)
    const healthScore = useMemo(() => {
        let score = 50;
        if (stats.monthIncome > 0) {
            const savingRate = monthSavings / stats.monthIncome;
            score += Math.max(-25, Math.min(25, Math.round(savingRate * 50)));
        }
        if (budget > 0) {
            if (budgetPct <= 70)
                score += 15;
            else if (budgetPct <= 100)
                score += 5;
            else
                score -= 20;
        }
        if (debtStats.payable > 0 && availableBalance > 0) {
            score -= Math.round(debtRatio * 15);
        }
        return Math.max(0, Math.min(100, Math.round(score)));
    }, [stats, monthSavings, budget, budgetPct, debtStats, availableBalance, debtRatio]);
    const healthLabel = healthScore >= 75 ? "চমৎকার অবস্থায় আছেন" : healthScore >= 55 ? "ভালো অবস্থায় আছেন" : healthScore >= 35 ? "মোটামুটি অবস্থায় আছেন" : "সতর্ক হওয়া দরকার";
    const healthColor = healthScore >= 75 ? "var(--hk-success)" : healthScore >= 55 ? "var(--hk-success-mid)" : healthScore >= 35 ? "var(--hk-gold)" : "var(--hk-danger)";
    const healthIndicators = useMemo(() => {
        const items = [];
        // বাজেট
        if (budget <= 0)
            items.push({ label: "বাজেট", state: "🟡", note: "সেট করা হয়নি" });
        else if (budgetPct <= 70)
            items.push({ label: "বাজেট", state: "🟢", note: "ভালো" });
        else if (budgetPct <= 100)
            items.push({ label: "বাজেট", state: "🟡", note: "নজরে রাখুন" });
        else
            items.push({ label: "বাজেট", state: "🔴", note: "ছাড়িয়ে গেছে" });
        // সঞ্চয়
        if (savingsRatePct === null)
            items.push({ label: "সঞ্চয়", state: "🟡", note: "তথ্য নেই" });
        else if (savingsRatePct >= 20)
            items.push({ label: "সঞ্চয়", state: "🟢", note: "ভালো" });
        else if (savingsRatePct >= 0)
            items.push({ label: "সঞ্চয়", state: "🟡", note: "মোটামুটি" });
        else
            items.push({ label: "সঞ্চয়", state: "🔴", note: "ঘাটতি" });
        // দেনা
        if (debtStats.payable <= 0)
            items.push({ label: "দেনা", state: "🟢", note: "কোনো দেনা নেই" });
        else if (debtRatio < 0.3)
            items.push({ label: "দেনা", state: "🟢", note: "ভালো" });
        else if (debtRatio < 0.6)
            items.push({ label: "দেনা", state: "🟡", note: "নজরে রাখুন" });
        else
            items.push({ label: "দেনা", state: "🔴", note: "চাপে আছেন" });
        return items;
    }, [budget, budgetPct, savingsRatePct, debtStats, debtRatio]);
    // rule-based "insights" — up to 2 short observations worth surfacing
    const insights = useMemo(() => {
        const out = [];
        // ১. খাতভিত্তিক বাজেট শেষের দিকে
        const catBudgetWarning = Object.entries(categoryBudgets || {})
            .map(([key, amt]) => {
            const spent = stats.catTotals[key] || 0;
            return { key, amt, spent, pct: amt > 0 ? Math.round((spent / amt) * 100) : 0 };
        })
            .filter((c) => c.pct >= 80)
            .sort((a, b) => b.pct - a.pct)[0];
        if (catBudgetWarning) {
            const info = catInfo("expense", catBudgetWarning.key, cats);
            out.push({
                icon: catBudgetWarning.pct >= 100 ? "⚠️" : "🟡",
                title: catBudgetWarning.pct >= 100 ? "সতর্কতা" : "নজরে রাখুন",
                text: `${info.label} খাতে নির্ধারিত বাজেটের ${toBnDigits(Math.min(999, catBudgetWarning.pct))}% ইতিমধ্যে শেষ হয়েছে।`,
            });
        }
        // ২. খাতভিত্তিক গত মাসের তুলনায় বড় বৃদ্ধি
        if (out.length < 2) {
            let biggest = null;
            for (const [key, amt] of Object.entries(stats.catTotals)) {
                const prev = stats.lastMonthCatTotals[key] || 0;
                if (prev > 0 && amt > prev * 1.15 && amt - prev >= 200) {
                    const pct = Math.round(((amt - prev) / prev) * 100);
                    if (!biggest || pct > biggest.pct)
                        biggest = { key, pct };
                }
            }
            if (biggest) {
                const info = catInfo("expense", biggest.key, cats);
                out.push({ icon: "💡", title: "এই মাসের insight", text: `${info.label} খাতে খরচ গত মাসের তুলনায় ${toBnDigits(biggest.pct)}% বেড়েছে।` });
            }
        }
        // ৩. ইতিবাচক: গত ৭ দিনের গড় খরচ নিরাপদ সীমার নিচে
        if (out.length < 2 && safeSpendToday !== null) {
            const avg7 = stats.last7Expense / 7;
            if (avg7 <= safeSpendToday) {
                out.push({ icon: "✨", title: "ভালো করছেন", text: "গত ৭ দিনে আপনার গড় দৈনিক খরচ বাজেটের নিরাপদ সীমার মধ্যে রয়েছে।" });
            }
        }
        // ৪. ফলব্যাক: সামগ্রিক ব্যয় প্রবণতা
        if (out.length < 2 && momChangePct !== null && momChangePct < -5) {
            out.push({ icon: "✨", title: "ভালো করছেন", text: `গত মাসের তুলনায় এই মাসে আপনার ব্যয় ${toBnDigits(Math.abs(momChangePct))}% কম হয়েছে।` });
        }
        return out.slice(0, 2);
    }, [categoryBudgets, stats, cats, safeSpendToday, momChangePct]);
    const topAccounts = useMemo(() => (accounts || []).filter((a) => a.hasActivity || a.opening).slice(0, 6), [accounts]);
    const isNewUser = transactions.length === 0 && debts.length === 0 && budget <= 0;
    if (isNewUser) {
        return (React.createElement("div", { style: styles.pageLedger },
            React.createElement("div", { style: styles.onboardCard },
                React.createElement("div", { style: styles.onboardTitle }, greeting.text),
                React.createElement("div", { style: styles.onboardSub }, "\u0986\u09AA\u09A8\u09BE\u09B0 \u09B9\u09BF\u09B8\u09BE\u09AC\u09C7\u09B0 \u09AF\u09BE\u09A4\u09CD\u09B0\u09BE \u0986\u099C \u09A5\u09C7\u0995\u09C7\u0987 \u09B6\u09C1\u09B0\u09C1 \u0995\u09B0\u09C1\u09A8\u0964"),
                React.createElement("button", { style: styles.onboardBtn, onClick: () => onQuickAdd("income") },
                    React.createElement("span", null, "\u09AA\u09CD\u09B0\u09A5\u09AE \u0986\u09AF\u09BC \u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8"),
                    React.createElement("span", null, "\u2192")),
                React.createElement("button", { style: styles.onboardBtn, onClick: () => onQuickAdd("expense") },
                    React.createElement("span", null, "\u09AA\u09CD\u09B0\u09A5\u09AE \u0996\u09B0\u099A \u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8"),
                    React.createElement("span", null, "\u2192")),
                React.createElement("button", { style: styles.onboardBtn, onClick: onEditBudget },
                    React.createElement("span", null, "\u09AE\u09BE\u09B8\u09BF\u0995 \u09AC\u09BE\u099C\u09C7\u099F \u09B8\u09C7\u099F \u0995\u09B0\u09C1\u09A8"),
                    React.createElement("span", null, "\u2192")))));
    }
    return (React.createElement("div", { style: styles.pageLedger },
        React.createElement("div", { style: styles.todayStrip },
            React.createElement("div", null, greeting.text),
            React.createElement("div", { style: styles.todayStripSub },
                dateInfo.weekday,
                ", ",
                dateInfo.full,
                " · ",
                toBnDigits(bangla.day),
                " ",
                bangla.month,
                ", ",
                toBnDigits(bangla.year),
                " \u09AC\u0999\u09CD\u0997\u09BE\u09AC\u09CD\u09A6",
                " · ",
                toBnDigits(hijri.day),
                " ",
                hijri.month,
                ", ",
                toBnDigits(hijri.year),
                " \u09B9\u09BF\u099C\u09B0\u09BF")),
        React.createElement("div", { style: styles.heroCard },
            React.createElement("div", { style: styles.heroLabel }, "\u09AE\u09CB\u099F \u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u09B8\u09AE\u09CD\u09AA\u09A6"),
            React.createElement("div", { style: Object.assign(Object.assign({}, styles.heroValue), { color: availableBalance >= 0 ? "#7FCB9D" : "#E38477" }) }, formatTaka(availableBalance, { sign: true })),
            React.createElement("div", { style: styles.heroPillRow },
                React.createElement("span", { style: Object.assign(Object.assign({}, styles.heroPill), { color: "#7FCB9D" }) },
                    "+ ",
                    formatTaka(stats.monthIncome, { symbol: false }),
                    "\u09F3 \u0986\u09AF\u09BC"),
                React.createElement("span", { style: Object.assign(Object.assign({}, styles.heroPill), { color: "#E38477" }) },
                    "\u2212 ",
                    formatTaka(stats.monthExpense, { symbol: false }),
                    "\u09F3 \u09AC\u09CD\u09AF\u09AF\u09BC")),
            momChangePct !== null && (React.createElement("div", { style: styles.heroDelta },
                "\u098F\u0987 \u09AE\u09BE\u09B8\u09C7 ",
                momChangePct <= 0 ? `${toBnDigits(Math.abs(momChangePct))}% কম` : `${toBnDigits(momChangePct)}% বেশি`,
                " \u0996\u09B0\u099A \u09B9\u09AF\u09BC\u09C7\u099B\u09C7 \u0997\u09A4 \u09AE\u09BE\u09B8\u09C7\u09B0 \u09A4\u09C1\u09B2\u09A8\u09BE\u09AF\u09BC"))),
        React.createElement("div", { style: styles.pulseCard },
            React.createElement("div", { style: styles.pulseTitle }, "\u098F\u0987 \u09AE\u09BE\u09B8 \u2014 \u09AB\u09BF\u09A8\u09BE\u09A8\u09CD\u09B8\u09BF\u09AF\u09BC\u09BE\u09B2 \u09AA\u09BE\u09B2\u09B8"),
            React.createElement(PulseBars, { income: stats.monthIncome, expense: stats.monthExpense, savings: monthSavings })),
        insights.length > 0 && (React.createElement("div", { style: styles.insightsStack }, insights.map((ins, i) => (React.createElement("div", { key: i, style: styles.insightCard },
            React.createElement("span", { style: styles.insightIcon }, ins.icon),
            React.createElement("div", null,
                React.createElement("div", { style: styles.insightTitle }, ins.title),
                React.createElement("div", { style: styles.insightText }, ins.text))))))),
        React.createElement("div", { style: styles.healthCardSmall },
            React.createElement("div", { style: styles.healthTopSmall },
                React.createElement("span", { style: styles.statLabel }, "\u0986\u09B0\u09CD\u09A5\u09BF\u0995 \u09B8\u09CD\u09AC\u09BE\u09B8\u09CD\u09A5\u09CD\u09AF"),
                React.createElement("span", { style: Object.assign(Object.assign({}, styles.healthScoreValSmall), { color: healthColor }) },
                    toBnDigits(healthScore),
                    React.createElement("span", { style: { fontSize: 10.5 } }, "/\u09E7\u09E6\u09E6"))),
            React.createElement("div", { style: { fontSize: 11.5, color: healthColor, fontWeight: 600, marginBottom: 6 } }, healthLabel),
            React.createElement("div", { style: styles.budgetBarTrackThin },
                React.createElement("div", { style: Object.assign(Object.assign({}, styles.budgetBarFill), { width: `${healthScore}%`, background: healthColor }) })),
            React.createElement("div", { style: styles.healthIndicatorRow }, healthIndicators.map((h) => (React.createElement("span", { key: h.label, style: styles.healthIndicatorChip },
                h.state,
                " ",
                h.label,
                " \u2014 ",
                h.note))))),
        React.createElement("button", { style: styles.budgetCard, onClick: onEditBudget },
            React.createElement("div", { style: styles.budgetTop },
                React.createElement("span", { style: styles.budgetTitle }, "\u09AE\u09BE\u09B8\u09BF\u0995 \u09AC\u09BE\u099C\u09C7\u099F"),
                React.createElement("span", { style: styles.budgetEdit }, budget > 0 ? "পরিবর্তন করুন ›" : "সেট করুন ›")),
            budget > 0 ? (React.createElement(React.Fragment, null,
                React.createElement("div", { style: styles.budgetBarTrack },
                    React.createElement("div", { style: Object.assign(Object.assign({}, styles.budgetBarFill), { width: `${Math.min(100, budgetPct)}%`, background: budgetPct >= 100 ? "var(--hk-danger)" : budgetPct >= 90 ? "var(--hk-danger-mid)" : budgetPct >= 70 ? "var(--hk-gold)" : "var(--hk-success-mid)" }) })),
                React.createElement("div", { style: styles.budgetFooterRow },
                    React.createElement("span", null,
                        toBnDigits(budgetPct),
                        "% \u0996\u09B0\u099A \u09B9\u09AF\u09BC\u09C7\u099B\u09C7",
                        budgetPct >= 100 ? " ⚠️ বাজেট শেষ" : budgetPct >= 90 ? " ⚠️ ৯০%+" : budgetPct >= 70 ? " ⚠️ ৭০%+" : ""),
                    React.createElement("span", { style: { color: budgetLeft < 0 ? "var(--hk-danger-mid)" : "var(--hk-success-mid)" } },
                        budgetLeft >= 0 ? "অবশিষ্ট " : "বাজেট ছাড়িয়েছে ",
                        formatTaka(budgetLeft))),
                React.createElement("div", { style: styles.budgetFooterRow },
                    React.createElement("span", null,
                        "\u09AE\u09BE\u09B8\u09C7\u09B0 ",
                        toBnDigits(monthPctElapsed),
                        "% \u09A6\u09BF\u09A8 \u09AA\u09BE\u09B0 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7"),
                    safeSpendToday !== null && (React.createElement("span", { style: { color: "var(--hk-text-muted-2)" } },
                        "\u0986\u099C \u09A8\u09BF\u09B0\u09BE\u09AA\u09A6 \u0996\u09B0\u099A: ",
                        formatTaka(safeSpendToday)))))) : (React.createElement("div", { style: styles.budgetEmpty }, "\u098F\u0987 \u09AE\u09BE\u09B8\u09C7\u09B0 \u0996\u09B0\u099A\u09C7\u09B0 \u09B8\u09C0\u09AE\u09BE \u09A0\u09BF\u0995 \u0995\u09B0\u09A4\u09C7 \u099F\u09CD\u09AF\u09BE\u09AA \u0995\u09B0\u09C1\u09A8"))),
        React.createElement("div", { style: styles.todayCard },
            React.createElement("div", { style: styles.todayCardTitle }, "\u0986\u099C\u0995\u09C7\u09B0 \u09B9\u09BF\u09B8\u09BE\u09AC"),
            React.createElement("div", { style: styles.todayCardRow },
                React.createElement("span", { style: { color: "var(--hk-success)" } },
                    "\u0986\u09AF\u09BC ",
                    formatTaka(stats.todayIncome)),
                React.createElement("span", { style: { color: "var(--hk-danger)" } },
                    "\u09AC\u09CD\u09AF\u09AF\u09BC ",
                    formatTaka(stats.todayExpense)))),
        dueAlerts.length > 0 && (React.createElement("div", { style: styles.alertStack }, dueAlerts.map(({ d, info }) => (React.createElement("button", { key: d.id, style: Object.assign(Object.assign({}, styles.alertCard), { borderColor: info.color }), onClick: onGoDebts },
            React.createElement("span", { style: { color: info.color } },
                d.type === "receivable" ? `${d.person} এর কাছ থেকে ` : `${d.person} কে `,
                formatTaka(debtRemaining(d)),
                " ",
                d.type === "receivable" ? "পাওনা" : "দেনা",
                " \u2014 ",
                info.label)))))),
        taxAlerts.length > 0 && (React.createElement("div", { style: styles.alertStack }, taxAlerts.map(({ t, info }) => (React.createElement("div", { key: t.id, style: Object.assign(Object.assign({}, styles.alertCard), { borderColor: info.color }) },
            React.createElement("span", { style: { color: info.color } },
                "\u099F\u09CD\u09AF\u09BE\u0995\u09CD\u09B8: ",
                t.name,
                " \u2014 ",
                formatTaka(t.amount),
                " \u2014 ",
                info.label)))))),
        React.createElement("button", { style: styles.debtSummaryCard, onClick: onGoDebts },
            React.createElement("div", { style: styles.budgetTop },
                React.createElement("span", { style: styles.budgetTitle }, "\u09A6\u09C7\u09A8\u09BE-\u09AA\u09BE\u0993\u09A8\u09BE"),
                React.createElement("span", { style: styles.budgetEdit }, "\u09B8\u09AC \u09A6\u09C7\u0996\u09C1\u09A8 \u203A")),
            React.createElement("div", { style: styles.debtSummaryRow },
                React.createElement("div", null,
                    React.createElement("div", { style: styles.statLabel }, "\u09AE\u09CB\u099F \u09AA\u09CD\u09B0\u09BE\u09AA\u09CD\u09AF \u09B9\u0995"),
                    React.createElement("div", { style: Object.assign(Object.assign({}, styles.statValue), { fontSize: 15, color: "var(--hk-success)" }) }, formatTaka(debtStats.receivable))),
                React.createElement("div", null,
                    React.createElement("div", { style: styles.statLabel }, "\u09AE\u09CB\u099F \u0995\u09B0\u099C\u09C7 \u09B9\u09BE\u09B8\u09BE\u09A8\u09BE"),
                    React.createElement("div", { style: Object.assign(Object.assign({}, styles.statValue), { fontSize: 15, color: "var(--hk-danger)" }) }, formatTaka(debtStats.payable))),
                React.createElement("div", null,
                    React.createElement("div", { style: styles.statLabel }, "\u09A8\u09BF\u099F"),
                    React.createElement("div", { style: Object.assign(Object.assign({}, styles.statValue), { fontSize: 15, color: debtStats.net >= 0 ? "var(--hk-success)" : "var(--hk-danger)" }) }, formatTaka(debtStats.net, { sign: true }))))),
        bazarSpendThisMonth > 0 && (React.createElement("div", { style: styles.savingsCard },
            React.createElement("div", { style: styles.savingsRow },
                React.createElement("span", { style: styles.statLabel }, "\u098F\u0987 \u09AE\u09BE\u09B8\u09C7 \u09AC\u09BE\u099C\u09BE\u09B0 \u0996\u09B0\u099A (\u09AB\u09CD\u09AF\u09BE\u09AE\u09BF\u09B2\u09BF)"),
                React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 } }, formatTaka(bazarSpendThisMonth))))),
        React.createElement("div", { style: styles.savingsCard },
            React.createElement("div", { style: styles.savingsRow },
                React.createElement("span", { style: styles.statLabel }, "\u098F\u0987 \u0997\u09A4\u09BF\u09A4\u09C7 \u099A\u09B2\u09B2\u09C7 \u09AE\u09BE\u09B8 \u09B6\u09C7\u09B7\u09C7 \u09A5\u09BE\u0995\u09AC\u09C7 (\u0986\u09A8\u09C1\u09AE\u09BE\u09A8\u09BF\u0995)"),
                React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "var(--hk-text-muted-2)" } }, formatTaka(stats.monthIncome - forecastMonthExpense, { sign: true })))),
        React.createElement("div", { style: styles.walletSectionHeader },
            React.createElement("div", { style: styles.sectionTitle }, "\u0986\u09AE\u09BE\u09B0 \u099F\u09BE\u0995\u09BE"),
            React.createElement("div", { style: styles.walletHeaderActions },
                React.createElement("button", { style: styles.walletActionLink, onClick: onTransfer }, "\u2194 \u09B8\u09CD\u09A5\u09BE\u09A8\u09BE\u09A8\u09CD\u09A4\u09B0"),
                React.createElement("button", { style: styles.walletActionLink, onClick: onTransferHistory }, "\u0987\u09A4\u09BF\u09B9\u09BE\u09B8"))),
        topAccounts.length > 0 && (React.createElement("div", { style: styles.walletGrid }, topAccounts.map((a) => (React.createElement("div", { key: a.key, style: Object.assign(Object.assign({}, styles.walletTile), { borderColor: ACCOUNT_COLORS[a.key] || "var(--hk-border)" }) },
            React.createElement("span", { style: styles.walletTileIcon }, ACCOUNT_ICONS[a.key] || "💰"),
            React.createElement("div", null,
                React.createElement("div", { style: styles.walletTileLabel }, a.label),
                React.createElement("div", { style: Object.assign(Object.assign({}, styles.walletTileVal), { color: ACCOUNT_COLORS[a.key] || "var(--hk-text)" }) }, formatTaka(a.balance)))))))),
        stats.topCats.length > 0 && (React.createElement("div", { style: styles.topCatCard },
            React.createElement("div", { style: styles.budgetTop },
                React.createElement("span", { style: styles.budgetTitle }, "\u09B6\u09C0\u09B0\u09CD\u09B7 \u09E9 \u0996\u09B0\u099A\u09C7\u09B0 \u0996\u09BE\u09A4"),
                React.createElement("button", { style: styles.budgetEdit, onClick: onGoReports }, "\u09AC\u09BF\u09B8\u09CD\u09A4\u09BE\u09B0\u09BF\u09A4 \u203A")),
            stats.topCats.map((c) => (React.createElement("div", { key: c.key, style: styles.topCatRow },
                React.createElement("span", null,
                    React.createElement(CategoryIcon, { catKey: c.key, emoji: c.info.icon, size: 15 }),
                    " ",
                    c.info.label),
                React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace" } }, formatTaka(c.amount))))))),
        React.createElement("div", { style: styles.sectionTitle }, "\u09B8\u09BE\u09AE\u09CD\u09AA\u09CD\u09B0\u09A4\u09BF\u0995 \u09B2\u09C7\u09A8\u09A6\u09C7\u09A8"),
        recent.length === 0 ? (React.createElement(EmptyState, { text: "\u098F\u0996\u09A8\u09CB \u0995\u09CB\u09A8\u09CB \u09B2\u09C7\u09A8\u09A6\u09C7\u09A8 \u09AF\u09CB\u0997 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09A8\u09BF\u0964 + \u09AC\u09BE\u099F\u09A8\u09C7 \u099A\u09C7\u09AA\u09C7 \u09B6\u09C1\u09B0\u09C1 \u0995\u09B0\u09C1\u09A8\u0964" })) : (React.createElement("div", { style: styles.txList }, recent.map((t) => (React.createElement(TxRow, { key: t.id, tx: t, onClick: () => onOpenTx(t) })))))));
}
/* ---------------- shared bits ---------------- */
function TxRow({ tx, onClick, showMethod, showDate, hideSymbol }) {
    const cats = useCategories();
    const info = catInfo(tx.type, tx.category, cats);
    const isIncome = tx.type === "income";
    return (React.createElement("button", { style: styles.txRow, onClick: onClick },
        React.createElement("div", { style: styles.txIcon },
            React.createElement(CategoryIcon, { catKey: tx.category, emoji: info.icon, size: 18 })),
        React.createElement("div", { style: styles.txMid },
            React.createElement("div", { style: styles.txCat }, info.label),
            tx.note ? React.createElement("div", { style: styles.txNote }, tx.note) : null,
            React.createElement("div", { style: styles.txMeta },
                showDate ? formatDateBn(tx.date).full : null,
                showDate && showMethod ? " · " : null,
                showMethod ? methodLabel(tx.method) : null)),
        React.createElement("div", { style: Object.assign(Object.assign({}, styles.txAmount), { color: isIncome ? "var(--hk-success)" : "var(--hk-danger)" }) }, formatTaka(tx.amount, { sign: true, symbol: !hideSymbol }))));
}
/* ---------------- lightweight SVG charts (no external chart library) ---------------- */
const DONUT_PALETTE = ["var(--hk-header-bg)", "var(--hk-gold)", "var(--hk-success-mid)", "var(--hk-danger-mid)", "var(--hk-text-muted)", "#5B8FA8", "#9A5A8C", "#C98B3D", "#4B7A6B", "#8A6BAA"];
function DonutChart({ data }) {
    // data: [{ label, amount }]
    const total = data.reduce((s, d) => s + d.amount, 0);
    if (total <= 0)
        return null;
    const size = 160, r = 62, cx = size / 2, cy = size / 2, circumference = 2 * Math.PI * r;
    let offset = 0;
    const segments = data.map((d, i) => {
        const frac = d.amount / total;
        const seg = Object.assign(Object.assign({}, d), { color: DONUT_PALETTE[i % DONUT_PALETTE.length], dash: frac * circumference, offset });
        offset += frac * circumference;
        return seg;
    });
    return (React.createElement("div", { style: styles.donutWrap },
        React.createElement("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}` },
            React.createElement("circle", { cx: cx, cy: cy, r: r, fill: "none", stroke: "var(--hk-border)", strokeWidth: 22 }),
            segments.map((s, i) => (React.createElement("circle", { key: i, cx: cx, cy: cy, r: r, fill: "none", stroke: s.color, strokeWidth: 22, strokeDasharray: `${s.dash} ${circumference - s.dash}`, strokeDashoffset: -s.offset, transform: `rotate(-90 ${cx} ${cy})` }))),
            React.createElement("text", { x: cx, y: cy - 3, textAnchor: "middle", fontSize: "12", fontFamily: "'JetBrains Mono', monospace", fill: "var(--hk-text)" }, toBnDigits(data.length)),
            React.createElement("text", { x: cx, y: cy + 13, textAnchor: "middle", fontSize: "9", fill: "var(--hk-label)" }, "\u0996\u09BE\u09A4")),
        React.createElement("div", { style: styles.donutLegend }, segments.slice(0, 6).map((s, i) => (React.createElement("div", { key: i, style: styles.donutLegendRow },
            React.createElement("span", { style: Object.assign(Object.assign({}, styles.donutDot), { background: s.color }) }),
            React.createElement("span", { style: { flex: 1 } }, s.label),
            React.createElement("span", { style: { color: "var(--hk-label)" } },
                toBnDigits(Math.round((s.amount / total) * 100)),
                "%")))))));
}
// compact 3-row "financial pulse" — income/expense/savings relative bars,
// used on the dashboard for an at-a-glance read of the current month
function PulseBars({ income, expense, savings }) {
    const max = Math.max(income, expense, Math.abs(savings), 1);
    const rows = [
        { label: "আয়", value: income, color: "var(--hk-success-mid)" },
        { label: "ব্যয়", value: expense, color: "var(--hk-danger-mid)" },
        { label: "সঞ্চয়", value: Math.abs(savings), color: "var(--hk-gold)" },
    ];
    return (React.createElement("div", { style: styles.ieBarWrap }, rows.map((r) => (React.createElement("div", { key: r.label, style: styles.ieBarRow },
        React.createElement("span", { style: styles.ieBarLabel }, r.label),
        React.createElement("div", { style: styles.ieBarTrack },
            React.createElement("div", { style: Object.assign(Object.assign({}, styles.ieBarFill), { width: `${(r.value / max) * 100}%`, background: r.color }) })),
        React.createElement("span", { style: styles.ieBarVal }, formatTaka(r.value)))))));
}
function IncomeExpenseBarChart({ income, expense }) {
    const max = Math.max(income, expense, 1);
    return (React.createElement("div", { style: styles.ieBarWrap },
        React.createElement("div", { style: styles.ieBarRow },
            React.createElement("span", { style: styles.ieBarLabel }, "\u0986\u09AF\u09BC"),
            React.createElement("div", { style: styles.ieBarTrack },
                React.createElement("div", { style: Object.assign(Object.assign({}, styles.ieBarFill), { width: `${(income / max) * 100}%`, background: "var(--hk-success-mid)" }) })),
            React.createElement("span", { style: styles.ieBarVal }, formatTaka(income))),
        React.createElement("div", { style: styles.ieBarRow },
            React.createElement("span", { style: styles.ieBarLabel }, "\u09AC\u09CD\u09AF\u09AF\u09BC"),
            React.createElement("div", { style: styles.ieBarTrack },
                React.createElement("div", { style: Object.assign(Object.assign({}, styles.ieBarFill), { width: `${(expense / max) * 100}%`, background: "var(--hk-danger-mid)" }) })),
            React.createElement("span", { style: styles.ieBarVal }, formatTaka(expense)))));
}
function TrendLineChart({ points }) {
    // points: [{ label, value }] chronological
    if (points.length < 2)
        return null;
    const w = 300, h = 90, pad = 8;
    const max = Math.max(...points.map((p) => p.value), 1);
    const min = Math.min(...points.map((p) => p.value), 0);
    const range = max - min || 1;
    const stepX = (w - pad * 2) / (points.length - 1);
    const coords = points.map((p, i) => {
        const x = pad + i * stepX;
        const y = h - pad - ((p.value - min) / range) * (h - pad * 2);
        return `${x},${y}`;
    });
    const zeroY = h - pad - ((0 - min) / range) * (h - pad * 2);
    return (React.createElement("svg", { width: "100%", height: h, viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: "none", style: { display: "block" } },
        React.createElement("line", { x1: pad, y1: zeroY, x2: w - pad, y2: zeroY, stroke: "var(--hk-border-strong)", strokeWidth: 1, strokeDasharray: "3 3" }),
        React.createElement("polyline", { points: coords.join(" "), fill: "none", stroke: "var(--hk-gold)", strokeWidth: 2 }),
        coords.map((c, i) => {
            const [x, y] = c.split(",");
            return React.createElement("circle", { key: i, cx: x, cy: y, r: 2.5, fill: "var(--hk-header-bg)" });
        })));
}
// Combo chart: current month's daily expense as bars, previous month's
// daily expense overlaid as a connected line, for direct day-by-day
// comparison. Tap/hover a day to see exact figures for both months.
function ComboChart({ barValues, lineValues, barLabel, lineLabel }) {
    const [active, setActive] = useState(null);
    const w = 320, h = 170, padL = 6, padR = 6, padT = 10, padB = 22;
    const slots = 31;
    const maxVal = Math.max(1, ...barValues, ...lineValues);
    const slotW = (w - padL - padR) / slots;
    const plotH = h - padT - padB;
    const linePts = lineValues
        .map((v, i) => {
        const x = padL + i * slotW + slotW / 2;
        const y = padT + plotH - (v / maxVal) * plotH;
        return { x, y, v, day: i + 1 };
    });
    const activeInfo = active !== null
        ? { day: active + 1, cur: barValues[active] || 0, prev: lineValues[active] || 0 }
        : null;
    return (React.createElement("div", null,
        React.createElement("div", { style: styles.comboLegendRow },
            React.createElement("span", { style: styles.comboLegendItem },
                React.createElement("span", { style: Object.assign(Object.assign({}, styles.comboLegendDot), { background: "var(--hk-header-bg)" }) }),
                " ",
                barLabel,
                " (\u09B0\u09BE\u09A8\u09BF\u0982 \u09AE\u09BE\u09B8)"),
            React.createElement("span", { style: styles.comboLegendItem },
                React.createElement("span", { style: Object.assign(Object.assign({}, styles.comboLegendDot), { background: "var(--hk-gold)", borderRadius: 2 }) }),
                " ",
                lineLabel,
                " (\u0997\u09A4 \u09AE\u09BE\u09B8)")),
        React.createElement("svg", { width: "100%", height: h, viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: "none", style: { display: "block" } },
            [0.25, 0.5, 0.75].map((f, i) => (React.createElement("line", { key: i, x1: padL, y1: padT + plotH * f, x2: w - padR, y2: padT + plotH * f, stroke: "var(--hk-text-on-dark-soft)", strokeWidth: 1 }))),
            barValues.map((v, i) => {
                const barH = (v / maxVal) * plotH;
                const x = padL + i * slotW;
                const y = padT + plotH - barH;
                return (React.createElement("rect", { key: i, x: x + slotW * 0.15, y: y, width: slotW * 0.7, height: barH, rx: 1.5, fill: active === i ? "var(--hk-danger-mid)" : "var(--hk-header-bg)", onClick: () => setActive(active === i ? null : i) }));
            }),
            React.createElement("polyline", { points: linePts.map((p) => `${p.x},${p.y}`).join(" "), fill: "none", stroke: "var(--hk-gold)", strokeWidth: 2 }),
            linePts.map((p, i) => (React.createElement("circle", { key: i, cx: p.x, cy: p.y, r: active === i ? 3.5 : 2, fill: "var(--hk-gold)", onClick: () => setActive(active === i ? null : i) }))),
            [1, 5, 10, 15, 20, 25, 30].map((d) => (React.createElement("text", { key: d, x: padL + (d - 1) * slotW + slotW / 2, y: h - 6, fontSize: "8", fill: "var(--hk-label)", textAnchor: "middle" }, toBnDigits(d))))),
        React.createElement("div", { style: styles.comboTooltip }, activeInfo
            ? `${toBnDigits(activeInfo.day)} তারিখ — ${barLabel}: ${formatTaka(activeInfo.cur)} · ${lineLabel}: ${formatTaka(activeInfo.prev)}`
            : "কোনো বার বা লাইনের বিন্দুতে চাপ দিলে সেদিনের হিসাব দেখা যাবে")));
}
function EmptyState({ text }) {
    return (React.createElement("div", { style: styles.emptyState },
        React.createElement("div", { style: styles.emptyIcon }, "\uD83E\uDEB6"),
        React.createElement("div", null, text)));
}
function BottomNav({ tab, setTab }) {
    const items = [
        { key: "dashboard", label: "হোম", icon: "home" },
        { key: "timeline", label: "টাইমলাইন", icon: "timeline" },
        { key: "debts", label: "দেনা", icon: "debt" },
        { key: "family", label: "ফ্যামিলি", icon: "box" },
        { key: "reports", label: "রিপোর্ট", icon: "reports" },
        { key: "search", label: "খুঁজুন", icon: "search" },
    ];
    return (React.createElement("nav", { style: styles.bottomNav }, items.map((it) => (React.createElement("button", { key: it.key, onClick: () => setTab(it.key), style: Object.assign(Object.assign({}, styles.navBtn), { color: tab === it.key ? "var(--hk-gold)" : "#8A9296" }) },
        React.createElement(Icon, { name: it.icon, size: 19, strokeWidth: tab === it.key ? 2.1 : 1.8 }),
        React.createElement("div", { style: { fontSize: 11, marginTop: 2 } }, it.label))))));
}
// একটি admin special-day রেকর্ডের (fixed বা recurring:"hijri") "কার্যকর
// ইংরেজি তারিখ" বের করে — fixed হলে সরাসরি s.date, recurring হলে aroundYmd
// (ডিফল্ট আজ) থেকে পরবর্তী occurrence লাইভ হিসাব করে। null মানে হিসাব
// করা যায়নি (window.HijriUQ অনুপস্থিত বা টেবিলের সীমার বাইরে)।
function resolveSpecialDayDate(s, aroundYmd) {
    if (s.recurrence === "hijri") {
        if (!window.HijriUQ)
            return null;
        return window.HijriUQ.nextHijriOccurrence(s.hijriMonth, s.hijriDay, aroundYmd || todayStr());
    }
    return s.date || null;
}
// একটি নির্দিষ্ট ইংরেজি মাসে (gYear-gMonth) একটি admin special-day কোন
// তারিখে পড়ে তা বের করে — fixed হলে সেই তারিখ ওই মাসে পড়লেই তা, recurring
// হলে সেই মাসে কোনো occurrence থাকলে তা (না থাকলে null)।
function resolveSpecialDayInMonth(s, gYear, gMonth) {
    if (s.recurrence === "hijri") {
        if (!window.HijriUQ)
            return null;
        return window.HijriUQ.hijriOccurrenceInGregorianMonth(s.hijriMonth, s.hijriDay, gYear, gMonth);
    }
    if (!s.date)
        return null;
    const m = /^(\d{4})-(\d{2})$/.exec(s.date.slice(0, 7));
    return m && +m[1] === gYear && +m[2] === gMonth ? s.date : null;
}
/* ---------------- hamburger menu ---------------- */
function HamburgerMenu({ onClose, onOpenNotifications, onOpenSettings, onOpenCalendar, onOpenFAQ, onOpenTax, onOpenAccounts, onOpenFamilyBazar, onOpenKhasra, isAdminUser, onOpenAdmin, unreadCount, familyInvites, }) {
    useBackgroundScrollLock();
    const menuItemStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "13px 4px", background: "none", border: "none", borderBottom: "1px solid var(--hk-border-light)", fontSize: 14.5, color: "var(--hk-text)" };
    // half-screen drawer (not fullscreen) — this is the one exception the
    // user explicitly asked for: every panel reached FROM this menu stays
    // fullscreen, but the menu itself should only cover half the screen,
    // with the other half left as a tappable backdrop to close it. The ☰
    // icon in the Header that opens this is untouched/unmoved.
    return React.createElement("div", { style: { position: "fixed", inset: 0, zIndex: 200, display: "flex" } },
        React.createElement("div", { style: { width: "50%", background: "var(--hk-card)", height: "100%", overflowY: "auto", overscrollBehaviorY: "contain", padding: "20px 18px", boxSizing: "border-box", display: "flex", flexDirection: "column" } },
            React.createElement("button", { onClick: onClose, "aria-label": "\u09AE\u09C7\u09A8\u09C1 \u09AC\u09A8\u09CD\u09A7 \u0995\u09B0\u09C1\u09A8", style: { background: "none", border: "none", fontSize: 22, padding: 0, marginBottom: 18, color: "var(--hk-text)" } }, "\u2630"),
            isAdminUser && React.createElement("button", { style: Object.assign(Object.assign({}, menuItemStyle), { color: "var(--hk-gold)", fontWeight: 700 }), onClick: onOpenAdmin }, "\u2699\uFE0F \u098F\u09A1\u09AE\u09BF\u09A8 \u09AA\u09CD\u09AF\u09BE\u09A8\u09C7\u09B2"),
            React.createElement("button", { style: menuItemStyle, onClick: onOpenFAQ }, "\u09AA\u09CD\u09B0\u09B6\u09CD\u09A8 \u0993 \u0989\u09A4\u09CD\u09A4\u09B0"),
            React.createElement("button", { style: menuItemStyle, onClick: onOpenTax }, "\u099F\u09CD\u09AF\u09BE\u0995\u09CD\u09B8 \u09AC\u09CD\u09AF\u09AC\u09B8\u09CD\u09A5\u09BE\u09AA\u09A8\u09BE"),
            React.createElement("button", { style: menuItemStyle, onClick: onOpenAccounts }, "\u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09AC\u09CD\u09AF\u09AC\u09B8\u09CD\u09A5\u09BE\u09AA\u09A8\u09BE"),
            React.createElement("button", { style: menuItemStyle, onClick: onOpenFamilyBazar },
                React.createElement("span", null, "📦 ফ্যামিলি"),
                familyInvites > 0 && React.createElement("span", { style: { background: "var(--hk-gold)", color: "#1a1a1a", fontSize: 11, borderRadius: 999, padding: "1px 7px", fontWeight: 700 } }, familyInvites)),
            React.createElement("button", { style: menuItemStyle, onClick: onOpenKhasra }, "📋 খসড়া খাতা"),
            React.createElement("button", { style: menuItemStyle, onClick: onOpenCalendar }, "\u09B9\u09BF\u099C\u09B0\u09BF \u0995\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09A1\u09BE\u09B0"),
            React.createElement("button", { style: menuItemStyle, onClick: onOpenNotifications },
                React.createElement("span", null, "\u09A8\u09CB\u099F\u09BF\u09AB\u09BF\u0995\u09C7\u09B6\u09A8"),
                unreadCount > 0 && React.createElement("span", { style: { background: "var(--hk-danger)", color: "#fff", fontSize: 11, borderRadius: 999, padding: "1px 7px" } }, unreadCount)),
            React.createElement("button", { style: menuItemStyle, onClick: onOpenSettings }, "\u09B8\u09C7\u099F\u09BF\u0982\u09B8"),
            // marginTop: "auto" pins this block to the very bottom of the
            // flex-column drawer, regardless of how few/many menu items are
            // above it — the menu items stay naturally at the top
            React.createElement("div", { style: { marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--hk-border-light)", fontSize: 12, color: "var(--hk-text-muted)", lineHeight: 1.8 } },
                React.createElement("div", { style: { fontWeight: 700, fontSize: 13.5, color: "var(--hk-text)" } }, "\u09B9\u09BF\u09B8\u09BE\u09AC \u0996\u09BE\u09A4\u09BE"),
                React.createElement("div", null, "\u099C\u09C0\u09AC\u09A8\u09C7\u09B0 \u09B9\u09BF\u09B8\u09BE\u09AC \u09A5\u09C7\u0995\u09C7 \u0986\u0996\u09BF\u09B0\u09BE\u09A4\u09C7\u09B0 \u09B9\u09BF\u09B8\u09BE\u09AC"),
                React.createElement("div", null, "Version 10.1.2.3"),
                React.createElement("div", { style: { marginTop: 6 } }, "\u0993\u09AF\u09BC\u09C7\u09AC\u09B8\u09BE\u0987\u099F: \u098F\u0987 \u0985\u09CD\u09AF\u09BE\u09AA\u09C7\u09B0 \u0993\u09AF\u09BC\u09C7\u09AC \u0985\u09CD\u09AF\u09BE\u09AA"),
                React.createElement("div", null, "Privacy Policy: \u0986\u09AE\u09BE\u09A6\u09C7\u09B0 \u09B8\u09AE\u09CD\u09AA\u09B0\u09CD\u0995\u09C7 \u099C\u09BE\u09A8\u09C1\u09A8"))),
        React.createElement("div", { style: { flex: 1, background: "rgba(0,0,0,0.4)" }, onClick: onClose }));
}
function FAQModal({ onClose, faqCloud }) {
    // read-only for everyone here — admins manage FAQ content exclusively
    // through the Admin Panel's FAQ tab, same pattern as Notice/Daily
    // Message/Special Day/Task
    const faqs = faqCloud || [];
    return React.createElement(ModalShell, { onClose: onClose, fullScreen: true, title: "\u09AA\u09CD\u09B0\u09B6\u09CD\u09A8 \u0993 \u0989\u09A4\u09CD\u09A4\u09B0" }, faqs.length === 0
        ? React.createElement(EmptyState, { text: "এখনও কোনো প্রশ্ন-উত্তর যোগ করা হয়নি।" })
        : faqs.map((f) => React.createElement("div", { key: f.id, style: admStyles.card },
            React.createElement("div", { style: { fontWeight: 600, marginBottom: 4 } }, f.question),
            React.createElement("div", { style: admStyles.muted }, f.answer))));
}
// ---------------------------------------------------------------------
// Family Bazar — the real implementation lives in family-bazar.js
// (window.FamilyBazar), pure logic in family-bazar-core.js (window.FBCore).
// Two entry points share the same module (both open the 📦 ফ্যামিলি ড্যাশবোর্ড):
//   • ☰ মেনু → "📦 ফ্যামিলি"  → full-screen (mode "full")
//   • নিচের "ফ্যামিলি" ট্যাব (📦 আইকন) → FamilyHub below (mode "embedded")
// ---------------------------------------------------------------------
// খসড়া খাতা — the real implementation lives in khasra-khata.js
// (window.KhasraKhata), same split as Family Bazar
function KhasraKhataModule({ onClose, storageId, registerBack }) {
    const Mod = window.KhasraKhata && window.KhasraKhata.Module;
    if (!Mod) {
        return React.createElement(ModalShell, { onClose: onClose, fullScreen: true, title: "📋 খসড়া খাতা" },
            React.createElement("div", { style: styles.taskEmpty }, "খসড়া খাতা লোড হয়নি — পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।"));
    }
    return React.createElement(Mod, { onClose: onClose, storageId: storageId, registerBack: registerBack });
}
function FamilyBazarModule({ onClose, user, onExpenseSync, otherByMonth, legacyProps }) {
    const Mod = window.FamilyBazar && window.FamilyBazar.Module;
    if (!Mod) {
        return React.createElement(ModalShell, { onClose: onClose, fullScreen: true, title: "🛒 ফ্যামিলি বাজার" },
            React.createElement("div", { style: styles.taskEmpty }, "ফ্যামিলি বাজার লোড হয়নি — পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।"));
    }
    return React.createElement(Mod, { onClose: onClose, user: user, mode: "full", section: "bazar", onExpenseSync: onExpenseSync, otherByMonth: otherByMonth, legacyProps: legacyProps });
}
// 📦 ফ্যামিলি = Family-র একমাত্র মূল প্রবেশপথ। ড্যাশবোর্ড (family-bazar.js) থেকে যাওয়া যায়:
// ফ্যামিলি বাজার · বাজার তালিকা (family-shopping.js) · খরচ ও রিপোর্ট · ফ্যামিলি প্লানিং
// (family-planning.js) · ব্যক্তিগত তালিকা (js/app/family-list.js) · সদস্য ও অনুমতি।
// সব ভূমিকার জন্য কাঠামো একই; অনুমতি ভেতরে ও Firestore Rules-এ যাচাই হয়।
function FamilyHub({ user, legacyProps, onExpenseSync, otherByMonth }) {
    const Mod = window.FamilyBazar && window.FamilyBazar.Module;
    return Mod ? React.createElement(Mod, { user: user, mode: "embedded", section: "bazar", onExpenseSync: onExpenseSync, otherByMonth: otherByMonth, legacyProps: legacyProps })
        : React.createElement("div", { style: styles.taskEmpty }, "ফ্যামিলি বাজার লোড হয়নি — পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।");
}
/* ---------------- dynamic accounts (Phase 1) ---------------- */
const ACCOUNT_TYPES = [
    { key: "cash", label: "\u0995\u09CD\u09AF\u09BE\u09B6" },
    { key: "bank", label: "\u09AC\u09CD\u09AF\u09BE\u0982\u0995" },
    { key: "mfs", label: "MFS/\u0993\u09AF\u09BC\u09BE\u09B2\u09C7\u099F" },
    { key: "card", label: "\u0995\u09BE\u09B0\u09CD\u09A1" },
    { key: "other", label: "\u0985\u09A8\u09CD\u09AF\u09BE\u09A8\u09CD\u09AF" },
];
function AccountForm({ initial, onClose, onSave }) {
    const [name, setName] = useState((initial === null || initial === void 0 ? void 0 : initial.name) || "");
    const [type, setType] = useState((initial === null || initial === void 0 ? void 0 : initial.type) || "bank");
    const [openingBalance, setOpeningBalance] = useState(initial ? String(initial.openingBalance) : "0");
    const [openingBalanceDate, setOpeningBalanceDate] = useState((initial === null || initial === void 0 ? void 0 : initial.openingBalanceDate) || todayStr());
    const [err, setErr] = useState("");
    return (React.createElement(ModalShell, { onClose: onClose, fullScreen: true, title: initial ? "\u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09B8\u09AE\u09CD\u09AA\u09BE\u09A6\u09A8\u09BE" : "\u09A8\u09A4\u09C1\u09A8 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F" },
        React.createElement("label", { style: admStyles.label }, "\u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F\u09C7\u09B0 \u09A8\u09BE\u09AE * (\u09AF\u09C7\u09AE\u09A8: DBBL, bKash Personal)"),
        React.createElement("input", { style: admStyles.input, value: name, onChange: (e) => setName(e.target.value) }),
        React.createElement("label", { style: admStyles.label }, "\u09A7\u09B0\u09A8"),
        React.createElement("select", { style: admStyles.input, value: type, onChange: (e) => setType(e.target.value) }, ACCOUNT_TYPES.map((t) => React.createElement("option", { key: t.key, value: t.key }, t.label))),
        React.createElement("label", { style: admStyles.label }, "\u09B6\u09C1\u09B0\u09C1\u09B0 \u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8"),
        React.createElement("input", { style: admStyles.input, type: "number", inputMode: "decimal", value: openingBalance, onChange: (e) => setOpeningBalance(e.target.value) }),
        React.createElement("label", { style: admStyles.label }, "\u09B6\u09C1\u09B0\u09C1\u09B0 \u09A4\u09BE\u09B0\u09BF\u0996"),
        React.createElement("input", { style: admStyles.input, type: "date", value: openingBalanceDate, onChange: (e) => setOpeningBalanceDate(e.target.value) }),
        err && React.createElement("div", { style: { color: "var(--hk-danger)", fontSize: 12.5, marginBottom: 8 } }, err),
        React.createElement("button", { style: admStyles.addBtn, onClick: () => {
                if (!name.trim()) {
                    setErr("অ্যাকাউন্টের নাম লিখুন");
                    return;
                }
                onSave({ name: name.trim(), type, openingBalance: parseFloat(openingBalance) || 0, openingBalanceDate });
            } }, "সংরক্ষণ করুন")));
}
function AccountPanel({ onClose, dynamicAccountBalances, onAdd, onUpdate, onDelete, onToggleActive, onViewTransactions }) {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [blockedMsg, setBlockedMsg] = useState(null);
    useBackOverlay(showForm, () => setShowForm(false));
    const attemptDelete = (a) => {
        const ok = onDelete(a.id);
        if (!ok) {
            setBlockedMsg(a.id);
            setDeleteConfirmId(null);
        }
    };
    const body = [
        React.createElement("button", { key: "add", style: admStyles.addBtn, onClick: () => { setEditing(null); setShowForm(true); } }, "+ নতুন অ্যাকাউন্ট যোগ করুন"),
        React.createElement("div", { key: "note", style: Object.assign(Object.assign({}, admStyles.muted), { marginBottom: 10 }) }, "এগুলো ক্যাশ/ব্যাংক/বিকাশ ইত্যাদির পাশাপাশি অতিরিক্ত, সুনির্দিষ্ট নামের অ্যাকাউন্ট — যেমন \"DBBL\" বা \"bKash Personal\"। লেনদেন যোগ করার সময় ঐচ্ছিকভাবে বেছে নেওয়া যাবে।"),
    ];
    if (dynamicAccountBalances.length === 0) {
        body.push(React.createElement(EmptyState, { key: "empty", text: "এখনও কোনো অ্যাকাউন্ট যোগ করা হয়নি।" }));
    }
    else {
        dynamicAccountBalances.forEach((a) => {
            body.push(React.createElement("div", { key: a.id, style: Object.assign(Object.assign({}, admStyles.card), { opacity: a.active === false ? 0.55 : 1 }) },
                React.createElement("div", { style: admStyles.row },
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontWeight: 600 } }, a.name, a.active === false && React.createElement("span", { style: { fontSize: 10.5, marginLeft: 6 } }, "(নিষ্ক্রিয়)")),
                        React.createElement("div", { style: admStyles.muted }, (ACCOUNT_TYPES.find((t) => t.key === a.type) || {}).label || a.type)),
                    React.createElement("div", { style: { fontWeight: 700 } }, formatTaka(a.balance))),
                blockedMsg === a.id && (React.createElement("div", { style: { fontSize: 12, color: "var(--hk-danger)", marginTop: 6 } }, "এই অ্যাকাউন্টে লেনদেন/লেনদেনের ইতিহাস আছে বলে মুছে ফেলা যাবে না — বরং নিষ্ক্রিয় করুন।")),
                React.createElement("div", { style: { display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" } },
                    React.createElement("button", { style: admStyles.chip(false), onClick: () => onViewTransactions(a.id) }, "\u09B2\u09C7\u09A8\u09A6\u09C7\u09A8 \u09A6\u09C7\u0996\u09C1\u09A8"),
                    React.createElement("button", { style: admStyles.chip(false), onClick: () => onToggleActive(a.id) }, a.active === false ? "সক্রিয় করুন" : "নিষ্ক্রিয় করুন"),
                    React.createElement("button", { style: admStyles.chip(false), onClick: () => { setEditing(a); setShowForm(true); } }, "সম্পাদনা"),
                    deleteConfirmId === a.id
                        ? React.createElement("button", { style: admStyles.confirmBtn, onClick: () => attemptDelete(a) }, "নিশ্চিত?")
                        : React.createElement("button", { style: admStyles.chip(false), onClick: () => { setDeleteConfirmId(a.id); setBlockedMsg(null); } }, "মুছুন"))));
        });
    }
    if (showForm) {
        body.push(React.createElement(AccountForm, { key: "form", initial: editing, onClose: () => setShowForm(false), onSave: (data) => { editing ? onUpdate(editing.id, data) : onAdd(data); setShowForm(false); } }));
    }
    return React.createElement(ModalShell, { onClose: onClose, fullScreen: true, title: "\u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09AC\u09CD\u09AF\u09AC\u09B8\u09CD\u09A5\u09BE\u09AA\u09A8\u09BE" }, ...body);
}
/* ---------------- debts (দেনা-পাওনা) ---------------- */
function debtRemaining(d) {
    return d.amount - d.repayments.reduce((s, r) => s + r.amount, 0);
}
// intelligent due-date status: overdue / today / due-soon (<=3 days) / normal
function debtDueInfo(d) {
    const remaining = debtRemaining(d);
    if (remaining <= 0 || !d.dueDate)
        return null;
    const today = todayStr();
    const diffDays = Math.round((new Date(d.dueDate + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000);
    if (diffDays < 0) {
        return { key: "overdue", label: `মেয়াদোত্তীর্ণ · ${toBnDigits(Math.abs(diffDays))} দিন পার`, color: "var(--hk-danger)", daysLeft: diffDays };
    }
    if (diffDays === 0) {
        return { key: "today", label: "আজই শেষ দিন", color: "var(--hk-gold)", daysLeft: 0 };
    }
    if (diffDays <= 3) {
        return { key: "soon", label: `${toBnDigits(diffDays)} দিন বাকি`, color: "var(--hk-gold)", daysLeft: diffDays };
    }
    return { key: "ok", label: `${toBnDigits(diffDays)} দিন বাকি`, color: "var(--hk-text-muted)", daysLeft: diffDays };
}
// same due-date urgency shape as debtDueInfo, for unpaid taxes
function taxDueInfo(t) {
    if (t.paid || !t.dueDate)
        return null;
    const today = todayStr();
    const diffDays = Math.round((new Date(t.dueDate + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000);
    if (diffDays < 0)
        return { key: "overdue", label: `মেয়াদোত্তীর্ণ · ${toBnDigits(Math.abs(diffDays))} দিন পার`, color: "var(--hk-danger)", daysLeft: diffDays };
    if (diffDays === 0)
        return { key: "today", label: "আজই শেষ দিন", color: "var(--hk-gold)", daysLeft: 0 };
    if (diffDays <= 3)
        return { key: "soon", label: `${toBnDigits(diffDays)} দিন বাকি`, color: "var(--hk-gold)", daysLeft: diffDays };
    return { key: "ok", label: `${toBnDigits(diffDays)} দিন বাকি`, color: "var(--hk-text-muted)", daysLeft: diffDays };
}
const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];
function TransactionForm({ initial, presetType, onClose, onSave, onDelete, onCheckBalance, userAccounts }) {
    const catCtx = useCategories();
    const [type, setType] = useState((initial === null || initial === void 0 ? void 0 : initial.type) || presetType || "expense");
    const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
    const [category, setCategory] = useState((initial === null || initial === void 0 ? void 0 : initial.category) || "");
    const [date, setDate] = useState((initial === null || initial === void 0 ? void 0 : initial.date) || todayStr());
    const [note, setNote] = useState((initial === null || initial === void 0 ? void 0 : initial.note) || "");
    const [method, setMethod] = useState((initial === null || initial === void 0 ? void 0 : initial.method) || "cash");
    const [accountId, setAccountId] = useState((initial === null || initial === void 0 ? void 0 : initial.accountId) || "");
    const [err, setErr] = useState("");
    // archived categories stay out of the picker for *new* selections, but
    // if the transaction being edited already used one, it stays visible
    // (and selected) rather than silently disappearing
    const cats = useMemo(() => {
        const all = type === "income" ? catCtx.incomeCats : catCtx.expenseCats;
        return all.filter((c) => !c.archived || c.key === category);
    }, [type, catCtx, category]);
    useEffect(() => {
        if (!cats.find((c) => c.key === category)) {
            setCategory(cats[0].key);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type]);
    const handleSave = () => {
        const num = parseFloat(amount);
        if (!num || num <= 0) {
            setErr("সঠিক পরিমাণ লিখুন");
            return;
        }
        if (!date) {
            setErr("তারিখ নির্বাচন করুন");
            return;
        }
        if (onCheckBalance && !onCheckBalance(method, type, num, initial === null || initial === void 0 ? void 0 : initial.id)) {
            setErr(`⚠️ আয় করুন — ${methodLabel(method)}-এ এত টাকা নেই`);
            return;
        }
        onSave({ type, amount: num, category: category || cats[0].key, date, note: note.trim(), method, accountId: accountId || null });
    };
    return (React.createElement(ModalShell, { onClose: onClose, title: initial ? "লেনদেন সম্পাদনা" : "নতুন লেনদেন" },
        React.createElement("div", { style: styles.typeToggle },
            React.createElement("button", { onClick: () => setType("expense"), style: Object.assign(Object.assign({}, styles.typeToggleBtn), (type === "expense" ? { background: "var(--hk-danger-mid)", color: "var(--hk-text-on-dark)" } : {})) }, "\u09AC\u09CD\u09AF\u09AF\u09BC"),
            React.createElement("button", { onClick: () => setType("income"), style: Object.assign(Object.assign({}, styles.typeToggleBtn), (type === "income" ? { background: "var(--hk-success-mid)", color: "var(--hk-text-on-dark)" } : {})) }, "\u0986\u09AF\u09BC")),
        React.createElement("div", { style: styles.amountWrap },
            React.createElement("span", { style: styles.amountSign }, "\u09F3"),
            React.createElement("input", { style: styles.amountInput, type: "number", inputMode: "decimal", placeholder: "\u09E6", value: amount, onChange: (e) => setAmount(e.target.value) })),
        React.createElement("div", { style: styles.quickAmountRow },
            QUICK_AMOUNTS.map((q) => (React.createElement("button", { key: q, type: "button", style: styles.quickAmountChip, onClick: () => setAmount(String((parseFloat(amount) || 0) + q)) },
                "+\u09F3",
                toBnDigits(q)))),
            amount ? (React.createElement("button", { type: "button", style: styles.quickAmountClear, onClick: () => setAmount("") }, "\u09AE\u09C1\u099B\u09C1\u09A8")) : null),
        React.createElement("div", { style: styles.formLabel }, "\u09A8\u09CB\u099F (\u0990\u099A\u09CD\u099B\u09BF\u0995)"),
        React.createElement("input", { style: styles.textInput, type: "text", placeholder: "\u09AF\u09C7\u09AE\u09A8: \u09A6\u09C1\u09AA\u09C1\u09B0\u09C7\u09B0 \u0996\u09BE\u09AC\u09BE\u09B0", value: note, onChange: (e) => setNote(e.target.value) }),
        React.createElement("div", { style: styles.formLabel }, "\u0996\u09BE\u09A4"),
        React.createElement("div", { style: styles.catGrid }, cats.map((c) => (React.createElement("button", { key: c.key, onClick: () => setCategory(c.key), style: Object.assign(Object.assign({}, styles.catChip), (category === c.key ? styles.catChipActive : {})) },
            React.createElement("div", { style: { fontSize: 18 } },
                React.createElement(CategoryIcon, { catKey: c.key, emoji: c.icon, size: 18 })),
            React.createElement("div", { style: { fontSize: 11, marginTop: 2 } }, c.label))))),
        React.createElement("div", { style: styles.formLabel }, "\u09A4\u09BE\u09B0\u09BF\u0996"),
        React.createElement("input", { style: styles.textInput, type: "date", value: date, max: todayStr(), onChange: (e) => setDate(e.target.value) }),
        React.createElement("div", { style: styles.formLabel }, "\u09AE\u09BE\u09A7\u09CD\u09AF\u09AE"),
        React.createElement("div", { style: styles.methodRow }, METHODS.map((m) => (React.createElement("button", { key: m.key, onClick: () => setMethod(m.key), style: Object.assign(Object.assign({}, styles.methodChip), (method === m.key ? styles.methodChipActive : {})) }, m.label)))),
        (userAccounts || []).filter((a) => a.active !== false).length > 0 && (React.createElement("div", null,
            React.createElement("div", { style: styles.formLabel }, "\u09A8\u09BF\u09B0\u09CD\u09A6\u09BF\u09B7\u09CD\u099F \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F (\u0990\u099A\u09CD\u099B\u09BF\u0995)"),
            React.createElement("select", { style: styles.textInput, value: accountId, onChange: (e) => setAccountId(e.target.value) },
                React.createElement("option", { value: "" }, "\u2014 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 \u2014"),
                userAccounts.filter((a) => a.active !== false).map((a) => React.createElement("option", { key: a.id, value: a.id }, a.name))))),
        err ? React.createElement("div", { style: styles.formErr }, err) : null,
        React.createElement("div", { style: styles.formActions },
            onDelete ? (React.createElement("button", { style: styles.deleteBtn, onClick: onDelete }, "\u09AE\u09C1\u099B\u09C7 \u09AB\u09C7\u09B2\u09C1\u09A8")) : null,
            React.createElement("button", { style: styles.saveBtn, onClick: handleSave }, "\u09B8\u0982\u09B0\u0995\u09CD\u09B7\u09A3 \u0995\u09B0\u09C1\u09A8"))));
}
/* ---------------- modal shell ---------------- */
// shared counter so nested/stacked modals don't fight over restoring the
// background scroll: body scroll only comes back once the LAST modal
// unmounts, not the first one that happens to close
let _openModalCount = 0;
let _savedBodyOverflow = null;
function useBackgroundScrollLock() {
    useEffect(() => {
        if (_openModalCount === 0) {
            _savedBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
        }
        _openModalCount++;
        return () => {
            _openModalCount--;
            if (_openModalCount === 0) {
                document.body.style.overflow = _savedBodyOverflow || "";
            }
        };
    }, []);
}
function ModalShell({ title, onClose, children, fullScreen }) {
    // two complementary fixes, both reusable across every panel that uses
    // this one shared shell: (1) overscroll-behavior on the scrollable
    // sheet stops scroll-chaining — once the sheet hits its own scroll
    // boundary, the gesture does NOT bubble to whatever is behind it; (2)
    // locking document.body while any modal is open is a belt-and-suspenders
    // fallback for browsers/cases where (1) alone isn't enough (e.g.
    // touches that start outside the sheet, on the overlay backdrop).
    useBackgroundScrollLock();
    // fullScreen is opt-in per usage — it swaps the default "sheet dropped
    // from the top, dashboard peeking out below/around it" look for a
    // full-page one (no gap, no rounded corners, opaque background).
    // Existing callers that don't pass it are completely unaffected.
    return (React.createElement("div", { style: fullScreen ? styles.modalOverlayFull : styles.modalOverlay, onClick: onClose },
        React.createElement("div", { style: fullScreen ? styles.modalSheetFull : styles.modalSheet, onClick: (e) => e.stopPropagation() },
            React.createElement("div", { style: styles.modalHeader },
                React.createElement("div", { style: styles.modalTitle }, title),
                React.createElement("button", { style: styles.modalClose, onClick: onClose }, "\u2715")),
            React.createElement("div", { style: styles.modalBody }, children))));
}

var __root = ReactDOM.createRoot(document.getElementById("root"));
__root.render(React.createElement(App));
