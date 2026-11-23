# হিসাব-খাতা — Local Notification বাস্তবায়ন

## অন্তর্ভুক্ত
- Capacitor 7-compatible `@capacitor/local-notifications` dependency.
- `js/services/notifications.js` — native local notification scheduling engine.
- Settings → Notification section: permission, Exact Alarm, per-category toggles, test notification.
- Task reminder: saved `reminderDate` + `reminderTime`.
- Debt reminder: due date-এর আগের দিন এবং due date-এ সকাল ৯টায়।
- Tax reminder: configured reminder date/time; reminder না থাকলে due date-এ সকাল ৯টায়।
- Personal fixed-date special days এবং admin calendar-এর fixed/Hijri recurring days সকাল ৯টায়।
- Overall ও category budget-এর ৭০%, ৯০%, ১০০% threshold crossing-এ একবার করে সতর্কতা।
- Android build workflow-তে POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM এবং monochrome status-bar icon যোগ।
- Service worker cache version ও offline asset list আপডেট।

## APK build
GitHub Actions → Build Android APK → Run workflow। CI `npm install`, `npm run build`, `npx cap sync android` চালিয়ে তারপর Android manifest ও notification icon তৈরি করবে।

## ফোনে চালু করা
1. নতুন APK ইনস্টল/আপডেট করুন।
2. Settings → নোটিফিকেশন → Android নোটিফিকেশন অনুমতি দিন।
3. Android 12+ হলে Exact Alarm সেটিংস অনুমতি দিন।
4. পরীক্ষামূলক নোটিফিকেশন পাঠান।
5. Task/debt/tax/special day/budget-এর নিজস্ব ডেটা অনুযায়ী schedule হবে।

## সীমাবদ্ধতা
- Local notification একই ডিভাইসে আগে থেকে schedule করা যায়; অন্য সদস্যের ডিভাইসে ঘটনা ঘটলে তার notification পাঠাতে Firebase Push/Cloud Functions ধাপ লাগবে।
- Android Force Stop করলে, OEM battery restriction থাকলে, বা exact-alarm অনুমতি বন্ধ থাকলে delivery দেরি/বন্ধ হতে পারে।
- Hijri recurring day schedule করতে admin calendar-এর recurring Hijri entries ব্যবহার হয়; ব্যক্তিগত specialDays data বর্তমানে Gregorian date-keyed, তাই ব্যক্তিগত Hijri recurrence আলাদা data model ছাড়া নেই।
- Browser/PWA-তে app বন্ধ থাকলে native local notification delivery নেই।

## ফাইনাল সংশোধন
- build-apk.yml: AndroidManifest-এ পারমিশন এখন `<manifest ...>` ট্যাগের ভেতরে বসে (আগে `<?xml ?>` ডিক্লারেশনের পরে বসে ম্যানিফেস্ট ভেঙে দিত)।
- notifications.js: Exact Alarm স্ট্যাটাস এখন `exact_alarm` ও `exactAlarm` দুটোই পড়ে।
