// সেটিংস — সেটিংস মোডাল, ক্যাটেগরি ম্যানেজার, মাসিক বাজেট
//
// app.js থেকে আলাদা করা অংশ। এটি সাধারণ <script> (module নয়), তাই app.js-এর সব
// global (styles, Icon, ModalShell, formatTaka, useState …) এখানেও সরাসরি ব্যবহার করা
// যায় — সেগুলো শুধু কল হওয়ার সময় লাগে, লোডের সময় নয়।
// লোড ক্রম (index.html): styles.js → admin.js → debts.js → tax.js → settings.js →
//   calendar-tasks.js → reports-search.js → app.js (সবার শেষে; ওটাই <App/> রেন্ডার করে)
// এই ফাইলের কম্পোনেন্ট: BudgetModal, SettingsSection, CategoryManager, SettingsModal
"use strict";

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
function CategoryManager({ type, list, transactions, onAdd, onUpdate, onDelete, onMigrate }) {
    const [newLabel, setNewLabel] = useState("");
    const [newIcon, setNewIcon] = useState(CAT_ICON_CHOICES[0]);
    const [editKey, setEditKey] = useState(null);
    const [editLabel, setEditLabel] = useState("");
    const [editIcon, setEditIcon] = useState("");
    const [safetyFor, setSafetyFor] = useState(null); // category key currently showing the delete-safety panel
    const [migrateTarget, setMigrateTarget] = useState("");
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
    // how many transactions currently use this category — the basis for
    // whether deleting needs the safety panel at all
    const usageCount = (key) => (transactions || []).filter((t) => t.type === type && t.category === key).length;
    const requestDelete = (c) => {
        if (usageCount(c.key) === 0) {
            onDelete(c.key); // nothing references it — safe to remove outright
            return;
        }
        setSafetyFor(c.key);
        setMigrateTarget("");
    };
    return (React.createElement("div", null,
        list.map((c) => {
            if (editKey === c.key) {
                return React.createElement("div", { key: c.key, style: styles.catEditRow },
                    React.createElement("select", { style: styles.catIconSelect, value: editIcon, onChange: (e) => setEditIcon(e.target.value) }, CAT_ICON_CHOICES.map((ic) => React.createElement("option", { key: ic, value: ic }, ic))),
                    React.createElement("input", { style: styles.catEditInput, value: editLabel, onChange: (e) => setEditLabel(e.target.value) }),
                    React.createElement("button", { style: styles.taskAddBtn, onClick: saveEdit }, "\u2713"),
                    React.createElement("button", { style: styles.taskDelete, onClick: () => setEditKey(null) }, "\u2715"));
            }
            if (safetyFor === c.key) {
                const otherCats = list.filter((o) => o.key !== c.key);
                return React.createElement("div", { key: c.key, style: Object.assign(Object.assign({}, styles.catManageRow), { flexDirection: "column", alignItems: "stretch", gap: 8 }) },
                    React.createElement("div", { style: { fontSize: 12.5 } }, `"${c.label}" ক্যাটেগরিতে ${toBnDigits(usageCount(c.key))}টি লেনদেন আছে। মুছে ফেললে সেগুলো অগোছালো হয়ে যেতে পারে — নিচের একটি নিরাপদ উপায় বেছে নিন:`),
                    React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
                        React.createElement("button", { style: styles.catManageBtn, onClick: () => { setSafetyFor(null); startEdit(c); } }, "\u09A8\u09BE\u09AE \u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8 (Rename)"),
                        React.createElement("button", { style: styles.catManageBtn, onClick: () => { onUpdate(c.key, { archived: true }); setSafetyFor(null); } }, "\u0986\u09B0\u09CD\u0995\u09BE\u0987\u09AD (Archive)"),
                        React.createElement("button", { style: styles.catManageBtn, onClick: () => setSafetyFor(`migrate-${c.key}`) }, "\u09B8\u09B0\u09BF\u09AF\u09BC\u09C7 \u09A8\u09BF\u09A8 (Migrate)"),
                        React.createElement("button", { style: styles.taskDelete, onClick: () => setSafetyFor(null) }, "\u09AC\u09BE\u09A4\u09BF\u09B2 (Cancel)")));
            }
            if (safetyFor === `migrate-${c.key}`) {
                const otherCats = list.filter((o) => o.key !== c.key);
                return React.createElement("div", { key: c.key, style: Object.assign(Object.assign({}, styles.catManageRow), { flexDirection: "column", alignItems: "stretch", gap: 8 }) },
                    React.createElement("div", { style: { fontSize: 12.5 } }, `"${c.label}"-এর ${toBnDigits(usageCount(c.key))}টি লেনদেন কোন ক্যাটেগরিতে যাবে?`),
                    React.createElement("select", { style: styles.catIconSelect, value: migrateTarget, onChange: (e) => setMigrateTarget(e.target.value) },
                        React.createElement("option", { value: "" }, "\u2014 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8 \u2014"),
                        otherCats.map((o) => React.createElement("option", { key: o.key, value: o.key }, o.label))),
                    React.createElement("div", { style: { display: "flex", gap: 6 } },
                        React.createElement("button", { style: styles.taskAddBtn, disabled: !migrateTarget, onClick: () => { onMigrate(c.key, migrateTarget); setSafetyFor(null); } }, "\u09A8\u09BF\u09B6\u09CD\u099A\u09BF\u09A4 \u2014 \u09B8\u09B0\u09BF\u09AF\u09BC\u09C7 \u09A8\u09BF\u09A8"),
                        React.createElement("button", { style: styles.taskDelete, onClick: () => setSafetyFor(c.key) }, "\u09AB\u09BF\u09B0\u09C7 \u09AF\u09BE\u09A8")));
            }
            return React.createElement("div", { key: c.key, style: styles.catManageRow },
                React.createElement("span", { style: { flex: 1, opacity: c.archived ? 0.55 : 1 } },
                    React.createElement(CategoryIcon, { catKey: c.key, emoji: c.icon, size: 15 }),
                    " ",
                    c.label,
                    c.archived && React.createElement("span", { style: { fontSize: 10.5, marginLeft: 6 } }, "(\u0986\u09B0\u09CD\u0995\u09BE\u0987\u09AD\u09A1)")),
                c.archived
                    ? React.createElement("button", { style: styles.catManageBtn, onClick: () => onUpdate(c.key, { archived: false }) }, "\u09AB\u09BF\u09B0\u09BF\u09AF\u09BC\u09C7 \u0986\u09A8\u09C1\u09A8")
                    : React.createElement("button", { style: styles.catManageBtn, onClick: () => startEdit(c) }, React.createElement(Icon, { name: "edit", size: 14 })),
                React.createElement("button", { style: styles.catManageBtn, onClick: () => requestDelete(c) }, React.createElement(Icon, { name: "delete", size: 14 })));
        }),
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
function SettingsModal({ transactions, budget, specialDays, onSaveSpecialDays, onClose, onEditBudget, onClearAll, accounts, accountOpening, onSaveAccountOpening, onAddCategory, onUpdateCategory, onDeleteCategory, onMigrateCategory, pin, onSavePin, onImportTransactions, theme, onSaveTheme, user, syncStatus, lastSyncedAt, onShowLogin, onLogout, onManualSync, onRestoreFromCloud, onPreviewCloudVsLocal, isOnline, pendingChanges, onExportJSON, onImportJSON, profileName, onSaveProfileName, autoSync, onSaveAutoSync, notificationPermission, onRequestNotificationPermission, auditLog, }) {
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
    const [showAuditLog, setShowAuditLog] = useState(false);
    const [pinStep1, setPinStep1] = useState("");
    const [pinErr, setPinErr] = useState("");
    // changing or disabling an existing PIN must prove knowledge of the
    // current one first — otherwise anyone who catches the app already
    // unlocked (past LockScreen) could strip the PIN for next time
    const [currentPinVerified, setCurrentPinVerified] = useState(false);
    const [currentPinInput, setCurrentPinInput] = useState("");
    const [currentPinErr, setCurrentPinErr] = useState("");
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
            setCurrentPinVerified(false);
        }
        else {
            setPinErr("দুটি পিন মেলেনি, আবার চেষ্টা করুন");
            setPinStep1("");
        }
    };
    return (React.createElement(ModalShell, { onClose: onClose, fullScreen: true, title: "\u09B8\u09C7\u099F\u09BF\u0982\u09B8" },
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
                            ? "☁️ সিঙ্ক হচ্ছে"
                            : syncStatus === "error"
                                ? "⚠️ সিঙ্ক ব্যর্থ"
                                : pendingChanges > 0
                                    ? "⏳ অপেক্ষমাণ"
                                    : "✓ সিঙ্ক সম্পন্ন",
                    pendingChanges > 0 && React.createElement("span", { style: styles.pendingBadge },
                        toBnDigits(pendingChanges),
                        " \u09AA\u09C7\u09A8\u09CD\u09A1\u09BF\u0982")),
                lastSyncedAt && (React.createElement("div", { style: Object.assign(Object.assign({}, styles.syncStatusRow), { marginTop: -6, opacity: 0.75, fontSize: 11.5 }) }, `🕒 সর্বশেষ সিঙ্ক: ${formatSyncTime(lastSyncedAt)}`)),
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
                    React.createElement("div", { style: styles.restoreCompareRow },
                        React.createElement("span", null, "\u09AA\u09B0\u09BF\u09AC\u09BE\u09B0\u09C7\u09B0 \u09B8\u09A6\u09B8\u09CD\u09AF"),
                        React.createElement("span", null, toBnDigits(restorePreview.local.familyMembers)),
                        React.createElement("span", null, restorePreview.cloud ? toBnDigits(restorePreview.cloud.familyMembers) : "—")),
                    React.createElement("div", { style: styles.restoreCompareRow },
                        React.createElement("span", null, "\u09AC\u09BE\u099C\u09BE\u09B0 \u0986\u0987\u099F\u09C7\u09AE"),
                        React.createElement("span", null, toBnDigits(restorePreview.local.bazarItems)),
                        React.createElement("span", null, restorePreview.cloud ? toBnDigits(restorePreview.cloud.bazarItems) : "—")),
                    React.createElement("div", { style: styles.restoreCompareRow },
                        React.createElement("span", null, "\u099F\u09CD\u09AF\u09BE\u0995\u09CD\u09B8"),
                        React.createElement("span", null, toBnDigits(restorePreview.local.taxes)),
                        React.createElement("span", null, restorePreview.cloud ? toBnDigits(restorePreview.cloud.taxes) : "—")),
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
                            acc ? ` — বর্তমান ${formatBalance(acc.balance)}` : ""),
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
                React.createElement(CategoryManager, { type: "expense", list: cats.expenseCats, transactions: transactions, onAdd: (label, icon) => onAddCategory("expense", label, icon), onUpdate: (key, patch) => onUpdateCategory("expense", key, patch), onDelete: (key) => onDeleteCategory("expense", key), onMigrate: (fromKey, toKey) => onMigrateCategory("expense", fromKey, toKey) }))),
            React.createElement("button", { style: styles.settingsRow, onClick: () => setShowCats(showCats === "income" ? null : "income") },
                React.createElement("span", null, "\u0986\u09AF\u09BC\u09C7\u09B0 \u0996\u09BE\u09A4 \u09AA\u09B0\u09BF\u099A\u09BE\u09B2\u09A8\u09BE"),
                React.createElement("span", { style: styles.settingsRowValue },
                    showCats === "income" ? "লুকান" : "দেখুন",
                    " \u203A")),
            showCats === "income" && (React.createElement("div", { style: { marginBottom: 10 } },
                React.createElement(CategoryManager, { type: "income", list: cats.incomeCats, transactions: transactions, onAdd: (label, icon) => onAddCategory("income", label, icon), onUpdate: (key, patch) => onUpdateCategory("income", key, patch), onDelete: (key) => onDeleteCategory("income", key), onMigrate: (fromKey, toKey) => onMigrateCategory("income", fromKey, toKey) })))),
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
        React.createElement(SettingsSection, { title: "\uD83D\uDD14 \u09A8\u09CB\u099F\u09BF\u09AB\u09BF\u0995\u09C7\u09B6\u09A8" },
            React.createElement("div", { style: styles.settingsRow },
                React.createElement("span", null, "\u09AC\u09CD\u09B0\u09BE\u0989\u099C\u09BE\u09B0 \u09A8\u09CB\u099F\u09BF\u09AB\u09BF\u0995\u09C7\u09B6\u09A8"),
                React.createElement("span", { style: styles.settingsRowValue }, notificationPermission === "granted"
                    ? "✅ অনুমোদিত"
                    : notificationPermission === "denied"
                        ? "❌ প্রত্যাখ্যাত"
                        : notificationPermission === "unsupported"
                            ? "সমর্থিত নয়"
                            : "অনুমতি দেওয়া হয়নি")),
            notificationPermission !== "granted" && notificationPermission !== "unsupported" && (React.createElement("button", { style: styles.saveBtn, onClick: onRequestNotificationPermission }, "\u09A8\u09CB\u099F\u09BF\u09AB\u09BF\u0995\u09C7\u09B6\u09A8 \u0985\u09A8\u09C1\u09AE\u09A4\u09BF \u09A6\u09BF\u09A8")),
            notificationPermission === "denied" && (React.createElement("div", { style: styles.formHint }, "\u09AC\u09CD\u09B0\u09BE\u0989\u099C\u09BE\u09B0 সেটিংস থেকে অনুমতি চালু করতে হবে — অ্যাপ থেকে আর জিজ্ঞাসা করা যাবে না।")),
            React.createElement("div", { style: Object.assign(Object.assign({}, styles.formHint), { marginTop: 6 }) }, "রিমাইন্ডার শুধু অ্যাপ খোলা বা ব্যাকগ্রাউন্ডে থাকা অবস্থায় কাজ করে — অ্যাপ পুরোপুরি বন্ধ থাকলে নোটিফিকেশন আসবে না (এর জন্য একটি পুশ সার্ভার প্রয়োজন, যা এই ভার্সনে নেই)।")),
        React.createElement(SettingsSection, { title: "\uD83D\uDCCB \u0995\u09BE\u09B0\u09CD\u09AF\u0995\u09B0\u09AE\u09C7\u09B0 \u0987\u09A4\u09BF\u09B9\u09BE\u09B8" },
            React.createElement("button", { style: styles.settingsRow, onClick: () => setShowAuditLog((v) => !v) },
                React.createElement("span", null, "সাম্প্রতিক গুরুত্বপূর্ণ পরিবর্তন"),
                React.createElement("span", { style: styles.settingsRowValue }, showAuditLog ? "লুকান" : "দেখুন", " \u203A")),
            showAuditLog && (React.createElement("div", { style: { maxHeight: 260, overflowY: "auto", marginTop: 6 } }, (auditLog || []).length === 0
                ? React.createElement("div", { style: styles.formHint }, "এখনও কোনো রেকর্ড নেই।")
                : [...auditLog].reverse().map((e) => React.createElement("div", { key: e.id, style: { padding: "7px 0", borderBottom: "1px solid var(--hk-border-light)", fontSize: 12.5 } },
                    React.createElement("div", null, e.text),
                    React.createElement("div", { style: { fontSize: 11, color: "var(--hk-text-muted)" } }, formatSyncTime(e.ts))))))),
        React.createElement(SettingsSection, { title: "\uD83D\uDD10 \u09A8\u09BF\u09B0\u09BE\u09AA\u09A4\u09CD\u09A4\u09BE" },
            React.createElement("button", { style: styles.settingsRow, onClick: () => setShowSecuritySection((v) => !v) },
                React.createElement("span", null, "\u09A8\u09BF\u09B0\u09BE\u09AA\u09A4\u09CD\u09A4\u09BE \u09B8\u09C7\u099F\u09BF\u0982\u09B8"),
                React.createElement("span", { style: styles.settingsRowValue },
                    showSecuritySection ? "লুকান" : "দেখুন",
                    " \u203A")),
            showSecuritySection && (React.createElement("div", null,
                React.createElement("button", { style: styles.settingsRow, onClick: () => { setShowPin((v) => !v); setPinStep1(""); setPinErr(""); setCurrentPinVerified(false); setCurrentPinInput(""); setCurrentPinErr(""); } },
                    React.createElement("span", null,
                        React.createElement(Icon, { name: "security", size: 14, style: { verticalAlign: "-3px", marginRight: 5 } }),
                        " \u09AA\u09BF\u09A8 \u09B2\u0995 ",
                        pin ? "(চালু আছে)" : "(বন্ধ)"),
                    React.createElement("span", { style: styles.settingsRowValue },
                        showPin ? "লুকান" : "দেখুন",
                        " \u203A")),
                showPin && pin && !currentPinVerified && (React.createElement("div", null,
                    React.createElement("div", { style: styles.formHint }, "\u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8/\u09AC\u09A8\u09CD\u09A7 \u0995\u09B0\u09BE\u09B0 \u0986\u0997\u09C7 \u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u09AA\u09BF\u09A8\u099F\u09BF \u09A6\u09BF\u09A8:"),
                    React.createElement("input", { key: "verify", style: styles.textInput, type: "password", inputMode: "numeric", maxLength: 4, placeholder: "\u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u09AA\u09BF\u09A8", value: currentPinInput, onChange: (e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                            setCurrentPinInput(v);
                            if (v.length === 4) {
                                if (v === pin) {
                                    setCurrentPinVerified(true);
                                    setCurrentPinErr("");
                                }
                                else {
                                    setCurrentPinErr("পিন সঠিক নয়");
                                    setCurrentPinInput("");
                                }
                            }
                        } }),
                    currentPinErr ? React.createElement("div", { style: styles.formErr }, currentPinErr) : null,
                    React.createElement("div", { style: { height: 10 } }))),
                showPin && (!pin || currentPinVerified) && (React.createElement("div", null,
                    React.createElement("div", { style: styles.formHint }, pin
                        ? "নতুন ৪-সংখ্যার পিন দুইবার দিন — এটি আগের পিন পরিবর্তন করবে। বায়োমেট্রিক/ফিঙ্গারপ্রিন্ট লক ব্রাউজার-ভিত্তিক এই অ্যাপে নির্ভরযোগ্যভাবে দেওয়া সম্ভব হয়নি, তাই আপাতত শুধু পিন লক দেওয়া হয়েছে।"
                        : "৪-সংখ্যার একটি পিন দুইবার দিন। অ্যাপ খুললে প্রতিবার এই পিন চাওয়া হবে।"),
                    React.createElement("input", { key: pinStep1, style: styles.textInput, type: "password", inputMode: "numeric", maxLength: 4, placeholder: pinStep1 === "" ? "নতুন পিন" : "আবার লিখুন", onChange: (e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                            if (v.length === 4)
                                submitPin(v);
                        } }),
                    pinErr ? React.createElement("div", { style: styles.formErr }, pinErr) : null,
                    pin && (React.createElement("button", { style: styles.dangerLink, onClick: () => { onSavePin(null); setShowPin(false); setCurrentPinVerified(false); } }, "\u09AA\u09BF\u09A8 \u09B2\u0995 \u09AC\u09A8\u09CD\u09A7 \u0995\u09B0\u09C1\u09A8")),
                    React.createElement("div", { style: { height: 10 } }))),
                React.createElement("div", { style: { height: 6 } }),
                !confirmClear ? (React.createElement("button", { style: styles.dangerLink, onClick: () => setConfirmClear(true) }, "\u09A1\u09C7\u099F\u09BE \u09AE\u09C1\u099B\u09C7 \u09AB\u09C7\u09B2\u09C1\u09A8")) : (React.createElement("div", { style: styles.confirmBox },
                    React.createElement("div", { style: { marginBottom: 8 } }, "\u09A8\u09BF\u09B6\u09CD\u099A\u09BF\u09A4? \u098F\u099F\u09BF \u09AB\u09BF\u09B0\u09BF\u09AF\u09BC\u09C7 \u0986\u09A8\u09BE \u09AF\u09BE\u09AC\u09C7 \u09A8\u09BE\u0964"),
                    React.createElement("div", { style: styles.formActions },
                        React.createElement("button", { style: styles.deleteBtn, onClick: onClearAll }, "\u09B9\u09CD\u09AF\u09BE\u0981, \u09AE\u09C1\u099B\u09C7 \u09AB\u09C7\u09B2\u09C1\u09A8"),
                        React.createElement("button", { style: styles.saveBtn, onClick: () => setConfirmClear(false) }, "\u09AC\u09BE\u09A4\u09BF\u09B2")))))))));
}
