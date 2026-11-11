import { chromium } from 'playwright';
import { renderHTML } from '@/lib/template';
import type { TemplateSource } from '@/types';

export async function renderPNG(source:TemplateSource, data:Record<string,unknown>):Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: {width:source.manifest.width, height:source.manifest.height}, deviceScaleFactor: 1, javaScriptEnabled:false });
    await page.setContent(renderHTML(source,data), {waitUntil:'load'});
    await page.evaluate(() => document.fonts.ready);
    const screenshot = await page.screenshot({type:'png',fullPage:false});
    await page.close();
    return screenshot;
  } finally {
    await browser.close();
  }
}
