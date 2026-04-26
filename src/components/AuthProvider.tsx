import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/types';
import { callGAS, getGASData } from '@/services/apiService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('bakso_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password?: string) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      // Usamos getGASData con la acción LOGIN pasando params correctamente
      const response = await getGASData('LOGIN', { email: cleanEmail, password: password });
      
      if (response && response.success && response.user) {
        const userData: User = { 
          email: response.user.email, 
          role: response.user.rol || response.user.role, 
          name: response.user.nombre || response.user.name 
        };
        setUser(userData);
        localStorage.setItem('bakso_user', JSON.stringify(userData));
        
        // Registrar log de acceso
        callGAS('LOG_ACTION', { accion: 'LOGIN', detalles: `Usuario: ${cleanEmail}` }, cleanEmail).catch(console.error);
      } else {
        alert(response?.error || `Usuario ${cleanEmail} no autorizado en la base de datos de Social Push`);
      }
    } catch (error: any) {
      console.error("Error en login:", error);
      alert(error?.message || "Error al validar usuario.");
    }
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('bakso_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
