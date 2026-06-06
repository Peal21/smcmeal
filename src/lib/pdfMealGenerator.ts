import { format } from 'date-fns';
import { YEAR_LABELS, buildMealExportData, type ExtraMeal, type Meal, type Profile } from './mealExportData';

const BATCH_COLORS = ['#1B5E20', '#0D47A1', '#4A148C', '#E65100', '#B71C1C', '#37474F'];
const BATCH_LIGHT  = ['#E8F5E9', '#E3F2FD', '#F3E5F5', '#FFF3E0', '#FFEBEE', '#ECEFF1'];

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function generateMealPdf(
  profiles: Profile[],
  meals: Meal[],
  filterGender: 'male' | 'female',
  filterYears: string[],
  selectedDate: string,
  fileName: string,
  extraMeals?: ExtraMeal[],
  isFeastDay?: boolean,
  userSpecialMap?: Map<string, string[]>,
  specialSummary?: { label: string; value: number }[],
) {
  const { batches, extraSummary, totalLunch, totalDinner, maxRows } = buildMealExportData(
    profiles, meals, filterYears, extraMeals, isFeastDay, userSpecialMap,
  );

  const bc = batches.length;
  const totalCols = 1 + bc * 4;
  const dateLabel   = format(new Date(selectedDate), 'dd/MM/yyyy');
  const genderLabel = filterGender === 'male' ? 'ছাত্র হোস্টেল' : 'ছাত্রী হোস্টেল';

  // ── Header rows ──────────────────────────────────────────────────────────────
  let hdr1 = `<th rowspan="2" class="sl-hdr">ক্র.<br>নং</th>`;
  for (let i = 0; i < bc; i++) {
    hdr1 += `<th colspan="4" class="batch-hdr" style="background:${BATCH_COLORS[i % BATCH_COLORS.length]}">${
      esc(YEAR_LABELS[batches[i].year] || batches[i].year)
    }</th>`;
  }

  let hdr2 = '';
  for (let i = 0; i < bc; i++) {
    const bg = BATCH_LIGHT[i % BATCH_LIGHT.length];
    const fg = BATCH_COLORS[i % BATCH_COLORS.length];
    const s  = `background:${bg};color:${fg}`;
    hdr2 += `<th style="${s}">নাম</th><th style="${s}">L</th><th style="${s}">D</th><th style="${s}">বিবিধ</th>`;
  }

  // ── Data rows ─────────────────────────────────────────────────────────────────
  let body = '';
  for (let r = 0; r < maxRows; r++) {
    const isEven = r % 2 === 0;
    body += '<tr>';
    body += `<td class="sl"${isEven ? ' style="background:#F5F5F5"' : ''}>${r + 1}</td>`;
    for (let i = 0; i < bc; i++) {
      const m  = batches[i].members[r];
      const bg = isEven ? BATCH_LIGHT[i % BATCH_LIGHT.length] : '#FFFFFF';
      body += `<td class="name" style="background:${bg}">${m ? esc(m.name) : ''}</td>`;
      body += `<td class="ld"  style="background:${bg}">${m ? esc(m.lunch) : ''}</td>`;
      body += `<td class="ld"  style="background:${bg}">${m ? esc(m.dinner) : ''}</td>`;
      body += `<td class="xtr" style="background:${bg}">${m ? esc(m.extraText) : ''}</td>`;
    }
    body += '</tr>';
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  const sumItems = [
    { label: 'মোট লাঞ্চ (এক্সট্রা সহ)',  value: totalLunch },
    { label: 'মোট ডিনার (এক্সট্রা সহ)',  value: totalDinner },
    { label: 'মোট মিল সংখ্যা',           value: totalLunch + totalDinner },
    ...extraSummary,
    ...(specialSummary || []).map(s => ({ label: `⭐ ${s.label}`, value: s.value })),
  ];

  let sumRows = '';
  for (const item of sumItems) {
    sumRows += `<tr>
      <td colspan="${totalCols - 1}" class="sum-label">${esc(item.label)}</td>
      <td class="sum-val">${item.value}</td>
    </tr>`;
  }

  const totalMembers = batches.reduce((s, b) => s + b.members.length, 0);
  const fontSize = totalMembers > 100 ? '6pt' : totalMembers > 60 ? '6.5pt' : '7pt';

  // ── Full HTML page ────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8"/>
<title>${esc(fileName)}_${selectedDate}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Noto Sans Bengali', Arial, sans-serif;
    background: #fff;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Screen preview ── */
  .sheet {
    width: 297mm;
    min-height: 210mm;
    margin: 10mm auto;
    padding: 6mm;
    background: #fff;
    box-shadow: 0 0 10px rgba(0,0,0,.15);
  }

  /* ── Print: exact A4 landscape ── */
  @media print {
    @page { size: A4 landscape; margin: 6mm 5mm; }
    body  { margin: 0; }
    .sheet {
      width: 100%;
      min-height: unset;
      margin: 0;
      padding: 0;
      box-shadow: none;
    }
    .no-print { display: none !important; }
  }

  /* ── Title block ── */
  .title-box {
    background: #1B5E20;
    color: #fff;
    text-align: center;
    font-size: 11pt;
    font-weight: 700;
    padding: 3px 4px;
    border: 1.5px solid #000;
    letter-spacing: .3px;
  }
  .date-box {
    background: #E8F5E9;
    color: #1B5E20;
    text-align: center;
    font-size: 9pt;
    font-weight: 700;
    padding: 2px 4px;
    border: 1.5px solid #000;
    border-top: none;
    margin-bottom: 2px;
  }

  /* ── Main table ── */
  .main-tbl {
    width: 100%;
    border-collapse: collapse;
    table-layout: auto;
  }
  .main-tbl th, .main-tbl td {
    border: 1px solid #555;
    padding: 1px 2px;
    font-size: ${fontSize};
    line-height: 1.25;
    vertical-align: middle;
    white-space: nowrap;
  }
  .sl-hdr {
    background: #37474F;
    color: #fff;
    text-align: center;
    font-weight: 700;
    white-space: nowrap;
    min-width: 18px;
  }
  .batch-hdr {
    color: #fff;
    text-align: center;
    font-weight: 700;
    letter-spacing: .2px;
  }
  .main-tbl thead tr:nth-child(2) th {
    font-weight: 700;
    text-align: center;
  }
  .sl {
    text-align: center;
    min-width: 16px;
    font-size: ${fontSize};
  }
  .name {
    font-size: ${fontSize};
    min-width: 70px;
  }
  .ld {
    text-align: center;
    min-width: 14px;
    font-size: ${fontSize};
  }
  .xtr {
    font-size: calc(${fontSize} - 0.5pt);
    min-width: 60px;
    white-space: normal;
    word-break: break-word;
  }

  /* ── Summary table ── */
  .sum-tbl {
    width: 100%;
    border-collapse: collapse;
    margin-top: 3px;
  }
  .sum-tbl td {
    border: 1px solid #555;
    font-size: calc(${fontSize} + 0.5pt);
    padding: 2px 5px;
  }
  .sum-label {
    background: #FFF9C4;
    font-weight: 600;
    text-align: right;
  }
  .sum-val {
    background: #FFF9C4;
    font-weight: 700;
    text-align: center;
    min-width: 30px;
  }

  /* ── Print button (screen only) ── */
  .print-btn {
    display: block;
    margin: 8mm auto;
    padding: 10px 30px;
    background: #1B5E20;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    cursor: pointer;
    font-weight: 700;
  }
  .print-btn:hover { background: #2E7D32; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨️ PDF হিসেবে সেভ করুন (Print → Save as PDF)</button>
<div class="sheet">
  <div class="title-box">সাতক্ষীরা মেডিকেল কলেজ ডাইনিং — ${genderLabel}</div>
  <div class="date-box">তারিখ: ${dateLabel}</div>

  <table class="main-tbl">
    <thead>
      <tr>${hdr1}</tr>
      <tr>${hdr2}</tr>
    </thead>
    <tbody>${body}</tbody>
  </table>

  <table class="sum-tbl">
    ${sumRows}
  </table>
</div>
<button class="print-btn no-print" onclick="window.print()">🖨️ PDF হিসেবে সেভ করুন (Print → Save as PDF)</button>
<script>
  // Wait for Bengali font to load, then auto-trigger print dialog
  document.fonts.ready.then(() => {
    setTimeout(() => { window.print(); }, 800);
  });
</script>
</body>
</html>`;

  // Open in new tab and trigger print
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (!win) {
    // fallback: download html
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}_${selectedDate}.html`;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
