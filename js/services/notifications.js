/* Local notification engine for হিসাব-খাতা.
 * Native delivery is provided by @capacitor/local-notifications; browser/PWA
 * environments keep the in-app reminder UI and do not pretend to support
 * closed-app delivery.
 */
(function () {
  "use strict";
  const PREF_KEY = "hk_notification_preferences_v1";
  const IDS_KEY = "hk_local_notification_ids_v1";
  const BUDGET_KEY = "hk_budget_alert_levels_v1";
  const DEFAULTS = { enabled: true, tasks: true, debts: true, taxes: true, specialDays: true, budget: true };
  const DAY = 86400000;
  const MAX_SCHEDULED = 450;
  let latestData = null;
  let syncQueue = Promise.resolve();

  function plugin() {
    return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications || null;
  }
  function read(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; }
  }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
  function prefs() { return Object.assign({}, DEFAULTS, read(PREF_KEY, {})); }
  function setPrefs(next) { const merged = Object.assign({}, DEFAULTS, next || {}); write(PREF_KEY, merged); if (latestData) sync(latestData).catch(() => {}); return merged; }
  function ymd(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
  function at(dateStr, timeStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || "")) return null;
    const time = /^\d{2}:\d{2}$/.test(timeStr || "") ? timeStr : "09:00";
    const d = new Date(`${dateStr}T${time}:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  function stableId(key) {
    let h = 2166136261;
    for (let i=0;i<key.length;i++) { h ^= key.charCodeAt(i); h = Math.imul(h,16777619); }
    return 1000 + ((h >>> 0) % 2000000000);
  }
  function notification(key, title, body, date) {
    return { id: stableId(key), title, body, schedule: { at: date, allowWhileIdle: true }, smallIcon: "ic_stat_icon_config_sample", iconColor: "#0F5B46", autoCancel: true, extra: { key } };
  }
  function debtRemaining(d) { return Math.max(0, Number(d.amount || 0) - (d.repayments || []).reduce((s,r)=>s+Number(r.amount||0),0)); }
  function buildSchedule(data, settings, now) {
    const out = [];
    const add = (key,title,body,date) => { if (date && date.getTime() > now.getTime()+5000 && out.length < MAX_SCHEDULED) out.push(notification(key,title,body,date)); };
    if (settings.tasks) (data.tasks || []).forEach(t => {
      if (!t || t.done || !t.reminderDate || !t.reminderTime) return;
      add(`task:${t.id}:${t.reminderDate}:${t.reminderTime}`, "হিসাব-খাতা · কাজের রিমাইন্ডার", t.text || "আপনার একটি কাজের সময় হয়েছে", at(t.reminderDate,t.reminderTime));
    });
    if (settings.debts) (data.debts || []).forEach(d => {
      if (!d || debtRemaining(d) <= 0 || !d.dueDate) return;
      const person = d.person || "ব্যক্তি";
      const type = d.type === "receivable" ? "পাওনা ফেরত পাওয়ার কথা" : "দেনা পরিশোধের কথা";
      const due = at(d.dueDate,"09:00");
      if (!due) return;
      const before = new Date(due.getTime()-DAY);
      add(`debt-before:${d.id}:${d.dueDate}`, "হিসাব-খাতা · আগাম দেনা-পাওনা সতর্কতা", `${person} — আগামীকাল ${type}`, before);
      add(`debt-due:${d.id}:${d.dueDate}`, "হিসাব-খাতা · দেনা-পাওনা আজ", `${person} — আজ ${type}`, due);
    });
    if (settings.taxes) (data.taxes || []).forEach(t => {
      if (!t || t.paid) return;
      const date = at(t.reminderDate || t.dueDate, t.reminderTime || "09:00");
      add(`tax:${t.id}:${t.reminderDate||t.dueDate}:${t.reminderTime||"09:00"}`, "হিসাব-খাতা · ট্যাক্স রিমাইন্ডার", `${t.name || "ট্যাক্স"} — ${Number(t.amount||0).toLocaleString("bn-BD")} টাকা`, date);
    });
    if (settings.specialDays) {
      Object.entries(data.specialDays || {}).forEach(([date, labels]) => {
        (Array.isArray(labels) ? labels : [labels]).forEach((label,index) => {
          add(`special:${date}:${index}:${String(label)}`, "হিসাব-খাতা · ব্যক্তিগত বিশেষ দিন", String(label), at(date,"09:00"));
        });
      });
      // Shared calendar events can recur by Hijri date. Resolve each of the
      // next 12 Gregorian months using the app's own Umm al-Qura calendar.
      (data.adminSpecialDays || []).forEach((day) => {
        if (!day) return;
        if (day.recurrence === "hijri" && window.HijriUQ && day.hijriMonth && day.hijriDay) {
          for (let offset=0; offset<13; offset++) {
            const monthDate = new Date(now.getFullYear(), now.getMonth()+offset, 1);
            const date = window.HijriUQ.hijriOccurrenceInGregorianMonth(day.hijriMonth, day.hijriDay, monthDate.getFullYear(), monthDate.getMonth()+1);
            add(`hijri:${day.id||day.title}:${date}`, "হিসাব-খাতা · হিজরি বিশেষ দিবস", day.title || "বিশেষ হিজরি দিবস", at(date,"09:00"));
          }
        } else if (day.date) {
          add(`admin-special:${day.id||day.title}:${day.date}`, "হিসাব-খাতা · বিশেষ দিবস", day.title || "বিশেষ দিবস", at(day.date,"09:00"));
        }
      });
    }
    return out;
  }
  // Plugin v7 reports { exact_alarm: "granted" | "denied" | "prompt" ... };
  // older/other shapes used exactAlarm (boolean). Accept all of them.
  function exactState(x) {
    if (!x) return "unknown";
    const v = x.exact_alarm !== undefined ? x.exact_alarm : x.exactAlarm;
    if (v === true || v === "granted") return "granted";
    if (v === false || v === "denied") return "denied";
    return "unknown";
  }
  async function checkPermissions() {
    const p = plugin();
    if (!p) return { supported: false, permission: "unsupported", exact: "unsupported" };
    try {
      const result = await p.checkPermissions();
      let exact = "unsupported";
      if (typeof p.checkExactNotificationSetting === "function") {
        try { exact = exactState(await p.checkExactNotificationSetting()); } catch (_) {}
      }
      return { supported: true, permission: result.display || "unknown", exact };
    } catch (e) { return { supported: true, permission: "unknown", exact: "unknown", error: e.message }; }
  }
  async function requestPermission() {
    const p = plugin();
    if (!p) return { supported: false, permission: "unsupported" };
    const result = await p.requestPermissions();
    return { supported: true, permission: result.display || "unknown" };
  }
  async function requestExactPermission() {
    const p = plugin();
    if (!p || typeof p.changeExactNotificationSetting !== "function") return { exact: "unsupported" };
    const result = await p.changeExactNotificationSetting();
    return { exact: exactState(result) };
  }
  function sync(data) {
    latestData = data || latestData || {};
    const snapshot = latestData;
    syncQueue = syncQueue.catch(() => {}).then(() => syncNow(snapshot));
    return syncQueue;
  }
  async function syncNow(data) {
    const p = plugin();
    if (!p) return { supported: false, scheduled: 0, reason: "native-plugin-unavailable" };
    const settings = prefs();
    if (!settings.enabled) {
      const oldIds = read(IDS_KEY, []);
      if (oldIds.length) { try { await p.cancel({ notifications: oldIds.map(id=>({id})) }); } catch (_) {} }
      write(IDS_KEY, []);
      return { supported: true, scheduled: 0, disabled: true };
    }
    const status = await p.checkPermissions();
    if (status.display !== "granted") return { supported: true, scheduled: 0, permission: status.display };
    const now = new Date();
    const next = buildSchedule(data || {}, settings, now);
    // Budget warnings are event-driven: only newly reached levels are shown.
    let budgetLevelsToSave = null;
    if (settings.budget) {
      const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
      const monthTx = (data.transactions || []).filter(t=>t && t.type === "expense" && String(t.date||"").slice(0,7)===month);
      const levels = read(BUDGET_KEY, {});
      const checkBudget = (key, label, limit, spent) => {
        limit = Number(limit || 0);
        if (limit <= 0) return;
        const storageKey = `${month}|${key}`;
        const current = Math.floor(spent / limit * 100);
        const previous = Number(levels[storageKey] || 0);
        [70,90,100].forEach(level => {
          if (current >= level && previous < level) {
            next.push({ id: stableId(`budget:${month}:${key}:${level}`), title: "হিসাব-খাতা · বাজেট সতর্কতা", body: `${label} বাজেট ${level}% ${level===100?"শেষ হয়েছে":"ব্যবহার হয়েছে"}।`, schedule: { at: new Date(Date.now()+3000), allowWhileIdle: true }, smallIcon: "ic_stat_icon_config_sample", iconColor: "#0F5B46", autoCancel: true, extra: { key: `budget:${month}:${key}:${level}` } });
          }
        });
        levels[storageKey] = Math.max(previous,current);
      };
      checkBudget("overall", "মাসিক", data.budget, monthTx.reduce((sum,t)=>sum+Number(t.amount||0),0));
      const categoryNames = {};
      (data.expenseCats || []).forEach(c => { categoryNames[c.key] = c.label; });
      Object.entries(data.categoryBudgets || {}).forEach(([key,limit]) => {
        const spent = monthTx.filter(t=>t.category===key).reduce((sum,t)=>sum+Number(t.amount||0),0);
        checkBudget(`category:${key}`, categoryNames[key] || key, limit, spent);
      });
      Object.keys(levels).filter(k=>k.slice(0,4)<String(now.getFullYear()-1)).forEach(k=>delete levels[k]);
      budgetLevelsToSave = levels;
    }
    const oldIds = read(IDS_KEY, []);
    if (oldIds.length) { try { await p.cancel({ notifications: oldIds.map(id=>({id})) }); } catch (_) {} }
    const batch = next.slice(0,MAX_SCHEDULED);
    if (batch.length) await p.schedule({ notifications: batch });
    if (budgetLevelsToSave) write(BUDGET_KEY, budgetLevelsToSave);
    write(IDS_KEY, batch.map(n=>n.id));
    return { supported: true, scheduled: batch.length };
  }
  async function sendTest() {
    const p = plugin();
    if (!p) throw new Error("এই ডিভাইসে Native Local Notification প্লাগইন নেই। APK আপডেট করুন।");
    const status = await p.checkPermissions();
    if (status.display !== "granted") throw new Error("আগে নোটিফিকেশন অনুমতি দিন।");
    await p.schedule({ notifications: [{ id: stableId(`test:${Date.now()}`), title: "হিসাব-খাতা · পরীক্ষা সফল", body: "আপনার Local Notification সঠিকভাবে কাজ করছে।", schedule: { at: new Date(Date.now()+1500), allowWhileIdle: true }, smallIcon: "ic_stat_icon_config_sample", iconColor: "#0F5B46", autoCancel: true }] });
    return true;
  }
  window.HKNotifications = { getPreferences: prefs, setPreferences: setPrefs, checkPermissions, requestPermission, requestExactPermission, sync, buildSchedule, sendTest };
})();
