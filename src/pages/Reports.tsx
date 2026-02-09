import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { supabase } from '@/integrations/supabase/client';
import { Transaction, Category, RecurringExpense, Currency, Account } from '@/types/finance';
import { getCurrentPeriod, getMonthName, formatCurrency } from '@/lib/format';
import { CategoryPieChart } from '@/components/reports/CategoryPieChart';
import { MonthlyTrendChart } from '@/components/reports/MonthlyTrendChart';
import { RecurringCostsChart } from '@/components/reports/RecurringCostsChart';
import { PeriodSelector } from '@/components/reports/PeriodSelector';
import { SummaryCards } from '@/components/reports/SummaryCards';
import { useIsMobile } from '@/hooks/use-mobile';
import { TrendingUp, TrendingDown, Target, Lock, BarChart3 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function Reports() {
  const currentPeriod = getCurrentPeriod();
  const [month, setMonth] = useState(currentPeriod.month);
  const [year, setYear] = useState(currentPeriod.year);
  const [currency, setCurrency] = useState<Currency>('ARS');
  const isMobile = useIsMobile();

  // Fetch all transactions for the year (for monthly trend)
  const { data: yearTransactions = [], isLoading: loadingYear } = useQuery({
    queryKey: ['transactions', 'year', year],
    queryFn: async () => {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*, category:categories(*)')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as Transaction[];
    },
  });

  // Filter transactions for selected month
  const monthTransactions = useMemo(() => {
    return yearTransactions.filter(t => {
      const date = new Date(t.transaction_date);
      return date.getMonth() + 1 === month && date.getFullYear() === year;
    });
  }, [yearTransactions, month, year]);

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Category[];
    },
  });

  // Fetch recurring expenses
  const { data: recurringExpenses = [], isLoading: loadingRecurring } = useQuery({
    queryKey: ['recurring-expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*, category:categories(*)')
        .order('amount', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as RecurringExpense[];
    },
  });

  // Fetch accounts for Balance de Situación
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data as Account[];
    },
  });

  // Calculate totals for the month
  const { totalIncome, totalExpense } = useMemo(() => {
    const filtered = monthTransactions.filter(t => t.currency === currency);
    
    const income = filtered
      .filter(t => t.transaction_type === 'income')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const expense = filtered
      .filter(t => t.transaction_type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return { totalIncome: income, totalExpense: expense };
  }, [monthTransactions, currency]);

  // Previous month totals for comparison
  const prevMonthTotals = useMemo(() => {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const filtered = yearTransactions.filter(t => {
      const date = new Date(t.transaction_date);
      return date.getMonth() + 1 === prevMonth && date.getFullYear() === prevYear && t.currency === currency;
    });
    const income = filtered.filter(t => t.transaction_type === 'income').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const expense = filtered.filter(t => t.transaction_type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    return { income, expense };
  }, [yearTransactions, month, year, currency]);

  const incomeChangePercent = prevMonthTotals.income > 0 
    ? Math.round(((totalIncome - prevMonthTotals.income) / prevMonthTotals.income) * 100)
    : null;

  // Calculate fixed costs from recurring expenses
  const fixedCosts = useMemo(() => {
    return recurringExpenses
      .filter(e => e.is_active && e.currency === currency)
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [recurringExpenses, currency]);

  // Income breakdown by category (real data)
  const incomeByCat = useMemo(() => {
    const filtered = monthTransactions.filter(t => t.transaction_type === 'income' && t.currency === currency);
    const grouped: Record<string, { name: string; total: number }> = {};
    filtered.forEach(t => {
      const catId = t.category_id || 'none';
      const catName = t.category?.name || 'Sin categoría';
      if (!grouped[catId]) grouped[catId] = { name: catName, total: 0 };
      grouped[catId].total += Math.abs(t.amount);
    });
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [monthTransactions, currency]);

  // Expense breakdown by category (real data)
  const expenseByCat = useMemo(() => {
    const filtered = monthTransactions.filter(t => t.transaction_type === 'expense' && t.currency === currency);
    const grouped: Record<string, { name: string; total: number; color: string }> = {};
    filtered.forEach(t => {
      const catId = t.category_id || 'none';
      const catName = t.category?.name || 'Sin categoría';
      const catColor = t.category?.color || '#6b7280';
      if (!grouped[catId]) grouped[catId] = { name: catName, total: 0, color: catColor };
      grouped[catId].total += Math.abs(t.amount);
    });
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [monthTransactions, currency]);

  // Recurring expenses breakdown by category
  const recurringByCat = useMemo(() => {
    const filtered = recurringExpenses.filter(e => e.is_active && e.currency === currency);
    const grouped: Record<string, { name: string; total: number }> = {};
    filtered.forEach(e => {
      const catName = e.category?.name || 'Sin categoría';
      const catId = e.category_id || 'none';
      if (!grouped[catId]) grouped[catId] = { name: catName, total: 0 };
      grouped[catId].total += Number(e.amount);
    });
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [recurringExpenses, currency]);

  // Net savings trend (last 6 months) from yearTransactions
  const savingsTrend = useMemo(() => {
    const months: { name: string; net: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      let m = month - i;
      let y = year;
      while (m <= 0) { m += 12; y -= 1; }
      const filtered = yearTransactions.filter(t => {
        const d = new Date(t.transaction_date);
        return d.getMonth() + 1 === m && d.getFullYear() === y && t.currency === currency;
      });
      const inc = filtered.filter(t => t.transaction_type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
      const exp = filtered.filter(t => t.transaction_type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
      months.push({ name: getMonthName(m).slice(0, 3), net: inc - exp });
    }
    return months;
  }, [yearTransactions, month, year, currency]);

  const maxTrendValue = Math.max(...savingsTrend.map(m => Math.abs(m.net)), 1);

  const netSavings = totalIncome - totalExpense;

  // Balance de Situación: real account totals
  const totalPatrimonioARS = accounts
    .filter(a => a.currency === 'ARS')
    .reduce((sum, a) => sum + Number(a.current_balance), 0);
  const totalPatrimonioUSD = accounts
    .filter(a => a.currency === 'USD')
    .reduce((sum, a) => sum + Number(a.current_balance), 0);

  const isLoading = loadingYear || loadingRecurring;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Reportes" subtitle="Análisis de tus finanzas" />
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="p-4 space-y-6">
          <div className="flex flex-col gap-3">
            <PeriodSelector
              month={month}
              year={year}
              onMonthChange={setMonth}
              onYearChange={setYear}
            />
            <Tabs value={currency} onValueChange={(v) => setCurrency(v as Currency)} className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="ARS" className="flex-1">ARS</TabsTrigger>
                <TabsTrigger value="USD" className="flex-1">USD</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <SummaryCards 
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            currency={currency}
          />

          <Tabs defaultValue="categories" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="categories" className="flex-1">Categorías</TabsTrigger>
              <TabsTrigger value="trends" className="flex-1">Tendencias</TabsTrigger>
              <TabsTrigger value="fixed" className="flex-1">Fijos</TabsTrigger>
            </TabsList>

            <TabsContent value="categories" className="mt-4 space-y-4">
              <CategoryPieChart
                transactions={monthTransactions}
                categories={categories}
                type="expense"
                currency={currency}
                title="Gastos por Categoría"
              />
              <CategoryPieChart
                transactions={monthTransactions}
                categories={categories}
                type="income"
                currency={currency}
                title="Ingresos por Categoría"
              />
            </TabsContent>

            <TabsContent value="trends" className="mt-4">
              <MonthlyTrendChart
                transactions={yearTransactions}
                currency={currency}
                year={year}
              />
            </TabsContent>

            <TabsContent value="fixed" className="mt-4">
              <RecurringCostsChart
                recurringExpenses={recurringExpenses}
                currency={currency}
              />
            </TabsContent>
          </Tabs>

          {/* Balance de Situación Mobile */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold">Balance de Situación</h3>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Patrimonio ARS</span>
                <span className="font-bold"><CurrencyDisplay amount={totalPatrimonioARS} currency="ARS" size="md" enablePrivacy /></span>
              </div>
              {totalPatrimonioUSD > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Patrimonio USD</span>
                  <span className="font-bold"><CurrencyDisplay amount={totalPatrimonioUSD} currency="USD" size="md" enablePrivacy /></span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="min-h-screen bg-background pb-8">
      <PageHeader 
        title="Análisis Mensual" 
        subtitle={`Periodo: ${getMonthName(month)} ${year}`}
        action={
          <div className="flex items-center gap-2 bg-card p-1 rounded-full border border-border">
            <button 
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${month === currentPeriod.month && year === currentPeriod.year ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => { setMonth(currentPeriod.month); setYear(currentPeriod.year); }}
            >
              {getMonthName(currentPeriod.month)}
            </button>
            <button 
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${month === (currentPeriod.month - 1 || 12) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => {
                const pm = currentPeriod.month - 1 || 12;
                const py = currentPeriod.month === 1 ? currentPeriod.year - 1 : currentPeriod.year;
                setMonth(pm); setYear(py);
              }}
            >
              {getMonthName(currentPeriod.month - 1 || 12)}
            </button>
            <div className="w-px h-4 bg-border mx-1" />
            <Tabs value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
              <TabsList className="h-auto p-0 bg-transparent">
                <TabsTrigger value="ARS" className="px-3 py-1.5 text-sm rounded-full">ARS</TabsTrigger>
                <TabsTrigger value="USD" className="px-3 py-1.5 text-sm rounded-full">USD</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        }
      />

      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Reports Grid - 3 columns */}
          <div className="grid grid-cols-3 gap-6">
            {/* Ingresos Card */}
            <Card className="glass border-border/50">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-semibold">Ingresos</h3>
                  <TrendingUp className="h-5 w-5 text-income" />
                </div>
                <div className="space-y-1 mb-4">
                  <span className="text-2xl font-extrabold text-income">
                    + <CurrencyDisplay amount={totalIncome} currency={currency} size="xl" className="inline" enablePrivacy />
                  </span>
                  {incomeChangePercent !== null && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      {incomeChangePercent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {incomeChangePercent >= 0 ? '+' : ''}{incomeChangePercent}% vs. mes anterior
                    </p>
                  )}
                </div>
                
                <div className="space-y-3 mt-6">
                  {incomeByCat.slice(0, 4).map((cat) => {
                    const pct = totalIncome > 0 ? Math.round((cat.total / totalIncome) * 100) : 0;
                    return (
                      <div key={cat.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="truncate max-w-[150px]">{cat.name}</span>
                          <span>{pct}%</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                    );
                  })}
                  {incomeByCat.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sin ingresos este mes</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Costo de Vida Fijo */}
            <Card className="glass border-border/50">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-semibold">Costo de Vida Fijo</h3>
                  <Lock className="h-5 w-5 text-warning" />
                </div>
                <div className="space-y-1 mb-4">
                  <span className="text-2xl font-extrabold">
                    <CurrencyDisplay amount={fixedCosts} currency={currency} size="xl" className="inline" enablePrivacy />
                  </span>
                  <p className="text-sm text-muted-foreground">
                    {totalIncome > 0 ? Math.round((fixedCosts / totalIncome) * 100) : 0}% de tus ingresos
                  </p>
                </div>
                
                <div className="mt-6 space-y-2">
                  {recurringByCat.slice(0, 5).map((cat) => (
                    <div key={cat.name} className="flex justify-between text-sm py-2 border-t border-border">
                      <span className="truncate max-w-[150px]">{cat.name}</span>
                      <span className="font-medium">
                        <CurrencyDisplay amount={cat.total} currency={currency} size="sm" className="inline" />
                      </span>
                    </div>
                  ))}
                  {recurringByCat.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sin gastos recurrentes</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Ahorro Neto */}
            <Card className="glass border-border/50">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-semibold">Ahorro Neto</h3>
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1 mb-4">
                  <span className={`text-2xl font-extrabold ${netSavings >= 0 ? 'text-income' : 'text-destructive'}`}>
                    <CurrencyDisplay amount={netSavings} currency={currency} size="xl" className="inline" enablePrivacy />
                  </span>
                  <p className="text-sm text-muted-foreground">
                    {totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0}% de tasa de ahorro
                  </p>
                </div>
                
                <div className="mt-8">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Tasa de Ahorro</span>
                    <span>{totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0}%</span>
                  </div>
                  <Progress value={Math.max(0, totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0)} className="h-3" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Second Row */}
          <div className="grid grid-cols-3 gap-6">
            {/* Desglose de Egresos - 2 columns */}
            <Card className="col-span-2 glass border-border/50">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="font-semibold">Desglose de Egresos</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-8">
                  <CategoryPieChart
                    transactions={monthTransactions}
                    categories={categories}
                    type="expense"
                    currency={currency}
                    title=""
                  />
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 text-sm text-muted-foreground font-medium pb-2 border-b border-border">
                      <span>Categoría</span>
                      <span className="text-right">Monto</span>
                    </div>
                    {expenseByCat.map((cat) => (
                      <div key={cat.name} className="flex justify-between items-center text-sm py-2 border-b border-border/50">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span className="truncate max-w-[150px]">{cat.name}</span>
                        </span>
                        <span className="font-medium">
                          <CurrencyDisplay amount={cat.total} currency={currency} size="sm" className="inline" />
                        </span>
                      </div>
                    ))}
                    {expenseByCat.length === 0 && (
                      <p className="text-sm text-muted-foreground py-4">Sin gastos este mes</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tendencia - 1 column */}
            <Card className="glass border-border/50">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-semibold">Tendencia (6 meses)</h3>
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">Evolución de Ahorro Neto</p>
                
                <div className="flex items-end gap-2 h-32 mt-6">
                  {savingsTrend.map((m, i) => {
                    const height = maxTrendValue > 0 ? Math.max(5, (Math.abs(m.net) / maxTrendValue) * 100) : 5;
                    const isLast = i === savingsTrend.length - 1;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div 
                          className={`w-full rounded-t ${m.net >= 0 ? (isLast ? 'bg-primary' : 'bg-primary/20') : 'bg-destructive/40'}`}
                          style={{ height: `${height}%` }}
                        />
                        <span className="text-xs text-muted-foreground">{m.name}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Balance de Situación - Full width */}
          <Card className="glass border-border/50">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Balance de Situación</h3>
                <span className="text-sm text-muted-foreground">Basado en saldos actuales de cuentas</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <span className="text-sm text-muted-foreground">Patrimonio en ARS</span>
                  <h2 className="text-3xl font-extrabold mt-1">
                    <CurrencyDisplay amount={totalPatrimonioARS} currency="ARS" size="xl" enablePrivacy />
                  </h2>
                </div>
                <div className="w-px h-12 bg-border mx-8" />
                <div className="flex-1 pl-8">
                  <span className="text-sm text-muted-foreground">Patrimonio en USD</span>
                  <h2 className="text-3xl font-extrabold text-income mt-1">
                    <CurrencyDisplay amount={totalPatrimonioUSD} currency="USD" size="xl" enablePrivacy />
                  </h2>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
