import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { formatCurrency } from '@/lib/format';
import { Transaction, Category, Currency } from '@/types/finance';

interface CategoryPieChartProps {
  transactions: Transaction[];
  categories: Category[];
  type: 'income' | 'expense';
  currency: Currency;
  title: string;
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

export function CategoryPieChart({ transactions, categories, type, currency, title }: CategoryPieChartProps) {
  const data = useMemo(() => {
    const filtered = transactions.filter(t => t.transaction_type === type && t.currency === currency);
    
    const grouped = filtered.reduce((acc, t) => {
      const categoryId = t.category_id || 'sin-categoria';
      if (!acc[categoryId]) {
        acc[categoryId] = 0;
      }
      acc[categoryId] += Math.abs(t.amount);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([categoryId, amount], index) => {
        const category = categories.find(c => c.id === categoryId);
        return {
          name: category?.name || 'Sin categoría',
          value: amount,
          color: category?.color || COLORS[index % COLORS.length],
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [transactions, categories, type, currency]);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const chartConfig = data.reduce((acc, item, index) => {
    acc[item.name] = {
      label: item.name,
      color: item.color || COLORS[index % COLORS.length],
    };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            No hay datos para mostrar
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-2xl font-bold">{formatCurrency(total, currency)}</p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px]">
          <PieChart>
            <ChartTooltip 
              content={
                <ChartTooltipContent 
                  formatter={(value) => formatCurrency(Number(value), currency)}
                />
              } 
            />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        
        <div className="mt-4 space-y-2">
          {data.slice(0, 5).map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground truncate max-w-[120px]">{item.name}</span>
              </div>
              <span className="font-medium">{formatCurrency(item.value, currency)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
