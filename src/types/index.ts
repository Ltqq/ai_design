export type Field = { key: string; label: string; type: 'text' | 'image' | 'list' };
export type ListField = { key: string; label: string };
export type Manifest = {
  name: string;
  width: number;
  height: number;
  fields: Field[];
  listFields: Record<string, ListField[]>;
};
export type TemplateSource = { html: string; css: string; manifest: Manifest };
export type TemplateRecord = { id: string; name: string; width: number; height: number; thumbnail: string; createdAt: string };
export type ModelKind = 'vision' | 'image';
export type ModelConfig = { baseURL: string; modelId: string; apiKey: string };
export type SheetData = { name: string; columns: string[]; rows: Record<string, string>[] };
export type Mapping = Record<string, string>;
export type PosterInput = { templateId: string; rows: Record<string, string>[]; selectedRows: number[]; mapping: Mapping; fixedFields: Record<string, string> };

export type StudioRun = {id:string;threadId:string;status:'running'|'completed'|'failed'|'interrupted';error:string|null;createdAt:string;finishedAt:string|null};
export type StudioEvent = {id:number;runId:string;type:string;payload:Record<string,unknown>;createdAt:string};
export type TemplateVersion = {id:string;templateId:string;createdAt:string};
export type PosterDraft = {templateId:string;selectedNames:string[];fixedFields:Record<string,string>};
