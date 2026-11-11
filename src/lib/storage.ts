import Database from 'better-sqlite3';
import { mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ChatMessage, ChatSession, Manifest, ModelConfig, ModelDiscount, ModelKind, PosterRecord, TemplateRecord, TemplateSource, StudioState, StudioEvent, StudioRun, PosterDraft, TemplateVersion } from '@/types';

export const dataDir = path.resolve(process.env.AI_DESIGN_DATA_DIR || './data');
let connection: Database.Database | undefined;
export function db() {
  if (!connection) {
    mkdirSync(dataDir, { recursive: true });
    connection = new Database(path.join(dataDir, 'ai-design.sqlite'));
    connection.pragma('journal_mode = WAL');
    connection.pragma('synchronous = FULL');
    connection.exec(`
      CREATE TABLE IF NOT EXISTS model_configs (kind TEXT PRIMARY KEY, base_url TEXT NOT NULL, model_id TEXT NOT NULL, api_key TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS model_discounts (position INTEGER PRIMARY KEY, name TEXT NOT NULL, discount TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS poster_exports (id TEXT PRIMARY KEY, template_name TEXT NOT NULL, model_count INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS chat_sessions (id TEXT PRIMARY KEY, title TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, image_path TEXT, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS studio_states (session_id TEXT PRIMARY KEY, reference_path TEXT NOT NULL, draft_id TEXT NOT NULL, template_id TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS studio_runs (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, status TEXT NOT NULL, error TEXT, created_at TEXT NOT NULL, finished_at TEXT);
      CREATE TABLE IF NOT EXISTS studio_events (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS studio_events_run ON studio_events(run_id,id);
      CREATE TABLE IF NOT EXISTS template_versions (id TEXT PRIMARY KEY, template_id TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS poster_draft (id INTEGER PRIMARY KEY CHECK(id=1), content TEXT NOT NULL);
    `);
    // In-process work cannot survive a Node process restart; mark interrupted runs explicitly.
    connection.prepare("UPDATE studio_runs SET status='interrupted', error='服务重启导致任务中断，请从已有设计继续' WHERE status='running'").run();
  }
  return connection;
}
export function saveConfig(kind: ModelKind, config: ModelConfig) {
  db().prepare('INSERT INTO model_configs(kind,base_url,model_id,api_key) VALUES(?,?,?,?) ON CONFLICT(kind) DO UPDATE SET base_url=excluded.base_url,model_id=excluded.model_id,api_key=excluded.api_key').run(kind, config.baseURL, config.modelId, config.apiKey);
}
export function getConfig(kind: ModelKind): ModelConfig | null {
  const row = db().prepare('SELECT base_url,model_id,api_key FROM model_configs WHERE kind=?').get(kind) as {base_url:string;model_id:string;api_key:string}|undefined;
  return row ? { baseURL: row.base_url, modelId: row.model_id, apiKey: row.api_key } : null;
}
export function replaceModels(models:ModelDiscount[]) {
  const insert=db().prepare('INSERT INTO model_discounts(position,name,discount) VALUES(?,?,?)');
  db().transaction(()=>{
    db().prepare('DELETE FROM model_discounts').run();
    models.forEach((model,i)=>insert.run(i,model.name,model.discount));
  })();
}
export function getModels():ModelDiscount[] {
  return db().prepare('SELECT name,discount FROM model_discounts ORDER BY position').all() as ModelDiscount[];
}
export async function writeSource(kind: 'drafts'|'templates', id: string, source: TemplateSource, thumbnail: Buffer) {
  const folder = path.join(dataDir, kind, id);
  await mkdir(folder, { recursive: true });
  await Promise.all([
    writeFile(path.join(folder, 'template.html'), source.html),
    writeFile(path.join(folder, 'style.css'), source.css),
    writeFile(path.join(folder, 'manifest.json'), JSON.stringify(source.manifest, null, 2)),
    writeFile(path.join(folder, 'thumbnail.png'), thumbnail),
  ]);
}
export async function readSource(kind: 'drafts'|'templates', id: string): Promise<TemplateSource> {
  const folder = path.join(dataDir, kind, id);
  const [html, css, manifest] = await Promise.all([
    readFile(path.join(folder, 'template.html'), 'utf8'),
    readFile(path.join(folder, 'style.css'), 'utf8'),
    readFile(path.join(folder, 'manifest.json'), 'utf8'),
  ]);
  return { html, css, manifest: JSON.parse(manifest) as Manifest };
}
export function listTemplates(): TemplateRecord[] {
  const rows = db().prepare('SELECT id,name,width,height,created_at FROM templates ORDER BY created_at DESC').all() as Array<{id:string;name:string;width:number;height:number;created_at:string}>;
  return rows.map(v => ({ id:v.id, name:v.name, width:v.width, height:v.height, createdAt:v.created_at, thumbnail:`/api/assets/templates/${v.id}/thumbnail.png` }));
}
export async function saveDraft(id: string, name: string) {
  const source = await readSource('drafts', id);
  const templateId = randomUUID();
  await cp(path.join(dataDir,'drafts',id), path.join(dataDir,'templates',templateId), {recursive:true});
  db().prepare('INSERT INTO templates(id,name,width,height,created_at) VALUES(?,?,?,?,?)').run(templateId, name, source.manifest.width, source.manifest.height, new Date().toISOString());
  return templateId;
}
export async function duplicateTemplate(id: string) {
  const row=db().prepare('SELECT name FROM templates WHERE id=?').get(id) as {name:string};
  const name = `${row.name} · 副本`;
  const draftId = randomUUID();
  await cp(path.join(dataDir,'templates',id), path.join(dataDir,'drafts',draftId), {recursive:true});
  return saveDraft(draftId, name);
}
export function renameTemplate(id: string, name: string) { db().prepare('UPDATE templates SET name=? WHERE id=?').run(name,id); }
export async function deleteTemplate(id: string) {
  db().prepare('DELETE FROM templates WHERE id=?').run(id);
  await rm(path.join(dataDir,'templates',id), {recursive:true,force:true});
  await rm(path.join(dataDir,'versions',id), {recursive:true,force:true});
  db().prepare('DELETE FROM template_versions WHERE template_id=?').run(id);
}
export async function saveReference(buffer: Buffer, ext: string) {
  const id = randomUUID();
  const file = `${id}.${ext}`;
  await mkdir(path.join(dataDir,'references'),{recursive:true});
  await writeFile(path.join(dataDir,'references',file),buffer);
  return `/api/assets/references/${file}`;
}
export async function getAsset(parts: string[]) {
  const [kind, id, name] = parts;
  if (kind === 'references' && /^[\da-f-]{36}\.(png|jpe?g|webp)$/.test(id) && parts.length===2) return readFile(path.join(dataDir,kind,id));
  if ((kind==='drafts'||kind==='templates') && /^[\da-f-]{36}$/.test(id) && name==='thumbnail.png' && parts.length===3) return readFile(path.join(dataDir,kind,id,name));
  throw new Error('Invalid asset path');
}
export async function referenceBytes(url: string) {
  const name = url.split('/').at(-1)!;
  return readFile(path.join(dataDir,'references',name));
}
export async function savePoster(png:Buffer, templateId:string,modelCount:number):Promise<string> {
  const row=db().prepare('SELECT name FROM templates WHERE id=?').get(templateId) as {name:string};
  const id=randomUUID();
  await mkdir(path.join(dataDir,'exports'),{recursive:true});
  await writeFile(path.join(dataDir,'exports',`${id}.png`),png);
  db().prepare('INSERT INTO poster_exports(id,template_name,model_count,created_at) VALUES(?,?,?,?)').run(id,row.name,modelCount,new Date().toISOString());
  return id;
}
export function listPosters():PosterRecord[] {
  const rows=db().prepare('SELECT id,template_name,model_count,created_at FROM poster_exports ORDER BY created_at DESC LIMIT 30').all() as Array<{id:string;template_name:string;model_count:number;created_at:string}>;
  return rows.map(row=>({id:row.id,templateName:row.template_name,modelCount:row.model_count,createdAt:row.created_at}));
}
export async function readPoster(id:string):Promise<Buffer> { return readFile(path.join(dataDir,'exports',`${id}.png`)); }
export function listChats():ChatSession[] {
  const rows=db().prepare('SELECT id,title,updated_at FROM chat_sessions ORDER BY updated_at DESC').all() as Array<{id:string;title:string;updated_at:string}>;
  return rows.map(row=>({id:row.id,title:row.title,updatedAt:row.updated_at}));
}
export function getChat(id:string):ChatMessage[] {
  const rows=db().prepare('SELECT id,role,content,image_path,created_at FROM chat_messages WHERE session_id=? ORDER BY rowid ASC').all(id) as Array<{id:string;role:'user'|'assistant';content:string;image_path:string|null;created_at:string}>;
  return rows.map(row=>({id:row.id,role:row.role,content:row.content,imagePath:row.image_path,createdAt:row.created_at}));
}
export function saveChatExchange(id:string|undefined,content:string,imagePath:string|null,answer:string):string {
  const sessionId=id||randomUUID();
  const now=new Date().toISOString();
  db().transaction(()=>{
    if(!id) db().prepare('INSERT INTO chat_sessions(id,title,updated_at) VALUES(?,?,?)').run(sessionId,content.slice(0,30),now);
    else db().prepare('UPDATE chat_sessions SET updated_at=? WHERE id=?').run(now,id);
    const insert=db().prepare('INSERT INTO chat_messages(id,session_id,role,content,image_path,created_at) VALUES(?,?,?,?,?,?)');
    insert.run(randomUUID(),sessionId,'user',content,imagePath,now);
    insert.run(randomUUID(),sessionId,'assistant',answer,null,new Date().toISOString());
  })();
  return sessionId;
}
export function deleteChat(id:string) {
  db().transaction(()=>{
    db().prepare('DELETE FROM chat_messages WHERE session_id=?').run(id);
    db().prepare('DELETE FROM chat_sessions WHERE id=?').run(id);
    db().prepare('DELETE FROM studio_states WHERE session_id=?').run(id);
    db().prepare('DELETE FROM studio_events WHERE run_id IN (SELECT id FROM studio_runs WHERE session_id=?)').run(id);
    db().prepare('DELETE FROM studio_runs WHERE session_id=?').run(id);
  })();
}

