// অ্যাডমিন প্যানেল — নোটিশ, দৈনিক বার্তা, বিশেষ দিন (ফর্ম + বাল্ক ইমপোর্ট), FAQ
//
// app.js থেকে আলাদা করা অংশ। এটি সাধারণ <script> (module নয়), তাই app.js-এর সব
// global (styles, Icon, ModalShell, formatTaka, useState …) এখানেও সরাসরি ব্যবহার করা
// যায় — সেগুলো শুধু কল হওয়ার সময় লাগে, লোডের সময় নয়।
// লোড ক্রম (index.html): styles.js → admin.js → debts.js → tax.js → settings.js →
//   calendar-tasks.js → reports-search.js → app.js (সবার শেষে; ওটাই <App/> রেন্ডার করে)
// এই ফাইলের কম্পোনেন্ট: NoticeForm, DailyMessageForm, AdminSpecialDayForm, FaqAdminForm, BulkSpecialDayImport, AdminPanel
"use strict";

function NoticeForm({ initial, onClose, onSave }) {
    const [title, setTitle] = useState((initial === null || initial === void 0 ? void 0 : initial.title) || "");
    const [content, setContent] = useState((initial === null || initial === void 0 ? void 0 : initial.content) || "");
    const [category, setCategory] = useState((initial === null || initial === void 0 ? void 0 : initial.category) || "সাধারণ");
    const [published, setPublished] = useState((initial === null || initial === void 0 ? void 0 : initial.published) !== false);
    const [err, setErr] = useState("");
    return (React.createElement(ModalShell, { onClose: onClose, fullScreen: true, title: initial ? "নোটিশ সম্পাদনা" : "নতুন নোটিশ" },
        React.createElement("label", { style: admStyles.label }, "শিরোনাম *"),
        React.createElement("input", { style: admStyles.input, value: title, onChange: (e) => setTitle(e.target.value) }),
        React.createElement("label", { style: admStyles.label }, "বিস্তারিত"),
        React.createElement("textarea", { style: Object.assign(Object.assign({}, admStyles.input), { minHeight: 90 }), value: content, onChange: (e) => setContent(e.target.value) }),
        React.createElement("label", { style: admStyles.label }, "ক্যাটেগরি"),
        React.createElement("input", { style: admStyles.input, value: category, onChange: (e) => setCategory(e.target.value) }),
        React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13.5 } },
            React.createElement("input", { type: "checkbox", checked: published, onChange: (e) => setPublished(e.target.checked) }),
            "প্রকাশিত (Publish)"),
        err && React.createElement("div", { style: { color: "var(--hk-danger)", fontSize: 12.5, marginBottom: 8 } }, err),
        React.createElement("button", { style: admStyles.addBtn, onClick: () => { if (!title.trim()) { setErr("শিরোনাম লিখুন"); return; } onSave({ title: title.trim(), content: content.trim(), category: category.trim(), published }); } }, "সংরক্ষণ করুন")));
}
function DailyMessageForm({ initial, onClose, onSave }) {
    const [title, setTitle] = useState((initial === null || initial === void 0 ? void 0 : initial.title) || "");
    const [content, setContent] = useState((initial === null || initial === void 0 ? void 0 : initial.content) || "");
    const [date, setDate] = useState((initial === null || initial === void 0 ? void 0 : initial.date) || todayStr());
    const [err, setErr] = useState("");
    return (React.createElement(ModalShell, { onClose: onClose, fullScreen: true, title: initial ? "বার্তা সম্পাদনা" : "নতুন দৈনিক বার্তা" },
        React.createElement("label", { style: admStyles.label }, "শিরোনাম *"),
        React.createElement("input", { style: admStyles.input, value: title, onChange: (e) => setTitle(e.target.value) }),
        React.createElement("label", { style: admStyles.label }, "বার্তা"),
        React.createElement("textarea", { style: Object.assign(Object.assign({}, admStyles.input), { minHeight: 90 }), value: content, onChange: (e) => setContent(e.target.value) }),
        React.createElement("label", { style: admStyles.label }, "তারিখ"),
        React.createElement("input", { style: admStyles.input, type: "date", value: date, onChange: (e) => setDate(e.target.value) }),
        err && React.createElement("div", { style: { color: "var(--hk-danger)", fontSize: 12.5, marginBottom: 8 } }, err),
        React.createElement("button", { style: admStyles.addBtn, onClick: () => { if (!title.trim()) { setErr("শিরোনাম লিখুন"); return; } onSave({ title: title.trim(), content: content.trim(), date }); } }, "সংরক্ষণ করুন")));
}
function AdminSpecialDayForm({ initial, onClose, onSave }) {
    // A special day can be created from EITHER an English date or a Hijri
    // date (admin picks one). A one-time entry is stored under its English
    // `date` (so the calendar, notifications and sorting keep working
    // unchanged); a Hijri-created one-time day also keeps `hijri` + dateType
    // so the form re-opens in Hijri mode when edited.
    //
    // A RECURRING Hijri day (e.g. "১৪ রজব, প্রতি হিজরি বছর") is different:
    // its identity is ONLY {hijriMonth, hijriDay} — no `date` field is ever
    // saved for it, since a fixed English date must never stand in as the
    // permanent identity of a Hijri-recurring event. Every place that reads
    // such an entry (calendar dots, notifications, admin list) recomputes
    // that year's matching English date live via resolveSpecialDayDate().
    const isRecurringHijri = (initial === null || initial === void 0 ? void 0 : initial.recurrence) === "hijri";
    const startHijri = isRecurringHijri || ((initial === null || initial === void 0 ? void 0 : initial.dateType) === "hijri" && initial.hijri);
    const [mode, setMode] = useState(startHijri ? "hijri" : "gregorian"); // gregorian | hijri
    const [recurring, setRecurring] = useState(!!isRecurringHijri);
    const [date, setDate] = useState((initial === null || initial === void 0 ? void 0 : initial.date) || todayStr());
    const seedH = isRecurringHijri ? { year: 1447, month: initial.hijriMonth, day: initial.hijriDay }
        : startHijri ? initial.hijri
            : (ymdToHijriParts((initial === null || initial === void 0 ? void 0 : initial.date) || todayStr()) || { year: 1447, month: 1, day: 1 });
    const [hDay, setHDay] = useState(String(seedH.day));
    const [hMonth, setHMonth] = useState(String(seedH.month));
    const [hYear, setHYear] = useState(String(seedH.year));
    const [title, setTitle] = useState((initial === null || initial === void 0 ? void 0 : initial.title) || "");
    const [description, setDescription] = useState((initial === null || initial === void 0 ? void 0 : initial.description) || "");
    const [err, setErr] = useState("");
    const hijriModuleMissing = mode === "hijri" && !window.HijriUQ;
    const hijriYmd = mode === "hijri" && !recurring ? hijriToGregorianYmd(hYear, hMonth, hDay) : null;
    // recurring preview: this year's (or the next upcoming) matching English date
    const recurringNextYmd = recurring && window.HijriUQ ? window.HijriUQ.nextHijriOccurrence(parseInt(hMonth, 10), parseInt(hDay, 10), todayStr()) : null;
    const switchMode = (next) => {
        if (next === mode)
            return;
        setErr("");
        if (next === "hijri") {
            const hp = ymdToHijriParts(date);
            if (hp) {
                setHDay(String(hp.day));
                setHMonth(String(hp.month));
                setHYear(String(hp.year));
            }
        }
        else {
            if (recurring && recurringNextYmd)
                setDate(recurringNextYmd);
            else if (hijriYmd)
                setDate(hijriYmd);
            setRecurring(false); // recurring is Hijri-only
        }
        setMode(next);
    };
    const modeBtn = (key, label) => React.createElement("button", { key: key, type: "button", onClick: () => switchMode(key), style: { flex: 1, height: 38, border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 13.5, fontWeight: mode === key ? 700 : 500, background: mode === key ? "var(--hk-gold)" : "transparent", color: mode === key ? "#1a1a1a" : "var(--hk-text)" } }, label);
    const hp = mode === "gregorian" ? ymdToHijriParts(date) : null;
    const previewStyle = { fontSize: 12.5, color: "var(--hk-text-muted)", marginTop: 6 };
    return (React.createElement(ModalShell, { onClose: onClose, fullScreen: true, title: initial ? "বিশেষ দিবস সম্পাদনা" : "নতুন বিশেষ দিবস" },
        React.createElement("label", { style: admStyles.label }, "তারিখের ধরন (যেকোনো একটি বেছে নিন)"),
        React.createElement("div", { style: { display: "flex", gap: 4, background: "var(--hk-card)", border: "1px solid var(--hk-border)", borderRadius: 10, padding: 3 } },
            modeBtn("gregorian", "ইংরেজি তারিখ"), modeBtn("hijri", "হিজরি তারিখ")),
        mode === "gregorian" ? (React.createElement("div", null,
            React.createElement("label", { style: admStyles.label }, "ইংরেজি তারিখ *"),
            React.createElement("input", { style: admStyles.input, type: "date", value: date, onChange: (e) => setDate(e.target.value) }),
            hp && React.createElement("div", { style: previewStyle }, `হিজরি: ${toBnDigits(hp.day)} ${HIJRI_MONTHS[hp.month - 1]} ${toBnDigits(hp.year)}`))) : (React.createElement("div", null,
            React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 10, marginBottom: 4, fontSize: 13.5, color: "var(--hk-text)", cursor: "pointer" } },
                React.createElement("input", { type: "checkbox", checked: recurring, onChange: (e) => setRecurring(e.target.checked) }),
                "🔁 পুনরাবৃত্তি: প্রতি হিজরি বছর (তারিখ প্রতি বছর স্বয়ংক্রিয়ভাবে হিসাব হবে)"),
            React.createElement("label", { style: admStyles.label }, recurring ? "হিজরি দিন ও মাস *" : "হিজরি তারিখ *"),
            React.createElement("div", { style: { display: "flex", gap: 8 } },
                React.createElement("select", { style: Object.assign(Object.assign({}, admStyles.input), { flex: 1 }), value: hDay, onChange: (e) => setHDay(e.target.value), "aria-label": "হিজরি দিন" },
                    Array.from({ length: 30 }, (_, k) => k + 1).map((n) => React.createElement("option", { key: n, value: String(n) }, toBnDigits(n)))),
                React.createElement("select", { style: Object.assign(Object.assign({}, admStyles.input), { flex: recurring ? 3 : 2 }), value: hMonth, onChange: (e) => setHMonth(e.target.value), "aria-label": "হিজরি মাস" },
                    HIJRI_MONTHS.map((nm, k) => React.createElement("option", { key: nm, value: String(k + 1) }, nm))),
                !recurring && React.createElement("input", { style: Object.assign(Object.assign({}, admStyles.input), { flex: 1.3 }), type: "number", inputMode: "numeric", value: hYear, onChange: (e) => setHYear(e.target.value), "aria-label": "হিজরি সাল" })),
            recurring
                ? (recurringNextYmd
                    ? React.createElement("div", { style: previewStyle }, `এই বছর ইংরেজি তারিখ: ${formatDateBn(recurringNextYmd).full} (পরের হিজরি বছর থেকে তারিখ আবার নতুন করে হিসাব হবে)`)
                    : React.createElement("div", { style: Object.assign(Object.assign({}, previewStyle), { color: "var(--hk-danger)" }) }, hijriModuleMissing ? "হিজরি ক্যালেন্ডার মডিউল লোড হয়নি — অ্যাপ বন্ধ করে আবার খুলুন" : "এই হিজরি দিন/মাসের কোনো বৈধ occurrence পাওয়া যায়নি"))
                : (hijriYmd
                    ? React.createElement("div", { style: previewStyle }, `ইংরেজি তারিখ: ${formatDateBn(hijriYmd).full}`)
                    : React.createElement("div", { style: Object.assign(Object.assign({}, previewStyle), { color: "var(--hk-danger)" }) }, hijriModuleMissing ? "হিজরি ক্যালেন্ডার মডিউল লোড হয়নি — অ্যাপ বন্ধ করে আবার খুলুন" : "এই হিজরি তারিখটি সঠিক নয় (মাসে ২৯ বা ৩০ দিন থাকে)")),
            React.createElement("div", { style: previewStyle }, "হিসাবটি উম্মুল কুরা (Umm al-Qura) সারণি অনুযায়ী — রমজান/শাওয়াল/জিলহজের প্রকৃত শুরু সরকারি চাঁদ দেখার ঘোষণার ওপর নির্ভর করে ±১ দিন আলাদা হতে পারে।"))),
        React.createElement("label", { style: admStyles.label }, "শিরোনাম *"),
        React.createElement("input", { style: admStyles.input, value: title, onChange: (e) => setTitle(e.target.value) }),
        React.createElement("label", { style: admStyles.label }, "বিস্তারিত বিবরণ"),
        React.createElement("textarea", { style: Object.assign(Object.assign({}, admStyles.input), { minHeight: 90 }), value: description, onChange: (e) => setDescription(e.target.value) }),
        err && React.createElement("div", { style: { color: "var(--hk-danger)", fontSize: 12.5, marginBottom: 8 } }, err),
        React.createElement("button", { style: admStyles.addBtn, onClick: () => {
                if (!title.trim()) {
                    setErr("শিরোনাম আবশ্যক");
                    return;
                }
                if (mode === "hijri" && recurring) {
                    if (!recurringNextYmd) {
                        setErr("সঠিক হিজরি দিন/মাস দিন");
                        return;
                    }
                    onSave({
                        title: title.trim(), description: description.trim(),
                        recurrence: "hijri", hijriMonth: parseInt(hMonth, 10), hijriDay: parseInt(hDay, 10),
                        dateType: "hijri", date: null, hijri: null,
                    });
                    return;
                }
                const finalDate = mode === "hijri" ? hijriYmd : date;
                if (!finalDate) {
                    setErr(mode === "hijri" ? "সঠিক হিজরি তারিখ দিন" : "তারিখ আবশ্যক");
                    return;
                }
                onSave({
                    date: finalDate, title: title.trim(), description: description.trim(),
                    dateType: mode, recurrence: null,
                    hijri: mode === "hijri" ? { year: parseInt(hYear, 10), month: parseInt(hMonth, 10), day: parseInt(hDay, 10) } : null,
                });
            } }, "সংরক্ষণ করুন")));
}
function FaqAdminForm({ initial, onClose, onSave }) {
    const [question, setQuestion] = useState((initial === null || initial === void 0 ? void 0 : initial.question) || "");
    const [answer, setAnswer] = useState((initial === null || initial === void 0 ? void 0 : initial.answer) || "");
    const [err, setErr] = useState("");
    return (React.createElement(ModalShell, { onClose: onClose, fullScreen: true, title: initial ? "প্রশ্ন-উত্তর সম্পাদনা" : "নতুন প্রশ্ন-উত্তর" },
        React.createElement("label", { style: admStyles.label }, "প্রশ্ন *"),
        React.createElement("input", { style: admStyles.input, value: question, onChange: (e) => setQuestion(e.target.value) }),
        React.createElement("label", { style: admStyles.label }, "উত্তর *"),
        React.createElement("textarea", { style: Object.assign(Object.assign({}, admStyles.input), { minHeight: 100 }), value: answer, onChange: (e) => setAnswer(e.target.value) }),
        err && React.createElement("div", { style: { color: "var(--hk-danger)", fontSize: 12.5, marginBottom: 8 } }, err),
        React.createElement("button", { style: admStyles.addBtn, onClick: () => { if (!question.trim() || !answer.trim()) { setErr("প্রশ্ন ও উত্তর দুটোই আবশ্যক"); return; } onSave({ question: question.trim(), answer: answer.trim() }); } }, "সংরক্ষণ করুন")));
}
// বাল্ক ইমপোর্ট — খসড়া হিসাব খাতার মতো সারি-ভিত্তিক দ্রুত এন্ট্রি: ১০টা
// সিরিয়াল/লাইন দিয়ে শুরু, বিবরণ/শিরোনাম ঘরে লেখা থাকা অবস্থায় Enter চাপলে
// পরের নতুন লাইন যোগ হয় (খালি রাখলে হয় না) — খসড়া খাতার enterNav()-এর
// ঠিক একই নিয়ম, শুধু "desc" কলামের বদলে এখানে "title" কলামে প্রযোজ্য।
// উপরে একটা global টগল দিয়ে পুরো টেবিলের তারিখ ইংরেজি না হিজরি ঠিক হয়:
// হিজরি মোডে প্রতিটা সারি দিন+মাস (বছর ছাড়া) নেয় এবং সবসময় "প্রতি হিজরি
// বছর" recurring হিসেবেই সংরক্ষিত হয় — এটাই বাল্কে যোগ করা ইসলামি দিবসের
// (রমজান, ঈদ, আশুরা...) স্বাভাবিক ব্যবহার, তাই প্রতি সারিতে আলাদা
// recurring-টগল রাখেনি জটিলতা কমাতে।
function newBulkSpecialDayRow() { return { id: uid(), gDate: "", hDay: "", hMonth: "", title: "", details: "" }; }
function newBulkSpecialDayRows(n) { return Array.from({ length: n || 10 }, newBulkSpecialDayRow); }
function isBlankBulkSpecialDayRow(row) { return !String((row && row.title) || "").trim(); }
// Enter-key rule (খসড়া খাতার enterNav()-এর মতোই): বিবরণ/শিরোনাম ঘরে Enter →
// পরের সারির একই ঘরে ফোকাস; শেষ সারিতে থাকলে এবং সেই সারির শিরোনাম খালি না
// থাকলে একটা নতুন সারি যোগ হয়ে সেখানে ফোকাস যায়; খালি থাকলে কিছু হয় না।
function bulkSpecialDayEnterNav(index, rows) {
    const last = rows.length - 1;
    if (index < last) return { type: "focus", index: index + 1 };
    if (String(rows[index].title || "").trim()) return { type: "add", index: index + 1 };
    return { type: "none" };
}
function BulkSpecialDayImport({ onClose, onImport }) {
    const [dateMode, setDateMode] = useState("gregorian"); // "gregorian" | "hijri"
    const [rows, setRows] = useState(() => newBulkSpecialDayRows(10));
    const [err, setErr] = useState("");
    const [msg, setMsg] = useState("");
    const [busy, setBusy] = useState(false);
    const [focusReq, setFocusReq] = useState(null);
    const refs = useRef({});
    useEffect(() => {
        if (!focusReq) return;
        const el = refs.current["title-" + focusReq];
        if (el && el.focus) el.focus();
        setFocusReq(null);
    }, [focusReq]);
    const setCell = (i, field, value) => { setErr(""); setMsg(""); setRows((rs) => rs.map((r, k) => (k === i ? Object.assign({}, r, { [field]: value }) : r))); };
    const addRow = () => setRows((rs) => [...rs, newBulkSpecialDayRow()]);
    const removeRow = (i) => setRows((rs) => (rs.length > 1 ? rs.filter((_, k) => k !== i) : rs));
    const onTitleEnter = (i) => (e) => {
        if (e.key !== "Enter" || (e.nativeEvent && e.nativeEvent.isComposing)) return;
        e.preventDefault();
        const act = bulkSpecialDayEnterNav(i, rows);
        if (act.type === "add") setRows((rs) => [...rs, newBulkSpecialDayRow()]);
        if (act.type !== "none") setFocusReq(act.index);
    };
    const usedRows = rows.filter((r) => !isBlankBulkSpecialDayRow(r));
    const save = async () => {
        if (usedRows.length === 0) { setErr("অন্তত একটি লাইনে শিরোনাম দিন"); return; }
        const incomplete = [];
        const payload = [];
        usedRows.forEach((r, k) => {
            const serial = rows.indexOf(r) + 1;
            if (dateMode === "gregorian") {
                if (!r.gDate) { incomplete.push(serial); return; }
                payload.push({ date: r.gDate, title: r.title.trim(), description: (r.details || "").trim() });
            }
            else {
                const hm = parseInt(r.hMonth, 10), hd = parseInt(r.hDay, 10);
                if (!hm || !hd) { incomplete.push(serial); return; }
                payload.push({ recurrence: "hijri", hijriMonth: hm, hijriDay: hd, title: r.title.trim(), description: (r.details || "").trim(), date: null, hijri: null });
            }
        });
        if (incomplete.length) { setErr(`লাইন ${incomplete.join(", ")}-এ তারিখ দেওয়া হয়নি`); return; }
        setBusy(true);
        const result = await onImport(payload);
        setBusy(false);
        if (result && result.ok === false) { setErr(result.message || "সংরক্ষণ ব্যর্থ হয়েছে"); return; }
        const skipped = (result && result.skipped) || 0;
        setMsg(`✓ ${(result && result.added) || payload.length}টি যোগ হয়েছে${skipped ? ` (${skipped}টি আগে থেকেই ছিল, বাদ দেওয়া হয়েছে)` : ""}`);
        setRows(newBulkSpecialDayRows(10));
    };
    const rowStyle = { display: "grid", gridTemplateColumns: "26px 1fr 1fr 1fr 22px", gap: 5, alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--hk-border-light)" };
    const cellInput = { width: "100%", padding: "5px 6px", borderRadius: 5, border: "1px solid var(--hk-border-strong)", background: "var(--hk-surface-soft)", fontSize: 12, fontFamily: "'Hind Siliguri', sans-serif", minWidth: 0, boxSizing: "border-box" };
    return (React.createElement(ModalShell, { onClose: onClose, fullScreen: true, title: "বাল্ক ইমপোর্ট — বিশেষ দিবস" },
        React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 10, fontSize: 12.5 } },
            React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 4 } },
                React.createElement("input", { type: "radio", name: "bulkDateMode", checked: dateMode === "gregorian", onChange: () => setDateMode("gregorian") }), "ইংরেজি তারিখ"),
            React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 4 } },
                React.createElement("input", { type: "radio", name: "bulkDateMode", checked: dateMode === "hijri", onChange: () => setDateMode("hijri") }), "হিজরি তারিখ (প্রতি হিজরি বছর পুনরাবৃত্তি)")),
        React.createElement("div", { style: Object.assign({}, rowStyle, { fontWeight: 700, fontSize: 11, color: "var(--hk-text-muted)", borderBottom: "2px solid var(--hk-border-strong)" }) },
            React.createElement("span", null, "#"), React.createElement("span", null, "তারিখ"), React.createElement("span", null, "বিবরণ/শিরোনাম"), React.createElement("span", null, "বিস্তারিত"), React.createElement("span", null)),
        rows.map((r, i) => React.createElement("div", { key: r.id, style: rowStyle },
            React.createElement("span", { style: { fontSize: 11, color: "var(--hk-text-muted)" } }, i + 1),
            dateMode === "gregorian"
                ? React.createElement("input", { style: cellInput, type: "date", value: r.gDate, onChange: (e) => setCell(i, "gDate", e.target.value) })
                : React.createElement("div", { style: { display: "flex", gap: 3 } },
                    React.createElement("select", { style: Object.assign({}, cellInput, { width: 48, padding: "5px 2px" }), value: r.hDay, onChange: (e) => setCell(i, "hDay", e.target.value) },
                        React.createElement("option", { value: "" }, "দিন"),
                        Array.from({ length: 30 }, (_, d) => d + 1).map((d) => React.createElement("option", { key: d, value: d }, toBnDigits(d)))),
                    React.createElement("select", { style: Object.assign({}, cellInput, { padding: "5px 2px" }), value: r.hMonth, onChange: (e) => setCell(i, "hMonth", e.target.value) },
                        React.createElement("option", { value: "" }, "মাস"),
                        HIJRI_MONTHS.map((mName, mi) => React.createElement("option", { key: mi, value: mi + 1 }, mName)))),
            React.createElement("input", { ref: (el) => { refs.current["title-" + i] = el; }, style: cellInput, value: r.title, onChange: (e) => setCell(i, "title", e.target.value), onKeyDown: onTitleEnter(i), placeholder: "যেমন: ঈদ মিলাদুন্নবী" }),
            React.createElement("input", { style: cellInput, value: r.details, onChange: (e) => setCell(i, "details", e.target.value), placeholder: "বিস্তারিত (ঐচ্ছিক)" }),
            React.createElement("button", { style: { border: "none", background: "none", color: "var(--hk-danger)", fontSize: 15, cursor: "pointer", padding: 0 }, onClick: () => removeRow(i), "aria-label": "সারি মুছুন", type: "button" }, "✕"))),
        React.createElement("button", { style: { fontSize: 12, color: "var(--hk-gold)", background: "none", border: "none", marginTop: 8, padding: 0 }, onClick: addRow, type: "button" }, "+ আরেকটি লাইন"),
        React.createElement("div", { style: admStyles.totalsBar }, React.createElement("span", null, `মোট পূরণ করা লাইন: ${toBnDigits(usedRows.length)}`)),
        err && React.createElement("div", { style: { color: "var(--hk-danger)", fontSize: 12.5, marginTop: 6 } }, err),
        msg && React.createElement("div", { style: { color: "var(--hk-success, #1a7f37)", fontSize: 12.5, marginTop: 6 } }, msg),
        React.createElement("button", { style: Object.assign(Object.assign({}, admStyles.addBtn), { marginTop: 12 }), disabled: busy, onClick: save }, busy ? "সংরক্ষণ হচ্ছে…" : `সংরক্ষণ করুন (${toBnDigits(usedRows.length)})`)));
}
function AdminPanel({ onClose, notices, dailyMessages, adminSpecialDaysCloud, adminTasksCloud, faqCloud, loading, error, onRefresh, onAddNotice, onUpdateNotice, onDeleteNotice, onAddDailyMessage, onUpdateDailyMessage, onDeleteDailyMessage, onAddSpecialDay, onUpdateSpecialDay, onDeleteSpecialDay, onBulkImport, onAddTask, onUpdateTask, onDeleteTask, onAddFaq, onUpdateFaq, onDeleteFaq, }) {
    const [tab, setTab] = useState("notices"); // notices | daily | special | task | faq
    const [editingNotice, setEditingNotice] = useState(null);
    const [showNoticeForm, setShowNoticeForm] = useState(false);
    const [editingMsg, setEditingMsg] = useState(null);
    const [showMsgForm, setShowMsgForm] = useState(false);
    const [editingDay, setEditingDay] = useState(null);
    const [showDayForm, setShowDayForm] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [editingFaq, setEditingFaq] = useState(null);
    const [showFaqForm, setShowFaqForm] = useState(false);
    const [showBulk, setShowBulk] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    // surfaces a real Firestore failure instead of the form just closing as
    // if the save worked — cleared on every new attempt
    const [submitError, setSubmitError] = useState("");
    useBackOverlay(showNoticeForm, () => setShowNoticeForm(false));
    useBackOverlay(showMsgForm, () => setShowMsgForm(false));
    useBackOverlay(showDayForm, () => setShowDayForm(false));
    useBackOverlay(showTaskForm, () => setShowTaskForm(false));
    useBackOverlay(showFaqForm, () => setShowFaqForm(false));
    useBackOverlay(showBulk, () => setShowBulk(false));
    // every save/delete goes through this: only close the form/clear the
    // confirm state if Firestore actually confirmed the write
    const runAndClose = async (opPromise, onSuccess) => {
        setSubmitError("");
        const result = await opPromise;
        if (result && result.ok === false) {
            setSubmitError(result.message || "সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।");
            return;
        }
        onSuccess();
    };
    const rowActions = (item, onEdit, onDelete) => React.createElement("div", { style: { display: "flex", gap: 2 } },
        React.createElement("button", { style: admStyles.iconBtn, onClick: onEdit }, React.createElement(Icon, { name: "edit", size: 14 })),
        deleteConfirmId === item.id
            ? React.createElement("button", { style: admStyles.confirmBtn, onClick: () => runAndClose(onDelete(item.id), () => setDeleteConfirmId(null)) }, "নিশ্চিত?")
            : React.createElement("button", { style: admStyles.iconBtn, onClick: () => setDeleteConfirmId(item.id) }, React.createElement(Icon, { name: "delete", size: 14 })));
    const body = [];
    if (submitError) {
        body.push(React.createElement("div", { key: "suberr", style: { background: "var(--hk-danger-soft)", color: "var(--hk-danger)", fontSize: 12.5, padding: "8px 10px", borderRadius: 8, marginBottom: 10 } }, submitError));
    }
    if (loading) {
        body.push(React.createElement("div", { key: "loading", style: admStyles.muted }, "লোড হচ্ছে..."));
    }
    else if (error) {
        body.push(React.createElement("div", { key: "error", style: { color: "var(--hk-danger)", fontSize: 13, marginBottom: 10 } }, "লোড ব্যর্থ হয়েছে। ", React.createElement("button", { style: { color: "var(--hk-gold)", background: "none", border: "none", textDecoration: "underline" }, onClick: onRefresh }, "আবার চেষ্টা করুন")));
    }
    else if (tab === "notices") {
        body.push(React.createElement("button", { key: "add", style: admStyles.addBtn, onClick: () => { setEditingNotice(null); setShowNoticeForm(true); } }, "+ নতুন নোটিশ"));
        if (notices.length === 0)
            body.push(React.createElement(EmptyState, { key: "empty", text: "এখনও কোনো নোটিশ নেই।" }));
        notices.forEach((n) => body.push(React.createElement("div", { key: n.id, style: admStyles.card },
            React.createElement("div", { style: admStyles.row },
                React.createElement("div", null,
                    React.createElement("div", { style: { fontWeight: 600 } }, n.title, !n.published && React.createElement("span", { style: { fontSize: 10.5, color: "var(--hk-text-muted)", marginLeft: 6 } }, "(খসড়া)")),
                    n.category && React.createElement("div", { style: admStyles.muted }, n.category)),
                rowActions(n, () => { setEditingNotice(n); setShowNoticeForm(true); }, onDeleteNotice)))));
    }
    else if (tab === "daily") {
        body.push(React.createElement("button", { key: "add", style: admStyles.addBtn, onClick: () => { setEditingMsg(null); setShowMsgForm(true); } }, "+ নতুন দৈনিক বার্তা"));
        if (dailyMessages.length === 0)
            body.push(React.createElement(EmptyState, { key: "empty", text: "এখনও কোনো দৈনিক বার্তা নেই।" }));
        dailyMessages.forEach((m) => body.push(React.createElement("div", { key: m.id, style: admStyles.card },
            React.createElement("div", { style: admStyles.row },
                React.createElement("div", null,
                    React.createElement("div", { style: { fontWeight: 600 } }, m.title),
                    React.createElement("div", { style: admStyles.muted }, m.date)),
                rowActions(m, () => { setEditingMsg(m); setShowMsgForm(true); }, onDeleteDailyMessage)))));
    }
    else if (tab === "special") {
        body.push(React.createElement("div", { key: "actions", style: { display: "flex", gap: 8, marginBottom: 14 } },
            React.createElement("button", { style: Object.assign(Object.assign({}, admStyles.addBtn), { marginBottom: 0, flex: 1 }), onClick: () => { setEditingDay(null); setShowDayForm(true); } }, "+ একটি যোগ করুন"),
            React.createElement("button", { style: Object.assign(Object.assign({}, admStyles.addBtn), { marginBottom: 0, flex: 1, background: "var(--hk-card)", color: "var(--hk-text)", border: "1px solid var(--hk-border)" }), onClick: () => setShowBulk(true) }, "বাল্ক ইমপোর্ট")));
        if (adminSpecialDaysCloud.length === 0)
            body.push(React.createElement(EmptyState, { key: "empty", text: "এখনও কোনো বিশেষ দিবস যোগ করা হয়নি।" }));
        [...adminSpecialDaysCloud].map((s) => Object.assign({ _resolvedDate: resolveSpecialDayDate(s) }, s)).sort((a, b) => ((a._resolvedDate || "") < (b._resolvedDate || "") ? -1 : 1)).forEach((s) => body.push(React.createElement("div", { key: s.id, style: admStyles.card },
            React.createElement("div", { style: admStyles.row },
                React.createElement("div", null,
                    React.createElement("div", { style: { fontWeight: 600 } },
                        s.recurrence === "hijri"
                            ? `🔁 ${toBnDigits(s.hijriDay)} ${HIJRI_MONTHS[s.hijriMonth - 1] || ""} — ${s.title}`
                            : `${formatDateBn(s.date).full} — ${s.title}`),
                    s.recurrence === "hijri" && React.createElement("div", { style: admStyles.muted }, s._resolvedDate ? `প্রতি হিজরি বছর · এই বছর: ${formatDateBn(s._resolvedDate).full}` : "প্রতি হিজরি বছর"),
                    s.dateType === "hijri" && s.hijri && React.createElement("div", { style: admStyles.muted }, `🌙 হিজরি: ${toBnDigits(s.hijri.day)} ${HIJRI_MONTHS[s.hijri.month - 1] || ""} ${toBnDigits(s.hijri.year)}`),
                    s.description && React.createElement("div", { style: admStyles.muted }, s.description)),
                rowActions(s, () => { setEditingDay(s); setShowDayForm(true); }, onDeleteSpecialDay)))));
    }
    else if (tab === "task") {
        body.push(React.createElement("button", { key: "add", style: admStyles.addBtn, onClick: () => { setEditingTask(null); setShowTaskForm(true); } }, "+ নতুন অ্যাডমিন টাস্ক"));
        if ((adminTasksCloud || []).length === 0)
            body.push(React.createElement(EmptyState, { key: "empty", text: "এখনও কোনো অ্যাডমিন টাস্ক নেই।" }));
        (adminTasksCloud || []).forEach((t) => body.push(React.createElement("div", { key: t.id, style: admStyles.card },
            React.createElement("div", { style: admStyles.row },
                React.createElement("div", null,
                    React.createElement("div", { style: { fontWeight: 600 } }, t.title, !t.published && React.createElement("span", { style: { fontSize: 10.5, color: "var(--hk-text-muted)", marginLeft: 6 } }, "(অপ্রকাশিত)")),
                    t.dueDate && React.createElement("div", { style: admStyles.muted }, "শেষ তারিখ: ", formatDateBn(t.dueDate).full)),
                rowActions(t, () => { setEditingTask(t); setShowTaskForm(true); }, onDeleteTask)))));
    }
    else {
        body.push(React.createElement("button", { key: "add", style: admStyles.addBtn, onClick: () => { setEditingFaq(null); setShowFaqForm(true); } }, "+ নতুন প্রশ্ন-উত্তর"));
        if ((faqCloud || []).length === 0)
            body.push(React.createElement(EmptyState, { key: "empty", text: "এখনও কোনো প্রশ্ন-উত্তর নেই।" }));
        (faqCloud || []).forEach((f) => body.push(React.createElement("div", { key: f.id, style: admStyles.card },
            React.createElement("div", { style: admStyles.row },
                React.createElement("div", null,
                    React.createElement("div", { style: { fontWeight: 600 } }, f.question),
                    React.createElement("div", { style: admStyles.muted }, f.answer)),
                rowActions(f, () => { setEditingFaq(f); setShowFaqForm(true); }, onDeleteFaq)))));
    }
    if (showNoticeForm)
        body.push(React.createElement(NoticeForm, { key: "nform", initial: editingNotice, onClose: () => setShowNoticeForm(false), onSave: (data) => runAndClose(editingNotice ? onUpdateNotice(editingNotice.id, data) : onAddNotice(data), () => setShowNoticeForm(false)) }));
    if (showMsgForm)
        body.push(React.createElement(DailyMessageForm, { key: "mform", initial: editingMsg, onClose: () => setShowMsgForm(false), onSave: (data) => runAndClose(editingMsg ? onUpdateDailyMessage(editingMsg.id, data) : onAddDailyMessage(data), () => setShowMsgForm(false)) }));
    if (showDayForm)
        body.push(React.createElement(AdminSpecialDayForm, { key: "dform", initial: editingDay, onClose: () => setShowDayForm(false), onSave: (data) => runAndClose(editingDay ? onUpdateSpecialDay(editingDay.id, data) : onAddSpecialDay(data), () => setShowDayForm(false)) }));
    if (showTaskForm)
        body.push(React.createElement(TaskAdminForm, { key: "tform", initial: editingTask, onClose: () => setShowTaskForm(false), onSave: (data) => runAndClose(editingTask ? onUpdateTask(editingTask.id, data) : onAddTask(data), () => setShowTaskForm(false)) }));
    if (showFaqForm)
        body.push(React.createElement(FaqAdminForm, { key: "fform", initial: editingFaq, onClose: () => setShowFaqForm(false), onSave: (data) => runAndClose(editingFaq ? onUpdateFaq(editingFaq.id, data) : onAddFaq(data), () => setShowFaqForm(false)) }));
    if (showBulk)
        body.push(React.createElement(BulkSpecialDayImport, { key: "bulk", onClose: () => setShowBulk(false), existing: adminSpecialDaysCloud, onImport: async (rows) => {
                const result = await onBulkImport(rows);
                if (result && result.ok === false) {
                    setSubmitError(result.message || "বাল্ক ইমপোর্ট ব্যর্থ হয়েছে।");
                }
                return result;
            } }));
    return React.createElement(ModalShell, { onClose: onClose, fullScreen: true, title: "\u098F\u09A1\u09AE\u09BF\u09A8 \u09AA\u09CD\u09AF\u09BE\u09A8\u09C7\u09B2" },
        React.createElement("div", { style: admStyles.subTabs },
            React.createElement("button", { style: admStyles.subTabBtn(tab === "notices"), onClick: () => setTab("notices") }, "\uD83D\uDCE2 \u09A8\u09CB\u099F\u09BF\u09B6"),
            React.createElement("button", { style: admStyles.subTabBtn(tab === "daily"), onClick: () => setTab("daily") }, "\u2728 \u09A6\u09C8\u09A8\u09BF\u0995 \u09AC\u09BE\u09B0\u09CD\u09A4\u09BE"),
            React.createElement("button", { style: admStyles.subTabBtn(tab === "special"), onClick: () => setTab("special") }, "\uD83D\uDCC5 \u09AC\u09BF\u09B6\u09C7\u09B7 \u09A6\u09BF\u09AC\u09B8"),
            React.createElement("button", { style: admStyles.subTabBtn(tab === "task"), onClick: () => setTab("task") }, "\uD83D\uDCCB \u099F\u09BE\u09B8\u09CD\u0995"),
            React.createElement("button", { style: admStyles.subTabBtn(tab === "faq"), onClick: () => setTab("faq") }, "\u2753 FAQ")),
        ...body);
}
