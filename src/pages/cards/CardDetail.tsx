import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { InstallmentTimeline } from '@/components/cards/InstallmentTimeline';
import { CardStatementCard } from '@/components/cards/CardStatementCard';
import { Badge } from '@/components/ui/badge';
import { Plus, CreditCard, ShoppingBag } from 'lucide-react';
import { getMonthName, formatDate } from '@/lib/format';
import { INSTALLMENT_STATUS_LABELS } from '@/types/finance';
import type { Account, Purchase, Installment } from '@/types/finance';

export default function CardDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Fetch card account
  const { data: card, isLoading: loadingCard } = useQuery({
    queryKey: ['account', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as Account;
    },
    enabled: !!id && !!user,
  });

  // Fetch purchases for this card
  const { data: purchases = [], isLoading: loadingPurchases } = useQuery({
    queryKey: ['purchases', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select('*, category:categories(name, icon, color)')
        .eq('card_account_id', id!)
        .eq('is_cancelled', false)
        .order('purchase_date', { ascending: false });
      if (error) throw error;
      return data as (Purchase & { category: { name: string; icon: string; color: string } | null })[];
    },
    enabled: !!id && !!user,
  });

  // Fetch all installments for this card's purchases
  const { data: installments = [] } = useQuery({
    queryKey: ['installments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installments')
        .select('*, purchase:purchases(description, merchant, card_account_id, installments_count)')
        .eq('user_id', user!.id)
        .order('billing_year')
        .order('billing_month');
      if (error) throw error;
      // Filtrar solo las de esta tarjeta
      return (data as (Installment & { purchase: { description: string; merchant: string | null; card_account_id: string; installments_count: number } })[])
        .filter((i) => i.purchase?.card_account_id === id);
    },
    enabled: !!id && !!user,
  });

  // Total del mes actual
  const currentMonthTotal = useMemo(() => {
    return installments
      .filter((i) => i.billing_year === currentYear && i.billing_month === currentMonth)
      .reduce((sum, i) => sum + Number(i.amount_ars ?? i.amount_original), 0);
  }, [installments, currentYear, currentMonth]);

  // Total deuda pendiente (todas las cuotas no pagas)
  const totalDebt = useMemo(() => {
    return installments
      .filter((i) => i.status === 'pending' || i.status === 'billed')
      .reduce((sum, i) => sum + Number(i.amount_ars ?? i.amount_original), 0);
  }, [installments]);

  // Timeline: próximos 12 meses
  const monthlyTotals = useMemo(() => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      let m = currentMonth + i;
      let y = currentYear;
      while (m > 12) { m -= 12; y += 1; }

      const total = installments
        .filter((inst) => inst.billing_year === y && inst.billing_month === m && inst.status !== 'paid' && inst.status !== 'cancelled')
        .reduce((sum, inst) => sum + Number(inst.amount_ars ?? inst.amount_original), 0);

      months.push({ year: y, month: m, total });
    }
    return months;
  }, [installments, currentYear, currentMonth]);

  // Cuotas del mes actual (para tab "Compras del mes")
  const currentMonthInstallments = useMemo(() => {
    return installments.filter(
      (i) => i.billing_year === currentYear && i.billing_month === currentMonth,
    );
  }, [installments, currentYear, currentMonth]);

  // Compras con cuotas pendientes
  const pendingPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const hasUnpaid = installments.some(
        (i) => i.purchase_id === p.id && (i.status === 'pending' || i.status === 'billed'),
      );
      return hasUnpaid;
    });
  }, [purchases, installments]);

  // Calcular días para vencimiento
  const daysUntilDue = useMemo(() => {
    if (!card?.due_day) return 0;
    const dueDate = new Date(currentYear, currentMonth - 1, card.due_day);
    if (dueDate < now) dueDate.setMonth(dueDate.getMonth() + 1);
    return Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }, [card, currentYear, currentMonth, now]);

  const closingDateStr = card?.closing_day
    ? `${card.closing_day}/${String(currentMonth).padStart(2, '0')}`
    : '—';
  const dueDateStr = card?.due_day
    ? `${card.due_day}/${String(currentMonth).padStart(2, '0')}`
    : '—';

  if (loadingCard || loadingPurchases) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Tarjeta no encontrada" showBack />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={card.name}
        subtitle="Detalle de tarjeta"
        showBack
        action={
          <Link to={`/cards/${id}/purchase/new`}>
            <Button className="rounded-full">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Nueva Compra</span>
            </Button>
          </Link>
        }
      />

      <div className="p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Hero: Resumen del mes */}
          <CardStatementCard
            totalAmount={currentMonthTotal}
            currency={card.currency}
            closingDate={closingDateStr}
            dueDate={dueDateStr}
            periodMonth={currentMonth}
            periodYear={currentYear}
            isPaid={false}
            isEstimated={true}
            daysUntilDue={daysUntilDue}
            onPayClick={() => {/* TODO: modal de pago */}}
          />

          {/* Línea de tiempo */}
          <InstallmentTimeline monthlyTotals={monthlyTotals} currency={card.currency} />

          {/* Tabs */}
          <Tabs defaultValue="current">
            <TabsList className="w-full">
              <TabsTrigger value="current" className="flex-1">Mes actual</TabsTrigger>
              <TabsTrigger value="pending" className="flex-1">Pendientes</TabsTrigger>
            </TabsList>

            <TabsContent value="current" className="mt-4 space-y-2">
              {currentMonthInstallments.length === 0 ? (
                <EmptyState
                  icon={ShoppingBag}
                  title="Sin cuotas este mes"
                  description="No hay compras cargadas para este período"
                  action={
                    <Link to={`/cards/${id}/purchase/new`}>
                      <Button variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Cargar compra
                      </Button>
                    </Link>
                  }
                />
              ) : (
                currentMonthInstallments.map((inst) => (
                  <Card key={inst.id} className="border-border/50">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {inst.purchase?.description ?? 'Compra'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {inst.purchase?.merchant && `${inst.purchase.merchant} · `}
                          Cuota {inst.installment_number} de {inst.purchase?.installments_count ?? '?'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs">
                          {INSTALLMENT_STATUS_LABELS[inst.status]}
                        </Badge>
                        <CurrencyDisplay
                          amount={Number(inst.amount_ars ?? inst.amount_original)}
                          currency={card.currency}
                          size="sm"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="pending" className="mt-4 space-y-2">
              {pendingPurchases.length === 0 ? (
                <EmptyState
                  icon={CreditCard}
                  title="Sin compras pendientes"
                  description="No tenés compras con cuotas por pagar"
                />
              ) : (
                pendingPurchases.map((purchase) => {
                  const purchaseInstallments = installments.filter(
                    (i) => i.purchase_id === purchase.id && (i.status === 'pending' || i.status === 'billed'),
                  );
                  const remainingTotal = purchaseInstallments.reduce(
                    (sum, i) => sum + Number(i.amount_ars ?? i.amount_original),
                    0,
                  );
                  const paidCount = installments.filter(
                    (i) => i.purchase_id === purchase.id && i.status === 'paid',
                  ).length;

                  return (
                    <Card key={purchase.id} className="border-border/50">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{purchase.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {purchase.merchant && `${purchase.merchant} · `}
                              {paidCount}/{purchase.installments_count} cuotas pagadas ·{' '}
                              {formatDate(purchase.purchase_date)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <CurrencyDisplay
                              amount={remainingTotal}
                              currency={purchase.original_currency}
                              size="sm"
                            />
                            <p className="text-xs text-muted-foreground">restante</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>

          {/* Total comprometido */}
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Deuda total con esta tarjeta</span>
                <HelpTooltip text="Suma de todas las cuotas pendientes y por venir. Es lo que debés en total con esta tarjeta." />
              </div>
              <CurrencyDisplay
                amount={totalDebt}
                currency={card.currency}
                size="lg"
                className="font-bold"
                enablePrivacy
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
