const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync(require('path').join(__dirname, '../js/services/notifications.js'), 'utf8');
const store = new Map();
const window = { HijriUQ: { hijriOccurrenceInGregorianMonth: (month, day, year, gMonth) => `${year}-${String(gMonth).padStart(2,'0')}-15` } };
const context = { window, localStorage: { getItem: k => store.get(k) || null, setItem: (k,v) => store.set(k,v) }, Date, Math, Number, String, Object, Array, JSON, console };
vm.runInNewContext(source, context);
const engine = window.HKNotifications;
const now = new Date('2026-11-24T02:00:00');
const result = engine.buildSchedule({
  tasks: [{ id: 't1', text: 'ঔষধ কিনতে হবে', reminderDate: '2026-11-25', reminderTime: '10:30', done: false }],
  debts: [{ id: 'd1', person: 'রহিম', type: 'payable', amount: 1000, repayments: [], dueDate: '2026-11-27' }],
  taxes: [{ id: 'x1', name: 'আয়কর', amount: 500, dueDate: '2026-11-28', paid: false }],
  specialDays: { '2026-11-29': ['জন্মদিন'] },
  adminSpecialDays: [{ id: 'h1', title: 'হিজরি দিবস', recurrence: 'hijri', hijriMonth: 9, hijriDay: 1 }]
}, engine.getPreferences(), now);
assert(result.some(n => n.extra.key.startsWith('task:t1:')), 'task reminder scheduled');
assert(result.some(n => n.extra.key.startsWith('debt-before:d1:')), 'debt day-before reminder scheduled');
assert(result.some(n => n.extra.key.startsWith('debt-due:d1:')), 'debt due-day reminder scheduled');
assert(result.some(n => n.extra.key.startsWith('tax:x1:')), 'tax due-date reminder scheduled');
assert(result.some(n => n.extra.key.startsWith('special:2026-11-29:')), 'personal special day scheduled');
assert(result.some(n => n.extra.key.startsWith('hijri:h1:')), 'recurring Hijri special day scheduled');
const disabled = Object.assign({}, engine.getPreferences(), { tasks: false, debts: false, taxes: false, specialDays: false });
assert.strictEqual(engine.buildSchedule({ tasks: [{id:'t', reminderDate:'2026-11-25', reminderTime:'10:00'}] }, disabled, now).length, 0);
console.log('✓ Local notification schedule tests passed');

(async () => {
  const scheduled = [];
  window.Capacitor = { Plugins: { LocalNotifications: {
    checkPermissions: async () => ({ display: 'granted' }),
    cancel: async () => {},
    schedule: async ({ notifications }) => { scheduled.push(...notifications); }
  } } };
  const current = new Date();
  const today = `${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}`;
  const data = { budget: 1000, transactions: [{ id:'e1', date:today, type:'expense', amount:950 }], tasks: [], debts: [], taxes: [], specialDays: {} };
  await engine.sync(data);
  const budgetAlerts = scheduled.filter(n => n.extra && String(n.extra.key).startsWith('budget:'));
  assert.strictEqual(budgetAlerts.length, 2, '95% spend triggers 70% and 90% warnings');
  scheduled.length = 0;
  await engine.sync(data);
  assert.strictEqual(scheduled.filter(n => n.extra && String(n.extra.key).startsWith('budget:')).length, 0, 'same budget thresholds do not repeat');
  console.log('✓ Budget notification threshold tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
