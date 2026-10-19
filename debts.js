// দেনা-পাওনা ও ট্রান্সফার — তালিকা, ফর্ম, বিস্তারিত, ট্রান্সফার ইতিহাস
//
// app.js থেকে আলাদা করা অংশ। এটি সাধারণ <script> (module নয়), তাই app.js-এর সব
// global (styles, Icon, ModalShell, formatTaka, useState …) এখানেও সরাসরি ব্যবহার করা
// যায় — সেগুলো শুধু কল হওয়ার সময় লাগে, লোডের সময় নয়।
// লোড ক্রম (index.html): styles.js → admin.js → debts.js → tax.js → settings.js →
//   calendar-tasks.js → reports-search.js → app.js (সবার শেষে; ওটাই <App/> রেন্ডার করে)
// এই ফাইলের কম্পোনেন্ট: DebtsView, DebtForm, DebtDetail, TransferForm, TransferHistoryModal
"use strict";

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
function DebtDetail({ debt, onClose, onUpdate, onDelete, onAddRepayment, onUpdateRepayment, onDeleteRepayment, onRegisterBackHandler, userAccounts, checkRepaymentBalance, checkDynamicRepaymentBalance }) {
    const [showEdit, setShowEdit] = useState(false);
    const [showRepay, setShowRepay] = useState(false);
    const [repayAmount, setRepayAmount] = useState("");
    const [repayDate, setRepayDate] = useState(todayStr());
    const [repayTime, setRepayTime] = useState(nowTimeStr());
    const [repayNote, setRepayNote] = useState("");
    const [repayMethod, setRepayMethod] = useState("m:cash");
    const [repayErr, setRepayErr] = useState("");
    const [editingRepaymentId, setEditingRepaymentId] = useState(null);
    const [repayDeleteConfirmId, setRepayDeleteConfirmId] = useState(null);
    const [showStatement, setShowStatement] = useState(false);
    // let App's hardware-back handler know: if the edit-form, repayment
    // form, or statement view has replaced this detail view, a back-press
    // should return to the detail view (not close the whole debt entry)
    useEffect(() => {
        if (!onRegisterBackHandler)
            return;
        onRegisterBackHandler(() => {
            if (showStatement) {
                setShowStatement(false);
                return true;
            }
            if (showRepay) {
                setShowRepay(false);
                return true;
            }
            if (showEdit) {
                setShowEdit(false);
                return true;
            }
            return false;
        });
        return () => onRegisterBackHandler(null);
    }, [showEdit, showRepay, showStatement, onRegisterBackHandler]);
    const remaining = debtRemaining(debt);
    const status = debtStatus(debt);
    const paidTotal = debt.amount - remaining;
    const startEditRepayment = (r) => {
        setEditingRepaymentId(r.id);
        setRepayAmount(String(r.amount));
        setRepayDate(r.date);
        setRepayTime(r.time || nowTimeStr());
        setRepayNote(r.note || "");
        setRepayMethod(r.accountId ? `a:${r.accountId}` : `m:${r.method || "cash"}`);
        setShowRepay(true);
    };
    const cancelRepayForm = () => {
        setShowRepay(false);
        setEditingRepaymentId(null);
        setRepayAmount("");
        setRepayNote("");
        setRepayMethod("m:cash");
        setRepayErr("");
    };
    const submitRepay = () => {
        const num = parseFloat(repayAmount);
        if (!num || num <= 0) {
            setRepayErr("সঠিক পরিমাণ লিখুন");
            return;
        }
        // editing replaces the old repayment rather than adding to it, so
        // the ceiling is "remaining as if this repayment didn't exist yet" —
        // otherwise editing a repayment down would wrongly seem to free up
        // room it already had, and editing it up would wrongly seem blocked
        // by its own old amount
        const oldAmount = editingRepaymentId ? ((debt.repayments.find((r) => r.id === editingRepaymentId) || {}).amount || 0) : 0;
        const ceiling = remaining + oldAmount;
        if (num > ceiling) {
            setRepayErr(`অবশিষ্ট (${formatTaka(ceiling)}) এর বেশি লেখা যাবে না`);
            return;
        }
        // same "m:"/"a:" prefixed-selector convention as TransferForm — one
        // dropdown, either a legacy method or a dynamic account, never both
        const isAcct = repayMethod.startsWith("a:");
        const method = isAcct ? null : repayMethod.slice(2);
        const accountId = isAcct ? repayMethod.slice(2) : null;
        // payable repayments spend real money — check the source actually
        // has it, excluding this repayment's own old effect when editing.
        // receivable repayments (collecting money) are never blocked.
        if (isAcct) {
            if (checkDynamicRepaymentBalance && !checkDynamicRepaymentBalance(debt.type, accountId, num, debt.id, editingRepaymentId)) {
                setRepayErr("⚠️ এই অ্যাকাউন্টে এত টাকা নেই");
                return;
            }
        }
        else if (checkRepaymentBalance && !checkRepaymentBalance(debt.type, method, num, editingRepaymentId)) {
            setRepayErr("⚠️ এই মাধ্যমে এত টাকা নেই");
            return;
        }
        const payload = { amount: num, date: repayDate, time: repayTime || null, note: repayNote.trim(), method, accountId };
        if (editingRepaymentId) {
            onUpdateRepayment(editingRepaymentId, payload);
        }
        else {
            onAddRepayment(payload);
        }
        cancelRepayForm();
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
        // remaining balance shown per repayment row — always recomputed
        // fresh from debt.amount and the full repayments array on every
        // render (never stored/cached), so editing or deleting any past
        // repayment instantly and correctly recalculates every later row —
        // there is no stale/incorrect balance state to go out of sync.
        debt.repayments.length === 0 ? (React.createElement("div", { style: styles.taskEmpty }, "\u098F\u0996\u09A8\u09CB \u0995\u09CB\u09A8\u09CB \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7 \u09AF\u09CB\u0997 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09A8\u09BF\u0964")) : (React.createElement("div", { style: { marginBottom: 10 } }, (() => {
            const asc = [...debt.repayments].sort((a, b) => a.date === b.date ? (a.createdAt || 0) - (b.createdAt || 0) : (a.date < b.date ? -1 : 1));
            let cumulative = 0;
            const withRemaining = asc.map((r) => {
                cumulative += r.amount;
                return Object.assign(Object.assign({}, r), { remainingAfter: debt.amount - cumulative });
            });
            const desc = [...withRemaining].sort((a, b) => a.date === b.date ? (b.createdAt || 0) - (a.createdAt || 0) : (a.date < b.date ? 1 : -1));
            return desc.map((r) => (React.createElement("div", { key: r.id, style: styles.calSpecialEditRow },
                React.createElement("div", null,
                    React.createElement("div", null,
                        formatDateBn(r.date).full,
                        r.time ? `, ${formatTimeBn(r.time)}` : "",
                        " \u2014 ",
                        formatTaka(r.amount),
                        (r.accountId || r.method) ? ` · ${r.accountId ? ((userAccounts || []).find((a) => a.id === r.accountId) || {}).name || "মুছে ফেলা অ্যাকাউন্ট" : methodLabel(r.method)}` : "",
                        r.note ? ` (${r.note})` : ""),
                    React.createElement("div", { style: { fontSize: 11.5, color: "var(--hk-text-muted)", marginTop: 2 } }, "\u098F\u0987 \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7\u09C7\u09B0 \u09AA\u09B0 \u0985\u09AC\u09B6\u09BF\u09B7\u09CD\u099F: ", formatTaka(r.remainingAfter))),
                React.createElement("div", { style: { display: "flex", gap: 4 } },
                    React.createElement("button", { style: styles.taskDelete, onClick: () => startEditRepayment(r) }, React.createElement(Icon, { name: "edit", size: 13 })),
                    repayDeleteConfirmId === r.id
                        ? React.createElement("button", { style: Object.assign(Object.assign({}, styles.taskDelete), { color: "var(--hk-danger)", fontWeight: 700 }), onClick: () => { onDeleteRepayment(r.id); setRepayDeleteConfirmId(null); } }, "\u09A8\u09BF\u09B6\u09CD\u099A\u09BF\u09A4?")
                        : React.createElement("button", { style: styles.taskDelete, onClick: () => setRepayDeleteConfirmId(r.id) }, "\u2715")))));
        })())),
        remaining > 0 && !showRepay && (React.createElement("button", { style: styles.saveBtn, onClick: () => setShowRepay(true) }, "+ \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7 \u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8")),
        showRepay && (React.createElement("div", { style: { marginTop: 8 } },
            React.createElement("div", { style: { fontWeight: 600, marginBottom: 6 } }, editingRepaymentId ? "\u09AA\u09B0\u09BF\u09B6\u09CB\u09A7 \u09B8\u09AE\u09CD\u09AA\u09BE\u09A6\u09A8\u09BE" : "\u09A8\u09A4\u09C1\u09A8 \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7"),
            React.createElement("div", { style: styles.amountWrap },
                React.createElement("span", { style: styles.amountSign }, "\u09F3"),
                React.createElement("input", { style: styles.amountInput, type: "number", inputMode: "decimal", placeholder: "\u09E6", value: repayAmount, onChange: (e) => setRepayAmount(e.target.value) })),
            React.createElement("div", { style: styles.filterRow },
                React.createElement("input", { style: styles.textInput, type: "date", value: repayDate, max: todayStr(), onChange: (e) => setRepayDate(e.target.value) }),
                React.createElement("input", { style: styles.textInput, type: "time", value: repayTime, onChange: (e) => setRepayTime(e.target.value) })),
            React.createElement("input", { style: styles.textInput, type: "text", placeholder: "\u09A8\u09CB\u099F (\u0990\u099A\u09CD\u099B\u09BF\u0995)", value: repayNote, onChange: (e) => setRepayNote(e.target.value) }),
            React.createElement("div", { style: styles.formLabel }, debt.type === "receivable" ? "\u0995\u09CB\u09A8 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F\u09C7 \u099C\u09AE\u09BE \u09B9\u09B2\u09CB" : "\u0995\u09CB\u09A8 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09A5\u09C7\u0995\u09C7 \u09A6\u09C7\u0993\u09AF\u09BC\u09BE \u09B9\u09B2\u09CB"),
            React.createElement("select", { style: styles.textInput, value: repayMethod, onChange: (e) => setRepayMethod(e.target.value) },
                React.createElement("optgroup", { label: "\u09AE\u09BE\u09A7\u09CD\u09AF\u09AE" }, METHODS.map((m) => React.createElement("option", { key: `m:${m.key}`, value: `m:${m.key}` }, m.label))),
                (userAccounts || []).filter((a) => a.active !== false).length > 0 && React.createElement("optgroup", { label: "\u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F" }, (userAccounts || []).filter((a) => a.active !== false).map((a) => React.createElement("option", { key: `a:${a.id}`, value: `a:${a.id}` }, a.name)))),
            repayErr ? React.createElement("div", { style: styles.formErr }, repayErr) : null,
            React.createElement("div", { style: styles.formActions },
                React.createElement("button", { style: styles.deleteBtn, onClick: cancelRepayForm }, "\u09AC\u09BE\u09A4\u09BF\u09B2"),
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
function TransferForm({ initial, onClose, onSave, onDelete, onCheckBalance, onCheckDynamicBalance, userAccounts }) {
    // combined selector values are prefixed so one dropdown can offer both
    // systems without ambiguity: "m:cash" = legacy method, "a:<id>" =
    // dynamic account. Defaults match the old cash→bank default exactly,
    // so anyone not using dynamic accounts sees no behavior change at all.
    // Editing seeds from whichever side each field actually used —
    // accountId takes precedence when present, exactly mirroring how
    // TransferHistoryModal decides which label to show.
    const activeAccounts = (userAccounts || []).filter((a) => a.active !== false);
    const selFor = (accId, method, fallback) => accId ? `a:${accId}` : method ? `m:${method}` : fallback;
    const [fromSel, setFromSel] = useState(() => selFor(initial === null || initial === void 0 ? void 0 : initial.fromAccountId, initial === null || initial === void 0 ? void 0 : initial.fromMethod, "m:cash"));
    const [toSel, setToSel] = useState(() => selFor(initial === null || initial === void 0 ? void 0 : initial.toAccountId, initial === null || initial === void 0 ? void 0 : initial.toMethod, "m:bank"));
    const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
    const [date, setDate] = useState((initial === null || initial === void 0 ? void 0 : initial.date) || todayStr());
    const [time, setTime] = useState((initial === null || initial === void 0 ? void 0 : initial.time) || nowTimeStr());
    const [note, setNote] = useState((initial === null || initial === void 0 ? void 0 : initial.note) || "");
    const [err, setErr] = useState("");
    const parseSel = (sel) => sel.startsWith("a:") ? { accountId: sel.slice(2) } : { method: sel.slice(2) };
    const selLabel = (sel) => {
        const p = parseSel(sel);
        if (p.accountId)
            return ((userAccounts || []).find((a) => a.id === p.accountId) || {}).name || p.accountId;
        return methodLabel(p.method);
    };
    const handleSave = () => {
        const num = parseFloat(amount);
        if (!num || num <= 0) {
            setErr("সঠিক পরিমাণ লিখুন");
            return;
        }
        if (fromSel === toSel) {
            setErr("উৎস ও গন্তব্য একই হতে পারবে না");
            return;
        }
        const from = parseSel(fromSel);
        const to = parseSel(toSel);
        // when editing, exclude THIS transfer's own old effect before
        // checking whether the (possibly changed) amount still fits —
        // otherwise its old debit would double-count against the new one
        const excludeId = (initial === null || initial === void 0 ? void 0 : initial.id) || null;
        if (from.accountId) {
            if (onCheckDynamicBalance && !onCheckDynamicBalance(from.accountId, num, excludeId)) {
                setErr(`⚠️ ${selLabel(fromSel)}-এ এত টাকা নেই`);
                return;
            }
        }
        else if (onCheckBalance && !onCheckBalance(from.method, num, excludeId)) {
            setErr(`⚠️ ${selLabel(fromSel)}-এ এত টাকা নেই`);
            return;
        }
        onSave({
            // legacy fields — null when that side is a dynamic account, so
            // computeAccountBalances (legacy) naturally skips it, never
            // double-counting alongside computeDynamicAccountBalances
            fromMethod: from.method || null,
            toMethod: to.method || null,
            fromAccountId: from.accountId || null,
            toAccountId: to.accountId || null,
            amount: num, date, time: time || null, note: note.trim(),
        });
    };
    return (React.createElement(ModalShell, { onClose: onClose, title: initial ? "\u09B8\u09CD\u09A5\u09BE\u09A8\u09BE\u09A8\u09CD\u09A4\u09B0 \u09B8\u09AE\u09CD\u09AA\u09BE\u09A6\u09A8\u09BE" : "\u099F\u09BE\u0995\u09BE \u09B8\u09CD\u09A5\u09BE\u09A8\u09BE\u09A8\u09CD\u09A4\u09B0" },
        React.createElement("div", { style: styles.transferRow },
            React.createElement("div", { style: { flex: 1 } },
                React.createElement("div", { style: styles.formLabel }, "\u09A5\u09C7\u0995\u09C7"),
                React.createElement("select", { style: styles.methodSelect, value: fromSel, onChange: (e) => setFromSel(e.target.value) },
                    React.createElement("optgroup", { label: "\u09AE\u09BE\u09A7\u09CD\u09AF\u09AE" }, METHODS.map((m) => (React.createElement("option", { key: `m:${m.key}`, value: `m:${m.key}` }, m.label)))),
                    activeAccounts.length > 0 && React.createElement("optgroup", { label: "\u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F" }, activeAccounts.map((a) => (React.createElement("option", { key: `a:${a.id}`, value: `a:${a.id}` }, a.name)))))),
            React.createElement("div", { style: styles.transferArrow }, "\u2192"),
            React.createElement("div", { style: { flex: 1 } },
                React.createElement("div", { style: styles.formLabel }, "\u098F"),
                React.createElement("select", { style: styles.methodSelect, value: toSel, onChange: (e) => setToSel(e.target.value) },
                    React.createElement("optgroup", { label: "\u09AE\u09BE\u09A7\u09CD\u09AF\u09AE" }, METHODS.map((m) => (React.createElement("option", { key: `m:${m.key}`, value: `m:${m.key}` }, m.label)))),
                    activeAccounts.length > 0 && React.createElement("optgroup", { label: "\u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F" }, activeAccounts.map((a) => (React.createElement("option", { key: `a:${a.id}`, value: `a:${a.id}` }, a.name))))))),
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
            onDelete ? React.createElement("button", { style: styles.deleteBtn, onClick: onDelete }, "\u09AE\u09C1\u099B\u09C7 \u09AB\u09C7\u09B2\u09C1\u09A8") : null,
            React.createElement("button", { style: styles.saveBtn, onClick: handleSave }, "\u09B8\u09CD\u09A5\u09BE\u09A8\u09BE\u09A8\u09CD\u09A4\u09B0 \u0995\u09B0\u09C1\u09A8"))));
}
function TransferHistoryModal({ transfers, onClose, onDelete, onEdit, userAccounts }) {
    const sorted = useMemo(() => [...transfers].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date < a.date ? -1 : 1)), [transfers]);
    // resolves either side of a transfer to a display label — a dynamic
    // account (by accountId) if the transfer used one, otherwise the
    // legacy method label exactly as before. Old transfers (no accountId
    // field at all) fall straight through to methodLabel, unaffected.
    const sideLabel = (tr, prefix) => {
        const accId = tr[`${prefix}AccountId`];
        if (accId) {
            const acc = (userAccounts || []).find((a) => a.id === accId);
            return acc ? acc.name : "মুছে ফেলা অ্যাকাউন্ট";
        }
        return methodLabel(tr[`${prefix}Method`]);
    };
    return (React.createElement(ModalShell, { onClose: onClose, title: "\u09B8\u09CD\u09A5\u09BE\u09A8\u09BE\u09A8\u09CD\u09A4\u09B0\u09C7\u09B0 \u0987\u09A4\u09BF\u09B9\u09BE\u09B8" }, sorted.length === 0 ? (React.createElement(EmptyState, { text: "\u098F\u0996\u09A8\u09CB \u0995\u09CB\u09A8\u09CB \u099F\u09BE\u0995\u09BE \u09B8\u09CD\u09A5\u09BE\u09A8\u09BE\u09A8\u09CD\u09A4\u09B0 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09A8\u09BF\u0964" })) : (React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, sorted.map((tr) => (React.createElement("div", { key: tr.id, style: styles.transferHistoryRow },
        React.createElement("div", { style: styles.transferMid },
            React.createElement("div", { style: styles.txCat },
                sideLabel(tr, "from"),
                " ",
                React.createElement("span", { style: { color: "var(--hk-label)" } }, "\u2192"),
                " ",
                sideLabel(tr, "to")),
            React.createElement("div", { style: styles.txMeta },
                formatDateBn(tr.date).full,
                tr.time ? `, ${formatTimeBn(tr.time)}` : "",
                tr.note ? ` · ${tr.note}` : "")),
        React.createElement("div", { style: { textAlign: "right" } },
            React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "var(--hk-text)" } }, formatTaka(tr.amount)),
            React.createElement("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 2 } },
                React.createElement("button", { style: styles.transferDeleteLink, onClick: () => onEdit(tr) }, "\u09B8\u09AE\u09CD\u09AA\u09BE\u09A6\u09A8\u09BE"),
                React.createElement("button", { style: styles.transferDeleteLink, onClick: () => onDelete(tr.id) }, "\u09AE\u09C1\u099B\u09C1\u09A8"))))))))));
}
