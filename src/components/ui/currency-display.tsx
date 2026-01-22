import { cn } from '@/lib/utils';
import { formatCurrency, formatCompactCurrency } from '@/lib/format';
import { Currency } from '@/types/finance';

interface CurrencyDisplayProps {
  amount: number;
  currency: Currency;
  compact?: boolean;
  showSign?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function CurrencyDisplay({
  amount,
  currency,
  compact = false,
  showSign = false,
  size = 'md',
  className,
}: CurrencyDisplayProps) {
  const formatted = compact 
    ? formatCompactCurrency(amount, currency)
    : formatCurrency(amount, currency);

  const isPositive = amount > 0;
  const isNegative = amount < 0;

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl font-semibold',
    xl: 'text-3xl font-bold',
  };

  return (
    <span
      className={cn(
        'font-mono animate-number tabular-nums',
        sizeClasses[size],
        showSign && isPositive && 'text-income',
        showSign && isNegative && 'text-expense',
        className
      )}
    >
      {showSign && isPositive && '+'}
      {formatted}
    </span>
  );
}
