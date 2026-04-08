import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, MoreVertical, Pencil, Trash2, RefreshCw, CreditCard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Account, AccountSubtype } from '@/types/finance';
import type { LucideIcon } from 'lucide-react';

type AccountGroupSectionProps = {
  title: string;
  tooltip: string;
  icon: LucideIcon;
  accounts: Account[];
  subtype: AccountSubtype;
  onDelete: (id: string) => void;
  onSync: (id: string) => void;
};

export function AccountGroupSection({
  title,
  tooltip,
  icon: Icon,
  accounts,
  subtype,
  onDelete,
  onSync,
}: AccountGroupSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (accounts.length === 0) return null;

  const totalARS = accounts
    .filter(a => a.currency === 'ARS' && a.is_active)
    .reduce((sum, a) => sum + Number(a.current_balance), 0);
  const totalUSD = accounts
    .filter(a => a.currency === 'USD' && a.is_active)
    .reduce((sum, a) => sum + Number(a.current_balance), 0);

  const isCard = subtype === 'liability';

  return (
    <section>
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 mb-4 w-full text-left group"
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
          {title}
        </h3>
        <HelpTooltip text={tooltip} />
        <span className="ml-auto text-xs text-muted-foreground">
          {accounts.length} {accounts.length === 1 ? 'cuenta' : 'cuentas'}
        </span>
      </button>

      {!isCollapsed && (
        <div className="space-y-2">
          {/* Subtotal del grupo */}
          {accounts.length > 1 && (
            <div className="flex items-center gap-4 px-4 py-2 text-sm text-muted-foreground">
              <span>Subtotal:</span>
              {totalARS !== 0 && <CurrencyDisplay amount={totalARS} currency="ARS" size="sm" enablePrivacy />}
              {totalUSD !== 0 && <CurrencyDisplay amount={totalUSD} currency="USD" size="sm" enablePrivacy />}
            </div>
          )}

          {accounts.map((account) => (
            <Card
              key={account.id}
              className={cn(
                'border-border/50 hover:border-primary/50 transition-all',
                isCard && 'border-l-4 border-l-warning',
                !isCard && account.currency === 'USD' && 'border-l-4 border-l-income',
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Info */}
                  <Link
                    to={isCard ? `/cards/${account.id}` : `/accounts/${account.id}`}
                    className="flex-1 min-w-0"
                  >
                    <h4 className="font-medium truncate">{account.name}</h4>
                    <p className="text-sm text-muted-foreground truncate">
                      {isCard
                        ? `Cierre: día ${account.closing_day ?? '—'} · Vto: día ${account.due_day ?? '—'}`
                        : account.alias || account.cbu_cvu
                          ? `${account.alias || ''}${account.cbu_cvu ? ` · CBU: ${account.cbu_cvu.slice(0, 10)}...` : ''}`
                          : 'Sin alias'}
                    </p>
                  </Link>

                  {/* Balance / Deuda */}
                  <div className="text-right shrink-0">
                    <CurrencyDisplay
                      amount={Number(account.current_balance)}
                      currency={account.currency}
                      size="md"
                      enablePrivacy
                    />
                    {isCard && account.credit_limit && (
                      <p className="text-xs text-muted-foreground">
                        Límite: <CurrencyDisplay amount={account.credit_limit} currency={account.currency} size="sm" />
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Sincronizar saldo"
                      onClick={() => onSync(account.id)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
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
                          onClick={() => onDelete(account.id)}
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
          ))}
        </div>
      )}
    </section>
  );
}
