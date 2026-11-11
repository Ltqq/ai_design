'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ActionIcon, Badge, Button, Group, NumberInput, Paper, ScrollArea, SegmentedControl, Stack, Text, Textarea, TextInput, Title, Tooltip } from '@mantine/core';
import { ArrowRight, Check, Download, ImagePlus, LayoutTemplate, MessageCircle, Paperclip, Plus, Send, Settings2, Sparkles, Trash2, WandSparkles, X } from 'lucide-react';
import { Heading, Loading, readJSON } from '@/components/ui';
import type { ChatMessage, ChatSession, StudioState } from '@/types';

type DesignView = StudioState & { preview: string };
const blankDesign: DesignView = { referencePath: '', draftId: '', templateId: '', width: 1080, height: 1440, preview: '' };
const ideas = [
  { title: '直接做模板', prompt: '帮我做一张 1080×1440 的 AI 模型促销海报，暗黑科技风、立体卡片，突出模型名称和折扣，最后转换成可复用的 HTML 模板。' },
  { title: '只生成设计图', prompt: '生成一张精致的 AI 模型促销海报参考图，深蓝紫色立体科技风，突出醒目的折扣展示区域。' },
  { title: '我有参考图片', prompt: '把我上传的参考图片转换成可复用的 HTML/CSS 模板，模型名称与折扣必须能够自动填充。' },
];

