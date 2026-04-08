import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { cn } from '@/lib/utils';
import { getMonthName } from '@/lib/format';
import type { Currency } from '@/types/finance';

type MonthData = {
  year: number;
  month: number;
  total: number;
};

type InstallmentTimelineProps = {
  monthlyTotals: MonthData[];
  currency: Currency;
};

export function InstallmentTimeline({ monthlyTotals, currency }: InstallmentTimelineProps) {
  const maxTotal = useMemo(
    () => Math.max(...monthlyTotals.map((m) => m.total), 1),
    [monthlyTotals],
  );

  if (monthlyTotals.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          No hay cuotas pendientes en los próximos meses.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-semibold text-sm">Próximos 12 meses</h3>
          <HelpTooltip text="Cuánto vas a pagar cada mes en cuotas con esta tarjeta. Te ayuda a ver en qué meses hay picos y en cuáles se afloja." />
        </div>

        <div className="space-y-2">
          {monthlyTotals.map((m) => {
            const widthPercent = maxTotal > 0 ? (m.total / maxTotal) * 100 : 0;
            const isCurrentMonth =
              m.year === new Date().getFullYear() && m.month === new Date().getMonth() + 1;

            return (
              <div key={`${m.year}-${m.month}`} className="flex items-center gap-3">
                <span
                  className={cn(
                    'text-xs w-12 shrink-0 text-right',
                    isCurrentMonth ? 'font-bold text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {getMonthName(m.month).slice(0, 3)}
                </span>
                <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                  {m.total > 0 && (
                    <div
                      className={cn(
                        'h-full rounded-md transition-all',
                        isCurrentMonth ? 'bg-primary' : 'bg-primary/40',
                      )}
                      style={{ width: `${Math.max(widthPercent, 2)}%` }}
                    />
                  )}
                </div>
                <span className="text-xs font-mono tabular-nums w-24 text-right shrink-0">
                  {m.total > 0 ? (
                    <CurrencyDisplay amount={m.total} currency={currency} size="sm" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
