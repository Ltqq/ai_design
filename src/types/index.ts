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
export type ModelDiscount = { name: string; discount: string };
export type PosterInput = { templateId: string; models: ModelDiscount[]; fixedFields: Record<string,string> };
export type PosterRecord = { id: string; templateName: string; modelCount: number; createdAt: string };
export type ChatSession = { id: string; title: string; updatedAt: string };
export type ChatMessage = { id: string; role: 'user'|'assistant'; content: string; imagePath: string|null; createdAt: string };

export type StudioState = { referencePath:string; draftId:string; templateId:string; width:number; height:number };

export type StudioRun = {id:string;threadId:string;status:'running'|'completed'|'failed'|'interrupted';error:string|null;createdAt:string;finishedAt:string|null};
export type StudioEvent = {id:number;runId:string;type:string;payload:Record<string,unknown>;createdAt:string};
export type TemplateVersion = {id:string;templateId:string;createdAt:string};
export type PosterDraft = {templateId:string;selectedNames:string[];fixedFields:Record<string,string>};
