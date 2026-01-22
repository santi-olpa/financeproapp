import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, TrendingUp, TrendingDown, ArrowLeftRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatRelativeDate } from '@/lib/format';
import type { Transaction } from '@/types/finance';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

export default function Transactions() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');

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

  // Group transactions by date
  const groupedTransactions = transactions?.reduce((groups, transaction) => {
    const date = transaction.transaction_date;
    if (!groups[date]) groups[date] = [];
    groups[date].push(transaction);
    return groups;
  }, {} as Record<string, typeof transactions>);

  // Filter by search
  const filteredGroups = search
    ? Object.entries(groupedTransactions || {}).reduce((acc, [date, txs]) => {
        const filtered = txs?.filter(t => 
          t.description?.toLowerCase().includes(search.toLowerCase()) ||
          t.category?.name.toLowerCase().includes(search.toLowerCase()) ||
          t.account?.name.toLowerCase().includes(search.toLowerCase())
        );
        if (filtered && filtered.length > 0) acc[date] = filtered;
        return acc;
      }, {} as Record<string, typeof transactions>)
    : groupedTransactions;

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
        title="Movimientos" 
        subtitle="Ingresos, egresos y transferencias"
        action={
          <Link to="/transactions/new">
            <Button size="icon" className="rounded-full">
              <Plus className="h-5 w-5" />
            </Button>
          </Link>
        }
      />

      <div className="p-4 space-y-4 max-w-lg mx-auto">
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
            {Object.entries(filteredGroups || {}).map(([date, dayTransactions]) => (
              <div key={date}>
                <p className="text-sm font-medium text-muted-foreground mb-2">
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
                                : 'bg-transfer/10'
                            }`}>
                              {transaction.transaction_type === 'income' ? (
                                <TrendingUp className="h-4 w-4 text-income" />
                              ) : transaction.transaction_type === 'expense' ? (
                                <TrendingDown className="h-4 w-4 text-expense" />
                              ) : (
                                <ArrowLeftRight className="h-4 w-4 text-transfer" />
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
                            amount={Number(transaction.amount) * (transaction.transaction_type === 'expense' ? -1 : 1)} 
                            currency={transaction.currency}
                            showSign
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
