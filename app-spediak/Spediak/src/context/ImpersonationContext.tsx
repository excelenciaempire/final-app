import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ImpersonatedUser {
  clerk_id: string;
  email: string;
  name?: string;
  plan_type?: string;
}

interface ImpersonationContextType {
  isImpersonating: boolean;
  impersonatedUser: ImpersonatedUser | null;
  startImpersonation: (user: ImpersonatedUser) => void;
  endImpersonation: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextType | null>(null);

interface ImpersonationProviderProps {
  children: ReactNode;
}

export const ImpersonationProvider: React.FC<ImpersonationProviderProps> = ({ children }) => {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);

  const startImpersonation = useCallback((user: ImpersonatedUser) => {
    setImpersonatedUser(user);
    setIsImpersonating(true);
    console.log('[Impersonation] Started for user:', user.email);
  }, []);

  const endImpersonation = useCallback(() => {
    console.log('[Impersonation] Ended for user:', impersonatedUser?.email);
    setImpersonatedUser(null);
    setIsImpersonating(false);
  }, [impersonatedUser]);

  return (
    <ImpersonationContext.Provider
      value={{
        isImpersonating,
        impersonatedUser,
        startImpersonation,
        endImpersonation,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
};

export const useImpersonation = () => {
  const context = useContext(ImpersonationContext);
  
  if (!context) {
    // Return a default non-impersonating state if context is not available
    return {
      isImpersonating: false,
      impersonatedUser: null,
      startImpersonation: () => {},
      endImpersonation: () => {},
    };
  }
  
  return context;
};

export default ImpersonationContext;
