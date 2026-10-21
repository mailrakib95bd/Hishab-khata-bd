// রিপোর্ট, খুঁজুন (সার্চ) ও টাইমলাইন
//
// app.js থেকে আলাদা করা অংশ। এটি সাধারণ <script> (module নয়), তাই app.js-এর সব
// global (styles, Icon, ModalShell, formatTaka, useState …) এখানেও সরাসরি ব্যবহার করা
// যায় — সেগুলো শুধু কল হওয়ার সময় লাগে, লোডের সময় নয়।
// লোড ক্রম (index.html): styles.js → admin.js → debts.js → tax.js → settings.js →
//   calendar-tasks.js → reports-search.js → app.js (সবার শেষে; ওটাই <App/> রেন্ডার করে)
// এই ফাইলের কম্পোনেন্ট: Timeline, MonthlyReviewModal, Reports, SearchView
"use strict";

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
function Reports({ transactions, categoryBudgets, budget, onSearch }) {
    const cats = useCategories();
    const monthOptions = useMemo(() => buildMonthOptions(), []);
    const [range, setRange] = useState(monthOptions[0].key);
    const [start, end] = rangeToDates(range);
    const [showReview, setShowReview] = useState(false);
    useBackOverlay(showReview, () => setShowReview(false));
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
        React.createElement("div", { style: Object.assign(Object.assign({}, styles.rangeRow), { alignItems: "center" }) },
            RANGE_OPTIONS.map((r) => (React.createElement("button", { key: r.key, onClick: () => setRange(r.key), style: Object.assign(Object.assign({}, styles.rangeChip), (range === r.key ? styles.rangeChipActive : {})) }, r.label))),
            React.createElement("button", { style: Object.assign(Object.assign({}, styles.rangeChip), { marginLeft: "auto", fontWeight: 700 }), onClick: () => onSearch && onSearch(start, end) }, "\uD83D\uDD0D \u0996\u09C1\u0981\u099C\u09C1\u09A8")),
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
function SearchView({ transactions, onOpenTx, seed, familyMembers, userAccounts, debts }) {
    const cats = useCategories();
    const [q, setQ] = useState("");
    const [type, setType] = useState("all");
    const [method, setMethod] = useState("all");
    const [category, setCategory] = useState("all");
    const [familyMemberId, setFamilyMemberId] = useState("all");
    const [accountId, setAccountId] = useState("all");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [amountMin, setAmountMin] = useState("");
    const [amountMax, setAmountMax] = useState("");
    // seeded from Reports' "🔍 খুঁজুন" button, or an account card's "লেনদেন
    // দেখুন" — applies that range/account once per seed (keyed on seed.ts)
    // without clobbering filters the person then edits by hand afterward
    useEffect(() => {
        if (seed && seed.ts) {
            setDateFrom(seed.dateFrom || "");
            setDateTo(seed.dateTo || "");
            if (seed.accountId)
                setAccountId(seed.accountId);
            setShowAdvanced(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seed && seed.ts]);
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
            if (category !== "all" && t.category !== category)
                return false;
            if (familyMemberId !== "all" && t.familyMemberId !== familyMemberId)
                return false;
            if (accountId !== "all" && t.accountId !== accountId)
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
    }, [transactions, q, type, method, category, familyMemberId, accountId, dateFrom, dateTo, amountMin, amountMax, cats]);
    const totalAmount = useMemo(() => results.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0), [results]);
    // debt repayments shown as their own clearly-labeled, separate section —
    // never merged into `results`/`totalAmount` above. They are NOT
    // transactions and must never be counted as income/expense; this is a
    // read-only derived view over `debts`, nothing is written anywhere.
    const repaymentResults = useMemo(() => {
        const query = q.trim().toLowerCase();
        const min = parseFloat(amountMin);
        const max = parseFloat(amountMax);
        const rows = [];
        (debts || []).forEach((d) => {
            (d.repayments || []).forEach((r) => {
                if (method !== "all" && r.method !== method)
                    return;
                if (accountId !== "all" && r.accountId !== accountId)
                    return;
                if (dateFrom && r.date < dateFrom)
                    return;
                if (dateTo && r.date > dateTo)
                    return;
                if (!isNaN(min) && r.amount < min)
                    return;
                if (!isNaN(max) && r.amount > max)
                    return;
                if (query) {
                    const hay = `${d.person} ${r.note || ""}`.toLowerCase();
                    if (!hay.includes(query))
                        return;
                }
                rows.push({ id: r.id, debtType: d.type, person: d.person, amount: r.amount, date: r.date, time: r.time, note: r.note, method: r.method, accountId: r.accountId });
            });
        });
        return rows.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
    }, [debts, q, method, accountId, dateFrom, dateTo, amountMin, amountMax]);
    const repaymentAccountLabel = (r) => r.accountId ? (((userAccounts || []).find((a) => a.id === r.accountId) || {}).name || "মুছে ফেলা অ্যাকাউন্ট") : methodLabel(r.method);
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
        React.createElement("div", { style: styles.filterRow },
            React.createElement("select", { style: styles.filterSelect, value: category, onChange: (e) => setCategory(e.target.value) },
                React.createElement("option", { value: "all" }, "\u09B8\u09AC \u0995\u09CD\u09AF\u09BE\u099F\u09C7\u0997\u09B0\u09BF"),
                (type !== "income" ? cats.expenseCats : []).map((c) => React.createElement("option", { key: `e-${c.key}`, value: c.key }, c.label)),
                (type !== "expense" ? cats.incomeCats : []).map((c) => React.createElement("option", { key: `i-${c.key}`, value: c.key }, c.label))),
            familyMembers && familyMembers.length > 0 && (React.createElement("select", { style: styles.filterSelect, value: familyMemberId, onChange: (e) => setFamilyMemberId(e.target.value) },
                React.createElement("option", { value: "all" }, "\u09B8\u09AC \u09B8\u09A6\u09B8\u09CD\u09AF"),
                familyMembers.map((m) => React.createElement("option", { key: m.id, value: m.id }, m.name)))),
            userAccounts && userAccounts.length > 0 && (React.createElement("select", { style: styles.filterSelect, value: accountId, onChange: (e) => setAccountId(e.target.value) },
                React.createElement("option", { value: "all" }, "\u09B8\u09AC \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F"),
                userAccounts.map((a) => React.createElement("option", { key: a.id, value: a.id }, a.name))))),
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
        results.length === 0 ? (React.createElement(EmptyState, { text: "\u0995\u09CB\u09A8\u09CB \u09B2\u09C7\u09A8\u09A6\u09C7\u09A8 \u09AA\u09BE\u0993\u09AF\u09BC\u09BE \u09AF\u09BE\u09AF\u09BC\u09A8\u09BF\u0964" })) : (React.createElement("div", { style: styles.txList }, results.map((t) => (React.createElement(TxRow, { key: t.id, tx: t, onClick: () => onOpenTx(t), showMethod: true, showDate: true }))))),
        repaymentResults.length > 0 && (React.createElement("div", { style: { marginTop: 18 } },
            React.createElement("div", { style: styles.resultCount }, "\u09A6\u09C7\u09A8\u09BE-\u09AA\u09BE\u0993\u09A8\u09BE\u09B0 \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7 (", toBnDigits(repaymentResults.length), "\u099F\u09BF)"),
            React.createElement("div", { style: styles.txList }, repaymentResults.map((r) => (React.createElement("div", { key: r.id, style: styles.txRow },
                React.createElement("div", { style: styles.txMid },
                    React.createElement("div", { style: styles.txCat }, r.person, " \u2014 ", r.debtType === "receivable" ? "আদায়" : "পরিশোধ"),
                    r.note ? React.createElement("div", { style: styles.txNote }, r.note) : null,
                    React.createElement("div", { style: styles.txMeta }, formatDateBn(r.date).full, " \u00B7 ", repaymentAccountLabel(r))),
                React.createElement("div", { style: Object.assign(Object.assign({}, styles.txAmount), { color: r.debtType === "receivable" ? "var(--hk-success)" : "var(--hk-danger)" }) }, formatTaka(r.amount, { sign: true }))))))))));
}
