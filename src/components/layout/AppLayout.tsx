import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { BottomNav } from './BottomNav';
import { MobileHeader } from './MobileHeader';
import { MobileFAB } from './MobileFAB';
import { useIsMobile } from '@/hooks/use-mobile';
import { AiAssistantModal, ParsedTransaction } from '@/components/ai/AiAssistantModal';

export function AppLayout() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const handleTransactionParsed = (data: ParsedTransaction) => {
    navigate('/transactions/new', {
      state: { aiParsed: true, ...data },
    });
  };

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <MobileHeader />
        <Outlet />
        <BottomNav />

        {/* FAB con opciones: Egreso, Ingreso, Transferencia, Cuotas, Asistente IA */}
        <MobileFAB onAiClick={() => setAiModalOpen(true)} />

        <AiAssistantModal
          open={aiModalOpen}
          onOpenChange={setAiModalOpen}
          onTransactionParsed={handleTransactionParsed}
        />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar onAiAssistantClick={() => setAiModalOpen(true)} />
        <main className="flex-1 min-w-0 overflow-auto">
          <Outlet />
        </main>
      </div>

      <AiAssistantModal
        open={aiModalOpen}
        onOpenChange={setAiModalOpen}
        onTransactionParsed={handleTransactionParsed}
      />
    </SidebarProvider>
  );
}
