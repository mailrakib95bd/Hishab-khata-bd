"use strict";
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
/* ---------------- family management / family bazar ---------------- */
const BAZAR_CATS = [
    { key: "grocery", label: "চাল/ডাল/মুদি", icon: "🍚" },
    { key: "vegetable", label: "শাকসবজি", icon: "🥦" },
    { key: "fish_meat", label: "মাছ-মাংস", icon: "🐟" },
    { key: "fruit", label: "ফলমূল", icon: "🍎" },
    { key: "spice", label: "মসলা", icon: "🌶️" },
    { key: "dairy", label: "দুগ্ধজাত", icon: "🥛" },
    { key: "household", label: "গৃহস্থালী", icon: "🧺" },
    { key: "other_bazar", label: "অন্যান্য", icon: "🛒" },
];
const BAZAR_UNITS = [
    { key: "kg", label: "কেজি" },
    { key: "gram", label: "গ্রাম" },
    { key: "litre", label: "লিটার" },
    { key: "piece", label: "পিস" },
];
// quantity × rate = total, unless an explicit actual price was entered
// (e.g. a lump-sum purchase where a per-unit rate doesn't apply cleanly)
function computeBazarTotal(item) {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    if (item.actualPrice !== "" && item.actualPrice != null && !isNaN(parseFloat(item.actualPrice))) {
        return parseFloat(item.actualPrice);
    }
    if (qty && rate)
        return qty * rate;
    return 0;
}
function bazarEstimatedTotal(item) {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    if (item.estimatedPrice !== "" && item.estimatedPrice != null && !isNaN(parseFloat(item.estimatedPrice))) {
        return parseFloat(item.estimatedPrice);
    }
    if (qty && rate)
        return qty * rate;
    return 0;
}
// price history for a product: every purchased bazar item with the same
// (normalized) product name + unit, oldest → newest, with the rate used
function bazarPriceHistory(items, productName, unit) {
    const key = (productName || "").trim().toLowerCase();
    return items
        .filter((it) => it.purchased && (it.productName || "").trim().toLowerCase() === key && (it.unit || "") === (unit || "") && (parseFloat(it.rate) > 0))
        .sort((a, b) => (a.purchaseDate || "").localeCompare(b.purchaseDate || ""))
        .map((it) => ({ date: it.purchaseDate, rate: parseFloat(it.rate), id: it.id }));
}
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
function computeAccountBalances(transactions, accountOpening, transfers) {
    const sums = {};
    for (const t of transactions) {
        const key = t.method || "cash";
        sums[key] = (sums[key] || 0) + (t.type === "income" ? t.amount : -t.amount);
    }
    for (const tr of transfers || []) {
        sums[tr.fromMethod] = (sums[tr.fromMethod] || 0) - tr.amount;
        sums[tr.toMethod] = (sums[tr.toMethod] || 0) + tr.amount;
    }
    return METHODS.map((m) => {
        const opening = (accountOpening && accountOpening[m.key]) || 0;
        const balance = opening + (sums[m.key] || 0);
        return { key: m.key, label: m.label, opening, balance, hasActivity: !!sums[m.key] };
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
// primary admin — UI-level convenience only (e.g. to decide whether to
// render admin buttons at all). It is NOT the security boundary: the real
// enforcement lives in firestore.rules, which independently checks this
// same UID server-side on every write to the admin-only collections
// (notices, dailyMessages, adminSpecialDays). Even if this constant or any
// other frontend code were tampered with, Firestore itself still rejects
// writes from any other account.
const ADMIN_UID = "gjObYYXi66eHmqIhtlDuvq29cJ42";
function isAdmin(user) {
    return !!user && user.uid === ADMIN_UID;
}
function dashboardTitle(name) {
    const trimmed = (name || "").trim();
    if (!trimmed)
        return "আমার খাতা";
    return `${trimmed}ের খাতা`;
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
function gregorianToJDN(y, m, d) {
    const a = Math.floor((14 - m) / 12);
    const y2 = y + 4800 - a;
    const m2 = m + 12 * a - 3;
    return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
}
// tabular ("Kuwaiti") Hijri conversion — an arithmetic approximation,
// may differ by ~1 day from moon-sighting-based official announcements
function jdnToHijri(jdn) {
    const l0 = jdn - 1948440 + 10632;
    const n = Math.floor((l0 - 1) / 10631);
    let l = l0 - 10631 * n + 354;
    const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
    l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
    const month = Math.floor((24 * l) / 709);
    const day = l - Math.floor((709 * month) / 24);
    const year = 30 * n + j - 30;
    return { year, month, day };
}
function gregorianToHijri(date) {
    const jdn = gregorianToJDN(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const h = jdnToHijri(jdn);
    return { day: h.day, month: HIJRI_MONTHS[h.month - 1], year: h.year };
}
// approximate sunset time (UTC instant) for given date & coordinates
function calcSunsetInstant(date, lat, lon) {
    const rad = Math.PI / 180;
    const start = new Date(date.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((date - start) / 86400000);
    const lngHour = lon / 15;
    const t = dayOfYear + (18 - lngHour) / 24;
    const M = 0.9856 * t - 3.289;
    let L = M + 1.916 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 282.634;
    L = (L + 360) % 360;
    let RA = (1 / rad) * Math.atan(0.91764 * Math.tan(L * rad));
    RA = (RA + 360) % 360;
    const Lq = Math.floor(L / 90) * 90;
    const RAq = Math.floor(RA / 90) * 90;
    RA = (RA + (Lq - RAq)) / 15;
    const sinDec = 0.39782 * Math.sin(L * rad);
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH = (Math.cos(90.83 * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
    if (cosH > 1 || cosH < -1)
        return null;
    const H = (1 / rad) * Math.acos(cosH) / 15;
    const T = H + RA - 0.06571 * t - 6.622;
    const UT = ((T - lngHour) % 24 + 24) % 24;
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) + UT * 3600000);
}
// Islamic day starts at sunset — coordinates default to Dhaka
function islamicEffectiveDate(now, lat = 23.8103, lon = 90.4125) {
    const sunset = calcSunsetInstant(now, lat, lon);
    if (sunset && now >= sunset) {
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }
    return now;
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
        bazarItems }, overrides)), [transactions, budget, tasks, specialDays, debts, expenseCats, incomeCats, categoryBudgets, accountOpening, transfers, profileName, familyMembers, bazarItems, persist]);
    // pin / theme / autoSync only — deliberately NOT part of persistAll, since
    // these belong to the device, not to whichever account is signed in
    const [autoSync, setAutoSync] = useState(true);
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
        exportedAt: Date.now(),
    }, null, 2);
    const importBackupJSON = (jsonText) => {
        try {
            const data = JSON.parse(jsonText);
            applyUserData(data);
            persistAll(data);
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
                setShowCalendar(false);
                return;
            }
            if (editingTx) {
                setEditingTx(null);
                return;
            }
            if (showSettings) {
                setShowSettings(false);
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
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transactions, budget, tasks, specialDays, debts, expenseCats, incomeCats, categoryBudgets, accountOpening, transfers, profileName, user, loaded, autoSync]);
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
                applyUserData(cloudData);
                window.storage.set(userDataKey(user.uid), JSON.stringify(cloudData)).catch(() => { });
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
            },
            cloud: cloud
                ? {
                    transactions: (cloud.transactions || []).length,
                    debts: (cloud.debts || []).length,
                    transfers: (cloud.transfers || []).length,
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
        setTransactions(next);
        persistAll({ transactions: next });
        setUndoBuffer({ kind: "transaction", item: removed, index: idx });
    };
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
    // wallets (cash/bank/bkash/নগদ/রকেট/card) must never go negative — computes
    // a method's current balance from opening balance + transactions + transfers,
    // optionally excluding one transaction/transfer (used when editing).
    const accountBalanceExcluding = (method, excludeTxId, excludeTransferId) => {
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
    const addTransfer = (transfer) => {
        const next = [...transfers, Object.assign(Object.assign({}, transfer), { id: uid(), createdAt: Date.now() })];
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
        };
        persistAll(cleared);
        if (user && window.FB) {
            window.FB.saveCloudData(user.uid, cleared).catch(() => { });
        }
    };
    const addTask = (text) => {
        const trimmed = text.trim();
        if (!trimmed || tasks.length >= MAX_TASKS)
            return;
        const next = [...tasks, { id: uid(), text: trimmed, done: false, reminderDate: null, reminderTime: null, remindedAt: null }];
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
        setDebts(next);
        persistAll({ debts: next });
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
        const next = debts.map((d) => d.id === debtId ? Object.assign(Object.assign({}, d), { repayments: [...d.repayments, Object.assign(Object.assign({}, repayment), { id: uid() })] }) : d);
        setDebts(next);
        persistAll({ debts: next });
    };
    const deleteRepayment = (debtId, repaymentId) => {
        const next = debts.map((d) => d.id === debtId ? Object.assign(Object.assign({}, d), { repayments: d.repayments.filter((r) => r.id !== repaymentId) }) : d);
        setDebts(next);
        persistAll({ debts: next });
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
            if (fired.length > 0) {
                setActiveReminder(fired.join(" · "));
                try {
                    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                        new Notification(`${dashboardTitle(profileName)} — রিমাইন্ডার`, { body: fired.join(", ") });
                    }
                }
                catch (e) {
                    // Notification API unavailable in this environment — the in-app banner still shows
                }
            }
            if (tasksChanged || debtsChanged) {
                setTasks(nextTasks);
                setDebts(nextDebts);
                persistAll({ tasks: nextTasks, debts: nextDebts });
            }
        }, 20 * 1000);
        return () => clearInterval(id);
    }, [tasks, debts, transactions, budget, specialDays, persist]);
    const accounts = useMemo(() => computeAccountBalances(transactions, accountOpening, transfers), [transactions, accountOpening, transfers]);
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
            React.createElement(Header, { transactions: transactions, onSettings: () => setShowSettings(true), tasks: tasks, onAddTask: addTask, onToggleTask: toggleTask, onDeleteTask: deleteTask, onSetReminder: setTaskReminder, onOpenCalendar: () => setShowCalendar(true), profileName: profileName }),
            React.createElement("main", { style: styles.main },
                tab === "dashboard" && (React.createElement(Dashboard, { transactions: transactions, budget: budget, categoryBudgets: categoryBudgets, debts: debts, accounts: accounts, onEditBudget: () => setShowBudget(true), onOpenTx: (t) => setEditingTx(t), onGoDebts: () => setTab("debts"), onGoReports: () => setTab("reports"), onQuickAdd: (type) => {
                        setQuickAddType(type);
                        setShowAdd(true);
                    }, onTransfer: () => setShowTransfer(true), onTransferHistory: () => setShowTransferHistory(true), profileName: profileName })),
                tab === "timeline" && (React.createElement(Timeline, { transactions: transactions, onOpenTx: (t) => setEditingTx(t) })),
                tab === "debts" && (React.createElement(DebtsView, { debts: debts, onOpenDebt: (d) => setEditingDebt(d), onAddDebt: () => setShowAddDebt(true) })),
                tab === "family" && (React.createElement(FamilyView, { familyMembers: familyMembers, bazarItems: bazarItems, transactions: transactions, onAddMember: addFamilyMember, onUpdateMember: updateFamilyMember, onDeleteMember: deleteFamilyMember, onAddBazarItem: addBazarItem, onUpdateBazarItem: updateBazarItem, onDeleteBazarItem: deleteBazarItem, onAddBazarItemAsExpense: addBazarItemAsExpense })),
                tab === "reports" && React.createElement(Reports, { transactions: transactions, categoryBudgets: categoryBudgets, budget: budget }),
                tab === "search" && (React.createElement(SearchView, { transactions: transactions, accounts: accounts, onOpenTx: (t) => setEditingTx(t) }))),
            (tab === "dashboard" || tab === "timeline" || tab === "debts") && (React.createElement("button", { style: styles.fab, onClick: () => (tab === "debts" ? setShowAddDebt(true) : setShowAdd(true)), "aria-label": tab === "debts" ? "নতুন দেনা-পাওনা যোগ করুন" : "নতুন লেনদেন যোগ করুন" }, "+")),
            React.createElement(BottomNav, { tab: tab, setTab: setTab }),
            showAdd && (React.createElement(TransactionForm, { presetType: quickAddType, onClose: () => {
                    setShowAdd(false);
                    setQuickAddType(null);
                }, onSave: (tx) => {
                    addTransaction(tx);
                    setShowAdd(false);
                    setQuickAddType(null);
                }, onCheckBalance: checkAccountBalance })),
            editingTx && (React.createElement(TransactionForm, { initial: editingTx, onClose: () => setEditingTx(null), onSave: (patch) => {
                    updateTransaction(editingTx.id, patch);
                    setEditingTx(null);
                }, onDelete: () => {
                    deleteTransaction(editingTx.id);
                    setEditingTx(null);
                }, onCheckBalance: checkAccountBalance })),
            showTransfer && (React.createElement(TransferForm, { onClose: () => setShowTransfer(false), onSave: (tr) => {
                    addTransfer(tr);
                    setShowTransfer(false);
                }, onCheckBalance: checkTransferBalance })),
            showTransferHistory && (React.createElement(TransferHistoryModal, { transfers: transfers, onClose: () => setShowTransferHistory(false), onDelete: deleteTransfer })),
            showBudget && (React.createElement(BudgetModal, { current: budget, categoryBudgets: categoryBudgets, onClose: () => setShowBudget(false), onSave: (v) => {
                    saveBudget(v);
                    setShowBudget(false);
                }, onSaveCategoryBudgets: saveCategoryBudgets })),
            showCalendar && (React.createElement(CalendarModal, { specialDays: specialDays, onSaveSpecialDays: saveSpecialDays, onClose: () => setShowCalendar(false), onRegisterBackHandler: (fn) => { calendarBackConsumedRef.current = fn; } })),
            showAddDebt && (React.createElement(DebtForm, { onClose: () => setShowAddDebt(false), onSave: (d) => {
                    addDebt(d);
                    setShowAddDebt(false);
                } })),
            editingDebt && (React.createElement(DebtDetail, { debt: debts.find((d) => d.id === editingDebt.id) || editingDebt, onClose: () => setEditingDebt(null), onUpdate: (patch) => updateDebt(editingDebt.id, patch), onDelete: () => {
                    deleteDebt(editingDebt.id);
                    setEditingDebt(null);
                }, onAddRepayment: (r) => addRepayment(editingDebt.id, r), onDeleteRepayment: (rid) => deleteRepayment(editingDebt.id, rid), onRegisterBackHandler: (fn) => { debtDetailBackConsumedRef.current = fn; } })),
            showSettings && (React.createElement(SettingsModal, { transactions: transactions, budget: budget, specialDays: specialDays, onSaveSpecialDays: saveSpecialDays, onClose: () => setShowSettings(false), onEditBudget: () => {
                    setShowSettings(false);
                    setShowBudget(true);
                }, onClearAll: () => {
                    clearAll();
                    setShowSettings(false);
                }, accounts: accounts, accountOpening: accountOpening, onSaveAccountOpening: saveAccountOpening, onAddCategory: addCategory, onUpdateCategory: updateCategory, onDeleteCategory: deleteCategory, pin: pin, onSavePin: savePin, onImportTransactions: (rows) => {
                    const next = [...transactions, ...rows.map((r) => (Object.assign(Object.assign({}, r), { id: uid(), createdAt: Date.now() })))];
                    setTransactions(next);
                    persistAll({ transactions: next });
                }, theme: theme, onSaveTheme: saveTheme, user: user, syncStatus: syncStatus, lastSyncedAt: lastSyncedAt, onShowLogin: () => {
                    setShowSettings(false);
                    setShowLogin(true);
                }, onLogout: logOut, onManualSync: manualSync, onRestoreFromCloud: restoreFromCloud, onPreviewCloudVsLocal: previewCloudVsLocal, isOnline: isOnline, pendingChanges: pendingChanges, onExportJSON: exportBackupJSON, onImportJSON: importBackupJSON, profileName: profileName, onSaveProfileName: saveProfileName, autoSync: autoSync, onSaveAutoSync: saveAutoSync })),
            showLogin && (React.createElement(LoginScreen, { onClose: () => setShowLogin(false), onSignedIn: () => setShowLogin(false) })),
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
/* ---------------- header ---------------- */
function Header({ transactions, onSettings, tasks, onAddTask, onToggleTask, onDeleteTask, onSetReminder, onOpenCalendar, profileName }) {
    const [showTasks, setShowTasks] = useState(false);
    const [newTask, setNewTask] = useState("");
    const [reminderEditId, setReminderEditId] = useState(null);
    const [reminderDateVal, setReminderDateVal] = useState("");
    const [reminderTimeVal, setReminderTimeVal] = useState("");
    const balance = useMemo(() => transactions.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0), [transactions]);
    const doneCount = tasks.filter((t) => t.done).length;
    const submitTask = () => {
        if (!newTask.trim() || tasks.length >= MAX_TASKS)
            return;
        onAddTask(newTask);
        setNewTask("");
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
        React.createElement("div", { style: styles.headerContent },
            React.createElement("div", null,
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
                        tasks.length === 0 ? (React.createElement("div", { style: styles.taskEmpty }, "\u098F\u0996\u09A8\u09CB \u0995\u09CB\u09A8\u09CB \u0995\u09BE\u099C \u09AF\u09CB\u0997 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09A8\u09BF\u0964")) : (React.createElement("div", { style: styles.taskList }, tasks.map((t) => (React.createElement("div", { key: t.id },
                            React.createElement("div", { style: styles.taskItem },
                                React.createElement("button", { style: styles.taskCheck, onClick: () => onToggleTask(t.id) }, t.done ? "☑" : "☐"),
                                React.createElement("span", { style: Object.assign(Object.assign({}, styles.taskText), { textDecoration: t.done ? "line-through" : "none", color: t.done ? "var(--hk-border-med2)" : "var(--hk-text)" }) }, t.text),
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
                        React.createElement("div", { style: styles.reminderHint }, "\u0985\u09CD\u09AF\u09BE\u09AA \u0996\u09CB\u09B2\u09BE \u09A5\u09BE\u0995\u09BE \u0985\u09AC\u09B8\u09CD\u09A5\u09BE\u09AF\u09BC \u09A8\u09BF\u09B0\u09CD\u09A6\u09BF\u09B7\u09CD\u099F \u09B8\u09AE\u09AF\u09BC\u09C7 \u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09A8\u09C7 \u09B8\u09A4\u09B0\u09CD\u0995\u09A4\u09BE \u09A6\u09C7\u0996\u09BE\u09AC\u09C7\u0964"),
                        tasks.length < MAX_TASKS && (React.createElement("div", { style: styles.taskAddRow },
                            React.createElement("input", { style: styles.taskInput, placeholder: "\u09A8\u09A4\u09C1\u09A8 \u0995\u09BE\u099C \u09B2\u09BF\u0996\u09C1\u09A8\u2026", value: newTask, onChange: (e) => setNewTask(e.target.value), onKeyDown: (e) => e.key === "Enter" && submitTask() }),
                            React.createElement("button", { style: styles.taskAddBtn, onClick: submitTask }, "+"))))))))));
}
/* ---------------- dashboard ---------------- */
function Dashboard({ transactions, budget, categoryBudgets, debts, accounts, onEditBudget, onOpenTx, onGoDebts, onGoReports, onQuickAdd, onTransfer, onTransferHistory, profileName }) {
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
/* ---------------- timeline ---------------- */
function Timeline({ transactions, onOpenTx }) {
    const [filter, setFilter] = useState("all"); // all | income | expense
    const today = todayStr();
    const windowStart = shiftDate(today, -6); // last 7 days including today
    const now = new Date();
    const dateInfo = formatDateBn(today);
    const headerStats = useMemo(() => {
        let allIncome = 0, allExpense = 0, todayExpense = 0;
        for (const t of transactions) {
            if (t.type === "income")
                allIncome += t.amount;
            else
                allExpense += t.amount;
            if (t.date === today && t.type === "expense")
                todayExpense += t.amount;
        }
        return { balance: allIncome - allExpense, todayExpense };
    }, [transactions, today]);
    const groups = useMemo(() => {
        const sortedAsc = [...transactions].sort((a, b) => a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1);
        let running = 0;
        const withRunning = sortedAsc.map((t) => {
            running += t.type === "income" ? t.amount : -t.amount;
            return Object.assign(Object.assign({}, t), { runningBalance: running });
        });
        const byDate = {};
        for (const t of withRunning) {
            if (t.date < windowStart || t.date > today)
                continue; // শুধু গত ৭ দিন
            if (!byDate[t.date])
                byDate[t.date] = [];
            byDate[t.date].push(t);
        }
        return Object.entries(byDate)
            .sort((a, b) => (a[0] < b[0] ? 1 : -1))
            .map(([date, items]) => {
            const dayNet = items.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
            const dayEndBalance = items[items.length - 1].runningBalance;
            const shown = filter === "all" ? items : items.filter((t) => t.type === filter);
            return { date, items: [...shown].reverse(), dayNet, dayEndBalance };
        })
            .filter((g) => g.items.length > 0);
    }, [transactions, windowStart, today, filter]);
    return (React.createElement("div", { style: styles.pageLedger },
        React.createElement("div", { style: styles.todayStrip },
            React.createElement("div", null,
                dateInfo.weekday,
                ", ",
                dateInfo.full),
            React.createElement("div", { style: styles.todayStripSub },
                "\u0986\u099C \u0996\u09B0\u099A \u09B9\u09AF\u09BC\u09C7\u099B\u09C7 ",
                formatTaka(headerStats.todayExpense),
                " \u00B7 \u099C\u09AE\u09BE \u0986\u099B\u09C7 ",
                formatTaka(headerStats.balance))),
        React.createElement("div", { style: styles.rangeRow }, [
            { key: "all", label: "সব" },
            { key: "income", label: "আয়" },
            { key: "expense", label: "ব্যয়" },
        ].map((f) => (React.createElement("button", { key: f.key, onClick: () => setFilter(f.key), style: Object.assign(Object.assign({}, styles.rangeChip), (filter === f.key ? styles.rangeChipActive : {})) }, f.label)))),
        groups.length === 0 ? (React.createElement(EmptyState, { text: "\u0997\u09A4 \u09ED \u09A6\u09BF\u09A8\u09C7 \u09A6\u09C7\u0996\u09BE\u09A8\u09CB\u09B0 \u09AE\u09A4\u09CB \u0995\u09CB\u09A8\u09CB \u09B2\u09C7\u09A8\u09A6\u09C7\u09A8 \u09A8\u09C7\u0987\u0964" })) : (groups.map((g) => {
            const gDateInfo = formatDateBn(g.date);
            return (React.createElement("div", { key: g.date, style: styles.dayGroup },
                React.createElement("div", { style: styles.dayHeader },
                    React.createElement("div", null,
                        React.createElement("div", { style: styles.dayHeaderDate }, gDateInfo.full),
                        React.createElement("div", { style: styles.dayHeaderWeekday }, gDateInfo.weekday)),
                    React.createElement("div", { style: { textAlign: "right" } },
                        React.createElement("div", { style: { color: g.dayNet >= 0 ? "var(--hk-success)" : "var(--hk-danger)", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 } }, formatTaka(g.dayNet, { sign: true, symbol: false })),
                        React.createElement("div", { style: styles.dayHeaderBalance },
                            "\u099C\u09AE\u09BE ",
                            formatTaka(g.dayEndBalance, { symbol: false })))),
                React.createElement("div", { style: styles.txList }, g.items.map((t) => (React.createElement(TxRow, { key: t.id, tx: t, onClick: () => onOpenTx(t), showMethod: true, hideSymbol: true }))))));
        }))));
}
/* ---------------- reports ---------------- */
const RANGE_OPTIONS = [
    { key: "today", label: "আজ" },
    { key: "yesterday", label: "গতকাল" },
    { key: "last7", label: "গত ৭ দিন" },
];
const GREG_MONTHS_BN = [
    "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
];
// serially lists the current month + previous 10 months (11 total) as
// clickable "YYYY-MM" range keys, newest first
function buildMonthOptions() {
    const now = new Date();
    const opts = [];
    for (let i = 0; i < 11; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        opts.push({ key, label: `${GREG_MONTHS_BN[d.getMonth()]} ${toBnDigits(d.getFullYear())}`, y: d.getFullYear(), m: d.getMonth() });
    }
    return opts;
}
function isMonthRangeKey(key) {
    return /^\d{4}-\d{2}$/.test(key);
}
function daysInGregMonth(y, m /* 0-indexed */) {
    return new Date(y, m + 1, 0).getDate();
}
function rangeToDates(key) {
    const today = todayStr();
    if (isMonthRangeKey(key)) {
        const [y, m] = key.split("-").map(Number);
        const start = `${key}-01`;
        const end = new Date(y, m, 0).toISOString().slice(0, 10);
        return [start, end];
    }
    switch (key) {
        case "today":
            return [today, today];
        case "yesterday": {
            const y = shiftDate(today, -1);
            return [y, y];
        }
        case "last7":
            return [shiftDate(today, -6), today];
        default:
            return [today, today];
    }
}
// end-of-month shareable summary — "মাসিক পর্যালোচনা"
function MonthlyReviewModal({ data, onClose }) {
    const { monthLabel, income, expense, savings, topCategory, momPct, withinBudget } = data;
    const [showText, setShowText] = useState(false);
    const shareText = useMemo(() => {
        const lines = [];
        lines.push(`${monthLabel}-এর হিসাব`);
        lines.push(`মোট আয়: ${formatTaka(income)}`);
        lines.push(`মোট ব্যয়: ${formatTaka(expense)}`);
        lines.push(`সঞ্চয়: ${formatTaka(savings)}`);
        if (topCategory)
            lines.push(`সবচেয়ে বেশি খরচ: ${topCategory.info.icon} ${topCategory.info.label} — ${formatTaka(topCategory.amount)}`);
        if (momPct !== null)
            lines.push(`গত মাসের তুলনায়: ${momPct <= 0 ? `${toBnDigits(Math.abs(momPct))}% কম` : `${toBnDigits(momPct)}% বেশি`} খরচ`);
        if (withinBudget)
            lines.push(`🏆 এই মাসে বাজেটের মধ্যে ছিলেন`);
        return lines.join("\n");
    }, [monthLabel, income, expense, savings, topCategory, momPct, withinBudget]);
    const share = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: `${monthLabel}-এর হিসাব`, text: shareText });
            }
            catch (e) {
                // cancelled — no action needed
            }
        }
        else {
            setShowText(true);
        }
    };
    return (React.createElement(ModalShell, { onClose: onClose, title: `${monthLabel}-এর হিসাব` },
        React.createElement("div", { style: styles.reviewStatBlock },
            React.createElement("div", { style: styles.reviewStatLabel }, "\u09AE\u09CB\u099F \u0986\u09AF\u09BC"),
            React.createElement("div", { style: Object.assign(Object.assign({}, styles.reviewStatVal), { color: "var(--hk-success)" }) }, formatTaka(income))),
        React.createElement("div", { style: styles.reviewStatBlock },
            React.createElement("div", { style: styles.reviewStatLabel }, "\u09AE\u09CB\u099F \u09AC\u09CD\u09AF\u09AF\u09BC"),
            React.createElement("div", { style: Object.assign(Object.assign({}, styles.reviewStatVal), { color: "var(--hk-danger)" }) }, formatTaka(expense))),
        React.createElement("div", { style: styles.reviewStatBlock },
            React.createElement("div", { style: styles.reviewStatLabel }, "\u09B8\u099E\u09CD\u099A\u09AF\u09BC"),
            React.createElement("div", { style: Object.assign(Object.assign({}, styles.reviewStatVal), { color: savings >= 0 ? "var(--hk-success)" : "var(--hk-danger)" }) }, formatTaka(savings, { sign: true }))),
        topCategory && (React.createElement("div", { style: styles.reviewHighlight },
            "\u0986\u09AA\u09A8\u09BF \u09B8\u09AC\u099A\u09C7\u09AF\u09BC\u09C7 \u09AC\u09C7\u09B6\u09BF \u0996\u09B0\u099A \u0995\u09B0\u09C7\u099B\u09C7\u09A8 ",
            React.createElement("b", null,
                topCategory.info.icon,
                " ",
                topCategory.info.label),
            "-\u098F \u2014 ",
            formatTaka(topCategory.amount))),
        momPct !== null && (React.createElement("div", { style: styles.reviewHighlight },
            "\u0997\u09A4 \u09AE\u09BE\u09B8\u09C7\u09B0 \u09A4\u09C1\u09B2\u09A8\u09BE\u09AF\u09BC ",
            momPct <= 0 ? `↓ ${toBnDigits(Math.abs(momPct))}% কম` : `↑ ${toBnDigits(momPct)}% বেশি`,
            " \u0996\u09B0\u099A \u09B9\u09AF\u09BC\u09C7\u099B\u09C7")),
        withinBudget && (React.createElement("div", { style: styles.reviewAchievement }, "\uD83C\uDFC6 \u098F\u0987 \u09AE\u09BE\u09B8\u09C7 \u0986\u09AA\u09A8\u09BF \u09AC\u09BE\u099C\u09C7\u099F\u09C7\u09B0 \u09AE\u09A7\u09CD\u09AF\u09C7 \u099B\u09BF\u09B2\u09C7\u09A8")),
        React.createElement("div", { style: styles.formActions },
            React.createElement("button", { style: styles.saveBtn, onClick: share },
                React.createElement(Icon, { name: "share", size: 15, style: { verticalAlign: "-3px", marginRight: 5 } }),
                " \u09B6\u09C7\u09AF\u09BC\u09BE\u09B0 \u0995\u09B0\u09C1\u09A8")),
        showText && (React.createElement("textarea", { readOnly: true, style: styles.exportBox, value: shareText, onFocus: (e) => e.target.select() }))));
}
function Reports({ transactions, categoryBudgets, budget }) {
    const cats = useCategories();
    const monthOptions = useMemo(() => buildMonthOptions(), []);
    const [range, setRange] = useState(monthOptions[0].key);
    const [start, end] = rangeToDates(range);
    const [showReview, setShowReview] = useState(false);
    const filtered = useMemo(() => transactions.filter((t) => t.date >= start && t.date <= end), [transactions, start, end]);
    const income = filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const saved = income - expense;
    const savingRate = income > 0 ? Math.round((saved / income) * 100) : 0;
    const byCategory = useMemo(() => {
        const map = {};
        for (const t of filtered) {
            if (t.type !== "expense")
                continue;
            map[t.category] = (map[t.category] || 0) + t.amount;
        }
        return Object.entries(map)
            .map(([key, amount]) => ({ key, amount, info: catInfo("expense", key, cats) }))
            .sort((a, b) => b.amount - a.amount);
    }, [filtered]);
    const maxCat = byCategory.length > 0 ? byCategory[0].amount : 0;
    // combo chart: only meaningful for a month-level range — current month's
    // daily expense as bars vs the previous month's daily expense as a line
    const comboData = useMemo(() => {
        if (!isMonthRangeKey(range))
            return null;
        const [y, m1] = range.split("-").map(Number);
        const m = m1 - 1; // 0-indexed
        const curDays = daysInGregMonth(y, m);
        const prevDate = new Date(y, m - 1, 1);
        const prevY = prevDate.getFullYear();
        const prevM = prevDate.getMonth();
        const prevDays = daysInGregMonth(prevY, prevM);
        const curVals = new Array(curDays).fill(0);
        const prevVals = new Array(prevDays).fill(0);
        const curPrefix = range;
        const prevPrefix = `${prevY}-${String(prevM + 1).padStart(2, "0")}`;
        for (const t of transactions) {
            if (t.type !== "expense")
                continue;
            if (t.date.startsWith(curPrefix)) {
                const day = parseInt(t.date.slice(8, 10), 10);
                curVals[day - 1] += t.amount;
            }
            else if (t.date.startsWith(prevPrefix)) {
                const day = parseInt(t.date.slice(8, 10), 10);
                prevVals[day - 1] += t.amount;
            }
        }
        const curLabel = GREG_MONTHS_BN[m];
        const prevLabel = GREG_MONTHS_BN[prevM];
        return { curVals, prevVals, curLabel, prevLabel };
    }, [range, transactions]);
    const budgetUtil = useMemo(() => {
        return Object.entries(categoryBudgets || {})
            .filter(([, amt]) => amt > 0)
            .map(([key, amt]) => {
            var _a;
            const spent = ((_a = byCategory.find((c) => c.key === key)) === null || _a === void 0 ? void 0 : _a.amount) || 0;
            const info = catInfo("expense", key, cats);
            return { key, amt, spent, info, pct: Math.min(999, Math.round((spent / amt) * 100)) };
        })
            .sort((a, b) => b.pct - a.pct);
    }, [categoryBudgets, byCategory, cats]);
    // "মাসিক পর্যালোচনা" — only meaningful when a specific month is selected
    const reviewData = useMemo(() => {
        if (!isMonthRangeKey(range) || !comboData)
            return null;
        const prevExpenseTotal = comboData.prevVals.reduce((a, b) => a + b, 0);
        const momPct = prevExpenseTotal > 0 ? Math.round(((expense - prevExpenseTotal) / prevExpenseTotal) * 100) : null;
        const topCategory = byCategory.length > 0 ? byCategory[0] : null;
        const withinBudget = budget > 0 && expense <= budget;
        return {
            monthLabel: comboData.curLabel,
            income, expense, savings: saved,
            topCategory, momPct, withinBudget,
        };
    }, [range, comboData, expense, income, saved, byCategory, budget]);
    return (React.createElement("div", { style: styles.pageLedger },
        React.createElement("div", { style: styles.rangeRow }, RANGE_OPTIONS.map((r) => (React.createElement("button", { key: r.key, onClick: () => setRange(r.key), style: Object.assign(Object.assign({}, styles.rangeChip), (range === r.key ? styles.rangeChipActive : {})) }, r.label)))),
        React.createElement("div", { style: styles.monthListWrap }, monthOptions.map((mo) => (React.createElement("button", { key: mo.key, onClick: () => setRange(mo.key), style: Object.assign(Object.assign({}, styles.monthChip), (range === mo.key ? styles.monthChipActive : {})) }, mo.label)))),
        reviewData && (React.createElement("button", { style: styles.reviewBtn, onClick: () => setShowReview(true) },
            React.createElement("span", null,
                "\uD83D\uDCCA ",
                reviewData.monthLabel,
                "-\u098F\u09B0 \u09AA\u09B0\u09CD\u09AF\u09BE\u09B2\u09CB\u099A\u09A8\u09BE \u09A6\u09C7\u0996\u09C1\u09A8"),
            React.createElement("span", null, "\u203A"))),
        showReview && reviewData && (React.createElement(MonthlyReviewModal, { data: reviewData, onClose: () => setShowReview(false) })),
        React.createElement("div", { style: styles.summaryCard },
            React.createElement("div", { style: styles.summaryRow },
                React.createElement("span", null, "\u0986\u09AF\u09BC"),
                React.createElement("span", { style: { color: "var(--hk-success)", fontFamily: "'JetBrains Mono', monospace" } }, formatTaka(income))),
            React.createElement("div", { style: styles.summaryRow },
                React.createElement("span", null, "\u09AC\u09CD\u09AF\u09AF\u09BC"),
                React.createElement("span", { style: { color: "var(--hk-danger)", fontFamily: "'JetBrains Mono', monospace" } }, formatTaka(expense))),
            React.createElement("div", { style: styles.summaryDivider }),
            React.createElement("div", { style: styles.summaryRow },
                React.createElement("span", { style: { fontWeight: 700 } }, "\u09B8\u099E\u09CD\u099A\u09AF\u09BC"),
                React.createElement("span", { style: { fontWeight: 700, color: saved >= 0 ? "var(--hk-success)" : "var(--hk-danger)", fontFamily: "'JetBrains Mono', monospace" } }, formatTaka(saved))),
            React.createElement("div", { style: styles.savingRateRow },
                "\u09B8\u099E\u09CD\u099A\u09AF\u09BC\u09C7\u09B0 \u09B9\u09BE\u09B0: ",
                React.createElement("b", null,
                    toBnDigits(savingRate),
                    "%"))),
        React.createElement("div", { style: styles.sectionTitle }, "\u0986\u09AF\u09BC \u09AC\u09A8\u09BE\u09AE \u09AC\u09CD\u09AF\u09AF\u09BC"),
        React.createElement("div", { style: styles.chartCard },
            React.createElement(IncomeExpenseBarChart, { income: income, expense: expense })),
        comboData && (React.createElement(React.Fragment, null,
            React.createElement("div", { style: styles.sectionTitle },
                "\u09AE\u09BE\u09B8\u09BF\u0995 \u09A4\u09C1\u09B2\u09A8\u09BE \u2014 ",
                comboData.curLabel,
                " \u09AC\u09A8\u09BE\u09AE ",
                comboData.prevLabel),
            React.createElement("div", { style: styles.chartCard },
                React.createElement(ComboChart, { barValues: comboData.curVals, lineValues: comboData.prevVals, barLabel: comboData.curLabel, lineLabel: comboData.prevLabel })))),
        React.createElement("div", { style: styles.sectionTitle }, "\u0996\u09BE\u09A4 \u0985\u09A8\u09C1\u09AF\u09BE\u09AF\u09BC\u09C0 \u0996\u09B0\u099A"),
        byCategory.length === 0 ? (React.createElement(EmptyState, { text: "\u098F\u0987 \u09B8\u09AE\u09AF\u09BC\u09C7\u09B0 \u09AE\u09A7\u09CD\u09AF\u09C7 \u0995\u09CB\u09A8\u09CB \u0996\u09B0\u099A \u09A8\u09C7\u0987\u0964" })) : (React.createElement(React.Fragment, null,
            React.createElement("div", { style: styles.chartCard },
                React.createElement(DonutChart, { data: byCategory.map((c) => ({ label: `${c.info.icon} ${c.info.label}`, amount: c.amount })) })),
            React.createElement("div", { style: styles.catList }, byCategory.map((c) => (React.createElement("div", { key: c.key, style: styles.catRow },
                React.createElement("div", { style: styles.catRowTop },
                    React.createElement("span", null,
                        React.createElement(CategoryIcon, { catKey: c.key, emoji: c.info.icon, size: 15 }),
                        " ",
                        c.info.label),
                    React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace" } }, formatTaka(c.amount))),
                React.createElement("div", { style: styles.catBarTrack },
                    React.createElement("div", { style: Object.assign(Object.assign({}, styles.catBarFill), { width: `${maxCat ? (c.amount / maxCat) * 100 : 0}%` }) })))))))),
        budgetUtil.length > 0 && (React.createElement(React.Fragment, null,
            React.createElement("div", { style: styles.sectionTitle }, "\u09AC\u09BE\u099C\u09C7\u099F \u09AC\u09CD\u09AF\u09AC\u09B9\u09BE\u09B0 (\u0996\u09BE\u09A4\u09AD\u09BF\u09A4\u09CD\u09A4\u09BF\u0995)"),
            React.createElement("div", { style: styles.catList }, budgetUtil.map((c) => (React.createElement("div", { key: c.key, style: styles.catRow },
                React.createElement("div", { style: styles.catRowTop },
                    React.createElement("span", null,
                        React.createElement(CategoryIcon, { catKey: c.key, emoji: c.info.icon, size: 15 }),
                        " ",
                        c.info.label),
                    React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace" } },
                        formatTaka(c.spent),
                        " / ",
                        formatTaka(c.amt))),
                React.createElement("div", { style: styles.budgetBarTrack },
                    React.createElement("div", { style: Object.assign(Object.assign({}, styles.budgetBarFill), { width: `${Math.min(100, c.pct)}%`, background: c.pct >= 100 ? "var(--hk-danger)" : c.pct >= 90 ? "var(--hk-danger-mid)" : c.pct >= 70 ? "var(--hk-gold)" : "var(--hk-success-mid)" }) }))))))))));
}
/* ---------------- search ---------------- */
function SearchView({ transactions, onOpenTx }) {
    const cats = useCategories();
    const [q, setQ] = useState("");
    const [type, setType] = useState("all");
    const [method, setMethod] = useState("all");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [amountMin, setAmountMin] = useState("");
    const [amountMax, setAmountMax] = useState("");
    const results = useMemo(() => {
        const query = q.trim().toLowerCase();
        const min = parseFloat(amountMin);
        const max = parseFloat(amountMax);
        return [...transactions]
            .filter((t) => {
            if (type !== "all" && t.type !== type)
                return false;
            if (method !== "all" && t.method !== method)
                return false;
            if (dateFrom && t.date < dateFrom)
                return false;
            if (dateTo && t.date > dateTo)
                return false;
            if (!isNaN(min) && t.amount < min)
                return false;
            if (!isNaN(max) && t.amount > max)
                return false;
            if (!query)
                return true;
            const cat = catInfo(t.type, t.category, cats).label.toLowerCase();
            const note = (t.note || "").toLowerCase();
            return cat.includes(query) || note.includes(query);
        })
            .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : b.createdAt - a.createdAt));
    }, [transactions, q, type, method, dateFrom, dateTo, amountMin, amountMax, cats]);
    const totalAmount = useMemo(() => results.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0), [results]);
    const applyQuickDate = (range) => {
        const today = todayStr();
        if (range === "today") {
            setDateFrom(today);
            setDateTo(today);
        }
        else if (range === "week") {
            setDateFrom(shiftDate(today, -6));
            setDateTo(today);
        }
        else if (range === "month") {
            const d = new Date();
            setDateFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
            setDateTo(today);
        }
    };
    return (React.createElement("div", { style: styles.pageLedger },
        React.createElement("input", { style: styles.searchInput, placeholder: "\u0996\u09BE\u09A4 \u09AC\u09BE \u09A8\u09CB\u099F \u09B2\u09BF\u0996\u09C7 \u0996\u09C1\u0981\u099C\u09C1\u09A8\u2026", value: q, onChange: (e) => setQ(e.target.value) }),
        React.createElement("div", { style: styles.quickFilterRow },
            React.createElement("button", { style: styles.quickFilterChip, onClick: () => applyQuickDate("today") }, "\u0986\u099C"),
            React.createElement("button", { style: styles.quickFilterChip, onClick: () => applyQuickDate("week") }, "\u098F\u0987 \u09B8\u09AA\u09CD\u09A4\u09BE\u09B9"),
            React.createElement("button", { style: styles.quickFilterChip, onClick: () => applyQuickDate("month") }, "\u098F\u0987 \u09AE\u09BE\u09B8"),
            METHODS.map((m) => (React.createElement("button", { key: m.key, style: Object.assign(Object.assign({}, styles.quickFilterChip), (method === m.key ? styles.quickFilterChipActive : {})), onClick: () => setMethod(method === m.key ? "all" : m.key) }, m.label)))),
        React.createElement("div", { style: styles.filterRow },
            React.createElement("select", { style: styles.filterSelect, value: type, onChange: (e) => setType(e.target.value) },
                React.createElement("option", { value: "all" }, "\u09B8\u09AC \u09A7\u09B0\u09A8"),
                React.createElement("option", { value: "income" }, "\u0986\u09AF\u09BC"),
                React.createElement("option", { value: "expense" }, "\u09AC\u09CD\u09AF\u09AF\u09BC")),
            React.createElement("select", { style: styles.filterSelect, value: method, onChange: (e) => setMethod(e.target.value) },
                React.createElement("option", { value: "all" }, "\u09B8\u09AC \u09AE\u09BE\u09A7\u09CD\u09AF\u09AE"),
                METHODS.map((m) => (React.createElement("option", { key: m.key, value: m.key }, m.label))))),
        React.createElement("button", { style: styles.advToggle, onClick: () => setShowAdvanced((v) => !v) }, showAdvanced ? "সাধারণ ফিল্টার ▲" : "অ্যাডভান্সড ফিল্টার (তারিখ ও পরিমাণ) ▼"),
        showAdvanced && (React.createElement("div", { style: styles.advPanel },
            React.createElement("div", { style: styles.formLabel }, "\u09A4\u09BE\u09B0\u09BF\u0996 \u09B8\u09C0\u09AE\u09BE"),
            React.createElement("div", { style: styles.filterRow },
                React.createElement("input", { style: styles.textInput, type: "date", value: dateFrom, onChange: (e) => setDateFrom(e.target.value) }),
                React.createElement("input", { style: styles.textInput, type: "date", value: dateTo, onChange: (e) => setDateTo(e.target.value) })),
            React.createElement("div", { style: styles.formLabel }, "\u09AA\u09B0\u09BF\u09AE\u09BE\u09A3 \u09B8\u09C0\u09AE\u09BE (\u09F3)"),
            React.createElement("div", { style: styles.filterRow },
                React.createElement("input", { style: styles.textInput, type: "number", placeholder: "\u09B8\u09B0\u09CD\u09AC\u09A8\u09BF\u09AE\u09CD\u09A8", value: amountMin, onChange: (e) => setAmountMin(e.target.value) }),
                React.createElement("input", { style: styles.textInput, type: "number", placeholder: "\u09B8\u09B0\u09CD\u09AC\u09CB\u099A\u09CD\u099A", value: amountMax, onChange: (e) => setAmountMax(e.target.value) })),
            (dateFrom || dateTo || amountMin || amountMax) && (React.createElement("button", { style: styles.dangerLink, onClick: () => { setDateFrom(""); setDateTo(""); setAmountMin(""); setAmountMax(""); } }, "\u09AB\u09BF\u09B2\u09CD\u099F\u09BE\u09B0 \u09AE\u09C1\u099B\u09C1\u09A8")))),
        React.createElement("div", { style: styles.resultCount },
            toBnDigits(results.length),
            "\u099F\u09BF \u09AB\u09B2\u09BE\u09AB\u09B2",
            results.length > 0 ? ` · নিট ${formatTaka(totalAmount, { sign: true })}` : ""),
        results.length === 0 ? (React.createElement(EmptyState, { text: "\u0995\u09CB\u09A8\u09CB \u09B2\u09C7\u09A8\u09A6\u09C7\u09A8 \u09AA\u09BE\u0993\u09AF\u09BC\u09BE \u09AF\u09BE\u09AF\u09BC\u09A8\u09BF\u0964" })) : (React.createElement("div", { style: styles.txList }, results.map((t) => (React.createElement(TxRow, { key: t.id, tx: t, onClick: () => onOpenTx(t), showMethod: true, showDate: true })))))));
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
        { key: "family", label: "ফ্যামিলি", icon: "family" },
        { key: "reports", label: "রিপোর্ট", icon: "reports" },
        { key: "search", label: "খুঁজুন", icon: "search" },
    ];
    return (React.createElement("nav", { style: styles.bottomNav }, items.map((it) => (React.createElement("button", { key: it.key, onClick: () => setTab(it.key), style: Object.assign(Object.assign({}, styles.navBtn), { color: tab === it.key ? "var(--hk-gold)" : "#8A9296" }) },
        React.createElement(Icon, { name: it.icon, size: 19, strokeWidth: tab === it.key ? 2.1 : 1.8 }),
        React.createElement("div", { style: { fontSize: 11, marginTop: 2 } }, it.label))))));
}
/* ---------------- family management + family bazar ---------------- */
const fvStyles = {
    wrap: { padding: "12px 14px 90px" },
    subTabs: { display: "flex", gap: 8, marginBottom: 14 },
    subTabBtn: (active) => ({
        flex: 1, padding: "9px 0", borderRadius: 10, border: "1px solid var(--hk-border)",
        background: active ? "var(--hk-gold)" : "var(--hk-card)",
        color: active ? "#1a1a1a" : "var(--hk-text)", fontWeight: 600, fontSize: 13.5,
    }),
    card: { background: "var(--hk-card)", border: "1px solid var(--hk-border)", borderRadius: 12, padding: "12px 14px", marginBottom: 10 },
    row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 },
    muted: { color: "var(--hk-text-muted)", fontSize: 12.5 },
    addBtn: { display: "block", width: "100%", padding: "11px 0", borderRadius: 10, background: "var(--hk-gold)", color: "#1a1a1a", fontWeight: 700, fontSize: 14, marginBottom: 14, border: "none" },
    iconBtn: { background: "transparent", border: "none", padding: 6, color: "var(--hk-text-muted)" },
    input: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--hk-border)", background: "var(--hk-bg)", color: "var(--hk-text)", fontSize: 14, marginBottom: 10, boxSizing: "border-box" },
    label: { fontSize: 12.5, color: "var(--hk-text-muted)", marginBottom: 5, display: "block" },
    filterRow: { display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" },
    chip: (active) => ({ padding: "6px 12px", borderRadius: 999, border: "1px solid var(--hk-border)", fontSize: 12.5, background: active ? "var(--hk-gold)" : "var(--hk-card)", color: active ? "#1a1a1a" : "var(--hk-text)" }),
    totalsBar: { display: "flex", justifyContent: "space-between", background: "var(--hk-surface-soft)", borderRadius: 10, padding: "10px 14px", marginTop: 6, fontSize: 12.5 },
    confirmBtn: { background: "var(--hk-danger)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12 },
};
function FamilyView({ familyMembers, bazarItems, transactions, onAddMember, onUpdateMember, onDeleteMember, onAddBazarItem, onUpdateBazarItem, onDeleteBazarItem, onAddBazarItemAsExpense, }) {
    const [subTab, setSubTab] = useState("bazar"); // bazar | members | summary
    const [showMemberForm, setShowMemberForm] = useState(false);
    const [editingMember, setEditingMember] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [showBazarForm, setShowBazarForm] = useState(false);
    const [editingBazarItem, setEditingBazarItem] = useState(null);
    const [search, setSearch] = useState("");
    const [catFilter, setCatFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all"); // all | unpurchased | purchased
    const [historyFor, setHistoryFor] = useState(null); // { productName, unit }
    const memberName = (id) => { var _a; return ((_a = familyMembers.find((m) => m.id === id)) === null || _a === void 0 ? void 0 : _a.name) || "অনির্ধারিত"; };
    const filteredBazar = useMemo(() => bazarItems.filter((it) => {
        if (search.trim() && !(it.productName || "").toLowerCase().includes(search.trim().toLowerCase()))
            return false;
        if (catFilter !== "all" && it.category !== catFilter)
            return false;
        if (statusFilter === "purchased" && !it.purchased)
            return false;
        if (statusFilter === "unpurchased" && it.purchased)
            return false;
        return true;
    }), [bazarItems, search, catFilter, statusFilter]);
    const estTotal = filteredBazar.reduce((s, it) => s + bazarEstimatedTotal(it), 0);
    const actTotal = filteredBazar.filter((it) => it.purchased).reduce((s, it) => s + computeBazarTotal(it), 0);
    const memberSpend = (id) => {
        const bazarSum = bazarItems.filter((it) => it.familyMemberId === id && it.purchased).reduce((s, it) => s + computeBazarTotal(it), 0);
        const txSum = transactions.filter((t) => t.familyMemberId === id && !t.bazarItemId && t.type === "expense").reduce((s, t) => s + t.amount, 0);
        return bazarSum + txSum;
    };
    const subTabsBar = React.createElement("div", { style: fvStyles.subTabs },
        React.createElement("button", { style: fvStyles.subTabBtn(subTab === "bazar"), onClick: () => setSubTab("bazar") }, "\uD83D\uDED2 \u09AC\u09BE\u099C\u09BE\u09B0"),
        React.createElement("button", { style: fvStyles.subTabBtn(subTab === "members"), onClick: () => setSubTab("members") }, "\uD83D\uDC6A \u09B8\u09A6\u09B8\u09CD\u09AF"),
        React.createElement("button", { style: fvStyles.subTabBtn(subTab === "summary"), onClick: () => setSubTab("summary") }, "\uD83D\uDCCA \u09B8\u09BE\u09B0\u09BE\u0982\u09B6"));
    const memberRow = (m) => React.createElement("div", { key: m.id, style: fvStyles.card },
        React.createElement("div", { style: fvStyles.row },
            React.createElement("div", null,
                React.createElement("div", { style: { fontWeight: 600, fontSize: 14.5 } }, m.name),
                m.relation && React.createElement("div", { style: fvStyles.muted }, m.relation),
                React.createElement("div", { style: Object.assign(Object.assign({}, fvStyles.muted), { marginTop: 3 }) }, "\u09AE\u09CB\u099F \u0996\u09B0\u099A: ", formatTaka(memberSpend(m.id)))),
            React.createElement("div", { style: { display: "flex", gap: 2 } },
                React.createElement("button", { style: fvStyles.iconBtn, onClick: () => { setEditingMember(m); setShowMemberForm(true); } }, React.createElement(Icon, { name: "edit", size: 15 })),
                deleteConfirmId === m.id
                    ? React.createElement("button", { style: fvStyles.confirmBtn, onClick: () => { onDeleteMember(m.id); setDeleteConfirmId(null); } }, "\u09A8\u09BF\u09B6\u09CD\u099A\u09BF\u09A4?")
                    : React.createElement("button", { style: fvStyles.iconBtn, onClick: () => setDeleteConfirmId(m.id) }, React.createElement(Icon, { name: "delete", size: 15 })))));
    const membersSectionChildren = [
        React.createElement("button", { key: "add", style: fvStyles.addBtn, onClick: () => { setEditingMember(null); setShowMemberForm(true); } }, "+ \u09A8\u09A4\u09C1\u09A8 \u09B8\u09A6\u09B8\u09CD\u09AF \u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8"),
    ];
    if (familyMembers.length === 0) {
        membersSectionChildren.push(React.createElement(EmptyState, { key: "empty", text: "\u098F\u0996\u09A8\u09CB \u0995\u09CB\u09A8\u09CB \u09AA\u09B0\u09BF\u09AC\u09BE\u09B0\u09C7\u09B0 \u09B8\u09A6\u09B8\u09CD\u09AF \u09AF\u09CB\u0997 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09A8\u09BF\u0964" }));
    }
    else {
        familyMembers.forEach((m) => membersSectionChildren.push(memberRow(m)));
    }
    if (showMemberForm) {
        membersSectionChildren.push(React.createElement(MemberForm, { key: "form", initial: editingMember, onClose: () => setShowMemberForm(false), onSave: (data) => { editingMember ? onUpdateMember(editingMember.id, data) : onAddMember(data); setShowMemberForm(false); } }));
    }
    const membersSection = React.createElement("div", null, ...membersSectionChildren);
    const summarySectionChildren = [];
    if (familyMembers.length === 0) {
        summarySectionChildren.push(React.createElement(EmptyState, { key: "empty", text: "\u09B8\u09BE\u09B0\u09BE\u0982\u09B6 \u09A6\u09C7\u0996\u09A4\u09C7 \u0986\u0997\u09C7 \u09AA\u09B0\u09BF\u09AC\u09BE\u09B0\u09C7\u09B0 \u09B8\u09A6\u09B8\u09CD\u09AF \u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8\u0964" }));
    }
    else {
        familyMembers.forEach((m) => summarySectionChildren.push(React.createElement("div", { key: m.id, style: fvStyles.card },
            React.createElement("div", { style: fvStyles.row },
                React.createElement("span", { style: { fontWeight: 600 } }, m.name),
                React.createElement("span", { style: { fontWeight: 700, color: "var(--hk-danger-mid)" } }, formatTaka(memberSpend(m.id)))))));
    }
    summarySectionChildren.push(React.createElement("div", { key: "totals", style: fvStyles.totalsBar },
        React.createElement("span", null, "\u09AE\u09CB\u099F \u09AC\u09BE\u099C\u09BE\u09B0 \u0996\u09B0\u099A (\u0995\u09CD\u09B0\u09AF\u09BC\u0995\u09C3\u09A4)"),
        React.createElement("strong", null, formatTaka(bazarItems.filter((it) => it.purchased).reduce((s, it) => s + computeBazarTotal(it), 0)))));
    const summarySection = React.createElement("div", null, ...summarySectionChildren);
    const bazarRow = (it) => React.createElement("div", { key: it.id, style: fvStyles.card },
        React.createElement("div", { style: fvStyles.row },
            React.createElement("div", { style: { flex: 1 }, onClick: () => it.purchased && setHistoryFor({ productName: it.productName, unit: it.unit }) },
                React.createElement("div", { style: { fontWeight: 600, fontSize: 14 } }, (BAZAR_CATS.find((c) => c.key === it.category) || {}).icon || "🛒", " ", it.productName),
                React.createElement("div", { style: fvStyles.muted }, it.quantity, " ", (BAZAR_UNITS.find((u) => u.key === it.unit) || {}).label || it.unit, it.rate ? ` · ৳${it.rate}/${(BAZAR_UNITS.find((u) => u.key === it.unit) || {}).label || it.unit}` : "", it.familyMemberId ? ` · ${memberName(it.familyMemberId)}` : ""),
                React.createElement("div", { style: { fontSize: 13, marginTop: 3, fontWeight: 600 } }, it.purchased ? `প্রকৃত: ${formatTaka(computeBazarTotal(it))}` : `আনুমানিক: ${formatTaka(bazarEstimatedTotal(it))}`)),
            React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 } },
                React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--hk-text-muted)" } },
                    React.createElement("input", { type: "checkbox", checked: !!it.purchased, onChange: (e) => onUpdateBazarItem(it.id, { purchased: e.target.checked, purchaseDate: it.purchaseDate || todayStr() }) }),
                    "\u0995\u09C7\u09A8\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7"),
                React.createElement("div", { style: { display: "flex", gap: 2 } },
                    React.createElement("button", { style: fvStyles.iconBtn, onClick: () => { setEditingBazarItem(it); setShowBazarForm(true); } }, React.createElement(Icon, { name: "edit", size: 14 })),
                    deleteConfirmId === it.id
                        ? React.createElement("button", { style: fvStyles.confirmBtn, onClick: () => { onDeleteBazarItem(it.id); setDeleteConfirmId(null); } }, "\u09A8\u09BF\u09B6\u09CD\u099A\u09BF\u09A4?")
                        : React.createElement("button", { style: fvStyles.iconBtn, onClick: () => setDeleteConfirmId(it.id) }, React.createElement(Icon, { name: "delete", size: 14 }))))),
        it.purchased ? (it.expenseAdded
            ? React.createElement("span", { style: { fontSize: 11.5, color: "var(--hk-success)" } }, "\u2713 \u0996\u09B0\u099A \u09AF\u09CB\u0997 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7")
            : React.createElement("button", { style: { fontSize: 11.5, background: "var(--hk-gold)", color: "#1a1a1a", border: "none", borderRadius: 8, padding: "5px 9px", marginTop: 6 }, onClick: () => onAddBazarItemAsExpense(it) }, "\u0996\u09B0\u099A \u09B9\u09BF\u09B8\u09C7\u09AC\u09C7 \u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8"))
            : null);
    const bazarSectionChildren = [
        React.createElement("button", { key: "add", style: fvStyles.addBtn, onClick: () => { setEditingBazarItem(null); setShowBazarForm(true); } }, "+ \u09A8\u09A4\u09C1\u09A8 \u09AC\u09BE\u099C\u09BE\u09B0 \u0986\u0987\u099F\u09C7\u09AE"),
        React.createElement("input", { key: "search", style: fvStyles.input, placeholder: "\u0996\u09C1\u0981\u099C\u09C1\u09A8 (\u09AA\u09A3\u09CD\u09AF\u09C7\u09B0 \u09A8\u09BE\u09AE)", value: search, onChange: (e) => setSearch(e.target.value) }),
        React.createElement("div", { key: "statusFilter", style: fvStyles.filterRow },
            React.createElement("button", { style: fvStyles.chip(statusFilter === "all"), onClick: () => setStatusFilter("all") }, "\u09B8\u09AC"),
            React.createElement("button", { style: fvStyles.chip(statusFilter === "unpurchased"), onClick: () => setStatusFilter("unpurchased") }, "\u0995\u09C7\u09A8\u09BE \u09AC\u09BE\u0995\u09BF"),
            React.createElement("button", { style: fvStyles.chip(statusFilter === "purchased"), onClick: () => setStatusFilter("purchased") }, "\u0995\u09C7\u09A8\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7")),
        React.createElement("div", { key: "catFilter", style: fvStyles.filterRow }, [React.createElement("button", { key: "all", style: fvStyles.chip(catFilter === "all"), onClick: () => setCatFilter("all") }, "\u09B8\u09AC \u0995\u09CD\u09AF\u09BE\u099F\u09C7\u0997\u09B0\u09BF")].concat(BAZAR_CATS.map((c) => React.createElement("button", { key: c.key, style: fvStyles.chip(catFilter === c.key), onClick: () => setCatFilter(c.key) }, c.icon, " ", c.label)))),
    ];
    if (filteredBazar.length === 0) {
        bazarSectionChildren.push(React.createElement(EmptyState, { key: "empty", text: "\u098F\u0996\u09A8\u09CB \u0995\u09CB\u09A8\u09CB \u09AC\u09BE\u099C\u09BE\u09B0 \u0986\u0987\u099F\u09C7\u09AE \u09A8\u09C7\u0987\u0964" }));
    }
    else {
        filteredBazar.forEach((it) => bazarSectionChildren.push(bazarRow(it)));
        bazarSectionChildren.push(React.createElement("div", { key: "totals", style: fvStyles.totalsBar },
            React.createElement("span", null, "\u0986\u09A8\u09C1\u09AE\u09BE\u09A8\u09BF\u0995: ", formatTaka(estTotal)),
            React.createElement("span", null, "\u09AA\u09CD\u09B0\u0995\u09C3\u09A4: ", formatTaka(actTotal)),
            React.createElement("span", null, "\u09AA\u09BE\u09B0\u09CD\u09A5\u0995\u09CD\u09AF: ", formatTaka(actTotal - estTotal))));
    }
    if (showBazarForm) {
        bazarSectionChildren.push(React.createElement(BazarItemForm, { key: "form", initial: editingBazarItem, familyMembers: familyMembers, onClose: () => setShowBazarForm(false), onSave: (data) => { editingBazarItem ? onUpdateBazarItem(editingBazarItem.id, data) : onAddBazarItem(data); setShowBazarForm(false); } }));
    }
    if (historyFor) {
        bazarSectionChildren.push(React.createElement(PriceHistoryModal, { key: "history", productName: historyFor.productName, unit: historyFor.unit, items: bazarItems, onClose: () => setHistoryFor(null) }));
    }
    const bazarSection = React.createElement("div", null, ...bazarSectionChildren);
    return React.createElement("div", { style: fvStyles.wrap }, subTabsBar, subTab === "members" && membersSection, subTab === "summary" && summarySection, subTab === "bazar" && bazarSection);
}
function MemberForm({ initial, onClose, onSave }) {
    const [name, setName] = useState((initial === null || initial === void 0 ? void 0 : initial.name) || "");
    const [relation, setRelation] = useState((initial === null || initial === void 0 ? void 0 : initial.relation) || "");
    const [note, setNote] = useState((initial === null || initial === void 0 ? void 0 : initial.note) || "");
    const [err, setErr] = useState("");
    return (React.createElement(ModalShell, { onClose: onClose, title: initial ? "সদস্য সম্পাদনা" : "নতুন সদস্য" },
        React.createElement("label", { style: fvStyles.label }, "নাম *"),
        React.createElement("input", { style: fvStyles.input, value: name, onChange: (e) => setName(e.target.value) }),
        React.createElement("label", { style: fvStyles.label }, "সম্পর্ক"),
        React.createElement("input", { style: fvStyles.input, placeholder: "যেমন: স্ত্রী, ছেলে, মা", value: relation, onChange: (e) => setRelation(e.target.value) }),
        React.createElement("label", { style: fvStyles.label }, "নোট"),
        React.createElement("input", { style: fvStyles.input, value: note, onChange: (e) => setNote(e.target.value) }),
        err && React.createElement("div", { style: { color: "var(--hk-danger)", fontSize: 12.5, marginBottom: 8 } }, err),
        React.createElement("button", { style: fvStyles.addBtn, onClick: () => { if (!name.trim()) { setErr("নাম লিখুন"); return; } onSave({ name: name.trim(), relation: relation.trim(), note: note.trim() }); } }, "সংরক্ষণ করুন")));
}
function BazarItemForm({ initial, familyMembers, onClose, onSave }) {
    const [productName, setProductName] = useState((initial === null || initial === void 0 ? void 0 : initial.productName) || "");
    const [category, setCategory] = useState((initial === null || initial === void 0 ? void 0 : initial.category) || BAZAR_CATS[0].key);
    const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : "");
    const [unit, setUnit] = useState((initial === null || initial === void 0 ? void 0 : initial.unit) || "kg");
    const [rate, setRate] = useState((initial === null || initial === void 0 ? void 0 : initial.rate) ? String(initial.rate) : "");
    const [estimatedPrice, setEstimatedPrice] = useState((initial === null || initial === void 0 ? void 0 : initial.estimatedPrice) ? String(initial.estimatedPrice) : "");
    const [actualPrice, setActualPrice] = useState((initial === null || initial === void 0 ? void 0 : initial.actualPrice) ? String(initial.actualPrice) : "");
    const [purchaseDate, setPurchaseDate] = useState((initial === null || initial === void 0 ? void 0 : initial.purchaseDate) || todayStr());
    const [familyMemberId, setFamilyMemberId] = useState((initial === null || initial === void 0 ? void 0 : initial.familyMemberId) || "");
    const [note, setNote] = useState((initial === null || initial === void 0 ? void 0 : initial.note) || "");
    const [purchased, setPurchased] = useState((initial === null || initial === void 0 ? void 0 : initial.purchased) || false);
    const [err, setErr] = useState("");
    return (React.createElement(ModalShell, { onClose: onClose, title: initial ? "বাজার আইটেম সম্পাদনা" : "নতুন বাজার আইটেম" },
        React.createElement("label", { style: fvStyles.label }, "পণ্যের নাম *"),
        React.createElement("input", { style: fvStyles.input, value: productName, onChange: (e) => setProductName(e.target.value) }),
        React.createElement("label", { style: fvStyles.label }, "ক্যাটেগরি"),
        React.createElement("select", { style: fvStyles.input, value: category, onChange: (e) => setCategory(e.target.value) }, BAZAR_CATS.map((c) => React.createElement("option", { key: c.key, value: c.key }, c.icon, " ", c.label))),
        React.createElement("div", { style: { display: "flex", gap: 8 } },
            React.createElement("div", { style: { flex: 1 } },
                React.createElement("label", { style: fvStyles.label }, "পরিমাণ"),
                React.createElement("input", { style: fvStyles.input, type: "number", inputMode: "decimal", value: quantity, onChange: (e) => setQuantity(e.target.value) })),
            React.createElement("div", { style: { flex: 1 } },
                React.createElement("label", { style: fvStyles.label }, "একক"),
                React.createElement("select", { style: fvStyles.input, value: unit, onChange: (e) => setUnit(e.target.value) }, BAZAR_UNITS.map((u) => React.createElement("option", { key: u.key, value: u.key }, u.label))))),
        React.createElement("label", { style: fvStyles.label }, "রেট (প্রতি একক)"),
        React.createElement("input", { style: fvStyles.input, type: "number", inputMode: "decimal", value: rate, onChange: (e) => setRate(e.target.value) }),
        React.createElement("div", { style: { display: "flex", gap: 8 } },
            React.createElement("div", { style: { flex: 1 } },
                React.createElement("label", { style: fvStyles.label }, "আনুমানিক মূল্য"),
                React.createElement("input", { style: fvStyles.input, type: "number", inputMode: "decimal", value: estimatedPrice, onChange: (e) => setEstimatedPrice(e.target.value) })),
            React.createElement("div", { style: { flex: 1 } },
                React.createElement("label", { style: fvStyles.label }, "প্রকৃত মূল্য"),
                React.createElement("input", { style: fvStyles.input, type: "number", inputMode: "decimal", value: actualPrice, onChange: (e) => setActualPrice(e.target.value) }))),
        React.createElement("label", { style: fvStyles.label }, "ক্রয়ের তারিখ"),
        React.createElement("input", { style: fvStyles.input, type: "date", value: purchaseDate, onChange: (e) => setPurchaseDate(e.target.value) }),
        React.createElement("label", { style: fvStyles.label }, "পরিবারের সদস্য"),
        React.createElement("select", { style: fvStyles.input, value: familyMemberId, onChange: (e) => setFamilyMemberId(e.target.value) },
            React.createElement("option", { value: "" }, "\u2014 নির্বাচন করুন \u2014"),
            familyMembers.map((m) => React.createElement("option", { key: m.id, value: m.id }, m.name))),
        React.createElement("label", { style: fvStyles.label }, "নোট"),
        React.createElement("input", { style: fvStyles.input, value: note, onChange: (e) => setNote(e.target.value) }),
        React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13.5 } },
            React.createElement("input", { type: "checkbox", checked: purchased, onChange: (e) => setPurchased(e.target.checked) }),
            "\u0995\u09C7\u09A8\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7"),
        err && React.createElement("div", { style: { color: "var(--hk-danger)", fontSize: 12.5, marginBottom: 8 } }, err),
        React.createElement("button", { style: fvStyles.addBtn, onClick: () => {
                if (!productName.trim()) { setErr("পণ্যের নাম লিখুন"); return; }
                onSave({
                    productName: productName.trim(), category, quantity: quantity || "", unit,
                    rate: rate || "", estimatedPrice: estimatedPrice || "", actualPrice: actualPrice || "",
                    purchaseDate, familyMemberId: familyMemberId || null, note: note.trim(), purchased,
                });
            } }, "সংরক্ষণ করুন")));
}
function PriceHistoryModal({ productName, unit, items, onClose }) {
    const history = bazarPriceHistory(items, productName, unit);
    return (React.createElement(ModalShell, { onClose: onClose, title: `\u09AE\u09C2\u09B2\u09CD\u09AF\u09C7\u09B0 \u0987\u09A4\u09BF\u09B9\u09BE\u09B8 \u2014 ${productName}` }, history.length === 0 ? (React.createElement(EmptyState, { text: "\u098F\u0987 \u09AA\u09A3\u09CD\u09AF\u09C7\u09B0 \u0995\u09CB\u09A8\u09CB \u09AA\u09C2\u09B0\u09CD\u09AC\u09AC\u09B0\u09CD\u09A4\u09C0 \u09AE\u09C2\u09B2\u09CD\u09AF \u09A8\u09C7\u0987\u0964" })) : (history.map((h, i) => {
        const prev = i > 0 ? history[i - 1].rate : null;
        const diff = prev != null ? h.rate - prev : null;
        return (React.createElement("div", { key: h.id, style: fvStyles.row, className: "priceHistoryRow" },
            React.createElement("span", { style: fvStyles.muted }, formatDateBn(h.date)),
            React.createElement("span", { style: { fontWeight: 600 } }, formatTaka(h.rate)),
            diff != null && (React.createElement("span", { style: { fontSize: 12, color: diff > 0 ? "var(--hk-danger)" : diff < 0 ? "var(--hk-success)" : "var(--hk-text-muted)" } }, diff > 0 ? `▲ ${formatTaka(diff)}` : diff < 0 ? `▼ ${formatTaka(Math.abs(diff))}` : "—"))));
    }))));
}
/* ---------------- calendar modal ---------------- */
function isAyyamAlBid(date) {
    const h = gregorianToHijri(date);
    return h.day === 13 || h.day === 14 || h.day === 15;
}
function CalendarModal({ specialDays, onSaveSpecialDays, onClose, onRegisterBackHandler }) {
    const [viewDate, setViewDate] = useState(() => {
        const n = new Date();
        return new Date(n.getFullYear(), n.getMonth(), 1);
    });
    const [selectedDate, setSelectedDate] = useState(null); // dateStr or null
    const [newLabel, setNewLabel] = useState("");
    // let App's hardware-back handler know: if the nested special-day detail
    // view is open, a back-press should close just that (return to the
    // calendar grid, same month/selection) — not the whole calendar
    useEffect(() => {
        if (!onRegisterBackHandler)
            return;
        onRegisterBackHandler(() => {
            if (selectedDate) {
                setSelectedDate(null);
                return true;
            }
            return false;
        });
        return () => onRegisterBackHandler(null);
    }, [selectedDate, onRegisterBackHandler]);
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    const firstDay = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const leading = firstDay.getDay();
    const todayS = todayStr();
    const banglaFirst = gregorianToBangla(new Date(y, m, 1));
    const banglaLast = gregorianToBangla(new Date(y, m, daysInMonth));
    const hijriFirst = gregorianToHijri(new Date(y, m, 1));
    const hijriLast = gregorianToHijri(new Date(y, m, daysInMonth));
    const banglaRange = banglaFirst.month === banglaLast.month
        ? `${banglaFirst.month} ${toBnDigits(banglaFirst.year)}`
        : `${banglaFirst.month} - ${banglaLast.month} ${toBnDigits(banglaLast.year)}`;
    const hijriRange = hijriFirst.month === hijriLast.month
        ? `${hijriFirst.month} ${toBnDigits(hijriFirst.year)}`
        : `${hijriFirst.month} - ${hijriLast.month} ${toBnDigits(hijriLast.year)}`;
    const cells = [];
    for (let i = 0; i < leading; i++)
        cells.push(null);
    for (let d = 1; d <= daysInMonth; d++)
        cells.push(d);
    const addLabel = () => {
        const trimmed = newLabel.trim();
        if (!trimmed || !selectedDate)
            return;
        const existing = specialDays[selectedDate] || [];
        onSaveSpecialDays(Object.assign(Object.assign({}, specialDays), { [selectedDate]: [...existing, trimmed] }));
        setNewLabel("");
    };
    const removeLabel = (idx) => {
        const existing = specialDays[selectedDate] || [];
        const next = existing.filter((_, i) => i !== idx);
        const updated = Object.assign({}, specialDays);
        if (next.length === 0)
            delete updated[selectedDate];
        else
            updated[selectedDate] = next;
        onSaveSpecialDays(updated);
    };
    if (selectedDate) {
        const d = new Date(selectedDate + "T00:00:00");
        const bn = formatDateBn(selectedDate);
        const bangla = gregorianToBangla(d);
        const hijri = gregorianToHijri(d);
        const labels = specialDays[selectedDate] || [];
        return (React.createElement(ModalShell, { title: "\u09AC\u09BF\u09B6\u09C7\u09B7 \u09A6\u09BF\u09A8", onClose: () => setSelectedDate(null) },
            React.createElement("button", { style: styles.calBackBtn, onClick: () => setSelectedDate(null) }, "\u2039 \u0995\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09A1\u09BE\u09B0\u09C7 \u09AB\u09BF\u09B0\u09C1\u09A8"),
            React.createElement("div", { style: styles.calDayDetailCard },
                React.createElement("div", { style: styles.calDayDetailDate },
                    bn.weekday,
                    ", ",
                    bn.full),
                React.createElement("div", { style: styles.calDayDetailSub },
                    toBnDigits(bangla.day),
                    " ",
                    bangla.month,
                    " ",
                    toBnDigits(bangla.year),
                    " \u09AC\u09BE\u0982\u09B2\u09BE \u00B7 ",
                    toBnDigits(hijri.day),
                    " ",
                    hijri.month,
                    " ",
                    toBnDigits(hijri.year),
                    " \u09B9\u09BF\u099C\u09B0\u09C0")),
            React.createElement("div", { style: styles.formLabel }, "\u09AC\u09BF\u09B6\u09C7\u09B7 \u09A6\u09BF\u09A8\u09C7\u09B0 \u09A4\u09BE\u09B2\u09BF\u0995\u09BE"),
            labels.length === 0 ? (React.createElement("div", { style: styles.taskEmpty }, "\u098F\u0987 \u09A4\u09BE\u09B0\u09BF\u0996\u09C7 \u098F\u0996\u09A8\u09CB \u0995\u09CB\u09A8\u09CB \u09AC\u09BF\u09B6\u09C7\u09B7 \u09A6\u09BF\u09A8 \u09AF\u09CB\u0997 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09A8\u09BF\u0964")) : (React.createElement("div", { style: { marginBottom: 10 } }, labels.map((label, idx) => (React.createElement("div", { key: idx, style: styles.calSpecialEditRow },
                React.createElement("span", null, label),
                React.createElement("button", { style: styles.taskDelete, onClick: () => removeLabel(idx) }, "\u2715")))))),
            React.createElement("div", { style: styles.taskAddRow },
                React.createElement("input", { style: styles.taskInput, placeholder: "\u09AF\u09C7\u09AE\u09A8: \u09AE\u09C1\u09B9\u09BE\u09AE\u09CD\u09AE\u09A6 \u09B8\u09BE\u0983 \u098F\u09B0 \u09AA\u09CD\u09B0\u09A5\u09AE \u09B9\u09BF\u099C\u09B0\u09A4", value: newLabel, onChange: (e) => setNewLabel(e.target.value), onKeyDown: (e) => e.key === "Enter" && addLabel() }),
                React.createElement("button", { style: styles.taskAddBtn, onClick: addLabel }, "+"))));
    }
    return (React.createElement(ModalShell, { title: "\u0995\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09A1\u09BE\u09B0", onClose: onClose },
        React.createElement("div", { style: styles.calCard },
            React.createElement("div", { style: styles.calNavRow },
                React.createElement("button", { style: styles.calNavBtn, onClick: () => setViewDate(new Date(y, m - 1, 1)) }, "\u2039"),
                React.createElement("div", { style: { textAlign: "center" } },
                    React.createElement("div", { style: styles.calMonthTitle },
                        BN_MONTHS[m],
                        ", ",
                        toBnDigits(y)),
                    React.createElement("div", { style: styles.calSubTitle },
                        banglaRange,
                        " \u09AC\u09BE\u0982\u09B2\u09BE"),
                    React.createElement("div", { style: styles.calSubTitle },
                        hijriRange,
                        " \u09B9\u09BF\u099C\u09B0\u09C0")),
                React.createElement("button", { style: styles.calNavBtn, onClick: () => setViewDate(new Date(y, m + 1, 1)) }, "\u203A")),
            React.createElement("div", { style: styles.calWeekRow }, BN_WEEKDAY_SHORT.map((w, i) => (React.createElement("div", { key: w, style: Object.assign(Object.assign({}, styles.calWeekCell), { background: i === 5 ? "var(--hk-danger-mid)" : "var(--hk-success-mid)" }) }, w)))),
            React.createElement("div", { style: styles.calGrid }, cells.map((d, idx) => {
                if (d === null)
                    return React.createElement("div", { key: idx });
                const dateObj = new Date(y, m, d);
                const dateStr = todayStr(dateObj);
                const weekday = dateObj.getDay(); // 0 Sun ... 5 Fri, 6 Sat
                const isToday = dateStr === todayS;
                const isFriday = weekday === 5;
                const isMonThu = weekday === 1 || weekday === 4;
                const isBid = isAyyamAlBid(dateObj);
                const bangla = gregorianToBangla(dateObj);
                const hijri = gregorianToHijri(dateObj);
                const labels = specialDays[dateStr];
                let circleStyle = {};
                let textColor = "var(--hk-text)";
                if (isToday) {
                    circleStyle = { background: "var(--hk-success-mid)" };
                    textColor = "var(--hk-card)";
                }
                else if (isBid) {
                    circleStyle = { background: "#E8C547" };
                    textColor = "var(--hk-text)";
                }
                else if (isFriday) {
                    circleStyle = { background: "var(--hk-danger-mid)" };
                    textColor = "var(--hk-card)";
                }
                else if (isMonThu) {
                    circleStyle = { background: "#FFFFFF", border: "1px solid var(--hk-border-strong)" };
                    textColor = "var(--hk-text)";
                }
                return (React.createElement("button", { key: idx, style: styles.calCell, onClick: () => setSelectedDate(dateStr) },
                    React.createElement("div", { style: Object.assign(Object.assign({}, styles.calDateCircle), circleStyle) },
                        React.createElement("span", { style: { color: textColor } }, toBnDigits(d))),
                    React.createElement("div", { style: styles.calSubDates },
                        toBnDigits(bangla.day),
                        "/",
                        toBnDigits(hijri.day)),
                    labels && labels.length > 0 && React.createElement("div", { style: styles.calSpecialDot, title: labels.join(", ") })));
            }))),
        React.createElement("div", { style: styles.calLegend },
            React.createElement("span", null,
                React.createElement("i", { style: Object.assign(Object.assign({}, styles.legendDot), { background: "var(--hk-success-mid)" }) }),
                " \u0986\u099C"),
            React.createElement("span", null,
                React.createElement("i", { style: Object.assign(Object.assign({}, styles.legendDot), { background: "var(--hk-danger-mid)" }) }),
                " \u09B6\u09C1\u0995\u09CD\u09B0\u09AC\u09BE\u09B0"),
            React.createElement("span", null,
                React.createElement("i", { style: Object.assign(Object.assign({}, styles.legendDot), { background: "#E8C547" }) }),
                " \u0986\u0987\u09AF\u09BC\u09BE\u09AE\u09C7 \u09AC\u09C0\u099C"),
            React.createElement("span", null,
                React.createElement("i", { style: Object.assign(Object.assign({}, styles.legendDot), { background: "#FFFFFF", border: "1px solid var(--hk-border-med)" }) }),
                " \u09B8\u09CB\u09AE/\u09AC\u09C3\u09B9\u09B8\u09CD\u09AA\u09A4\u09BF"),
            React.createElement("span", null,
                React.createElement("i", { style: Object.assign(Object.assign({}, styles.legendDot), { background: "var(--hk-gold)" }) }),
                " \u09AC\u09BF\u09B6\u09C7\u09B7 \u09A6\u09BF\u09A8")),
        React.createElement("div", { style: styles.formHint }, "\u09AF\u09C7\u0995\u09CB\u09A8\u09CB \u09A4\u09BE\u09B0\u09BF\u0996\u09C7 \u099F\u09CD\u09AF\u09BE\u09AA \u0995\u09B0\u09C7 \u09AC\u09BF\u09B6\u09C7\u09B7 \u09A6\u09BF\u09A8 \u09AF\u09CB\u0997 \u09AC\u09BE \u09A6\u09C7\u0996\u09BE \u09AF\u09BE\u09AC\u09C7\u0964")));
}
/* ---------------- debts (দেনা-পাওনা) ---------------- */
function debtRemaining(d) {
    return d.amount - d.repayments.reduce((s, r) => s + r.amount, 0);
}
function debtStatus(d) {
    const remaining = debtRemaining(d);
    if (remaining <= 0)
        return "paid";
    if (d.repayments.length > 0)
        return "partial";
    return "pending";
}
const STATUS_LABEL = { paid: "পরিশোধ সম্পন্ন", partial: "আংশিক পরিশোধ", pending: "বাকি আছে" };
const STATUS_COLOR = { paid: "var(--hk-success)", partial: "var(--hk-gold)", pending: "var(--hk-danger)" };
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
function DebtsView({ debts, onOpenDebt, onAddDebt }) {
    const [filter, setFilter] = useState("all");
    const filtered = useMemo(() => {
        let list = [...debts];
        if (filter === "receivable")
            list = list.filter((d) => d.type === "receivable");
        if (filter === "payable")
            list = list.filter((d) => d.type === "payable");
        return list.sort((a, b) => {
            const sa = debtStatus(a) === "paid" ? 1 : 0;
            const sb = debtStatus(b) === "paid" ? 1 : 0;
            if (sa !== sb)
                return sa - sb;
            return b.createdAt - a.createdAt;
        });
    }, [debts, filter]);
    const totals = useMemo(() => {
        let receivable = 0, payable = 0;
        for (const d of debts) {
            const r = debtRemaining(d);
            if (r <= 0)
                continue;
            if (d.type === "receivable")
                receivable += r;
            else
                payable += r;
        }
        return { receivable, payable };
    }, [debts]);
    return (React.createElement("div", { style: styles.pageLedger },
        React.createElement("div", { style: styles.summaryCard },
            React.createElement("div", { style: styles.summaryRow },
                React.createElement("span", null, "\u09AE\u09CB\u099F \u09AA\u09CD\u09B0\u09BE\u09AA\u09CD\u09AF \u09B9\u0995"),
                React.createElement("span", { style: { color: "var(--hk-success)", fontFamily: "'JetBrains Mono', monospace" } }, formatTaka(totals.receivable))),
            React.createElement("div", { style: styles.summaryRow },
                React.createElement("span", null, "\u09AE\u09CB\u099F \u0995\u09B0\u099C\u09C7 \u09B9\u09BE\u09B8\u09BE\u09A8\u09BE"),
                React.createElement("span", { style: { color: "var(--hk-danger)", fontFamily: "'JetBrains Mono', monospace" } }, formatTaka(totals.payable)))),
        React.createElement("div", { style: styles.rangeRow }, [
            { key: "all", label: "সব" },
            { key: "receivable", label: "পাওনা (প্রাপ্য হক)" },
            { key: "payable", label: "দেনা (করজে হাসানা)" },
        ].map((f) => (React.createElement("button", { key: f.key, onClick: () => setFilter(f.key), style: Object.assign(Object.assign({}, styles.rangeChip), (filter === f.key ? styles.rangeChipActive : {})) }, f.label)))),
        filtered.length === 0 ? (React.createElement(EmptyState, { text: "\u098F\u0996\u09A8\u09CB \u0995\u09CB\u09A8\u09CB \u09A6\u09C7\u09A8\u09BE-\u09AA\u09BE\u0993\u09A8\u09BE\u09B0 \u098F\u09A8\u09CD\u099F\u09CD\u09B0\u09BF \u09A8\u09C7\u0987\u0964 + \u09AC\u09BE\u099F\u09A8\u09C7 \u099A\u09C7\u09AA\u09C7 \u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8\u0964" })) : (React.createElement("div", { style: styles.txList }, filtered.map((d) => {
            const remaining = debtRemaining(d);
            const status = debtStatus(d);
            const dueInfo = debtDueInfo(d);
            return (React.createElement("button", { key: d.id, style: styles.debtRow, onClick: () => onOpenDebt(d) },
                React.createElement("div", { style: styles.txIcon }, d.type === "receivable" ? "🤲" : "🤝"),
                React.createElement("div", { style: styles.txMid },
                    React.createElement("div", { style: styles.txCat },
                        d.person,
                        " ",
                        React.createElement("span", { style: { color: d.type === "receivable" ? "var(--hk-success)" : "var(--hk-danger)", fontWeight: 600 } },
                            "\u00B7 ",
                            d.type === "receivable" ? "প্রাপ্য হক" : "করজে হাসানা")),
                    d.dueDate && React.createElement("div", { style: styles.txMeta },
                        "\u09AB\u09C7\u09B0\u09A4: ",
                        formatDateBn(d.dueDate).full),
                    dueInfo && (dueInfo.key === "overdue" || dueInfo.key === "today" || dueInfo.key === "soon") && (React.createElement("div", { style: Object.assign(Object.assign({}, styles.dueBadge), { color: dueInfo.color, borderColor: dueInfo.color }) }, dueInfo.label))),
                React.createElement("div", { style: { textAlign: "right" } },
                    React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: d.type === "receivable" ? "var(--hk-success)" : "var(--hk-danger)" } }, formatTaka(remaining)),
                    React.createElement("div", { style: { fontSize: 10.5, color: STATUS_COLOR[status] } }, STATUS_LABEL[status]))));
        })))));
}
function DebtForm({ initial, onClose, onSave, onDelete }) {
    const [person, setPerson] = useState((initial === null || initial === void 0 ? void 0 : initial.person) || "");
    const [type, setType] = useState((initial === null || initial === void 0 ? void 0 : initial.type) || "receivable");
    const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
    const [date, setDate] = useState((initial === null || initial === void 0 ? void 0 : initial.date) || todayStr());
    const [time, setTime] = useState((initial === null || initial === void 0 ? void 0 : initial.time) || nowTimeStr());
    const [dueDate, setDueDate] = useState((initial === null || initial === void 0 ? void 0 : initial.dueDate) || "");
    const [method, setMethod] = useState((initial === null || initial === void 0 ? void 0 : initial.method) || "cash");
    const [note, setNote] = useState((initial === null || initial === void 0 ? void 0 : initial.note) || "");
    const [err, setErr] = useState("");
    const handleSave = () => {
        if (!person.trim()) {
            setErr("নাম লিখুন");
            return;
        }
        const num = parseFloat(amount);
        if (!num || num <= 0) {
            setErr("সঠিক পরিমাণ লিখুন");
            return;
        }
        onSave({
            person: person.trim(),
            type,
            amount: num,
            date,
            time: time || null,
            dueDate: dueDate || null,
            method,
            note: note.trim(),
        });
    };
    return (React.createElement(ModalShell, { onClose: onClose, title: initial ? "দেনা-পাওনা সম্পাদনা" : "নতুন দেনা-পাওনা" },
        React.createElement("div", { style: styles.typeToggle },
            React.createElement("button", { onClick: () => setType("receivable"), style: Object.assign(Object.assign({}, styles.typeToggleBtn), (type === "receivable" ? { background: "var(--hk-success-mid)", color: "var(--hk-text-on-dark)" } : {})) }, "\u09AA\u09CD\u09B0\u09BE\u09AA\u09CD\u09AF \u09B9\u0995"),
            React.createElement("button", { onClick: () => setType("payable"), style: Object.assign(Object.assign({}, styles.typeToggleBtn), (type === "payable" ? { background: "var(--hk-danger-mid)", color: "var(--hk-text-on-dark)" } : {})) }, "\u0995\u09B0\u099C\u09C7 \u09B9\u09BE\u09B8\u09BE\u09A8\u09BE")),
        React.createElement("div", { style: styles.formLabel }, "\u09A8\u09BE\u09AE"),
        React.createElement("input", { style: styles.textInput, type: "text", placeholder: "\u09AF\u09C7\u09AE\u09A8: \u09B0\u09B9\u09BF\u09AE \u09AD\u09BE\u0987", value: person, onChange: (e) => setPerson(e.target.value) }),
        React.createElement("div", { style: styles.amountWrap },
            React.createElement("span", { style: styles.amountSign }, "\u09F3"),
            React.createElement("input", { style: styles.amountInput, type: "number", inputMode: "decimal", placeholder: "\u09E6", value: amount, onChange: (e) => setAmount(e.target.value) })),
        React.createElement("div", { style: styles.formLabel }, "\u09A4\u09BE\u09B0\u09BF\u0996 \u0993 \u09B8\u09AE\u09AF\u09BC"),
        React.createElement("div", { style: styles.filterRow },
            React.createElement("input", { style: styles.textInput, type: "date", value: date, max: todayStr(), onChange: (e) => setDate(e.target.value) }),
            React.createElement("input", { style: styles.textInput, type: "time", value: time, onChange: (e) => setTime(e.target.value) })),
        React.createElement("div", { style: styles.formLabel }, "\u09AB\u09C7\u09B0\u09A4 \u09A6\u09C7\u0993\u09AF\u09BC\u09BE\u09B0 \u09B8\u09AE\u09CD\u09AD\u09BE\u09AC\u09CD\u09AF \u09A4\u09BE\u09B0\u09BF\u0996 (\u0990\u099A\u09CD\u099B\u09BF\u0995)"),
        React.createElement("input", { style: styles.textInput, type: "date", value: dueDate, onChange: (e) => setDueDate(e.target.value) }),
        React.createElement("div", { style: styles.formLabel }, "\u09AE\u09BE\u09A7\u09CD\u09AF\u09AE"),
        React.createElement("div", { style: styles.methodRow }, DEBT_METHODS.map((mth) => (React.createElement("button", { key: mth.key, onClick: () => setMethod(mth.key), style: Object.assign(Object.assign({}, styles.methodChip), (method === mth.key ? styles.methodChipActive : {})) }, mth.label)))),
        React.createElement("div", { style: styles.formLabel }, "\u09A8\u09CB\u099F / \u0995\u09BE\u09B0\u09A3 (\u0990\u099A\u09CD\u099B\u09BF\u0995)"),
        React.createElement("input", { style: styles.textInput, type: "text", placeholder: "\u09AF\u09C7\u09AE\u09A8: \u0995\u09B0\u099C\u09C7 \u09B9\u09BE\u09B8\u09BE\u09A8\u09BE", value: note, onChange: (e) => setNote(e.target.value) }),
        err ? React.createElement("div", { style: styles.formErr }, err) : null,
        React.createElement("div", { style: styles.formActions },
            onDelete ? React.createElement("button", { style: styles.deleteBtn, onClick: onDelete }, "\u09AE\u09C1\u099B\u09C7 \u09AB\u09C7\u09B2\u09C1\u09A8") : null,
            React.createElement("button", { style: styles.saveBtn, onClick: handleSave }, "\u09B8\u0982\u09B0\u0995\u09CD\u09B7\u09A3 \u0995\u09B0\u09C1\u09A8"))));
}
function DebtDetail({ debt, onClose, onUpdate, onDelete, onAddRepayment, onDeleteRepayment, onRegisterBackHandler }) {
    const [showEdit, setShowEdit] = useState(false);
    const [showRepay, setShowRepay] = useState(false);
    const [repayAmount, setRepayAmount] = useState("");
    const [repayDate, setRepayDate] = useState(todayStr());
    const [repayTime, setRepayTime] = useState(nowTimeStr());
    const [repayNote, setRepayNote] = useState("");
    const [repayErr, setRepayErr] = useState("");
    const [showStatement, setShowStatement] = useState(false);
    // let App's hardware-back handler know: if the edit-form view has
    // replaced this detail view, a back-press should return to the detail
    // view (not close the whole debt entry)
    useEffect(() => {
        if (!onRegisterBackHandler)
            return;
        onRegisterBackHandler(() => {
            if (showEdit) {
                setShowEdit(false);
                return true;
            }
            return false;
        });
        return () => onRegisterBackHandler(null);
    }, [showEdit, onRegisterBackHandler]);
    const remaining = debtRemaining(debt);
    const status = debtStatus(debt);
    const paidTotal = debt.amount - remaining;
    const submitRepay = () => {
        const num = parseFloat(repayAmount);
        if (!num || num <= 0) {
            setRepayErr("সঠিক পরিমাণ লিখুন");
            return;
        }
        if (num > remaining) {
            setRepayErr(`অবশিষ্ট (${formatTaka(remaining)}) এর বেশি লেখা যাবে না`);
            return;
        }
        onAddRepayment({ amount: num, date: repayDate, time: repayTime || null, note: repayNote.trim() });
        setRepayAmount("");
        setRepayNote("");
        setShowRepay(false);
    };
    const statementText = useMemo(() => {
        const lines = [];
        lines.push(`${debt.person} — ${debt.type === "receivable" ? "প্রাপ্য হকের হিসাব" : "করজে হাসানার হিসাব"}`);
        lines.push(`মূল পরিমাণ: ${formatTaka(debt.amount)} (${formatDateBn(debt.date).full}${debt.time ? `, ${formatTimeBn(debt.time)}` : ""})`);
        if (debt.dueDate)
            lines.push(`ফেরতের তারিখ: ${formatDateBn(debt.dueDate).full}`);
        if (debt.note)
            lines.push(`কারণ: ${debt.note}`);
        lines.push("");
        lines.push("পরিশোধের ইতিহাস:");
        if (debt.repayments.length === 0)
            lines.push("(এখনো কোনো পরিশোধ হয়নি)");
        debt.repayments.forEach((r) => {
            lines.push(`- ${formatDateBn(r.date).full}${r.time ? `, ${formatTimeBn(r.time)}` : ""}: ${formatTaka(r.amount)}${r.note ? " — " + r.note : ""}`);
        });
        lines.push("");
        lines.push(`মোট পরিশোধ: ${formatTaka(paidTotal)}`);
        lines.push(`অবশিষ্ট: ${formatTaka(remaining)}`);
        return lines.join("\n");
    }, [debt, paidTotal, remaining]);
    const shareStatement = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: `${debt.person} — হিসাব`, text: statementText });
            }
            catch (e) {
                // user cancelled share — no action needed
            }
        }
        else {
            setShowStatement(true);
        }
    };
    if (showEdit) {
        return (React.createElement(DebtForm, { initial: debt, onClose: () => setShowEdit(false), onSave: (patch) => {
                onUpdate(patch);
                setShowEdit(false);
            }, onDelete: () => {
                onDelete();
            } }));
    }
    return (React.createElement(ModalShell, { onClose: onClose, title: debt.person },
        React.createElement("div", { style: styles.debtDetailHeader },
            React.createElement("span", { style: { color: STATUS_COLOR[status], fontWeight: 700 } }, STATUS_LABEL[status]),
            React.createElement("span", { style: { color: "var(--hk-label)" } }, debt.type === "receivable" ? "প্রাপ্য হক" : "করজে হাসানা")),
        (() => {
            const dueInfo = debtDueInfo(debt);
            return dueInfo && (dueInfo.key === "overdue" || dueInfo.key === "today" || dueInfo.key === "soon") ? (React.createElement("div", { style: Object.assign(Object.assign({}, styles.dueBadge), { color: dueInfo.color, borderColor: dueInfo.color, marginBottom: 10 }) }, dueInfo.label)) : null;
        })(),
        React.createElement("div", { style: styles.summaryCard },
            React.createElement("div", { style: styles.summaryRow },
                React.createElement("span", null, "\u09AE\u09C2\u09B2 \u09AA\u09B0\u09BF\u09AE\u09BE\u09A3"),
                React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace" } }, formatTaka(debt.amount))),
            React.createElement("div", { style: styles.summaryRow },
                React.createElement("span", null, "\u09AA\u09B0\u09BF\u09B6\u09CB\u09A7\u09BF\u09A4"),
                React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace", color: "var(--hk-success)" } }, formatTaka(paidTotal))),
            React.createElement("div", { style: styles.summaryDivider }),
            React.createElement("div", { style: styles.summaryRow },
                React.createElement("span", { style: { fontWeight: 700 } }, "\u0985\u09AC\u09B6\u09BF\u09B7\u09CD\u099F"),
                React.createElement("span", { style: { fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "var(--hk-danger)" } }, formatTaka(remaining)))),
        React.createElement("div", { style: styles.formHint },
            formatDateBn(debt.date).full,
            debt.time ? `, ${formatTimeBn(debt.time)}` : "",
            " \u09A4\u09BE\u09B0\u09BF\u0996\u09C7 ",
            methodLabel(debt.method),
            "-\u098F",
            debt.dueDate ? ` · ফেরতের সম্ভাব্য তারিখ: ${formatDateBn(debt.dueDate).full}` : "",
            debt.note ? ` · কারণ: ${debt.note}` : ""),
        React.createElement("div", { style: styles.formLabel }, "\u09AA\u09B0\u09BF\u09B6\u09CB\u09A7\u09C7\u09B0 \u0987\u09A4\u09BF\u09B9\u09BE\u09B8"),
        debt.repayments.length === 0 ? (React.createElement("div", { style: styles.taskEmpty }, "\u098F\u0996\u09A8\u09CB \u0995\u09CB\u09A8\u09CB \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7 \u09AF\u09CB\u0997 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09A8\u09BF\u0964")) : (React.createElement("div", { style: { marginBottom: 10 } }, [...debt.repayments].sort((a, b) => (a.date < b.date ? 1 : -1)).map((r) => (React.createElement("div", { key: r.id, style: styles.calSpecialEditRow },
            React.createElement("span", null,
                formatDateBn(r.date).full,
                r.time ? `, ${formatTimeBn(r.time)}` : "",
                " \u2014 ",
                formatTaka(r.amount),
                r.note ? ` (${r.note})` : ""),
            React.createElement("button", { style: styles.taskDelete, onClick: () => onDeleteRepayment(r.id) }, "\u2715")))))),
        remaining > 0 && !showRepay && (React.createElement("button", { style: styles.saveBtn, onClick: () => setShowRepay(true) }, "+ \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7 \u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8")),
        showRepay && (React.createElement("div", { style: { marginTop: 8 } },
            React.createElement("div", { style: styles.amountWrap },
                React.createElement("span", { style: styles.amountSign }, "\u09F3"),
                React.createElement("input", { style: styles.amountInput, type: "number", inputMode: "decimal", placeholder: "\u09E6", value: repayAmount, onChange: (e) => setRepayAmount(e.target.value) })),
            React.createElement("div", { style: styles.filterRow },
                React.createElement("input", { style: styles.textInput, type: "date", value: repayDate, max: todayStr(), onChange: (e) => setRepayDate(e.target.value) }),
                React.createElement("input", { style: styles.textInput, type: "time", value: repayTime, onChange: (e) => setRepayTime(e.target.value) })),
            React.createElement("input", { style: styles.textInput, type: "text", placeholder: "\u09A8\u09CB\u099F (\u0990\u099A\u09CD\u099B\u09BF\u0995)", value: repayNote, onChange: (e) => setRepayNote(e.target.value) }),
            repayErr ? React.createElement("div", { style: styles.formErr }, repayErr) : null,
            React.createElement("div", { style: styles.formActions },
                React.createElement("button", { style: styles.deleteBtn, onClick: () => setShowRepay(false) }, "\u09AC\u09BE\u09A4\u09BF\u09B2"),
                React.createElement("button", { style: styles.saveBtn, onClick: submitRepay }, "\u09B8\u0982\u09B0\u0995\u09CD\u09B7\u09A3 \u0995\u09B0\u09C1\u09A8")))),
        React.createElement("div", { style: { height: 12 } }),
        React.createElement("button", { style: styles.settingsRow, onClick: shareStatement },
            React.createElement("span", null,
                React.createElement(Icon, { name: "reports", size: 15, style: { verticalAlign: "-3px", marginRight: 5 } }),
                " \u09B8\u09CD\u099F\u09C7\u099F\u09AE\u09C7\u09A8\u09CD\u099F \u09B6\u09C7\u09AF\u09BC\u09BE\u09B0/\u09A6\u09C7\u0996\u09C1\u09A8"),
            React.createElement("span", { style: styles.settingsRowValue }, "\u203A")),
        showStatement && (React.createElement("div", null,
            React.createElement("textarea", { readOnly: true, style: styles.exportBox, value: statementText, onFocus: (e) => e.target.select() }))),
        React.createElement("div", { style: { height: 8 } }),
        React.createElement("button", { style: styles.settingsRow, onClick: () => setShowEdit(true) },
            React.createElement("span", null,
                React.createElement(Icon, { name: "edit", size: 15, style: { verticalAlign: "-3px", marginRight: 5 } }),
                " \u09A4\u09A5\u09CD\u09AF \u09B8\u09AE\u09CD\u09AA\u09BE\u09A6\u09A8\u09BE \u0995\u09B0\u09C1\u09A8"),
            React.createElement("span", { style: styles.settingsRowValue }, "\u203A")),
        React.createElement("div", { style: { height: 8 } }),
        React.createElement("button", { style: styles.dangerLink, onClick: onDelete }, "\u098F\u0987 \u098F\u09A8\u09CD\u099F\u09CD\u09B0\u09BF\u099F\u09BF \u09AE\u09C1\u099B\u09C7 \u09AB\u09C7\u09B2\u09C1\u09A8")));
}
const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];
function TransferForm({ onClose, onSave, onCheckBalance }) {
    const [fromMethod, setFromMethod] = useState("cash");
    const [toMethod, setToMethod] = useState("bank");
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState(todayStr());
    const [time, setTime] = useState(nowTimeStr());
    const [note, setNote] = useState("");
    const [err, setErr] = useState("");
    const handleSave = () => {
        const num = parseFloat(amount);
        if (!num || num <= 0) {
            setErr("সঠিক পরিমাণ লিখুন");
            return;
        }
        if (fromMethod === toMethod) {
            setErr("উৎস ও গন্তব্য মাধ্যম একই হতে পারবে না");
            return;
        }
        if (onCheckBalance && !onCheckBalance(fromMethod, num, null)) {
            setErr(`⚠️ আয় করুন — ${methodLabel(fromMethod)}-এ এত টাকা নেই`);
            return;
        }
        onSave({ fromMethod, toMethod, amount: num, date, time: time || null, note: note.trim() });
    };
    return (React.createElement(ModalShell, { onClose: onClose, title: "\u099F\u09BE\u0995\u09BE \u09B8\u09CD\u09A5\u09BE\u09A8\u09BE\u09A8\u09CD\u09A4\u09B0" },
        React.createElement("div", { style: styles.transferRow },
            React.createElement("div", { style: { flex: 1 } },
                React.createElement("div", { style: styles.formLabel }, "\u09A5\u09C7\u0995\u09C7"),
                React.createElement("select", { style: styles.methodSelect, value: fromMethod, onChange: (e) => setFromMethod(e.target.value) }, METHODS.map((m) => (React.createElement("option", { key: m.key, value: m.key }, m.label))))),
            React.createElement("div", { style: styles.transferArrow }, "\u2192"),
            React.createElement("div", { style: { flex: 1 } },
                React.createElement("div", { style: styles.formLabel }, "\u098F"),
                React.createElement("select", { style: styles.methodSelect, value: toMethod, onChange: (e) => setToMethod(e.target.value) }, METHODS.map((m) => (React.createElement("option", { key: m.key, value: m.key }, m.label)))))),
        React.createElement("div", { style: styles.amountWrap },
            React.createElement("span", { style: styles.amountSign }, "\u09F3"),
            React.createElement("input", { style: styles.amountInput, type: "number", inputMode: "decimal", placeholder: "\u09E6", value: amount, onChange: (e) => setAmount(e.target.value) })),
        React.createElement("div", { style: styles.formLabel }, "\u09A4\u09BE\u09B0\u09BF\u0996 \u0993 \u09B8\u09AE\u09AF\u09BC"),
        React.createElement("div", { style: styles.filterRow },
            React.createElement("input", { style: styles.textInput, type: "date", value: date, max: todayStr(), onChange: (e) => setDate(e.target.value) }),
            React.createElement("input", { style: styles.textInput, type: "time", value: time, onChange: (e) => setTime(e.target.value) })),
        React.createElement("div", { style: styles.formLabel }, "\u09A8\u09CB\u099F (\u0990\u099A\u09CD\u099B\u09BF\u0995)"),
        React.createElement("input", { style: styles.textInput, type: "text", placeholder: "\u09AF\u09C7\u09AE\u09A8: \u098F\u099F\u09BF\u098F\u09AE \u09A5\u09C7\u0995\u09C7 \u09A4\u09CB\u09B2\u09BE", value: note, onChange: (e) => setNote(e.target.value) }),
        err ? React.createElement("div", { style: styles.formErr }, err) : null,
        React.createElement("div", { style: styles.formActions },
            React.createElement("button", { style: styles.saveBtn, onClick: handleSave }, "\u09B8\u09CD\u09A5\u09BE\u09A8\u09BE\u09A8\u09CD\u09A4\u09B0 \u0995\u09B0\u09C1\u09A8"))));
}
function TransferHistoryModal({ transfers, onClose, onDelete }) {
    const sorted = useMemo(() => [...transfers].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date < a.date ? -1 : 1)), [transfers]);
    return (React.createElement(ModalShell, { onClose: onClose, title: "\u09B8\u09CD\u09A5\u09BE\u09A8\u09BE\u09A8\u09CD\u09A4\u09B0\u09C7\u09B0 \u0987\u09A4\u09BF\u09B9\u09BE\u09B8" }, sorted.length === 0 ? (React.createElement(EmptyState, { text: "\u098F\u0996\u09A8\u09CB \u0995\u09CB\u09A8\u09CB \u099F\u09BE\u0995\u09BE \u09B8\u09CD\u09A5\u09BE\u09A8\u09BE\u09A8\u09CD\u09A4\u09B0 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09A8\u09BF\u0964" })) : (React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, sorted.map((tr) => (React.createElement("div", { key: tr.id, style: styles.transferHistoryRow },
        React.createElement("div", { style: styles.transferMid },
            React.createElement("div", { style: styles.txCat },
                methodLabel(tr.fromMethod),
                " ",
                React.createElement("span", { style: { color: "var(--hk-label)" } }, "\u2192"),
                " ",
                methodLabel(tr.toMethod)),
            React.createElement("div", { style: styles.txMeta },
                formatDateBn(tr.date).full,
                tr.time ? `, ${formatTimeBn(tr.time)}` : "",
                tr.note ? ` · ${tr.note}` : "")),
        React.createElement("div", { style: { textAlign: "right" } },
            React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "var(--hk-text)" } }, formatTaka(tr.amount)),
            React.createElement("button", { style: styles.transferDeleteLink, onClick: () => onDelete(tr.id) }, "\u09AE\u09C1\u099B\u09C1\u09A8")))))))));
}
function TransactionForm({ initial, presetType, onClose, onSave, onDelete, onCheckBalance }) {
    const catCtx = useCategories();
    const [type, setType] = useState((initial === null || initial === void 0 ? void 0 : initial.type) || presetType || "expense");
    const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
    const [category, setCategory] = useState((initial === null || initial === void 0 ? void 0 : initial.category) || "");
    const [date, setDate] = useState((initial === null || initial === void 0 ? void 0 : initial.date) || todayStr());
    const [note, setNote] = useState((initial === null || initial === void 0 ? void 0 : initial.note) || "");
    const [method, setMethod] = useState((initial === null || initial === void 0 ? void 0 : initial.method) || "cash");
    const [err, setErr] = useState("");
    const cats = type === "income" ? catCtx.incomeCats : catCtx.expenseCats;
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
        onSave({ type, amount: num, category: category || cats[0].key, date, note: note.trim(), method });
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
        err ? React.createElement("div", { style: styles.formErr }, err) : null,
        React.createElement("div", { style: styles.formActions },
            onDelete ? (React.createElement("button", { style: styles.deleteBtn, onClick: onDelete }, "\u09AE\u09C1\u099B\u09C7 \u09AB\u09C7\u09B2\u09C1\u09A8")) : null,
            React.createElement("button", { style: styles.saveBtn, onClick: handleSave }, "\u09B8\u0982\u09B0\u0995\u09CD\u09B7\u09A3 \u0995\u09B0\u09C1\u09A8"))));
}
/* ---------------- budget modal ---------------- */
function BudgetModal({ current, categoryBudgets, onClose, onSave, onSaveCategoryBudgets }) {
    const cats = useCategories();
    const [val, setVal] = useState(current > 0 ? String(current) : "");
    const [showCatBudgets, setShowCatBudgets] = useState(false);
    const [catVals, setCatVals] = useState(() => {
        const init = {};
        cats.expenseCats.forEach((c) => {
            init[c.key] = categoryBudgets && categoryBudgets[c.key] ? String(categoryBudgets[c.key]) : "";
        });
        return init;
    });
    const catBudgetTotal = Object.values(catVals).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    const saveCatBudgets = () => {
        const map = {};
        Object.entries(catVals).forEach(([k, v]) => {
            const num = parseFloat(v);
            if (num > 0)
                map[k] = num;
        });
        onSaveCategoryBudgets(map);
    };
    return (React.createElement(ModalShell, { onClose: onClose, title: "\u09AE\u09BE\u09B8\u09BF\u0995 \u09AC\u09BE\u099C\u09C7\u099F" },
        React.createElement("div", { style: styles.amountWrap },
            React.createElement("span", { style: styles.amountSign }, "\u09F3"),
            React.createElement("input", { style: styles.amountInput, type: "number", inputMode: "decimal", placeholder: "\u09E6", value: val, onChange: (e) => setVal(e.target.value) })),
        React.createElement("div", { style: styles.formHint }, "\u09AA\u09CD\u09B0\u09A4\u09BF \u09AE\u09BE\u09B8\u09C7 \u09B8\u09B0\u09CD\u09AC\u09CB\u099A\u09CD\u099A \u0995\u09A4 \u099F\u09BE\u0995\u09BE \u0996\u09B0\u099A \u0995\u09B0\u09A4\u09C7 \u099A\u09BE\u09A8 \u09A4\u09BE \u09B2\u09BF\u0996\u09C1\u09A8 \u2014 \u098F\u099F\u09BF \u09B8\u09BE\u09AE\u0997\u09CD\u09B0\u09BF\u0995 (overall) \u09AC\u09BE\u099C\u09C7\u099F\u0964"),
        React.createElement("div", { style: styles.formActions },
            React.createElement("button", { style: styles.saveBtn, onClick: () => onSave(parseFloat(val) || 0) }, "\u09B8\u0982\u09B0\u0995\u09CD\u09B7\u09A3 \u0995\u09B0\u09C1\u09A8")),
        React.createElement("div", { style: { height: 6 } }),
        React.createElement("button", { style: styles.settingsRow, onClick: () => setShowCatBudgets((v) => !v) },
            React.createElement("span", null, "\u0996\u09BE\u09A4\u09AD\u09BF\u09A4\u09CD\u09A4\u09BF\u0995 \u09AC\u09BE\u099C\u09C7\u099F (\u0990\u099A\u09CD\u099B\u09BF\u0995)"),
            React.createElement("span", { style: styles.settingsRowValue },
                showCatBudgets ? "লুকান" : "দেখুন",
                " \u203A")),
        showCatBudgets && (React.createElement("div", null,
            React.createElement("div", { style: styles.formHint }, "\u09AA\u09CD\u09B0\u09A4\u09BF\u099F\u09BF \u0996\u09BE\u09A4\u09C7\u09B0 \u099C\u09A8\u09CD\u09AF \u0986\u09B2\u09BE\u09A6\u09BE \u09AE\u09BE\u09B8\u09BF\u0995 \u09B8\u09C0\u09AE\u09BE \u09A6\u09BF\u09A8 \u2014 \u0996\u09BE\u09B2\u09BF \u09B0\u09BE\u0996\u09B2\u09C7 \u09B8\u09C7\u0987 \u0996\u09BE\u09A4\u09C7\u09B0 \u0995\u09CB\u09A8\u09CB \u09AC\u09BE\u099C\u09C7\u099F \u09A5\u09BE\u0995\u09AC\u09C7 \u09A8\u09BE\u0964"),
            cats.expenseCats.map((c) => (React.createElement("div", { key: c.key, style: styles.catBudgetRow },
                React.createElement("span", { style: styles.catBudgetLabel },
                    React.createElement(CategoryIcon, { catKey: c.key, emoji: c.icon, size: 14 }),
                    " ",
                    c.label),
                React.createElement("input", { style: styles.catBudgetInput, type: "number", inputMode: "decimal", placeholder: "\u09F3\u09E6", value: catVals[c.key] || "", onChange: (e) => setCatVals((v) => (Object.assign(Object.assign({}, v), { [c.key]: e.target.value }))) })))),
            React.createElement("div", { style: styles.formHint },
                "\u0996\u09BE\u09A4\u0997\u09C1\u09B2\u09CB\u09B0 \u09AE\u09CB\u099F: ",
                formatTaka(catBudgetTotal)),
            React.createElement("button", { style: styles.saveBtn, onClick: saveCatBudgets }, "\u0996\u09BE\u09A4\u09AD\u09BF\u09A4\u09CD\u09A4\u09BF\u0995 \u09AC\u09BE\u099C\u09C7\u099F \u09B8\u0982\u09B0\u0995\u09CD\u09B7\u09A3 \u0995\u09B0\u09C1\u09A8")))));
}
/* ---------------- settings modal ---------------- */
function SettingsSection({ title, children }) {
    return (React.createElement("div", { style: { marginBottom: 4 } },
        React.createElement("div", { style: styles.settingsSectionTitle }, title),
        children));
}
function CategoryManager({ type, list, onAdd, onUpdate, onDelete }) {
    const [newLabel, setNewLabel] = useState("");
    const [newIcon, setNewIcon] = useState(CAT_ICON_CHOICES[0]);
    const [editKey, setEditKey] = useState(null);
    const [editLabel, setEditLabel] = useState("");
    const [editIcon, setEditIcon] = useState("");
    const startEdit = (c) => {
        setEditKey(c.key);
        setEditLabel(c.label);
        setEditIcon(c.icon);
    };
    const saveEdit = () => {
        if (!editLabel.trim())
            return;
        onUpdate(editKey, { label: editLabel.trim(), icon: editIcon || "🔧" });
        setEditKey(null);
    };
    return (React.createElement("div", null,
        list.map((c) => editKey === c.key ? (React.createElement("div", { key: c.key, style: styles.catEditRow },
            React.createElement("select", { style: styles.catIconSelect, value: editIcon, onChange: (e) => setEditIcon(e.target.value) }, CAT_ICON_CHOICES.map((ic) => React.createElement("option", { key: ic, value: ic }, ic))),
            React.createElement("input", { style: styles.catEditInput, value: editLabel, onChange: (e) => setEditLabel(e.target.value) }),
            React.createElement("button", { style: styles.taskAddBtn, onClick: saveEdit }, "\u2713"),
            React.createElement("button", { style: styles.taskDelete, onClick: () => setEditKey(null) }, "\u2715"))) : (React.createElement("div", { key: c.key, style: styles.catManageRow },
            React.createElement("span", { style: { flex: 1 } },
                React.createElement(CategoryIcon, { catKey: c.key, emoji: c.icon, size: 15 }),
                " ",
                c.label),
            React.createElement("button", { style: styles.catManageBtn, onClick: () => startEdit(c) },
                React.createElement(Icon, { name: "edit", size: 14 })),
            React.createElement("button", { style: styles.catManageBtn, onClick: () => onDelete(c.key) },
                React.createElement(Icon, { name: "delete", size: 14 }))))),
        React.createElement("div", { style: styles.catEditRow },
            React.createElement("select", { style: styles.catIconSelect, value: newIcon, onChange: (e) => setNewIcon(e.target.value) }, CAT_ICON_CHOICES.map((ic) => React.createElement("option", { key: ic, value: ic }, ic))),
            React.createElement("input", { style: styles.catEditInput, placeholder: "\u09A8\u09A4\u09C1\u09A8 \u0996\u09BE\u09A4\u09C7\u09B0 \u09A8\u09BE\u09AE", value: newLabel, onChange: (e) => setNewLabel(e.target.value), onKeyDown: (e) => {
                    if (e.key === "Enter" && newLabel.trim()) {
                        onAdd(newLabel, newIcon);
                        setNewLabel("");
                    }
                } }),
            React.createElement("button", { style: styles.taskAddBtn, onClick: () => {
                    if (!newLabel.trim())
                        return;
                    onAdd(newLabel, newIcon);
                    setNewLabel("");
                } }, "+"))));
}
function SettingsModal({ transactions, budget, specialDays, onSaveSpecialDays, onClose, onEditBudget, onClearAll, accounts, accountOpening, onSaveAccountOpening, onAddCategory, onUpdateCategory, onDeleteCategory, pin, onSavePin, onImportTransactions, theme, onSaveTheme, user, syncStatus, lastSyncedAt, onShowLogin, onLogout, onManualSync, onRestoreFromCloud, onPreviewCloudVsLocal, isOnline, pendingChanges, onExportJSON, onImportJSON, profileName, onSaveProfileName, autoSync, onSaveAutoSync, }) {
    const cats = useCategories();
    const [confirmClear, setConfirmClear] = useState(false);
    const [restorePreview, setRestorePreview] = useState(null); // null | "loading" | "error" | { local, cloud }
    const [confirmLogout, setConfirmLogout] = useState(false);
    const [showAccountSection, setShowAccountSection] = useState(false);
    const [showSecuritySection, setShowSecuritySection] = useState(false);
    const [jsonImportMsg, setJsonImportMsg] = useState("");
    const jsonFileInputRef = useRef(null);
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState("");
    const [showExport, setShowExport] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [importText, setImportText] = useState("");
    const [importMsg, setImportMsg] = useState("");
    const [showSpecial, setShowSpecial] = useState(false);
    const [showCats, setShowCats] = useState(null); // "expense" | "income" | null
    const [showAccounts, setShowAccounts] = useState(false);
    const [acctVals, setAcctVals] = useState(() => {
        const init = {};
        METHODS.forEach((m) => { init[m.key] = accountOpening && accountOpening[m.key] ? String(accountOpening[m.key]) : ""; });
        return init;
    });
    const [showPin, setShowPin] = useState(false);
    const [pinStep1, setPinStep1] = useState("");
    const [pinErr, setPinErr] = useState("");
    const [specialText, setSpecialText] = useState(() => Object.entries(specialDays || {})
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .flatMap(([d, labels]) => labels.map((label) => `${d}: ${label}`))
        .join("\n"));
    const [specialSaved, setSpecialSaved] = useState(false);
    const csv = useMemo(() => {
        const header = "তারিখ,ধরন,খাত,পরিমাণ,মাধ্যম,নোট";
        const rows = [...transactions]
            .sort((a, b) => (a.date < b.date ? -1 : 1))
            .map((t) => {
            const cat = catInfo(t.type, t.category, cats).label;
            const typeLabel = t.type === "income" ? "আয়" : "ব্যয়";
            const note = (t.note || "").replace(/,/g, " ");
            return `${t.date},${typeLabel},${cat},${t.amount},${methodLabel(t.method)},${note}`;
        });
        return [header, ...rows].join("\n");
    }, [transactions, cats]);
    const saveSpecial = () => {
        const map = {};
        specialText.split("\n").forEach((line) => {
            const idx = line.indexOf(":");
            if (idx === -1)
                return;
            const d = line.slice(0, idx).trim();
            const label = line.slice(idx + 1).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(d) && label) {
                map[d] = map[d] ? [...map[d], label] : [label];
            }
        });
        onSaveSpecialDays(map);
        setSpecialSaved(true);
        setTimeout(() => setSpecialSaved(false), 1500);
    };
    const saveAccounts = () => {
        const map = {};
        Object.entries(acctVals).forEach(([k, v]) => {
            const num = parseFloat(v);
            if (num)
                map[k] = num;
        });
        onSaveAccountOpening(map);
    };
    const runImport = () => {
        const lines = importText.trim().split("\n").filter(Boolean);
        const start = lines[0] && lines[0].includes("তারিখ") ? 1 : 0; // skip header row if present
        const typeMap = { "আয়": "income", "ব্যয়": "expense" };
        const rows = [];
        for (let i = start; i < lines.length; i++) {
            const parts = lines[i].split(",");
            if (parts.length < 4)
                continue;
            const [date, typeLabel, catLabel, amountStr, methodStr, ...noteParts] = parts;
            const amount = parseFloat(amountStr);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !amount)
                continue;
            const type = typeMap[typeLabel.trim()] || "expense";
            const catList = type === "income" ? cats.incomeCats : cats.expenseCats;
            const catMatch = catList.find((c) => c.label === catLabel.trim());
            const methodMatch = METHODS.find((m) => m.label === (methodStr || "").trim());
            rows.push({
                date,
                type,
                amount,
                category: catMatch ? catMatch.key : catList[catList.length - 1].key,
                method: methodMatch ? methodMatch.key : "cash",
                note: noteParts.join(",").trim(),
            });
        }
        if (rows.length === 0) {
            setImportMsg("কোনো বৈধ সারি পাওয়া যায়নি — এক্সপোর্ট করা CSV ফরম্যাট মেনে পেস্ট করুন।");
            return;
        }
        onImportTransactions(rows);
        setImportMsg(`${toBnDigits(rows.length)}টি এন্ট্রি যোগ হয়েছে ✓`);
        setImportText("");
    };
    const submitPin = (digits) => {
        if (pinStep1 === "") {
            setPinStep1(digits);
            setPinErr("");
        }
        else if (digits === pinStep1) {
            onSavePin(digits);
            setShowPin(false);
            setPinStep1("");
        }
        else {
            setPinErr("দুটি পিন মেলেনি, আবার চেষ্টা করুন");
            setPinStep1("");
        }
    };
    return (React.createElement(ModalShell, { onClose: onClose, title: "\u09B8\u09C7\u099F\u09BF\u0982\u09B8" },
        React.createElement(SettingsSection, { title: "\u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F" }, user ? (React.createElement(React.Fragment, null,
            React.createElement("button", { style: styles.settingsRow, onClick: () => setShowAccountSection((v) => !v) },
                React.createElement("span", null, "\u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u0993 \u09AA\u09CD\u09B0\u09CB\u09AB\u09BE\u0987\u09B2"),
                React.createElement("span", { style: styles.settingsRowValue },
                    showAccountSection ? "লুকান" : "দেখুন",
                    " \u203A")),
            showAccountSection && (React.createElement("div", { style: styles.accountCard },
                React.createElement("div", { style: styles.accountTopRow },
                    user.photoURL ? (React.createElement("img", { src: user.photoURL, alt: "", style: styles.accountAvatar })) : (React.createElement("div", { style: styles.accountAvatarFallback }, (profileName || user.displayName || user.email || "?")[0].toUpperCase())),
                    React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                        editingName ? (React.createElement("div", { style: styles.nameEditRow },
                            React.createElement("input", { style: styles.nameEditInput, value: nameDraft, onChange: (e) => setNameDraft(e.target.value), placeholder: "\u0986\u09AA\u09A8\u09BE\u09B0 \u09A8\u09BE\u09AE", autoFocus: true }),
                            React.createElement("button", { style: styles.nameEditSaveBtn, onClick: () => {
                                    onSaveProfileName(nameDraft);
                                    setEditingName(false);
                                } }, "\u2713"))) : (React.createElement("button", { style: styles.accountNameBtn, onClick: () => {
                                setNameDraft(profileName || user.displayName || "");
                                setEditingName(true);
                            } },
                            React.createElement("span", { style: styles.accountName }, profileName || user.displayName || "ব্যবহারকারী"),
                            React.createElement(Icon, { name: "edit", size: 12, style: { opacity: 0.55, flexShrink: 0 } }))),
                        React.createElement("div", { style: styles.accountEmail }, user.email))),
                React.createElement("div", { style: styles.syncStatusRow },
                    React.createElement(Icon, { name: "sync", size: 13, style: { verticalAlign: "-2px", marginRight: 4 } }),
                    !isOnline
                        ? "📴 অফলাইন — ইন্টারনেট এলে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে"
                        : syncStatus === "syncing"
                            ? "সিঙ্ক হচ্ছে…"
                            : syncStatus === "error"
                                ? "⚠ সিঙ্ক করা যায়নি"
                                : lastSyncedAt
                                    ? `শেষ সিঙ্ক: ${formatSyncTime(lastSyncedAt)}`
                                    : "এখনো সিঙ্ক হয়নি",
                    pendingChanges > 0 && React.createElement("span", { style: styles.pendingBadge },
                        toBnDigits(pendingChanges),
                        " \u09AA\u09C7\u09A8\u09CD\u09A1\u09BF\u0982")),
                React.createElement("div", { style: styles.formActions },
                    React.createElement("button", { style: styles.saveBtn, onClick: onManualSync, disabled: !isOnline }, "\u098F\u0996\u09A8\u0987 Sync \u0995\u09B0\u09C1\u09A8")),
                React.createElement("button", { style: styles.settingsRow, onClick: async () => {
                        setRestorePreview("loading");
                        try {
                            const preview = await onPreviewCloudVsLocal();
                            setRestorePreview(preview || "error");
                        }
                        catch (e) {
                            setRestorePreview("error");
                        }
                    } },
                    React.createElement("span", null, "\u0995\u09CD\u09B2\u09BE\u0989\u09A1 \u09A5\u09C7\u0995\u09C7 Restore \u0995\u09B0\u09C1\u09A8"),
                    React.createElement("span", { style: styles.settingsRowValue }, "\u203A")),
                restorePreview === "loading" && (React.createElement("div", { style: styles.formHint }, "\u09A4\u09C1\u09B2\u09A8\u09BE \u0995\u09B0\u09BE \u09B9\u099A\u09CD\u099B\u09C7\u2026")),
                restorePreview === "error" && (React.createElement("div", { style: styles.formErr }, "\u09A4\u09C1\u09B2\u09A8\u09BE \u0995\u09B0\u09BE \u09AF\u09BE\u09AF\u09BC\u09A8\u09BF \u2014 \u0987\u09A8\u09CD\u099F\u09BE\u09B0\u09A8\u09C7\u099F \u09B8\u0982\u09AF\u09CB\u0997 \u0986\u099B\u09C7 \u0995\u09BF\u09A8\u09BE \u09A6\u09C7\u0996\u09C1\u09A8")),
                restorePreview && restorePreview !== "loading" && restorePreview !== "error" && (React.createElement("div", { style: styles.confirmBox },
                    React.createElement("div", { style: { marginBottom: 8, fontWeight: 700 } }, "Local Data \u09AC\u09A8\u09BE\u09AE Cloud Data"),
                    React.createElement("div", { style: styles.restoreCompareRow },
                        React.createElement("span", null),
                        React.createElement("span", { style: styles.restoreCompareHead }, "\u09B8\u09CD\u09A5\u09BE\u09A8\u09C0\u09AF\u09BC"),
                        React.createElement("span", { style: styles.restoreCompareHead }, "\u0995\u09CD\u09B2\u09BE\u0989\u09A1")),
                    React.createElement("div", { style: styles.restoreCompareRow },
                        React.createElement("span", null, "\u09B2\u09C7\u09A8\u09A6\u09C7\u09A8"),
                        React.createElement("span", null, toBnDigits(restorePreview.local.transactions)),
                        React.createElement("span", null, restorePreview.cloud ? toBnDigits(restorePreview.cloud.transactions) : "—")),
                    React.createElement("div", { style: styles.restoreCompareRow },
                        React.createElement("span", null, "\u09A6\u09C7\u09A8\u09BE-\u09AA\u09BE\u0993\u09A8\u09BE"),
                        React.createElement("span", null, toBnDigits(restorePreview.local.debts)),
                        React.createElement("span", null, restorePreview.cloud ? toBnDigits(restorePreview.cloud.debts) : "—")),
                    React.createElement("div", { style: styles.restoreCompareRow },
                        React.createElement("span", null, "\u09B8\u09CD\u09A5\u09BE\u09A8\u09BE\u09A8\u09CD\u09A4\u09B0"),
                        React.createElement("span", null, toBnDigits(restorePreview.local.transfers)),
                        React.createElement("span", null, restorePreview.cloud ? toBnDigits(restorePreview.cloud.transfers) : "—")),
                    restorePreview.cloud && restorePreview.cloud.updatedAt && (React.createElement("div", { style: styles.formHint },
                        "\u0995\u09CD\u09B2\u09BE\u0989\u09A1\u09C7 \u09B8\u09B0\u09CD\u09AC\u09B6\u09C7\u09B7 \u0986\u09AA\u09A1\u09C7\u099F: ",
                        formatSyncTime(restorePreview.cloud.updatedAt))),
                    !restorePreview.cloud && (React.createElement("div", { style: styles.formHint }, "\u098F\u0987 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F\u09C7 \u098F\u0996\u09A8\u09CB \u0995\u09CB\u09A8\u09CB cloud data \u09A8\u09C7\u0987\u0964")),
                    pendingChanges > 0 && (React.createElement("div", { style: Object.assign(Object.assign({}, styles.formHint), { color: "var(--hk-danger)" }) },
                        "\u26A0\uFE0F \u0986\u09AA\u09A8\u09BE\u09B0 ",
                        toBnDigits(pendingChanges),
                        "\u099F\u09BF \u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8 \u098F\u0996\u09A8\u09CB cloud-\u098F \u09B8\u09BF\u0999\u09CD\u0995 \u09B9\u09AF\u09BC\u09A8\u09BF \u2014 Restore \u0995\u09B0\u09B2\u09C7 \u09B8\u09C7\u0997\u09C1\u09B2\u09CB \u09B9\u09BE\u09B0\u09BF\u09AF\u09BC\u09C7 \u09AF\u09BE\u09AC\u09C7\u0964")),
                    React.createElement("div", { style: styles.formActions },
                        React.createElement("button", { style: styles.deleteBtn, onClick: () => { onRestoreFromCloud(); setRestorePreview(null); }, disabled: !restorePreview.cloud }, "\u09B9\u09CD\u09AF\u09BE\u0981, Cloud \u09A5\u09C7\u0995\u09C7 Restore \u0995\u09B0\u09C1\u09A8"),
                        React.createElement("button", { style: styles.saveBtn, onClick: () => setRestorePreview(null) }, "\u09AC\u09BE\u09A4\u09BF\u09B2")))),
                React.createElement("div", { style: styles.securityNote },
                    React.createElement(Icon, { name: "security", size: 12, style: { verticalAlign: "-1px", marginRight: 4 } }),
                    "\u0986\u09AA\u09A8\u09BE\u09B0 \u09A1\u09C7\u099F\u09BE \u0986\u09AA\u09A8\u09BE\u09B0 Google \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F\u09C7\u09B0 \u09B8\u09BE\u09A5\u09C7 \u09A8\u09BF\u09B0\u09BE\u09AA\u09A6\u09AD\u09BE\u09AC\u09C7 \u09B8\u0982\u09AF\u09C1\u0995\u09CD\u09A4"),
                !confirmLogout ? (React.createElement("button", { style: styles.dangerLink, onClick: () => setConfirmLogout(true) }, "\u09B2\u0997\u0986\u0989\u099F \u0995\u09B0\u09C1\u09A8")) : (React.createElement("div", { style: styles.confirmBox },
                    React.createElement("div", { style: { marginBottom: 8 } }, "Log out \u0995\u09B0\u09AC\u09C7\u09A8?"),
                    React.createElement("div", { style: styles.formActions },
                        React.createElement("button", { style: styles.saveBtn, onClick: () => setConfirmLogout(false) }, "\u09AC\u09BE\u09A4\u09BF\u09B2"),
                        React.createElement("button", { style: styles.deleteBtn, onClick: () => { setConfirmLogout(false); onLogout(); } }, "Log Out")))))))) : (React.createElement("button", { style: styles.settingsRow, onClick: onShowLogin },
            React.createElement("span", null, "\u09B2\u0997\u0987\u09A8 / \u09A8\u09A4\u09C1\u09A8 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F"),
            React.createElement("span", { style: styles.settingsRowValue }, "\u203A")))),
        React.createElement(SettingsSection, { title: "\u0985\u09CD\u09AF\u09BE\u09AA\u09BF\u09AF\u09BC\u09BE\u09B0\u09C7\u09A8\u09CD\u09B8" },
            React.createElement("div", { style: styles.themeRow }, [
                { key: "light", label: "☀️ লাইট" },
                { key: "dark", label: "🌙 ডার্ক" },
                { key: "auto", label: "⚙️ অটো" },
            ].map((t) => (React.createElement("button", { key: t.key, style: Object.assign(Object.assign({}, styles.themeChip), (theme === t.key ? styles.themeChipActive : {})), onClick: () => onSaveTheme(t.key) }, t.label))))),
        React.createElement(SettingsSection, { title: "\u099F\u09BE\u0995\u09BE" },
            React.createElement("button", { style: styles.settingsRow, onClick: onEditBudget },
                React.createElement("span", null, "\u09AE\u09BE\u09B8\u09BF\u0995 \u09AC\u09BE\u099C\u09C7\u099F (\u09B8\u09BE\u09AE\u0997\u09CD\u09B0\u09BF\u0995 \u0993 \u0996\u09BE\u09A4\u09AD\u09BF\u09A4\u09CD\u09A4\u09BF\u0995)"),
                React.createElement("span", { style: styles.settingsRowValue },
                    budget > 0 ? formatTaka(budget) : "সেট করা হয়নি",
                    " \u203A")),
            React.createElement("button", { style: styles.settingsRow, onClick: () => setShowAccounts((v) => !v) },
                React.createElement("span", null, "\u0986\u09AE\u09BE\u09B0 \u09B9\u09BF\u09B8\u09BE\u09AC (Accounts / Wallets)"),
                React.createElement("span", { style: styles.settingsRowValue },
                    showAccounts ? "লুকান" : "দেখুন",
                    " \u203A")),
            showAccounts && (React.createElement("div", null,
                React.createElement("div", { style: styles.formHint }, "\u09AA\u09CD\u09B0\u09A4\u09BF\u099F\u09BF \u09AE\u09BE\u09A7\u09CD\u09AF\u09AE\u09C7 \u0986\u0997\u09C7 \u09A5\u09C7\u0995\u09C7 \u09AF\u09BE \u099B\u09BF\u09B2 (\u09AA\u09CD\u09B0\u09BE\u09B0\u09AE\u09CD\u09AD\u09BF\u0995 \u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8) \u2014 \u09A4\u09BE\u09B0\u09AA\u09B0 \u09A5\u09C7\u0995\u09C7 \u09B8\u09AC \u09B2\u09C7\u09A8\u09A6\u09C7\u09A8 \u09B9\u09BF\u09B8\u09BE\u09AC \u0995\u09B0\u09C7 \u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8 \u09A6\u09C7\u0996\u09BE\u09A8\u09CB \u09B9\u09AC\u09C7\u0964"),
                METHODS.map((m) => {
                    const acc = (accounts || []).find((a) => a.key === m.key);
                    return (React.createElement("div", { key: m.key, style: styles.catBudgetRow },
                        React.createElement("span", { style: styles.catBudgetLabel },
                            m.label,
                            acc ? ` — বর্তমান ${formatTaka(acc.balance)}` : ""),
                        React.createElement("input", { style: styles.catBudgetInput, type: "number", placeholder: "\u09F3\u09E6", value: acctVals[m.key] || "", onChange: (e) => setAcctVals((v) => (Object.assign(Object.assign({}, v), { [m.key]: e.target.value }))) })));
                }),
                React.createElement("button", { style: styles.saveBtn, onClick: saveAccounts }, "\u09AA\u09CD\u09B0\u09BE\u09B0\u09AE\u09CD\u09AD\u09BF\u0995 \u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8 \u09B8\u0982\u09B0\u0995\u09CD\u09B7\u09A3 \u0995\u09B0\u09C1\u09A8"),
                React.createElement("div", { style: { height: 10 } })))),
        React.createElement(SettingsSection, { title: "\u0996\u09BE\u09A4 \u09AC\u09CD\u09AF\u09AC\u09B8\u09CD\u09A5\u09BE\u09AA\u09A8\u09BE" },
            React.createElement("button", { style: styles.settingsRow, onClick: () => setShowCats(showCats === "expense" ? null : "expense") },
                React.createElement("span", null, "\u09AC\u09CD\u09AF\u09AF\u09BC\u09C7\u09B0 \u0996\u09BE\u09A4 \u09AA\u09B0\u09BF\u099A\u09BE\u09B2\u09A8\u09BE"),
                React.createElement("span", { style: styles.settingsRowValue },
                    showCats === "expense" ? "লুকান" : "দেখুন",
                    " \u203A")),
            showCats === "expense" && (React.createElement("div", { style: { marginBottom: 10 } },
                React.createElement(CategoryManager, { type: "expense", list: cats.expenseCats, onAdd: (label, icon) => onAddCategory("expense", label, icon), onUpdate: (key, patch) => onUpdateCategory("expense", key, patch), onDelete: (key) => onDeleteCategory("expense", key) }))),
            React.createElement("button", { style: styles.settingsRow, onClick: () => setShowCats(showCats === "income" ? null : "income") },
                React.createElement("span", null, "\u0986\u09AF\u09BC\u09C7\u09B0 \u0996\u09BE\u09A4 \u09AA\u09B0\u09BF\u099A\u09BE\u09B2\u09A8\u09BE"),
                React.createElement("span", { style: styles.settingsRowValue },
                    showCats === "income" ? "লুকান" : "দেখুন",
                    " \u203A")),
            showCats === "income" && (React.createElement("div", { style: { marginBottom: 10 } },
                React.createElement(CategoryManager, { type: "income", list: cats.incomeCats, onAdd: (label, icon) => onAddCategory("income", label, icon), onUpdate: (key, patch) => onUpdateCategory("income", key, patch), onDelete: (key) => onDeleteCategory("income", key) })))),
        React.createElement(SettingsSection, { title: "\u0995\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09A1\u09BE\u09B0" },
            React.createElement("button", { style: styles.settingsRow, onClick: () => setShowSpecial((v) => !v) },
                React.createElement("span", null, "\u0995\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09A1\u09BE\u09B0\u09C7\u09B0 \u09AC\u09BF\u09B6\u09C7\u09B7 \u09A6\u09BF\u09A8 \u09B8\u09AE\u09CD\u09AA\u09BE\u09A6\u09A8\u09BE"),
                React.createElement("span", { style: styles.settingsRowValue },
                    showSpecial ? "লুকান" : "দেখুন",
                    " \u203A")),
            showSpecial && (React.createElement("div", null,
                React.createElement("div", { style: styles.formHint }, "\u09AA\u09CD\u09B0\u09A4\u09BF \u09B2\u09BE\u0987\u09A8\u09C7 \u098F\u0995\u099F\u09BF \u0995\u09B0\u09C7 \u09B2\u09BF\u0996\u09C1\u09A8 \u2014 \u09AB\u09B0\u09AE\u09CD\u09AF\u09BE\u099F: 2026-08-14: \u09AE\u09C1\u09B9\u09BE\u09AE\u09CD\u09AE\u09A6 \u09B8\u09BE\u0983 \u098F\u09B0 \u09AA\u09CD\u09B0\u09A5\u09AE \u09B9\u09BF\u099C\u09B0\u09A4\u0964 \u098F\u09AD\u09BE\u09AC\u09C7 \u09AA\u09C1\u09B0\u09CB \u09AC\u099B\u09B0\u09C7\u09B0 \u09A4\u09BE\u09B0\u09BF\u0996 \u098F\u0995\u09B8\u09BE\u09A5\u09C7 \u09B2\u09BF\u0996\u09C7 \u09B8\u0982\u09B0\u0995\u09CD\u09B7\u09A3 \u0995\u09B0\u09A4\u09C7 \u09AA\u09BE\u09B0\u09AC\u09C7\u09A8\u0964"),
                React.createElement("textarea", { style: styles.exportBox, value: specialText, onChange: (e) => setSpecialText(e.target.value), placeholder: "2026-08-14: মুহাম্মদ সাঃ এর প্রথম হিজরত\n2026-08-21: আরেকটি বিশেষ দিন" }),
                React.createElement("button", { style: styles.saveBtn, onClick: saveSpecial }, specialSaved ? "সংরক্ষিত হয়েছে ✓" : "সংরক্ষণ করুন"),
                React.createElement("div", { style: { height: 10 } })))),
        React.createElement(SettingsSection, { title: "\u09AC\u09CD\u09AF\u09BE\u0995\u0986\u09AA" },
            React.createElement("button", { style: styles.settingsRow, onClick: () => {
                    const json = onExportJSON();
                    const blob = new Blob([json], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `hisab-khata-backup-${todayStr()}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                } },
                React.createElement("span", null,
                    React.createElement(Icon, { name: "backup", size: 14, style: { verticalAlign: "-3px", marginRight: 5 } }),
                    " \u09B8\u09AE\u09CD\u09AA\u09C2\u09B0\u09CD\u09A3 \u09AC\u09CD\u09AF\u09BE\u0995\u0986\u09AA \u09A1\u09BE\u0989\u09A8\u09B2\u09CB\u09A1 \u0995\u09B0\u09C1\u09A8 (JSON)"),
                React.createElement("span", { style: styles.settingsRowValue }, "\u203A")),
            React.createElement("button", { style: styles.settingsRow, onClick: () => jsonFileInputRef.current && jsonFileInputRef.current.click() },
                React.createElement("span", null,
                    React.createElement(Icon, { name: "sync", size: 14, style: { verticalAlign: "-3px", marginRight: 5 } }),
                    " JSON \u09AC\u09CD\u09AF\u09BE\u0995\u0986\u09AA \u09A5\u09C7\u0995\u09C7 \u09AB\u09BF\u09B0\u09BF\u09AF\u09BC\u09C7 \u0986\u09A8\u09C1\u09A8"),
                React.createElement("span", { style: styles.settingsRowValue }, "\u203A")),
            React.createElement("input", { ref: jsonFileInputRef, type: "file", accept: "application/json", style: { display: "none" }, onChange: (e) => {
                    const file = e.target.files && e.target.files[0];
                    if (!file)
                        return;
                    const reader = new FileReader();
                    reader.onload = () => {
                        const ok = onImportJSON(String(reader.result));
                        setJsonImportMsg(ok ? "ব্যাকআপ থেকে সফলভাবে ফিরিয়ে আনা হয়েছে ✓" : "এই ফাইলটা পড়া যায়নি — সঠিক ব্যাকআপ ফাইল কিনা দেখুন");
                        setTimeout(() => setJsonImportMsg(""), 4000);
                    };
                    reader.readAsText(file);
                    e.target.value = "";
                } }),
            jsonImportMsg ? React.createElement("div", { style: styles.formHint }, jsonImportMsg) : null,
            React.createElement("div", { style: { height: 6 } }),
            React.createElement("button", { style: styles.settingsRow, onClick: () => setShowExport((v) => !v) },
                React.createElement("span", null, "\u09B6\u09C1\u09A7\u09C1 \u09B2\u09C7\u09A8\u09A6\u09C7\u09A8 \u098F\u0995\u09CD\u09B8\u09AA\u09CB\u09B0\u09CD\u099F \u0995\u09B0\u09C1\u09A8 (CSV)"),
                React.createElement("span", { style: styles.settingsRowValue },
                    showExport ? "লুকান" : "দেখুন",
                    " \u203A")),
            showExport && (React.createElement("div", null,
                React.createElement("div", { style: styles.formHint }, "\u09A8\u09BF\u099A\u09C7\u09B0 \u09B2\u09C7\u0996\u09BE\u099F\u09BF \u0995\u09AA\u09BF \u0995\u09B0\u09C7 Google Sheets \u09AC\u09BE Excel-\u098F \u09AA\u09C7\u09B8\u09CD\u099F \u0995\u09B0\u09B2\u09C7 \u09AC\u09CD\u09AF\u09BE\u0995\u0986\u09AA \u09B9\u09AF\u09BC\u09C7 \u09AF\u09BE\u09AC\u09C7\u0964"),
                React.createElement("textarea", { readOnly: true, style: styles.exportBox, value: csv, onFocus: (e) => e.target.select() }))),
            React.createElement("button", { style: styles.settingsRow, onClick: () => setShowImport((v) => !v) },
                React.createElement("span", null, "Google Sheets/Excel \u09A5\u09C7\u0995\u09C7 \u09AB\u09BF\u09B0\u09BF\u09AF\u09BC\u09C7 \u0986\u09A8\u09C1\u09A8 (Restore)"),
                React.createElement("span", { style: styles.settingsRowValue },
                    showImport ? "লুকান" : "দেখুন",
                    " \u203A")),
            showImport && (React.createElement("div", null,
                React.createElement("div", { style: styles.formHint }, "\u098F\u0995\u09CD\u09B8\u09AA\u09CB\u09B0\u09CD\u099F \u0995\u09B0\u09BE CSV (\u09A4\u09BE\u09B0\u09BF\u0996,\u09A7\u09B0\u09A8,\u0996\u09BE\u09A4,\u09AA\u09B0\u09BF\u09AE\u09BE\u09A3,\u09AE\u09BE\u09A7\u09CD\u09AF\u09AE,\u09A8\u09CB\u099F \u09AB\u09B0\u09AE\u09CD\u09AF\u09BE\u099F\u09C7) \u098F\u0996\u09BE\u09A8\u09C7 \u09AA\u09C7\u09B8\u09CD\u099F \u0995\u09B0\u09C7 \u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8\u0964 \u098F\u099F\u09BE \u09B6\u09C1\u09A7\u09C1 \u09B2\u09C7\u09A8\u09A6\u09C7\u09A8 \u09AF\u09CB\u0997 \u0995\u09B0\u09C7 \u2014 \u09B8\u09AE\u09CD\u09AA\u09C2\u09B0\u09CD\u09A3 \u09AC\u09CD\u09AF\u09BE\u0995\u0986\u09AA/\u09B0\u09BF\u09B8\u09CD\u099F\u09CB\u09B0\u09C7\u09B0 \u099C\u09A8\u09CD\u09AF \u0989\u09AA\u09B0\u09C7\u09B0 JSON \u0985\u09AA\u09B6\u09A8\u099F\u09BE \u09AC\u09CD\u09AF\u09AC\u09B9\u09BE\u09B0 \u0995\u09B0\u09C1\u09A8\u0964"),
                React.createElement("textarea", { style: styles.exportBox, value: importText, onChange: (e) => setImportText(e.target.value), placeholder: "তারিখ,ধরন,খাত,পরিমাণ,মাধ্যম,নোট\n2026-08-01,ব্যয়,খাবার,150,ক্যাশ,দুপুরের খাবার" }),
                importMsg ? React.createElement("div", { style: styles.formHint }, importMsg) : null,
                React.createElement("button", { style: styles.saveBtn, onClick: runImport }, "\u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8"),
                React.createElement("div", { style: { height: 10 } })))),
        React.createElement(SettingsSection, { title: "\uD83D\uDD10 \u09A8\u09BF\u09B0\u09BE\u09AA\u09A4\u09CD\u09A4\u09BE" },
            React.createElement("button", { style: styles.settingsRow, onClick: () => setShowSecuritySection((v) => !v) },
                React.createElement("span", null, "\u09A8\u09BF\u09B0\u09BE\u09AA\u09A4\u09CD\u09A4\u09BE \u09B8\u09C7\u099F\u09BF\u0982\u09B8"),
                React.createElement("span", { style: styles.settingsRowValue },
                    showSecuritySection ? "লুকান" : "দেখুন",
                    " \u203A")),
            showSecuritySection && (React.createElement("div", null,
                React.createElement("button", { style: styles.settingsRow, onClick: () => { setShowPin((v) => !v); setPinStep1(""); setPinErr(""); } },
                    React.createElement("span", null,
                        React.createElement(Icon, { name: "security", size: 14, style: { verticalAlign: "-3px", marginRight: 5 } }),
                        " \u09AA\u09BF\u09A8 \u09B2\u0995 ",
                        pin ? "(চালু আছে)" : "(বন্ধ)"),
                    React.createElement("span", { style: styles.settingsRowValue },
                        showPin ? "লুকান" : "দেখুন",
                        " \u203A")),
                showPin && (React.createElement("div", null,
                    React.createElement("div", { style: styles.formHint }, pin
                        ? "নতুন ৪-সংখ্যার পিন দুইবার দিন — এটি আগের পিন পরিবর্তন করবে। বায়োমেট্রিক/ফিঙ্গারপ্রিন্ট লক ব্রাউজার-ভিত্তিক এই অ্যাপে নির্ভরযোগ্যভাবে দেওয়া সম্ভব হয়নি, তাই আপাতত শুধু পিন লক দেওয়া হয়েছে।"
                        : "৪-সংখ্যার একটি পিন দুইবার দিন। অ্যাপ খুললে প্রতিবার এই পিন চাওয়া হবে।"),
                    React.createElement("input", { key: pinStep1, style: styles.textInput, type: "password", inputMode: "numeric", maxLength: 4, placeholder: pinStep1 === "" ? "নতুন পিন" : "আবার লিখুন", onChange: (e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                            if (v.length === 4)
                                submitPin(v);
                        } }),
                    pinErr ? React.createElement("div", { style: styles.formErr }, pinErr) : null,
                    pin && (React.createElement("button", { style: styles.dangerLink, onClick: () => { onSavePin(null); setShowPin(false); } }, "\u09AA\u09BF\u09A8 \u09B2\u0995 \u09AC\u09A8\u09CD\u09A7 \u0995\u09B0\u09C1\u09A8")),
                    React.createElement("div", { style: { height: 10 } }))),
                React.createElement("div", { style: { height: 6 } }),
                !confirmClear ? (React.createElement("button", { style: styles.dangerLink, onClick: () => setConfirmClear(true) }, "\u09A1\u09C7\u099F\u09BE \u09AE\u09C1\u099B\u09C7 \u09AB\u09C7\u09B2\u09C1\u09A8")) : (React.createElement("div", { style: styles.confirmBox },
                    React.createElement("div", { style: { marginBottom: 8 } }, "\u09A8\u09BF\u09B6\u09CD\u099A\u09BF\u09A4? \u098F\u099F\u09BF \u09AB\u09BF\u09B0\u09BF\u09AF\u09BC\u09C7 \u0986\u09A8\u09BE \u09AF\u09BE\u09AC\u09C7 \u09A8\u09BE\u0964"),
                    React.createElement("div", { style: styles.formActions },
                        React.createElement("button", { style: styles.deleteBtn, onClick: onClearAll }, "\u09B9\u09CD\u09AF\u09BE\u0981, \u09AE\u09C1\u099B\u09C7 \u09AB\u09C7\u09B2\u09C1\u09A8"),
                        React.createElement("button", { style: styles.saveBtn, onClick: () => setConfirmClear(false) }, "\u09AC\u09BE\u09A4\u09BF\u09B2")))))))));
}
/* ---------------- modal shell ---------------- */
function ModalShell({ title, onClose, children }) {
    return (React.createElement("div", { style: styles.modalOverlay, onClick: onClose },
        React.createElement("div", { style: styles.modalSheet, onClick: (e) => e.stopPropagation() },
            React.createElement("div", { style: styles.modalHandle }),
            React.createElement("div", { style: styles.modalHeader },
                React.createElement("div", { style: styles.modalTitle }, title),
                React.createElement("button", { style: styles.modalClose, onClick: onClose }, "\u2715")),
            React.createElement("div", { style: styles.modalBody }, children))));
}
/* ---------------- styles ---------------- */
const paperBg = {
    backgroundColor: "var(--hk-bg)",
    backgroundImage: "repeating-linear-gradient(to bottom, rgba(90,60,40,0.05) 0px, rgba(90,60,40,0.05) 1px, transparent 1px, transparent 34px)",
};
const styles = {
    app: {
        minHeight: "100vh",
        maxWidth: 480,
        margin: "0 auto",
        fontFamily: "'Hind Siliguri', sans-serif",
        background: "var(--hk-bg)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
    },
    loadingScreen: {
        minHeight: "100vh",
        background: "var(--hk-header-bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
    },
    loadingSpinner: {
        width: 28,
        height: 28,
        border: "3px solid rgba(239,230,208,0.3)",
        borderTopColor: "var(--hk-gold)",
        borderRadius: "50%",
        animation: "hkspin 0.8s linear infinite",
    },
    loadingMonogram: {
        width: 56,
        height: 56,
        borderRadius: "50%",
        border: "2px solid var(--hk-gold)",
        color: "var(--hk-gold)",
        fontSize: 26,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 10,
    },
    loadingBrand: {
        fontFamily: "'Tiro Bangla', serif",
        color: "var(--hk-text-on-dark)",
        fontSize: 18,
        marginBottom: 2,
    },
    loadingTagline: {
        fontFamily: "'Hind Siliguri', sans-serif",
        color: "var(--hk-muted-on-dark2)",
        fontSize: 11.5,
        marginBottom: 22,
    },
    header: {
        background: "var(--hk-header-bg)",
        position: "relative",
        paddingBottom: 18,
        borderBottom: "3px double var(--hk-gold)",
    },
    headerPerf: {
        display: "flex",
        justifyContent: "space-evenly",
        paddingTop: 6,
    },
    perfDot: {
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: "#0E2229",
    },
    headerContent: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        padding: "10px 18px 0",
    },
    headerEyebrow: {
        fontFamily: "'Tiro Bangla', serif",
        color: "var(--hk-gold)",
        fontSize: 13,
        letterSpacing: 1,
    },
    headerBalanceLabel: {
        color: "var(--hk-muted-on-dark2)",
        fontSize: 12,
        marginTop: 8,
    },
    headerBalance: {
        fontFamily: "'JetBrains Mono', monospace",
        color: "var(--hk-text-on-dark)",
        fontSize: 30,
        fontWeight: 700,
        marginTop: 2,
    },
    iconLabelBtn: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        background: "rgba(245,239,226,0.1)",
        border: "1px solid rgba(245,239,226,0.25)",
        borderRadius: 10,
        padding: "6px 10px",
        cursor: "pointer",
        color: "var(--hk-text-on-dark)",
    },
    iconLabelIcon: {
        fontSize: 17,
    },
    iconLabelText: {
        fontSize: 9,
        color: "var(--hk-muted-on-dark)",
        letterSpacing: 0.3,
    },
    taskReminderBtn: {
        background: "none",
        border: "none",
        fontSize: 13,
        cursor: "pointer",
        padding: 0,
        flexShrink: 0,
    },
    reminderTimeTag: {
        fontSize: 10.5,
        color: "var(--hk-gold)",
        marginLeft: 22,
        marginTop: -2,
        marginBottom: 4,
        display: "flex",
        alignItems: "center",
    },
    reminderEditRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        alignItems: "center",
        marginLeft: 22,
        marginBottom: 6,
    },
    reminderTimeInput: {
        padding: "4px 5px",
        borderRadius: 6,
        border: "1px solid var(--hk-border-strong)",
        background: "var(--hk-surface-soft)",
        fontSize: 10.5,
        fontFamily: "'Hind Siliguri', sans-serif",
        minWidth: 0,
        maxWidth: 108,
    },
    reminderHint: {
        fontSize: 10,
        color: "var(--hk-border-med2)",
        marginBottom: 6,
        lineHeight: 1.4,
    },
    settingsBtn: {
        background: "rgba(245,239,226,0.1)",
        border: "1px solid rgba(245,239,226,0.25)",
        color: "var(--hk-text-on-dark)",
        width: 36,
        height: 36,
        borderRadius: "50%",
        fontSize: 16,
        cursor: "pointer",
        position: "relative",
    },
    taskBadge: {
        position: "absolute",
        bottom: -6,
        right: -6,
        background: "var(--hk-gold)",
        color: "var(--hk-text-on-dark)",
        fontSize: 9,
        padding: "1px 5px",
        borderRadius: 10,
        border: "1px solid var(--hk-header-bg)",
    },
    taskBackdrop: {
        position: "fixed",
        inset: 0,
        zIndex: 24,
    },
    taskDropdown: {
        position: "absolute",
        top: 44,
        right: 0,
        width: 268,
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderRadius: 10,
        padding: "12px 12px 10px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        zIndex: 25,
    },
    taskDropdownTitle: {
        fontSize: 11.5,
        color: "var(--hk-text-muted)",
        marginBottom: 8,
        fontWeight: 600,
    },
    taskEmpty: {
        fontSize: 12,
        color: "var(--hk-label)",
        padding: "6px 0 10px",
    },
    taskList: {
        display: "flex",
        flexDirection: "column",
        gap: 6,
        marginBottom: 8,
    },
    taskItem: {
        display: "flex",
        alignItems: "center",
        gap: 6,
    },
    taskCheck: {
        background: "none",
        border: "none",
        fontSize: 15,
        color: "var(--hk-gold)",
        cursor: "pointer",
        padding: 0,
        lineHeight: 1,
    },
    taskText: {
        flex: 1,
        fontSize: 12.5,
        lineHeight: 1.3,
        wordBreak: "break-word",
    },
    taskDelete: {
        background: "none",
        border: "none",
        color: "var(--hk-border-med)",
        fontSize: 11,
        cursor: "pointer",
        padding: 0,
    },
    taskAddRow: {
        display: "flex",
        gap: 6,
        borderTop: "1px dashed var(--hk-border-light)",
        paddingTop: 8,
    },
    taskInput: {
        flex: 1,
        padding: "6px 8px",
        borderRadius: 6,
        border: "1px solid var(--hk-border-strong)",
        background: "var(--hk-surface-soft)",
        fontSize: 12,
        fontFamily: "'Hind Siliguri', sans-serif",
        minWidth: 0,
    },
    taskAddBtn: {
        width: 26,
        height: 26,
        borderRadius: 6,
        border: "none",
        background: "var(--hk-header-bg)",
        color: "var(--hk-text-on-dark)",
        fontSize: 14,
        cursor: "pointer",
        flexShrink: 0,
    },
    main: Object.assign(Object.assign({ flex: 1 }, paperBg), { paddingBottom: 90 }),
    pageLedger: {
        padding: "16px 16px 8px",
    },
    todayStrip: {
        textAlign: "center",
        color: "var(--hk-text-muted)",
        fontSize: 12,
        marginBottom: 14,
        letterSpacing: 0.3,
    },
    todayStripSub: {
        fontSize: 11,
        color: "var(--hk-border-med2)",
        marginTop: 3,
    },
    cardRow: {
        display: "flex",
        gap: 10,
        marginBottom: 12,
    },
    statCard: {
        flex: 1,
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderLeft: "4px solid",
        borderRadius: 8,
        padding: "10px 12px",
    },
    statLabel: {
        fontSize: 11,
        color: "var(--hk-text-muted)",
    },
    statValue: {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 17,
        fontWeight: 700,
        marginTop: 4,
    },
    debtSummaryCard: {
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderRadius: 8,
        padding: "12px 14px",
        marginBottom: 12,
        cursor: "pointer",
    },
    debtSummaryRow: {
        display: "flex",
        justifyContent: "space-between",
        marginTop: 6,
    },
    budgetCard: {
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderRadius: 8,
        padding: "12px 14px",
        marginBottom: 12,
        cursor: "pointer",
    },
    budgetTop: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    budgetTitle: {
        fontWeight: 600,
        color: "var(--hk-text)",
        fontSize: 13.5,
    },
    budgetEdit: {
        fontSize: 12,
        color: "var(--hk-gold)",
    },
    budgetBarTrack: {
        height: 8,
        background: "#EDE4CC",
        borderRadius: 4,
        overflow: "hidden",
    },
    budgetBarFill: {
        height: "100%",
        borderRadius: 4,
        transition: "width 0.6s ease",
    },
    budgetFooterRow: {
        display: "flex",
        justifyContent: "space-between",
        fontSize: 12,
        color: "var(--hk-text-muted)",
        marginTop: 6,
    },
    budgetEmpty: {
        fontSize: 12.5,
        color: "var(--hk-label)",
    },
    todayCard: {
        background: "var(--hk-card)",
        border: "1px dashed var(--hk-border-med)",
        borderRadius: 8,
        padding: "10px 14px",
        marginBottom: 18,
    },
    todayCardTitle: {
        fontSize: 12,
        color: "var(--hk-text-muted)",
        marginBottom: 6,
    },
    todayCardRow: {
        display: "flex",
        justifyContent: "space-between",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 14,
        fontWeight: 600,
    },
    sectionTitle: {
        fontFamily: "'Tiro Bangla', serif",
        fontSize: 15,
        color: "var(--hk-text)",
        margin: "6px 2px 10px",
        paddingBottom: 6,
        borderBottom: "1px solid var(--hk-border-light)",
    },
    txList: {
        display: "flex",
        flexDirection: "column",
        gap: 8,
        marginBottom: 8,
    },
    txRow: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border-soft)",
        borderRadius: 8,
        padding: "9px 12px",
        cursor: "pointer",
        textAlign: "left",
    },
    debtRow: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border-soft)",
        borderRadius: 8,
        padding: "9px 12px",
        cursor: "pointer",
        textAlign: "left",
        marginBottom: 8,
    },
    debtDetailHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
        fontSize: 13,
    },
    txIcon: {
        fontSize: 20,
        width: 34,
        height: 34,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--hk-track)",
        borderRadius: 8,
        flexShrink: 0,
    },
    txMid: {
        flex: 1,
        minWidth: 0,
    },
    txCat: {
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--hk-text)",
    },
    txNote: {
        fontSize: 12,
        color: "#8A7C5E",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    txMeta: {
        fontSize: 11,
        color: "var(--hk-border-med2)",
        marginTop: 1,
    },
    txAmount: {
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 700,
        fontSize: 14,
        flexShrink: 0,
    },
    emptyState: {
        textAlign: "center",
        color: "var(--hk-label)",
        padding: "36px 20px",
        fontSize: 13.5,
        lineHeight: 1.6,
    },
    emptyIcon: {
        fontSize: 26,
        marginBottom: 8,
    },
    dayGroup: {
        marginBottom: 20,
    },
    dayHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        padding: "0 2px 8px",
        borderBottom: "1px solid var(--hk-border-light)",
        marginBottom: 8,
    },
    dayHeaderDate: {
        fontFamily: "'Tiro Bangla', serif",
        fontSize: 14,
        color: "var(--hk-text)",
    },
    dayHeaderWeekday: {
        fontSize: 11,
        color: "var(--hk-label)",
    },
    dayHeaderBalance: {
        fontSize: 11,
        color: "var(--hk-label)",
        marginTop: 2,
    },
    rangeRow: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 14,
    },
    rangeChip: {
        padding: "6px 12px",
        borderRadius: 16,
        border: "1px solid var(--hk-border-strong)",
        background: "var(--hk-card)",
        fontSize: 12.5,
        color: "var(--hk-text-muted-2)",
        cursor: "pointer",
    },
    rangeChipActive: {
        background: "var(--hk-header-bg)",
        borderColor: "var(--hk-header-bg)",
        color: "var(--hk-text-on-dark)",
    },
    monthListWrap: {
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        marginBottom: 16,
        paddingBottom: 10,
        borderBottom: "1px dashed var(--hk-border)",
    },
    monthChip: {
        padding: "5px 10px",
        borderRadius: 8,
        border: "1px solid var(--hk-border)",
        background: "var(--hk-card)",
        fontSize: 11.5,
        color: "var(--hk-text-muted)",
        cursor: "pointer",
    },
    monthChipActive: {
        background: "var(--hk-gold)",
        borderColor: "var(--hk-gold)",
        color: "var(--hk-card)",
        fontWeight: 700,
    },
    reviewBtn: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        background: "var(--hk-header-bg)",
        border: "none",
        borderRadius: 10,
        padding: "11px 14px",
        color: "var(--hk-text-on-dark)",
        fontSize: 13,
        fontFamily: "'Hind Siliguri', sans-serif",
        cursor: "pointer",
        marginBottom: 14,
    },
    reviewStatBlock: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        borderBottom: "1px solid var(--hk-track)",
        padding: "8px 0",
    },
    reviewStatLabel: {
        fontSize: 12.5,
        color: "var(--hk-text-muted)",
    },
    reviewStatVal: {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 18,
        fontWeight: 700,
    },
    reviewHighlight: {
        fontSize: 12.5,
        color: "var(--hk-text)",
        background: "var(--hk-surface-soft)",
        borderRadius: 8,
        padding: "9px 12px",
        marginTop: 10,
        lineHeight: 1.5,
    },
    reviewAchievement: {
        fontSize: 13,
        fontWeight: 700,
        color: "var(--hk-gold)",
        background: "var(--hk-card)",
        border: "1px solid #E8C547",
        borderRadius: 8,
        padding: "10px 12px",
        marginTop: 10,
        textAlign: "center",
    },
    comboLegendRow: {
        display: "flex",
        gap: 14,
        marginBottom: 8,
        flexWrap: "wrap",
    },
    comboLegendItem: {
        display: "flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        color: "var(--hk-text-muted-2)",
    },
    comboLegendDot: {
        width: 10,
        height: 10,
        borderRadius: "50%",
        display: "inline-block",
    },
    comboTooltip: {
        marginTop: 8,
        fontSize: 11,
        color: "var(--hk-text-muted)",
        background: "var(--hk-surface-soft)",
        borderRadius: 8,
        padding: "6px 10px",
        textAlign: "center",
    },
    summaryCard: {
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderRadius: 8,
        padding: "14px 16px",
        marginBottom: 18,
    },
    summaryRow: {
        display: "flex",
        justifyContent: "space-between",
        padding: "4px 0",
        fontSize: 14,
    },
    summaryDivider: {
        borderTop: "1px dashed var(--hk-border-strong)",
        margin: "6px 0",
    },
    savingRateRow: {
        marginTop: 8,
        fontSize: 12.5,
        color: "var(--hk-text-muted)",
        textAlign: "right",
    },
    catList: {
        display: "flex",
        flexDirection: "column",
        gap: 12,
    },
    catRow: {},
    catRowTop: {
        display: "flex",
        justifyContent: "space-between",
        fontSize: 13,
        marginBottom: 4,
        color: "var(--hk-text)",
    },
    catBarTrack: {
        height: 6,
        background: "#EDE4CC",
        borderRadius: 3,
        overflow: "hidden",
    },
    catBarFill: {
        height: "100%",
        background: "var(--hk-gold)",
        borderRadius: 3,
        transition: "width 0.6s ease",
    },
    searchInput: {
        width: "100%",
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid var(--hk-border-strong)",
        background: "var(--hk-card)",
        fontSize: 14,
        marginBottom: 10,
        boxSizing: "border-box",
        fontFamily: "'Hind Siliguri', sans-serif",
    },
    quickFilterRow: {
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        marginBottom: 10,
    },
    quickFilterChip: {
        padding: "5px 11px",
        borderRadius: 14,
        border: "1px solid var(--hk-border-strong)",
        background: "var(--hk-card)",
        fontSize: 11.5,
        color: "var(--hk-text-muted-2)",
        cursor: "pointer",
    },
    quickFilterChipActive: {
        background: "var(--hk-header-bg)",
        borderColor: "var(--hk-header-bg)",
        color: "var(--hk-text-on-dark)",
    },
    filterRow: {
        display: "flex",
        gap: 8,
        marginBottom: 10,
    },
    filterSelect: {
        flex: 1,
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px solid var(--hk-border-strong)",
        background: "var(--hk-card)",
        fontSize: 13,
        fontFamily: "'Hind Siliguri', sans-serif",
    },
    resultCount: {
        fontSize: 12,
        color: "var(--hk-label)",
        marginBottom: 10,
    },
    fab: {
        position: "fixed",
        bottom: 74,
        left: "50%",
        transform: "translateX(-50%)",
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "var(--hk-gold)",
        color: "var(--hk-card)",
        fontSize: 28,
        lineHeight: "56px",
        textAlign: "center",
        border: "3px solid var(--hk-bg)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        cursor: "pointer",
        zIndex: 20,
    },
    bottomNav: {
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 480,
        background: "var(--hk-card)",
        borderTop: "1px solid var(--hk-border)",
        display: "flex",
        zIndex: 15,
    },
    navBtn: {
        flex: 1,
        background: "none",
        border: "none",
        padding: "8px 0 10px",
        cursor: "pointer",
    },
    calCard: {
        border: "1px solid var(--hk-border-strong)",
        borderRadius: 12,
        padding: 10,
        background: "var(--hk-card)",
        marginBottom: 14,
    },
    calNavRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    calNavBtn: {
        width: 30,
        height: 30,
        borderRadius: "50%",
        border: "1px solid var(--hk-border-strong)",
        background: "var(--hk-surface-soft)",
        fontSize: 16,
        color: "var(--hk-text-muted-2)",
        cursor: "pointer",
        flexShrink: 0,
    },
    calMonthTitle: {
        fontFamily: "'Tiro Bangla', serif",
        fontSize: 17,
        color: "#1E5C7A",
        fontWeight: 700,
    },
    calSubTitle: {
        fontSize: 10,
        color: "#1E5C7A",
        marginTop: 1,
    },
    calWeekRow: {
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        marginBottom: 6,
        gap: 2,
    },
    calWeekCell: {
        textAlign: "center",
        fontSize: 10.5,
        fontWeight: 700,
        padding: "5px 0",
        color: "var(--hk-card)",
        borderRadius: 5,
    },
    calGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        rowGap: 8,
        marginBottom: 2,
    },
    calCell: {
        textAlign: "center",
        position: "relative",
        background: "none",
        border: "none",
        padding: "2px 0",
        cursor: "pointer",
    },
    calDateCircle: {
        width: 28,
        height: 28,
        lineHeight: "28px",
        borderRadius: "50%",
        margin: "0 auto",
        fontSize: 12.5,
        fontFamily: "'JetBrains Mono', monospace",
    },
    calSubDates: {
        fontSize: 8.5,
        color: "#8FA89A",
        marginTop: 1,
    },
    calSpecialDot: {
        position: "absolute",
        top: -1,
        right: "18%",
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: "var(--hk-gold)",
    },
    calLegend: {
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        fontSize: 10.5,
        color: "var(--hk-text-muted-2)",
        marginBottom: 8,
        paddingBottom: 12,
        borderBottom: "1px solid var(--hk-border-light)",
    },
    legendDot: {
        display: "inline-block",
        width: 9,
        height: 9,
        borderRadius: "50%",
        marginRight: 4,
        verticalAlign: "middle",
    },
    calBackBtn: {
        background: "none",
        border: "none",
        color: "var(--hk-gold)",
        fontSize: 13,
        cursor: "pointer",
        padding: 0,
        marginBottom: 12,
    },
    calDayDetailCard: {
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderRadius: 8,
        padding: "12px 14px",
        marginBottom: 16,
    },
    calDayDetailDate: {
        fontFamily: "'Tiro Bangla', serif",
        fontSize: 15,
        color: "var(--hk-text)",
    },
    calDayDetailSub: {
        fontSize: 11,
        color: "var(--hk-label)",
        marginTop: 4,
    },
    calSpecialEditRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 13,
        padding: "8px 10px",
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderRadius: 6,
        marginBottom: 6,
    },
    modalOverlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(22,50,59,0.5)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 30,
    },
    modalSheet: {
        width: "100%",
        maxWidth: 480,
        maxHeight: "88vh",
        overflowY: "auto",
        background: "var(--hk-surface-soft)",
        borderRadius: "16px 16px 0 0",
        padding: "10px 20px 26px",
        boxSizing: "border-box",
    },
    modalHandle: {
        width: 40,
        height: 4,
        background: "var(--hk-border-strong)",
        borderRadius: 2,
        margin: "4px auto 12px",
    },
    modalHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
    },
    modalTitle: {
        fontFamily: "'Tiro Bangla', serif",
        fontSize: 17,
        color: "var(--hk-text)",
    },
    modalClose: {
        background: "none",
        border: "none",
        fontSize: 16,
        color: "var(--hk-label)",
        cursor: "pointer",
    },
    modalBody: {
        display: "flex",
        flexDirection: "column",
    },
    typeToggle: {
        display: "flex",
        gap: 8,
        marginBottom: 16,
    },
    typeToggleBtn: {
        flex: 1,
        padding: "10px 0",
        borderRadius: 8,
        border: "1px solid var(--hk-border-strong)",
        background: "var(--hk-card)",
        color: "var(--hk-text-muted-2)",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
    },
    amountWrap: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border-strong)",
        borderRadius: 10,
        padding: "10px 14px",
        marginBottom: 16,
    },
    amountSign: {
        fontSize: 24,
        color: "var(--hk-gold)",
        marginRight: 6,
        fontFamily: "'JetBrains Mono', monospace",
    },
    amountInput: {
        border: "none",
        outline: "none",
        background: "transparent",
        fontSize: 28,
        fontFamily: "'JetBrains Mono', monospace",
        width: "100%",
        textAlign: "center",
        color: "var(--hk-text)",
    },
    formLabel: {
        fontSize: 12.5,
        color: "var(--hk-text-muted)",
        marginBottom: 6,
        marginTop: 4,
    },
    catGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 8,
        marginBottom: 14,
    },
    catChip: {
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderRadius: 8,
        padding: "8px 4px",
        textAlign: "center",
        cursor: "pointer",
        color: "var(--hk-text-muted-2)",
    },
    catChipActive: {
        borderColor: "var(--hk-gold)",
        background: "#F3E6C6",
    },
    textInput: {
        width: "100%",
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid var(--hk-border-strong)",
        background: "var(--hk-card)",
        fontSize: 14,
        marginBottom: 14,
        boxSizing: "border-box",
        fontFamily: "'Hind Siliguri', sans-serif",
    },
    methodRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 14,
    },
    methodChip: {
        padding: "7px 12px",
        borderRadius: 16,
        border: "1px solid var(--hk-border-strong)",
        background: "var(--hk-card)",
        fontSize: 12.5,
        color: "var(--hk-text-muted-2)",
        cursor: "pointer",
    },
    methodChipActive: {
        background: "var(--hk-header-bg)",
        borderColor: "var(--hk-header-bg)",
        color: "var(--hk-text-on-dark)",
    },
    transferRow: {
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        marginBottom: 14,
    },
    transferArrow: {
        fontSize: 18,
        color: "var(--hk-label)",
        paddingBottom: 10,
    },
    methodSelect: {
        width: "100%",
        padding: "10px 8px",
        borderRadius: 8,
        border: "1px solid var(--hk-border-strong)",
        background: "var(--hk-card)",
        fontSize: 13,
        color: "var(--hk-text)",
        fontFamily: "'Hind Siliguri', sans-serif",
    },
    transferHistoryRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderRadius: 10,
        padding: "10px 12px",
    },
    transferMid: {
        flex: 1,
    },
    transferDeleteLink: {
        background: "none",
        border: "none",
        color: "var(--hk-danger)",
        fontSize: 10.5,
        textDecoration: "underline",
        cursor: "pointer",
        padding: 0,
        marginTop: 3,
    },
    formErr: {
        color: "var(--hk-danger)",
        fontSize: 12.5,
        marginBottom: 10,
    },
    formHint: {
        fontSize: 12,
        color: "var(--hk-label)",
        marginBottom: 10,
        lineHeight: 1.5,
    },
    formActions: {
        display: "flex",
        gap: 10,
        marginTop: 4,
    },
    saveBtn: {
        flex: 1,
        padding: "12px 0",
        borderRadius: 8,
        border: "none",
        background: "var(--hk-header-bg)",
        color: "var(--hk-text-on-dark)",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
    },
    deleteBtn: {
        flex: 1,
        padding: "12px 0",
        borderRadius: 8,
        border: "1px solid var(--hk-danger-mid)",
        background: "transparent",
        color: "var(--hk-danger)",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
    },
    settingsRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderRadius: 8,
        padding: "12px 14px",
        marginBottom: 10,
        cursor: "pointer",
        fontSize: 13.5,
        color: "var(--hk-text)",
    },
    settingsRowValue: {
        color: "var(--hk-label)",
        fontSize: 12.5,
    },
    exportBox: {
        width: "100%",
        height: 140,
        boxSizing: "border-box",
        padding: 10,
        borderRadius: 8,
        border: "1px solid var(--hk-border-strong)",
        background: "var(--hk-card)",
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
        marginBottom: 14,
        resize: "none",
    },
    dangerLink: {
        background: "none",
        border: "none",
        color: "var(--hk-danger)",
        fontSize: 13,
        textDecoration: "underline",
        cursor: "pointer",
        padding: 0,
    },
    confirmBox: {
        background: "#FBEAE4",
        border: "1px solid var(--hk-danger-soft)",
        borderRadius: 8,
        padding: 12,
        fontSize: 13,
        color: "var(--hk-text-muted-2)",
    },
    restoreCompareRow: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 6,
        fontSize: 12.5,
        padding: "4px 0",
        borderBottom: "1px solid var(--hk-border)",
    },
    restoreCompareHead: {
        fontWeight: 700,
        color: "var(--hk-text-muted)",
        fontSize: 11,
    },
    saveErrBanner: {
        position: "fixed",
        top: 10,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--hk-danger)",
        color: "var(--hk-text-on-dark)",
        padding: "6px 14px",
        borderRadius: 20,
        fontSize: 12,
        zIndex: 40,
    },
    reminderBanner: {
        position: "fixed",
        top: 10,
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 32px)",
        maxWidth: 448,
        background: "var(--hk-header-bg)",
        color: "var(--hk-text-on-dark)",
        padding: "12px 14px",
        borderRadius: 12,
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: 8,
        zIndex: 50,
        boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
        border: "1px solid var(--hk-gold)",
        cursor: "pointer",
    },
    reminderBannerClose: {
        fontSize: 13,
        color: "var(--hk-muted-on-dark)",
    },
    reminderClearBtn: {
        background: "none",
        border: "none",
        color: "var(--hk-danger)",
        fontSize: 10.5,
        textDecoration: "underline",
        cursor: "pointer",
        marginLeft: 8,
        padding: 0,
    },
    /* ---- premium dashboard additions ---- */
    healthCard: {
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 12,
        boxShadow: "0 2px 6px rgba(58,52,42,0.06)",
    },
    healthTop: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginBottom: 8,
    },
    healthScoreVal: {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 26,
        fontWeight: 700,
        marginTop: 2,
    },
    healthBadge: {
        color: "var(--hk-text-on-dark)",
        fontSize: 11.5,
        fontWeight: 600,
        padding: "4px 10px",
        borderRadius: 20,
    },
    healthCardSmall: {
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderRadius: 10,
        padding: "8px 12px",
        marginBottom: 10,
        boxShadow: "0 1px 4px rgba(58,52,42,0.05)",
    },
    healthTopSmall: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 5,
    },
    healthScoreValSmall: {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 14,
        fontWeight: 700,
        marginLeft: "auto",
    },
    healthBadgeSmall: {
        color: "var(--hk-text-on-dark)",
        fontSize: 10,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 20,
    },
    budgetBarTrackThin: {
        height: 4,
        background: "var(--hk-track)",
        borderRadius: 3,
        overflow: "hidden",
    },
    balanceCardSmall: {
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderRadius: 10,
        padding: "9px 12px",
        marginBottom: 12,
        boxShadow: "0 1px 4px rgba(58,52,42,0.05)",
    },
    balanceCardTopRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    },
    heroCard: {
        background: "var(--hk-header-bg)",
        borderRadius: 14,
        padding: "16px 18px",
        marginBottom: 12,
        boxShadow: "0 3px 10px rgba(22,50,59,0.25)",
    },
    heroLabel: {
        fontSize: 11.5,
        color: "var(--hk-muted-on-dark2)",
        marginBottom: 4,
    },
    heroValue: {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 30,
        fontWeight: 700,
        marginBottom: 10,
    },
    heroPillRow: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        marginBottom: 8,
    },
    heroPill: {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        fontWeight: 600,
        background: "rgba(245,239,226,0.08)",
        border: "1px solid rgba(245,239,226,0.18)",
        borderRadius: 20,
        padding: "4px 10px",
    },
    heroDelta: {
        fontSize: 11,
        color: "var(--hk-muted-on-dark)",
    },
    pulseCard: {
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 12,
        boxShadow: "0 1px 4px rgba(58,52,42,0.05)",
    },
    pulseTitle: {
        fontSize: 11.5,
        color: "var(--hk-label)",
        marginBottom: 8,
    },
    insightsStack: {
        display: "flex",
        flexDirection: "column",
        gap: 6,
        marginBottom: 12,
    },
    insightCard: {
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderRadius: 10,
        padding: "9px 12px",
        animation: "hkfadein 0.3s ease",
    },
    insightIcon: {
        fontSize: 16,
        lineHeight: 1,
        marginTop: 1,
    },
    insightTitle: {
        fontSize: 11,
        fontWeight: 700,
        color: "var(--hk-text-muted)",
        marginBottom: 1,
    },
    insightText: {
        fontSize: 12,
        color: "var(--hk-text)",
        lineHeight: 1.4,
    },
    healthIndicatorRow: {
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        marginTop: 8,
    },
    healthIndicatorChip: {
        fontSize: 10.5,
        background: "var(--hk-surface-soft)",
        borderRadius: 20,
        padding: "3px 9px",
        color: "var(--hk-text-muted-2)",
    },
    onboardCard: {
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderRadius: 14,
        padding: "22px 18px",
        textAlign: "center",
    },
    onboardTitle: {
        fontFamily: "'Tiro Bangla', serif",
        fontSize: 19,
        color: "var(--hk-text)",
        marginBottom: 4,
    },
    onboardSub: {
        fontSize: 12.5,
        color: "var(--hk-text-muted)",
        marginBottom: 18,
    },
    onboardBtn: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        background: "var(--hk-surface-soft)",
        border: "1px solid var(--hk-border)",
        borderRadius: 10,
        padding: "12px 16px",
        fontSize: 13,
        fontFamily: "'Hind Siliguri', sans-serif",
        color: "var(--hk-text)",
        cursor: "pointer",
        marginBottom: 10,
    },
    walletSectionHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    walletHeaderActions: {
        display: "flex",
        gap: 12,
    },
    walletActionLink: {
        background: "none",
        border: "none",
        color: "var(--hk-success-mid)",
        fontSize: 11.5,
        fontWeight: 600,
        cursor: "pointer",
        padding: 0,
    },
    walletGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
        marginBottom: 12,
    },
    walletTile: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderLeft: "3px solid",
        borderRadius: 10,
        padding: "8px 10px",
    },
    walletTileIcon: {
        fontSize: 18,
    },
    walletTileLabel: {
        fontSize: 10.5,
        color: "var(--hk-label)",
    },
    walletTileVal: {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13,
        fontWeight: 700,
    },
    savingsCard: {
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderRadius: 12,
        padding: "10px 14px",
        marginBottom: 12,
    },
    savingsRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "5px 0",
        fontSize: 12.5,
    },
    alertStack: {
        display: "flex",
        flexDirection: "column",
        gap: 6,
        marginBottom: 12,
    },
    alertCard: {
        background: "var(--hk-card)",
        border: "1px solid",
        borderLeftWidth: 4,
        borderRadius: 8,
        padding: "9px 12px",
        fontSize: 12.5,
        textAlign: "left",
        cursor: "pointer",
    },
    topCatCard: {
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 12,
    },
    topCatRow: {
        display: "flex",
        justifyContent: "space-between",
        padding: "6px 0",
        fontSize: 12.5,
        borderTop: "1px solid var(--hk-text-on-dark-soft)",
    },
    dueBadge: {
        display: "inline-block",
        marginTop: 4,
        fontSize: 10,
        fontWeight: 600,
        border: "1px solid",
        borderRadius: 10,
        padding: "1px 7px",
    },
    /* ---- charts ---- */
    chartCard: {
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 14,
    },
    donutWrap: {
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
        justifyContent: "center",
    },
    donutLegend: {
        display: "flex",
        flexDirection: "column",
        gap: 4,
        flex: 1,
        minWidth: 130,
    },
    donutLegendRow: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11.5,
        color: "var(--hk-text-muted-2)",
    },
    donutDot: {
        width: 9,
        height: 9,
        borderRadius: "50%",
        flexShrink: 0,
    },
    ieBarWrap: {
        display: "flex",
        flexDirection: "column",
        gap: 10,
    },
    ieBarRow: {
        display: "flex",
        alignItems: "center",
        gap: 8,
    },
    ieBarLabel: {
        width: 32,
        fontSize: 12,
        color: "var(--hk-text-muted-2)",
    },
    ieBarTrack: {
        flex: 1,
        height: 14,
        background: "var(--hk-text-on-dark-soft)",
        borderRadius: 7,
        overflow: "hidden",
    },
    ieBarFill: {
        height: "100%",
        borderRadius: 7,
        transition: "width 0.4s ease",
    },
    ieBarVal: {
        width: 84,
        textAlign: "right",
        fontSize: 11.5,
        fontFamily: "'JetBrains Mono', monospace",
        color: "var(--hk-text)",
    },
    /* ---- quick add ---- */
    quickAmountRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        marginBottom: 14,
        marginTop: -8,
    },
    quickAmountChip: {
        padding: "5px 10px",
        borderRadius: 14,
        border: "1px solid var(--hk-border-strong)",
        background: "var(--hk-card)",
        fontSize: 11.5,
        color: "var(--hk-text-muted-2)",
        cursor: "pointer",
    },
    quickAmountClear: {
        padding: "5px 10px",
        borderRadius: 14,
        border: "1px solid var(--hk-danger-soft)",
        background: "transparent",
        fontSize: 11.5,
        color: "var(--hk-danger)",
        cursor: "pointer",
    },
    /* ---- advanced search ---- */
    advToggle: {
        background: "none",
        border: "none",
        color: "var(--hk-text-muted)",
        fontSize: 12,
        textDecoration: "underline",
        cursor: "pointer",
        padding: 0,
        marginBottom: 10,
        textAlign: "left",
    },
    advPanel: {
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 10,
    },
    /* ---- undo toast ---- */
    undoBanner: {
        position: "fixed",
        bottom: 74,
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 32px)",
        maxWidth: 448,
        background: "var(--hk-text)",
        color: "var(--hk-text-on-dark)",
        padding: "10px 14px",
        borderRadius: 10,
        fontSize: 12.5,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        zIndex: 45,
        boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
        animation: "hkfadein 0.25s ease",
    },
    undoBtn: {
        background: "none",
        border: "1px solid var(--hk-gold)",
        color: "#E8C978",
        fontSize: 11.5,
        fontWeight: 600,
        borderRadius: 6,
        padding: "4px 10px",
        cursor: "pointer",
        flexShrink: 0,
    },
    /* ---- pin lock screen ---- */
    lockScreen: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--hk-header-bg)",
        color: "var(--hk-text-on-dark)",
        padding: 24,
        boxSizing: "border-box",
    },
    lockTitle: {
        fontFamily: "'Tiro Bangla', serif",
        fontSize: 17,
        marginBottom: 6,
    },
    lockSub: {
        fontSize: 12.5,
        color: "var(--hk-muted-on-dark)",
        marginBottom: 18,
    },
    lockDotsRow: {
        display: "flex",
        gap: 14,
        marginBottom: 30,
    },
    lockDot: {
        width: 14,
        height: 14,
        borderRadius: "50%",
        border: "1.5px solid var(--hk-gold)",
    },
    lockPad: {
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 14,
        width: "100%",
        maxWidth: 260,
    },
    lockKey: {
        background: "rgba(245,239,226,0.08)",
        border: "1px solid rgba(245,239,226,0.2)",
        borderRadius: "50%",
        color: "var(--hk-text-on-dark)",
        fontSize: 18,
        fontFamily: "'JetBrains Mono', monospace",
        aspectRatio: "1",
        cursor: "pointer",
    },
    /* ---- settings sections / category & account managers ---- */
    settingsSectionTitle: {
        fontFamily: "'Tiro Bangla', serif",
        fontSize: 13,
        color: "var(--hk-label)",
        margin: "14px 0 6px",
        letterSpacing: 0.3,
    },
    themeRow: {
        display: "flex",
        gap: 8,
    },
    themeChip: {
        flex: 1,
        padding: "10px 8px",
        borderRadius: 10,
        border: "1px solid var(--hk-border)",
        background: "var(--hk-card)",
        fontSize: 12.5,
        color: "var(--hk-text-muted)",
        cursor: "pointer",
        fontFamily: "'Hind Siliguri', sans-serif",
    },
    themeChipActive: {
        background: "var(--hk-header-bg)",
        borderColor: "var(--hk-header-bg)",
        color: "var(--hk-text-on-dark)",
        fontWeight: 700,
    },
    accountCard: {
        background: "var(--hk-card)",
        border: "1px solid var(--hk-border)",
        borderRadius: 12,
        padding: "12px 14px",
    },
    accountTopRow: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 10,
    },
    accountAvatar: {
        width: 40,
        height: 40,
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0,
    },
    accountAvatarFallback: {
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: "var(--hk-header-bg)",
        color: "var(--hk-text-on-dark)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 16,
        fontWeight: 700,
        flexShrink: 0,
    },
    accountName: {
        fontSize: 14,
        fontWeight: 700,
        color: "var(--hk-text)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    accountEmail: {
        fontSize: 11.5,
        color: "var(--hk-text-muted)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    syncStatusRow: {
        fontSize: 11.5,
        color: "var(--hk-text-muted)",
        marginBottom: 10,
    },
    pendingBadge: {
        display: "inline-block",
        marginLeft: 8,
        fontSize: 10,
        fontWeight: 700,
        background: "var(--hk-gold)",
        color: "var(--hk-card)",
        borderRadius: 20,
        padding: "1px 8px",
    },
    accountNameBtn: {
        display: "flex",
        alignItems: "center",
        gap: 5,
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        maxWidth: "100%",
    },
    nameEditRow: {
        display: "flex",
        alignItems: "center",
        gap: 6,
    },
    nameEditInput: {
        flex: 1,
        minWidth: 0,
        padding: "5px 8px",
        borderRadius: 6,
        border: "1px solid var(--hk-border-strong)",
        background: "var(--hk-card)",
        color: "var(--hk-text)",
        fontSize: 13,
        fontFamily: "'Hind Siliguri', sans-serif",
    },
    nameEditSaveBtn: {
        background: "var(--hk-header-bg)",
        color: "var(--hk-text-on-dark)",
        border: "none",
        borderRadius: 6,
        width: 26,
        height: 26,
        flexShrink: 0,
        cursor: "pointer",
        fontSize: 13,
    },
    autoSyncRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 0",
        borderTop: "1px solid var(--hk-border)",
        borderBottom: "1px solid var(--hk-border)",
        marginBottom: 10,
    },
    autoSyncLabel: {
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--hk-text)",
    },
    autoSyncHint: {
        fontSize: 10.5,
        color: "var(--hk-text-muted)",
        marginTop: 1,
        maxWidth: 220,
    },
    toggleSwitch: {
        width: 40,
        height: 22,
        borderRadius: 11,
        border: "none",
        background: "var(--hk-border-strong)",
        position: "relative",
        cursor: "pointer",
        flexShrink: 0,
        padding: 0,
    },
    toggleSwitchOn: {
        background: "var(--hk-success-mid)",
    },
    toggleKnob: {
        position: "absolute",
        top: 2,
        left: 2,
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: "var(--hk-card)",
        transition: "left 0.15s ease",
    },
    toggleKnobOn: {
        left: 20,
    },
    securityNote: {
        fontSize: 10.5,
        color: "var(--hk-text-muted)",
        marginBottom: 10,
        lineHeight: 1.4,
    },
    loginTagline: {
        fontSize: 12.5,
        color: "var(--hk-text-muted)",
        textAlign: "center",
        marginBottom: 16,
    },
    googleBtn: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: "100%",
        padding: "12px 16px",
        borderRadius: 10,
        border: "1px solid var(--hk-border-strong)",
        background: "var(--hk-card)",
        color: "var(--hk-text)",
        fontSize: 13.5,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "'Hind Siliguri', sans-serif",
    },
    googleG: {
        fontFamily: "sans-serif",
        fontWeight: 700,
        fontSize: 15,
        background: "linear-gradient(135deg, #4285F4, #EA4335 35%, #FBBC05 65%, #34A853)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
    },
    loginDivider: {
        display: "flex",
        alignItems: "center",
        textAlign: "center",
        color: "var(--hk-label)",
        fontSize: 11.5,
        margin: "16px 0",
    },
    loginLinksRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        justifyContent: "center",
        marginTop: 12,
    },
    loginLink: {
        background: "none",
        border: "none",
        color: "var(--hk-success-mid)",
        fontSize: 11.5,
        cursor: "pointer",
        padding: 0,
    },
    catEditRow: {
        display: "flex",
        gap: 6,
        alignItems: "center",
        marginBottom: 6,
    },
    catIconSelect: {
        width: 52,
        padding: "6px 2px",
        borderRadius: 8,
        border: "1px solid var(--hk-border-strong)",
        background: "var(--hk-card)",
        fontSize: 15,
        textAlign: "center",
    },
    catEditInput: {
        flex: 1,
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px solid var(--hk-border-strong)",
        background: "var(--hk-card)",
        fontSize: 13,
        fontFamily: "'Hind Siliguri', sans-serif",
    },
    catManageRow: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 4px",
        fontSize: 13,
        borderBottom: "1px solid var(--hk-text-on-dark-soft)",
    },
    catManageBtn: {
        background: "none",
        border: "none",
        fontSize: 13,
        cursor: "pointer",
        padding: 4,
    },
    catBudgetRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "6px 0",
    },
    catBudgetLabel: {
        fontSize: 12.5,
        color: "var(--hk-text)",
        flex: 1,
    },
    catBudgetInput: {
        width: 90,
        padding: "6px 8px",
        borderRadius: 8,
        border: "1px solid var(--hk-border-strong)",
        background: "var(--hk-card)",
        fontSize: 12.5,
        fontFamily: "'JetBrains Mono', monospace",
        textAlign: "right",
    },
};
const styleTag = document.createElement("style");
styleTag.textContent = `
:root {
  /* premium design tokens — light theme (default) */
  --hk-bg: #F5EFE2;
  --hk-surface-soft: #F5EFE2;
  --hk-card: #FFFFFF;
  --hk-border: #E3DCC9;
  --hk-border-strong: #D8CBA8;
  --hk-border-soft: #E9E0C8;
  --hk-border-med: #C9BB98;
  --hk-border-med2: #B0A488;
  --hk-border-light: #DCCFAE;
  --hk-track: #ECE3CD;
  --hk-text: #1A211B;
  --hk-text-on-dark: #F5EFE2;
  --hk-text-on-dark-soft: #EFE6D0;
  --hk-label: #8A9285;
  --hk-text-muted: #687260;
  --hk-text-muted-2: #5C6B5F;
  --hk-muted-on-dark: #B8C4C7;
  --hk-muted-on-dark2: #9FB3B8;
  --hk-success: #0F5B46;
  --hk-success-mid: #217E68;
  --hk-danger: #B84A3A;
  --hk-danger-mid: #C2604D;
  --hk-danger-soft: #E3B3A5;
  --hk-gold: #D8A64A;
  --hk-header-bg: #0F5B46;
}
[data-theme="dark"] {
  --hk-bg: #101716;
  --hk-surface-soft: #1B2422;
  --hk-card: #17211F;
  --hk-border: #26332F;
  --hk-border-strong: #33443E;
  --hk-border-soft: #26332F;
  --hk-border-med: #3A4A43;
  --hk-border-med2: #445850;
  --hk-border-light: #2E3B36;
  --hk-track: #202B27;
  --hk-text: #F1EEE5;
  --hk-text-on-dark: #F1EEE5;
  --hk-text-on-dark-soft: #DCE5DE;
  --hk-label: #7C8F84;
  --hk-text-muted: #9FB0A6;
  --hk-text-muted-2: #B7C4BB;
  --hk-muted-on-dark: #9FB0A6;
  --hk-muted-on-dark2: #8FA89A;
  --hk-success: #4FBE86;
  --hk-success-mid: #5FCB95;
  --hk-danger: #E0776A;
  --hk-danger-mid: #E68A79;
  --hk-danger-soft: #6B3C34;
  --hk-gold: #D8A64A;
  --hk-header-bg: #0B3F30;
}
body { background: var(--hk-bg); }

@keyframes hkspin { to { transform: rotate(360deg); } }
@keyframes hkfadein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.3) sepia(1) saturate(3) hue-rotate(20deg); }
[data-theme="dark"] input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.85) sepia(1) saturate(2) hue-rotate(30deg); }

/* subtle, confident micro-interactions — not flashy, financial-app appropriate */
button { transition: transform 0.12s ease, opacity 0.12s ease, background-color 0.2s ease; }
button:active { transform: scale(0.97); opacity: 0.9; }
* { transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease; }
`;
if (!document.getElementById("hk-keyframes")) {
    styleTag.id = "hk-keyframes";
    document.head.appendChild(styleTag);
}

var __root = ReactDOM.createRoot(document.getElementById("root"));
__root.render(React.createElement(App));
