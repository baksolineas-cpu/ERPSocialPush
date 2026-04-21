import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/types';
import { callGAS, getGASData } from '@/services/apiService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string) => Promise<void>;
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

  const login = async (email: string) => {
    try {
      // Usamos getGASData con la acción LOGIN que ahora devuelve el usuario directamente
      // Esto evita problemas de CORS y latencia entre POST y GET
      const response = await getGASData(`LOGIN&email=${encodeURIComponent(email)}`);
      
      if (response && response.success && response.user) {
        const userData: User = response.user;
        setUser(userData);
        localStorage.setItem('bakso_user', JSON.stringify(userData));
        
        // Registrar log de acceso (esto puede ser asíncrono)
        callGAS('LOG_ACTION', { accion: 'LOGIN', detalles: `Usuario: ${email}` }, email).catch(console.error);
      } else {
        alert(response?.error || "Usuario no autorizado en el sistema.");
      }
    } catch (error) {
      console.error("Error en login:", error);
      alert("Error al validar usuario.");
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
