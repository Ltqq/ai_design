import ExcelJS from 'exceljs';
import type { SheetData } from '@/types';

function textOf(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0,10);
  if (typeof value === 'object') {
    if ('result' in value) return textOf(value.result as ExcelJS.CellValue);
    if ('richText' in value) return value.richText.map(part=>part.text).join('');
    if ('text' in value) return String(value.text);
    return JSON.stringify(value);
  }
  return String(value);
}
export async function parseExcel(buffer: Buffer): Promise<SheetData[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as Parameters<typeof workbook.xlsx.load>[0]);
  return workbook.worksheets.map(sheet => {
    const header = sheet.getRow(1);
    const columns = Array.from({length:sheet.columnCount},(_,i)=>textOf(header.getCell(i+1).value)).filter(Boolean);
    const rows: Record<string,string>[] = [];
    for (let index=2; index<=sheet.rowCount; index++) {
      const row = sheet.getRow(index);
      if (!row.hasValues) continue;
      rows.push(Object.fromEntries(columns.map((col,i)=>[col,textOf(row.getCell(i+1).value)])));
    }
    return { name:sheet.name, columns, rows };
  }).filter(s=>s.columns.length>0);
}
