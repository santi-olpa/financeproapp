import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { TrendIndicator } from '@/components/kpi/TrendIndicator';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { PeriodSelector } from '@/components/reports/PeriodSelector';
import {
  TrendingDown,
  TrendingUp,
  CreditCard,
  Receipt,
  X,
  ShoppingBag,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCurrentPeriod, getMonthName, formatRelativeDate, formatDate, formatCurrency } from '@/lib/format';
import type { Transaction, Category, Currency, Installment } from '@/types/finance';
import { INSTALLMENT_STATUS_LABELS } from '@/types/finance';

type TxWithRelations = Transaction & {
  category: { name: string; icon: string; color: string; is_essential: boolean } | null;
  account: { name: string } | null;
};

type InstallmentWithPurchase = Installment & {
  purchase: {
    description: string;
    merchant: string | null;
    card_account_id: string;
    original_currency: string;
    installments_count: number;
    purchase_date: string;
    category: { name: string; icon: string; color: string; is_essential: boolean } | null;
  };
};

export default function Expenses() {
  const { user } = useAuth();
  const currentPeriod = getCurrentPeriod();
  const [month, setMonth] = useState(currentPeriod.month);
  const [year, setYear] = useState(currentPeriod.year);
  const [currency] = useState<Currency>('ARS');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0);
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay.getDate()}`;

  // Mes anterior para TrendIndicator
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevStartDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
  const prevLastDay = new Date(prevYear, prevMonth, 0);
  const prevEndDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${prevLastDay.getDate()}`;

  // === QUERIES ===

  // Gastos directos del mes (transactions expense)
  const { data: directExpenses = [], isLoading: l1 } = useQuery({
    queryKey: ['expenses', 'direct', month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, category:categories(name, icon, color, is_essential), account:accounts!transactions_account_id_fkey(name)')
        .eq('transaction_type', 'expense')
        .eq('currency', currency)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return data as TxWithRelations[];
    },
    enabled: !!user,
  });

  // Cuotas imputadas al mes (installments del billing_period)
  const { data: monthInstallments = [], isLoading: l2 } = useQuery({
    queryKey: ['expenses', 'installments', month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installments')
        .select('*, purchase:purchases(description, merchant, card_account_id, original_currency, installments_count, purchase_date, category:categories(name, icon, color, is_essential))')
        .eq('user_id', user!.id)
        .eq('billing_year', year)
        .eq('billing_month', month);
      if (error) throw error;
      return (data as InstallmentWithPurchase[]).filter(i => i.purchase?.original_currency === currency);
    },
    enabled: !!user,
  });

  // Ingresos del mes
  const { data: monthIncome = [], isLoading: l3 } = useQuery({
    queryKey: ['expenses', 'income', month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('transaction_type', 'income')
        .eq('currency', currency)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);
      if (error) throw error;
      return data as { amount: number }[];
    },
    enabled: !!user,
  });

  // Mes anterior para comparación
  const { data: prevDirectExpenses = [] } = useQuery({
    queryKey: ['expenses', 'direct', prevMonth, prevYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('transaction_type', 'expense')
        .eq('currency', currency)
        .gte('transaction_date', prevStartDate)
        .lte('transaction_date', prevEndDate);
      if (error) throw error;
      return data as { amount: number }[];
    },
    enabled: !!user,
  });

  const { data: prevInstallments = [] } = useQuery({
    queryKey: ['expenses', 'installments', prevMonth, prevYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installments')
        .select('amount_original, amount_ars, purchase:purchases(original_currency)')
        .eq('user_id', user!.id)
        .eq('billing_year', prevYear)
        .eq('billing_month', prevMonth);
      if (error) throw error;
      return (data as any[]).filter((i: any) => i.purchase?.original_currency === currency);
    },
    enabled: !!user,
  });

  const { data: prevIncome = [] } = useQuery({
    queryKey: ['expenses', 'income', prevMonth, prevYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('transaction_type', 'income')
        .eq('currency', currency)
        .gte('transaction_date', prevStartDate)
        .lte('transaction_date', prevEndDate);
      if (error) throw error;
      return data as { amount: number }[];
    },
    enabled: !!user,
  });

  // === CALCULATIONS ===

  const totalDirectExpenses = directExpenses.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const totalInstallments = monthInstallments.reduce((s, i) => s + Number(i.amount_ars ?? i.amount_original), 0);
  const totalExpenses = totalDirectExpenses + totalInstallments;
  const totalIncomeAmount = monthIncome.reduce((s, t) => s + Number(t.amount), 0);
  const net = totalIncomeAmount - totalExpenses;

  const prevTotalDirect = prevDirectExpenses.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const prevTotalInstallments = prevInstallments.reduce((s: number, i: any) => s + Number(i.amount_ars ?? i.amount_original), 0);
  const prevTotalExpenses = prevTotalDirect + prevTotalInstallments;
  const prevTotalIncome = prevIncome.reduce((s, t) => s + Number(t.amount), 0);

  // Desglose por categoría (directos + cuotas juntos)
  const categoryBreakdown = useMemo(() => {
    const grouped: Record<string, { name: string; color: string; isEssential: boolean; total: number }> = {};

    directExpenses.forEach(t => {
      const key = t.category_id || 'none';
      const name = t.category?.name || 'Sin categoría';
      const color = t.category?.color || '#6b7280';
      const isEssential = t.category?.is_essential || false;
      if (!grouped[key]) grouped[key] = { name, color, isEssential, total: 0 };
      grouped[key].total += Math.abs(Number(t.amount));
    });

    monthInstallments.forEach(i => {
      const cat = i.purchase?.category;
      const key = cat ? 'inst-' + cat.name : 'none';
      const name = cat?.name || 'Sin categoría';
      const color = cat?.color || '#6b7280';
      const isEssential = cat?.is_essential || false;
      // Merge con la misma categoría si existe
      const existingKey = Object.keys(grouped).find(k => grouped[k].name === name);
      if (existingKey) {
        grouped[existingKey].total += Number(i.amount_ars ?? i.amount_original);
      } else {
        if (!grouped[key]) grouped[key] = { name, color, isEssential, total: 0 };
        grouped[key].total += Number(i.amount_ars ?? i.amount_original);
      }
    });

    return Object.entries(grouped)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [directExpenses, monthInstallments]);

  // Filtro por categorías seleccionadas
  const toggleCategory = (name: string) => {
    const next = new Set(selectedCategories);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelectedCategories(next);
  };

  const hasCategoryFilter = selectedCategories.size > 0;

  const filteredDirect = hasCategoryFilter
    ? directExpenses.filter(t => selectedCategories.has(t.category?.name || 'Sin categoría'))
    : directExpenses;

  const filteredInstallments = hasCategoryFilter
    ? monthInstallments.filter(i => selectedCategories.has(i.purchase?.category?.name || 'Sin categoría'))
    : monthInstallments;

  // Items para la lista según tab
  const directCount = filteredDirect.length;
  const installmentCount = filteredInstallments.length;
  const allCount = directCount + installmentCount;

  const filteredDirectTotal = filteredDirect.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const filteredInstallmentTotal = filteredInstallments.reduce((s, i) => s + Number(i.amount_ars ?? i.amount_original), 0);
  const filteredAllTotal = filteredDirectTotal + filteredInstallmentTotal;

  const isLoading = l1 || l2 || l3;

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Gastos"
        subtitle={`${getMonthName(month)} ${year}`}
        action={
          <div className="flex items-center gap-2">
            <PeriodSelector month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
          </div>
        }
      />

      <div className="p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* === MÉTRICAS + GRÁFICO INGRESOS VS EGRESOS === */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Números */}
            <div className="lg:col-span-1 grid grid-cols-3 lg:grid-cols-1 gap-4">
              <Card className="border-border/50">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase">Ingresos</span>
                    <HelpTooltip text="Total de ingresos reales del mes seleccionado." iconClassName="h-3 w-3" />
                  </div>
                  <CurrencyDisplay amount={totalIncomeAmount} currency={currency} size="lg" className="text-income font-bold" enablePrivacy />
                  <div className="mt-1 hidden sm:block"><TrendIndicator current={totalIncomeAmount} previous={prevTotalIncome} /></div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase">Gastos</span>
                    <HelpTooltip text="Total devengado: directos + cuotas de tarjeta imputadas al mes." iconClassName="h-3 w-3" />
                  </div>
                  <CurrencyDisplay amount={totalExpenses} currency={currency} size="lg" className="text-expense font-bold" enablePrivacy />
                  <div className="mt-1 hidden sm:block"><TrendIndicator current={totalExpenses} previous={prevTotalExpenses} invertColor /></div>
                </CardContent>
              </Card>
              <Card className={`border ${net >= 0 ? 'border-income/30 bg-income/5' : 'border-expense/30 bg-expense/5'}`}>
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase">Neto</span>
                  </div>
                  <CurrencyDisplay amount={net} currency={currency} size="lg" className={`font-bold ${net >= 0 ? 'text-income' : 'text-expense'}`} enablePrivacy />
                </CardContent>
              </Card>
            </div>

            {/* Gráfico de barras Ingresos vs Egresos */}
            <Card className="lg:col-span-2 border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-semibold text-sm">Ingresos vs Egresos</h3>
                  <HelpTooltip text="Comparación visual entre lo que ingresó y lo que se gastó (devengado) en el mes." />
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={[
                    { name: 'Ingresos', value: totalIncomeAmount, fill: 'hsl(var(--income))' },
                    { name: 'Directos', value: totalDirectExpenses, fill: 'hsl(var(--expense))' },
                    { name: 'Cuotas', value: totalInstallments, fill: 'hsl(var(--primary))' },
                  ]} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <RechartsTooltip formatter={(value: number) => formatCurrency(value, currency)} contentStyle={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: 'hsl(var(--card-foreground))' }} labelStyle={{ color: 'hsl(var(--muted-foreground))' }} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
                      {[
                        { fill: 'hsl(145, 70%, 45%)' },
                        { fill: 'hsl(0, 75%, 55%)' },
                        { fill: 'hsl(250, 95%, 65%)' },
                      ].map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground justify-center">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'hsl(145, 70%, 45%)' }} /> Ingresos</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'hsl(0, 75%, 55%)' }} /> Directos</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'hsl(250, 95%, 65%)' }} /> Cuotas</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* === DESGLOSE POR CATEGORÍA: TORTA + GRID === */}
          <Card className="border-border/50">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-semibold text-sm">Desglose por categoría</h3>
                <HelpTooltip text="Incluye gastos directos y cuotas de tarjeta del mes. Tocá una categoría para filtrar la lista de abajo." />
                {hasCategoryFilter && (
                  <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-xs" onClick={() => setSelectedCategories(new Set())}>
                    <X className="h-3 w-3 mr-1" /> Limpiar filtros
                  </Button>
                )}
              </div>

              {categoryBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sin gastos en este período.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Donut */}
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      <ResponsiveContainer width={220} height={220}>
                        <PieChart>
                          <Pie
                            data={categoryBreakdown}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={95}
                            paddingAngle={2}
                            dataKey="total"
                            nameKey="name"
                          >
                            {categoryBreakdown.map((cat, i) => (
                              <Cell
                                key={i}
                                fill={cat.color}
                                opacity={hasCategoryFilter && !selectedCategories.has(cat.name) ? 0.25 : 1}
                                stroke={selectedCategories.has(cat.name) ? 'hsl(var(--primary))' : 'transparent'}
                                strokeWidth={selectedCategories.has(cat.name) ? 2 : 0}
                              />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            formatter={(value: number, name: string) => [formatCurrency(value, currency), name]}
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                            itemStyle={{ color: 'hsl(var(--card-foreground))' }}
                            labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Total en el centro */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xs text-muted-foreground">Total</span>
                        <span className="text-lg font-bold">{formatCurrency(totalExpenses, currency)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Grid de categorías */}
                  <div className="grid grid-cols-2 gap-2">
                    {categoryBreakdown.map((cat) => {
                      const pct = totalExpenses > 0 ? Math.round((cat.total / totalExpenses) * 100) : 0;
                      const isSelected = selectedCategories.has(cat.name);
                      const dimmed = hasCategoryFilter && !isSelected;

                      return (
                        <button
                          key={cat.id}
                          onClick={() => toggleCategory(cat.name)}
                          className={`text-left rounded-lg p-2.5 border transition-all ${
                            isSelected ? 'border-primary bg-primary/10' :
                            dimmed ? 'border-border/30 opacity-40' : 'border-border/50 hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                            <span className="text-xs font-medium truncate">{cat.name}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold tabular-nums">
                              <CurrencyDisplay amount={cat.total} currency={currency} size="sm" />
                            </span>
                            <span className="text-xs text-muted-foreground">{pct}%</span>
                          </div>
                          {cat.isEssential && <Badge variant="outline" className="text-[9px] px-1 py-0 mt-1">Esencial</Badge>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* === TABS: TODOS / PAGO DIRECTO / CUOTAS === */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="all" className="flex-1 sm:flex-none">Todos</TabsTrigger>
              <TabsTrigger value="direct" className="flex-1 sm:flex-none">Pago directo</TabsTrigger>
              <TabsTrigger value="installments" className="flex-1 sm:flex-none">Cuotas</TabsTrigger>
            </TabsList>

            {/* Resumen del tab */}
            <div className="mt-3 mb-2 text-sm text-muted-foreground px-1">
              {activeTab === 'all' && (
                <span>Todos los gastos: <CurrencyDisplay amount={filteredAllTotal} currency={currency} size="sm" className="inline font-semibold text-foreground" /> en {allCount} ítems ({directCount} directos + {installmentCount} cuotas)</span>
              )}
              {activeTab === 'direct' && (
                <span>Pago directo: <CurrencyDisplay amount={filteredDirectTotal} currency={currency} size="sm" className="inline font-semibold text-foreground" /> en {directCount} movimientos</span>
              )}
              {activeTab === 'installments' && (
                <span>Cuotas: <CurrencyDisplay amount={filteredInstallmentTotal} currency={currency} size="sm" className="inline font-semibold text-foreground" /> en {installmentCount} cuotas</span>
              )}
            </div>

            {/* === TAB TODOS === */}
            <TabsContent value="all" className="space-y-1.5 mt-2">
              {allCount === 0 ? (
                <EmptyState icon={ShoppingBag} title="Sin gastos" description={hasCategoryFilter ? 'Ningún gasto coincide con los filtros.' : 'No hay gastos en este período.'} />
              ) : (
                <>
                  {/* Directos */}
                  {filteredDirect.map((tx) => (
                    <DirectExpenseItem key={tx.id} tx={tx} currency={currency} />
                  ))}
                  {/* Cuotas */}
                  {filteredInstallments.map((inst) => (
                    <InstallmentItem key={inst.id} inst={inst} currency={currency} />
                  ))}
                </>
              )}
            </TabsContent>

            {/* === TAB PAGO DIRECTO === */}
            <TabsContent value="direct" className="space-y-1.5 mt-2">
              {directCount === 0 ? (
                <EmptyState icon={Receipt} title="Sin pagos directos" description="No hay egresos directos en este período." />
              ) : (
                filteredDirect.map((tx) => (
                  <DirectExpenseItem key={tx.id} tx={tx} currency={currency} />
                ))
              )}
            </TabsContent>

            {/* === TAB CUOTAS === */}
            <TabsContent value="installments" className="space-y-1.5 mt-2">
              {installmentCount === 0 ? (
                <EmptyState icon={CreditCard} title="Sin cuotas" description="No hay cuotas de tarjeta imputadas a este mes." />
              ) : (
                filteredInstallments.map((inst) => (
                  <InstallmentItem key={inst.id} inst={inst} currency={currency} />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// === SUB-COMPONENTES ===

function DirectExpenseItem({ tx, currency }: { tx: TxWithRelations; currency: Currency }) {
  const isCardPayment = tx.transaction_type === 'card_payment';

  return (
    <Link to={`/transactions/${tx.id}`}>
      <Card className="border-border/50 hover:border-primary/50 transition-colors">
        <CardContent className="p-3 flex items-center gap-3">
          <div className="rounded-full p-2 bg-expense/10 shrink-0">
            {isCardPayment ? <CreditCard className="h-4 w-4 text-expense" /> : <TrendingDown className="h-4 w-4 text-expense" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isCardPayment && <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">PAGO RESUMEN</Badge>}
              <p className="text-sm font-medium truncate">{tx.description || 'Sin descripción'}</p>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {tx.category?.name || 'Sin categoría'}
              {tx.account?.name && ` · ${tx.account.name}`}
              {` · ${formatRelativeDate(tx.transaction_date)}`}
            </p>
          </div>
          <CurrencyDisplay amount={Math.abs(Number(tx.amount))} currency={currency} size="sm" className="shrink-0 text-expense" />
        </CardContent>
      </Card>
    </Link>
  );
}

function InstallmentItem({ inst, currency }: { inst: InstallmentWithPurchase; currency: Currency }) {
  return (
    <Card className="border-border/50 hover:border-primary/50 transition-colors">
      <CardContent className="p-3 flex items-center gap-3">
        <div className="rounded-full p-2 bg-primary/10 shrink-0">
          <CreditCard className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge className="text-[10px] px-1.5 py-0 bg-warning/10 text-warning border-warning/20 shrink-0">
              CUOTA {inst.installment_number}/{inst.purchase?.installments_count ?? '?'}
            </Badge>
            <p className="text-sm font-medium truncate">{inst.purchase?.description ?? 'Compra'}</p>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {inst.purchase?.category?.name || 'Sin categoría'}
            {inst.purchase?.merchant && ` · ${inst.purchase.merchant}`}
            {inst.purchase?.purchase_date && ` · compra del ${formatDate(inst.purchase.purchase_date)}`}
          </p>
        </div>
        <CurrencyDisplay amount={Number(inst.amount_ars ?? inst.amount_original)} currency={currency} size="sm" className="shrink-0 text-expense" />
      </CardContent>
    </Card>
  );
}
