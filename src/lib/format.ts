import { Currency, CURRENCY_SYMBOLS } from '@/types/finance';

export function formatCurrency(amount: number, currency: Currency): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  
  const sign = amount < 0 ? '-' : '';
  return `${sign}${symbol} ${formatted}`;
}

export function formatCompactCurrency(amount: number, currency: Currency): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  
  if (Math.abs(amount) >= 1000000) {
    return `${symbol} ${(amount / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1000) {
    return `${symbol} ${(amount / 1000).toFixed(1)}K`;
  }
  
  return formatCurrency(amount, currency);
}

function toDate(date: string | Date | null | undefined): Date | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!(d instanceof Date) || isNaN(d.getTime())) return null;
  return d;
}

export function formatDate(date: string | Date | null | undefined): string {
  const d = toDate(date);
  if (!d) return '—';
  return d.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatShortDate(date: string | Date | null | undefined): string {
  const d = toDate(date);
  if (!d) return '—';
  return d.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
  });
}

export function formatRelativeDate(date: string | Date | null | undefined): string {
  const d = toDate(date);
  if (!d) return '—';
  const now = new Date();
  const diffTime = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;

  return formatShortDate(d);
}

export function getMonthName(month: number): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[month - 1] || '';
}

export function getCurrentPeriod(): { month: number; year: number } {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}
