'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ActionIcon, Badge, Button, Group, NumberInput, Paper, ScrollArea, SegmentedControl, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { ArrowRight, Check, ImagePlus, MessageCircle, Paperclip, Plus, Send, Settings2, Sparkles, Trash2, WandSparkles, X, Activity, Clock3, RotateCcw, ChevronDown } from 'lucide-react';
import { Heading, Loading, readJSON } from '@/components/ui';
import type { ChatMessage, ChatSession, StudioState, StudioEvent, StudioRun } from '@/types';

type DesignView=StudioState & {preview:string};
const blankDesign:DesignView={referencePath:'',draftId:'',templateId:'',width:1080,height:1440,preview:''};
const ideas=[
  {title:'直接做模板',prompt:'请直接用 HTML/CSS 制作一张 1080×1440 AI 模型促销海报模板，不要先调用图片生成模型。暗黑科技风、立体卡片，突出模型名称和折扣。'},
  {title:'只生成设计图',prompt:'生成一张精致的 AI 模型促销海报参考图，深蓝紫色立体科技风，突出醒目的折扣展示区域。'},
  {title:'我有参考图片',prompt:'把我上传的参考图片转换成可复用的 HTML/CSS 模板，模型名称与折扣必须能够自动填充。'},
];
const usageName:Record<string,string>={'agent-routing':'Agent 对话','template-create':'首次 HTML 生成','template-patch':'局部源码编辑','template-redesign':'整体重构','template-visual-review':'视觉复查','image-generate':'图片生成','capability-image-test':'生图能力测试','capability-vision-test':'多模态能力测试'};
const tools:Record<string,string>={generateImage:'生成参考海报',createTemplateFromText:'文字直接生成 HTML',convertToTemplate:'图片转 HTML 模板',reviseTemplate:'局部编辑 HTML/CSS',redesignTemplate:'整体重构模板',reviewTemplate:'视觉复查与局部修正',saveTemplate:'保存到模板库'};

