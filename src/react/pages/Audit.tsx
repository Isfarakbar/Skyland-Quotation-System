import { useQuery } from '@tanstack/react-query';
import { Activity, Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import type { PageResult } from '../types';
import { shortDate, titleCase } from '../lib/format';
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader, Pagination } from '../components/ui';

interface AuditRow { id:string; action:string; entityType:string; entityId:string; summary:string; createdAt:string; ip?:string; actorId?:{firstName:string;lastName:string;email:string} }
export default function Audit(){const [page,setPage]=useState(1);const [search,setSearch]=useState('');const query=useQuery({queryKey:['audit',page,search],queryFn:()=>api<PageResult<AuditRow>>(`/audit?page=${page}&limit=30${search?`&action=${encodeURIComponent(search)}`:''}`)});return <div className="page"><PageHeader title="Audit History" description="Immutable security and operational activity across the system."/><div className="toolbar"><div className="search-box"><Search/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Filter by action, for example quotation…"/></div></div>{query.isLoading?<LoadingState label="Loading audit history"/>:query.error?<ErrorState error={query.error} retry={()=>query.refetch()}/>:!query.data?.items.length?<EmptyState title="No audit events found" message="Security and operational activity will appear here."/>:<><div className="audit-list">{query.data.items.map(row=><article key={row.id}><span className="record-icon"><ShieldCheck/></span><div><strong>{row.summary}</strong><small>{row.actorId?[row.actorId.firstName,row.actorId.lastName].join(' '):'System'} · {shortDate(row.createdAt)} · {row.ip||'Private network'}</small></div><Badge>{titleCase(row.action)}</Badge><span><Activity/>{titleCase(row.entityType)}</span></article>)}</div><Pagination page={query.data.meta.page} pages={query.data.meta.pages} onChange={setPage}/></>}</div>}
