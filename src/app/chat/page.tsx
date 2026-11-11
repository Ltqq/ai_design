'use client';
import { ActionButton } from '@/components/ui';
import { useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import { MessageSquareText, Plus, Send, Paperclip, X, Trash2, Sparkles, Image as ImageIcon, Lightbulb, SlidersHorizontal, Bot, Info } from 'lucide-react';
import { Heading,Loading,readJSON } from '@/components/ui';
import type { ChatMessage,ChatSession } from '@/types';

const starters=[
  '帮我构思一张有高级立体科技感的模型促销海报',
  '一张优秀的 AI 模型折扣海报应该突出哪些信息？',
  '帮我写 3 版简洁、有吸引力的海报主标题',
  '分析我上传的海报，给出提升设计质感的建议',
];
export default function ChatPage(){
  const [sessions,setSessions]=useState<ChatSession[]>([]),[threadId,setThreadId]=useState(''),[messages,setMessages]=useState<ChatMessage[]>([]);
  const [message,setMessage]=useState(''),[imagePath,setImagePath]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState('');
  const fileRef=useRef<HTMLInputElement>(null),scrollRef=useRef<HTMLDivElement>(null);
  const reload=()=>fetch('/api/chat').then(readJSON).then(data=>setSessions(data.sessions));
  useEffect(()=>{reload().catch(e=>setError(e.message))},[]);
  useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:'smooth'})},[messages,busy]);
  const open=async(id:string)=>{
    if(busy)return;
    setThreadId(id);setImagePath('');setMessage('');setError('');
    try{const data=await readJSON(await fetch(`/api/chat/${id}`));setMessages(data.messages)}catch(e){setError(e instanceof Error?e.message:String(e))}
  };
  const newChat=()=>{if(busy)return;setThreadId('');setMessages([]);setMessage('');setImagePath('');setError('')};
  const upload=async(file:File)=>{
    setBusy('正在上传图片…');setError('');
    try{
      const form=new FormData();form.append('file',file);
      const data=await readJSON(await fetch('/api/images/upload',{method:'POST',body:form}));setImagePath(data.referencePath);
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy('')}
  };
  const send=async(override?:string)=>{
    const content=(override??message).trim()||(imagePath?'请分析这张图片的设计风格、布局及可改进之处。':'');
    if(!content||busy)return;
    const attachment=imagePath;
    const pending:ChatMessage={id:'pending',role:'user',content,imagePath:attachment||null,createdAt:new Date().toISOString()};
    setMessages(prev=>[...prev,pending]);setMessage('');setImagePath('');setBusy('模型正在思考…');setError('');
    try{
      const data=await readJSON(await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({threadId:threadId||undefined,message:content,imagePath:attachment||undefined})}));
      setThreadId(data.threadId);
      const history=await readJSON(await fetch(`/api/chat/${data.threadId}`));setMessages(history.messages);
      await reload();
    }catch(e){setError(e instanceof Error?e.message:String(e));setMessages(prev=>prev.filter(x=>x.id!=='pending'));setMessage(content);setImagePath(attachment)}finally{setBusy('')}
  };
  const remove=async()=>{
    if(!threadId||!confirm('删除当前对话以及其中所有消息？'))return;
    try{await readJSON(await fetch(`/api/chat/${threadId}`,{method:'DELETE'}));newChat();await reload()}catch(e){setError(e instanceof Error?e.message:String(e))}
  };
  return <>
    <Heading eyebrow="DESIGN ASSISTANT" title="和你的多模态模型聊创意" description="讨论海报构图与营销文案，或上传一张图片让模型分析。对话记录保存在本地，可随时继续。" aside={<Link className="btn ghost" href="/settings"><SlidersHorizontal size={16}/>多模态模型设置</Link>}/>
    <div className="chat-layout">
      <aside className="chat-list"><ActionButton className="btn primary full" onClick={newChat} disabled={!!busy}><Plus size={17}/>开启新对话</ActionButton><div className="chat-items">{sessions.map(session=><button key={session.id} className={`chat-list-item ${threadId===session.id?'active':''}`} onClick={()=>open(session.id)} title={session.title}><MessageSquareText size={14} style={{verticalAlign:'middle',marginRight:8}}/>{session.title}</button>)}{!sessions.length&&<div className="hint" style={{padding:'20px 8px',textAlign:'center'}}>还没有历史对话。发出第一条消息后会自动保存。</div>}</div></aside>
      <section className="chat-window"><div className="chat-window-top"><div><h2>{threadId?sessions.find(s=>s.id===threadId)?.title||'继续对话':'新对话'}</h2><span>使用「模型设置」中的多模态理解模型</span></div>{threadId&&<ActionButton className="btn icon-button danger" aria-label="删除当前对话" title="删除当前对话" disabled={!!busy} onClick={remove}><Trash2 size={16}/></ActionButton>}</div>
        <div className="chat-scroll" ref={scrollRef}>{messages.length?messages.map(item=><article key={item.id} className={`chat-bubble ${item.role}`}><div className="chat-avatar">{item.role==='assistant'?<><Bot size={16}/>AI DESIGN</>:<>你</>}</div>{item.imagePath&&<img className="chat-attachment" src={item.imagePath} alt="上传的参考图片"/>}{item.content}</article>):<div className="chat-welcome"><div className="brandmark"><Sparkles size={23}/></div><h2>今天想创作什么？</h2><p>让多模态模型成为你的视觉设计伙伴。也可以先上传参考图，让它分析设计。</p><div className="chat-prompt-grid">{starters.map((starter,i)=><button key={starter} className="prompt-card" onClick={()=>send(starter)} disabled={!!busy}>{i===3?<ImageIcon size={17} style={{marginBottom:9,color:'#b0a4ff'}}/>:<Lightbulb size={17} style={{marginBottom:9,color:'#b0a4ff'}}/>}<div>{starter}</div></button>)}</div></div>}{busy==='模型正在思考…'&&<div className="chat-bubble assistant"><div className="chat-avatar"><Bot size={16}/>AI DESIGN</div><Loading text="模型正在生成回复…"/></div>}</div>
        <div className="chat-compose">{error&&<div className="notice error" style={{marginBottom:12}}><Info size={16}/>{error}</div>}{imagePath&&<div className="chips" style={{marginBottom:10}}><span className="chip"><img src={imagePath} alt="待发送图片" style={{width:32,height:32,objectFit:'cover',borderRadius:5}}/>图片已添加<ActionButton type="button" className="btn tiny ghost" aria-label="移除图片" onClick={()=>setImagePath('')}><X size={14}/></ActionButton></span></div>}
          <div className="chat-compose-box"><textarea rows={2} aria-label="输入消息" placeholder="说说你的想法，或上传一张图片让 AI 帮你分析…" value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} disabled={!!busy}/><div className="chat-compose-actions"><div><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>{if(e.target.files?.[0])upload(e.target.files[0]);e.target.value=''}}/><ActionButton className="btn ghost tiny" onClick={()=>fileRef.current?.click()} disabled={!!busy}><Paperclip size={16}/>上传图片</ActionButton></div><ActionButton className="btn primary" onClick={()=>send()} disabled={!!busy||(!message.trim()&&!imagePath)}><Send size={16}/>发送</ActionButton></div></div>
          <p className="hint" style={{margin:'10px 2px 0'}}>Enter 发送 · Shift + Enter 换行 · 会话内容保存在本机</p>
        </div>
      </section>
    </div>
  </>;
}
