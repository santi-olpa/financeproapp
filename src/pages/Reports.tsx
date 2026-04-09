import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { KPICard } from '@/components/kpi/KPICard';
import { TrendIndicator } from '@/components/kpi/TrendIndicator';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PeriodSelector } from '@/components/reports/PeriodSelector';
import { CategoryPieChart } from '@/components/reports/CategoryPieChart';
import { getCurrentPeriod, getMonthName, formatCurrency } from '@/lib/format';
import { BarChart3, PieChart, TrendingUp, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Transaction, Category, RecurringExpense, Currency, Account } from '@/types/finance';

export default function Reports() {
  const { user } = useAuth();
  const currentPeriod = getCurrentPeriod();
  const [month, setMonth] = useState(currentPeriod.month);
  const [year, setYear] = useState(currentPeriod.year);
  const [currency, setCurrency] = useState<Currency>('ARS');

  // All transactions for the year
  const { data: yearTransactions = [], isLoading: l1 } = useQuery({
    queryKey: ['transactions', 'year', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, category:categories(name, icon, color, is_essential)')
        .gte('transaction_date', `${year}-01-01`)
        .lte('transaction_date', `${year}-12-31`)
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return data as (Transaction & { category: { name: string; icon: string; color: string; is_essential: boolean } | null })[];
    },
    enabled: !!user,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('display_order');
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!user,
  });

  const { data: recurringExpenses = [] } = useQuery({
    queryKey: ['recurring-expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*, category:categories(name)')
        .eq('is_active', true)
        .order('amount', { ascending: false });
      if (error) throw error;
      return data as (RecurringExpense & { category: { name: string } | null })[];
    },
    enabled: !!user,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('accounts').select('*').eq('is_active', true);
      if (error) throw error;
      return data as Account[];
    },
    enabled: !!user,
  });

  // === DERIVED DATA ===

  const txByMonth = (m: number, y: number) =>
    yearTransactions.filter(t => {
      const d = new Date(t.transaction_date);
      return d.getMonth() + 1 === m && d.getFullYear() === y && t.currency === currency;
    });

  const monthTx = useMemo(() => txByMonth(month, year), [yearTransactions, month, year, currency]);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonthTx = useMemo(() => txByMonth(prevMonth, prevYear), [yearTransactions, prevMonth, prevYear, currency]);

  const calc = (txs: typeof monthTx) => {
    const income = txs.filter(t => t.transaction_type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
    const expense = txs.filter(t => t.transaction_type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    const essential = txs.filter(t => t.transaction_type === 'expense' && t.category?.is_essential).reduce((s, t) => s + Math.abs(t.amount), 0);
    const discretionary = expense - essential;
    return { income, expense, essential, discretionary, net: income - expense };
  };

  const current = useMemo(() => calc(monthTx), [monthTx]);
  const prev = useMemo(() => calc(prevMonthTx), [prevMonthTx]);

  const savingsRate = current.income > 0 ? current.net / current.income : null;
  const fixedCosts = recurringExpenses.filter(e => e.currency === currency).reduce((s, e) => s + Number(e.amount), 0);

  // Expense by category
  const expenseByCat = useMemo(() => {
    const grouped: Record<string, { name: string; total: number; color: string; isEssential: boolean }> = {};
    monthTx.filter(t => t.transaction_type === 'expense').forEach(t => {
      const catId = t.category_id || 'none';
      const catName = t.category?.name || 'Sin categoría';
      const catColor = t.category?.color || '#6b7280';
      const isEssential = t.category?.is_essential || false;
      if (!grouped[catId]) grouped[catId] = { name: catName, total: 0, color: catColor, isEssential };
      grouped[catId].total += Math.abs(t.amount);
    });
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [monthTx]);

  const essentialCats = expenseByCat.filter(c => c.isEssential);
  const discretionaryCats = expenseByCat.filter(c => !c.isEssential);

  // Patrimony by month (last 12)
  const patrimonyHistory = useMemo(() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      let m = currentPeriod.month - i;
      let y = currentPeriod.year;
      while (m <= 0) { m += 12; y -= 1; }

      const filtered = yearTransactions.filter(t => {
        const d = new Date(t.transaction_date);
        return d.getMonth() + 1 <= m && d.getFullYear() <= y && t.currency === currency;
      });
      const income = filtered.filter(t => t.transaction_type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
      const expense = filtered.filter(t => t.transaction_type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
      months.push({ month: m, year: y, net: income - expense });
    }
    return months;
  }, [yearTransactions, currentPeriod, currency]);

  // Savings trend (6 months)
  const savingsTrend = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      let m = month - i;
      let y = year;
      while (m <= 0) { m += 12; y -= 1; }
      const data = calc(txByMonth(m, y));
      months.push({ month: m, year: y, ...data });
    }
    return months;
  }, [yearTransactions, month, year, currency]);

  const totalPatrimonioARS = accounts.filter(a => a.currency === 'ARS').reduce((s, a) => s + Number(a.current_balance), 0);
  const totalPatrimonioUSD = accounts.filter(a => a.currency === 'USD').reduce((s, a) => s + Number(a.current_balance), 0);

  if (l1) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Reportes" subtitle="Análisis de tus finanzas" />
        <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Reportes"
        subtitle={`${getMonthName(month)} ${year}`}
        action={
          <div className="flex items-center gap-2">
            <PeriodSelector month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
            <div className="flex border border-border rounded-full overflow-hidden">
              {(['ARS', 'USD'] as Currency[]).map(c => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${currency === c ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="monthly">
            <TabsList className="w-full sm:w-auto mb-6">
              <TabsTrigger value="monthly" className="flex-1 sm:flex-none">Mensual</TabsTrigger>
              <TabsTrigger value="categories" className="flex-1 sm:flex-none">Categorías</TabsTrigger>
              <TabsTrigger value="patrimony" className="flex-1 sm:flex-none">Patrimonio</TabsTrigger>
              <TabsTrigger value="insights" className="flex-1 sm:flex-none">Insights</TabsTrigger>
            </TabsList>

            {/* === MENSUAL === */}
            <TabsContent value="monthly" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase">Ingresos</span>
                      <HelpTooltip text="Total de ingresos reales (de caja) del mes seleccionado." />
                    </div>
                    <CurrencyDisplay amount={current.income} currency={currency} size="xl" className="text-income font-bold" enablePrivacy />
                    <div className="mt-2">
                      <TrendIndicator current={current.income} previous={prev.income} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase">Egresos</span>
                      <HelpTooltip text="Total de egresos reales (de caja) del mes. No incluye cuotas futuras, solo lo que ya salió." />
                    </div>
                    <CurrencyDisplay amount={current.expense} currency={currency} size="xl" className="text-expense font-bold" enablePrivacy />
                    <div className="mt-2">
                      <TrendIndicator current={current.expense} previous={prev.expense} invertColor />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase">Ahorro Neto</span>
                      <HelpTooltip text="Ingresos menos egresos. Positivo = ahorraste. Negativo = gastaste más de lo que ganaste." />
                    </div>
                    <CurrencyDisplay amount={current.net} currency={currency} size="xl" className={`font-bold ${current.net >= 0 ? 'text-income' : 'text-expense'}`} enablePrivacy />
                    <div className="mt-2">
                      <TrendIndicator current={current.net} previous={prev.net} />
                    </div>
                  </CardContent>
                </Card>

                <KPICard
                  title="Tasa de Ahorro"
                  tooltipText="Qué porcentaje de tu plata del mes terminás guardando. Por encima de 20% está muy bien."
                  value={savingsRate}
                  format="percent"
                  state={savingsRate === null ? 'neutral' : savingsRate >= 0.2 ? 'good' : savingsRate >= 0.1 ? 'warning' : 'bad'}
                  compact
                />

                <KPICard
                  title="Costo de Vida Fijo"
                  tooltipText="Lo mínimo que necesitás por mes: recurrentes activos. No incluye gastos variables."
                  value={fixedCosts}
                  currency={currency}
                  state={current.income > fixedCosts ? 'good' : 'bad'}
                  compact
                />

                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase">Esenciales vs Discrecional</span>
                      <HelpTooltip text="Cuánto se fue a gastos esenciales (alquiler, servicios, supermercado) vs discrecionales (salidas, compras, etc)." />
                    </div>
                    <div className="flex gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Esencial:</span>
                        <span className="ml-1 font-semibold"><CurrencyDisplay amount={current.essential} currency={currency} size="sm" className="inline" /></span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Discrecional:</span>
                        <span className="ml-1 font-semibold"><CurrencyDisplay amount={current.discretionary} currency={currency} size="sm" className="inline" /></span>
                      </div>
                    </div>
                    {current.expense > 0 && (
                      <Progress value={(current.essential / current.expense) * 100} className="h-2 mt-3" />
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {current.expense > 0 ? `${Math.round((current.essential / current.expense) * 100)}% esencial` : '—'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Tendencia 6 meses */}
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm">Tendencia de Ahorro (6 meses)</h3>
                    <HelpTooltip text="Evolución del ahorro neto (ingresos - egresos) de los últimos 6 meses." />
                  </div>
                  <div className="flex items-end gap-2 h-32">
                    {savingsTrend.map((m, i) => {
                      const maxVal = Math.max(...savingsTrend.map(s => Math.abs(s.net)), 1);
                      const height = Math.max(5, (Math.abs(m.net) / maxVal) * 100);
                      const isLast = i === savingsTrend.length - 1;
                      return (
                        <div key={`${m.year}-${m.month}`} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className={`w-full rounded-t transition-all ${m.net >= 0 ? (isLast ? 'bg-primary' : 'bg-primary/30') : 'bg-expense/40'}`}
                            style={{ height: `${height}%` }}
                          />
                          <span className="text-xs text-muted-foreground">{getMonthName(m.month).slice(0, 3)}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* === CATEGORÍAS === */}
            <TabsContent value="categories" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <CategoryPieChart
                  transactions={monthTx as any}
                  categories={categories}
                  type="expense"
                  currency={currency}
                  title="Gastos por Categoría"
                />
                <CategoryPieChart
                  transactions={monthTx as any}
                  categories={categories}
                  type="income"
                  currency={currency}
                  title="Ingresos por Categoría"
                />
              </div>

              {/* Esenciales */}
              {essentialCats.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Gastos Esenciales</h3>
                  <div className="space-y-2">
                    {essentialCats.map(cat => (
                      <Card key={cat.name} className="border-border/50">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                            <span className="text-sm">{cat.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">
                              {current.expense > 0 ? `${Math.round((cat.total / current.expense) * 100)}%` : '—'}
                            </span>
                            <CurrencyDisplay amount={cat.total} currency={currency} size="sm" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Discrecionales */}
              {discretionaryCats.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Gastos Discrecionales</h3>
                  <div className="space-y-2">
                    {discretionaryCats.map(cat => (
                      <Card key={cat.name} className="border-border/50">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                            <span className="text-sm">{cat.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">
                              {current.expense > 0 ? `${Math.round((cat.total / current.expense) * 100)}%` : '—'}
                            </span>
                            <CurrencyDisplay amount={cat.total} currency={currency} size="sm" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* === PATRIMONIO === */}
            <TabsContent value="patrimony" className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <KPICard
                  title="Patrimonio ARS"
                  tooltipText="Suma de saldos de todas tus cuentas en pesos."
                  value={totalPatrimonioARS}
                  currency="ARS"
                  state="neutral"
                />
                <KPICard
                  title="Patrimonio USD"
                  tooltipText="Suma de saldos de todas tus cuentas en dólares."
                  value={totalPatrimonioUSD}
                  currency="USD"
                  state="neutral"
                />
              </div>

              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm">Evolución del Ahorro Neto (12 meses)</h3>
                    <HelpTooltip text="Cómo evolucionó tu ahorro neto (ingresos - egresos) mes a mes durante el último año." />
                  </div>
                  <div className="flex items-end gap-1 h-40">
                    {patrimonyHistory.map((m, i) => {
                      const maxVal = Math.max(...patrimonyHistory.map(p => Math.abs(p.net)), 1);
                      const height = Math.max(3, (Math.abs(m.net) / maxVal) * 100);
                      return (
                        <div key={`${m.year}-${m.month}`} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className={`w-full rounded-t ${m.net >= 0 ? 'bg-income/40' : 'bg-expense/40'}`}
                            style={{ height: `${height}%` }}
                          />
                          <span className="text-[10px] text-muted-foreground">
                            {getMonthName(m.month).slice(0, 1)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Balance de situación */}
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-4">Balance de Situación</h3>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Patrimonio en ARS</span>
                      <CurrencyDisplay amount={totalPatrimonioARS} currency="ARS" size="xl" className="block font-extrabold" enablePrivacy />
                    </div>
                    <div className="hidden sm:block w-px h-12 bg-border" />
                    <div>
                      <span className="text-xs text-muted-foreground">Patrimonio en USD</span>
                      <CurrencyDisplay amount={totalPatrimonioUSD} currency="USD" size="xl" className="block font-extrabold text-income" enablePrivacy />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* === INSIGHTS === */}
            <TabsContent value="insights" className="space-y-6">
              <EmptyState
                icon={Lightbulb}
                title="Insights — Próximamente"
                description="Acá vas a ver patrones de gasto, top categorías, comparativas año a año y sugerencias personalizadas basadas en tus datos."
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
