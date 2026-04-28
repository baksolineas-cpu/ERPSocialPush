import React, { useState, useEffect } from 'react';
import { callGAS } from '@/services/apiService';
import { Users, BarChart3, ShieldCheck, DollarSign, Briefcase, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from './AuthProvider';

export default function CapitalHumanoDashboard() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [hojas, setHojas] = useState<any[]>([]);
  const [gestionesU2, setGestionesU2] = useState<any[]>([]);
  const [comisionesPagadas, setComisionesPagadas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [uRes, hRes, gRes, cRes] = await Promise.all([
        callGAS('GET_DATA', { sheetName: 'USUARIOS' }),
        callGAS('GET_DATA', { sheetName: 'HOJAS_SERVICIO' }),
        callGAS('GET_DATA', { sheetName: 'GESTIONES_U2' }),
        callGAS('GET_DATA', { sheetName: 'COMISIONES_PAGADAS' })
      ]);
      if (uRes?.success) setUsuarios(uRes.data);
      if (hRes?.success) setHojas(hRes.data);
      if (gRes?.success) setGestionesU2(gRes.data);
      if (cRes?.success) setComisionesPagadas(cRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const calculateComisionesGlobales = () => {
    let totals: { [asesor: string]: { U1: number; U2: number; pagado: number } } = {};

    hojas.forEach((h: any) => {
      const a = h.asesor || 'No Asignado';
      if (!totals[a]) totals[a] = { U1: 0, U2: 0, pagado: 0 };
      const promPago = parseFloat(h.pago_promotor) || 0;
      if (promPago > 0) totals[a].U1 += promPago; // Assuming promotor gets pago_promotor, but let's just show total available
      // Or maybe we just aggregate from the U1 directly for demo
    });

    gestionesU2.forEach((g: any) => {
      // Find asesor using relation? Or just from gestiones that doesn't have asesor directly?
    });

    // To keep it simple globally based on prompt info:
    // Read only table for global commissions
    return totals;
  };

  return (
    <div className="min-h-screen bg-[#0A0D14] text-white p-8">
      <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase text-white pt-2">Capital Humano</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mt-1">Gobernanza y Rendimiento de Personal</p>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold"></div>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Rendimiento General (Tarjetas) */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 shadow-2xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                  <Briefcase className="text-emerald-500" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase text-emerald-400">Rendimiento Operativo U1</h3>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Cartera Individual</p>
                </div>
              </div>
              <div className="text-5xl font-black text-white">{hojas.length} <span className="text-lg text-white/30 truncate">EXPEDIENTES</span></div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 shadow-2xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                  <Activity className="text-blue-500" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase text-blue-400">Rendimiento Consolidado U2</h3>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Cartera Integral</p>
                </div>
              </div>
              <div className="text-5xl font-black text-white">{gestionesU2.length} <span className="text-lg text-white/30">CLIENTES</span></div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Expedientes de Equipo */}
            <section className="bg-white/5 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-white uppercase italic tracking-tight">Expedientes de Equipo</h2>
                  <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-1">Directorio de Usuarios Autorizados</p>
                </div>
                <Users className="text-white/20" size={32} />
              </div>
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-left">
                  <thead className="bg-black/20 sticky top-0">
                    <tr className="text-white/30 text-[10px] font-black uppercase tracking-widest">
                      <th className="px-8 py-5">Nombre / Email</th>
                      <th className="px-8 py-5">Rol / Puesto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {usuarios.length > 0 ? usuarios.map((u, i) => (
                      <tr key={i} className="hover:bg-white/10 transition-colors">
                        <td className="px-8 py-4">
                          <p className="text-sm font-bold text-white">{u.nombre || 'Sin Nombre'}</p>
                          <p className="text-[10px] text-white/50">{u.email}</p>
                        </td>
                        <td className="px-8 py-4">
                          <span className="px-3 py-1 bg-white/10 text-white/80 rounded-lg text-[10px] font-black uppercase">{u.rol || u.role || 'USUARIO'}</span>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={2} className="px-8 py-8 text-center text-white/30 text-sm">No se encontraron registros de equipo</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Auditoría de Comisiones Globales */}
            <section className="bg-white/5 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-gold uppercase italic tracking-tight">Comisiones Consolidadas</h2>
                  <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-1">Histórico de Dispersiones</p>
                </div>
                <DollarSign className="text-gold/20" size={32} />
              </div>
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-left">
                  <thead className="bg-black/20 sticky top-0">
                    <tr className="text-white/30 text-[10px] font-black uppercase tracking-widest">
                      <th className="px-8 py-5">Asesor</th>
                      <th className="px-8 py-5">Mes / Tipo</th>
                      <th className="px-8 py-5 text-right">Monto Pagado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {comisionesPagadas.length > 0 ? comisionesPagadas.map((c, i) => (
                      <tr key={i} className="hover:bg-white/10 transition-colors">
                        <td className="px-8 py-4 text-sm font-bold text-white">{c.id_asesor || c.asesor}</td>
                        <td className="px-8 py-4">
                          <p className="text-[11px] font-black uppercase text-white/70">{c.mes}</p>
                          <p className="text-[9px] text-white/40 uppercase">{c.tipo || 'COMISIÓN'}</p>
                        </td>
                        <td className="px-8 py-4 text-right">
                          <span className="text-sm font-black text-emerald-400">${Number(c.monto || 0).toLocaleString('es-MX', {minimumFractionDigits:2})}</span>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={3} className="px-8 py-8 text-center text-white/30 text-sm">No hay registros de comisiones pagadas</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
