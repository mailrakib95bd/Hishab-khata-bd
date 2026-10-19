// ট্যাক্স — ট্যাক্স ফর্ম ও প্যানেল
//
// app.js থেকে আলাদা করা অংশ। এটি সাধারণ <script> (module নয়), তাই app.js-এর সব
// global (styles, Icon, ModalShell, formatTaka, useState …) এখানেও সরাসরি ব্যবহার করা
// যায় — সেগুলো শুধু কল হওয়ার সময় লাগে, লোডের সময় নয়।
// লোড ক্রম (index.html): styles.js → admin.js → debts.js → tax.js → settings.js →
//   calendar-tasks.js → reports-search.js → app.js (সবার শেষে; ওটাই <App/> রেন্ডার করে)
// এই ফাইলের কম্পোনেন্ট: TaxForm, TaxPanel
"use strict";

/* ---------------- tax management ---------------- */
function TaxForm({ initial, onClose, onSave }) {
    // same category source Admin Task Management uses (cats.expenseCats) —
    // reused as-is, not a new/duplicate list. TaxPanel/TaxForm isn't
    // admin-gated, so this is available to admin and regular users alike.
    // Time/reminder/repeat fields below reuse the exact same
    // TASK_REMINDER_PRESETS / TASK_REPEAT_OPTIONS / computeTaskReminderFields
    // the (Admin) Task forms use — same coding, not a second copy — so a
    // tax due date reminds you exactly the same way a task does.
    const cats = useCategories();
    const [name, setName] = useState((initial === null || initial === void 0 ? void 0 : initial.name) || "");
    const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
    const [category, setCategory] = useState((initial === null || initial === void 0 ? void 0 : initial.category) || "");
    const [dueDate, setDueDate] = useState((initial === null || initial === void 0 ? void 0 : initial.dueDate) || todayStr());
    const [time, setTime] = useState((initial === null || initial === void 0 ? void 0 : initial.time) || "");
    const [note, setNote] = useState((initial === null || initial === void 0 ? void 0 : initial.note) || "");
    const [repeat, setRepeat] = useState((initial === null || initial === void 0 ? void 0 : initial.repeat) || "none");
    const [reminderPreset, setReminderPreset] = useState((initial === null || initial === void 0 ? void 0 : initial.reminderDate) ? "custom" : "none");
    const [customReminderDate, setCustomReminderDate] = useState((initial === null || initial === void 0 ? void 0 : initial.reminderDate) || "");
    const [customReminderTime, setCustomReminderTime] = useState((initial === null || initial === void 0 ? void 0 : initial.reminderTime) || "");
    const [err, setErr] = useState("");
    return (React.createElement(ModalShell, { onClose: onClose, fullScreen: true, title: initial ? "ট্যাক্স সম্পাদনা" : "নতুন ট্যাক্স" },
        React.createElement("label", { style: admStyles.label }, "ট্যাক্সের নাম *"),
        React.createElement("input", { style: admStyles.input, value: name, onChange: (e) => setName(e.target.value) }),
        React.createElement("label", { style: admStyles.label }, "পরিমাণ *"),
        React.createElement("input", { style: admStyles.input, type: "number", inputMode: "decimal", value: amount, onChange: (e) => setAmount(e.target.value) }),
        React.createElement("label", { style: admStyles.label }, "সাব-ক্যাটেগরি"),
        React.createElement("select", { style: admStyles.input, value: category, onChange: (e) => setCategory(e.target.value) },
            React.createElement("option", { value: "" }, "— নির্বাচন করুন —"),
            (cats.expenseCats || []).map((c) => React.createElement("option", { key: c.key, value: c.key }, c.label))),
        React.createElement("div", { style: { display: "flex", gap: 8 } },
            React.createElement("div", { style: { flex: 1 } },
                React.createElement("label", { style: admStyles.label }, "পরিশোধের শেষ তারিখ"),
                React.createElement("input", { style: admStyles.input, type: "date", value: dueDate, onChange: (e) => setDueDate(e.target.value) })),
            React.createElement("div", { style: { flex: 1 } },
                React.createElement("label", { style: admStyles.label }, "সময়"),
                React.createElement("input", { style: admStyles.input, type: "time", value: time, onChange: (e) => setTime(e.target.value) }))),
        React.createElement("label", { style: admStyles.label }, "নোট / বিস্তারিত"),
        React.createElement("input", { style: admStyles.input, value: note, onChange: (e) => setNote(e.target.value) }),
        React.createElement("label", { style: admStyles.label }, "রিমাইন্ডার"),
        React.createElement("select", { style: admStyles.input, value: reminderPreset, onChange: (e) => setReminderPreset(e.target.value) }, TASK_REMINDER_PRESETS.map((p) => React.createElement("option", { key: p.key, value: p.key }, p.label))),
        reminderPreset === "custom" && React.createElement("div", { style: { display: "flex", gap: 8 } },
            React.createElement("input", { style: Object.assign({}, admStyles.input, { flex: 1 }), type: "date", value: customReminderDate, onChange: (e) => setCustomReminderDate(e.target.value) }),
            React.createElement("input", { style: Object.assign({}, admStyles.input, { flex: 1 }), type: "time", value: customReminderTime, onChange: (e) => setCustomReminderTime(e.target.value) })),
        React.createElement("label", { style: admStyles.label }, "রিপিট"),
        React.createElement("select", { style: admStyles.input, value: repeat, onChange: (e) => setRepeat(e.target.value) }, TASK_REPEAT_OPTIONS.map((r) => React.createElement("option", { key: r.key, value: r.key }, r.label))),
        err && React.createElement("div", { style: { color: "var(--hk-danger)", fontSize: 12.5, marginBottom: 8 } }, err),
        React.createElement("button", { style: admStyles.addBtn, onClick: () => {
                const amt = parseFloat(amount);
                if (!name.trim() || !amt || amt <= 0) {
                    setErr("নাম ও সঠিক পরিমাণ দিন");
                    return;
                }
                const { reminderDate, reminderTime } = computeTaskReminderFields(dueDate, time, reminderPreset, customReminderDate, customReminderTime);
                onSave({ name: name.trim(), amount: amt, category: category || null, dueDate, time: time || null, note: note.trim(), repeat: repeat === "none" ? null : repeat, reminderDate, reminderTime });
            } }, "সংরক্ষণ করুন")));
}