export default function CreatePage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [threadId, setThreadId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [design, setDesign] = useState<DesignView>(blankDesign);
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [tab, setTab] = useState<'reference' | 'template'>('reference');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshSessions = async () => {
    const data = await readJSON(await fetch('/api/studio', { cache: 'no-store' }));
    setSessions(data.sessions);
    return data.sessions as ChatSession[];
  };
  const openSession = async (id: string) => {
    setError('');
    const result = await readJSON(await fetch(`/api/studio?threadId=${id}`, { cache: 'no-store' }));
    setThreadId(id);
    setMessages(result.messages);
    setDesign(result.design);
    setTab(result.design.preview ? 'template' : 'reference');
    setAttachment('');
    setInput('');
  };
  useEffect(() => {
    refreshSessions().then(list => { if (list.length) return openSession(list[0].id); }).catch(err => setError(err.message));
  }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy]);

  const newSession = () => {
    if (busy) return;
    setThreadId('');
    setMessages([]);
    setDesign(blankDesign);
    setTemplateName('');
    setInput('');
    setAttachment('');
    setTab('reference');
    setError('');
  };
  const upload = async (file: File) => {
    setBusy('上传图片中…'); setError('');
    try {
      const data = new FormData(); data.append('file', file);
      const result = await readJSON(await fetch('/api/images/upload', { method: 'POST', body: data }));
      setAttachment(result.referencePath);
      setTab('reference');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(''); }
  };
  const send = async (override?: string) => {
    const text = (override ?? input).trim() || (attachment ? '请把这张图片转换成可复用的海报模板。' : '');
    if (!text || busy) return;
    const imagePath = attachment;
    const optimistic: ChatMessage = { id: 'pending', role: 'user', content: text, imagePath: imagePath || null, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    setInput(''); setAttachment(''); setError(''); setBusy('设计 Agent 正在处理…');
    try {
      const result = await readJSON(await fetch('/api/studio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ threadId: threadId || undefined, message: text, imagePath: imagePath || undefined, width: design.width, height: design.height }) }));
      setThreadId(result.threadId);
      setDesign(result.design);
      setTab(result.design.preview ? 'template' : 'reference');
      const history = await readJSON(await fetch(`/api/studio?threadId=${result.threadId}`, { cache: 'no-store' }));
      setMessages(history.messages);
      await refreshSessions();
    } catch (e) {
      setMessages(prev => prev.filter(item => item.id !== 'pending'));
      setInput(text); setAttachment(imagePath);
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(''); }
  };
  const removeSession = async () => {
    if (!threadId || !confirm('删除当前对话及其消息？已保存的海报模板不会被删除。')) return;
    try {
      await readJSON(await fetch(`/api/studio?threadId=${threadId}`, { method: 'DELETE' }));
      newSession();
      await refreshSessions();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const currentReference = attachment || design.referencePath;
  const visual = tab === 'template' && design.preview ? design.preview : currentReference;

  return <>
    <Heading eyebrow="AI POSTER STUDIO" title="AI 海报创作工作台" description="上传参考图或描述想法，和设计 Agent 对话。生图、转换模板、自然语言修改与保存，都在这里完成。" aside={<Link className="btn ghost" href="/settings"><Settings2 size={16}/>模型设置</Link>} />
    <div className="studio-layout">
      <Paper withBorder radius="lg" p="md" className="studio-threads">
        <Button fullWidth leftSection={<Plus size={16}/>} onClick={newSession} disabled={!!busy}>新建创作</Button>
        <Text size="xs" c="dimmed" fw={700} mt="lg" mb="xs">历史创作</Text>
        <ScrollArea className="studio-thread-scroll">
          <Stack gap={6}>
            {sessions.map(session => <Button key={session.id} fullWidth variant={threadId === session.id ? 'light' : 'subtle'} color={threadId === session.id ? 'violet' : 'gray'} justify="start" className="studio-thread" onClick={() => openSession(session.id)} disabled={!!busy} leftSection={<MessageCircle size={15}/>}>{session.title}</Button>)}
            {!sessions.length && <Text c="dimmed" size="xs" mt="sm">第一条创作消息发送后会自动保存。</Text>}
          </Stack>
        </ScrollArea>
        {threadId && <Button color="red" variant="subtle" size="xs" leftSection={<Trash2 size={14}/>} onClick={removeSession} disabled={!!busy}>删除此对话</Button>}
      </Paper>

      <Paper withBorder radius="lg" p={0} className="studio-chat">
        <Group justify="space-between" px="lg" py="md" className="studio-chat-top">
          <Group gap="xs"><span className="studio-agent-icon"><Sparkles size={18}/></span><div><Text fw={750} size="sm">海报设计 Agent</Text><Text size="xs" c="dimmed">对话驱动 · 自动调用设计工具</Text></div></Group>
          <Badge color={busy ? 'yellow' : 'teal'} variant="light">{busy ? '创作中' : '就绪'}</Badge>
        </Group>
        <ScrollArea className="studio-messages" viewportRef={scrollRef}>
          {messages.length ? <Stack gap="lg" p="lg">{messages.map(item => <div key={item.id} className={`studio-message ${item.role}`}>
            <Text size="xs" c="dimmed" fw={700} mb={6}>{item.role === 'assistant' ? 'AI DESIGN' : '你'}</Text>
            {item.imagePath && <img src={item.imagePath} alt="消息附带的设计参考图" className="studio-message-image"/>}
            <Text size="sm" lh={1.85} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.content}</Text>
          </div>)}</Stack> : <Stack align="center" justify="center" gap="md" p="xl" className="studio-welcome">
            <span className="studio-welcome-icon"><WandSparkles size={27}/></span>
            <Title order={3} ta="center">从灵感到可复用海报</Title>
            <Text size="sm" c="dimmed" ta="center">直接描述你想要的效果，或者附上一张参考图。Agent 会按你的需求操作。</Text>
            <Stack w="100%" gap="sm" mt="sm">{ideas.map(item => <Button key={item.title} size="md" variant="light" color="gray" className="studio-idea" fullWidth justify="start" onClick={() => item.title === '我有参考图片' ? fileRef.current?.click() : send(item.prompt)} disabled={!!busy}>{item.title}<ArrowRight size={15} style={{ marginLeft: 'auto' }}/></Button>)}</Stack>
          </Stack>}
          {busy === '设计 Agent 正在处理…' && <div className="studio-thinking"><Loading text="AI 正在分析需求、调用工具并更新预览…"/></div>}
        </ScrollArea>
        <div className="studio-composer">
          {error && <Paper withBorder p="sm" mb="xs" c="red" role="alert"><Text size="xs">{error}</Text></Paper>}
          {attachment && <Group gap="xs" mb="xs"><img src={attachment} alt="待发送的参考图" className="studio-attachment"/><Text size="xs" c="dimmed">已添加参考图</Text><ActionIcon aria-label="移除附件" size="sm" color="gray" variant="subtle" onClick={() => setAttachment('')}><X size={15}/></ActionIcon></Group>}
          <Textarea autosize minRows={2} maxRows={5} value={input} disabled={!!busy} onChange={event => setInput(event.currentTarget.value)} placeholder="例如：帮我做暗黑立体风格的模型折扣模板；或者把卡片调亮一点…" aria-label="向设计 Agent 输入消息" onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }}/>
          <Group justify="space-between" mt="sm">
            <Group gap="xs"><input type="file" accept="image/png,image/jpeg,image/webp" hidden ref={fileRef} onChange={event => { if (event.target.files?.[0]) upload(event.target.files[0]); event.target.value = ''; }}/><Button size="xs" color="gray" variant="subtle" leftSection={<Paperclip size={15}/>} onClick={() => fileRef.current?.click()} disabled={!!busy}>上传参考图</Button><Text c="dimmed" size="xs">Enter 发送</Text></Group>
            <Button size="sm" rightSection={<Send size={15}/>} onClick={() => send()} disabled={!!busy || (!input.trim() && !attachment)}>发送</Button>
          </Group>
        </div>
      </Paper>

      <Paper withBorder radius="lg" p="lg" className="studio-preview-panel">
        <Group justify="space-between" mb="md"><div><Text fw={750}>设计预览</Text><Text size="xs" c="dimmed">始终展示当前会话的设计结果</Text></div><Badge variant="outline" color="gray">{design.width} × {design.height}</Badge></Group>
        <SegmentedControl size="sm" fullWidth value={tab} onChange={value => setTab(value as 'reference' | 'template')} data={[{label:'参考图片',value:'reference'},{label:'HTML 模板',value:'template',disabled:!design.preview}]} mb="md"/>
        <div className="studio-preview-stage">{visual ? <img src={visual} alt={tab === 'template' && design.preview ? '当前可复用 HTML 模板预览' : '当前海报参考图'}/> : <Stack justify="center" align="center" gap="sm" h="100%" p="lg"><ImagePlus size={40} color="#887cbd"/><Text size="sm" ta="center" c="dimmed">图片或 HTML 模板生成后，会在这里显示。</Text></Stack>}</div>
        <Group gap="sm" mt="md" grow><NumberInput label="宽度 px" min={100} max={4000} value={design.width} onChange={value => setDesign(current => ({...current,width:Number(value)||1080}))} size="xs" disabled={!!busy}/><NumberInput label="高度 px" min={100} max={4000} value={design.height} onChange={value => setDesign(current => ({...current,height:Number(value)||1440}))} size="xs" disabled={!!busy}/></Group>
        <Stack mt="lg" gap="sm">
          <Button fullWidth variant="light" leftSection={<WandSparkles size={16}/>} onClick={() => send('请把当前参考图片转换为可复用的 HTML 海报模板，模型名称和折扣必须使用动态变量。')} disabled={!currentReference || !!busy}>转换为模板</Button>
          {design.draftId || design.templateId ? <>
            <TextInput label="模板名称" placeholder="如：暗黑科技促销海报" value={templateName} onChange={event => setTemplateName(event.currentTarget.value)}/>
            <Button fullWidth leftSection={<Check size={16}/>} disabled={!templateName.trim() || !!busy} onClick={() => send(`请把当前设计保存为模板，名字是「${templateName.trim()}」。`)}>{design.templateId ? '更新模板名称' : '保存到模板库'}</Button>
          </> : null}
          {design.templateId ? <Button component={Link} href={`/posters?template=${design.templateId}`} fullWidth color="teal" rightSection={<ArrowRight size={16}/>}>用 Excel 填充海报</Button> : null}
          {design.preview && <Text size="xs" c="dimmed" ta="center">不满意？直接在左侧告诉 Agent 需要怎样修改。</Text>}
        </Stack>
      </Paper>
    </div>
  </>;
}
