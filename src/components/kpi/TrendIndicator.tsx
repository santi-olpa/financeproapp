import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

type TrendIndicatorProps = {
  current: number;
  previous: number;
  label?: string;
  /** Si true, un incremento es malo (ej: gastos subieron) */
  invertColor?: boolean;
};

export function TrendIndicator({ current, previous, label = 'vs. mes anterior', invertColor = false }: TrendIndicatorProps) {
  // Sin datos previos
  if (previous === 0 && current === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  // Primer mes con datos
  if (previous === 0) {
    return <span className="text-xs text-muted-foreground">nuevo</span>;
  }

  const pct = Math.round(((current - previous) / previous) * 100);
  const isUp = pct > 0;
  const isDown = pct < 0;
  const isFlat = pct === 0;

  const positiveIsGood = !invertColor;
  const colorClass = isFlat
    ? 'text-muted-foreground'
    : (isUp && positiveIsGood) || (isDown && !positiveIsGood)
      ? 'text-income'
      : 'text-expense';

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', colorClass)}>
      {isUp && <TrendingUp className="h-3 w-3" />}
      {isDown && <TrendingDown className="h-3 w-3" />}
      {isFlat && <Minus className="h-3 w-3" />}
      {isUp ? '+' : ''}{pct}% {label}
    </span>
  );
}
