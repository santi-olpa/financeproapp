import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowLeftRight, 
  Calendar, 
  CreditCard, 
  Tag, 
  FileText,
  Pencil,
  Trash2
} from 'lucide-react';
import { formatRelativeDate } from '@/lib/format';
import type { Transaction, Account, Category } from '@/types/finance';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type TransactionWithRelations = Transaction & {
  account: Account | null;
  category: Category | null;
  source_account: Account | null;
  destination_account: Account | null;
};

export default function TransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: transaction, isLoading } = useQuery({
    queryKey: ['transaction', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          account:accounts!transactions_account_id_fkey(*),
          category:categories!transactions_category_id_fkey(*),
          source_account:accounts!transactions_source_account_id_fkey(*),
          destination_account:accounts!transactions_destination_account_id_fkey(*)
        `)
        .eq('id', id!)
        .single();
      
      if (error) throw error;
      return data as TransactionWithRelations;
    },
    enabled: !!user && !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!transaction) return;

      // Collect affected account IDs
      const affectedAccountIds = new Set<string>();
      if (transaction.account_id) affectedAccountIds.add(transaction.account_id);
      if (transaction.source_account_id) affectedAccountIds.add(transaction.source_account_id);
      if (transaction.destination_account_id) affectedAccountIds.add(transaction.destination_account_id);

      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id!);
      
      if (error) throw error;

      // Recalculate all affected accounts from DB
      for (const accId of affectedAccountIds) {
        await supabase.rpc('recalculate_account_balance', { p_account_id: accId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({
        title: 'Movimiento eliminado',
        description: 'El movimiento se eliminó correctamente.',
      });
      navigate('/transactions');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar el movimiento.',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
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

  const typeConfig = {
    income: { icon: TrendingUp, label: 'Ingreso', color: 'text-income', bg: 'bg-income/10' },
    expense: { icon: TrendingDown, label: 'Egreso', color: 'text-expense', bg: 'bg-expense/10' },
    transfer: { icon: ArrowLeftRight, label: 'Transferencia', color: 'text-warning', bg: 'bg-warning/10' },
    card_payment: { icon: CreditCard, label: 'Pago de resumen', color: 'text-primary', bg: 'bg-primary/10' },
    adjustment: { icon: ArrowLeftRight, label: 'Ajuste', color: 'text-muted-foreground', bg: 'bg-muted/10' },
  };

  const config = typeConfig[transaction.transaction_type];
  const TypeIcon = config.icon;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader 
        title="Detalle del Movimiento" 
        showBack 
        action={
          <div className="flex gap-2">
            <Link to={`/transactions/${id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </Link>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. El saldo de la cuenta será revertido.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => deleteMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Main Amount Card */}
        <Card className="glass border-border/50">
          <CardContent className="p-6 text-center">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${config.bg}`}>
              <TypeIcon className={`h-8 w-8 ${config.color}`} />
            </div>
            <Badge variant="secondary" className="mb-2">{config.label}</Badge>
            <div className={`text-3xl font-bold ${config.color}`}>
              {transaction.transaction_type === 'expense' ? '- ' : 
               transaction.transaction_type === 'income' ? '+ ' : ''}
              <CurrencyDisplay 
                amount={Number(transaction.amount)} 
                currency={transaction.currency}
                size="lg"
                className="inline"
              />
            </div>
            {transaction.description && (
              <p className="text-muted-foreground mt-2">{transaction.description}</p>
            )}
          </CardContent>
        </Card>

        {/* Details Card */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Detalles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date */}
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fecha</p>
                <p className="font-medium">{formatRelativeDate(transaction.transaction_date)}</p>
              </div>
            </div>

            {/* Account(s) */}
            {transaction.transaction_type === 'transfer' ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cuenta origen</p>
                    <p className="font-medium">{transaction.source_account?.name || 'Sin cuenta'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cuenta destino</p>
                    <p className="font-medium">{transaction.destination_account?.name || 'Sin cuenta'}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cuenta</p>
                  <p className="font-medium">{transaction.account?.name || 'Sin cuenta'}</p>
                </div>
              </div>
            )}

            {/* Category */}
            {transaction.category && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Categoría</p>
                  <p className="font-medium">{transaction.category.name}</p>
                </div>
              </div>
            )}

            {/* Verified */}
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Tag className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                <p className="font-medium">{transaction.is_verified ? 'Verificado' : 'Sin verificar'}</p>
              </div>
            </div>

            {/* Notes */}
            {transaction.notes && (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Notas</p>
                  <p className="font-medium">{transaction.notes}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
