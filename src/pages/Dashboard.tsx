import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { PeriodSelector } from '@/components/reports/PeriodSelector';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  Plus,
  ArrowRight,
  DollarSign,
  Eye,
  Building2,
  Smartphone,
  Banknote,
  Bitcoin
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getMonthName, getCurrentPeriod } from '@/lib/format';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Account, Transaction, AccountType } from '@/types/finance';

const accountTypeIcons: Record<AccountType, typeof Wallet> = {
  bank: Building2,
  wallet: Smartphone,
  cash: Banknote,
  investment: TrendingUp,
  crypto: Bitcoin,
};

export default function Dashboard() {
  const { user } = useAuth();
  const currentPeriod = getCurrentPeriod();
  const [month, setMonth] = useState(currentPeriod.month);
  const [year, setYear] = useState(currentPeriod.year);
  const isMobile = useIsMobile();

  // Fetch accounts
  const { data: accounts, isLoading: loadingAccounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Account[];
    },
    enabled: !!user,
  });

  // Fetch current month transactions
  const { data: transactions, isLoading: loadingTransactions } = useQuery({
    queryKey: ['transactions', month, year],
    queryFn: async () => {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
      
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          category:categories(name, icon, color)
        `)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as (Transaction & { category: { name: string; icon: string; color: string } | null })[];
    },
    enabled: !!user,
  });

  // Calculate summaries
  const totalPatrimonioARS = accounts
    ?.filter(a => a.currency === 'ARS')
    .reduce((sum, a) => sum + Number(a.current_balance), 0) ?? 0;
  
  const totalPatrimonioUSD = accounts
    ?.filter(a => a.currency === 'USD')
    .reduce((sum, a) => sum + Number(a.current_balance), 0) ?? 0;

  const monthlyIncomeARS = transactions
    ?.filter(t => t.transaction_type === 'income' && t.currency === 'ARS')
    .reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;

  const monthlyExpenseARS = transactions
    ?.filter(t => t.transaction_type === 'expense' && t.currency === 'ARS')
    .reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;

  const monthlyIncomeUSD = transactions
    ?.filter(t => t.transaction_type === 'income' && t.currency === 'USD')
    .reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;

  const monthlyExpenseUSD = transactions
    ?.filter(t => t.transaction_type === 'expense' && t.currency === 'USD')
    .reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;

  if (loadingAccounts || loadingTransactions) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-4 space-y-6">
          {/* Period Selector */}
          <div className="flex justify-center">
            <PeriodSelector
              month={month}
              year={year}
              onMonthChange={setMonth}
              onYearChange={setYear}
            />
          </div>
          
          {/* Patrimonio Total */}
          <Card className="glass border-border/50 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Patrimonio Total</span>
              </div>
              <div className="space-y-2">
                <CurrencyDisplay 
                  amount={totalPatrimonioARS} 
                  currency="ARS" 
                  size="xl"
                  className="block"
                  enablePrivacy
                />
                {totalPatrimonioUSD > 0 && (
                  <CurrencyDisplay 
                    amount={totalPatrimonioUSD} 
                    currency="USD" 
                    size="lg"
                    className="block text-muted-foreground"
                    enablePrivacy
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Resumen del Mes */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="glass border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="rounded-full bg-income/10 p-1.5">
                    <TrendingUp className="h-4 w-4 text-income" />
                  </div>
                  <span className="text-xs text-muted-foreground">Ingresos</span>
                </div>
                <CurrencyDisplay 
                  amount={monthlyIncomeARS} 
                  currency="ARS" 
                  size="lg"
                  className="text-income"
                  enablePrivacy
                />
              </CardContent>
            </Card>

            <Card className="glass border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="rounded-full bg-expense/10 p-1.5">
                    <TrendingDown className="h-4 w-4 text-expense" />
                  </div>
                  <span className="text-xs text-muted-foreground">Egresos</span>
                </div>
                <CurrencyDisplay 
                  amount={monthlyExpenseARS} 
                  currency="ARS" 
                  size="lg"
                  className="text-expense"
                />
              </CardContent>
            </Card>
          </div>

          {/* Cuentas / Bolsillos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground">Tus Bolsillos</h2>
              <Link to="/accounts" className="text-sm text-primary flex items-center gap-1">
                Ver todos <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {(!accounts || accounts.length === 0) ? (
              <EmptyState
                icon={Wallet}
                title="Sin cuentas"
                description="Agrega tu primera cuenta para comenzar"
                action={
                  <Link to="/accounts/new">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar cuenta
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
                {accounts.slice(0, 5).map((account) => {
                  const Icon = accountTypeIcons[account.account_type];
                  return (
                    <Link key={account.id} to={`/accounts/${account.id}`} className="snap-start">
                      <Card 
                        className="glass border-border/50 min-w-[200px] h-[120px] hover:border-primary/50 transition-all hover:-translate-y-1"
                      >
                        <CardContent className="p-4 flex flex-col justify-between h-full">
                          <div>
                            <Icon className="h-5 w-5 text-primary mb-1" />
                            <p className="text-sm text-muted-foreground truncate">{account.name}</p>
                          </div>
                          <CurrencyDisplay 
                            amount={Number(account.current_balance)} 
                            currency={account.currency} 
                            size="md"
                            enablePrivacy
                          />
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Últimos movimientos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground">Últimos Movimientos</h2>
              <Link to="/transactions" className="text-sm text-primary flex items-center gap-1">
                Ver todos <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {(!transactions || transactions.length === 0) ? (
              <EmptyState
                icon={TrendingUp}
                title="Sin movimientos"
                description="Registra tu primer ingreso o egreso"
                action={
                  <Link to="/transactions/new">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Nuevo movimiento
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="space-y-2">
                {transactions.slice(0, 5).map((transaction) => (
                  <Link key={transaction.id} to={`/transactions/${transaction.id}`}>
                    <Card className="glass border-border/50 hover:border-primary/50 transition-colors">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`rounded-full p-2 ${
                            transaction.transaction_type === 'income' 
                              ? 'bg-income/10' 
                              : transaction.transaction_type === 'expense'
                              ? 'bg-expense/10'
                              : 'bg-transfer/10'
                          }`}>
                            {transaction.transaction_type === 'income' ? (
                              <TrendingUp className="h-4 w-4 text-income" />
                            ) : transaction.transaction_type === 'expense' ? (
                              <TrendingDown className="h-4 w-4 text-expense" />
                            ) : (
                              <ArrowRight className="h-4 w-4 text-transfer" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {transaction.description || 'Sin descripción'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {transaction.category?.name || 'Sin categoría'}
                            </p>
                          </div>
                        </div>
                        <CurrencyDisplay 
                          amount={Number(transaction.amount)} 
                          currency={transaction.currency}
                          showSign
                          isExpense={transaction.transaction_type === 'expense'}
                          size="sm"
                        />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Desktop Layout - Matching HTML template
  return (
    <div className="min-h-screen bg-background">
      <PageHeader 
        title="Panel General" 
        subtitle="Resumen de tu salud financiera"
        action={
          <div className="flex items-center gap-4">
            <PeriodSelector
              month={month}
              year={year}
              onMonthChange={setMonth}
              onYearChange={setYear}
            />
            {/* Dollar Badge */}
            <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-2xl border border-border text-income">
              <TrendingUp className="h-4 w-4" />
              <span className="font-semibold">MEP $1200</span>
            </div>
            <Link to="/transactions/new">
              <Button size="icon" className="rounded-full">
                <Plus className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Dashboard Grid - 2fr 1fr like template */}
          <div className="grid grid-cols-3 gap-6">
            {/* Health Summary Card - takes 2 cols */}
            <Card className="col-span-2 glass border-border/50 bg-gradient-to-br from-card to-primary/5">
              <CardContent className="p-8 flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Patrimonio Neto Total</p>
                  <div className="flex items-center gap-3">
                    <CurrencyDisplay 
                      amount={totalPatrimonioARS} 
                      currency="ARS" 
                      size="xl"
                      className="text-3xl font-extrabold"
                      enablePrivacy
                    />
                    <Eye className="h-5 w-5 text-muted-foreground cursor-pointer hover:text-primary" />
                  </div>
                  {totalPatrimonioUSD > 0 && (
                    <p className="text-muted-foreground mt-2">
                      ≈ <CurrencyDisplay 
                        amount={totalPatrimonioUSD} 
                        currency="USD" 
                        size="md"
                        className="inline"
                        enablePrivacy
                      />
                    </p>
                  )}
                </div>
                
                {/* Budget Semaphore */}
                <div className="text-center">
                  <div className="relative w-20 h-20">
                    <svg className="w-20 h-20 transform -rotate-90">
                      <circle
                        cx="40"
                        cy="40"
                        r="35"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        className="text-muted"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r="35"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={`${70 * 2.2} ${100 * 2.2}`}
                        className="text-income"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center font-bold text-sm">
                      70%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Presupuesto usado</p>
                </div>
              </CardContent>
            </Card>

            {/* Flujo del Mes */}
            <Card className="glass border-border/50">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Flujo del Mes</h3>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Ingresos</p>
                    <p className="text-income font-bold">
                      + <CurrencyDisplay amount={monthlyIncomeARS} currency="ARS" size="md" className="inline" enablePrivacy />
                    </p>
                    {monthlyIncomeUSD > 0 && (
                      <p className="text-xs text-muted-foreground">
                        + <CurrencyDisplay amount={monthlyIncomeUSD} currency="USD" size="sm" className="inline" enablePrivacy />
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Egresos</p>
                    <p className="text-expense font-bold">
                      - <CurrencyDisplay amount={monthlyExpenseARS} currency="ARS" size="md" className="inline" />
                    </p>
                    {monthlyExpenseUSD > 0 && (
                      <p className="text-xs text-muted-foreground">
                        - <CurrencyDisplay amount={monthlyExpenseUSD} currency="USD" size="sm" className="inline" />
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bolsillos Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Tus Bolsillos</h3>
              <Link to="/accounts" className="text-sm text-primary hover:underline">
                Ver todas
              </Link>
            </div>
            
            {(!accounts || accounts.length === 0) ? (
              <EmptyState
                icon={Wallet}
                title="Sin cuentas"
                description="Agrega tus cuentas bancarias, billeteras o efectivo"
                action={
                  <Link to="/accounts/new">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar cuenta
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {accounts.map((account) => {
                  const Icon = accountTypeIcons[account.account_type];
                  const isUSD = account.currency === 'USD';
                  return (
                    <Link key={account.id} to={`/accounts/${account.id}`}>
                      <Card 
                        className={`min-w-[200px] h-[120px] glass border-border/50 hover:-translate-y-1 transition-all cursor-pointer ${
                          isUSD ? 'bg-gradient-to-br from-income/5 to-income/20' : ''
                        }`}
                      >
                        <CardContent className="p-4 flex flex-col justify-between h-full">
                          <div>
                            <Icon className={`h-5 w-5 ${isUSD ? 'text-income' : 'text-primary'} mb-1`} />
                            <p className="text-sm text-muted-foreground">{account.name}</p>
                          </div>
                          <CurrencyDisplay 
                            amount={Number(account.current_balance)} 
                            currency={account.currency}
                            size="md"
                            className="font-bold"
                            enablePrivacy
                          />
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
                <Link to="/accounts/new">
                  <Card className="min-w-[200px] h-[120px] glass border-border/50 border-dashed hover:border-primary/50 transition-all cursor-pointer">
                    <CardContent className="p-4 flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Plus className="h-8 w-8 mb-2" />
                      <span className="text-sm">Agregar</span>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            )}
          </section>

          {/* Últimos Movimientos */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Últimos Movimientos</h3>
              <Link to="/transactions" className="text-sm text-primary hover:underline">
                Ver todos
              </Link>
            </div>

            {(!transactions || transactions.length === 0) ? (
              <EmptyState
                icon={TrendingUp}
                title="Sin movimientos"
                description="Registra tu primer ingreso o egreso"
                action={
                  <Link to="/transactions/new">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Nuevo movimiento
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="space-y-2">
                {transactions.slice(0, 5).map((transaction) => (
                  <Link key={transaction.id} to={`/transactions/${transaction.id}`}>
                    <Card className="glass border-border/50 hover:bg-secondary/30 transition-colors">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center ${
                            transaction.transaction_type === 'income' 
                              ? 'bg-income/10' 
                              : transaction.transaction_type === 'expense'
                              ? 'bg-expense/10'
                              : 'bg-warning/10'
                          }`}>
                            {transaction.transaction_type === 'income' ? (
                              <TrendingUp className="h-5 w-5 text-income" />
                            ) : transaction.transaction_type === 'expense' ? (
                              <TrendingDown className="h-5 w-5 text-expense" />
                            ) : (
                              <ArrowRight className="h-5 w-5 text-warning" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium">{transaction.description || 'Sin descripción'}</h4>
                            <p className="text-sm text-muted-foreground">
                              {transaction.category?.name || 'Sin categoría'}
                            </p>
                          </div>
                        </div>
                        <div className={`font-bold ${
                          transaction.transaction_type === 'expense' ? 'text-expense' : 'text-income'
                        }`}>
                          {transaction.transaction_type === 'expense' ? '- ' : '+ '}
                          <CurrencyDisplay 
                            amount={Number(transaction.amount)} 
                            currency={transaction.currency}
                            size="md"
                            className="inline"
                          />
                        </div>
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