export function getStudioState(id?: string): StudioState {
  const row=id?db().prepare('SELECT reference_path,draft_id,template_id,width,height FROM studio_states WHERE session_id=?').get(id) as {reference_path:string;draft_id:string;template_id:string;width:number;height:number}|undefined:undefined;
  return row?{referencePath:row.reference_path,draftId:row.draft_id,templateId:row.template_id,width:row.width,height:row.height}:{referencePath:'',draftId:'',templateId:'',width:1080,height:1440};
}
export function saveStudioState(id:string, state:StudioState) {
  db().prepare('INSERT INTO studio_states(session_id,reference_path,draft_id,template_id,width,height) VALUES(?,?,?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET reference_path=excluded.reference_path,draft_id=excluded.draft_id,template_id=excluded.template_id,width=excluded.width,height=excluded.height')
    .run(id,state.referencePath,state.draftId,state.templateId,state.width,state.height);
}

export function beginStudioRun(threadId:string|undefined, message:string, imagePath:string|null, state:StudioState) {
  const database=db();
  const id=threadId || randomUUID();
  const runId=randomUUID();
  const now=new Date().toISOString();
  database.transaction(()=>{
    const active=database.prepare("SELECT id FROM studio_runs WHERE session_id=? AND status='running'").get(id);
    if(active) throw new Error('这个会话已有任务正在执行，请等它完成后继续');
    if(!threadId) database.prepare('INSERT INTO chat_sessions(id,title,updated_at) VALUES(?,?,?)').run(id,message.slice(0,30),now);
    else database.prepare('UPDATE chat_sessions SET updated_at=? WHERE id=?').run(now,id);
    database.prepare('INSERT INTO chat_messages(id,session_id,role,content,image_path,created_at) VALUES(?,?,?,?,?,?)')
      .run(randomUUID(),id,'user',message,imagePath,now);
    saveStudioState(id,state);
    database.prepare('INSERT INTO studio_runs(id,session_id,status,created_at) VALUES(?,?,?,?)').run(runId,id,'running',now);
  })();
  return {threadId:id,runId};
}
export function recordStudioEvent(runId:string,type:string,payload:object) {
  return Number(db().prepare('INSERT INTO studio_events(run_id,type,payload,created_at) VALUES(?,?,?,?)')
    .run(runId,type,JSON.stringify(payload),new Date().toISOString()).lastInsertRowid);
}
export function readRunEvents(runId:string,after=0):StudioEvent[] {
  const rows=db().prepare('SELECT id,run_id,type,payload,created_at FROM studio_events WHERE run_id=? AND id>? ORDER BY id')
    .all(runId,after) as Array<{id:number;run_id:string;type:string;payload:string;created_at:string}>;
  return rows.map(row=>({id:row.id,runId:row.run_id,type:row.type,payload:JSON.parse(row.payload),createdAt:row.created_at}));
}
export function recentStudioEvents(threadId:string):StudioEvent[] {
  // Historical view needs tool/progress/reasoning records; text is already stored in chat_messages.
  const rows=db().prepare(`SELECT e.id,e.run_id,e.type,e.payload,e.created_at FROM studio_events e
    JOIN studio_runs r ON r.id=e.run_id WHERE r.session_id=? AND e.type NOT IN ('text','reasoning')
    ORDER BY e.id DESC LIMIT 200`).all(threadId) as Array<{id:number;run_id:string;type:string;payload:string;created_at:string}>;
  return rows.reverse().map(row=>({id:row.id,runId:row.run_id,type:row.type,payload:JSON.parse(row.payload),createdAt:row.created_at}));
}
export function getStudioRun(runId:string):StudioRun | null {
  const row=db().prepare('SELECT id,session_id,status,error,created_at,finished_at FROM studio_runs WHERE id=?').get(runId) as
    {id:string;session_id:string;status:StudioRun['status'];error:string|null;created_at:string;finished_at:string|null}|undefined;
  return row?{id:row.id,threadId:row.session_id,status:row.status,error:row.error,createdAt:row.created_at,finishedAt:row.finished_at}:null;
}
export function getCurrentStudioRun(threadId:string):StudioRun | null {
  const row=db().prepare('SELECT id FROM studio_runs WHERE session_id=? ORDER BY created_at DESC LIMIT 1').get(threadId) as {id:string}|undefined;
  return row?getStudioRun(row.id):null;
}
export function finishStudioRun(runId:string,answer:string,status:'completed'|'failed',error?:string) {
  const run=getStudioRun(runId)!;
  const database=db();
  database.transaction(()=>{
    if(answer) database.prepare('INSERT INTO chat_messages(id,session_id,role,content,image_path,created_at) VALUES(?,?,?,?,?,?)')
      .run(randomUUID(),run.threadId,'assistant',answer,null,new Date().toISOString());
    database.prepare('UPDATE studio_runs SET status=?,error=?,finished_at=? WHERE id=?')
      .run(status,error||null,new Date().toISOString(),runId);
    database.prepare('UPDATE chat_sessions SET updated_at=? WHERE id=?').run(new Date().toISOString(),run.threadId);
  })();
}
export async function snapshotTemplate(id:string):Promise<TemplateVersion> {
  const versionId=randomUUID();
  await cp(path.join(dataDir,'templates',id),path.join(dataDir,'versions',id,versionId),{recursive:true});
  const createdAt=new Date().toISOString();
  db().prepare('INSERT INTO template_versions(id,template_id,created_at) VALUES(?,?,?)').run(versionId,id,createdAt);
  return {id:versionId,templateId:id,createdAt};
}
export function listTemplateVersions(templateId:string):TemplateVersion[] {
  const rows=db().prepare('SELECT id,template_id,created_at FROM template_versions WHERE template_id=? ORDER BY created_at DESC')
    .all(templateId) as Array<{id:string;template_id:string;created_at:string}>;
  return rows.map(row=>({id:row.id,templateId:row.template_id,createdAt:row.created_at}));
}
export async function restoreTemplateVersion(templateId:string,versionId:string) {
  const version=db().prepare('SELECT id FROM template_versions WHERE id=? AND template_id=?').get(versionId,templateId);
  if(!version) throw new Error('模板版本不存在');
  await snapshotTemplate(templateId);
  await cp(path.join(dataDir,'versions',templateId,versionId),path.join(dataDir,'templates',templateId),{recursive:true,force:true});
}
export function savePosterDraft(draft:PosterDraft) {
  db().prepare('INSERT INTO poster_draft(id,content) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content').run(JSON.stringify(draft));
}
export function getPosterDraft():PosterDraft | null {
  const row=db().prepare('SELECT content FROM poster_draft WHERE id=1').get() as {content:string}|undefined;
  return row?JSON.parse(row.content) as PosterDraft:null;
}
