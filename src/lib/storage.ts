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