function TaxPanel({ onClose, taxes, onAdd, onUpdate, onDelete, onTogglePaid }) {
    const cats = useCategories();
    const catLabel = (key) => { var _a; return key && ((_a = (cats.expenseCats || []).find((c) => c.key === key)) === null || _a === void 0 ? void 0 : _a.label); };
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [showPaidSection, setShowPaidSection] = useState(false);
    useBackOverlay(showForm, () => setShowForm(false));
    const today = todayStr();
    // once a tax is marked paid, it moves out of the active list entirely —
    // it does not keep sitting there after being completed. It's not
    // deleted outright though: it collapses into a "পরিশোধিত" section the
    // user can open if they want to review/undo, so completing one of many
    // admin-assigned taxes doesn't just pile up forever in the main view.
    const unpaid = taxes.filter((t) => !t.paid).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
    const paid = taxes.filter((t) => t.paid);
    const totalUnpaid = unpaid.reduce((s, t) => s + t.amount, 0);
    const taxRow = (t) => {
        const overdue = !t.paid && t.dueDate && t.dueDate < today;
        return React.createElement("div", { key: t.id, style: admStyles.card },
            React.createElement("div", { style: admStyles.row },
                React.createElement("div", null,
                    React.createElement("div", { style: { fontWeight: 600 } }, t.name, t.paid && React.createElement("span", { style: { fontSize: 11, color: "var(--hk-success)", marginLeft: 6 } }, "\u2713 \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7\u09BF\u09A4")),
                    t.dueDate && React.createElement("div", { style: Object.assign(Object.assign({}, admStyles.muted), overdue ? { color: "var(--hk-danger)" } : {}) }, "শেষ তারিখ: ", formatDateBn(t.dueDate).full, t.time ? ` ${t.time}` : "", overdue ? " (মেয়াদোত্তীর্ণ)" : ""),
                    catLabel(t.category) && React.createElement("div", { style: admStyles.muted }, catLabel(t.category)),
                    (t.reminderDate || t.repeat) && React.createElement("div", { style: { fontSize: 11, color: "var(--hk-text-muted)" } }, [t.reminderDate ? "🔔 রিমাইন্ডার সেট করা আছে" : null, t.repeat ? (TASK_REPEAT_OPTIONS.find((r) => r.key === t.repeat) || {}).label : null].filter(Boolean).join(" • ")),
                    React.createElement("div", { style: { fontWeight: 600, marginTop: 3 } }, formatTaka(t.amount))),
                React.createElement("div", { style: { display: "flex", gap: 2, alignItems: "flex-start" } },
                    React.createElement("button", { style: admStyles.iconBtn, onClick: () => onTogglePaid(t.id) }, t.paid ? "\u21BA" : "\u2713"),
                    React.createElement("button", { style: admStyles.iconBtn, onClick: () => { setEditing(t); setShowForm(true); } }, React.createElement(Icon, { name: "edit", size: 14 })),
                    deleteConfirmId === t.id
                        ? React.createElement("button", { style: admStyles.confirmBtn, onClick: () => { onDelete(t.id); setDeleteConfirmId(null); } }, "নিশ্চিত?")
                        : React.createElement("button", { style: admStyles.iconBtn, onClick: () => setDeleteConfirmId(t.id) }, React.createElement(Icon, { name: "delete", size: 14 })))));
    };
    const body = [
        React.createElement("button", { key: "add", style: admStyles.addBtn, onClick: () => { setEditing(null); setShowForm(true); } }, "+ নতুন ট্যাক্স যোগ করুন"),
    ];
    if (unpaid.length === 0) {
        body.push(React.createElement(EmptyState, { key: "empty", text: "কোনো অপরিশোধিত ট্যাক্স নেই।" }));
    }
    else {
        unpaid.forEach((t) => body.push(taxRow(t)));
        body.push(React.createElement("div", { key: "totals", style: admStyles.totalsBar },
            React.createElement("span", null, "মোট অপরিশোধিত"),
            React.createElement("strong", null, formatTaka(totalUnpaid))));
    }
    if (paid.length > 0) {
        body.push(React.createElement("button", { key: "paidToggle", style: { fontSize: 12, color: "var(--hk-text-muted)", background: "none", border: "none", marginTop: 14, textDecoration: "underline" }, onClick: () => setShowPaidSection((v) => !v) }, `${showPaidSection ? "লুকান" : "দেখুন"} — পরিশোধিত (${toBnDigits(paid.length)})`));
        if (showPaidSection) {
            paid.forEach((t) => body.push(taxRow(t)));
        }
    }
    if (showForm) {
        body.push(React.createElement(TaxForm, { key: "form", initial: editing, onClose: () => setShowForm(false), onSave: (data) => { editing ? onUpdate(editing.id, data) : onAdd(data); setShowForm(false); } }));
    }
    return React.createElement(ModalShell, { onClose: onClose, fullScreen: true, title: "\u099F\u09CD\u09AF\u09BE\u0995\u09CD\u09B8 \u09AC\u09CD\u09AF\u09AC\u09B8\u09CD\u09A5\u09BE\u09AA\u09A8\u09BE" }, ...body);
}
