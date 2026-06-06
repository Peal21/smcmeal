import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' }, bottom: { style: 'thin' },
  left: { style: 'thin' }, right: { style: 'thin' },
};
const FONT = 'Bangla MN';

const YEAR_ORDER = ['5th', '4th', '3rd', '2nd', '1st', 'extra'] as const;
const YEAR_LABELS: Record<string, string> = {
  '1st': '1st Year', '2nd': '2nd Year', '3rd': '3rd Year',
  '4th': '4th Year', '5th': '5th Year', extra: 'Extra',
};

interface Member { user_id: string; full_name: string; year: string; roll_number: string | null; gender: string; }

export async function generatePaymentExcel(
  members: Member[],
  mealCountMap: Map<string, number>,
  paidMap: Map<string, number>,
  mealRate: number,
  minMeals: number,
  extraCharge: number,
  monthLabel: string,
  filterGender: 'all' | 'male' | 'female',
  paidCashMap?: Map<string, number>,
  paidBikashMap?: Map<string, number>,
) {
  const filtered = filterGender === 'all' ? members : members.filter(m => m.gender === filterGender);

  const grouped = new Map<string, Member[]>();
  for (const year of YEAR_ORDER) {
    const list = filtered.filter(m => m.year === year);
    if (list.length) grouped.set(year, list);
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Payment Report', {
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      pageOrder: 'downThenOver',
      margins: { left: 0.2, right: 0.2, top: 0.25, bottom: 0.25, header: 0.1, footer: 0.1 },
    },
  });

  ws.pageSetup.paperSize = 9;
  ws.pageSetup.orientation = 'landscape';
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 0;
  ws.pageSetup.horizontalCentered = true;
  ws.pageSetup.pageOrder = 'downThenOver';
  ws.pageSetup.margins = { left: 0.2, right: 0.2, top: 0.25, bottom: 0.25, header: 0.1, footer: 0.1 };

  ws.columns = [
    { width: 5 }, { width: 26 }, { width: 9 },
    { width: 10 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 9 },
  ];

  const TOTAL_COLS = 10;
  const genderLabel = filterGender === 'male' ? 'Boys' : filterGender === 'female' ? 'Girls' : 'All';
  const titleRow = ws.addRow([`Satkhira Medical College — ${genderLabel} Payment Report`]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, TOTAL_COLS);
  titleRow.getCell(1).font = { name: FONT, size: 12, bold: true };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  const extraText = extraCharge ? ` | Extra Charge: ৳${extraCharge}` : '';
  const minText = minMeals ? ` | Minimum Meals: ${minMeals}` : '';
  const subRow = ws.addRow([`Month: ${monthLabel} | Meal Rate: ৳${mealRate}${minText}${extraText}`]);
  ws.mergeCells(subRow.number, 1, subRow.number, TOTAL_COLS);
  subRow.getCell(1).font = { name: FONT, size: 10 };
  subRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  ws.addRow([]);

  const hdr = ws.addRow(['SL', 'Name', 'Roll', 'Total Meal', 'Total Tk (৳)', 'Cash (৳)', 'Bikash (৳)', 'Joma (৳)', 'Baki (৳)', 'Status']);
  hdr.eachCell(cell => {
    cell.font = { name: FONT, size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } };
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  ws.pageSetup.printTitlesRow = '1:4';

  let serial = 1;
  let grandTotalDue = 0, grandTotalPaid = 0, grandTotalCash = 0, grandTotalBikash = 0;

  for (const [year, list] of grouped.entries()) {
    const batchRow = ws.addRow([`${YEAR_LABELS[year]} Batch`]);
    ws.mergeCells(batchRow.number, 1, batchRow.number, TOTAL_COLS);
    batchRow.getCell(1).font = { name: FONT, size: 9, bold: true, color: { argb: 'FF0D47A1' } };
    batchRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
    batchRow.getCell(1).border = THIN_BORDER;

    for (const m of list) {
      const rawMeals = mealCountMap.get(m.user_id) || 0;
      const meals = minMeals > 0 && rawMeals < minMeals ? minMeals : rawMeals;
      const due = meals * mealRate + extraCharge;
      const paid = paidMap.get(m.user_id) || 0;
      const cash = paidCashMap?.get(m.user_id) ?? paid;
      const bikash = paidBikashMap?.get(m.user_id) ?? 0;
      const balance = due - paid;
      const status = balance <= 0 ? 'Paid' : 'Due';

      grandTotalDue += due;
      grandTotalPaid += paid;
      grandTotalCash += cash;
      grandTotalBikash += bikash;

      const row = ws.addRow([serial, m.full_name, m.roll_number || '', meals, due.toFixed(0), cash.toFixed(0), bikash.toFixed(0), paid.toFixed(0), balance.toFixed(0), status]);
      row.eachCell((cell, col) => {
        cell.border = THIN_BORDER;
        cell.font = { name: FONT, size: 9 };
        cell.alignment = { horizontal: col === 2 ? 'left' : 'center', vertical: 'middle' };
        if (col === 6 && cash > 0) cell.font = { name: FONT, size: 9, color: { argb: 'FF2E7D32' } };
        if (col === 7 && bikash > 0) cell.font = { name: FONT, size: 9, bold: true, color: { argb: 'FFE91E63' } };
        if (col === 10) {
          cell.font = { name: FONT, size: 9, bold: true, color: { argb: status === 'Paid' ? 'FF2E7D32' : 'FFC62828' } };
        }
      });
      serial++;
    }
  }


  ws.addRow([]);
  const addSum = (label: string, value: string | number, color?: string) => {
    const r = ws.addRow([label, '', '', '', '', '', '', '', value, '']);
    ws.mergeCells(r.number, 1, r.number, 8);
    r.getCell(1).font = { name: FONT, size: 9, bold: true };
    r.getCell(9).font = { name: FONT, size: 9, bold: true, color: color ? { argb: color } : undefined };
    r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
    r.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
    r.getCell(1).border = THIN_BORDER;
    r.getCell(9).border = THIN_BORDER;
    r.getCell(9).alignment = { horizontal: 'center' };
  };

  addSum('Total Due', `৳${grandTotalDue.toFixed(0)}`);
  addSum('Total Cash Collected', `৳${grandTotalCash.toFixed(0)}`, 'FF2E7D32');
  addSum('Total Bikash Collected', `৳${grandTotalBikash.toFixed(0)}`, 'FFE91E63');
  addSum('Total Paid (Cash + Bikash)', `৳${grandTotalPaid.toFixed(0)}`);
  addSum('Total Remaining', `৳${(grandTotalDue - grandTotalPaid).toFixed(0)}`, 'FFC62828');

  ws.pageSetup.printArea = `A1:J${ws.rowCount}`;

  const buffer = await wb.xlsx.writeBuffer();
  const gTag = filterGender === 'all' ? 'all' : filterGender === 'male' ? 'boys' : 'girls';
  saveAs(new Blob([buffer]), `payment_${gTag}_${monthLabel.replace(/\s/g, '_')}.xlsx`);
}
