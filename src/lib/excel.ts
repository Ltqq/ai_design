import ExcelJS from 'exceljs';
import type { ModelDiscount } from '@/types';

function textOf(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    if ('result' in value) return textOf(value.result as ExcelJS.CellValue);
    if ('richText' in value) return value.richText.map(part=>part.text).join('');
    if ('text' in value) return String(value.text);
    return String(value);
  }
  return String(value);
}

export async function parseExcel(buffer: Buffer): Promise<ModelDiscount[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Excel 中没有工作表');
  const header = sheet.getRow(1);
  if (textOf(header.getCell(1).value).trim() !== '模型名称' || textOf(header.getCell(2).value).trim() !== '折扣' || sheet.columnCount !== 2) {
    throw new Error('Excel 必须只有两列：第一列「模型名称」，第二列「折扣」');
  }
  const models: ModelDiscount[] = [];
  for (let i=2; i<=sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    if (!row.hasValues) continue;
    const name=textOf(row.getCell(1).value).trim();
    const discount=textOf(row.getCell(2).value).trim();
    if (!name || !discount) throw new Error(`第 ${i} 行模型名称和折扣不能为空`);
    models.push({name,discount});
  }
  if (!models.length) throw new Error('Excel 中没有模型数据');
  return models;
}

export async function createExcelTemplate(): Promise<Buffer> {
  const workbook=new ExcelJS.Workbook();
  const sheet=workbook.addWorksheet('模型折扣');
  sheet.columns=[{header:'模型名称',key:'name',width:35},{header:'折扣',key:'discount',width:18}];
  sheet.addRow({name:'deepseek-v4.1-flash',discount:'4折'});
  sheet.getRow(1).font={bold:true};
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
