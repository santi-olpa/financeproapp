import { Card, CardContent } from '@/components/ui/card';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Currency } from '@/types/finance';

type KPIState = 'good' | 'warning' | 'bad' | 'neutral';

type TrendInfo = {
  value: number; // porcentaje de cambio
  label: string; // ej: "vs. mes anterior"
};

type KPICardProps = {
  title: string;
  tooltipText: string; // OBLIGATORIO — regla del tooltip
  value: number | null;
  currency?: Currency;
  format?: 'currency' | 'percent' | 'months' | 'number';
  state?: KPIState;
  trend?: TrendInfo | null;
  compact?: boolean;
  className?: string;
  onClick?: () => void;
};

const STATE_STYLES: Record<KPIState, string> = {
  good: 'text-income',
  warning: 'text-amber-500',
  bad: 'text-expense',
  neutral: 'text-foreground',
};

const STATE_BG: Record<KPIState, string> = {
  good: 'bg-income/5 border-income/20',
  warning: 'bg-amber-500/5 border-amber-500/20',
  bad: 'bg-expense/5 border-expense/20',
  neutral: 'border-border/50',
};

function formatValue(value: number | null, fmt: string, currency?: Currency): string {
  if (value === null) return '—';
  switch (fmt) {
    case 'percent':
      return `${Math.round(value * 100)}%`;
    case 'months':
      return value >= 10 ? `${Math.round(value)}` : value.toFixed(1);
    case 'number':
      return value.toLocaleString('es-AR');
    default:
      return ''; // currency handled separately
  }
}

export function KPICard({
  title,
  tooltipText,
  value,
  currency,
  format = 'currency',
  state = 'neutral',
  trend,
  compact = false,
  className,
  onClick,
}: KPICardProps) {
  const isCurrency = format === 'currency' && currency;
  const displayValue = !isCurrency ? formatValue(value, format, currency) : null;
  const isMonths = format === 'months';

  return (
    <Card
      className={cn(
        'border transition-colors',
        STATE_BG[state],
        onClick && 'cursor-pointer hover:border-primary/50',
        className,
      )}
      onClick={onClick}
    >
      <CardContent className={compact ? 'p-3' : 'p-4 md:p-5'}>
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
            {title}
          </span>
          <HelpTooltip text={tooltipText} iconClassName="h-3.5 w-3.5" />
        </div>

        {/* Value */}
        <div className={cn('font-bold tabular-nums', STATE_STYLES[state])}>
          {value === null ? (
            <span className="text-xl text-muted-foreground">—</span>
          ) : isCurrency ? (
            <CurrencyDisplay
              amount={value}
              currency={currency!}
              size={compact ? 'lg' : 'xl'}
              enablePrivacy
            />
          ) : (
            <span className={compact ? 'text-xl' : 'text-2xl md:text-3xl'}>
              {displayValue}
              {isMonths && <span className="text-sm font-normal text-muted-foreground ml-1">meses</span>}
            </span>
          )}
        </div>

        {/* Trend */}
        {trend && (
          <div className="flex items-center gap-1 mt-1.5">
            {trend.value > 0 ? (
              <TrendingUp className="h-3 w-3 text-income" />
            ) : trend.value < 0 ? (
              <TrendingDown className="h-3 w-3 text-expense" />
            ) : (
              <Minus className="h-3 w-3 text-muted-foreground" />
            )}
            <span className="text-xs text-muted-foreground">
              {trend.value > 0 ? '+' : ''}
              {trend.value}% {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
