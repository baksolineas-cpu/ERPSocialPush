import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  FileSpreadsheet, 
  Users, 
  Clock, 
  MessageCircle, 
  Mail, 
  Download, 
  Plus, 
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function OperacionesDashboard() {
  const [universe, setUniverse] = useState<'U1' | 'U2'>('U2');
  
  const clientsU2 = [
    { curp: 'PERJ880101HDFRGN', modalidad: 'Mod 40', corte: 'Día 10', estatus: 'Pagado', nss: '1234567890' },
    { curp: 'GARM900505MDFRGN', modalidad: 'Mod 10', corte: 'Día 12', estatus: 'Pendiente', nss: '0987654321' },
    { curp: 'SANR750303HDFRGN', modalidad: 'Mod 40', corte: 'Día 08', estatus: 'Vencido', nss: '1122334455' },
    { curp: 'MENE820404MDFRGN', modalidad: 'Mod 10', corte: 'Día 14', estatus: 'Pagado', nss: '5544332211' },
  ];

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-navy uppercase tracking-tighter italic">Operaciones & Conciliación</h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Gestión Operativa Universos U1 / U2</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-200 hover:scale-105 transition-all flex items-center gap-2">
            <MessageCircle size={16} /> Disparar Recordatorios
          </button>
        </div>
      </header>

      {/* Universe Selector */}
      <div className="flex bg-slate-200 p-1.5 rounded-[24px] w-fit">
        <button 
          onClick={() => setUniverse('U1')}
          className={cn(
            "px-8 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all",
            universe === 'U1' ? "bg-white text-navy shadow-lg" : "text-slate-500 hover:text-navy"
          )}
        >
          Universo 1 (Única)
        </button>
        <button 
          onClick={() => setUniverse('U2')}
          className={cn(
            "px-8 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all",
            universe === 'U2' ? "bg-white text-navy shadow-lg" : "text-slate-500 hover:text-navy"
          )}
        >
          Universo 2 (Recurrentes)
        </button>
      </div>

      {universe === 'U2' ? (
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* U2 Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="text-sm font-black text-navy italic uppercase tracking-tight">Conciliación Bancaria</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Carga de movimientos mensuales</p>
              </div>
              <button className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-colors">
                <FileSpreadsheet size={16} /> Cargar CSV Bancario
              </button>
            </div>
            
            <div className="bg-navy p-8 rounded-[40px] shadow-2xl flex items-center justify-between text-white">
              <div className="space-y-1">
                <h4 className="text-sm font-black italic uppercase tracking-tight text-gold">Alertas de Pago</h4>
                <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest leading-none">Clientes con corte próximo</p>
              </div>
              <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-navy bg-slate-700 flex items-center justify-center text-[8px] font-black">
                    SP
                  </div>
                ))}
                <div className="w-8 h-8 rounded-full border-2 border-navy bg-gold flex items-center justify-center text-[10px] font-black text-navy">
                  +12
                </div>
              </div>
            </div>
          </div>

          {/* U2 Table */}
          <section className="bg-white rounded-[40px] border border-slate-100 shadow-xl overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-lg font-black text-navy uppercase tracking-tight italic">Tabla Operativa U2</h3>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input 
                  type="text" 
                  placeholder="Buscar CURP o NSS..." 
                  className="pl-12 pr-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest w-64 outline-none focus:ring-2 focus:ring-navy/5"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID / CURP Cliente</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Modalidad</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Corte</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estatus Depósito</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {clientsU2.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-navy">{c.curp}</span>
                          <span className="text-[10px] font-bold text-slate-400">NSS: {c.nss}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                         <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-3 py-1 rounded-lg uppercase">{c.modalidad}</span>
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex items-center gap-2 text-xs font-black text-navy">
                           <Clock size={14} className="text-slate-300" />
                           {c.corte}
                         </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                           {c.estatus === 'Pagado' ? <CheckCircle2 size={14} className="text-emerald-500"/> : <AlertCircle size={14} className="text-amber-500"/>}
                           <span className={cn(
                             "text-[9px] font-black uppercase",
                             c.estatus === 'Pagado' ? "text-emerald-600" : "text-amber-600"
                           )}>
                             {c.estatus}
                           </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button className="text-navy hover:text-gold transition-colors p-2" title="Descargar Líneas de Pago">
                          <Download size={20} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[64px] border border-dashed border-slate-200 animate-in fade-in zoom-in duration-500">
           <div className="w-24 h-24 bg-navy text-white rounded-[32px] flex items-center justify-center mb-6 shadow-2xl">
              <Plus size={48} />
           </div>
           <h3 className="text-2xl font-black text-navy uppercase italic">Módulo Universo 1</h3>
           <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Gestión de trámites por única ocasión</p>
           <button className="mt-8 bg-slate-100 text-slate-600 px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-navy hover:text-white transition-all">Configurar Flujo U1</button>
        </div>
      )}
    </div>
  );
}
