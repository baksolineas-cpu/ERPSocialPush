import React, { useState, useEffect, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

export default function ErrorBoundary({ children }: Props) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setError(event.error);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    let errorMessage = "Algo salió mal. Por favor, intenta de nuevo.";
    
    try {
      const firestoreError = JSON.parse(error?.message || "");
      if (firestoreError.error) {
        errorMessage = `Error de Base de Datos: ${firestoreError.error}. Por favor, contacta al soporte técnico.`;
      }
    } catch (e) {
      // Not a JSON error
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900">¡Ups! Ha ocurrido un error</h2>
            <p className="text-slate-500 text-sm">{errorMessage}</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all"
          >
            <RefreshCcw size={18} />
            Recargar Aplicación
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
