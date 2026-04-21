import React, { createContext, useContext, useState } from 'react';

interface CaseContextType {
  currentCase: any;
  setCurrentCase: (data: any) => void;
}

const CaseContext = createContext<CaseContextType | undefined>(undefined);

export const CaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentCase, setCurrentCase] = useState<any>(null);

  return (
    <CaseContext.Provider value={{ currentCase, setCurrentCase }}>
      {children}
    </CaseContext.Provider>
  );
};

export const useCase = () => {
  const context = useContext(CaseContext);
  if (context === undefined) {
    throw new Error('useCase must be used within a CaseProvider');
  }
  return context;
};
