import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TrendingUp, TrendingDown, ArrowLeftRight, Info, Sparkles } from 'lucide-react';
import type { TransactionType, Currency, Account, Category } from '@/types/finance';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/format';
import { addMonths, format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

// Type for AI-parsed state
interface AiParsedState {
  aiParsed?: boolean;
  amount?: number;
  currency?: Currency;
  type?: TransactionType;
  description?: string | null;
  accountId?: string | null;
  categoryId?: string | null;
  sourceAccountId?: string | null;
  destinationAccountId?: string | null;
}

export default function NewTransaction() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get AI-parsed data from navigation state
  const aiState = (location.state as AiParsedState) || {};

  const [transactionType, setTransactionType] = useState<TransactionType>(aiState.type || 'expense');
  const [amount, setAmount] = useState(aiState.amount?.toString() || '');
  const [currency, setCurrency] = useState<Currency>(aiState.currency || 'ARS');
  const [description, setDescription] = useState(aiState.description || '');
  const [accountId, setAccountId] = useState(aiState.accountId || '');
  const [categoryId, setCategoryId] = useState(aiState.categoryId || '');
  const [sourceAccountId, setSourceAccountId] = useState(aiState.sourceAccountId || '');
  const [destinationAccountId, setDestinationAccountId] = useState(aiState.destinationAccountId || '');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  // Installments state
  const [hasInstallments, setHasInstallments] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState('');
  const [interestRate, setInterestRate] = useState('0');

  // Track if prefilled by AI
  const [prefilledByAi, setPrefilledByAi] = useState(aiState.aiParsed || false);

  // Clear navigation state after reading to prevent re-triggering
  useEffect(() => {
    if (aiState.aiParsed) {
      window.history.replaceState({}, document.title);
    }
  }, [aiState.aiParsed]);

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

  // Calculate installment details
  const installmentDetails = useMemo(() => {
    const parsedAmount = parseFloat(amount) || 0;
    const numInstallments = parseInt(totalInstallments) || 1;
    const interest = parseFloat(interestRate) || 0;
    
    if (parsedAmount <= 0 || numInstallments < 1) return null;
    
    // Total with interest
    const totalWithInterest = parsedAmount * (1 + interest / 100);
    const installmentAmount = totalWithInterest / numInstallments;
    
    return {
      originalAmount: parsedAmount,
      totalWithInterest,
      installmentAmount,
      numInstallments,
      interestAmount: totalWithInterest - parsedAmount,
    };
  }, [amount, totalInstallments, interestRate]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Monto inválido');
      }

      const baseDate = new Date(transactionDate);

      if (hasInstallments && installmentDetails) {
        // Create individual transactions for each installment
        const installmentPromises = [];
        
        for (let i = 0; i < installmentDetails.numInstallments; i++) {
          const dueDate = addMonths(baseDate, i);
          
          const transactionData: any = {
            user_id: user!.id,
            transaction_type: transactionType,
            amount: installmentDetails.installmentAmount,
            currency,
            description: description ? `${description} (${i + 1}/${installmentDetails.numInstallments})` : `Cuota ${i + 1}/${installmentDetails.numInstallments}`,
            transaction_date: format(dueDate, 'yyyy-MM-dd'),
            notes: notes || null,
            has_installments: true,
            total_installments: installmentDetails.numInstallments,
            current_installment: i + 1,
            account_id: accountId,
            category_id: categoryId || null,
          };

          installmentPromises.push(
            supabase.from('transactions').insert(transactionData)
          );
        }

        const results = await Promise.all(installmentPromises);
        const errors = results.filter(r => r.error);
        if (errors.length > 0) throw errors[0].error;

        // Only deduct the first installment from the account
        if (accountId) {
          const account = accounts?.find(a => a.id === accountId);
          if (account) {
            await supabase
              .from('accounts')
              .update({ current_balance: Number(account.current_balance) - installmentDetails.installmentAmount })
              .eq('id', accountId);
          }
        }
      } else {
        // Normal single transaction
        const transactionData: any = {
          user_id: user!.id,
          transaction_type: transactionType,
          amount: parsedAmount,
          currency,
          description: description || null,
          transaction_date: transactionDate,
          notes: notes || null,
          has_installments: false,
        };

        if (transactionType === 'transfer') {
          transactionData.source_account_id = sourceAccountId;
          transactionData.destination_account_id = destinationAccountId;
        } else {
          transactionData.account_id = accountId;
          transactionData.category_id = categoryId || null;
        }

        const { error } = await supabase.from('transactions').insert(transactionData);
        if (error) throw error;

        // Update account balance
        if (transactionType === 'income' && accountId) {
          const account = accounts?.find(a => a.id === accountId);
          if (account) {
            await supabase
              .from('accounts')
              .update({ current_balance: Number(account.current_balance) + parsedAmount })
              .eq('id', accountId);
          }
        } else if (transactionType === 'expense' && accountId) {
          const account = accounts?.find(a => a.id === accountId);
          if (account) {
            await supabase
              .from('accounts')
              .update({ current_balance: Number(account.current_balance) - parsedAmount })
              .eq('id', accountId);
          }
        } else if (transactionType === 'transfer') {
          const sourceAccount = accounts?.find(a => a.id === sourceAccountId);
          const destAccount = accounts?.find(a => a.id === destinationAccountId);
          
          if (sourceAccount) {
            await supabase
              .from('accounts')
              .update({ current_balance: Number(sourceAccount.current_balance) - parsedAmount })
              .eq('id', sourceAccountId);
          }
          if (destAccount) {
            await supabase
              .from('accounts')
              .update({ current_balance: Number(destAccount.current_balance) + parsedAmount })
              .eq('id', destinationAccountId);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({
        title: 'Movimiento registrado',
        description: hasInstallments 
          ? `Se crearon ${installmentDetails?.numInstallments} cuotas correctamente.`
          : 'El movimiento se guardó correctamente.',
      });
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

    createMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Nuevo Movimiento" showBack />

      <form onSubmit={handleSubmit} className="p-4 space-y-6 max-w-lg mx-auto">
        {/* AI Prefilled indicator */}
        {prefilledByAi && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary">
              Pre-llenado por el Asistente IA. Verificá y ajustá si es necesario.
            </span>
            <Badge variant="secondary" className="ml-auto">IA</Badge>
          </div>
        )}

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

        {/* Cuotas (solo para egresos) */}
        {transactionType === 'expense' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="installments"
                checked={hasInstallments}
                onChange={(e) => setHasInstallments(e.target.checked)}
                className="rounded border-border"
              />
              <Label htmlFor="installments">Pago en cuotas</Label>
            </div>
            
            {hasInstallments && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Cantidad de cuotas</Label>
                      <Input
                        type="number"
                        min="2"
                        max="48"
                        placeholder="12"
                        value={totalInstallments}
                        onChange={(e) => setTotalInstallments(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Interés total (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="0"
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  {installmentDetails && installmentDetails.numInstallments > 1 && (
                    <div className="pt-3 border-t border-border/50 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monto original:</span>
                        <span>{formatCurrency(installmentDetails.originalAmount, currency)}</span>
                      </div>
                      {installmentDetails.interestAmount > 0 && (
                        <div className="flex justify-between text-warning">
                          <span>Interés:</span>
                          <span>+{formatCurrency(installmentDetails.interestAmount, currency)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-medium">
                        <span className="text-muted-foreground">Total a pagar:</span>
                        <span>{formatCurrency(installmentDetails.totalWithInterest, currency)}</span>
                      </div>
                      <div className="flex justify-between text-primary font-semibold pt-2 border-t border-border/50">
                        <span>Valor de cada cuota:</span>
                        <span>{formatCurrency(installmentDetails.installmentAmount, currency)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                        <Info className="h-3 w-3" />
                        Se crearán {installmentDetails.numInstallments} movimientos mensuales
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

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

        <Button 
          type="submit" 
          className="w-full" 
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? <LoadingSpinner size="sm" /> : 'Guardar movimiento'}
        </Button>
      </form>
    </div>
  );
}
