import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  Smartphone,
  Banknote,
  TrendingUp,
  Bitcoin,
  CreditCard,
  PiggyBank,
} from 'lucide-react';
import type { AccountType, AccountSubtype, Currency, Account } from '@/types/finance';
import { ACCOUNT_TYPES, ACCOUNT_SUBTYPE_LABELS } from '@/types/finance';

const accountTypeIcons: Record<AccountType, typeof Building2> = {
  bank: Building2,
  wallet: Smartphone,
  cash: Banknote,
  credit_card: CreditCard,
  savings: PiggyBank,
  investment: TrendingUp,
  crypto: Bitcoin,
};

// Mapeo automático de tipo a subtipo sugerido
const TYPE_TO_SUBTYPE: Record<AccountType, AccountSubtype> = {
  bank: 'operating',
  wallet: 'operating',
  cash: 'operating',
  credit_card: 'liability',
  savings: 'reserve',
  investment: 'investment',
  crypto: 'investment',
};

const COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9',
];

export default function NewAccount() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('bank');
  const [accountSubtype, setAccountSubtype] = useState<AccountSubtype>('operating');
  const [currency, setCurrency] = useState<Currency>('ARS');
  const [initialBalance, setInitialBalance] = useState('0');
  const [alias, setAlias] = useState('');
  const [cbuCvu, setCbuCvu] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  // Campos de tarjeta
  const [closingDay, setClosingDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');

  const isCreditCard = accountType === 'credit_card';

  // Cuentas operativas para selector de "cuenta de pago" de tarjeta
  const { data: operatingAccounts } = useQuery({
    queryKey: ['accounts', 'operating'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, name, currency')
        .eq('is_active', true)
        .in('account_subtype', ['operating']);
      if (error) throw error;
      return data as Pick<Account, 'id' | 'name' | 'currency'>[];
    },
    enabled: !!user && isCreditCard,
  });

  const handleTypeChange = (type: AccountType) => {
    setAccountType(type);
    setAccountSubtype(TYPE_TO_SUBTYPE[type]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const balance = parseFloat(initialBalance) || 0;

      const insertData: Record<string, unknown> = {
        user_id: user!.id,
        name,
        account_type: accountType,
        account_subtype: accountSubtype,
        currency,
        initial_balance: balance,
        current_balance: balance,
        alias: alias || null,
        cbu_cvu: cbuCvu || null,
        color,
        icon: accountType,
      };

      if (isCreditCard) {
        insertData.closing_day = parseInt(closingDay) || null;
        insertData.due_day = parseInt(dueDay) || null;
        insertData.credit_limit = parseFloat(creditLimit) || null;
        insertData.default_payment_account_id = paymentAccountId || null;
        insertData.initial_balance = 0;
        insertData.current_balance = 0;
      }

      const { error } = await supabase.from('accounts').insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: 'Cuenta creada', description: 'Tu nueva cuenta se creó correctamente.' });
      navigate('/accounts');
    },
    onError: (error) => {
      console.error(error);
      toast({ title: 'Error', description: 'No se pudo crear la cuenta.', variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: 'Error', description: 'El nombre es requerido.', variant: 'destructive' });
      return;
    }
    if (isCreditCard && (!closingDay || !dueDay)) {
      toast({ title: 'Error', description: 'Las tarjetas necesitan día de cierre y vencimiento.', variant: 'destructive' });
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Nueva Cuenta" showBack />

      <form onSubmit={handleSubmit} className="p-4 space-y-6 max-w-lg mx-auto">
        {/* Tipo de cuenta */}
        <div className="space-y-3">
          <Label>Tipo de cuenta</Label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {ACCOUNT_TYPES.map(({ type, label }) => {
              const Icon = accountTypeIcons[type];
              const isSelected = accountType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeChange(type)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium text-center">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Subtipo (solo si el mapeo automático no es obvio) */}
        {!isCreditCard && accountType !== 'savings' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Clasificación</Label>
              <HelpTooltip text="Define si esta cuenta cuenta como liquidez disponible, ahorro o inversión. Esto afecta cómo se calculan tus KPIs." />
            </div>
            <Select value={accountSubtype} onValueChange={(v) => setAccountSubtype(v as AccountSubtype)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="operating">{ACCOUNT_SUBTYPE_LABELS.operating}</SelectItem>
                <SelectItem value="reserve">{ACCOUNT_SUBTYPE_LABELS.reserve}</SelectItem>
                <SelectItem value="investment">{ACCOUNT_SUBTYPE_LABELS.investment}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Nombre */}
        <div className="space-y-2">
          <Label htmlFor="name">Nombre de la cuenta</Label>
          <Input
            id="name"
            placeholder={isCreditCard ? 'Ej: Visa Galicia, Amex...' : 'Ej: Santander, Mercado Pago...'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {/* Moneda */}
        <div className="space-y-2">
          <Label>Moneda</Label>
          <div className="grid grid-cols-2 gap-2">
            {(['ARS', 'USD'] as Currency[]).map((cur) => (
              <button
                key={cur}
                type="button"
                onClick={() => setCurrency(cur)}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                  currency === cur
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                }`}
              >
                <span className="text-lg font-bold">{cur === 'ARS' ? '$' : 'US$'}</span>
                <span className="text-sm font-medium">{cur}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Campos de tarjeta de crédito */}
        {isCreditCard && (
          <div className="space-y-4 rounded-lg border border-border p-4 bg-card">
            <p className="text-sm font-medium text-muted-foreground">Datos de la tarjeta</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="closingDay">Día de cierre</Label>
                  <HelpTooltip text="El día del mes en que cierra tu resumen. Las compras después de este día van al mes siguiente." />
                </div>
                <Input
                  id="closingDay"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ej: 15"
                  value={closingDay}
                  onChange={(e) => setClosingDay(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="dueDay">Día de vencimiento</Label>
                  <HelpTooltip text="El día del mes en que vence el pago de tu resumen." />
                </div>
                <Input
                  id="dueDay"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ej: 5"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="creditLimit">Límite de crédito (opcional)</Label>
              <Input
                id="creditLimit"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                className="font-mono"
              />
            </div>

            {operatingAccounts && operatingAccounts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Cuenta de pago por defecto</Label>
                  <HelpTooltip text="Desde qué cuenta se paga el resumen. Podés cambiarlo al momento de pagar." />
                </div>
                <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná una cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {operatingAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} ({acc.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Saldo inicial (no para tarjetas) */}
        {!isCreditCard && (
          <div className="space-y-2">
            <Label htmlFor="balance">Saldo inicial</Label>
            <Input
              id="balance"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              className="text-lg font-mono"
            />
          </div>
        )}

        {/* Alias */}
        <div className="space-y-2">
          <Label htmlFor="alias">Alias (opcional)</Label>
          <Input
            id="alias"
            placeholder="Ej: mi.alias.mp"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
          />
        </div>

        {/* CBU/CVU */}
        {(accountType === 'bank' || accountType === 'wallet') && (
          <div className="space-y-2">
            <Label htmlFor="cbu">CBU/CVU (opcional)</Label>
            <Input
              id="cbu"
              placeholder="0000000000000000000000"
              value={cbuCvu}
              onChange={(e) => setCbuCvu(e.target.value)}
            />
          </div>
        )}

        {/* Color */}
        <div className="space-y-2">
          <Label>Color</Label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition-transform ${
                  color === c ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={createMutation.isPending}>
          {createMutation.isPending ? <LoadingSpinner size="sm" /> : 'Crear cuenta'}
        </Button>
      </form>
    </div>
  );
}
