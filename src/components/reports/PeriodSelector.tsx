import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getMonthName } from '@/lib/format';

interface PeriodSelectorProps {
  month: number;
  year: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  showMonth?: boolean;
}

export function PeriodSelector({ month, year, onMonthChange, onYearChange, showMonth = true }: PeriodSelectorProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const handlePrev = () => {
    if (showMonth) {
      if (month === 1) {
        onMonthChange(12);
        onYearChange(year - 1);
      } else {
        onMonthChange(month - 1);
      }
    } else {
      onYearChange(year - 1);
    }
  };

  const handleNext = () => {
    if (showMonth) {
      if (month === 12) {
        onMonthChange(1);
        onYearChange(year + 1);
      } else {
        onMonthChange(month + 1);
      }
    } else {
      onYearChange(year + 1);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={handlePrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        
        {showMonth && (
          <Select value={month.toString()} onValueChange={(v) => onMonthChange(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  {getMonthName(i + 1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        <Select value={year.toString()} onValueChange={(v) => onYearChange(parseInt(v))}>
          <SelectTrigger className="w-[90px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y.toString()}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <Button variant="ghost" size="icon" onClick={handleNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
