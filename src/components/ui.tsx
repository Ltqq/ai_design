'use client';
import { LoaderCircle, ImagePlus, ArrowRight } from 'lucide-react';
import { Button as MantineButton, Paper, Text, Title } from '@mantine/core';
import type { ButtonProps, ElementProps } from '@mantine/core';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface ActionProps extends ButtonProps, ElementProps<'button', keyof ButtonProps> {}

/** Bridge legacy page actions to Mantine while retaining existing interaction props. */
export function ActionButton({className = '', children, ...props}: ActionProps) {
  const tokens = className.split(/\s+/);
  const variant = tokens.includes('ghost') ? 'subtle' : tokens.includes('soft') ? 'light' : tokens.includes('danger') ? 'light' : tokens.includes('primary') ? 'filled' : 'default';
  const size = tokens.includes('tiny') ? 'xs' : 'sm';
  const kept = tokens.filter(token => !['btn','primary','ghost','soft','danger','tiny','full'].includes(token)).join(' ');
  return <MantineButton {...props} variant={variant} size={size} color={tokens.includes('danger') ? 'red' : 'violet'} fullWidth={tokens.includes('full')} className={kept || undefined}>{children}</MantineButton>;
}

export function Heading({eyebrow,title,description,aside}:{eyebrow:string;title:string;description:string;aside?:ReactNode}) {
  return <div className="page-intro"><div><Text size="xs" fw={800} c="violet.3" tt="uppercase" lts={2.5} mb={12}>{eyebrow}</Text><Title order={1} className="page-heading">{title}</Title><Text c="dimmed" size="sm" lh={1.75}>{description}</Text></div>{aside&&<div className="heading-aside">{aside}</div>}</div>;
}
export function Panel({title,children,description,aside,className=''}:{title?:string;children:ReactNode;description?:string;aside?:ReactNode;className?:string}) {
  return <Paper withBorder shadow="sm" radius="lg" p="xl" className={`panel ${className}`}>
    {(title||aside)&&<div className="panel-heading"><div>{title&&<Title order={2} size="h4">{title}</Title>}{description&&<Text size="xs" c="dimmed" mt={7} lh={1.7}>{description}</Text>}</div>{aside}</div>}{children}
  </Paper>;
}
export function Loading({text}:{text:string}){return <span className="progress" role="status"><LoaderCircle className="spinner"/>{text}</span>}
export function Placeholder({text,href,action}:{text:string;href?:string;action?:string}){return <div className="placeholder"><div className="placeholder-icon"><ImagePlus size={27}/></div><p>{text}</p>{href&&<Link className="inline-link" href={href}>{action||'立即开始'}<ArrowRight size={15}/></Link>}</div>}
export async function readJSON(response:Response){const data=await response.json();if(!response.ok)throw new Error(data.error||'操作失败');return data}
