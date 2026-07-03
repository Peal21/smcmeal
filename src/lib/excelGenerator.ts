import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { YEAR_LABELS, buildMealExportData, type ExtraMeal, type Meal, type Profile } from './mealExportData';

const BATCH_COLORS: string[] = ['FF1B5E20', 'FF0D47A1', 'FF4A148C', 'FFE65100', 'FFB71C1C', 'FF37474F'];
const BATCH_LIGHT: string[] = ['FFE8F5E9', 'FFE3F2FD', 'FFF3E5F5', 'FFFFF3E0', 'FFFFEBEE', 'FFECEFF1'];

const B: Partial<ExcelJS.Borders> = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
const F = 'Bangla MN';

export async function generateMealExcel(
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
  // Each batch = 5 cols: Name, L, D, Extra Item, Extra (others)
  const totalCols = 1 + bc * 5; // SL + batches

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Meal Export', {
    properties: { defaultRowHeight: 13.5 },
    pageSetup: {
      paperSize: 9, orientation: 'landscape', fitToPage: true,
      fitToWidth: 1, fitToHeight: 1, horizontalCentered: true,
      margins: { left: 0.15, right: 0.15, top: 0.2, bottom: 0.2, header: 0.1, footer: 0.1 },
    },
  });

  const cols: Partial<ExcelJS.Column>[] = [{ width: 4 }]; // SL
  for (let i = 0; i < bc; i++) {
    cols.push({ width: 17 }); // Name
    cols.push({ width: 3 });  // L
    cols.push({ width: 3 });  // D
    cols.push({ width: 12 }); // Extra Item (Goru/Khasi)
    cols.push({ width: 15 }); // Extra (wider for special items)
  }
  ws.columns = cols;

  const center: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
  const left: Partial<ExcelJS.Alignment> = { horizontal: 'left', vertical: 'middle', wrapText: true };

  const dateLabel = format(new Date(selectedDate), 'dd/MM/yyyy');
  const genderLabel = filterGender === 'male' ? 'ছাত্র হোস্টেল' : 'ছাত্রী হোস্টেল';

  // Row 1: Title
  const r1 = ws.addRow([`সাতক্ষীরা মেডিকেল কলেজ ডাইনিং (${genderLabel})`]);
  ws.mergeCells(r1.number, 1, r1.number, totalCols);
  r1.getCell(1).font = { name: F, size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  r1.getCell(1).alignment = center;
  r1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E20' } };
  r1.getCell(1).border = B;
  r1.height = 24;

  // Row 2: Date
  const r2 = ws.addRow([`তারিখ - ${dateLabel}`]);
  ws.mergeCells(r2.number, 1, r2.number, totalCols);
  r2.getCell(1).font = { name: F, size: 10, bold: true, color: { argb: 'FF1B5E20' } };
  r2.getCell(1).alignment = center;
  r2.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
  r2.getCell(1).border = B;
  r2.height = 18;

  // Row 3: Batch headers (each spans 5 cols)
  const h1Data: string[] = ['ক্র.নং'];
  for (const b of batches) h1Data.push(YEAR_LABELS[b.year] || b.year, '', '', '', '');
  const h1 = ws.addRow(h1Data);
  h1.height = 17;
  for (let i = 0; i < bc; i++) {
    const sc = 2 + i * 5;
    ws.mergeCells(h1.number, sc, h1.number, sc + 4);
  }
  h1.getCell(1).font = { name: F, size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
  h1.getCell(1).alignment = center;
  h1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF37474F' } };
  h1.getCell(1).border = B;
  for (let i = 0; i < bc; i++) {
    const sc = 2 + i * 5;
    for (let c = sc; c <= sc + 4; c++) {
      const cell = h1.getCell(c);
      cell.font = { name: F, size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = center;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BATCH_COLORS[i % BATCH_COLORS.length] } };
      cell.border = B;
    }
  }

  // Row 4: Sub-header (Name, L, D, এক্সট্রা আইটেম, বিবিধ)
  const h2Data: string[] = [''];
  for (let i = 0; i < bc; i++) h2Data.push('নাম', 'L', 'D', 'এক্সট্রা আইটেম', 'বিবিধ');
  const h2 = ws.addRow(h2Data);
  h2.height = 14;
  h2.getCell(1).font = { name: F, size: 7, bold: true };
  h2.getCell(1).alignment = center;
  h2.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
  h2.getCell(1).border = B;
  for (let i = 0; i < bc; i++) {
    const sc = 2 + i * 5;
    const tint = BATCH_LIGHT[i % BATCH_LIGHT.length];
    const text = BATCH_COLORS[i % BATCH_COLORS.length];
    for (let c = sc; c <= sc + 4; c++) {
      const cell = h2.getCell(c);
      cell.font = { name: F, size: 7.5, bold: true, color: { argb: text } };
      cell.alignment = center;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tint } };
      cell.border = B;
    }
  }

  // Data rows
  for (let r = 0; r < maxRows; r++) {
    const rd: (string | number)[] = [r + 1];
    for (const batch of batches) {
      const m = batch.members[r];
      rd.push(
        m ? m.name : '',
        m ? m.lunch : '',
        m ? m.dinner : '',
        m ? m.extraItemText || '' : '',
        m ? m.otherExtraText || '' : ''
      );
    }
    const row = ws.addRow(rd);
    row.height = 13.5;
    const isEven = r % 2 === 0;

    row.getCell(1).border = B;
    row.getCell(1).font = { name: F, size: 7.5 };
    row.getCell(1).alignment = center;
    if (isEven) row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };

    for (let i = 0; i < bc; i++) {
      const sc = 2 + i * 5;
      const tint = BATCH_LIGHT[i % BATCH_LIGHT.length];
      for (let c = sc; c <= sc + 4; c++) {
        const cell = row.getCell(c);
        cell.border = B;
        cell.font = { name: F, size: c >= sc + 3 ? 7 : 8 };
        const colOffset = c - sc;
        cell.alignment = colOffset === 0 || colOffset === 4 ? left : center;
        if (isEven) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tint } };
      }
    }
  }

  // Summary
  ws.addRow([]);
  const sumFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
  const sumFont: Partial<ExcelJS.Font> = { name: F, size: 9, bold: true };

  const addSumItem = (label: string, value: number) => {
    const rd: (string | number)[] = [label];
    for (let i = 1; i < totalCols - 1; i++) rd.push('');
    rd.push(value);
    const row = ws.addRow(rd);
    row.height = 16;
    ws.mergeCells(row.number, 1, row.number, totalCols - 1);
    row.getCell(1).font = sumFont;
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(1).fill = sumFill;
    row.getCell(1).border = B;
    row.getCell(totalCols).font = { ...sumFont, size: 10 };
    row.getCell(totalCols).alignment = center;
    row.getCell(totalCols).fill = sumFill;
    row.getCell(totalCols).border = B;
  };

  addSumItem('Total Lunch (incl. Extra)', totalLunch);
  addSumItem('Total Dinner (incl. Extra)', totalDinner);
  addSumItem('Total Meal Count', totalLunch + totalDinner);
  extraSummary.forEach((item) => addSumItem(item.label, item.value));
  if (specialSummary) {
    specialSummary.forEach((item) => addSumItem(`⭐ ${item.label}`, item.value));
  }

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `${fileName}_${selectedDate}.xlsx`);
}
