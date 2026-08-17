import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Banknote, BellRing, Boxes, Building2, CalendarClock, CheckCircle2, FilePlus2, FileText, Plus, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, pageResult } from '../lib/api';
import type { Customer, PageResult, Product, Quotation, User } from '../types';
import { money, shortDate, titleCase } from '../lib/format';
import { Badge, Button, Card, ErrorState, LoadingState, PageHeader } from '../components/ui';

async function loadDashboard() {
  const [productsRaw, customersRaw, quotationsRaw, usersRaw] = await Promise.all([
    api<PageResult<Product> | Product[]>('/products?page=1&limit=1'), api<PageResult<Customer> | Customer[]>('/customers?page=1&limit=1'),
    api<PageResult<Quotation> | Quotation[]>('/quotations?page=1&limit=6'), api<PageResult<User> | User[]>('/users?page=1&limit=1&status=pending').catch(() => ({ items: [], meta: { page: 1, limit: 1, total: 0, pages: 1 } })),
  ]);
  return { products: pageResult(productsRaw), customers: pageResult(customersRaw), quotations: pageResult(quotationsRaw), users: pageResult(usersRaw) };
}

const statusTone = (status: string) => status === 'accepted' || status === 'approved' ? 'success' : status === 'rejected' || status === 'cancelled' ? 'danger' : status === 'pending_approval' || status === 'expired' ? 'warning' : 'info';

export default function Dashboard() {
  const query = useQuery({ queryKey: ['dashboard'], queryFn: loadDashboard });
  if (query.isLoading) return <LoadingState label="Preparing your dashboard"/>;
  if (query.error || !query.data) return <ErrorState error={query.error} retry={() => query.refetch()}/>;
  const { products, customers, quotations, users } = query.data;
  const pipeline = quotations.items.filter(row => !['rejected','cancelled'].includes(row.status)).reduce((sum, row) => sum + row.grandTotal, 0);
  const overdue = quotations.items.filter(row => row.followUpAt && new Date(row.followUpAt) < new Date() && !['accepted','rejected','cancelled'].includes(row.status));
  const stats = [
    { label: 'Products available', value: products.meta.total, icon: Boxes, tone: 'blue' },
    { label: 'Customers', value: customers.meta.total, icon: Building2, tone: 'violet' },
    { label: 'Active pipeline', value: money(pipeline), icon: Banknote, tone: 'orange' },
    { label: 'Pending approvals', value: users.meta.total + quotations.items.filter(row => row.status === 'pending_approval').length, icon: BellRing, tone: 'green' },
  ];
  return <div className="page"><PageHeader title="Dashboard" description="A clear view of your sales pipeline and next actions." actions={<Link to="/quotation-builder"><Button><Plus/>New quotation</Button></Link>}/>
    <div className="metric-grid">{stats.map(({ label, value, icon: Icon, tone }) => <Card key={label} className="metric-card"><span className={`metric-icon metric-icon--${tone}`}><Icon/></span><div><strong>{value}</strong><span>{label}</span></div></Card>)}</div>
    <div className="dashboard-grid"><Card className="panel panel--wide"><div className="panel-heading"><div><span className="eyebrow">Sales activity</span><h2>Recent quotations</h2></div><Link to="/quotations">View all <ArrowRight/></Link></div>{quotations.items.length ? <div className="records">{quotations.items.map(quote => <Link className="record-row" key={quote.id || quote._id} to={`/quotation-builder/${quote.id || quote._id}`}><div className="record-icon"><FileText/></div><div className="record-main"><strong>{quote.quotationNumber}</strong><span>{quote.systemSize} kW · Updated {shortDate(quote.updatedAt || quote.createdAt)}</span></div><Badge tone={statusTone(quote.status)}>{titleCase(quote.status)}</Badge><strong className="record-amount">{money(quote.grandTotal)}</strong><ArrowRight className="record-arrow"/></Link>)}</div> : <div className="compact-empty">No quotations yet. Create your first proposal.</div>}</Card>
      <div className="dashboard-side"><Card className="panel"><div className="panel-heading"><div><span className="eyebrow">Priority</span><h2>Follow-ups</h2></div><CalendarClock/></div>{overdue.length ? overdue.slice(0,4).map(row => <Link className="mini-row" key={row.id || row._id} to={`/quotation-builder/${row.id || row._id}`}><span><strong>{row.quotationNumber}</strong><small>Due {shortDate(row.followUpAt)}</small></span><ArrowRight/></Link>) : <div className="success-empty"><CheckCircle2/><span><strong>You are caught up</strong><small>No overdue follow-ups.</small></span></div>}</Card>
        <Card className="panel"><div className="panel-heading"><div><span className="eyebrow">Shortcuts</span><h2>Quick actions</h2></div></div><div className="quick-grid"><Link to="/quotation-builder"><FilePlus2/>New quote</Link><Link to="/customers"><UsersRound/>Customers</Link><Link to="/products"><Boxes/>Catalog</Link><Link to="/rates"><Banknote/>Rates</Link></div></Card></div>
    </div></div>;
}
