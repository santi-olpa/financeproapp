import { cn } from '@/lib/utils';
import { formatCurrency, formatCompactCurrency } from '@/lib/format';
import { Currency } from '@/types/finance';
import { usePrivacy } from '@/hooks/usePrivacy';
import { Eye, EyeOff } from 'lucide-react';

interface CurrencyDisplayProps {
  amount: number;
  currency: Currency;
  compact?: boolean;
  showSign?: boolean;
  isExpense?: boolean; // Explicitly marks this as expense (will show negative)
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  enablePrivacy?: boolean;
}

export function CurrencyDisplay({
  amount,
  currency,
  compact = false,
  showSign = false,
  isExpense = false,
  size = 'md',
  className,
  enablePrivacy = false,
}: CurrencyDisplayProps) {
  const { hideAmounts, toggleHideAmounts } = usePrivacy();
  
  // For display purposes, if marked as expense, show as negative
  const displayAmount = isExpense ? -Math.abs(amount) : amount;
  
  const formattedAmount = showSign ? Math.abs(displayAmount) : displayAmount;
  const formatted = compact 
    ? formatCompactCurrency(formattedAmount, currency)
    : formatCurrency(formattedAmount, currency);

  const isPositive = displayAmount > 0;
  const isNegative = displayAmount < 0 || isExpense;

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl font-semibold',
    xl: 'text-3xl font-bold',
  };

  const hiddenText = '••••••';

  if (enablePrivacy && hideAmounts) {
    return (
      <span className={cn('inline-flex items-center gap-2', className)}>
        <span
          className={cn(
            'font-mono tabular-nums',
            sizeClasses[size],
          )}
        >
          {hiddenText}
        </span>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleHideAmounts();
          }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Eye className="h-4 w-4" />
        </button>
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        className={cn(
          'font-mono animate-number tabular-nums',
          sizeClasses[size],
        showSign && isPositive && 'text-income',
        showSign && isNegative && 'text-expense',
      )}
    >
      {showSign && isPositive && '+'}
      {showSign && isNegative && '-'}
      {formatted}
      </span>
      {enablePrivacy && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleHideAmounts();
          }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <EyeOff className="h-4 w-4" />
        </button>
      )}
    </span>
  );
}
