import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { endOfMonth, format, differenceInDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { KPICard } from '@/components/kpi/KPICard';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowRight,
  Wallet,
  CalendarClock,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCurrentPeriod, formatRelativeDate } from '@/lib/format';
import type { Account, Transaction, RecurringExpense, Installment } from '@/types/finance';

export default function Dashboard() {
  const { user } = useAuth();
  const { month, year } = getCurrentPeriod();
  const now = new Date();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
  const daysLeft = differenceInDays(endOfMonth(now), now);

  // === DATA QUERIES ===

  const { data: accounts = [], isLoading: l1 } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('accounts').select('*').eq('is_active', true).order('created_at', { ascending: false });
      if (error) throw error;
      return data as Account[];
    },
    enabled: !!user,
  });

  const { data: monthTotals, isLoading: l2 } = useQuery({
    queryKey: ['transactions', 'month-totals', month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, transaction_type, currency')
        .gte('transaction_date', startDate)
        .lte('transaction_date', lastDay);
      if (error) throw error;
      return data as Pick<Transaction, 'amount' | 'transaction_type' | 'currency'>[];
    },
    enabled: !!user,
  });

  const { data: recentTx = [], isLoading: l3 } = useQuery({
    queryKey: ['transactions', 'recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, category:categories(name, icon, color)')
        .order('transaction_date', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as (Transaction & { category: { name: string; icon: string; color: string } | null })[];
    },
    enabled: !!user,
  });

  // Cuotas del mes actual
  const { data: monthInstallments = [] } = useQuery({
    queryKey: ['installments', 'month', month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installments')
        .select('amount_original, amount_ars, status')
        .eq('user_id', user!.id)
        .eq('billing_year', year)
        .eq('billing_month', month)
        .in('status', ['pending', 'billed']);
      if (error) throw error;
      return data as Pick<Installment, 'amount_original' | 'amount_ars' | 'status'>[];
    },
    enabled: !!user,
  });

  // Recurrentes activos del mes
  const { data: monthRecurring = [] } = useQuery({
    queryKey: ['recurring', 'month', month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('amount, currency, name, next_due_date')
        .eq('is_active', true)
        .gte('next_due_date', startDate)
        .lte('next_due_date', lastDay);
      if (error) throw error;
      return data as Pick<RecurringExpense, 'amount' | 'currency' | 'name' | 'next_due_date'>[];
    },
    enabled: !!user,
  });

  // Próximas obligaciones (cuotas + recurrentes próximos 30 días)
  const { data: upcomingObligations = [] } = useQuery({
    queryKey: ['obligations', 'upcoming'],
    queryFn: async () => {
      const today = format(now, 'yyyy-MM-dd');
      const in30 = format(new Date(now.getTime() + 30 * 86400000), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('name, amount, currency, next_due_date')
        .eq('is_active', true)
        .gte('next_due_date', today)
        .lte('next_due_date', in30)
        .order('next_due_date')
        .limit(5);
      if (error) throw error;
      return data as { name: string; amount: number; currency: string; next_due_date: string }[];
    },
    enabled: !!user,
  });

  // === CALCULATIONS ===

  const patrimonio = useMemo(() => {
    const ars = accounts.filter(a => a.currency === 'ARS').reduce((s, a) => s + Number(a.current_balance), 0);
    const usd = accounts.filter(a => a.currency === 'USD').reduce((s, a) => s + Number(a.current_balance), 0);
    return { ars, usd };
  }, [accounts]);

  const liquidez = useMemo(() => {
    return accounts
      .filter(a => a.account_subtype === 'operating' && a.currency === 'ARS')
      .reduce((s, a) => s + Number(a.current_balance), 0);
  }, [accounts]);

  const monthIncome = (monthTotals ?? [])
    .filter(t => t.transaction_type === 'income' && t.currency === 'ARS')
    .reduce((s, t) => s + Number(t.amount), 0);
  const monthExpense = (monthTotals ?? [])
    .filter(t => t.transaction_type === 'expense' && t.currency === 'ARS')
    .reduce((s, t) => s + Number(t.amount), 0);

  const cardsCommitted = monthInstallments.reduce((s, i) => s + Number(i.amount_ars ?? i.amount_original), 0);
  const recurringCommitted = monthRecurring
    .filter(r => r.currency === 'ARS')
    .reduce((s, r) => s + Number(r.amount), 0);
  const totalCommitted = cardsCommitted + recurringCommitted;

  // Liquidez proyectada a fin de mes (simplificada)
  const projectedEndOfMonth = liquidez - totalCommitted;

  // Tasa de ahorro
  const savingsRate = monthIncome > 0 ? (monthIncome - monthExpense) / monthIncome : null;
  const savingsRateState = savingsRate === null ? 'neutral' as const
    : savingsRate >= 0.2 ? 'good' as const
    : savingsRate >= 0.1 ? 'warning' as const
    : 'bad' as const;

  const isLoading = l1 || l2 || l3;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Panel General"
        subtitle="Tu salud financiera de un vistazo"
        action={
          <Link to="/transactions/new">
            <Button size="sm" className="rounded-full">
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Nuevo</span>
            </Button>
          </Link>
        }
      />

      <div className="p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* === TIRA DE 3 KPIs PRINCIPALES === */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KPICard
              title="Patrimonio Neto"
              tooltipText="Es lo que realmente tenés. Sumamos el dinero en todas tus cuentas (operativas y de ahorro) y le restamos lo que debés en tarjetas. Es el número más importante para ver tu evolución a largo plazo: si sube mes a mes, vas bien."
              value={patrimonio.ars}
              currency="ARS"
              state="neutral"
            />
            <KPICard
              title="Liquidez"
              tooltipText="Es la plata que tenés disponible ahora mismo en tus cuentas y billeteras de uso diario. No incluye ahorros separados ni inversiones. Es lo que podés gastar hoy sin pedir prestado."
              value={liquidez}
              currency="ARS"
              state={liquidez > totalCommitted * 2 ? 'good' : liquidez > totalCommitted ? 'warning' : 'bad'}
            />
            <KPICard
              title="Comprometido del mes"
              tooltipText="Es la plata que ya tiene destino este mes aunque todavía esté en tu cuenta. Incluye las cuotas de tarjeta que vencen este mes y los gastos fijos que faltan pagar. No la cuentes como disponible."
              value={totalCommitted}
              currency="ARS"
              state={totalCommitted > 0 ? 'warning' : 'neutral'}
            />
          </div>

          {/* === HERO: LLEGADA A FIN DE MES === */}
          <Card className={`border ${projectedEndOfMonth >= 0 ? 'border-income/30 bg-income/5' : 'border-expense/30 bg-expense/5'}`}>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-muted-foreground">Te quedan para llegar a fin de mes:</span>
                <HelpTooltip text="Estimación de cuánto te va a quedar el último día del mes. Tomamos tu liquidez actual y le restamos lo que falta pagar (cuotas, fijos). Si este número está en rojo, vas a quedarte corto." />
              </div>
              <CurrencyDisplay
                amount={projectedEndOfMonth}
                currency="ARS"
                size="xl"
                className={`font-extrabold ${projectedEndOfMonth >= 0 ? 'text-income' : 'text-expense'}`}
                enablePrivacy
              />
              <p className="text-sm text-muted-foreground mt-2">
                {daysLeft} días restantes · Cuotas: <CurrencyDisplay amount={cardsCommitted} currency="ARS" size="sm" className="inline" /> · Fijos: <CurrencyDisplay amount={recurringCommitted} currency="ARS" size="sm" className="inline" />
              </p>
            </CardContent>
          </Card>

          {/* === FILA: FLUJO DEL MES + PRÓXIMAS OBLIGACIONES === */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Flujo del mes */}
            <Card className="border-border/50">
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-semibold text-sm">Flujo del Mes</h3>
                  <HelpTooltip text="Ingresos y egresos reales (de caja) de este mes." />
                </div>
                <div className="flex justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Ingresos</p>
                    <p className="text-income font-bold">
                      +<CurrencyDisplay amount={monthIncome} currency="ARS" size="md" className="inline" enablePrivacy />
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Egresos</p>
                    <p className="text-expense font-bold">
                      -<CurrencyDisplay amount={monthExpense} currency="ARS" size="md" className="inline" enablePrivacy />
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Próximas obligaciones */}
            <Card className="border-border/50">
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm">Próximas Obligaciones</h3>
                  </div>
                </div>
                {upcomingObligations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin obligaciones próximas.</p>
                ) : (
                  <div className="space-y-2">
                    {upcomingObligations.map((ob, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{ob.name}</p>
                          <p className="text-xs text-muted-foreground">{formatRelativeDate(ob.next_due_date)}</p>
                        </div>
                        <CurrencyDisplay amount={Number(ob.amount)} currency={ob.currency as 'ARS' | 'USD'} size="sm" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* === TIRA DE SALUD FINANCIERA === */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Salud Financiera</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KPICard
                title="Runway"
                tooltipText="Cuántos meses podés vivir si tus ingresos paran mañana sin cambiar tu ritmo de gasto. Para alguien con ingresos irregulares (freelance, comisiones), este es el número más importante. Lo recomendable es al menos 3 meses. Lo ideal es 6 o más."
                value={monthExpense > 0 ? liquidez / monthExpense : null}
                format="months"
                state={
                  monthExpense <= 0 ? 'neutral'
                  : liquidez / monthExpense >= 6 ? 'good'
                  : liquidez / monthExpense >= 3 ? 'warning'
                  : 'bad'
                }
                compact
              />
              <KPICard
                title="Tasa de Ahorro"
                tooltipText="Qué porcentaje de tu plata del mes terminás guardando. Por encima de 20% está muy bien, entre 10-20% es bueno, debajo de 10% deberías intentar mejorar. Negativo significa que gastaste más de lo que ganaste."
                value={savingsRate}
                format="percent"
                state={savingsRateState}
                compact
              />
              <KPICard
                title="Carga de Tarjetas"
                tooltipText="Cuánto de tu ingreso mensual está comprometido en cuotas de tarjeta este mes. Por encima de 30% estás financieramente apretado. Por encima de 50% estás en zona de riesgo."
                value={monthIncome > 0 ? cardsCommitted / monthIncome : null}
                format="percent"
                state={
                  monthIncome <= 0 ? 'neutral'
                  : cardsCommitted / monthIncome < 0.15 ? 'good'
                  : cardsCommitted / monthIncome < 0.3 ? 'warning'
                  : 'bad'
                }
                compact
              />
            </div>
          </div>

          {/* === ÚLTIMOS MOVIMIENTOS === */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Últimos Movimientos</h3>
              <Link to="/transactions" className="text-sm text-primary hover:underline flex items-center gap-1">
                Ver todos <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {recentTx.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Sin movimientos"
                description="Registra tu primer ingreso o egreso"
                action={
                  <Link to="/transactions/new">
                    <Button><Plus className="h-4 w-4 mr-2" /> Nuevo movimiento</Button>
                  </Link>
                }
              />
            ) : (
              <div className="space-y-1.5">
                {recentTx.map((tx) => (
                  <Link key={tx.id} to={`/transactions/${tx.id}`}>
                    <Card className="border-border/50 hover:border-primary/50 transition-colors">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className={`rounded-full p-2 shrink-0 ${
                          tx.transaction_type === 'income' ? 'bg-income/10'
                          : tx.transaction_type === 'expense' ? 'bg-expense/10'
                          : 'bg-warning/10'
                        }`}>
                          {tx.transaction_type === 'income' ? (
                            <TrendingUp className="h-4 w-4 text-income" />
                          ) : tx.transaction_type === 'expense' ? (
                            <TrendingDown className="h-4 w-4 text-expense" />
                          ) : (
                            <ArrowRight className="h-4 w-4 text-warning" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {tx.description || 'Sin descripción'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {tx.category?.name || 'Sin categoría'}
                          </p>
                        </div>
                        <CurrencyDisplay
                          amount={Number(tx.amount)}
                          currency={tx.currency}
                          showSign
                          isExpense={tx.transaction_type === 'expense'}
                          size="sm"
                        />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
