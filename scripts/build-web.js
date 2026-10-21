// Copies ONLY the web-app files into ./www (Capacitor's webDir) and makes the
// app work fully offline inside the APK:
//   • React / ReactDOM are copied from node_modules into www/vendor and
//     index.html's unpkg <script> tags are pointed at them — so the APK does
//     not depend on a CDN for the core UI. (The source index.html is left
//     untouched, so normal web hosting still works as before.)
// Run: npm run build
"use strict";
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, "www");
const WEB_FILES = [
  "index.html", "js/app/styles.js", "js/app/family-list.js", "js/app/admin.js", "js/app/debts.js", "js/app/tax.js", "js/app/settings.js", "js/app/calendar-tasks.js", "js/app/reports-search.js", "js/app/app.js", "js/family/family-bazar.js", "js/family/family-planning.js", "js/family/family-shopping-core.js", "js/family/family-shopping.js", "js/family/family-bazar-core.js", "js/family/family-planning-core.js", "js/features/khasra-khata.js", "js/features/hijri-ummalqura.js",
  "js/services/firebase-init.js", "sw.js", "manifest.json", "assets/icons/icon-192.png", "assets/icons/icon-512.png",
];
const VENDOR = [
  { from: "react/umd/react.production.min.js", to: "react.production.min.js", cdn: "https://unpkg.com/react@18/umd/react.production.min.js" },
  { from: "react-dom/umd/react-dom.production.min.js", to: "react-dom.production.min.js", cdn: "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" },
];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "vendor"), { recursive: true });

WEB_FILES.forEach((f) => {
  const src = path.join(root, f);
  if (!fs.existsSync(src)) throw new Error("missing web file: " + f);
  fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
  fs.copyFileSync(src, path.join(out, f));
});

let html = fs.readFileSync(path.join(out, "index.html"), "utf8");
VENDOR.forEach((v) => {
  const src = path.join(root, "node_modules", v.from);
  if (!fs.existsSync(src)) throw new Error("run `npm install` first — missing " + v.from);
  fs.copyFileSync(src, path.join(out, "vendor", v.to));
  if (!html.includes(v.cdn)) throw new Error("index.html no longer references " + v.cdn);
  html = html.split(v.cdn).join("./vendor/" + v.to);
});
fs.writeFileSync(path.join(out, "index.html"), html);
console.log("www/ ready:", fs.readdirSync(out).join(", "));
