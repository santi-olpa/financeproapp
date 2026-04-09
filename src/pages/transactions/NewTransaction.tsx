import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, ArrowLeftRight, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { TransactionType, Currency, Account, Category } from '@/types/finance';

type AiParsedState = {
  aiParsed?: boolean;
  amount?: number;
  currency?: Currency;
  type?: TransactionType;
  description?: string | null;
  accountId?: string | null;
  categoryId?: string | null;
  sourceAccountId?: string | null;
  destinationAccountId?: string | null;
};

export default function NewTransaction() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const aiState = (location.state as AiParsedState) || {};
  const urlType = searchParams.get('type') as TransactionType | null;

  const [transactionType, setTransactionType] = useState<TransactionType>(
    aiState.type || urlType || 'expense',
  );
  const [amount, setAmount] = useState(aiState.amount?.toString() || '');
  const [currency, setCurrency] = useState<Currency>(aiState.currency || 'ARS');
  const [description, setDescription] = useState(aiState.description || '');
  const [accountId, setAccountId] = useState(aiState.accountId || '');
  const [categoryId, setCategoryId] = useState(aiState.categoryId || '');
  const [sourceAccountId, setSourceAccountId] = useState(aiState.sourceAccountId || '');
  const [destinationAccountId, setDestinationAccountId] = useState(aiState.destinationAccountId || '');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [prefilledByAi] = useState(aiState.aiParsed || false);

  useEffect(() => {
    if (aiState.aiParsed) {
      window.history.replaceState({}, document.title);
    }
  }, [aiState.aiParsed]);

  const { data: accounts } = useQuery({
    queryKey: ['accounts', 'active'],
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

  // No mostrar tarjetas como cuentas para ingreso/egreso directo
  const selectableAccounts = accounts?.filter((a) =>
    transactionType === 'transfer' ? true : a.account_type !== 'credit_card',
  );

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('display_order');
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!user,
  });

  const filteredCategories = categories?.filter((c) =>
    transactionType === 'income' ? c.category_type === 'income' : c.category_type === 'expense',
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) throw new Error('Monto inválido');

      const txData: Record<string, unknown> = {
        user_id: user!.id,
        transaction_type: transactionType,
        amount: parsedAmount,
        currency,
        description: description || null,
        transaction_date: transactionDate,
        notes: notes || null,
      };

      if (transactionType === 'transfer') {
        txData.source_account_id = sourceAccountId;
        txData.destination_account_id = destinationAccountId;
      } else {
        txData.account_id = accountId;
        txData.category_id = categoryId || null;
      }

      const { error } = await supabase.from('transactions').insert(txData);
      if (error) throw error;

      // Recalcular saldos
      if (transactionType === 'transfer') {
        if (sourceAccountId) await supabase.rpc('recalculate_account_balance', { p_account_id: sourceAccountId });
        if (destinationAccountId) await supabase.rpc('recalculate_account_balance', { p_account_id: destinationAccountId });
      } else if (accountId) {
        await supabase.rpc('recalculate_account_balance', { p_account_id: accountId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: 'Movimiento registrado' });
      navigate('/transactions');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo guardar el movimiento.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: 'Error', description: 'Ingresá un monto válido.', variant: 'destructive' });
      return;
    }
    if (transactionType === 'transfer') {
      if (!sourceAccountId || !destinationAccountId) {
        toast({ title: 'Error', description: 'Seleccioná cuentas de origen y destino.', variant: 'destructive' });
        return;
      }
      if (sourceAccountId === destinationAccountId) {
        toast({ title: 'Error', description: 'Las cuentas deben ser diferentes.', variant: 'destructive' });
        return;
      }
    } else if (!accountId) {
      toast({ title: 'Error', description: 'Seleccioná una cuenta.', variant: 'destructive' });
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Nuevo Movimiento" showBack />

      <form onSubmit={handleSubmit} className="p-4 space-y-6 max-w-lg mx-auto">
        {prefilledByAi && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary">Pre-llenado por el Asistente IA. Verificá y ajustá si es necesario.</span>
            <Badge variant="secondary" className="ml-auto">IA</Badge>
          </div>
        )}

        {/* Tipo */}
        <Tabs value={transactionType} onValueChange={(v) => setTransactionType(v as TransactionType)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="expense" className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" /> Egreso
            </TabsTrigger>
            <TabsTrigger value="income" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Ingreso
            </TabsTrigger>
            <TabsTrigger value="transfer" className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" /> Transf.
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Monto + moneda */}
        <div className="space-y-2">
          <Label>Monto</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-2xl font-mono h-14 flex-1"
              required
            />
            <div className="flex">
              {(['ARS', 'USD'] as Currency[]).map((cur, i) => (
                <button
                  key={cur}
                  type="button"
                  onClick={() => setCurrency(cur)}
                  className={`px-4 border transition-colors ${
                    i === 0 ? 'rounded-l-lg' : 'rounded-r-lg border-l-0'
                  } ${
                    currency === cur
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border text-muted-foreground'
                  }`}
                >
                  {cur}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Cuenta(s) */}
        {transactionType === 'transfer' ? (
          <>
            <div className="space-y-2">
              <Label>Cuenta origen</Label>
              <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {selectableAccounts?.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cuenta destino</Label>
              <Select value={destinationAccountId} onValueChange={setDestinationAccountId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {selectableAccounts?.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label>Cuenta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
              <SelectContent>
                {selectableAccounts?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
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
              <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
              <SelectContent>
                {filteredCategories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
          <Textarea
            placeholder="Notas adicionales..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        <Button type="submit" className="w-full" disabled={createMutation.isPending}>
          {createMutation.isPending ? <LoadingSpinner size="sm" /> : 'Guardar movimiento'}
        </Button>
      </form>
    </div>
  );
}
