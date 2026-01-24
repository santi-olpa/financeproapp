import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { supabase } from '@/integrations/supabase/client';
import { Transaction, Category, RecurringExpense, Currency } from '@/types/finance';
import { getCurrentPeriod, getMonthName } from '@/lib/format';
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

  // Calculate fixed costs
  const fixedCosts = useMemo(() => {
    return recurringExpenses
      .filter(e => e.is_active && e.currency === currency)
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [recurringExpenses, currency]);

  const netSavings = totalIncome - totalExpense;
  const savingsGoal = 200000; // Example goal
  const savingsProgress = Math.min((netSavings / savingsGoal) * 100, 100);

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
          {/* Period and Currency Selector */}
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

          {/* Summary Cards */}
          <SummaryCards 
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            currency={currency}
          />

          {/* Tabs for different views */}
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
        </div>
      </div>
    );
  }

  // Desktop Layout - 3 column grid like HTML template
  return (
    <div className="min-h-screen bg-background pb-8">
      <PageHeader 
        title="Análisis Mensual" 
        subtitle={`Periodo: ${getMonthName(month)} ${year}`}
        action={
          <div className="flex items-center gap-2 bg-card p-1 rounded-full border border-border">
            <button 
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${month === currentPeriod.month ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => { setMonth(currentPeriod.month); setYear(currentPeriod.year); }}
            >
              {getMonthName(currentPeriod.month)}
            </button>
            <button 
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${month === currentPeriod.month - 1 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setMonth(currentPeriod.month - 1 || 12)}
            >
              {getMonthName(currentPeriod.month - 1 || 12)}
            </button>
            <div className="w-px h-4 bg-border mx-1" />
            <button className="px-4 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground">
              Anual
            </button>
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
                    + <CurrencyDisplay amount={totalIncome} currency={currency} size="xl" className="inline" />
                  </span>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> 12% vs. mes anterior
                  </p>
                </div>
                
                {/* Progress bars */}
                <div className="space-y-3 mt-6">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Freelance / Olpa</span>
                      <span>75%</span>
                    </div>
                    <Progress value={75} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Otros</span>
                      <span>25%</span>
                    </div>
                    <Progress value={25} className="h-2 [&>div]:bg-muted-foreground" />
                  </div>
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
                    <CurrencyDisplay amount={fixedCosts} currency={currency} size="xl" className="inline" />
                  </span>
                  <p className="text-sm text-muted-foreground">
                    {totalIncome > 0 ? Math.round((fixedCosts / totalIncome) * 100) : 0}% de tus ingresos
                  </p>
                </div>
                
                {/* Table */}
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between text-sm py-2 border-t border-border">
                    <span>Alquiler</span>
                    <span className="font-medium">$ 120.000</span>
                  </div>
                  <div className="flex justify-between text-sm py-2 border-t border-border">
                    <span>Servicios</span>
                    <span className="font-medium">$ 56.000</span>
                  </div>
                  <div className="flex justify-between text-sm py-2 border-t border-border">
                    <span>Suscripciones</span>
                    <span className="font-medium">$ 19.400</span>
                  </div>
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
                  <span className="text-2xl font-extrabold">
                    <CurrencyDisplay amount={netSavings} currency={currency} size="xl" className="inline" />
                  </span>
                  <p className="text-sm text-muted-foreground">
                    Meta: <CurrencyDisplay amount={savingsGoal} currency={currency} size="sm" className="inline" />
                  </p>
                </div>
                
                <div className="mt-8">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Progreso de Meta</span>
                    <span>{Math.round(savingsProgress)}%</span>
                  </div>
                  <Progress value={savingsProgress} className="h-3" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Second Row - Wide charts */}
          <div className="grid grid-cols-3 gap-6">
            {/* Desglose de Egresos - 2 columns */}
            <Card className="col-span-2 glass border-border/50">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="font-semibold">Desglose de Egresos</h3>
                  <select className="text-sm bg-transparent border border-border rounded px-2 py-1 text-muted-foreground">
                    <option>Por Categoría</option>
                    <option>Por Cuenta</option>
                  </select>
                </div>
                
              <div className="grid grid-cols-2 gap-8">
                <CategoryPieChart
                  transactions={monthTransactions}
                  categories={categories}
                  type="expense"
                  currency={currency}
                  title=""
                />
                
                {/* Category table */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 text-sm text-muted-foreground font-medium pb-2 border-b border-border">
                    <span>Categoría</span>
                      <span className="text-right">Monto</span>
                    </div>
                    {categories.slice(0, 5).map((cat, i) => {
                      const catExpenses = monthTransactions
                        .filter(t => t.transaction_type === 'expense' && t.category_id === cat.id && t.currency === currency)
                        .reduce((sum, t) => sum + Number(t.amount), 0);
                      if (catExpenses === 0) return null;
                      return (
                        <div key={cat.id} className="flex justify-between items-center text-sm py-2 border-b border-border/50">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color || '#6366f1' }} />
                            {cat.name}
                          </span>
                          <span className="font-medium">
                            <CurrencyDisplay amount={catExpenses} currency={currency} size="sm" className="inline" />
                          </span>
                        </div>
                      );
                    })}
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
                
                {/* Simple bar chart */}
                <div className="flex items-end gap-2 h-32 mt-6">
                  {[30, 50, 45, 60, 80, 70].map((height, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <div 
                        className={`w-full rounded-t ${i === 5 ? 'bg-primary' : 'bg-primary/20'}`}
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {['Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene'][i]}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Balance de Situación - Full width */}
          <Card className="glass border-border/50">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Balance de Situación</h3>
                <span className="text-sm text-income">Cierre de mes proyectado</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <span className="text-sm text-muted-foreground">Patrimonio en ARS</span>
                  <h2 className="text-3xl font-extrabold mt-1">$ 1.723.600,06</h2>
                </div>
                <div className="w-px h-12 bg-border mx-8" />
                <div className="flex-1 pl-8">
                  <span className="text-sm text-muted-foreground">Equivalente en USD (MEP)</span>
                  <h2 className="text-3xl font-extrabold text-income mt-1">US$ 1.436,33</h2>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
