import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TrendingUp, TrendingDown, ArrowLeftRight } from 'lucide-react';
import type { TransactionType, Currency, Account, Category, Transaction } from '@/types/finance';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type TransactionWithRelations = Transaction & {
  account: Account | null;
  category: Category | null;
};

export default function EditTransaction() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [transactionType, setTransactionType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('ARS');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [notes, setNotes] = useState('');
  const [originalTransaction, setOriginalTransaction] = useState<TransactionWithRelations | null>(null);

  // Fetch transaction
  const { data: transaction, isLoading: loadingTransaction } = useQuery({
    queryKey: ['transaction', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          account:accounts!transactions_account_id_fkey(*),
          category:categories!transactions_category_id_fkey(*)
        `)
        .eq('id', id!)
        .single();
      
      if (error) throw error;
      return data as TransactionWithRelations;
    },
    enabled: !!user && !!id,
  });

  // Populate form when transaction loads
  useEffect(() => {
    if (transaction) {
      setOriginalTransaction(transaction);
      setTransactionType(transaction.transaction_type);
      setAmount(transaction.amount.toString());
      setCurrency(transaction.currency);
      setDescription(transaction.description || '');
      setAccountId(transaction.account_id || '');
      setCategoryId(transaction.category_id || '');
      setSourceAccountId(transaction.source_account_id || '');
      setDestinationAccountId(transaction.destination_account_id || '');
      setTransactionDate(transaction.transaction_date);
      setNotes(transaction.notes || '');
    }
  }, [transaction]);

  // Fetch accounts
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Account[];
    },
    enabled: !!user,
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!user,
  });

  const filteredCategories = categories?.filter(c => 
    transactionType === 'income' ? c.category_type === 'income' : c.category_type === 'expense'
  );

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!originalTransaction) throw new Error('No transaction to update');
      
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Monto inválido');
      }

      const originalAmount = Number(originalTransaction.amount);
      const amountDiff = parsedAmount - originalAmount;

      // Revert original balance changes
      if (originalTransaction.transaction_type === 'income' && originalTransaction.account_id) {
        const account = accounts?.find(a => a.id === originalTransaction.account_id);
        if (account) {
          await supabase
            .from('accounts')
            .update({ current_balance: Number(account.current_balance) - originalAmount })
            .eq('id', originalTransaction.account_id);
        }
      } else if (originalTransaction.transaction_type === 'expense' && originalTransaction.account_id) {
        const account = accounts?.find(a => a.id === originalTransaction.account_id);
        if (account) {
          await supabase
            .from('accounts')
            .update({ current_balance: Number(account.current_balance) + originalAmount })
            .eq('id', originalTransaction.account_id);
        }
      } else if (originalTransaction.transaction_type === 'transfer') {
        if (originalTransaction.source_account_id) {
          const sourceAccount = accounts?.find(a => a.id === originalTransaction.source_account_id);
          if (sourceAccount) {
            await supabase
              .from('accounts')
              .update({ current_balance: Number(sourceAccount.current_balance) + originalAmount })
              .eq('id', originalTransaction.source_account_id);
          }
        }
        if (originalTransaction.destination_account_id) {
          const destAccount = accounts?.find(a => a.id === originalTransaction.destination_account_id);
          if (destAccount) {
            await supabase
              .from('accounts')
              .update({ current_balance: Number(destAccount.current_balance) - originalAmount })
              .eq('id', originalTransaction.destination_account_id);
          }
        }
      }

      // Update transaction
      const updateData: any = {
        transaction_type: transactionType,
        amount: parsedAmount,
        currency,
        description: description || null,
        transaction_date: transactionDate,
        notes: notes || null,
      };

      if (transactionType === 'transfer') {
        updateData.source_account_id = sourceAccountId;
        updateData.destination_account_id = destinationAccountId;
        updateData.account_id = null;
        updateData.category_id = null;
      } else {
        updateData.account_id = accountId;
        updateData.category_id = categoryId || null;
        updateData.source_account_id = null;
        updateData.destination_account_id = null;
      }

      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', id!);
      
      if (error) throw error;

      // Apply new balance changes
      if (transactionType === 'income' && accountId) {
        const account = accounts?.find(a => a.id === accountId);
        if (account) {
          // Need to refetch after previous update
          const { data: refreshedAccount } = await supabase
            .from('accounts')
            .select('current_balance')
            .eq('id', accountId)
            .single();
          
          if (refreshedAccount) {
            await supabase
              .from('accounts')
              .update({ current_balance: Number(refreshedAccount.current_balance) + parsedAmount })
              .eq('id', accountId);
          }
        }
      } else if (transactionType === 'expense' && accountId) {
        const { data: refreshedAccount } = await supabase
          .from('accounts')
          .select('current_balance')
          .eq('id', accountId)
          .single();
        
        if (refreshedAccount) {
          await supabase
            .from('accounts')
            .update({ current_balance: Number(refreshedAccount.current_balance) - parsedAmount })
            .eq('id', accountId);
        }
      } else if (transactionType === 'transfer') {
        if (sourceAccountId) {
          const { data: refreshedSource } = await supabase
            .from('accounts')
            .select('current_balance')
            .eq('id', sourceAccountId)
            .single();
          
          if (refreshedSource) {
            await supabase
              .from('accounts')
              .update({ current_balance: Number(refreshedSource.current_balance) - parsedAmount })
              .eq('id', sourceAccountId);
          }
        }
        if (destinationAccountId) {
          const { data: refreshedDest } = await supabase
            .from('accounts')
            .select('current_balance')
            .eq('id', destinationAccountId)
            .single();
          
          if (refreshedDest) {
            await supabase
              .from('accounts')
              .update({ current_balance: Number(refreshedDest.current_balance) + parsedAmount })
              .eq('id', destinationAccountId);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction', id] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({
        title: 'Movimiento actualizado',
        description: 'Los cambios se guardaron correctamente.',
      });
      navigate(`/transactions/${id}`);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el movimiento.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: 'Error', description: 'Ingresa un monto válido.', variant: 'destructive' });
      return;
    }

    if (transactionType === 'transfer') {
      if (!sourceAccountId || !destinationAccountId) {
        toast({ title: 'Error', description: 'Selecciona las cuentas de origen y destino.', variant: 'destructive' });
        return;
      }
      if (sourceAccountId === destinationAccountId) {
        toast({ title: 'Error', description: 'Las cuentas deben ser diferentes.', variant: 'destructive' });
        return;
      }
    } else {
      if (!accountId) {
        toast({ title: 'Error', description: 'Selecciona una cuenta.', variant: 'destructive' });
        return;
      }
    }

    updateMutation.mutate();
  };

  if (loadingTransaction) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Movimiento no encontrado" showBack />
        <div className="p-4 text-center text-muted-foreground">
          El movimiento que buscas no existe o fue eliminado.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Editar Movimiento" showBack />

      <form onSubmit={handleSubmit} className="p-4 space-y-6 max-w-lg mx-auto">
        {/* Tipo de transacción */}
        <Tabs value={transactionType} onValueChange={(v) => setTransactionType(v as TransactionType)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="expense" className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Egreso
            </TabsTrigger>
            <TabsTrigger value="income" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Ingreso
            </TabsTrigger>
            <TabsTrigger value="transfer" className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              Transf.
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Monto */}
        <div className="space-y-2">
          <Label>Monto</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-2xl font-mono h-14"
                required
              />
            </div>
            <div className="flex">
              <button
                type="button"
                onClick={() => setCurrency('ARS')}
                className={`px-4 rounded-l-lg border transition-colors ${
                  currency === 'ARS' 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-card border-border text-muted-foreground'
                }`}
              >
                ARS
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`px-4 rounded-r-lg border-y border-r transition-colors ${
                  currency === 'USD' 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-card border-border text-muted-foreground'
                }`}
              >
                USD
              </button>
            </div>
          </div>
        </div>

        {/* Cuenta(s) */}
        {transactionType === 'transfer' ? (
          <>
            <div className="space-y-2">
              <Label>Cuenta origen</Label>
              <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cuenta destino</Label>
              <Select value={destinationAccountId} onValueChange={setDestinationAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label>Cuenta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cuenta" />
              </SelectTrigger>
              <SelectContent>
                {accounts?.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Categoría */}
        {transactionType !== 'transfer' && (
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar categoría" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Descripción */}
        <div className="space-y-2">
          <Label>Descripción (opcional)</Label>
          <Input
            placeholder="Ej: Supermercado, Sueldo, etc."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Fecha */}
        <div className="space-y-2">
          <Label>Fecha</Label>
          <Input
            type="date"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
          />
        </div>

        {/* Notas */}
        <div className="space-y-2">
          <Label>Notas (opcional)</Label>
          <Input
            placeholder="Notas adicionales..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Submit */}
        <Button 
          type="submit" 
          className="w-full" 
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <LoadingSpinner size="sm" className="mr-2" />
          ) : null}
          Guardar cambios
        </Button>
      </form>
    </div>
  );
}
