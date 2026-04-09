import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { KPICard } from '@/components/kpi/KPICard';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign,
  Target,
  BarChart3,
  Repeat,
  Plus,
  Calculator,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
} from 'lucide-react';
import { getMonthName, getCurrentPeriod, formatCurrency, formatRelativeDate } from '@/lib/format';
import type {
  Currency,
  RecurringExpense,
  FinancialGoal,
  MonthlyBudget,
  Category,
  Installment,
  Transaction,
} from '@/types/finance';
import { FREQUENCY_LABELS } from '@/types/finance';

export default function Planning() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { month, year } = getCurrentPeriod();
  const [currency] = useState<Currency>('ARS');
  const [projectionMonths, setProjectionMonths] = useState(6);

  // Simulator state
  const [simAmount, setSimAmount] = useState('');
  const [simInstallments, setSimInstallments] = useState('12');
  const [showSimulation, setShowSimulation] = useState(false);

  // === DATA QUERIES ===

  const { data: recurringExpenses = [], isLoading: l1 } = useQuery({
    queryKey: ['recurring-expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*, category:categories(name, icon, color)')
        .eq('is_active', true)
        .eq('currency', currency)
        .order('amount', { ascending: false });
      if (error) throw error;
      return data as (RecurringExpense & { category: { name: string; icon: string; color: string } | null })[];
    },
    enabled: !!user,
  });

  const { data: goals = [], isLoading: l2 } = useQuery({
    queryKey: ['financial-goals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_goals')
        .select('*')
        .eq('currency', currency)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as FinancialGoal[];
    },
    enabled: !!user,
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['monthly-budgets', month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_budgets')
        .select('*, category:categories(name, icon, color)')
        .eq('year', year)
        .eq('month', month)
        .eq('currency', currency);
      if (error) throw error;
      return data as (MonthlyBudget & { category: { name: string; icon: string; color: string } })[];
    },
    enabled: !!user,
  });

  // Transactions de los últimos 3 meses para promedios
  const { data: last3MonthsTx = [] } = useQuery({
    queryKey: ['transactions', 'last-3-months', currency],
    queryFn: async () => {
      const threeMonthsAgo = new Date(year, month - 4, 1).toISOString().split('T')[0];
      const endOfLastMonth = new Date(year, month - 1, 0).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, transaction_type, currency, category_id, recurring_expense_id, transaction_date')
        .eq('currency', currency)
        .gte('transaction_date', threeMonthsAgo)
        .lte('transaction_date', endOfLastMonth);
      if (error) throw error;
      return data as Pick<Transaction, 'amount' | 'transaction_type' | 'currency' | 'category_id' | 'recurring_expense_id' | 'transaction_date'>[];
    },
    enabled: !!user,
  });

  // Month expenses by category (for budgets)
  const { data: monthExpensesByCat = [] } = useQuery({
    queryKey: ['transactions', 'month-expenses-cat', month, year],
    queryFn: async () => {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const end = new Date(year, month, 0).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, category_id')
        .eq('transaction_type', 'expense')
        .eq('currency', currency)
        .gte('transaction_date', start)
        .lte('transaction_date', end);
      if (error) throw error;
      return data as { amount: number; category_id: string | null }[];
    },
    enabled: !!user,
  });

  // Future installments for projection
  const { data: futureInstallments = [] } = useQuery({
    queryKey: ['installments', 'future-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installments')
        .select('amount_original, amount_ars, billing_year, billing_month, status')
        .eq('user_id', user!.id)
        .in('status', ['pending', 'billed']);
      if (error) throw error;
      return data as Pick<Installment, 'amount_original' | 'amount_ars' | 'billing_year' | 'billing_month' | 'status'>[];
    },
    enabled: !!user,
  });

  // === CALCULATIONS ===

  const recurringTotal = recurringExpenses.reduce((s, r) => s + Number(r.amount), 0);

  const avgIncome3m = useMemo(() => {
    const incomes = last3MonthsTx.filter(t => t.transaction_type === 'income');
    return incomes.length > 0 ? incomes.reduce((s, t) => s + Number(t.amount), 0) / 3 : 0;
  }, [last3MonthsTx]);

  const avgExpense3m = useMemo(() => {
    const expenses = last3MonthsTx.filter(t => t.transaction_type === 'expense');
    return expenses.length > 0 ? expenses.reduce((s, t) => s + Number(t.amount), 0) / 3 : 0;
  }, [last3MonthsTx]);

  // Projection data
  const projection = useMemo(() => {
    const rows = [];
    let cumulative = 0;
    const simAmt = showSimulation ? (parseFloat(simAmount) || 0) / (parseInt(simInstallments) || 1) : 0;

    for (let i = 0; i < projectionMonths; i++) {
      let m = month + i;
      let y = year;
      while (m > 12) { m -= 12; y += 1; }

      const cardInstallments = futureInstallments
        .filter(inst => inst.billing_year === y && inst.billing_month === m)
        .reduce((s, inst) => s + Number(inst.amount_ars ?? inst.amount_original), 0);

      const recurring = recurringTotal;
      const totalCommitted = cardInstallments + recurring + simAmt;
      const net = avgIncome3m - totalCommitted;
      cumulative += net;

      rows.push({
        year: y,
        month: m,
        income: avgIncome3m,
        recurring,
        installments: cardInstallments,
        simulated: simAmt,
        totalCommitted,
        net,
        cumulative,
      });
    }
    return rows;
  }, [projectionMonths, month, year, avgIncome3m, recurringTotal, futureInstallments, showSimulation, simAmount, simInstallments]);

  const maxProjectionValue = Math.max(...projection.map(p => Math.max(p.income, p.totalCommitted)), 1);
  const minCumulative = Math.min(...projection.map(p => p.cumulative));

  const activeGoals = goals.filter(g => g.is_active && !g.achieved_at);
  const achievedGoals = goals.filter(g => g.achieved_at);

  const isLoading = l1 || l2;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Planeación" subtitle="Tu copiloto financiero" />

      <div className="p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="cost">
            <TabsList className="w-full sm:w-auto mb-6">
              <TabsTrigger value="cost" className="flex-1 sm:flex-none">Costo de vida</TabsTrigger>
              <TabsTrigger value="budgets" className="flex-1 sm:flex-none">Presupuestos</TabsTrigger>
              <TabsTrigger value="goals" className="flex-1 sm:flex-none">Metas</TabsTrigger>
              <TabsTrigger value="projection" className="flex-1 sm:flex-none">Proyección</TabsTrigger>
            </TabsList>

            {/* === COSTO DE VIDA === */}
            <TabsContent value="cost" className="space-y-6">
              <KPICard
                title="Costo de vida fijo mensual"
                tooltipText="Es lo mínimo que necesitás por mes para mantener tu vida actual: alquiler, servicios, supermercado, transporte y todos tus gastos esenciales."
                value={recurringTotal}
                currency={currency}
                state={avgIncome3m > recurringTotal ? 'good' : 'bad'}
              />

              <Card className={`border ${avgIncome3m >= recurringTotal ? 'border-income/30 bg-income/5' : 'border-expense/30 bg-expense/5'}`}>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground mb-1">Para cubrir tus gastos esenciales necesitás generar al menos:</p>
                  <CurrencyDisplay amount={recurringTotal} currency={currency} size="lg" className="font-bold" enablePrivacy />
                  <p className="text-sm text-muted-foreground mt-2">
                    Tu ingreso promedio (últimos 3 meses): <CurrencyDisplay amount={avgIncome3m} currency={currency} size="sm" className="inline font-semibold" enablePrivacy />
                  </p>
                </CardContent>
              </Card>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Repeat className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recurrentes activos</h3>
                </div>
                {recurringExpenses.length === 0 ? (
                  <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">Sin gastos recurrentes.</CardContent></Card>
                ) : (
                  <div className="space-y-1.5">
                    {recurringExpenses.map((rec) => (
                      <Card key={rec.id} className="border-border/50">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{rec.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {rec.category?.name ?? 'Sin categoría'} · {FREQUENCY_LABELS[rec.frequency]} · Próximo: {formatRelativeDate(rec.next_due_date)}
                            </p>
                          </div>
                          <CurrencyDisplay amount={Number(rec.amount)} currency={currency} size="sm" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* === PRESUPUESTOS === */}
            <TabsContent value="budgets" className="space-y-6">
              {budgets.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title="Sin presupuestos"
                  description="Los presupuestos te ayudan a poner un tope mensual a categorías específicas. Es opcional. ¿Querés probarlos?"
                  action={<Button><Plus className="h-4 w-4 mr-2" /> Agregar presupuesto</Button>}
                />
              ) : (
                <div className="space-y-3">
                  {budgets.map((budget) => {
                    const spent = monthExpensesByCat
                      .filter(e => e.category_id === budget.category_id)
                      .reduce((s, e) => s + Number(e.amount), 0);
                    const pct = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0;
                    const state = pct >= 100 ? 'bad' : pct >= 80 ? 'warning' : 'good';

                    return (
                      <Card key={budget.id} className="border-border/50">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{budget.category?.name ?? 'Sin categoría'}</span>
                            <span className="text-xs text-muted-foreground">{pct}%</span>
                          </div>
                          <Progress value={Math.min(pct, 100)} className="h-2 mb-2" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Gastado: <CurrencyDisplay amount={spent} currency={currency} size="sm" className="inline" /></span>
                            <span>Tope: <CurrencyDisplay amount={budget.amount} currency={currency} size="sm" className="inline" /></span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* === METAS === */}
            <TabsContent value="goals" className="space-y-6">
              {activeGoals.length === 0 && achievedGoals.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title="Sin metas"
                  description="Definí metas de ahorro o hábitos financieros para motivarte a alcanzar tus objetivos."
                  action={<Button><Plus className="h-4 w-4 mr-2" /> Nueva meta</Button>}
                />
              ) : (
                <>
                  {activeGoals.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Activas</h3>
                      <div className="space-y-3">
                        {activeGoals.map((goal) => {
                          const current = Number(goal.current_amount ?? 0);
                          const target = Number(goal.target_amount ?? 0);
                          const pct = target > 0 ? Math.round((current / target) * 100) : 0;
                          const monthlyRate = avgIncome3m > avgExpense3m ? avgIncome3m - avgExpense3m : 0;
                          const remaining = target - current;
                          const monthsToGo = monthlyRate > 0 ? Math.ceil(remaining / monthlyRate) : null;

                          return (
                            <Card key={goal.id} className="border-border/50">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium">{goal.name}</span>
                                  <Badge variant="outline">{goal.goal_type === 'savings' ? 'Ahorro' : 'Hábito'}</Badge>
                                </div>
                                {goal.goal_type === 'savings' && target > 0 && (
                                  <>
                                    <Progress value={Math.min(pct, 100)} className="h-2 mb-2" />
                                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                      <span><CurrencyDisplay amount={current} currency={currency} size="sm" className="inline" /> de <CurrencyDisplay amount={target} currency={currency} size="sm" className="inline" /></span>
                                      <span>{pct}%</span>
                                    </div>
                                    {monthsToGo !== null && (
                                      <p className="text-xs text-muted-foreground">
                                        Al ritmo actual lo alcanzás en ~{monthsToGo} {monthsToGo === 1 ? 'mes' : 'meses'}
                                      </p>
                                    )}
                                  </>
                                )}
                                {goal.goal_type === 'habit' && goal.habit_percentage && (
                                  <p className="text-sm text-muted-foreground">
                                    Objetivo: ahorrar {goal.habit_percentage}% de tus ingresos cada {goal.habit_period === 'monthly' ? 'mes' : goal.habit_period}
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {achievedGoals.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Cumplidas</h3>
                      <div className="space-y-2">
                        {achievedGoals.map((goal) => (
                          <Card key={goal.id} className="border-income/20 bg-income/5">
                            <CardContent className="p-3 flex items-center justify-between">
                              <span className="text-sm font-medium">{goal.name}</span>
                              <Badge className="bg-income/10 text-income border-income/20">Cumplida</Badge>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* === PROYECCIÓN === */}
            <TabsContent value="projection" className="space-y-6">
              {/* Selector de horizonte */}
              <div className="flex items-center gap-2">
                {[3, 6, 12].map((n) => (
                  <Button
                    key={n}
                    variant={projectionMonths === n ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setProjectionMonths(n)}
                  >
                    {n} meses
                  </Button>
                ))}
              </div>

              {/* Saldo proyectado */}
              <KPICard
                title={`Saldo proyectado a ${projectionMonths} meses`}
                tooltipText="Estimación de tu saldo acumulado al final del período, basado en tu ingreso promedio de los últimos 3 meses menos tus compromisos (cuotas + recurrentes)."
                value={projection.length > 0 ? projection[projection.length - 1].cumulative : null}
                currency={currency}
                state={
                  projection.length === 0 ? 'neutral'
                  : projection[projection.length - 1].cumulative >= 0 ? 'good'
                  : 'bad'
                }
              />

              {/* Gráfico simplificado de barras */}
              <Card className="border-border/50">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm">Ingresos vs Egresos comprometidos</h3>
                    <HelpTooltip text="Barras verdes: ingreso esperado. Barras rojas: total comprometido (cuotas + recurrentes). Si el rojo supera al verde, ese mes vas a estar en rojo." />
                  </div>
                  <div className="space-y-3">
                    {projection.map((p) => (
                      <div key={`${p.year}-${p.month}`} className="flex items-center gap-3">
                        <span className="text-xs w-10 text-right text-muted-foreground shrink-0">
                          {getMonthName(p.month).slice(0, 3)}
                        </span>
                        <div className="flex-1 flex gap-1">
                          <div
                            className="h-4 bg-income/60 rounded-sm"
                            style={{ width: `${(p.income / maxProjectionValue) * 100}%` }}
                            title={`Ingreso: ${formatCurrency(p.income, currency)}`}
                          />
                        </div>
                        <div className="flex-1 flex gap-1">
                          <div
                            className="h-4 bg-expense/60 rounded-sm"
                            style={{ width: `${(p.totalCommitted / maxProjectionValue) * 100}%` }}
                            title={`Comprometido: ${formatCurrency(p.totalCommitted, currency)}`}
                          />
                          {p.simulated > 0 && (
                            <div
                              className="h-4 bg-primary/60 rounded-sm"
                              style={{ width: `${(p.simulated / maxProjectionValue) * 100}%` }}
                              title={`Simulado: ${formatCurrency(p.simulated, currency)}`}
                            />
                          )}
                        </div>
                        <span className={`text-xs font-mono w-20 text-right shrink-0 ${p.net >= 0 ? 'text-income' : 'text-expense'}`}>
                          {p.net >= 0 ? '+' : ''}{formatCurrency(p.net, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-income/60 rounded-sm" /> Ingreso</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-expense/60 rounded-sm" /> Comprometido</span>
                    {showSimulation && <span className="flex items-center gap-1"><span className="w-3 h-3 bg-primary/60 rounded-sm" /> Simulado</span>}
                  </div>
                </CardContent>
              </Card>

              {/* Tabla detallada */}
              <Card className="border-border/50 overflow-x-auto">
                <CardContent className="p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b">
                        <th className="text-left pb-2">Mes</th>
                        <th className="text-right pb-2">Ingreso</th>
                        <th className="text-right pb-2">Recurrentes</th>
                        <th className="text-right pb-2">Cuotas</th>
                        <th className="text-right pb-2">Neto</th>
                        <th className="text-right pb-2">Acumulado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projection.map((p) => (
                        <tr key={`${p.year}-${p.month}`} className="border-b border-border/30">
                          <td className="py-2">{getMonthName(p.month).slice(0, 3)} {p.year !== year ? p.year : ''}</td>
                          <td className="text-right text-income">{formatCurrency(p.income, currency)}</td>
                          <td className="text-right">{formatCurrency(p.recurring, currency)}</td>
                          <td className="text-right">{formatCurrency(p.installments + p.simulated, currency)}</td>
                          <td className={`text-right font-medium ${p.net >= 0 ? 'text-income' : 'text-expense'}`}>
                            {p.net >= 0 ? '+' : ''}{formatCurrency(p.net, currency)}
                          </td>
                          <td className={`text-right font-bold ${p.cumulative >= 0 ? '' : 'text-expense'}`}>
                            {formatCurrency(p.cumulative, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Simulador */}
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Calculator className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Simulador de compra</h3>
                    <HelpTooltip text="Simulá cómo afectaría una compra grande a tu proyección. No guarda nada en la base de datos." />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label>Monto total</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={simAmount}
                        onChange={(e) => setSimAmount(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cuotas</Label>
                      <Input
                        type="number"
                        min="1"
                        max="48"
                        value={simInstallments}
                        onChange={(e) => setSimInstallments(e.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        className="w-full"
                        onClick={() => setShowSimulation(!showSimulation)}
                        variant={showSimulation ? 'destructive' : 'default'}
                      >
                        {showSimulation ? 'Quitar simulación' : 'Simular'}
                      </Button>
                    </div>
                  </div>

                  {showSimulation && parseFloat(simAmount) > 0 && (
                    <Card className={`border ${minCumulative >= 0 ? 'border-income/30 bg-income/5' : 'border-expense/30 bg-expense/5'}`}>
                      <CardContent className="p-3">
                        {minCumulative >= 0 ? (
                          <p className="text-sm">
                            <span className="text-income font-semibold">Sí, podés.</span> El menor saldo proyectado sería{' '}
                            <CurrencyDisplay amount={minCumulative} currency={currency} size="sm" className="inline font-semibold" />.
                          </p>
                        ) : (
                          <p className="text-sm">
                            <span className="text-expense font-semibold">Cuidado.</span> Te quedarías con{' '}
                            <CurrencyDisplay amount={minCumulative} currency={currency} size="sm" className="inline font-semibold" />{' '}
                            en algún mes. Considerá cuotas más largas o esperar.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
