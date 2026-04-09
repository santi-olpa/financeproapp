import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, CreditCard } from 'lucide-react';
import { getMonthName } from '@/lib/format';
import type { Currency } from '@/types/finance';

type CardStatementCardProps = {
  totalAmount: number;
  currency: Currency;
  closingDate: string;
  dueDate: string;
  periodMonth: number;
  periodYear: number;
  isPaid: boolean;
  isEstimated: boolean;
  daysUntilDue: number;
  onPayClick: () => void;
};

export function CardStatementCard({
  totalAmount,
  currency,
  closingDate,
  dueDate,
  periodMonth,
  periodYear,
  isPaid,
  isEstimated,
  daysUntilDue,
  onPayClick,
}: CardStatementCardProps) {
  return (
    <Card className="border-border/50 bg-gradient-to-br from-card to-primary/5">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">
              Resumen de {getMonthName(periodMonth)} {periodYear}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {isEstimated && (
              <>
                <Badge variant="outline" className="text-xs">
                  Estimado
                </Badge>
                <HelpTooltip text="Este monto es estimado porque el resumen todavía no cerró. Se actualiza automáticamente cuando cargás compras nuevas." />
              </>
            )}
            {isPaid && (
              <Badge className="bg-income/10 text-income border-income/20">Pagado</Badge>
            )}
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-1">Total a pagar</p>
          <CurrencyDisplay
            amount={totalAmount}
            currency={currency}
            size="xl"
            className="font-extrabold"
            enablePrivacy
          />
        </div>

        <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            <span>Cierre: {closingDate}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            <span>Vto: {dueDate}</span>
          </div>
          {!isPaid && daysUntilDue > 0 && (
            <span className="text-xs">
              {daysUntilDue} {daysUntilDue === 1 ? 'día' : 'días'} para el vencimiento
            </span>
          )}
        </div>

        {!isPaid && totalAmount > 0 && (
          <Button onClick={onPayClick} className="w-full">
            Pagar resumen
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
