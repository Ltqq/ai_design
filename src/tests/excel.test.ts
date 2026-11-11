import { describe,expect,it } from 'vitest';
import ExcelJS from 'exceljs';
import { parseExcel,createExcelTemplate } from '../lib/excel';

describe('两列 Excel 模型折扣表',()=>{
  it('解析真实 xlsx，严格保留模型名称与折扣文案',async()=>{
    const book=new ExcelJS.Workbook();
    const sheet=book.addWorksheet('模型折扣');
    sheet.addRow(['模型名称','折扣']);
    sheet.addRow(['deepseek-v4.1-flash','4折']);
    sheet.addRow(['kimi-k3','5.7折']);
    const buffer=Buffer.from(await book.xlsx.writeBuffer());
    expect(await parseExcel(buffer)).toEqual([{name:'deepseek-v4.1-flash',discount:'4折'},{name:'kimi-k3',discount:'5.7折'}]);
  });
  it('可下载的示例模板能被真实解析器读取',async()=>{
    const buffer=await createExcelTemplate();
    expect(await parseExcel(buffer)).toEqual([{name:'deepseek-v4.1-flash',discount:'4折'}]);
  });
  it('不是约定的两列表头时直接拒绝导入，不覆盖旧数据',async()=>{
    const book=new ExcelJS.Workbook();
    book.addWorksheet('错误格式').addRow(['模型名称','价格','折扣']);
    const buffer=Buffer.from(await book.xlsx.writeBuffer());
    await expect(parseExcel(buffer)).rejects.toThrow('必须只有两列');
  });
});
