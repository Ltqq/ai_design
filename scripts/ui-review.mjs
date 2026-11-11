import { chromium } from 'playwright';
import ExcelJS from 'exceljs';
import { mkdir, cp } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const origin = 'http://127.0.0.1:3000';
const dataDir = path.resolve(process.env.AI_DESIGN_DATA_DIR || './data');
const output = path.resolve('artifacts/ui');
await mkdir(output, { recursive: true });

// Create the offline template fixture; every user operation below happens through the browser.
const draftId = randomUUID();
await cp(path.resolve('examples/tech-poster'), path.join(dataDir, 'drafts', draftId), { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const thumbnailPage = await browser.newPage({ viewport: { width: 1080, height: 1440 } });
  await thumbnailPage.setContent('<body style="margin:0;background:#121b32;color:white;font:700 80px system-ui;padding:150px 85px"><p style="font-size:22px;color:#b7a3ff">AI MODEL MARKET</p><h1>精选模型<br/>优惠上新</h1><div style="background:#283451;border-radius:38px;padding:50px;font-size:55px">deepseek-v4.1-flash<br/>4折</div></body>');
  await thumbnailPage.screenshot({ path: path.join(dataDir, 'drafts', draftId, 'thumbnail.png') });
  await thumbnailPage.close();
  const saved = await fetch(`${origin}/api/templates`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: draftId, name: '科技折扣海报 · 页面测试' }),
  });
  if (!saved.ok) throw new Error(`测试模板准备失败：${await saved.text()}`);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('模型折扣');
  sheet.addRow(['模型名称', '折扣']);
  sheet.addRow(['deepseek-v4.1-flash', '4折']);
  sheet.addRow(['kimi-k3', '5折']);
  const excel = Buffer.from(await workbook.xlsx.writeBuffer());

  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, acceptDownloads: true });
  page.on('pageerror', error => { throw error; });

  for (const [slug, title] of [
    ['create', '把灵感，变成可复用的海报模板'],
    ['templates', '你的专属海报模板库'],
    ['posters', '让表格，自动变成精美海报'],
    ['chat', '和你的多模态模型聊创意'],
    ['settings', '连接你的 AI 模型'],
  ]) {
    await page.goto(`${origin}/${slug}`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: title }).waitFor();
    await page.screenshot({ path: path.join(output, `${slug}.png`), fullPage: true });
    const width = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (width > 20) throw new Error(`${slug} 页面水平溢出 ${width}px`);
    console.log(`Page navigation: ${slug} ✓`);
  }

  // Real UI flow: upload reference image from the creation page.
  await page.goto(`${origin}/create`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '上传参考图' }).click();
  const sampleImage = await (await fetch(`${origin}/api/assets/drafts/${draftId}/thumbnail.png`)).arrayBuffer();
  await page.locator('input[type=file]').setInputFiles({ name: 'reference.png', mimeType: 'image/png', buffer: Buffer.from(sampleImage) });
  await page.getByText('参考图已就绪').waitFor();
  await page.getByAltText('海报参考设计图').waitFor();
  console.log('UI upload reference image ✓');

  // Real UI flow: Excel import, select models, browser preview, download PNG, reload persistence.
  await page.goto(`${origin}/posters`, { waitUntil: 'networkidle' });
  await page.locator('input[type=file]').first().setInputFiles({
    name: 'models.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: excel,
  });
  await page.getByText('成功导入并保存 2 条模型折扣').waitFor();
  await page.getByText('deepseek-v4.1-flash').first().waitFor();
  await page.getByRole('button', { name: '更新预览' }).click();
  await page.getByAltText('本次填充后的完整海报').waitFor();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出并保存 PNG' }).click();
  const download = await downloadPromise;
  if (!download.suggestedFilename().endsWith('.png')) throw new Error('UI download did not produce PNG');
  await page.getByText('海报已导出并保存到本地历史记录').waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('deepseek-v4.1-flash').first().waitFor();
  await page.getByRole('link', { name: /下载/ }).last().waitFor();
  await page.screenshot({ path: path.join(output, 'posters-filled.png'), fullPage: true });
  console.log('UI Excel import → preview → PNG download → persisted reload ✓');

  // Real UI template management: copy and delete a copy.
  await page.goto(`${origin}/templates`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /复制科技折扣海报/ }).click();
  await page.getByText('模板已复制').waitFor();
  await page.getByText('科技折扣海报 · 页面测试 · 副本').waitFor();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /删除科技折扣海报 · 页面测试 · 副本/ }).click();
  await page.getByText('模板已删除').waitFor();
  console.log('UI copy and delete template ✓');

  // Real UI: verify model settings can be persisted through controls, without making paid model calls.
  await page.goto(`${origin}/settings`, { waitUntil: 'networkidle' });
  await page.getByLabel('API Base URL').first().fill('http://127.0.0.1:44999/v1');
  await page.getByLabel('Model ID').first().fill('test-multimodal');
  await page.getByLabel(/API Key/).first().fill('local-test-key');
  await page.getByRole('button', { name: '保存连接' }).first().click();
  await page.getByText('配置已保存到本机数据库').waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  if (await page.getByLabel('Model ID').first().inputValue() !== 'test-multimodal') throw new Error('UI model configuration did not persist');
  console.log('UI model settings save → reload ✓');

  await page.close();
} finally {
  await browser.close();
}
