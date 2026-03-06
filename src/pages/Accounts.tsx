import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Plus, 
  Wallet,
  Building2,
  Smartphone,
  Banknote,
  TrendingUp,
  Bitcoin,
  MoreVertical,
  Pencil,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Account, AccountType } from '@/types/finance';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const accountTypeIcons: Record<AccountType, typeof Wallet> = {
  bank: Building2,
  wallet: Smartphone,
  cash: Banknote,
  investment: TrendingUp,
  crypto: Bitcoin,
};

const accountTypeLabels: Record<AccountType, string> = {
  bank: 'Bancos',
  wallet: 'Billeteras Virtuales',
  cash: 'Efectivo',
  investment: 'Inversiones',
  crypto: 'Crypto',
};

export default function Accounts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Account[];
    },
    enabled: !!user,
  });

  const syncAllBalances = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      await supabase.rpc('recalculate_all_account_balances', { p_user_id: user.id });
      await queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({
        title: 'Saldos sincronizados',
        description: 'Todos los saldos fueron recalculados correctamente.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron sincronizar los saldos.',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const syncSingleAccount = async (accountId: string) => {
    try {
      await supabase.rpc('recalculate_account_balance', { p_account_id: accountId });
      await queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: 'Saldo actualizado' });
    } catch {
      toast({ title: 'Error al sincronizar', variant: 'destructive' });
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({
        title: 'Cuenta eliminada',
        description: 'La cuenta se eliminó correctamente.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la cuenta.',
        variant: 'destructive',
      });
    },
  });

  // Group accounts by type
  const groupedAccounts = accounts?.reduce((groups, account) => {
    const type = account.account_type;
    if (!groups[type]) groups[type] = [];
    groups[type].push(account);
    return groups;
  }, {} as Record<AccountType, Account[]>);

  // Calculate totals
  const totalARS = accounts
    ?.filter(a => a.currency === 'ARS' && a.is_active)
    .reduce((sum, a) => sum + Number(a.current_balance), 0) ?? 0;
  
  const totalUSD = accounts
    ?.filter(a => a.currency === 'USD' && a.is_active)
    .reduce((sum, a) => sum + Number(a.current_balance), 0) ?? 0;

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
        <div className="p-4 space-y-6">
          {/* Totales */}
          <Card className="glass border-border/50">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-2">Total disponible</p>
              <div className="space-y-1">
                <CurrencyDisplay amount={totalARS} currency="ARS" size="xl" enablePrivacy />
                {totalUSD > 0 && (
                  <CurrencyDisplay 
                    amount={totalUSD} 
                    currency="USD" 
                    size="lg" 
                    className="block text-muted-foreground" 
                    enablePrivacy
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lista de cuentas */}
          {(!accounts || accounts.length === 0) ? (
            <EmptyState
              icon={Wallet}
              title="Sin cuentas"
              description="Agrega tus cuentas bancarias, billeteras virtuales o efectivo"
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
            <div className="space-y-6">
              {Object.entries(groupedAccounts || {}).map(([type, typeAccounts]) => {
                const Icon = accountTypeIcons[type as AccountType];
                const label = accountTypeLabels[type as AccountType];
                
                return (
                  <div key={type}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</h3>
                    </div>
                    
                    <div className="space-y-2">
                      {typeAccounts.map((account) => (
                        <Card 
                          key={account.id}
                          className="glass border-border/50"
                          style={{ borderLeftColor: account.color || '#6366f1', borderLeftWidth: '3px' }}
                        >
                          <CardContent className="p-4 flex items-center justify-between">
                            <Link to={`/accounts/${account.id}`} className="flex-1">
                              <div>
                                <p className="font-medium text-foreground">{account.name}</p>
                                {account.alias && (
                                  <p className="text-xs text-muted-foreground font-mono">{account.alias}</p>
                                )}
                              </div>
                            </Link>
                            
                            <div className="flex items-center gap-2">
                              <CurrencyDisplay 
                                amount={Number(account.current_balance)} 
                                currency={account.currency}
                                size="md"
                                enablePrivacy
                              />
                              
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem asChild>
                                    <Link to={`/accounts/${account.id}/edit`}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Editar
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => setDeleteId(account.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar cuenta?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminarán también todos los movimientos asociados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteId) deleteMutation.mutate(deleteId);
                  setDeleteId(null);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Desktop Layout - Like HTML template
  return (
    <div className="min-h-screen bg-background">
      <PageHeader 
        title="Mis Cuentas" 
        subtitle="Gestiona tus disponibilidades y saldos iniciales"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-full" onClick={syncAllBalances} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
            <Link to="/accounts/new">
              <Button className="rounded-full">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Cuenta
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-6">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Summary Cards - grid like template */}
          <div className="grid grid-cols-2 gap-6">
            <Card className="glass border-border/50 bg-gradient-to-br from-card to-primary/5">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground mb-2">Patrimonio Neto (ARS)</p>
                <CurrencyDisplay amount={totalARS} currency="ARS" size="xl" className="font-extrabold" enablePrivacy />
              </CardContent>
            </Card>
            <Card className="glass border-border/50 border-l-4 border-l-income">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground mb-2">Patrimonio Neto (USD MEP)</p>
                <CurrencyDisplay amount={totalUSD} currency="USD" size="xl" className="font-extrabold" enablePrivacy />
              </CardContent>
            </Card>
          </div>

          {/* Accounts List by Group */}
          {(!accounts || accounts.length === 0) ? (
            <EmptyState
              icon={Wallet}
              title="Sin cuentas"
              description="Agrega tus cuentas bancarias, billeteras virtuales o efectivo"
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
            <div className="space-y-8">
              {Object.entries(groupedAccounts || {}).map(([type, typeAccounts]) => {
                const Icon = accountTypeIcons[type as AccountType];
                const label = accountTypeLabels[type as AccountType];
                
                return (
                  <div key={type}>
                    <div className="flex items-center gap-2 mb-4">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</h3>
                    </div>
                    
                    <div className="space-y-2">
                      {typeAccounts.map((account) => {
                        const isUSD = account.currency === 'USD';
                        return (
                          <Card 
                            key={account.id}
                            className={`glass border-border/50 hover:border-primary/50 transition-all hover:scale-[1.01] ${
                              isUSD ? 'border-l-4 border-l-income' : ''
                            }`}
                          >
                            <CardContent className="p-4">
                              <div className="grid grid-cols-[50px_2fr_1fr_1fr_150px] items-center gap-4">
                                {/* Icon */}
                                <div className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center">
                                  <Icon className="h-5 w-5 text-primary" />
                                </div>
                                
                                {/* Info */}
                                <Link to={`/accounts/${account.id}`} className="flex-1">
                                  <h4 className="font-medium">{account.name}</h4>
                                  <p className="text-sm text-muted-foreground font-mono">
                                    {account.cbu_cvu ? `CBU: ${account.cbu_cvu.slice(0, 10)}...` : account.alias || 'Sin alias'}
                                  </p>
                                </Link>
                                
                                {/* Balance */}
                                <div className="text-right font-bold pr-8">
                                  <CurrencyDisplay 
                                    amount={Number(account.current_balance)} 
                                    currency={account.currency}
                                    size="md"
                                    enablePrivacy
                                  />
                                </div>
                                
                                {/* USD Equivalent */}
                                <div className="text-sm text-muted-foreground">
                                  {account.currency === 'ARS' ? (
                                    `≈ US$ ${(Number(account.current_balance) / 1200).toFixed(2)}`
                                  ) : (
                                    <span className="text-income">$ {(Number(account.current_balance) * 1200).toLocaleString('es-AR')}</span>
                                  )}
                                </div>
                                
                                {/* Actions */}
                                <div className="flex items-center justify-end gap-2">
                                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" title="Sincronizar Saldo" onClick={() => syncSingleAccount(account.id)}>
                                    <RefreshCw className="h-4 w-4" />
                                  </Button>
                                  <Link to={`/accounts/${account.id}/edit`}>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </Link>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem 
                                        className="text-destructive"
                                        onClick={() => setDeleteId(account.id)}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Eliminar
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán también todos los movimientos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) deleteMutation.mutate(deleteId);
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
