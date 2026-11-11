import Database from 'better-sqlite3';
import { mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ChatMessage, ChatSession, Manifest, ModelConfig, ModelDiscount, ModelKind, PosterRecord, TemplateRecord, TemplateSource, StudioState } from '@/types';

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
    `);
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
