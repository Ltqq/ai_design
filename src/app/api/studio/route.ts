import { NextResponse } from 'next/server';
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { chatInputSchema } from '@/lib/schemas';
import { withErrors } from '@/lib/http';
import { designStudioAgent } from '@/mastra/agents/design-studio';
import { deleteChat, getChat, getStudioState, listChats, referenceBytes, saveChatExchange, saveStudioState } from '@/lib/storage';
import type { StudioState } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

const studioInputSchema = chatInputSchema.extend({
  width: z.number().int().min(100).max(4000).optional(),
  height: z.number().int().min(100).max(4000).optional(),
});
const threadSchema = z.string().uuid();

function studioView(state: StudioState) {
  return {
    ...state,
    preview: state.templateId ? `/api/assets/templates/${state.templateId}/thumbnail.png?v=${Date.now()}`
      : state.draftId ? `/api/assets/drafts/${state.draftId}/thumbnail.png?v=${Date.now()}` : '',
  };
}

export const GET = withErrors(async (request: Request) => {
  const id = new URL(request.url).searchParams.get('threadId');
  if (!id) return NextResponse.json({ sessions: listChats() });
  threadSchema.parse(id);
  return NextResponse.json({ messages: getChat(id), design: studioView(getStudioState(id)) });
});

export const POST = withErrors(async (request: Request) => {
  const { threadId, message, imagePath, width, height } = studioInputSchema.parse(await request.json());
  const design = getStudioState(threadId);
  if (imagePath) design.referencePath = imagePath;
  if (width) design.width = width;
  if (height) design.height = height;

  const messages: Array<{
    role: 'user' | 'assistant';
    content: string | Array<{ type: 'text'; text: string } | { type: 'file'; data: string; mediaType: string }>;
  }> = [];
  for (const item of threadId ? getChat(threadId) : []) {
    if (item.imagePath) {
      const bytes = await referenceBytes(item.imagePath);
      messages.push({ role: 'user', content: [
        { type: 'text', text: item.content },
        { type: 'file', data: bytes.toString('base64'), mediaType: item.imagePath.endsWith('.png') ? 'image/png' : item.imagePath.endsWith('.webp') ? 'image/webp' : 'image/jpeg' },
      ] });
    } else messages.push({ role: item.role, content: item.content });
  }
  const content: Array<{ type: 'text'; text: string } | { type: 'file'; data: string; mediaType: string }> = [{ type: 'text', text: message }];
  if (imagePath) {
    const bytes = await referenceBytes(imagePath);
    content.push({ type: 'file', data: bytes.toString('base64'), mediaType: imagePath.endsWith('.png') ? 'image/png' : imagePath.endsWith('.webp') ? 'image/webp' : 'image/jpeg' });
  }
  messages.push({ role: 'user', content });
  const result = await designStudioAgent(design).generate(messages, { maxSteps: 7, toolCallConcurrency: 1 });
  const reply = result.text.trim() || (design.draftId ? '设计已经更新，请查看右侧预览。' : '操作完成，请查看右侧。');
  const id = saveChatExchange(threadId, message, imagePath || null, reply);
  saveStudioState(id, design);
  return NextResponse.json({ threadId: id, reply, design: studioView(design) });
});

export const DELETE = withErrors(async (request: Request) => {
  const id = threadSchema.parse(new URL(request.url).searchParams.get('threadId'));
  deleteChat(id);
  return NextResponse.json({ success: true });
});
