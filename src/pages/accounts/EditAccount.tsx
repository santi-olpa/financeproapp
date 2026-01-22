import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { 
  Building2,
  Smartphone,
  Banknote,
  TrendingUp,
  Bitcoin,
} from 'lucide-react';
import type { AccountType, Account } from '@/types/finance';
import { ACCOUNT_TYPES } from '@/types/finance';

const accountTypeIcons: Record<AccountType, typeof Building2> = {
  bank: Building2,
  wallet: Smartphone,
  cash: Banknote,
  investment: TrendingUp,
  crypto: Bitcoin,
};

const COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9',
];

export default function EditAccount() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('bank');
  const [alias, setAlias] = useState('');
  const [cbuCvu, setCbuCvu] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  const { data: account, isLoading } = useQuery({
    queryKey: ['account', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Account;
    },
    enabled: !!user && !!id,
  });

  useEffect(() => {
    if (account) {
      setName(account.name);
      setAccountType(account.account_type);
      setAlias(account.alias || '');
      setCbuCvu(account.cbu_cvu || '');
      setColor(account.color || COLORS[0]);
    }
  }, [account]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('accounts')
        .update({
          name,
          account_type: accountType,
          alias: alias || null,
          cbu_cvu: cbuCvu || null,
          color,
          icon: accountType,
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account', id] });
      toast({
        title: 'Cuenta actualizada',
        description: 'Los cambios se guardaron correctamente.',
      });
      navigate(`/accounts/${id}`);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la cuenta.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: 'Error', description: 'El nombre es requerido.', variant: 'destructive' });
      return;
    }
    updateMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Editar Cuenta" showBack />

      <form onSubmit={handleSubmit} className="p-4 space-y-6 max-w-lg mx-auto">
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

        <div className="space-y-2">
          <Label htmlFor="name">Nombre de la cuenta</Label>
          <Input
            id="name"
            placeholder="Ej: Santander, Mercado Pago..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="alias">Alias (opcional)</Label>
          <Input
            id="alias"
            placeholder="Ej: mi.alias.mp"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
          />
        </div>

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
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? <LoadingSpinner size="sm" /> : 'Guardar cambios'}
        </Button>
      </form>
    </div>
  );
}
