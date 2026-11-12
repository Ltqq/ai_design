import { chromium } from 'playwright';
import ExcelJS from 'exceljs';
import { mkdir, cp, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const origin = 'http://127.0.0.1:3000';
const dataDir = path.resolve(process.env.AI_DESIGN_DATA_DIR || './data');
const output = path.resolve('artifacts/ui');
await mkdir(output, { recursive: true });

// Create the offline template fixture; every user operation below happens through the browser.
const draftId = randomUUID();
await cp(path.resolve('examples/tech-poster'), path.join(dataDir, 'drafts', draftId), { recursive: true });

// The only substitute in this test is the external paid model; app, Agent tools,
// template workflow, Chromium and SQLite all run as production code.
const source = {
  html: await readFile('examples/tech-poster/template.html','utf8'),
  css: await readFile('examples/tech-poster/style.css','utf8'),
  manifest: JSON.parse(await readFile('examples/tech-poster/manifest.json','utf8')),
};
let templateGenerationCalls=0, templateEditCalls=0, imageGenerationCalls=0;
let releaseDemoStream=()=>{};
const modelServer = createServer(async (request,response)=>{
  let raw=''; for await(const part of request) raw+=part;
  const payload=JSON.parse(raw);
  if(request.url?.includes('/images/generations')){
    imageGenerationCalls++;
    const png=await readFile(path.join(dataDir,'drafts',draftId,'thumbnail.png'));
    response.writeHead(200,{'content-type':'application/json'});
    response.end(JSON.stringify({created:Math.floor(Date.now()/1000),data:[{b64_json:png.toString('base64')}] }));
    return;
  }
  if(JSON.stringify(payload.messages||[]).includes('故意失败')){
    response.writeHead(502,{'content-type':'application/json'});
    response.end(JSON.stringify({error:{message:'模拟上游 502，用于验证任务恢复'}}));
    return;
  }
  const latest=[...(payload.messages||[])].reverse().find(m=>m.role==='user');
  const userText=JSON.stringify(latest?.content||'');
  if(!payload.tools?.length && userText.includes('创建完整可填充数据的 HTML/CSS 模板'))templateGenerationCalls++;
  if(!payload.tools?.length && userText.includes('修改要求：'))templateEditCalls++;
  const hasToolReply=payload.messages?.some(m=>m.role==='tool');
  let toolCall;
  if(payload.tools?.length && !hasToolReply){
    if(userText.includes('直接生成') && userText.includes('HTML')){
      toolCall={name:'createTemplateFromText',arguments:JSON.stringify({prompt:'暗黑科技风，模型名称和折扣列表'})};
    }else if(userText.includes('视觉检查')||userText.includes('视觉复查')){
      toolCall={name:'reviewTemplate',arguments:JSON.stringify({instruction:'只修正明显视觉问题并保留动态变量'})};
    }else if(userText.includes('生成参考图')){
      toolCall={name:'generateImage',arguments:JSON.stringify({prompt:'高级科技风海报，立体设计'})};
    }else if(userText.includes('转换') || userText.includes('HTML 模板')){
      toolCall={name:'convertToTemplate',arguments:JSON.stringify({instructions:'依照参考图制作可填充模型名称、折扣的模板'})};
    }else if(userText.includes('保存') || userText.includes('模板，名字')){
      toolCall={name:'saveTemplate',arguments:JSON.stringify({name:'界面测试 · 已保存的设计模板'})};
    }
  }
  const message=toolCall?{role:'assistant',content:null,tool_calls:[{id:'call_test_1',type:'function',function:toolCall}]}:
    {role:'assistant',content:payload.tools?.length?'模板操作完成，请查看右侧预览。':
      userText.includes('修改要求：')?JSON.stringify({edits:[{file:'css',oldText:'padding:85px 74px',newText:'padding:80px 74px'}]}):JSON.stringify(source)};
  if(payload.stream){
    if(userText.includes('切页验证'))await new Promise(resolve=>setTimeout(resolve,2500));
    response.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});
    const emit=(delta,reason=null)=>response.write('data: '+JSON.stringify({id:'chatcmpl-local',object:'chat.completion.chunk',created:Math.floor(Date.now()/1000),model:'local-test',choices:[{index:0,delta,finish_reason:reason}]})+'\n\n');
    if(userText.includes('流式演示')&&!toolCall){
      emit({role:'assistant',content:'实时输出第一段'});
      await Promise.race([new Promise(resolve=>{releaseDemoStream=resolve}),new Promise(resolve=>setTimeout(resolve,12000))]);
      emit({content:'，第二段也到了。'});
      emit({},'stop');
      response.end('data: [DONE]\n\n');
      return;
    }
    if(toolCall)emit({role:'assistant',tool_calls:[{index:0,id:'call_test_1',type:'function',function:toolCall}]});
    else emit({role:'assistant',content:message.content||''});
    emit({},toolCall?'tool_calls':'stop');
    response.end('data: [DONE]\n\n');
  }else{
    response.writeHead(200,{'content-type':'application/json'});
    response.end(JSON.stringify({id:'chatcmpl-local',object:'chat.completion',created:Math.floor(Date.now()/1000),model:'local-test',choices:[{index:0,message,finish_reason:toolCall?'tool_calls':'stop'}],usage:{prompt_tokens:30,completion_tokens:30,total_tokens:60}}));
  }
});
await new Promise(resolve=>modelServer.listen(44999,'127.0.0.1',resolve));

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
    ['create', 'AI 海报创作工作台'],
    ['templates', '你的专属海报模板库'],
    ['posters', '让表格，自动变成精美海报'],
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
  await page.getByText('已添加参考图').waitFor();
  await page.getByAltText('当前海报参考图').waitFor();
  if (await page.getByRole('button', { name: '转换为模板' }).isDisabled()) throw new Error('上传图片后转换模板入口应启用');
  console.log('UI studio image attachment and conversion action ✓');
  await page.goto(`${origin}/chat`, {waitUntil:'networkidle'});
  if (!page.url().endsWith('/create')) throw new Error('旧聊天页未跳转到创作工作台');
  console.log('UI legacy chat redirect ✓');

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
  const modelOption=page.locator('.model-option').filter({hasText:'kimi-k3'}).locator('input[type=checkbox]');
  await modelOption.uncheck();
  const fieldsPanel=page.locator('.panel').filter({has:page.getByRole('heading',{name:'海报文案'})});
  await fieldsPanel.locator('input').first().fill('测试 · 已保存的海报文案');
  await page.waitForTimeout(900);
  await page.reload({waitUntil:'networkidle'});
  if(await page.locator('.model-option').filter({hasText:'kimi-k3'}).locator('input[type=checkbox]').isChecked())throw new Error('海报勾选状态刷新后丢失');
  if(await page.locator('.panel').filter({has:page.getByRole('heading',{name:'海报文案'})}).locator('input').first().inputValue()!=='测试 · 已保存的海报文案')throw new Error('海报文案刷新后丢失');
  console.log('UI poster model selection and copy persist after reload ✓');
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
  await page.getByLabel('输入价格').fill('2');
  await page.getByLabel('输出价格').fill('8');
  await page.getByRole('button',{name:'保存多模态单价'}).click();
  await page.getByText('参考单价已保存').waitFor();
  await page.reload({waitUntil:'networkidle'});
  if(await page.getByLabel('输入价格').inputValue()!=='2')throw new Error('模型价格未持久化');
  console.log('UI configurable model pricing persisted ✓');
  await page.getByLabel('API Base URL').nth(1).fill('http://127.0.0.1:44999/v1');
  await page.getByLabel('Model ID').nth(1).fill('test-image-generation');
  await page.getByLabel(/API Key/).nth(1).fill('local-image-test-key');
  await page.getByRole('button',{name:'保存连接'}).nth(1).click();
  await page.getByText('配置已保存到本机数据库').last().waitFor();


  // Real UI + Mastra tool execution with a local OpenAI-compatible test endpoint.
  await page.goto(`${origin}/create`, {waitUntil:'networkidle'});
  await page.getByRole('button',{name:'上传参考图'}).click();
  await page.locator('input[type=file]').setInputFiles({name:'reference.png',mimeType:'image/png',buffer:Buffer.from(sampleImage)});
  await page.getByText('已添加参考图').waitFor();
  const templateCallsBeforeUpload=templateGenerationCalls;
  await page.getByRole('button',{name:'转换为模板'}).click();
  await page.getByAltText('当前可复用 HTML 模板预览').waitFor({timeout:150000});
  if(templateGenerationCalls-templateCallsBeforeUpload!==1)throw new Error('初次模板转换调用了多次完整代码生成模型');
  console.log('UI upload → Mastra tool → rendered HTML template ✓');
  await page.getByRole('textbox',{name:'模板名称'}).fill('界面测试 · 已保存的设计模板');
  await page.getByRole('button',{name:'保存到模板库'}).click();
  await page.getByRole('link',{name:'用 Excel 填充海报'}).waitFor({timeout:90000});
  await page.reload({waitUntil:'networkidle'});
  await page.getByRole('link',{name:'用 Excel 填充海报'}).waitFor();
  console.log('UI save template → page reload → design state restored ✓');
  await page.screenshot({path:path.join(output,'create-with-template.png'),fullPage:true});
  await page.goto(`${origin}/templates`,{waitUntil:'networkidle'});
  const savedCard=page.locator('.template-card').filter({hasText:'界面测试 · 已保存的设计模板'});
  await savedCard.getByRole('button',{name:/编辑/}).click();
  await page.getByLabel('用自然语言修改设计').fill('让卡片更有立体感');
  const templateCallsBeforeEdit=templateGenerationCalls;
  const patchCallsBeforeEdit=templateEditCalls;
  await page.getByRole('button',{name:'只修改指定部分'}).click();
  await page.getByText('AI 修改完成').waitFor({timeout:90000});
  if(templateGenerationCalls!==templateCallsBeforeEdit || templateEditCalls!==patchCallsBeforeEdit+1)
    throw new Error('局部编辑不应重走完整模板生成，且应恰好调用一次补丁模型');
  await page.locator('.template-card').filter({hasText:'界面测试 · 已保存的设计模板'}).getByRole('button',{name:/编辑/}).click();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'恢复此版本'}).click();
  await page.getByText('历史版本已恢复').waitFor({timeout:90000});
  console.log('UI revise saved template → browse and restore previous version ✓');
  await page.goto(`${origin}/create`,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'AI 视觉复查 · 按需额外计费'}).click();
  await page.getByText('已根据实际渲染截图局部修正模板').waitFor({timeout:90000});
  await page.getByText('就绪',{exact:true}).waitFor({timeout:15000});
  console.log('UI optional visual review uses screenshot and scoped source patch ✓');
  await page.getByRole('button',{name:'新建创作'}).click();
  await page.getByRole('textbox',{name:'向设计 Agent 输入消息'}).fill('流式演示：请按两段话回复，验证增量显示');
  await page.getByRole('button',{name:'发送'}).click();
  console.log('Stream test: user message submitted');
  await page.getByText('运行中 · 切页不中断').waitFor({timeout:10000});
  console.log('Stream test: server run has started');
  await page.getByText('实时输出第一段',{exact:false}).waitFor({timeout:8000});
  console.log('Stream test: first partial text appeared before release');
  releaseDemoStream();
  await page.getByText('实时输出第一段，第二段也到了。',{exact:false}).waitFor({timeout:15000});
  console.log('UI partial text streamed before request completes ✓');
  await page.goto(`${origin}/create`,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'新建创作'}).click();
  await page.getByRole('textbox',{name:'向设计 Agent 输入消息'}).fill('请生成参考图，做一张科技风格的模型海报');
  await page.getByRole('button',{name:'发送'}).click();
  await page.getByAltText('当前海报参考图').waitFor({timeout:90000});
  console.log('UI text prompt → Mastra image tool → generated reference picture ✓');
  await page.getByRole('button',{name:'新建创作'}).click();
  const imageCallsBeforeDirectHtml=imageGenerationCalls;
  await page.getByRole('textbox',{name:'向设计 Agent 输入消息'}).fill('直接生成一个完整的 HTML 模板，含模型折扣，不先生图');
  await page.getByRole('button',{name:'发送'}).click();
  await page.getByAltText('当前可复用 HTML 模板预览').waitFor({timeout:90000});
  if(imageGenerationCalls!==imageCallsBeforeDirectHtml)throw new Error('纯文字生成 HTML 不应先收费生图');
  console.log('UI text → HTML template without image generation ✓');
  await page.getByRole('button',{name:'新建创作'}).click();
  await page.getByRole('textbox',{name:'向设计 Agent 输入消息'}).fill('切页验证：请生成参考图，再转成模板');
  await page.getByRole('button',{name:'发送'}).click();
  await page.goto(`${origin}/templates`,{waitUntil:'networkidle'});
  await page.goto(`${origin}/create`,{waitUntil:'networkidle'});
  await page.getByAltText('当前海报参考图').waitFor({timeout:90000});
  console.log('UI page navigation → server job continues → reconnect and restore ✓');
  await page.getByRole('button',{name:'新建创作'}).click();
  await page.getByRole('textbox',{name:'向设计 Agent 输入消息'}).fill('故意失败：测试会话持久保存');
  await page.getByRole('button',{name:'发送'}).click();
  await page.getByRole('alert').waitFor({timeout:30000});
  await page.reload({waitUntil:'networkidle'});
  await page.getByText('故意失败：测试会话持久保存').first().waitFor();
  console.log('UI failed AI request → user message persists → reload ✓');



  await page.close();
} finally {
  releaseDemoStream();
  await browser.close();
  await new Promise(resolve=>modelServer.close(resolve));
}
