import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  Plus,
  ArrowRight,
  DollarSign
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getMonthName, getCurrentPeriod } from '@/lib/format';
import type { Account, Transaction } from '@/types/finance';

export default function Dashboard() {
  const { user } = useAuth();
  const { month, year } = getCurrentPeriod();

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
        .select('*')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: false });
      
      if (error) throw error;
      return data as Transaction[];
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

  return (
    <div className="min-h-screen bg-background">
      <PageHeader 
        title="Finance Pro" 
        subtitle={`${getMonthName(month)} ${year}`}
        action={
          <Link to="/transactions/new">
            <Button size="icon" className="rounded-full">
              <Plus className="h-5 w-5" />
            </Button>
          </Link>
        }
      />

      <div className="p-4 space-y-6 max-w-lg mx-auto">
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
              {monthlyIncomeUSD > 0 && (
                <CurrencyDisplay 
                  amount={monthlyIncomeUSD} 
                  currency="USD" 
                  size="sm"
                  className="block text-muted-foreground mt-1"
                  enablePrivacy
                />
              )}
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
              {monthlyExpenseUSD > 0 && (
                <CurrencyDisplay 
                  amount={monthlyExpenseUSD} 
                  currency="USD" 
                  size="sm"
                  className="block text-muted-foreground mt-1"
                />
              )}
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
              description="Agrega tu primera cuenta para comenzar a registrar movimientos"
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
              {accounts.slice(0, 5).map((account) => (
                <Link 
                  key={account.id} 
                  to={`/accounts/${account.id}`}
                  className="snap-start"
                >
                  <Card 
                    className="glass border-border/50 min-w-[200px] hover:border-primary/50 transition-colors"
                    style={{ borderLeftColor: account.color, borderLeftWidth: '3px' }}
                  >
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-foreground truncate">
                        {account.name}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize mb-2">
                        {account.account_type === 'bank' && 'Cuenta bancaria'}
                        {account.account_type === 'wallet' && 'Billetera virtual'}
                        {account.account_type === 'cash' && 'Efectivo'}
                        {account.account_type === 'investment' && 'Inversiones'}
                        {account.account_type === 'crypto' && 'Crypto'}
                      </p>
                      <CurrencyDisplay 
                        amount={Number(account.current_balance)} 
                        currency={account.currency} 
                        size="md"
                        enablePrivacy
                      />
                    </CardContent>
                  </Card>
                </Link>
              ))}
              
              <Link to="/accounts/new" className="snap-start">
                <Card className="glass border-border/50 border-dashed min-w-[200px] h-full flex items-center justify-center hover:border-primary/50 transition-colors">
                  <CardContent className="p-4 flex flex-col items-center justify-center text-muted-foreground">
                    <Plus className="h-8 w-8 mb-2" />
                    <span className="text-sm">Agregar</span>
                  </CardContent>
                </Card>
              </Link>
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
                <Card key={transaction.id} className="glass border-border/50">
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
                          {new Date(transaction.transaction_date).toLocaleDateString('es-AR')}
                        </p>
                      </div>
                    </div>
                    <CurrencyDisplay 
                      amount={Number(transaction.amount)} 
                      currency={transaction.currency}
                      showSign
                      size="sm"
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
