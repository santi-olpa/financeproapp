import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { supabase } from '@/integrations/supabase/client';
import { Transaction, Category, RecurringExpense, Currency } from '@/types/finance';
import { getCurrentPeriod } from '@/lib/format';
import { CategoryPieChart } from '@/components/reports/CategoryPieChart';
import { MonthlyTrendChart } from '@/components/reports/MonthlyTrendChart';
import { RecurringCostsChart } from '@/components/reports/RecurringCostsChart';
import { PeriodSelector } from '@/components/reports/PeriodSelector';
import { SummaryCards } from '@/components/reports/SummaryCards';

export default function Reports() {
  const currentPeriod = getCurrentPeriod();
  const [month, setMonth] = useState(currentPeriod.month);
  const [year, setYear] = useState(currentPeriod.year);
  const [currency, setCurrency] = useState<Currency>('ARS');

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

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader 
        title="Reportes" 
        subtitle="Análisis de tus finanzas"
      />

      <div className="p-4 max-w-lg mx-auto space-y-6">
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
