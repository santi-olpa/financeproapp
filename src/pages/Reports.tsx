import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { BarChart3 } from 'lucide-react';

export default function Reports() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader 
        title="Reportes" 
        subtitle="Análisis de tus finanzas"
      />

      <div className="p-4 max-w-lg mx-auto">
        <EmptyState
          icon={BarChart3}
          title="Próximamente"
          description="Los reportes y gráficos estarán disponibles una vez que tengas movimientos registrados"
        />
      </div>
    </div>
  );
}
