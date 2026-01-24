import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  ArrowLeftRight, 
  Search,
  CreditCard,
  Building2,
  MoreVertical
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatRelativeDate } from '@/lib/format';
import type { Transaction } from '@/types/finance';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Transactions() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const isMobile = useIsMobile();

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          account:accounts!transactions_account_id_fkey(name, color),
          category:categories!transactions_category_id_fkey(name, icon, color)
        `)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as (Transaction & { 
        account: { name: string; color: string } | null;
        category: { name: string; icon: string; color: string } | null;
      })[];
    },
    enabled: !!user,
  });

  // Filter by type and search
  const filteredTransactions = transactions?.filter(t => {
    const typeMatch = filterType === 'all' || t.transaction_type === filterType;
    const searchMatch = !search || 
      t.description?.toLowerCase().includes(search.toLowerCase()) ||
      t.category?.name.toLowerCase().includes(search.toLowerCase()) ||
      t.account?.name.toLowerCase().includes(search.toLowerCase());
    return typeMatch && searchMatch;
  });

  // Group transactions by date
  const groupedTransactions = filteredTransactions?.reduce((groups, transaction) => {
    const date = transaction.transaction_date;
    if (!groups[date]) groups[date] = [];
    groups[date].push(transaction);
    return groups;
  }, {} as Record<string, typeof filteredTransactions>);

  if (isLoading) {
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
        <div className="p-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar movimientos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {(!transactions || transactions.length === 0) ? (
            <EmptyState
              icon={ArrowLeftRight}
              title="Sin movimientos"
              description="Registra tu primer ingreso o egreso para comenzar"
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
            <div className="space-y-6">
              {Object.entries(groupedTransactions || {}).map(([date, dayTransactions]) => (
                <div key={date}>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-1">
                    {formatRelativeDate(date)}
                  </p>
                  <div className="space-y-2">
                    {dayTransactions?.map((transaction) => (
                      <Link key={transaction.id} to={`/transactions/${transaction.id}`}>
                        <Card className="glass border-border/50 hover:border-primary/50 transition-colors">
                          <CardContent className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`rounded-full p-2 ${
                                transaction.transaction_type === 'income' 
                                  ? 'bg-income/10' 
                                  : transaction.transaction_type === 'expense'
                                  ? 'bg-expense/10'
                                  : 'bg-warning/10'
                              }`}>
                                {transaction.transaction_type === 'income' ? (
                                  <TrendingUp className="h-4 w-4 text-income" />
                                ) : transaction.transaction_type === 'expense' ? (
                                  <TrendingDown className="h-4 w-4 text-expense" />
                                ) : (
                                  <ArrowLeftRight className="h-4 w-4 text-warning" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {transaction.description || transaction.category?.name || 'Sin descripción'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {transaction.account?.name || 'Sin cuenta'}
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop Layout - Like HTML template
  return (
    <div className="min-h-screen bg-background">
      <PageHeader 
        title="Movimientos" 
        subtitle="Historial completo de tus finanzas"
        action={
          <div className="flex gap-3">
            <Link to="/transactions/new?type=income">
              <Button className="bg-income hover:bg-income/90 text-income-foreground rounded-full">
                <Plus className="h-4 w-4 mr-2" />
                Ingreso
              </Button>
            </Link>
            <Link to="/transactions/new?type=expense">
              <Button className="bg-expense hover:bg-expense/90 text-expense-foreground rounded-full">
                <TrendingDown className="h-4 w-4 mr-2" />
                Egreso
              </Button>
            </Link>
            <Link to="/transactions/new?type=transfer">
              <Button className="bg-warning hover:bg-warning/90 text-warning-foreground rounded-full">
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                Transferencia
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Filters Bar */}
          <Card className="glass border-border/50">
            <CardContent className="p-4 flex justify-between items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar movimientos..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-background"
                />
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant={filterType === 'all' ? 'default' : 'outline'} 
                  size="sm" 
                  className="rounded-full"
                  onClick={() => setFilterType('all')}
                >
                  Todos
                </Button>
                <Button 
                  variant={filterType === 'income' ? 'default' : 'outline'} 
                  size="sm" 
                  className="rounded-full"
                  onClick={() => setFilterType('income')}
                >
                  Ingresos
                </Button>
                <Button 
                  variant={filterType === 'expense' ? 'default' : 'outline'} 
                  size="sm" 
                  className="rounded-full"
                  onClick={() => setFilterType('expense')}
                >
                  Egresos
                </Button>
                <Button 
                  variant={filterType === 'transfer' ? 'default' : 'outline'} 
                  size="sm" 
                  className="rounded-full"
                  onClick={() => setFilterType('transfer')}
                >
                  Transferencias
                </Button>
              </div>
            </CardContent>
          </Card>

          {(!filteredTransactions || filteredTransactions.length === 0) ? (
            <EmptyState
              icon={ArrowLeftRight}
              title="Sin movimientos"
              description="Registra tu primer ingreso o egreso para comenzar"
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
            <div className="space-y-8">
              {Object.entries(groupedTransactions || {}).map(([date, dayTransactions]) => (
                <div key={date}>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4 px-1">
                    {formatRelativeDate(date)}
                  </h3>
                  
                  <div className="space-y-2">
                    {dayTransactions?.map((transaction) => (
                      <Link key={transaction.id} to={`/transactions/${transaction.id}`}>
                        <Card className="glass border-border/50 hover:bg-secondary/30 transition-all hover:translate-x-1">
                          <CardContent className="p-4">
                            <div className="grid grid-cols-[50px_2fr_1fr_150px] items-center gap-4">
                              {/* Icon */}
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
                                  <ArrowLeftRight className="h-5 w-5 text-warning" />
                                )}
                              </div>
                              
                              {/* Main Info */}
                              <div>
                                <h4 className="font-medium flex items-center gap-2">
                                  {transaction.description || 'Sin descripción'}
                                  {transaction.category && (
                                    <Badge variant="secondary" className="text-xs font-normal">
                                      {transaction.category.name}
                                    </Badge>
                                  )}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {transaction.notes || 'Sin notas'}
                                </p>
                              </div>
                              
                              {/* Account */}
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CreditCard className="h-4 w-4" />
                                {transaction.account?.name || 'Sin cuenta'}
                              </div>
                              
                              {/* Amount */}
                              <div className="text-right">
                                <div className={`font-bold ${
                                  transaction.transaction_type === 'expense' ? 'text-expense' :
                                  transaction.transaction_type === 'income' ? 'text-income' :
                                  'text-warning'
                                }`}>
                                  {transaction.transaction_type === 'expense' ? '- ' : 
                                   transaction.transaction_type === 'income' ? '+ ' : ''}
                                  <CurrencyDisplay 
                                    amount={Number(transaction.amount)} 
                                    currency={transaction.currency}
                                    size="md"
                                    className="inline"
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  ≈ US$ {(Number(transaction.amount) / 1200).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
