import { chromium } from 'playwright';
import ExcelJS from 'exceljs';
import { mkdir, cp, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const origin='http://127.0.0.1:3000';
const dataDir=path.resolve(process.env.AI_DESIGN_DATA_DIR||'./data');
const output=path.resolve('artifacts/ui');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  const draftId=randomUUID();
  await cp(path.resolve('examples/tech-poster'),path.join(dataDir,'drafts',draftId),{recursive:true});
  const thumbnailPage=await browser.newPage({viewport:{width:1080,height:1440}});
  await thumbnailPage.setContent('<body style="margin:0;background:radial-gradient(circle at 30% 20%,#383090,#081124 70%);color:white;font:700 86px system-ui;padding:170px 80px"><div style="font-size:23px;letter-spacing:8px;color:#bfadff">AI MODEL MARKET</div><h1>精选模型<br/>优惠上新</h1><div style="font-size:60px;color:#fbdba2;padding:70px;background:#20294b;border-radius:40px">deepseek-v4.1-flash<br/>4折</div></body>');
  await thumbnailPage.screenshot({path:path.join(dataDir,'drafts',draftId,'thumbnail.png')});
  await thumbnailPage.close();
  const saved=await fetch(`${origin}/api/templates`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:draftId,name:'科技折扣海报 · 页面测试'})});
  if(!saved.ok)throw new Error(`模板保存失败：${await saved.text()}`);
  const {templateId}=await saved.json();
  const workbook=new ExcelJS.Workbook();
  const sheet=workbook.addWorksheet('模型折扣');
  sheet.addRow(['模型名称','折扣']);
  sheet.addRow(['deepseek-v4.1-flash','4折']);
  sheet.addRow(['kimi-k3','5折']);
  const form=new FormData();
  form.append('file',new Blob([await workbook.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'models.xlsx');
  const imported=await fetch(`${origin}/api/excel/import`,{method:'POST',body:form});
  if(!imported.ok)throw new Error(`Excel 导入失败：${await imported.text()}`);
  const poster=await fetch(`${origin}/api/posters/render?save=1`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({templateId,models:[{name:'deepseek-v4.1-flash',discount:'4折'},{name:'kimi-k3',discount:'5折'}],fixedFields:{title:'热门模型优惠',subtitle:'优质模型折扣'}})});
  if(!poster.ok)throw new Error(`海报渲染失败：${await poster.text()}`);
  if(poster.headers.get('content-type')!=='image/png')throw new Error('导出格式不是 PNG');
  const savedHistory=await fetch(`${origin}/api/posters/render`).then(r=>r.json());
  if(!savedHistory.posters.length)throw new Error('海报导出历史没有保存');
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  for(const [slug,title] of [['create','把灵感，变成可复用的海报模板'],['templates','你的专属海报模板库'],['posters','让表格，自动变成精美海报'],['chat','和你的多模态模型聊创意'],['settings','连接你的 AI 模型']]){
    await page.goto(`${origin}/${slug}`,{waitUntil:'networkidle'});
    await page.getByRole('heading',{name:title}).waitFor();
    if(slug==='posters'){
      await page.getByText('deepseek-v4.1-flash').first().waitFor();
      await page.getByRole('button',{name:'更新预览'}).click();
      await page.getByAltText('本次填充后的完整海报').waitFor();
    }
    await page.screenshot({path:path.join(output,`${slug}.png`),fullPage:true});
    console.log(`UI smoke: ${slug} ✓`);
  }
  await page.close();
}finally{await browser.close()}
