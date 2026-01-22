import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface PrivacyContextType {
  hideAmounts: boolean;
  toggleHideAmounts: () => void;
  isLoading: boolean;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [hideAmounts, setHideAmounts] = useState(true); // Default to hidden
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPreference();
    } else {
      setHideAmounts(true); // Default to hidden when no user
      setIsLoading(false);
    }
  }, [user]);

  const loadPreference = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('hide_amounts')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      // Default to true (hidden) if no preference set
      setHideAmounts(data?.hide_amounts ?? true);
    } catch (error) {
      console.error('Error loading privacy preference:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleHideAmounts = async () => {
    const newValue = !hideAmounts;
    setHideAmounts(newValue);

    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ hide_amounts: newValue })
          .eq('user_id', user.id);
      } catch (error) {
        console.error('Error saving privacy preference:', error);
        setHideAmounts(!newValue); // Revert on error
      }
    }
  };

  return (
    <PrivacyContext.Provider value={{ hideAmounts, toggleHideAmounts, isLoading }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const context = useContext(PrivacyContext);
  if (context === undefined) {
    throw new Error('usePrivacy must be used within a PrivacyProvider');
  }
  return context;
}
