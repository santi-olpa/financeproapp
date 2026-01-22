import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
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
} from 'lucide-react';
import type { AccountType, Currency } from '@/types/finance';
import { ACCOUNT_TYPES } from '@/types/finance';

const accountTypeIcons: Record<AccountType, typeof Building2> = {
  bank: Building2,
  wallet: Smartphone,
  cash: Banknote,
  investment: TrendingUp,
  crypto: Bitcoin,
};

const COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#0ea5e9', // sky
];

export default function NewAccount() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('bank');
  const [currency, setCurrency] = useState<Currency>('ARS');
  const [initialBalance, setInitialBalance] = useState('0');
  const [alias, setAlias] = useState('');
  const [cbuCvu, setCbuCvu] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const balance = parseFloat(initialBalance) || 0;
      
      const { error } = await supabase
        .from('accounts')
        .insert({
          user_id: user!.id,
          name,
          account_type: accountType,
          currency,
          initial_balance: balance,
          current_balance: balance,
          alias: alias || null,
          cbu_cvu: cbuCvu || null,
          color,
          icon: accountType,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({
        title: 'Cuenta creada',
        description: 'Tu nueva cuenta se creó correctamente.',
      });
      navigate('/accounts');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'No se pudo crear la cuenta.',
        variant: 'destructive',
      });
      console.error(error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre es requerido.',
        variant: 'destructive',
      });
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
          <div className="grid grid-cols-3 gap-2">
            {ACCOUNT_TYPES.map(({ type, label }) => {
              const Icon = accountTypeIcons[type];
              const isSelected = accountType === type;
              
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAccountType(type)}
                  className={`
                    flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors
                    ${isSelected 
                      ? 'border-primary bg-primary/10 text-primary' 
                      : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium text-center">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nombre */}
        <div className="space-y-2">
          <Label htmlFor="name">Nombre de la cuenta</Label>
          <Input
            id="name"
            placeholder="Ej: Santander, Mercado Pago, Efectivo casa..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {/* Moneda */}
        <div className="space-y-2">
          <Label>Moneda</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCurrency('ARS')}
              className={`
                flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors
                ${currency === 'ARS' 
                  ? 'border-primary bg-primary/10 text-primary' 
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                }
              `}
            >
              <span className="text-lg font-bold">$</span>
              <span className="text-sm font-medium">ARS</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrency('USD')}
              className={`
                flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors
                ${currency === 'USD' 
                  ? 'border-primary bg-primary/10 text-primary' 
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                }
              `}
            >
              <span className="text-lg font-bold">US$</span>
              <span className="text-sm font-medium">USD</span>
            </button>
          </div>
        </div>

        {/* Saldo inicial */}
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

        {/* Alias (opcional) */}
        <div className="space-y-2">
          <Label htmlFor="alias">Alias (opcional)</Label>
          <Input
            id="alias"
            placeholder="Ej: mi.alias.mp"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
          />
        </div>

        {/* CBU/CVU (opcional) */}
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
                className={`
                  w-8 h-8 rounded-full transition-transform
                  ${color === c ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110' : ''}
                `}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full" 
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? <LoadingSpinner size="sm" /> : 'Crear cuenta'}
        </Button>
      </form>
    </div>
  );
}
