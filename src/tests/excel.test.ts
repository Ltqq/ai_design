import { describe,expect,it } from 'vitest';
import ExcelJS from 'exceljs';
import { parseExcel } from '../lib/excel';

describe('真实 Excel 数据解析',()=>{
  it('使用实际 xlsx 二进制读取工作表、列名与数据',async()=>{
    const book=new ExcelJS.Workbook();
    const sheet=book.addWorksheet('模型报价');
    sheet.addRow(['模型名称','展示售价','活动文案']);
    sheet.addRow(['Kimi K3',6.9,'活动价']);
    sheet.addRow(['GLM Flash',3.5,'优惠']);
    const bytes=await book.xlsx.writeBuffer();
    const sheets=await parseExcel(Buffer.from(bytes));
    expect(sheets).toEqual([{name:'模型报价',columns:['模型名称','展示售价','活动文案'],rows:[
      {'模型名称':'Kimi K3','展示售价':'6.9','活动文案':'活动价'},
      {'模型名称':'GLM Flash','展示售价':'3.5','活动文案':'优惠'}
    ]}]);
  });
});
