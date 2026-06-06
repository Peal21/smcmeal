import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { YEAR_LABELS, buildMealExportData, type ExtraMeal, type Meal, type Profile } from './mealExportData';

const BATCH_COLORS = ['#1B5E20', '#0D47A1', '#4A148C', '#E65100', '#B71C1C', '#37474F'];
const BATCH_LIGHT = ['#E8F5E9', '#E3F2FD', '#F3E5F5', '#FFF3E0', '#FFEBEE', '#ECEFF1'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
  const totalCols = 1 + bc * 4; // SL + (Name, L, D, Extra) per batch
  const dateLabel = format(new Date(selectedDate), 'dd/MM/yy');
  const genderLabel = filterGender === 'male' ? 'ছাত্র হোস্টেল' : 'ছাত্রী হোস্টেল';

  // Header row 1
  let hdr1 = `<th rowspan="2" class="sl-hdr">ক্র.নং</th>`;
  for (let i = 0; i < bc; i++) {
    hdr1 += `<th colspan="4" class="batch-hdr" style="background:${BATCH_COLORS[i % BATCH_COLORS.length]}">${esc(YEAR_LABELS[batches[i].year] || batches[i].year)}</th>`;
  }

  // Sub header
  let hdr2 = '';
  for (let i = 0; i < bc; i++) {
    const bg = BATCH_LIGHT[i % BATCH_LIGHT.length];
    const fg = BATCH_COLORS[i % BATCH_COLORS.length];
    const s = `background:${bg};color:${fg}`;
    hdr2 += `<th class="sub-hdr" style="${s}">নাম</th><th class="sub-hdr" style="${s}">L</th><th class="sub-hdr" style="${s}">D</th><th class="sub-hdr" style="${s}">বিবিধ</th>`;
  }

  // Data rows
  let body = '';
  for (let r = 0; r < maxRows; r++) {
    const isEven = r % 2 === 0;
    body += '<tr>';
    body += `<td class="sl"${isEven ? ' style="background:#FAFAFA"' : ''}>${r + 1}</td>`;
    for (let i = 0; i < bc; i++) {
      const m = batches[i].members[r];
      const bg = isEven ? BATCH_LIGHT[i % BATCH_LIGHT.length] : '#FFFFFF';
      body += `<td class="name" style="background:${bg}">${m ? esc(m.name) : ''}</td>`;
      body += `<td class="ld" style="background:${bg}">${m ? esc(m.lunch) : ''}</td>`;
      body += `<td class="ld" style="background:${bg}">${m ? esc(m.dinner) : ''}</td>`;
      body += `<td class="extra" style="background:${bg}">${m ? esc(m.extraText) : ''}</td>`;
    }
    body += '</tr>';
  }

  // Summary
  const sumItems = [
    { label: 'Total Lunch (incl. Extra)', value: totalLunch },
    { label: 'Total Dinner (incl. Extra)', value: totalDinner },
    { label: 'Total Meal Count', value: totalLunch + totalDinner },
    ...extraSummary,
    ...(specialSummary || []).map(s => ({ label: `⭐ ${s.label}`, value: s.value })),
  ];
  let sumHtml = '';
  for (const item of sumItems) {
    sumHtml += `<tr><td colspan="${totalCols - 1}" class="sum-label">${esc(item.label)}</td><td class="sum-val">${item.value}</td></tr>`;
  }

  const totalMembers = batches.reduce((s, b) => s + b.members.length, 0);
  const fontSize = totalMembers > 100 ? 6.5 : totalMembers > 60 ? 7 : 7.5;
  const containerWidth = 1123;
  const slW = 20;
  const ldW = 14;
  const extraW = 110;
  const nameW = Math.floor((containerWidth - slW - bc * (ldW * 2 + extraW)) / Math.max(1, bc));

  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.cssText = `position:fixed;left:-100000px;top:0;width:${containerWidth}px;z-index:-1`;

  container.innerHTML = `
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      .sheet{width:${containerWidth}px;background:#fff;padding:6px;font-family:'Noto Sans Bengali',Arial,sans-serif;color:#111}
      .title{text-align:center;font-size:${fontSize+5}px;font-weight:700;line-height:1.3;background:#1B5E20;color:#fff;border:1px solid #333;padding:6px 0 2px}
      .date{text-align:center;font-size:${fontSize+3}px;font-weight:700;line-height:1.3;background:#E8F5E9;color:#1B5E20;border:1px solid #333;border-top:none;margin-bottom:2px}
      .main-tbl{width:100%;border-collapse:collapse;table-layout:fixed}
      .sl-hdr{width:${slW}px;background:#37474F;color:#fff;font-size:${fontSize}px;font-weight:700;text-align:center;border:1px solid #333;padding:1px}
      .batch-hdr{color:#fff;font-size:${fontSize+0.5}px;font-weight:700;text-align:center;border:1px solid #333;padding:2px}
      .sub-hdr{font-size:${fontSize-0.5}px;font-weight:700;text-align:center;border:1px solid #999;padding:0 1px}
      .sl{border:1px solid #999;text-align:center;font-size:${fontSize-0.5}px;padding:0 1px;line-height:1.15;vertical-align:top}
      .name{border:1px solid #999;font-size:${fontSize}px;padding:0 2px;line-height:1.15;vertical-align:top;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:${nameW}px;max-width:${nameW}px}
      .ld{border:1px solid #999;text-align:center;font-size:${fontSize}px;padding:0;line-height:1.15;vertical-align:top;width:${ldW}px}
      .extra{border:1px solid #999;font-size:${fontSize-1}px;padding:0 1px;line-height:1.15;vertical-align:top;word-wrap:break-word;overflow-wrap:break-word;white-space:normal;width:${extraW}px;max-width:${extraW}px}
      .sum-tbl{width:100%;border-collapse:collapse;margin-top:4px}
      .sum-label{background:#FFF9C4;border:1px solid #999;font-size:${fontSize+0.5}px;font-weight:700;padding:2px 4px;text-align:left}
      .sum-val{background:#FFF9C4;border:1px solid #999;font-size:${fontSize+1}px;font-weight:700;padding:2px 6px;text-align:center}
    </style>
    <div class="sheet">
      <div class="title">সাতক্ষীরা মেডিকেল কলেজ ডাইনিং (${genderLabel})</div>
      <div class="date">তারিখ - ${dateLabel}</div>
      <table class="main-tbl"><thead><tr>${hdr1}</tr><tr>${hdr2}</tr></thead><tbody>${body}</tbody></table>
      <table class="sum-tbl">${sumHtml}</table>
    </div>`;

  document.body.appendChild(container);

  try {
    if ('fonts' in document) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1200))]);
    await new Promise<void>(r => requestAnimationFrame(() => r()));

    const canvas = await html2canvas(container.querySelector('.sheet') as HTMLElement, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
    });

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    let rw = pw;
    let rh = (canvas.height * rw) / canvas.width;
    if (rh > ph) { rh = ph; rw = (canvas.width * rh) / canvas.height; }

    doc.addImage(imgData, 'JPEG', (pw - rw) / 2, 0, rw, rh, undefined, 'FAST');
    doc.save(`${fileName}_${selectedDate}.pdf`);
  } finally {
    container.remove();
  }
}
