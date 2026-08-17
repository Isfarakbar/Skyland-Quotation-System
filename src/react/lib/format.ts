export const money = (value: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Number(value || 0));
export const shortDate = (value?: string) => value ? new Intl.DateTimeFormat('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';
export const fullName = (user?: { firstName?: string; lastName?: string }) => [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Team member';
export const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
