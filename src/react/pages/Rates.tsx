import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, History, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api, jsonBody } from '../lib/api';
import type { Product } from '../types';
import { money, shortDate, titleCase } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader } from '../components/ui';

const idOf = (row: Product) => row.id || row._id || '';
export default function Rates() {
  const { hasPermission } = useAuth(); const { notify } = useToast(); const client = useQueryClient();
  const query = useQuery({ queryKey: ['products','rates'], queryFn: () => api<Product[]>('/products') });
  const [changes, setChanges] = useState<Record<string,{ unitPrice: number; pricePerWatt: number }>>({});
  const dirty = Object.keys(changes).length > 0;
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  const save = useMutation({ mutationFn: () => api('/products/bulk-rates', { method: 'POST', ...jsonBody({ changes: Object.entries(changes).map(([id, value]) => ({ id, ...value })) }) }), onSuccess: () => { setChanges({}); client.invalidateQueries({ queryKey: ['products'] }); notify('Catalog rates updated', 'success'); }, onError: error => notify(error.message, 'error') });
  const rollback = useMutation({ mutationFn: (id: string) => api(`/products/${id}/rate/rollback`, { method: 'POST', ...jsonBody({}) }), onSuccess: () => { client.invalidateQueries({ queryKey: ['products'] }); notify('Previous catalog rate restored', 'success'); }, onError: error => notify(error.message, 'error') });
  const grouped = useMemo(() => (query.data || []).reduce<Record<string, Product[]>>((result, row) => {
    (result[row.category] ||= []).push(row);
    return result;
  }, {}), [query.data]);
  if (query.isLoading) return <LoadingState label="Loading price list"/>;
  if (query.error) return <ErrorState error={query.error} retry={() => query.refetch()}/>;
  return <div className="page"><PageHeader title="Catalog Price List" description="Maintain reusable quotation rates with price history and effective dates." actions={hasPermission('rates_manage') ? <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}><Save/>{save.isPending ? 'Saving…' : `Save ${Object.keys(changes).length || ''} changes`}</Button> : undefined}/>{dirty && <div className="unsaved-banner"><AlertCircle/><span><strong>Unsaved rate changes</strong><small>Review and save before leaving this page.</small></span></div>}
    {!query.data?.length ? <EmptyState title="No catalog rates" message="Add products to maintain their reusable rates."/> : Object.entries(grouped).map(([category, rows]) => <Card className="rate-section" key={category}><div className="panel-heading"><div><span className="eyebrow">Catalog group</span><h2>{titleCase(category)}</h2></div><Badge>{rows?.length || 0} items</Badge></div><div className="rate-table"><div className="rate-head"><span>Product</span><span>Unit price</span><span>Price/watt</span><span>Effective</span><span>History</span></div>{(rows || []).map(row => { const id = idOf(row); const value = changes[id] || { unitPrice: row.unitPrice, pricePerWatt: row.pricePerWatt || 0 }; const changed = Boolean(changes[id]); return <div className={`rate-row ${changed ? 'dirty' : ''}`} key={id}><div><strong>{row.name}</strong><small>{[row.brand,row.model].filter(Boolean).join(' · ') || row.unit}</small></div><label><span className="mobile-label">Unit price</span><input className="input" type="number" disabled={!hasPermission('rates_manage')} min="0" value={value.unitPrice} onChange={event => setChanges(current => ({ ...current, [id]: { ...value, unitPrice: Number(event.target.value) } }))}/></label><label><span className="mobile-label">Price/watt</span><input className="input" type="number" disabled={!hasPermission('rates_manage')} min="0" step="0.01" value={value.pricePerWatt} onChange={event => setChanges(current => ({ ...current, [id]: { ...value, pricePerWatt: Number(event.target.value) } }))}/></label><span><small>{shortDate(row.effectiveFrom)}</small>{changed && <Badge tone="warning">Changed</Badge>}</span><button className="history-button" title={`Current ${money(row.unitPrice)}`} disabled><History/><span>Price history</span></button></div>; })}</div></Card>)}{!dirty && <div className="saved-note"><CheckCircle2/>All catalog rates are saved.</div>}</div>;
}
