import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { AlertCircle, Inbox, LoaderCircle, RotateCcw } from 'lucide-react';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <header className="page-header"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</header>;
}

export function Button({ tone = 'primary', size = 'md', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'secondary' | 'danger' | 'ghost'; size?: 'sm' | 'md' }) {
  return <button className={`button button--${tone} button--${size} ${className}`} {...props}/>;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) { return <section className={`card ${className}`}>{children}</section>; }

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return <div className="state-panel" role="status"><LoaderCircle className="spin"/><strong>{label}</strong><span>Please wait a moment.</span></div>;
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return <div className="state-panel"><Inbox/><strong>{title}</strong><span>{message}</span>{action}</div>;
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return <div className="state-panel state-panel--error" role="alert"><AlertCircle/><strong>Unable to load this page</strong><span>{message}</span>{retry && <Button tone="secondary" onClick={retry}><RotateCcw size={16}/>Try again</Button>}</div>;
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  if (pages <= 1) return null;
  return <nav className="pagination" aria-label="Pagination"><Button tone="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button><span>Page {page} of {pages}</span><Button tone="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</Button></nav>;
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span className="field__label">{label}</span>{children}{error ? <span className="field__error">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}</label>;
}
