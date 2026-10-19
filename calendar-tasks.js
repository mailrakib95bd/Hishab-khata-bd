// ক্যালেন্ডার, নোটিফিকেশন সেন্টার ও টাস্ক (ইউজার + অ্যাডমিন ফর্ম)
//
// app.js থেকে আলাদা করা অংশ। এটি সাধারণ <script> (module নয়), তাই app.js-এর সব
// global (styles, Icon, ModalShell, formatTaka, useState …) এখানেও সরাসরি ব্যবহার করা
// যায় — সেগুলো শুধু কল হওয়ার সময় লাগে, লোডের সময় নয়।
// লোড ক্রম (index.html): styles.js → admin.js → debts.js → tax.js → settings.js →
//   calendar-tasks.js → reports-search.js → app.js (সবার শেষে; ওটাই <App/> রেন্ডার করে)
// এই ফাইলের কম্পোনেন্ট: TaskForm, TaskAdminForm, NotificationCenter, CalendarModal
"use strict";

/* ---------------- header ---------------- */
function TaskForm({ initial, onClose, onSave }) {
    const cats = useCategories();
    const [text, setText] = useState((initial === null || initial === void 0 ? void 0 : initial.text) || "");
    const [date, setDate] = useState((initial === null || initial === void 0 ? void 0 : initial.date) || "");
    const [time, setTime] = useState((initial === null || initial === void 0 ? void 0 : initial.time) || "");
    const [category, setCategory] = useState((initial === null || initial === void 0 ? void 0 : initial.category) || "");
    const [note, setNote] = useState((initial === null || initial === void 0 ? void 0 : initial.note) || "");
    const [repeat, setRepeat] = useState((initial === null || initial === void 0 ? void 0 : initial.repeat) || "none");
    const [reminderPreset, setReminderPreset] = useState((initial === null || initial === void 0 ? void 0 : initial.reminderDate) ? "custom" : "none");
    const [customReminderDate, setCustomReminderDate] = useState((initial === null || initial === void 0 ? void 0 : initial.reminderDate) || "");
    const [customReminderTime, setCustomReminderTime] = useState((initial === null || initial === void 0 ? void 0 : initial.reminderTime) || "");
    const [err, setErr] = useState("");
    return (React.createElement(ModalShell, { onClose: onClose, title: initial ? "টাস্ক সম্পাদনা" : "নতুন টাস্ক" },
        React.createElement("label", { style: admStyles.label }, "টাস্কের নাম *"),
        React.createElement("input", { style: admStyles.input, value: text, onChange: (e) => setText(e.target.value) }),
        React.createElement("div", { style: { display: "flex", gap: 8 } },
            React.createElement("div", { style: { flex: 1 } },
                React.createElement("label", { style: admStyles.label }, "তারিখ"),
                React.createElement("input", { style: admStyles.input, type: "date", value: date, onChange: (e) => setDate(e.target.value) })),
            React.createElement("div", { style: { flex: 1 } },
                React.createElement("label", { style: admStyles.label }, "সময়"),
                React.createElement("input", { style: admStyles.input, type: "time", value: time, onChange: (e) => setTime(e.target.value) }))),
        React.createElement("label", { style: admStyles.label }, "সাব-ক্যাটেগরি"),
        React.createElement("select", { style: admStyles.input, value: category, onChange: (e) => setCategory(e.target.value) },
            React.createElement("option", { value: "" }, "\u2014 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 \u2014"),
            (cats.expenseCats || []).map((c) => React.createElement("option", { key: c.key, value: c.key }, c.label))),
        React.createElement("label", { style: admStyles.label }, "নোট / বিস্তারিত"),
        React.createElement("textarea", { style: Object.assign(Object.assign({}, admStyles.input), { minHeight: 70 }), value: note, onChange: (e) => setNote(e.target.value) }),
        React.createElement("label", { style: admStyles.label }, "রিমাইন্ডার"),
        React.createElement("select", { style: admStyles.input, value: reminderPreset, onChange: (e) => setReminderPreset(e.target.value) }, TASK_REMINDER_PRESETS.map((p) => React.createElement("option", { key: p.key, value: p.key }, p.label))),
        reminderPreset === "custom" && (React.createElement("div", { style: { display: "flex", gap: 8 } },
            React.createElement("input", { style: admStyles.input, type: "date", value: customReminderDate, onChange: (e) => setCustomReminderDate(e.target.value) }),
            React.createElement("input", { style: admStyles.input, type: "time", value: customReminderTime, onChange: (e) => setCustomReminderTime(e.target.value) }))),
        React.createElement("label", { style: admStyles.label }, "রিপিট"),
        React.createElement("select", { style: admStyles.input, value: repeat, onChange: (e) => setRepeat(e.target.value) }, TASK_REPEAT_OPTIONS.map((r) => React.createElement("option", { key: r.key, value: r.key }, r.label))),
        err && React.createElement("div", { style: { color: "var(--hk-danger)", fontSize: 12.5, marginBottom: 8 } }, err),
        React.createElement("button", { style: admStyles.addBtn, onClick: () => {
                if (!text.trim()) {
                    setErr("টাস্কের নাম লিখুন");
                    return;
                }
                const { reminderDate, reminderTime } = computeTaskReminderFields(date, time, reminderPreset, customReminderDate, customReminderTime);
                onSave({ text: text.trim(), date: date || null, time: time || null, category: category || null, note: note.trim(), repeat: repeat === "none" ? null : repeat, reminderDate, reminderTime });
            } }, "সংরক্ষণ করুন")));
}
function TaskAdminForm({ initial, onClose, onSave }) {
    // same field set and same TASK_REMINDER_PRESETS / TASK_REPEAT_OPTIONS /
    // computeTaskReminderFields already used by the personal task form
    // (TaskForm above) — reused as-is, not duplicated, so both task forms
    // offer identical reminder/repeat choices. No amount/price/টাকা field
    // here, matching the personal task form.
    const cats = useCategories();
    const [title, setTitle] = useState((initial === null || initial === void 0 ? void 0 : initial.title) || "");
    const [date, setDate] = useState((initial === null || initial === void 0 ? void 0 : initial.dueDate) || "");
    const [time, setTime] = useState((initial === null || initial === void 0 ? void 0 : initial.time) || "");
    const [category, setCategory] = useState((initial === null || initial === void 0 ? void 0 : initial.category) || "");
    const [note, setNote] = useState((initial === null || initial === void 0 ? void 0 : initial.description) || "");
    const [repeat, setRepeat] = useState((initial === null || initial === void 0 ? void 0 : initial.repeat) || "none");
    const [reminderPreset, setReminderPreset] = useState((initial === null || initial === void 0 ? void 0 : initial.reminderDate) ? "custom" : "none");
    const [customReminderDate, setCustomReminderDate] = useState((initial === null || initial === void 0 ? void 0 : initial.reminderDate) || "");
    const [customReminderTime, setCustomReminderTime] = useState((initial === null || initial === void 0 ? void 0 : initial.reminderTime) || "");
    const [published, setPublished] = useState((initial === null || initial === void 0 ? void 0 : initial.published) !== false);
    const [err, setErr] = useState("");
    return (React.createElement(ModalShell, { onClose: onClose, fullScreen: true, title: initial ? "টাস্ক সম্পাদনা" : "নতুন অ্যাডমিন টাস্ক" },
        React.createElement("label", { style: admStyles.label }, "টাস্কের নাম *"),
        React.createElement("input", { style: admStyles.input, value: title, onChange: (e) => setTitle(e.target.value) }),
        React.createElement("div", { style: { display: "flex", gap: 8 } },
            React.createElement("div", { style: { flex: 1 } },
                React.createElement("label", { style: admStyles.label }, "তারিখ"),
                React.createElement("input", { style: admStyles.input, type: "date", value: date, onChange: (e) => setDate(e.target.value) })),
            React.createElement("div", { style: { flex: 1 } },
                React.createElement("label", { style: admStyles.label }, "সময়"),
                React.createElement("input", { style: admStyles.input, type: "time", value: time, onChange: (e) => setTime(e.target.value) }))),
        React.createElement("label", { style: admStyles.label }, "সাব-ক্যাটেগরি"),
        React.createElement("select", { style: admStyles.input, value: category, onChange: (e) => setCategory(e.target.value) },
            React.createElement("option", { value: "" }, "\u2014 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 \u2014"),
            (cats.expenseCats || []).map((c) => React.createElement("option", { key: c.key, value: c.key }, c.label))),
        React.createElement("label", { style: admStyles.label }, "নোট / বিস্তারিত"),
        React.createElement("textarea", { style: Object.assign(Object.assign({}, admStyles.input), { minHeight: 70 }), value: note, onChange: (e) => setNote(e.target.value) }),
        React.createElement("label", { style: admStyles.label }, "রিমাইন্ডার"),
        React.createElement("select", { style: admStyles.input, value: reminderPreset, onChange: (e) => setReminderPreset(e.target.value) }, TASK_REMINDER_PRESETS.map((p) => React.createElement("option", { key: p.key, value: p.key }, p.label))),
        reminderPreset === "custom" && (React.createElement("div", { style: { display: "flex", gap: 8 } },
            React.createElement("input", { style: admStyles.input, type: "date", value: customReminderDate, onChange: (e) => setCustomReminderDate(e.target.value) }),
            React.createElement("input", { style: admStyles.input, type: "time", value: customReminderTime, onChange: (e) => setCustomReminderTime(e.target.value) }))),
        React.createElement("label", { style: admStyles.label }, "রিপিট"),
        React.createElement("select", { style: admStyles.input, value: repeat, onChange: (e) => setRepeat(e.target.value) }, TASK_REPEAT_OPTIONS.map((r) => React.createElement("option", { key: r.key, value: r.key }, r.label))),
        React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13.5 } },
            React.createElement("input", { type: "checkbox", checked: published, onChange: (e) => setPublished(e.target.checked) }),
            "প্রকাশিত (সবাই দেখতে পাবে)"),
        err && React.createElement("div", { style: { color: "var(--hk-danger)", fontSize: 12.5, marginBottom: 8 } }, err),
        React.createElement("button", { style: admStyles.addBtn, onClick: () => {
                if (!title.trim()) {
                    setErr("শিরোনাম আবশ্যক");
                    return;
                }
                const { reminderDate, reminderTime } = computeTaskReminderFields(date, time, reminderPreset, customReminderDate, customReminderTime);
                onSave({ title: title.trim(), description: note.trim(), category: category || null, dueDate: date || null, time: time || null, repeat: repeat === "none" ? null : repeat, reminderDate, reminderTime, published });
            } }, "সংরক্ষণ করুন")));
}
/* ---------------- notification center ---------------- */
function NotificationCenter({ onClose, notices, dailyMessages, tasks, debts, specialDays, adminSpecialDaysCloud, adminTasksCloud, taxes, readNoticeIds, readDailyMessageIds, dismissedDailyMessageIds, onMarkNoticeRead, onMarkDailyMessageRead, onDismissDailyMessage, onMarkAllRead, }) {
    const [tab, setTab] = useState("notice"); // notice | daily | reminder
    const visibleMessages = dailyMessages.filter((m) => !dismissedDailyMessageIds.includes(m.id));
    // "reminders" pools every source of a dated future obligation the app
    // already tracks — calendar special days (personal + admin), tasks with
    // a reminder set, and debts with a due date — sorted nearest-first
    const today = todayStr();
    const reminders = useMemo(() => {
        const items = [];
        // specialDays is a plain object keyed by date string, mapping to an
        // array of label strings ({ "2026-09-10": ["Eid"] }) — NOT an array
        // of {id,date,title} objects like adminSpecialDaysCloud is. Iterate
        // with Object.entries and push one reminder per label.
        Object.entries(specialDays || {}).forEach(([dateStr, labels]) => {
            if (dateStr >= today) {
                (labels || []).forEach((label) => items.push({ id: `sd-${dateStr}-${label}`, date: dateStr, label, source: "ক্যালেন্ডার" }));
            }
        });
        (adminSpecialDaysCloud || []).forEach((s) => {
            const d = resolveSpecialDayDate(s, today);
            if (d && d >= today)
                items.push({ id: `asd-${s.id}`, date: d, label: s.title, source: "বিশেষ দিবস" });
        });
        (tasks || []).forEach((t) => t.reminderDate && t.reminderDate >= today && !t.done && items.push({ id: `tk-${t.id}`, date: t.reminderDate, label: t.title, source: "টাস্ক" }));
        (debts || []).forEach((d) => d.dueDate && d.dueDate >= today && debtRemaining(d) > 0 && items.push({ id: `db-${d.id}`, date: d.dueDate, label: `${d.person} — ${formatTaka(debtRemaining(d))}`, source: "দেনা" }));
        (taxes || []).forEach((t) => !t.paid && t.dueDate && t.dueDate >= today && items.push({ id: `tx-${t.id}`, date: t.dueDate, label: `${t.name} — ${formatTaka(t.amount)}`, source: "ট্যাক্স" }));
        (adminTasksCloud || []).forEach((t) => t.published !== false && t.reminderDate && t.reminderDate >= today && items.push({ id: `atk-${t.id}`, date: t.reminderDate, label: t.title, source: "অ্যাডমিন টাস্ক" }));
        return items.sort((a, b) => (a.date < b.date ? -1 : 1));
    }, [specialDays, adminSpecialDaysCloud, tasks, debts, taxes, adminTasksCloud, today]);
    const unreadNotices = notices.filter((n) => n.published !== false && !readNoticeIds.includes(n.id));
    const body = [];
    if (tab === "notice") {
        if (notices.filter((n) => n.published !== false).length === 0) {
            body.push(React.createElement(EmptyState, { key: "empty", text: "এখনও কোনো নোটিশ নেই।" }));
        }
        else {
            notices.filter((n) => n.published !== false).forEach((n) => body.push(React.createElement("div", { key: n.id, style: Object.assign(Object.assign({}, admStyles.card), { borderLeft: readNoticeIds.includes(n.id) ? undefined : "3px solid var(--hk-gold)" }), onClick: () => onMarkNoticeRead(n.id) },
                React.createElement("div", { style: { fontWeight: 600 } }, n.title),
                n.content && React.createElement("div", { style: Object.assign(Object.assign({}, admStyles.muted), { marginTop: 3 }) }, n.content))));
        }
    }
    else if (tab === "daily") {
        body.push(React.createElement("div", { key: "markall", style: { display: "flex", justifyContent: "flex-end", marginBottom: 8 } }, React.createElement("button", { style: { fontSize: 12, color: "var(--hk-gold)", background: "none", border: "none" }, onClick: onMarkAllRead }, "\u2713\u2713 সব পঠিত")));
        if (visibleMessages.length === 0) {
            body.push(React.createElement(EmptyState, { key: "empty", text: "আজকের কোনো দৈনিক বার্তা নেই।" }));
        }
        else {
            visibleMessages.forEach((m) => body.push(React.createElement("div", { key: m.id, style: Object.assign(Object.assign({}, admStyles.card), { borderLeft: readDailyMessageIds.includes(m.id) ? undefined : "3px solid var(--hk-gold)" }) },
                React.createElement("div", { style: admStyles.row },
                    React.createElement("div", { onClick: () => onMarkDailyMessageRead(m.id), style: { flex: 1 } },
                        React.createElement("div", { style: { fontWeight: 600 } }, m.title),
                        m.content && React.createElement("div", { style: Object.assign(Object.assign({}, admStyles.muted), { marginTop: 3 }) }, m.content)),
                    React.createElement("button", { style: admStyles.iconBtn, onClick: () => onDismissDailyMessage(m.id) }, "\u2715")))));
        }
    }
    else {
        if (reminders.length === 0) {
            body.push(React.createElement(EmptyState, { key: "empty", text: "কোনো রিমাইন্ডার নেই।" }));
        }
        else {
            reminders.forEach((r) => body.push(React.createElement("div", { key: r.id, style: admStyles.card },
                React.createElement("div", { style: admStyles.row },
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontWeight: 600 } }, r.label),
                        React.createElement("div", { style: admStyles.muted }, r.source)),
                    React.createElement("div", { style: { fontSize: 12.5, fontWeight: 600 } }, formatDateBn(r.date).full)))));
        }
    }
    return React.createElement(ModalShell, { onClose: onClose, fullScreen: true, title: "\u09A8\u09CB\u099F\u09BF\u09AB\u09BF\u0995\u09C7\u09B6\u09A8" },
        React.createElement("div", { style: admStyles.subTabs },
            React.createElement("button", { style: admStyles.subTabBtn(tab === "notice"), onClick: () => setTab("notice") }, "\u09A8\u09CB\u099F\u09BF\u09B6", unreadNotices.length > 0 ? ` (${unreadNotices.length})` : ""),
            React.createElement("button", { style: admStyles.subTabBtn(tab === "daily"), onClick: () => setTab("daily") }, "\u09A6\u09C8\u09A8\u09BF\u0995 \u09AC\u09BE\u09B0\u09CD\u09A4\u09BE"),
            React.createElement("button", { style: admStyles.subTabBtn(tab === "reminder"), onClick: () => setTab("reminder") }, "\u09B0\u09BF\u09AE\u09BE\u0987\u09A8\u09CD\u09A1\u09BE\u09B0")),
        ...body);
}
/* ---------------- calendar modal ---------------- */
function isAyyamAlBid(date) {
    const h = gregorianToHijri(date);
    return h.day === 13 || h.day === 14 || h.day === 15;
}
function CalendarModal({ specialDays, onSaveSpecialDays, onClose, onRegisterBackHandler, adminSpecialDays }) {
    const [viewDate, setViewDate] = useState(() => {
        const n = new Date();
        return new Date(n.getFullYear(), n.getMonth(), 1);
    });
    const [selectedDate, setSelectedDate] = useState(null); // dateStr or null — set by tapping a DATE CELL in the grid; shows every special day that falls on that date
    const [selectedEntry, setSelectedEntry] = useState(null); // { dateStr, title, isAdmin } or null — set by tapping ONE row in the below-calendar list; shows just that single entry, never the whole date's group
    const [newLabel, setNewLabel] = useState("");
    // admin-managed global special days, indexed by date — view-only for
    // everyone here (managed exclusively from the Admin Panel), kept
    // entirely separate from the user's own specialDays object so nothing
    // here can accidentally edit or delete an admin entry
    const adminByDate = useMemo(() => {
        const map = {};
        const gY = viewDate.getFullYear(), gM = viewDate.getMonth() + 1;
        (adminSpecialDays || []).forEach((s) => {
            // fixed entries: only keep them if they fall in the month currently
            // shown (matches old behaviour, which just keyed by s.date directly);
            // recurring Hijri entries: recompute which date (if any) in THIS
            // shown Gregorian month matches, live, every time the month changes
            const dateStr = resolveSpecialDayInMonth(s, gY, gM);
            if (!dateStr)
                return;
            if (!map[dateStr])
                map[dateStr] = [];
            map[dateStr].push(s);
        });
        return map;
    }, [adminSpecialDays, viewDate]);
    // list of this month's special days shown directly under the calendar
    // grid — reuses the exact same specialDays/adminByDate data the dot
    // markers and the tap-a-date detail view already use, just rendered as
    // a visible list instead of requiring a tap first.
    const monthSpecialEntries = useMemo(() => {
        const y2 = viewDate.getFullYear();
        const m2 = viewDate.getMonth();
        const daysInM = new Date(y2, m2 + 1, 0).getDate();
        const entries = [];
        for (let d = 1; d <= daysInM; d++) {
            const dateStr = todayStr(new Date(y2, m2, d));
            (specialDays[dateStr] || []).forEach((label) => entries.push({ dateStr, day: d, title: label, isAdmin: false }));
            (adminByDate[dateStr] || []).forEach((s) => entries.push({ dateStr, day: d, title: s.title, isAdmin: true }));
        }
        return entries;
    }, [viewDate, specialDays, adminByDate]);
    // let App's hardware-back handler know: if the nested special-day detail
    // view is open, a back-press should close just that (return to the
    // calendar grid, same month/selection) — not the whole calendar
    useEffect(() => {
        if (!onRegisterBackHandler)
            return;
        onRegisterBackHandler(() => {
            if (selectedEntry) {
                setSelectedEntry(null);
                return true;
            }
            if (selectedDate) {
                setSelectedDate(null);
                return true;
            }
            return false;
        });
        return () => onRegisterBackHandler(null);
    }, [selectedDate, selectedEntry, onRegisterBackHandler]);
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
    if (selectedEntry) {
        const bn = formatDateBn(selectedEntry.dateStr);
        return (React.createElement(ModalShell, { title: "\u09AC\u09BF\u09B6\u09C7\u09B7 \u09A6\u09BF\u09A8", fullScreen: true, onClose: () => setSelectedEntry(null) },
            React.createElement("button", { style: styles.calBackBtn, onClick: () => setSelectedEntry(null) }, "\u2039 \u0995\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09A1\u09BE\u09B0\u09C7 \u09AB\u09BF\u09B0\u09C1\u09A8"),
            React.createElement("div", { style: styles.calDayDetailCard },
                React.createElement("div", { style: styles.calDayDetailDate },
                    bn.weekday,
                    ", ",
                    bn.full),
                React.createElement("div", { style: { marginTop: 10, fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 } },
                    React.createElement("i", { style: Object.assign(Object.assign({}, styles.legendDot), { background: selectedEntry.isAdmin ? "#E8C547" : "var(--hk-gold)" }) }),
                    selectedEntry.title))));
    }
    if (selectedDate) {
        const d = new Date(selectedDate + "T00:00:00");
        const bn = formatDateBn(selectedDate);
        const bangla = gregorianToBangla(d);
        const hijri = gregorianToHijri(d);
        const labels = specialDays[selectedDate] || [];
        const adminDays = adminByDate[selectedDate] || [];
        return (React.createElement(ModalShell, { title: "\u09AC\u09BF\u09B6\u09C7\u09B7 \u09A6\u09BF\u09A8", fullScreen: true, onClose: () => setSelectedDate(null) },
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
            adminDays.length > 0 && (React.createElement("div", { style: { marginBottom: 14 } },
                React.createElement("div", { style: styles.formLabel }, "\u2B50 \u09AC\u09BF\u09B6\u09C7\u09B7 \u09A6\u09BF\u09AC\u09B8 (\u098F\u09A1\u09AE\u09BF\u09A8)"),
                adminDays.map((s) => React.createElement("div", { key: s.id, style: Object.assign(Object.assign({}, styles.calSpecialEditRow), { alignItems: "flex-start" }) },
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontWeight: 600 } }, s.title),
                        s.description && React.createElement("div", { style: { fontSize: 12, color: "var(--hk-text-muted)", marginTop: 2 } }, s.description)))))),
            React.createElement("div", { style: styles.formLabel }, "\u09AC\u09BF\u09B6\u09C7\u09B7 \u09A6\u09BF\u09A8\u09C7\u09B0 \u09A4\u09BE\u09B2\u09BF\u0995\u09BE"),
            labels.length === 0 ? (React.createElement("div", { style: styles.taskEmpty }, "\u098F\u0987 \u09A4\u09BE\u09B0\u09BF\u0996\u09C7 \u098F\u0996\u09A8\u09CB \u0995\u09CB\u09A8\u09CB \u09AC\u09BF\u09B6\u09C7\u09B7 \u09A6\u09BF\u09A8 \u09AF\u09CB\u0997 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09A8\u09BF\u0964")) : (React.createElement("div", { style: { marginBottom: 10 } }, labels.map((label, idx) => (React.createElement("div", { key: idx, style: styles.calSpecialEditRow },
                React.createElement("span", null, label),
                React.createElement("button", { style: styles.taskDelete, onClick: () => removeLabel(idx) }, "\u2715")))))),
            React.createElement("div", { style: styles.taskAddRow },
                React.createElement("input", { style: styles.taskInput, placeholder: "\u09AF\u09C7\u09AE\u09A8: \u09AE\u09C1\u09B9\u09BE\u09AE\u09CD\u09AE\u09A6 \u09B8\u09BE\u0983 \u098F\u09B0 \u09AA\u09CD\u09B0\u09A5\u09AE \u09B9\u09BF\u099C\u09B0\u09A4", value: newLabel, onChange: (e) => setNewLabel(e.target.value), onKeyDown: (e) => e.key === "Enter" && addLabel() }),
                React.createElement("button", { style: styles.taskAddBtn, onClick: addLabel }, "+"))));
    }
    return (React.createElement(ModalShell, { title: "\u0995\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09A1\u09BE\u09B0", fullScreen: true, onClose: onClose },
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
                const adminDays = adminByDate[dateStr];
                const dotTitle = [...(labels || []), ...(adminDays || []).map((s) => s.title)].join(", ");
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
                    labels && labels.length > 0 ? React.createElement("div", { style: styles.calSpecialDot, title: dotTitle }) : (adminDays && adminDays.length > 0 && React.createElement("div", { style: Object.assign(Object.assign({}, styles.calSpecialDot), { background: "#E8C547" }), title: dotTitle }))));
            }))),
        React.createElement("div", { style: { margin: "12px 0" } },
            React.createElement("div", { style: styles.formLabel }, "\u098F\u0987 \u09AE\u09BE\u09B8\u09C7\u09B0 \u09AC\u09BF\u09B6\u09C7\u09B7 \u09A6\u09BF\u09AC\u09B8"),
            monthSpecialEntries.length === 0
                ? React.createElement("div", { style: styles.taskEmpty }, "\u098F\u0987 \u09AE\u09BE\u09B8\u09C7 \u0995\u09CB\u09A8\u09CB \u09AC\u09BF\u09B6\u09C7\u09B7 \u09A6\u09BF\u09A8 \u09AF\u09CB\u0997 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09A8\u09BF\u0964")
                : React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, monthSpecialEntries.map((e, i) => React.createElement("button", { key: i, onClick: () => setSelectedEntry(e), style: Object.assign(Object.assign({}, styles.calSpecialEditRow), { width: "100%", textAlign: "left", background: "var(--hk-card)", border: "none", cursor: "pointer" }) },
                    React.createElement("span", { style: { display: "flex", alignItems: "center", gap: 8 } },
                        React.createElement("i", { style: Object.assign(Object.assign({}, styles.legendDot), { background: e.isAdmin ? "#E8C547" : "var(--hk-gold)" }) }),
                        e.title),
                    React.createElement("span", { style: { fontSize: 11.5, color: "var(--hk-text-muted)" } }, toBnDigits(e.day)))))),
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
