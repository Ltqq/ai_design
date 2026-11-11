'use client';
import { LoaderCircle, ImagePlus } from 'lucide-react';
import type { ReactNode } from 'react';
export function Heading({eyebrow,title,description}:{eyebrow:string;title:string;description:string}){return <><div className="topline">{eyebrow}</div><h1 className="page-heading">{title}</h1><p className="subheading">{description}</p></>}
export function Panel({title,children}:{title?:string;children:ReactNode}){return <section className="panel">{title&&<h2>{title}</h2>}{children}</section>}
export function Loading({text}:{text:string}){return <div className="progress"><LoaderCircle className="spinner"/>{text}</div>}
export function Placeholder({text}:{text:string}){return <div className="placeholder"><ImagePlus size={38}/><div>{text}</div></div>}
export async function readJSON(response:Response){const data=await response.json();if(!response.ok)throw new Error(data.error||'操作失败');return data}
