import { TrendingUp, TrendingDown, Wallet, PiggyBank } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { Currency } from '@/types/finance';

interface SummaryCardsProps {
  totalIncome: number;
  totalExpense: number;
  currency: Currency;
}

export function SummaryCards({ totalIncome, totalExpense, currency }: SummaryCardsProps) {
  const balance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : '0';

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-full bg-success/20">
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
            <span className="text-xs text-muted-foreground">Ingresos</span>
          </div>
          <p className="text-lg font-bold text-success">
            {formatCurrency(totalIncome, currency)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-full bg-destructive/20">
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
            <span className="text-xs text-muted-foreground">Gastos</span>
          </div>
          <p className="text-lg font-bold text-destructive">
            {formatCurrency(totalExpense, currency)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-full bg-primary/20">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">Balance</span>
          </div>
          <p className={`text-lg font-bold ${balance >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatCurrency(balance, currency)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-full bg-accent/20">
              <PiggyBank className="h-4 w-4 text-accent" />
            </div>
            <span className="text-xs text-muted-foreground">Ahorro</span>
          </div>
          <p className={`text-lg font-bold ${Number(savingsRate) >= 0 ? 'text-accent' : 'text-destructive'}`}>
            {savingsRate}%
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
