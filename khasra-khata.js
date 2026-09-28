// হিসাব-খাতা — খসড়া খাতা (বাজার ও সদাই তালিকা ব্যবস্থাপনা)
//
// Plain JavaScript (React.createElement, no JSX, no build step), same style as
// family-bazar.js. Loaded as a classic script BEFORE app.js; everything is
// wrapped in an IIFE so it can't collide with app.js's top-level names.
//
// Part 1 (pure logic, also usable from Node for tests): line/total maths,
// Enter-key navigation rules, search, storage, print-HTML, minimal PDF writer.
// Part 2 (UI): window.KhasraKhata = { Module } — three screens
//   main (input) → history (search + cards) → detail (print / PDF).
//
// Data lives only on this device (localStorage), one list per identity:
//   "hisabkhata-khasra-v1:<uid|guest>".  It is deliberately NOT part of the
// cloud-sync payload, so nothing existing (backup/restore/Firestore) changes.
(function (root) {
  "use strict";

  /* ================================================================== *
   * PART 1 — pure logic
   * ================================================================== */
  const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  const BN_MONTHS = [
    "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
  ];
  const UNITS = ["kg", "gm", "pcs", "ltr", "ml", "dozen", "packet", "box", "bag", "bundle"];
  const INITIAL_ROWS = 10;
  const STORAGE_PREFIX = "hisabkhata-khasra-v1:";

  const toBn = (s) => String(s).replace(/[0-9]/g, (d) => BN_DIGITS[d]);
  const toEn = (s) => String(s).replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  // accepts "25", "২৫", "1,200", " 7.5 " — anything unparseable counts as 0
  function parseNum(v) {
    const s = toEn(v == null ? "" : v).replace(/,/g, "").trim();
    if (!s) return 0;
    const n = parseFloat(s);
    return isFinite(n) && n > 0 ? n : 0;
  }

  // 12345.5 → "১২,৩৪৫.৫"  (south-asian grouping, up to 2 decimals)
  function fmtNum(n) {
    n = round2(Number(n) || 0);
    const neg = n < 0;
    const [i, d] = Math.abs(n).toFixed(2).split(".");
    let int = i;
    if (int.length > 3) {
      const last3 = int.slice(-3);
      const rest = int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
      int = rest + "," + last3;
    }
    const dec = d.replace(/0+$/, "");
    return (neg ? "−" : "") + toBn(int + (dec ? "." + dec : ""));
  }
  const fmtTaka = (n) => fmtNum(n) + "৳";

  // "2026-09-27" → "২৭ সেপ্টেম্বর, ২০২৬"
  function dateBn(ymd) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
    if (!m) return String(ymd || "");
    return toBn(parseInt(m[3], 10)) + " " + BN_MONTHS[parseInt(m[2], 10) - 1] + ", " + toBn(m[1]);
  }

  function todayYmd(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  const newRow = () => ({ desc: "", qty: "", unit: "kg", rate: "", discount: "" });
  const newRows = (n) => Array.from({ length: n == null ? INITIAL_ROWS : n }, newRow);

  // Line Total = (পরিমাণ × দর) − ছাড়.  ছাড় may be taka ("50") or percent
  // ("10%") of that line's gross.  Discount is clamped to [0, gross] so a
  // typo can never produce a negative line.
  function lineGross(row) { return round2(parseNum(row.qty) * parseNum(row.rate)); }
  function lineDiscount(row) {
    const gross = lineGross(row);
    const raw = toEn(row.discount == null ? "" : row.discount).trim();
    let d;
    if (raw.endsWith("%")) d = (gross * Math.min(parseNum(raw.slice(0, -1)), 100)) / 100;
    else d = parseNum(raw);
    return round2(Math.min(d, gross));
  }
  function lineTotal(row) { return round2(lineGross(row) - lineDiscount(row)); }

  // a row counts as "used" if anything was typed in it (unit alone doesn't count)
  function isBlankRow(row) {
    return !String(row.desc || "").trim() && !String(row.qty || "").trim() &&
      !String(row.rate || "").trim() && !String(row.discount || "").trim();
  }
  function totals(rows) {
    let discount = 0, grand = 0;
    (rows || []).forEach((r) => { discount += lineDiscount(r); grand += lineTotal(r); });
    return { discount: round2(discount), grand: round2(grand) };
  }

  // Enter-key rules from the spec.
  //  • বিবরণ: Enter → same column, next row.  On the LAST row, if it has a
  //    description, a new row is created and focused; if it's empty nothing
  //    is created (so "stop typing" = "stop growing").
  //  • পরিমাণ / দর / ছাড়: Enter → same column, next row, but only as far as
  //    rows that already exist — never creates rows.
  function enterNav(col, index, rows) {
    const last = rows.length - 1;
    if (index < last) return { type: "focus", col: col, index: index + 1 };
    if (col === "desc" && String(rows[index].desc || "").trim()) return { type: "add", col: col, index: index + 1 };
    return { type: "none" };
  }

  // what gets stored: only rows that were actually used, numbers kept as typed
  function buildDraft(fields, existing) {
    const rows = fields.rows.filter((r) => !isBlankRow(r)).map((r) => ({
      desc: String(r.desc || "").trim(), qty: String(r.qty || "").trim(), unit: r.unit || "kg",
      rate: String(r.rate || "").trim(), discount: String(r.discount || "").trim(),
    }));
    const t = totals(rows);
    const now = Date.now();
    return {
      id: existing ? existing.id : "kk" + now.toString(36) + Math.random().toString(36).slice(2, 7),
      name: String(fields.name || "").trim(), date: fields.date, rows: rows,
      totalDiscount: t.discount, grandTotal: t.grand,
      createdAt: existing ? existing.createdAt : now, updatedAt: now,
    };
  }
  function validateDraft(fields) {
    if (!String(fields.name || "").trim()) return "সংগঠন/অনুষ্ঠানের নাম লিখুন";
    if (!fields.date) return "তারিখ দিন";
    if (!fields.rows.some((r) => String(r.desc || "").trim())) return "অন্তত একটি পণ্যের বিবরণ লিখুন";
    return "";
  }

  // search by event name or date — date matches the raw "2026-09-27", the
  // Bangla "২৭ সেপ্টেম্বর, ২০২৬" text, and Bangla digits typed by the user
  function searchDrafts(list, q) {
    const s = toEn(q || "").trim().toLowerCase();
    const sb = String(q || "").trim();
    const sorted = [...list].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
    if (!s) return sorted;
    return sorted.filter((d) => (d.name || "").toLowerCase().includes(s) || (d.name || "").includes(sb) ||
      (d.date || "").includes(s) || toEn(dateBn(d.date)).toLowerCase().includes(s) || dateBn(d.date).includes(sb));
  }

  function storageKey(id) { return STORAGE_PREFIX + (id || "guest"); }
  function loadDrafts(storage, id) {
    try {
      const v = JSON.parse(storage.getItem(storageKey(id)) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function saveDrafts(storage, id, list) {
    try { storage.setItem(storageKey(id), JSON.stringify(list)); return true; } catch (e) { return false; }
  }

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // self-contained printable page (used by the Print button)
  function printHtml(d) {
    const body = d.rows.map((r, i) =>
      "<tr><td class=c>" + toBn(i + 1) + "</td><td>" + esc(r.desc) + "</td><td class=n>" + esc(r.qty ? toBn(toEn(r.qty)) : "") +
      "</td><td class=c>" + esc(r.qty ? r.unit : "") + "</td><td class=n>" + (parseNum(r.rate) ? fmtNum(parseNum(r.rate)) : "") +
      "</td><td class=n>" + (lineDiscount(r) ? fmtNum(lineDiscount(r)) : "০") + "</td><td class=n>" + fmtNum(lineTotal(r)) + "</td></tr>").join("");
    return "<!DOCTYPE html><html lang=bn><head><meta charset=utf-8><title>" + esc(d.name) + "</title><style>" +
      "body{font-family:'Hind Siliguri','Noto Sans Bengali',sans-serif;margin:24px;color:#111}" +
      "h1{text-align:center;font-size:22px;margin:0 0 6px}.meta{text-align:center;font-size:15px;margin-bottom:14px}" +
      "table{width:100%;border-collapse:collapse;font-size:14px}th,td{border:1px solid #444;padding:5px 7px}th{background:#eee}" +
      ".n{text-align:right}.c{text-align:center}.tot td{font-weight:700;background:#f6f6f6}" +
      "@page{size:A4;margin:12mm}</style></head><body><h1>বাজার সদাইয়ের হিসাব</h1><div class=meta><b>" + esc(d.name) +
      "</b> &nbsp;•&nbsp; " + esc(dateBn(d.date)) + "</div><table><thead><tr><th>নং</th><th>পণ্যের বিবরণ</th><th>পরিমাণ</th><th>একক</th>" +
      "<th>দর (৳)</th><th>ছাড় (৳)</th><th>মোট (৳)</th></tr></thead><tbody>" + body +
      "<tr class=tot><td colspan=5 class=n>সর্বমোট ছাড়</td><td class=n>" + fmtNum(d.totalDiscount) + "</td><td></td></tr>" +
      "<tr class=tot><td colspan=6 class=n>সর্বমোট টাকা</td><td class=n>" + fmtNum(d.grandTotal) + "</td></tr>" +
      "</tbody></table></body></html>";
  }

  // Minimal PDF writer: each page is one full-page JPEG. Bangla text is
  // rasterised by the browser's own text engine (so conjuncts render right)
  // and wrapped here — no font embedding, no external library, works offline.
  const PDF_W = 595.28, PDF_H = 841.89; // A4 in points
  function buildPdf(pages) {
    const enc = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
    const chunks = []; let offset = 0; const offsets = [];
    const push = (u) => { chunks.push(u); offset += u.length; };
    const str = (s) => push(enc(s));
    const begin = (n) => { offsets[n] = offset; str(n + " 0 obj\n"); };
    str("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    const n = pages.length;
    begin(1); str("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    begin(2); str("<< /Type /Pages /Kids [" + pages.map((_, i) => (3 + 3 * i) + " 0 R").join(" ") + "] /Count " + n + " >>\nendobj\n");
    pages.forEach((p, i) => {
      const pg = 3 + 3 * i, ct = pg + 1, im = pg + 2;
      begin(pg); str("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + PDF_W + " " + PDF_H + "] /Resources << /XObject << /Im" + i + " " + im + " 0 R >> >> /Contents " + ct + " 0 R >>\nendobj\n");
      const content = "q " + PDF_W + " 0 0 " + PDF_H + " 0 0 cm /Im" + i + " Do Q";
      begin(ct); str("<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream\nendobj\n");
      begin(im); str("<< /Type /XObject /Subtype /Image /Width " + p.w + " /Height " + p.h + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + p.jpeg.length + " >>\nstream\n");
      push(p.jpeg); str("\nendstream\nendobj\n");
    });
    const total = 3 + 3 * n, xrefPos = offset;
    let xref = "xref\n0 " + total + "\n0000000000 65535 f \n";
    for (let k = 1; k < total; k++) xref += String(offsets[k]).padStart(10, "0") + " 00000 n \n";
    str(xref + "trailer\n<< /Size " + total + " /Root 1 0 R >>\nstartxref\n" + xrefPos + "\n%%EOF\n");
    const out = new Uint8Array(offset); let p = 0;
    chunks.forEach((c) => { out.set(c, p); p += c.length; });
    return out;
  }

  const Core = {
    UNITS, INITIAL_ROWS, parseNum, fmtNum, fmtTaka, dateBn, todayYmd, newRow, newRows,
    lineGross, lineDiscount, lineTotal, isBlankRow, totals, enterNav, buildDraft, validateDraft,
    searchDrafts, storageKey, loadDrafts, saveDrafts, printHtml, buildPdf, toBn, toEn,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Core;
  if (typeof window !== "undefined") window.KhasraCore = Core;

  /* ================================================================== *
   * PART 2 — UI (browser only)
   * ================================================================== */
  if (typeof React === "undefined" || typeof window === "undefined") return;
  const { useState, useEffect, useRef, useMemo } = React;
  const h = React.createElement;

  const S = {
    overlay: { position: "fixed", inset: 0, zIndex: 30, background: "var(--hk-surface-soft)", display: "flex", justifyContent: "center" },
    sheet: { width: "100%", maxWidth: 480, height: "100%", display: "flex", flexDirection: "column", fontFamily: "inherit", color: "var(--hk-text)" },
    header: { flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid var(--hk-border)", background: "var(--hk-card)" },
    title: { flex: 1, fontSize: 16.5, fontWeight: 700, minWidth: 0 },
    iconBtn: { minWidth: 40, height: 40, border: "1px solid var(--hk-border)", borderRadius: 10, background: "var(--hk-bg)", color: "var(--hk-text)", fontSize: 18, fontFamily: "inherit" },
    body: { flex: 1, overflow: "auto", overscrollBehaviorY: "contain", padding: "12px 12px 8px" },
    label: { display: "block", fontSize: 12.5, color: "var(--hk-text-muted)", margin: "8px 0 4px" },
    input: { width: "100%", boxSizing: "border-box", height: 40, padding: "0 10px", border: "1px solid var(--hk-border)", borderRadius: 8, background: "var(--hk-card)", color: "var(--hk-text)", fontSize: 14, fontFamily: "inherit" },
    cell: { border: "1px solid var(--hk-border)", padding: 0 },
    cellInput: { width: "100%", boxSizing: "border-box", height: 38, padding: "0 6px", border: "none", background: "transparent", color: "var(--hk-text)", fontSize: 14, fontFamily: "inherit", outline: "none" },
    th: { border: "1px solid var(--hk-border)", background: "var(--hk-card)", padding: "6px 4px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 1 },
    footer: { flex: "none", borderTop: "2px solid var(--hk-gold)", background: "var(--hk-card)", padding: "10px 14px 12px", paddingBottom: "max(12px, env(safe-area-inset-bottom))" },
    totRow: { display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 },
    primary: { width: "100%", height: 46, border: "none", borderRadius: 10, background: "var(--hk-gold)", color: "#1a1a1a", fontSize: 15, fontWeight: 700, fontFamily: "inherit", marginTop: 8 },
    ghost: { flex: 1, height: 44, border: "1px solid var(--hk-border)", borderRadius: 10, background: "var(--hk-card)", color: "var(--hk-text)", fontSize: 14, fontFamily: "inherit" },
    card: { background: "var(--hk-card)", border: "1px solid var(--hk-border)", borderRadius: 12, padding: "12px 14px", marginBottom: 10 },
    muted: { fontSize: 12.5, color: "var(--hk-text-muted)" },
  };
  const COLS = [
    { key: "no", label: "নং", w: 34 }, { key: "desc", label: "পণ্যের বিবরণ", w: 150 }, { key: "qty", label: "পরিমাণ", w: 66 },
    { key: "unit", label: "একক", w: 74 }, { key: "rate", label: "দর (৳)", w: 68 }, { key: "discount", label: "ছাড় (৳/%)", w: 74 }, { key: "total", label: "মোট (৳)", w: 82 },
  ];
  const TABLE_W = COLS.reduce((s, c) => s + c.w, 0);

  function download(bytes, filename) {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
  }

  // Inside the Android APK (Capacitor WebView) blob downloads and
  // window.print() don't work, so the PDF is written to the app cache and
  // handed to the system share sheet (Save to Files / WhatsApp / Print…).
  // Uses Capacitor's global plugin proxies — no bundler needed.
  function isNative() {
    const C = window.Capacitor;
    return !!(C && typeof C.isNativePlatform === "function" && C.isNativePlatform());
  }
  function toBase64(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  async function saveNative(bytes, filename) {
    const P = window.Capacitor.Plugins || {};
    if (!P.Filesystem || !P.Share) throw new Error("native plugins missing");
    const res = await P.Filesystem.writeFile({ path: filename, data: toBase64(bytes), directory: "CACHE" });
    await P.Share.share({ title: filename, url: res.uri, dialogTitle: "তালিকাটি সংরক্ষণ / প্রিন্ট করুন" });
  }

  function printDraft(d) {
    // on phones "print" = make the PDF and open the share/print sheet
    if (isNative()) { downloadPdf(d).catch(() => {}); return; }
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(f);
    const doc = f.contentWindow.document;
    doc.open(); doc.write(printHtml(d)); doc.close();
    setTimeout(() => {
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { /* ignore */ }
      setTimeout(() => { if (f.parentNode) f.parentNode.removeChild(f); }, 2000);
    }, 400);
  }

  // draws the list onto A4-shaped canvases (1240×1754 ≈ 150 dpi), one per page
  async function renderPdfPages(d) {
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) { /* ignore */ }
    const W = 1240, H = 1754, M = 70, FONT = '"Hind Siliguri","Noto Sans Bengali","Kalpurush",sans-serif';
    const widths = [60, 390, 120, 100, 130, 130, 170];
    const heads = ["নং", "পণ্যের বিবরণ", "পরিমাণ", "একক", "দর (৳)", "ছাড় (৳)", "মোট (৳)"];
    const canvases = [];
    let cv, ctx, y;
    const seg = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("bn", { granularity: "grapheme" }) : null;
    const graphemes = (s) => (seg ? Array.from(seg.segment(s), (x) => x.segment) : Array.from(s));
    const wrap = (text, maxW) => {
      const lines = []; let line = "";
      String(text).split(/\s+/).forEach((word) => {
        const t = line ? line + " " + word : word;
        if (ctx.measureText(t).width <= maxW) { line = t; return; }
        if (line) { lines.push(line); line = ""; }
        if (ctx.measureText(word).width <= maxW) { line = word; return; }
        graphemes(word).forEach((g) => { if (ctx.measureText(line + g).width > maxW && line) { lines.push(line); line = g; } else line += g; });
      });
      if (line) lines.push(line);
      return lines.length ? lines : [""];
    };
    const newPage = () => {
      cv = document.createElement("canvas"); cv.width = W; cv.height = H; ctx = cv.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H); ctx.fillStyle = "#111"; ctx.textBaseline = "middle";
      canvases.push(cv); y = M;
    };
    const drawRow = (cells, rowH, opts) => {
      let x = M;
      cells.forEach((t, i) => {
        if (opts.fill) { ctx.fillStyle = opts.fill; ctx.fillRect(x, y, widths[i], rowH); ctx.fillStyle = "#111"; }
        ctx.strokeStyle = "#444"; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, widths[i], rowH);
        ctx.font = (opts.bold ? "700 " : "") + "26px " + FONT;
        const align = i === 1 ? "left" : i === 0 || i === 3 ? "center" : "right";
        ctx.textAlign = align;
        const tx = align === "left" ? x + 10 : align === "center" ? x + widths[i] / 2 : x + widths[i] - 10;
        const lines = Array.isArray(t) ? t : [t];
        lines.forEach((ln, k) => ctx.fillText(ln, tx, y + 8 + 17 + k * 36));
        x += widths[i];
      });
      y += rowH;
    };
    newPage();
    ctx.textAlign = "center"; ctx.font = "700 44px " + FONT; ctx.fillText("বাজার সদাইয়ের হিসাব", W / 2, y + 24); y += 62;
    ctx.font = "700 30px " + FONT; ctx.fillText(d.name, W / 2, y + 16); y += 40;
    ctx.font = "26px " + FONT; ctx.fillText(dateBn(d.date), W / 2, y + 14); y += 44;
    drawRow(heads, 46, { fill: "#e8e8e8", bold: true });
    d.rows.forEach((r, i) => {
      ctx.font = "26px " + FONT;
      const lines = wrap(r.desc, widths[1] - 20);
      const rowH = Math.max(46, lines.length * 36 + 12);
      if (y + rowH > H - M - 120) { newPage(); drawRow(heads, 46, { fill: "#e8e8e8", bold: true }); }
      drawRow([toBn(i + 1), lines, r.qty ? toBn(toEn(r.qty)) : "", r.qty ? r.unit : "", parseNum(r.rate) ? fmtNum(parseNum(r.rate)) : "",
        lineDiscount(r) ? fmtNum(lineDiscount(r)) : "০", fmtNum(lineTotal(r))], rowH, {});
    });
    if (y + 110 > H - M) newPage();
    const span = (label, val) => {
      const w6 = widths.slice(0, 6).reduce((a, b) => a + b, 0);
      ctx.fillStyle = "#f2f2f2"; ctx.fillRect(M, y, w6 + widths[6], 46); ctx.fillStyle = "#111";
      ctx.strokeStyle = "#444"; ctx.strokeRect(M, y, w6, 46); ctx.strokeRect(M + w6, y, widths[6], 46);
      ctx.font = "700 26px " + FONT; ctx.textAlign = "right";
      ctx.fillText(label, M + w6 - 10, y + 25); ctx.fillText(val, M + w6 + widths[6] - 10, y + 25); y += 46;
    };
    span("সর্বমোট ছাড়", fmtNum(d.totalDiscount));
    span("সর্বমোট টাকা", fmtNum(d.grandTotal));
    canvases.forEach((c, i) => {
      const cx = c.getContext("2d"); cx.font = "22px " + FONT; cx.fillStyle = "#666"; cx.textAlign = "center"; cx.textBaseline = "middle";
      cx.fillText("পৃষ্ঠা " + toBn(i + 1) + " / " + toBn(canvases.length), W / 2, H - 36);
    });
    return canvases.map((c) => {
      const b64 = c.toDataURL("image/jpeg", 0.92).split(",")[1];
      const bin = atob(b64); const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { jpeg: bytes, w: c.width, h: c.height };
    });
  }

  async function downloadPdf(d) {
    const pages = await renderPdfPages(d);
    const bytes = buildPdf(pages);
    if (isNative()) { await saveNative(bytes, "khasra-khata_" + d.date + "_" + d.id + ".pdf"); return; }
    const safe = (d.name || "list").replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40);
    download(bytes, "খসড়া-খাতা_" + safe + "_" + d.date + ".pdf");
  }

  /* ---------------- screens ---------------- */
  function Module({ onClose, storageId, registerBack }) {
    const [screen, setScreen] = useState("main"); // main | history | detail
    const [drafts, setDrafts] = useState(() => loadDrafts(window.localStorage, storageId));
    const [name, setName] = useState("");
    const [date, setDate] = useState(todayYmd());
    const [rows, setRows] = useState(() => newRows());
    const [editingId, setEditingId] = useState(null);
    const [err, setErr] = useState("");
    const [msg, setMsg] = useState("");
    const [query, setQuery] = useState("");
    const [viewId, setViewId] = useState(null);
    const [confirmDel, setConfirmDel] = useState(false);
    const [busy, setBusy] = useState(false);
    const [focusReq, setFocusReq] = useState(null);
    const refs = useRef({});

    // hardware/phone back: detail → history → main, then let the app close us
    useEffect(() => {
      if (!registerBack) return;
      registerBack(() => {
        if (screen === "detail") { setScreen("history"); setConfirmDel(false); return true; }
        if (screen === "history") { setScreen("main"); return true; }
        return false;
      });
      return () => registerBack(null);
    }, [screen, registerBack]);

    useEffect(() => {
      if (!focusReq) return;
      const el = refs.current[focusReq.col + "-" + focusReq.index];
      if (el && el.focus) el.focus();
      setFocusReq(null);
    }, [focusReq]);

    const tot = useMemo(() => totals(rows), [rows]);
    const persist = (list) => { setDrafts(list); saveDrafts(window.localStorage, storageId, list); };

    const setCell = (i, field, value) => { setMsg(""); setRows((rs) => rs.map((r, k) => (k === i ? Object.assign({}, r, { [field]: value }) : r))); };
    const onEnter = (col, i) => (e) => {
      if (e.key !== "Enter" || (e.nativeEvent && e.nativeEvent.isComposing)) return;
      e.preventDefault();
      const act = enterNav(col, i, rows);
      if (act.type === "add") setRows((rs) => [...rs, newRow()]);
      if (act.type !== "none") setFocusReq({ col: act.col, index: act.index });
    };

    const resetForm = () => { setName(""); setDate(todayYmd()); setRows(newRows()); setEditingId(null); setErr(""); };

    const save = () => {
      const fields = { name: name, date: date, rows: rows };
      const problem = validateDraft(fields);
      if (problem) { setErr(problem); setMsg(""); return; }
      const existing = drafts.find((x) => x.id === editingId) || null;
      const d = buildDraft(fields, existing);
      persist(existing ? drafts.map((x) => (x.id === d.id ? d : x)) : [...drafts, d]);
      resetForm();
      setMsg("✓ খসড়া সংরক্ষিত হয়েছে — ইতিহাস (📜) থেকে দেখুন");
    };

    const editDraft = (d) => {
      const r = d.rows.map((x) => Object.assign({}, x));
      setName(d.name); setDate(d.date); setRows([...r, ...newRows(Math.max(0, INITIAL_ROWS - r.length))]);
      setEditingId(d.id); setErr(""); setMsg(""); setConfirmDel(false); setScreen("main");
    };

    const openHistory = () => { setScreen("history"); setMsg(""); };

    /* ----- main ----- */
    const header = (titleText, left, right) => h("div", { style: S.header }, left, h("div", { style: S.title }, titleText), right);

    if (screen === "main") {
      return h("div", { style: S.overlay }, h("div", { style: S.sheet },
        header("বাজার সদাইয়ের হিসাব",
          h("button", { style: S.iconBtn, onClick: onClose, "aria-label": "বন্ধ করুন" }, "✕"),
          h("button", { style: S.iconBtn, onClick: openHistory, "aria-label": "ইতিহাস / সামারি" }, "📜")),
        h("div", { style: S.body },
          editingId && h("div", { style: Object.assign({}, S.muted, { marginBottom: 6, color: "var(--hk-gold)" }) }, "✎ সংরক্ষিত তালিকা সম্পাদনা করা হচ্ছে ",
            h("button", { style: { background: "none", border: "none", color: "var(--hk-text-muted)", textDecoration: "underline", fontFamily: "inherit", fontSize: 12.5 }, onClick: resetForm }, "বাতিল")),
          h("label", { style: S.label }, "সংগঠন/অনুষ্ঠানের নাম"),
          h("input", { style: S.input, value: name, placeholder: "যেমন: বার্ষিক মিলাদ ও দোয়া মাহফিল", onChange: (e) => { setName(e.target.value); setErr(""); } }),
          h("label", { style: S.label }, "তারিখ"),
          h("input", { style: S.input, type: "date", value: date, onChange: (e) => setDate(e.target.value) }),
          h("div", { style: { overflowX: "auto", marginTop: 12 } },
            h("table", { style: { borderCollapse: "collapse", width: TABLE_W, tableLayout: "fixed" } },
              h("colgroup", null, COLS.map((c) => h("col", { key: c.key, style: { width: c.w } }))),
              h("thead", null, h("tr", null, COLS.map((c) => h("th", { key: c.key, style: S.th }, c.label)))),
              h("tbody", null, rows.map((r, i) => h("tr", { key: i },
                h("td", { style: Object.assign({}, S.cell, { textAlign: "center", fontSize: 13 }) }, toBn(i + 1)),
                h("td", { style: S.cell }, h("input", { style: S.cellInput, value: r.desc, placeholder: i === 0 ? "যেমন: চাল (মিনিক্যাট)" : "", enterKeyHint: "next",
                  ref: (el) => { refs.current["desc-" + i] = el; }, onChange: (e) => setCell(i, "desc", e.target.value), onKeyDown: onEnter("desc", i) })),
                ["qty", "unit"].map((f) => f === "qty"
                  ? h("td", { key: f, style: S.cell }, h("input", { style: Object.assign({}, S.cellInput, { textAlign: "right" }), inputMode: "decimal", value: r.qty, enterKeyHint: "next",
                      ref: (el) => { refs.current["qty-" + i] = el; }, onChange: (e) => setCell(i, "qty", e.target.value), onKeyDown: onEnter("qty", i) }))
                  : h("td", { key: f, style: S.cell }, h("select", { style: S.cellInput, value: r.unit, onChange: (e) => setCell(i, "unit", e.target.value) },
                      UNITS.map((u) => h("option", { key: u, value: u }, u))))),
                h("td", { style: S.cell }, h("input", { style: Object.assign({}, S.cellInput, { textAlign: "right" }), inputMode: "decimal", value: r.rate, enterKeyHint: "next",
                  ref: (el) => { refs.current["rate-" + i] = el; }, onChange: (e) => setCell(i, "rate", e.target.value), onKeyDown: onEnter("rate", i) })),
                h("td", { style: S.cell }, h("input", { style: Object.assign({}, S.cellInput, { textAlign: "right" }), inputMode: "decimal", value: r.discount, placeholder: "০ / ১০%", enterKeyHint: "next",
                  ref: (el) => { refs.current["discount-" + i] = el; }, onChange: (e) => setCell(i, "discount", e.target.value), onKeyDown: onEnter("discount", i) })),
                h("td", { style: Object.assign({}, S.cell, { textAlign: "right", padding: "0 6px", fontWeight: 600, fontSize: 13.5 }) }, isBlankRow(r) ? "" : fmtNum(lineTotal(r)))))))),
          h("div", { style: Object.assign({}, S.muted, { marginTop: 8 }) }, "মোট = (পরিমাণ × দর) − ছাড়। ছাড় টাকায় (৫০) বা শতাংশে (১০%) লেখা যাবে। বিবরণে Enter চাপলে নিচের লাইনে যাবে, শেষ লাইনে লিখে Enter দিলে নতুন লাইন তৈরি হবে।")),
        h("div", { style: S.footer },
          h("div", { style: S.totRow }, h("span", null, "সর্বমোট ছাড়"), h("strong", null, fmtTaka(tot.discount))),
          h("div", { style: Object.assign({}, S.totRow, { fontSize: 16, marginBottom: 0 }) }, h("span", null, "সর্বমোট টাকা"), h("strong", { style: { color: "var(--hk-gold)" } }, fmtTaka(tot.grand))),
          err && h("div", { style: { color: "var(--hk-danger)", fontSize: 12.5, marginTop: 6 } }, err),
          msg && h("div", { style: { color: "var(--hk-success)", fontSize: 12.5, marginTop: 6 } }, msg),
          h("button", { style: S.primary, onClick: save }, "💾 খসড়া সংরক্ষণ করুন"))));
    }

    /* ----- history ----- */
    if (screen === "history") {
      const list = searchDrafts(drafts, query);
      return h("div", { style: S.overlay }, h("div", { style: S.sheet },
        header("ইতিহাস ও সামারি", h("button", { style: S.iconBtn, onClick: () => setScreen("main"), "aria-label": "পিছনে" }, "‹"), null),
        h("div", { style: S.body },
          h("input", { style: S.input, value: query, placeholder: "🔍 তারিখ বা অনুষ্ঠানের নাম দিয়ে খুঁজুন", onChange: (e) => setQuery(e.target.value) }),
          h("div", { style: { height: 10 } }),
          list.length === 0
            ? h("div", { style: Object.assign({}, S.muted, { textAlign: "center", padding: "30px 0" }) }, drafts.length === 0 ? "এখনও কোনো খসড়া সংরক্ষণ করা হয়নি।" : "কিছু পাওয়া যায়নি।")
            : list.map((d) => h("div", { key: d.id, style: S.card },
              h("div", { style: S.muted }, "তারিখ: ", dateBn(d.date)),
              h("div", { style: { fontWeight: 700, margin: "3px 0" } }, "প্রসঙ্গ: ", d.name),
              h("div", null, "মোট খরচ: ", h("strong", null, fmtNum(d.grandTotal) + " টাকা")),
              h("button", { style: Object.assign({}, S.ghost, { width: "100%", flex: "none", marginTop: 8 }), onClick: () => { setViewId(d.id); setConfirmDel(false); setScreen("detail"); } }, "বিস্তারিত দেখুন"))))));
    }

    /* ----- detail / print ----- */
    const d = drafts.find((x) => x.id === viewId);
    if (!d) { setTimeout(() => setScreen("history"), 0); return null; }
    return h("div", { style: S.overlay }, h("div", { style: S.sheet },
      header("বিস্তারিত", h("button", { style: S.iconBtn, onClick: () => setScreen("history"), "aria-label": "পিছনে" }, "‹"), null),
      h("div", { style: S.body },
        h("div", { style: { textAlign: "center", marginBottom: 10 } },
          h("div", { style: { fontWeight: 700, fontSize: 16 } }, d.name), h("div", { style: S.muted }, dateBn(d.date))),
        h("div", { style: { overflowX: "auto" } },
          h("table", { style: { borderCollapse: "collapse", width: TABLE_W, tableLayout: "fixed", fontSize: 13.5 } },
            h("colgroup", null, COLS.map((c) => h("col", { key: c.key, style: { width: c.w } }))),
            h("thead", null, h("tr", null, COLS.map((c) => h("th", { key: c.key, style: S.th }, c.label)))),
            h("tbody", null,
              d.rows.map((r, i) => h("tr", { key: i },
                h("td", { style: Object.assign({}, S.cell, { textAlign: "center" }) }, toBn(i + 1)),
                h("td", { style: Object.assign({}, S.cell, { padding: "5px 6px", wordBreak: "break-word" }) }, r.desc),
                h("td", { style: Object.assign({}, S.cell, { textAlign: "right", padding: "0 6px" }) }, r.qty ? toBn(toEn(r.qty)) : ""),
                h("td", { style: Object.assign({}, S.cell, { textAlign: "center" }) }, r.qty ? r.unit : ""),
                h("td", { style: Object.assign({}, S.cell, { textAlign: "right", padding: "0 6px" }) }, parseNum(r.rate) ? fmtNum(parseNum(r.rate)) : ""),
                h("td", { style: Object.assign({}, S.cell, { textAlign: "right", padding: "0 6px" }) }, lineDiscount(r) ? fmtNum(lineDiscount(r)) : "০"),
                h("td", { style: Object.assign({}, S.cell, { textAlign: "right", padding: "0 6px", fontWeight: 600 }) }, fmtNum(lineTotal(r))))),
              h("tr", null, h("td", { colSpan: 5, style: Object.assign({}, S.cell, { textAlign: "right", padding: "6px", fontWeight: 700 }) }, "সর্বমোট ছাড়"),
                h("td", { style: Object.assign({}, S.cell, { textAlign: "right", padding: "6px", fontWeight: 700 }) }, fmtNum(d.totalDiscount)), h("td", { style: S.cell })),
              h("tr", null, h("td", { colSpan: 6, style: Object.assign({}, S.cell, { textAlign: "right", padding: "6px", fontWeight: 700 }) }, "সর্বমোট টাকা"),
                h("td", { style: Object.assign({}, S.cell, { textAlign: "right", padding: "6px", fontWeight: 700, color: "var(--hk-gold)" }) }, fmtNum(d.grandTotal))))))),
      h("div", { style: S.footer },
        h("div", { style: { display: "flex", gap: 8 } },
          h("button", { style: S.ghost, onClick: () => printDraft(d) }, "🖨️ প্রিন্ট করুন"),
          h("button", { style: S.ghost, disabled: busy, onClick: async () => { setBusy(true); try { await downloadPdf(d); } catch (e) { setMsg("পিডিএফ তৈরি করা যায়নি"); } setBusy(false); } }, busy ? "অপেক্ষা করুন…" : "📥 পিডিএফ ডাউনলোড")),
        h("div", { style: { display: "flex", gap: 8, marginTop: 8 } },
          h("button", { style: S.ghost, onClick: () => editDraft(d) }, "✎ সম্পাদনা"),
          confirmDel
            ? h("button", { style: Object.assign({}, S.ghost, { color: "var(--hk-danger)", borderColor: "var(--hk-danger)" }), onClick: () => { persist(drafts.filter((x) => x.id !== d.id)); setConfirmDel(false); setScreen("history"); } }, "নিশ্চিত? মুছে ফেলুন")
            : h("button", { style: S.ghost, onClick: () => setConfirmDel(true) }, "🗑️ মুছুন")),
        msg && h("div", { style: { color: "var(--hk-danger)", fontSize: 12.5, marginTop: 6 } }, msg))));
  }

  window.KhasraKhata = { Module: Module, _saveNative: saveNative, _isNative: isNative };
})(typeof globalThis !== "undefined" ? globalThis : this);
