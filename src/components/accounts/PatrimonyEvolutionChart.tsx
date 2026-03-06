import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatCurrency, getMonthName } from '@/lib/format';
import type { Currency } from '@/types/finance';

interface PatrimonyData {
  period_year: number;
  period_month: number;
  total_income: number;
  total_expense: number;
  net_change: number;
  cumulative_patrimony: number;
}

export function PatrimonyEvolutionChart() {
  const { user } = useAuth();
  const [currency, setCurrency] = useState<Currency>('ARS');
  const [months, setMonths] = useState(6);

  const { data, isLoading } = useQuery({
    queryKey: ['patrimony-history', currency, months],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_patrimony_history', {
        p_user_id: user!.id,
        p_currency: currency,
        p_months: months,
      });
      if (error) throw error;
      return (data as PatrimonyData[]) || [];
    },
    enabled: !!user,
  });

  const chartData = data?.map((d) => ({
    name: `${getMonthName(d.period_month).slice(0, 3)} ${d.period_year.toString().slice(2)}`,
    ingresos: Number(d.total_income),
    egresos: Number(d.total_expense),
    patrimonio: Number(d.cumulative_patrimony),
    cambioNeto: Number(d.net_change),
  })) ?? [];

  // Financial health indicator
  const lastMonth = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const prevMonth = chartData.length > 1 ? chartData[chartData.length - 2] : null;
  const trend = lastMonth && prevMonth
    ? lastMonth.patrimonio - prevMonth.patrimonio
    : null;

  const healthStatus = trend === null
    ? { label: 'Sin datos', color: 'secondary' as const, icon: Minus }
    : trend > 0
      ? { label: 'Creciendo', color: 'default' as const, icon: TrendingUp }
      : trend === 0
        ? { label: 'Estable', color: 'secondary' as const, icon: Minus }
        : { label: 'Decreciendo', color: 'destructive' as const, icon: TrendingDown };

  const HealthIcon = healthStatus.icon;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-sm">
        <p className="font-medium text-foreground mb-2">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.color }} className="flex justify-between gap-4">
            <span>{entry.name}:</span>
            <span className="font-mono">{formatCurrency(entry.value, currency)}</span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <Card className="glass border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">Evolución Patrimonial</CardTitle>
            <Badge variant={healthStatus.color} className="flex items-center gap-1">
              <HealthIcon className="h-3 w-3" />
              {healthStatus.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={months.toString()} onValueChange={(v) => setMonths(Number(v))}>
              <TabsList className="h-8">
                <TabsTrigger value="6" className="text-xs px-2 h-6">6M</TabsTrigger>
                <TabsTrigger value="12" className="text-xs px-2 h-6">12M</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
              <TabsList className="h-8">
                <TabsTrigger value="ARS" className="text-xs px-2 h-6">ARS</TabsTrigger>
                <TabsTrigger value="USD" className="text-xs px-2 h-6">USD</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            No hay datos suficientes para mostrar el historial
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                tickFormatter={(v) =>
                  Math.abs(v) >= 1000000
                    ? `${(v / 1000000).toFixed(1)}M`
                    : Math.abs(v) >= 1000
                      ? `${(v / 1000).toFixed(0)}K`
                      : v.toString()
                }
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value: string) => (
                  <span className="text-muted-foreground">{value}</span>
                )}
              />
              <Bar
                dataKey="ingresos"
                name="Ingresos"
                fill="hsl(145, 70%, 45%)"
                radius={[4, 4, 0, 0]}
                barSize={20}
              />
              <Bar
                dataKey="egresos"
                name="Egresos"
                fill="hsl(0, 75%, 55%)"
                radius={[4, 4, 0, 0]}
                barSize={20}
              />
              <Line
                type="monotone"
                dataKey="patrimonio"
                name="Patrimonio"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