export default function CreatePage(){
  const [sessions,setSessions]=useState<ChatSession[]>([]);
  const [threadId,setThreadId]=useState('');
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [design,setDesign]=useState<DesignView>(blankDesign);
  const [run,setRun]=useState<StudioRun|null>(null);
  const [events,setEvents]=useState<StudioEvent[]>([]);
  const [liveText,setLiveText]=useState('');
  const [input,setInput]=useState('');
  const [attachment,setAttachment]=useState('');
  const [templateName,setTemplateName]=useState('');
  const [tab,setTab]=useState<'reference'|'template'>('reference');
  const [uploading,setUploading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);
  const scrollRef=useRef<HTMLDivElement>(null);
  const seenEvents=useRef<Set<number>>(new Set());
  const queuedText=useRef('');
  const animationFrame=useRef<number|null>(null);
  const appendStreamText=(text:string)=>{
    queuedText.current+=text;
    if(animationFrame.current!==null)return;
    const tick=()=>{
      const pending=queuedText.current;
      if(!pending){animationFrame.current=null;return}
      const count=Math.min(12,Math.max(2,Math.ceil(pending.length/8)));
      queuedText.current=pending.slice(count);
      setLiveText(old=>old+pending.slice(0,count));
      animationFrame.current=requestAnimationFrame(tick);
    };
    animationFrame.current=requestAnimationFrame(tick);
  };
  const resetStreamText=()=>{
    queuedText.current='';
    if(animationFrame.current!==null)cancelAnimationFrame(animationFrame.current);
    animationFrame.current=null;
    setLiveText('');
  };
  const busy=run?.status==='running'||uploading||saving;

  const refreshSessions=async()=>{
    const result=await readJSON(await fetch('/api/studio',{cache:'no-store'}));
    setSessions(result.sessions);
    return result.sessions as ChatSession[];
  };
  const openSession=async(id:string)=>{
    const result=await readJSON(await fetch(`/api/studio?threadId=${id}`,{cache:'no-store'}));
    setThreadId(id);setMessages(result.messages);setDesign(result.design);
    setRun(result.run||null);setEvents(result.events||[]);
    seenEvents.current=new Set((result.events||[]).map((event:StudioEvent)=>event.id));
    resetStreamText();setTab(result.design.preview?'template':'reference');
    setAttachment('');setInput('');setError('');
  };
  useEffect(()=>{refreshSessions().then(list=>{if(list.length)return openSession(list[0].id)}).catch(e=>setError(e.message))},[]);
  useEffect(()=>{
    const viewport=scrollRef.current;
    if(viewport)viewport.scrollTop=viewport.scrollHeight;
  },[messages,events,liveText]);
  useEffect(()=>{
    if(run?.status!=='running')return;
    const activeId=run.id;
    const stream=new EventSource(`/api/studio/runs/${activeId}/events`);
    stream.addEventListener('update',(raw)=>{
      const event=JSON.parse((raw as MessageEvent).data) as StudioEvent;
      if(seenEvents.current.has(event.id))return;
      seenEvents.current.add(event.id);
      if(event.type==='text')appendStreamText(String(event.payload.text||''));
      else {
        setEvents(previous=>[...previous,event]);
        if((event.type==='progress'||event.type==='tool'||event.type==='finished')&&event.payload.design){
          const updated=event.payload.design as DesignView;
          setDesign(updated);
          if(updated.preview)setTab('template');
        }
        if(event.type==='finished'){
          stream.close();
          if(event.payload.status==='failed')setError(String(event.payload.error||'执行失败，已保留当前设计'));
          void openSession(threadId).then(refreshSessions).catch(e=>setError(e.message));
        }
      }
    });
    stream.onerror=()=>{ /* EventSource automatically reconnects and replays missed events. */ };
    return()=>stream.close();
  },[run?.id,run?.status,threadId]);

  const newSession=()=>{
    setThreadId('');setMessages([]);setRun(null);setEvents([]);setDesign(blankDesign);
    resetStreamText();setTemplateName('');setAttachment('');setInput('');setTab('reference');setError('');setNotice('');
    seenEvents.current=new Set();
  };
  const upload=async(file:File)=>{
    setUploading(true);setError('');
    try{
      const data=new FormData();data.append('file',file);
      const result=await readJSON(await fetch('/api/images/upload',{method:'POST',body:data}));
      setAttachment(result.referencePath);setTab('reference');
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setUploading(false)}
  };
  const send=async(override?:string)=>{
    const message=(override??input).trim()||(attachment?'请把这张图片转换成可复用的海报模板。':'');
    if(!message||busy)return;
    const imagePath=attachment;
    const optimistic:ChatMessage={id:'pending',role:'user',content:message,imagePath:imagePath||null,createdAt:new Date().toISOString()};
    setMessages(previous=>[...previous,optimistic]);setInput('');setAttachment('');setError('');resetStreamText();
    try{
      const result=await readJSON(await fetch('/api/studio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({threadId:threadId||undefined,message,imagePath:imagePath||undefined,width:design.width,height:design.height})}));
      setThreadId(result.threadId);setDesign(result.design);setEvents([]);seenEvents.current=new Set();
      setRun({id:result.runId,threadId:result.threadId,status:'running',error:null,createdAt:new Date().toISOString(),finishedAt:null});
      await refreshSessions();
    }catch(e){
      setMessages(previous=>previous.filter(item=>item.id!=='pending'));
      setInput(message);setAttachment(imagePath);setError(e instanceof Error?e.message:String(e));
    }
  };
  const stopGeneration=async()=>{
    if(!run||run.status!=='running')return;
    try{
      await readJSON(await fetch(`/api/studio/runs/${run.id}/cancel`,{method:'POST'}));
      setNotice('正在停止生成，已完成的模板会保留。');
    }catch(e){setError(e instanceof Error?e.message:String(e))}
  };
  const saveCurrentTemplate=async()=>{
    if(!threadId||!templateName.trim()||busy)return;
    setSaving(true);setError('');setNotice('');
    try{
      const result=await readJSON(await fetch('/api/studio/save-template',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({threadId,name:templateName.trim()})}));
      setDesign(result.design);
      setTab('template');
      setNotice('模板已保存。之后修改已有模板时，系统会自动保留旧版本。');
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setSaving(false)}
  };
  const removeSession=async()=>{
    if(!threadId||run?.status==='running'||!confirm('删除当前对话及消息？已保存的模板仍会保留。'))return;
    try{
      await readJSON(await fetch(`/api/studio?threadId=${threadId}`,{method:'DELETE'}));
      newSession();await refreshSessions();
    }catch(e){setError(e instanceof Error?e.message:String(e))}
  };
  const reference=attachment||design.referencePath;
  const visual=tab==='template'&&design.preview?design.preview:reference;
  const activity=events.filter(event=>event.type==='progress'||event.type==='tool'||event.type==='usage');
  const reasoning=events.filter(event=>event.type==='reasoning').map(event=>String(event.payload.text||'')).join('');
  const latestError=run?.status==='failed'||run?.status==='interrupted'?run.error:null;

  return <>
    <Heading eyebrow="AI POSTER STUDIO" title="AI 海报创作工作台" description="只需要描述需求或上传参考图，Agent 会调用工具完成生图、模板转换与修改；即使离开页面，任务也会继续执行。" aside={<Link className="btn ghost" href="/settings"><Settings2 size={16}/>模型设置</Link>}/>
    <div className="studio-layout">
      <Paper withBorder radius="lg" p="md" className="studio-threads">
        <Button fullWidth leftSection={<Plus size={16}/>} onClick={newSession}>新建创作</Button>
        <Text size="xs" c="dimmed" fw={700} mt="lg" mb="xs">历史创作</Text>
        <ScrollArea className="studio-thread-scroll"><Stack gap={6}>
          {sessions.map(session=><Button key={session.id} fullWidth variant={threadId===session.id?'light':'subtle'} color={threadId===session.id?'violet':'gray'} justify="start" className="studio-thread" onClick={()=>openSession(session.id)} leftSection={<MessageCircle size={15}/>}>{session.title}</Button>)}
          {!sessions.length&&<Text c="dimmed" size="xs" mt="sm">发送第一条消息后，会话自动保存。</Text>}
        </Stack></ScrollArea>
        {threadId&&<Button color="red" variant="subtle" size="xs" leftSection={<Trash2 size={14}/>} onClick={removeSession} disabled={run?.status==='running'}>删除此对话</Button>}
      </Paper>
      <Paper withBorder radius="lg" p={0} className="studio-chat">
        <Group justify="space-between" px="lg" py="md" className="studio-chat-top">
          <Group gap="xs"><span className="studio-agent-icon"><Sparkles size={18}/></span><div><Text fw={750} size="sm">海报设计 Agent</Text><Text size="xs" c="dimmed">Mastra · 真实工具执行时间线</Text></div></Group>
          <Badge color={busy?'yellow':latestError?'red':'teal'} variant="light">{busy?'运行中 · 切页不中断':run?.status==='cancelled'?'已停止':latestError?'需要处理':'就绪'}</Badge>
        </Group>
        <ScrollArea className="studio-messages" viewportRef={scrollRef}>
          {messages.length?<Stack gap="lg" p="lg">{messages.map(item=><div key={item.id} className={`studio-message ${item.role}`}>
            <Text size="xs" c="dimmed" fw={700} mb={6}>{item.role==='assistant'?'AI DESIGN':'你'}</Text>
            {item.imagePath&&<img src={item.imagePath} alt="消息附带的设计参考图" className="studio-message-image"/>}
            <Text size="sm" lh={1.85} style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{item.content}</Text>
          </div>)}
            {(activity.length>0||reasoning)&&<Paper p="md" radius="md" withBorder className="studio-event-panel">
              <Group gap="xs" mb="sm"><Activity size={16}/><Text size="sm" fw={700}>Agent 执行记录</Text><Badge variant="light" color="gray">已持久保存</Badge></Group>
              <Stack gap={8}>{activity.slice(-18).map(item=><Group gap="sm" key={item.id} className="studio-event-row">
                {item.type==='tool'?item.payload.status==='running'?<Clock3 size={15} color="#bba9ff"/>:<Check size={15} color="#66dbb3"/>:<Activity size={15} color="#9ca8cb"/>}
                <Text size="xs">{item.type==='tool'?`${tools[String(item.payload.toolName)]||String(item.payload.toolName)} · ${item.payload.status==='running'?'正在执行':'完成'}`:item.type==='usage'?`${usageName[String(item.payload.operation)]||String(item.payload.operation||'模型请求')} · 输入 ${item.payload.inputTokens??'未知'} / 输出 ${item.payload.outputTokens??'未知'} · ${item.payload.estimatedCostCny===null?'费用未知':`¥${Number(item.payload.estimatedCostCny).toFixed(4)}`}`:String(item.payload.stage||'处理中')}</Text>
              </Group>)}</Stack>
              {reasoning&&<details className="studio-reasoning"><summary><ChevronDown size={14}/>模型返回的思考内容</summary><Text size="xs" lh={1.7} style={{whiteSpace:'pre-wrap'}}>{reasoning}</Text></details>}
            </Paper>}
            {run?.status==='running'&&<div className="studio-message assistant"><Text size="xs" fw={700} c="violet.3" mb={6}>AI DESIGN · 正在回复</Text>{liveText?<Text size="sm" lh={1.85} style={{whiteSpace:'pre-wrap'}}>{liveText}</Text>:<Loading text="正在处理模型响应或执行工具…"/>}</div>}
          </Stack>:<Stack align="center" justify="center" gap="md" p="xl" className="studio-welcome">
            <span className="studio-welcome-icon"><WandSparkles size={27}/></span><Title order={3} ta="center">从灵感到可复用海报</Title>
            <Text size="sm" c="dimmed" ta="center">直接描述你想要的效果，或上传参考图。工具执行进度会在对话中显示。</Text>
            <Stack w="100%" gap="sm" mt="sm">{ideas.map(idea=><Button key={idea.title} size="md" variant="light" color="gray" className="studio-idea" fullWidth justify="start" onClick={()=>idea.title==='我有参考图片'?fileRef.current?.click():send(idea.prompt)} disabled={!!busy}>{idea.title}<ArrowRight size={15} style={{marginLeft:'auto'}}/></Button>)}</Stack>
          </Stack>}
          {run?.status==='running'&&!messages.length&&<div className="studio-thinking"><Loading text="任务正在后台执行…"/></div>}
        </ScrollArea>
        <div className="studio-composer">
          {notice&&<Paper withBorder p="sm" mb="xs" c="teal" role="status"><Text size="xs">{notice}</Text></Paper>}
          {(error||latestError)&&<Paper withBorder p="sm" mb="xs" c="red" role="alert"><Group justify="space-between"><Text size="xs">{error||latestError}</Text>{latestError&&<Button size="xs" variant="light" leftSection={<RotateCcw size={13}/>} onClick={()=>{const last=[...messages].reverse().find(item=>item.role==='user');if(last){setInput(last.content);setAttachment(last.imagePath||'')}}}>恢复上次输入</Button>}</Group></Paper>}
          {attachment&&<Group gap="xs" mb="xs"><img src={attachment} alt="待发送的参考图" className="studio-attachment"/><Text size="xs" c="dimmed">已添加参考图</Text><ActionIcon aria-label="移除附件" size="sm" color="gray" variant="subtle" onClick={()=>setAttachment('')}><X size={15}/></ActionIcon></Group>}
          <Textarea autosize minRows={2} maxRows={5} value={input} disabled={!!busy} onChange={event=>setInput(event.currentTarget.value)} placeholder="例如：直接做 HTML 模板；或生成参考图再转模板；也可以只调亮卡片…" aria-label="向设计 Agent 输入消息" onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();send()}}}/>
          <Group justify="space-between" mt="sm"><Group gap="xs"><input type="file" accept="image/png,image/jpeg,image/webp" hidden ref={fileRef} onChange={event=>{if(event.target.files?.[0])upload(event.target.files[0]);event.target.value=''}}/><Button size="xs" color="gray" variant="subtle" leftSection={<Paperclip size={15}/>} onClick={()=>fileRef.current?.click()} disabled={!!busy}>上传参考图</Button><Text c="dimmed" size="xs">Enter 发送</Text></Group>{run?.status==='running'&&<Button size="sm" color="red" variant="light" onClick={stopGeneration}>停止生成</Button>}
          <Button size="sm" rightSection={<Send size={15}/>} onClick={()=>send()} disabled={!!busy||(!input.trim()&&!attachment)}>发送</Button></Group>
        </div>
      </Paper>
      <Paper withBorder radius="lg" p="lg" className="studio-preview-panel">
        <Group justify="space-between" mb="md"><div><Text fw={750}>设计预览</Text><Text size="xs" c="dimmed">随工具执行更新，切页返回继续查看</Text></div><Badge variant="outline" color="gray">{design.width} × {design.height}</Badge></Group>
        <SegmentedControl size="sm" fullWidth value={tab} onChange={value=>setTab(value as 'reference'|'template')} data={[{label:'参考图片',value:'reference'},{label:'HTML 模板',value:'template',disabled:!design.preview}]} mb="md"/>
        <div className="studio-preview-stage">{visual?<img src={visual} alt={tab==='template'&&design.preview?'当前可复用 HTML 模板预览':'当前海报参考图'}/>:<Stack justify="center" align="center" gap="sm" h="100%" p="lg"><ImagePlus size={40} color="#887cbd"/><Text size="sm" ta="center" c="dimmed">图片或 HTML 模板生成后，会在这里显示。</Text></Stack>}</div>
        <Group gap="sm" mt="md" grow><NumberInput label="宽度 px" min={100} max={4000} value={design.width} onChange={value=>setDesign(current=>({...current,width:Number(value)||1080}))} size="xs" disabled={!!busy}/><NumberInput label="高度 px" min={100} max={4000} value={design.height} onChange={value=>setDesign(current=>({...current,height:Number(value)||1440}))} size="xs" disabled={!!busy}/></Group>
        <Stack mt="lg" gap="sm"><Button fullWidth variant="light" leftSection={<WandSparkles size={16}/>} onClick={()=>send('请把当前参考图片转换为可复用的 HTML 海报模板，模型名称和折扣必须使用动态变量。')} disabled={!reference||!!busy}>转换为模板</Button>
          {design.templateId?<Group gap="xs" className="studio-saved-indicator"><Check size={15} color="#66dbb3"/><Text size="sm" c="teal.3">模板已保存，继续修改也可从模板库恢复旧版本。</Text></Group>:design.draftId?<><TextInput label="模板名称" placeholder="如：暗黑科技促销海报" value={templateName} onChange={event=>setTemplateName(event.currentTarget.value)}/><Button fullWidth leftSection={<Check size={16}/>} disabled={!templateName.trim()||!!busy} onClick={saveCurrentTemplate}>保存到模板库</Button></>:null}
          {design.templateId&&<Button component={Link} href={`/posters?template=${design.templateId}`} fullWidth color="teal" rightSection={<ArrowRight size={16}/>}>用 Excel 填充海报</Button>}
          {design.preview&&<>
            <Button fullWidth size="xs" variant="light" color="gray" disabled={!!busy} onClick={()=>send('请对当前 HTML 模板做视觉检查，对照实际渲染截图（如有参考图片也一起比较），只修正明显的遮挡、层次、布局和比例问题；保持原有设计与动态数据字段，使用局部补丁。')}>AI 视觉复查 · 按需额外计费</Button>
            <Text size="xs" c="dimmed" ta="center">不满意也可直接告诉 Agent 要修改的部分；旧版本可在模板库恢复。</Text>
          </>}
        </Stack>
      </Paper>
    </div>
  </>;
}
