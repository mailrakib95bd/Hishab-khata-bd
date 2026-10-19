// ফ্যামিলি > 📦 তালিকা — আগের "ব্যক্তিগত তালিকা" (FamilyView), হুবহু যেমন ছিল।
//
// পরিবারের সদস্যদের নাম, বাজারের আইটেম (পরিমাণ, দর, আনুমানিক/প্রকৃত দাম), "কেনা হয়েছে"
// টিক, দামের ইতিহাস এবং "খরচ হিসাবে যোগ করুন" — সব এই ফাইলে।
// ডেটা আসে App-এর state (familyMembers, bazarItems) থেকে, যা আগের মতোই ডিভাইসে/ক্লাউডে
// সংরক্ষিত হয় (app.js-এ persistAll)। ফ্যামিলি স্ক্রিনের 📦 আইকন চাপলে এটি খোলে।
//
// সাধারণ <script>, তাই global (fvStyles, Icon, EmptyState, formatTaka, useBackOverlay …)
// কল হওয়ার সময় ব্যবহার করা যায়। লোড ক্রম: styles.js → … → family-list.js → … → app.js
// এই ফাইলের কম্পোনেন্ট: FamilyView, MemberForm, BazarItemForm, PriceHistoryModal
"use strict";

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
    useBackOverlay(showMemberForm, () => setShowMemberForm(false));
    useBackOverlay(showBazarForm, () => setShowBazarForm(false));
    useBackOverlay(!!historyFor, () => setHistoryFor(null));
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
