import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { formatCompactCurrency, getMonthName } from '@/lib/format';
import { Transaction, Currency } from '@/types/finance';

interface MonthlyTrendChartProps {
  transactions: Transaction[];
  currency: Currency;
  year: number;
}

export function MonthlyTrendChart({ transactions, currency, year }: MonthlyTrendChartProps) {
  const data = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      name: getMonthName(i + 1).slice(0, 3),
      ingresos: 0,
      gastos: 0,
    }));

    transactions
      .filter(t => t.currency === currency)
      .forEach(t => {
        const date = new Date(t.transaction_date);
        if (date.getFullYear() === year) {
          const monthIndex = date.getMonth();
          if (t.transaction_type === 'income') {
            months[monthIndex].ingresos += Math.abs(t.amount);
          } else if (t.transaction_type === 'expense') {
            months[monthIndex].gastos += Math.abs(t.amount);
          }
        }
      });

    return months;
  }, [transactions, currency, year]);

  const chartConfig = {
    ingresos: {
      label: 'Ingresos',
      color: 'hsl(145, 70%, 45%)',
    },
    gastos: {
      label: 'Gastos',
      color: 'hsl(0, 75%, 55%)',
    },
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Evolución Mensual {year}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(145, 70%, 45%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(145, 70%, 45%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0, 75%, 55%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(0, 75%, 55%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              className="text-xs"
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => formatCompactCurrency(value, currency)}
              className="text-xs"
              width={60}
            />
            <ChartTooltip 
              content={
                <ChartTooltipContent 
                  formatter={(value, name) => (
                    <span>
                      {name === 'ingresos' ? 'Ingresos' : 'Gastos'}: {formatCompactCurrency(Number(value), currency)}
                    </span>
                  )}
                />
              } 
            />
            <Area
              type="monotone"
              dataKey="ingresos"
              stroke="hsl(145, 70%, 45%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorIngresos)"
            />
            <Area
              type="monotone"
              dataKey="gastos"
              stroke="hsl(0, 75%, 55%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorGastos)"
            />
          </AreaChart>
        </ChartContainer>
        
        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span className="text-sm text-muted-foreground">Ingresos</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span className="text-sm text-muted-foreground">Gastos</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
