import Database from 'better-sqlite3';
import { mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Manifest, ModelConfig, ModelKind, TemplateRecord, TemplateSource } from '@/types';

export const dataDir = path.resolve(process.env.AI_DESIGN_DATA_DIR || './data');
let connection: Database.Database | undefined;
export function db() {
  if (!connection) {
    mkdirSync(dataDir, { recursive: true });
    connection = new Database(path.join(dataDir, 'ai-design.sqlite'));
    connection.exec(`CREATE TABLE IF NOT EXISTS model_configs (kind TEXT PRIMARY KEY, base_url TEXT NOT NULL, model_id TEXT NOT NULL, api_key TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, created_at TEXT NOT NULL);`);
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
