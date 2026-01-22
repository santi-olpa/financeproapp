import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { formatCurrency, formatCompactCurrency } from '@/lib/format';
import { RecurringExpense, Currency, FREQUENCY_LABELS } from '@/types/finance';
import { Badge } from '@/components/ui/badge';
import { CalendarClock } from 'lucide-react';

interface RecurringCostsChartProps {
  recurringExpenses: RecurringExpense[];
  currency: Currency;
}

const COLORS = [
  'hsl(250, 95%, 65%)',
  'hsl(170, 80%, 45%)',
  'hsl(38, 95%, 55%)',
  'hsl(0, 75%, 55%)',
  'hsl(210, 90%, 55%)',
  'hsl(145, 70%, 45%)',
  'hsl(280, 70%, 60%)',
  'hsl(25, 85%, 55%)',
];

function getMonthlyAmount(expense: RecurringExpense): number {
  const amount = expense.amount;
  switch (expense.frequency) {
    case 'weekly':
      return amount * 4.33;
    case 'biweekly':
      return amount * 2.17;
    case 'monthly':
      return amount;
    case 'quarterly':
      return amount / 3;
    case 'yearly':
      return amount / 12;
    default:
      return amount;
  }
}

export function RecurringCostsChart({ recurringExpenses, currency }: RecurringCostsChartProps) {
  const { data, totalMonthly, categoryBreakdown } = useMemo(() => {
    const active = recurringExpenses.filter(e => e.is_active && e.currency === currency);
    
    const items = active.map((expense, index) => ({
      name: expense.name,
      amount: expense.amount,
      monthlyAmount: getMonthlyAmount(expense),
      frequency: expense.frequency,
      color: expense.category?.color || COLORS[index % COLORS.length],
      categoryName: expense.category?.name || 'Sin categoría',
    }));

    const sortedItems = items.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
    
    const totalMonthly = sortedItems.reduce((sum, item) => sum + item.monthlyAmount, 0);

    const categoryMap = sortedItems.reduce((acc, item) => {
      if (!acc[item.categoryName]) {
        acc[item.categoryName] = { amount: 0, color: item.color };
      }
      acc[item.categoryName].amount += item.monthlyAmount;
      return acc;
    }, {} as Record<string, { amount: number; color: string }>);

    const categoryBreakdown = Object.entries(categoryMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount);

    return { data: sortedItems.slice(0, 10), totalMonthly, categoryBreakdown };
  }, [recurringExpenses, currency]);

  const chartConfig = data.reduce((acc, item) => {
    acc[item.name] = {
      label: item.name,
      color: item.color,
    };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Costo de Vida Fijo</CardTitle>
          </div>
          <CardDescription>Gastos recurrentes mensualizados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            No hay gastos recurrentes activos
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Costo de Vida Fijo</CardTitle>
          </div>
          <Badge variant="secondary" className="text-lg font-bold px-3">
            {formatCurrency(totalMonthly, currency)}/mes
          </Badge>
        </div>
        <CardDescription>Gastos recurrentes mensualizados</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px]">
          <BarChart 
            data={data} 
            layout="vertical"
            margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
            <XAxis 
              type="number"
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => formatCompactCurrency(value, currency)}
              className="text-xs"
            />
            <YAxis 
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              width={100}
              className="text-xs"
              tick={{ fontSize: 11 }}
            />
            <ChartTooltip 
              content={
                <ChartTooltipContent 
                  formatter={(value, name, item) => (
                    <div className="space-y-1">
                      <div>{formatCurrency(Number(value), currency)}/mes</div>
                      <div className="text-muted-foreground text-xs">
                        {FREQUENCY_LABELS[item.payload.frequency as keyof typeof FREQUENCY_LABELS]}: {formatCurrency(item.payload.amount, currency)}
                      </div>
                    </div>
                  )}
                />
              } 
            />
            <Bar dataKey="monthlyAmount" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>

        <div className="mt-6 pt-4 border-t border-border">
          <h4 className="text-sm font-medium mb-3">Por Categoría</h4>
          <div className="space-y-2">
            {categoryBreakdown.slice(0, 5).map((cat, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-muted-foreground">{cat.name}</span>
                </div>
                <span className="font-medium">{formatCurrency(cat.amount, currency)}/mes</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
