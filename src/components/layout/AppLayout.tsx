import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { BottomNav } from './BottomNav';
import { MobileHeader } from './MobileHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { AiAssistantModal, ParsedTransaction } from '@/components/ai/AiAssistantModal';
import { AiAssistantButton } from '@/components/ai/AiAssistantButton';

export function AppLayout() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const handleTransactionParsed = (data: ParsedTransaction) => {
    // Navigate to new transaction page with pre-filled data
    navigate('/transactions/new', { 
      state: { 
        aiParsed: true,
        ...data 
      } 
    });
  };

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <MobileHeader />
        <Outlet />
        <BottomNav />
        
        {/* Floating AI Button */}
        <AiAssistantButton 
          variant="floating" 
          onClick={() => setAiModalOpen(true)} 
        />
        
        {/* AI Modal */}
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
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border flex items-center px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <SidebarTrigger className="mr-4" />
          </header>
          <div className="flex-1 overflow-auto">
            <Outlet />
          </div>
        </main>
      </div>
      
      {/* AI Modal */}
      <AiAssistantModal 
        open={aiModalOpen} 
        onOpenChange={setAiModalOpen}
        onTransactionParsed={handleTransactionParsed}
      />
    </SidebarProvider>
  );
}
