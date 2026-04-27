import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileSpreadsheet, 
  Users, 
  Clock, 
  MessageCircle, 
  Download, 
  Plus, 
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  FolderOpen,
  Filter,
  FileText,
  Smartphone,
  Upload,
  X,
  Check,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { callGAS } from '@/services/apiService';
import { Cliente, HojaServicio } from '@/types';

type Tab = 'clientes' | 'pagos_u2' | 'conciliacion';

export default function OperacionesDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('clientes');
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Cliente[]>([]);
  const [hojas, setHojas] = useState<HojaServicio[]>([]);
  const [gestionesU2, setGestionesU2] = useState<any[]>([]);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [promotorFilter, setPromotorFilter] = useState('');
  
  // Modal WhatsApp
  const [showWAModal, setShowWAModal] = useState(false);
  const [selectedClientForWA, setSelectedClientForWA] = useState<any>(null);

  // Conciliación
  const [csvData, setCsvData] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resClients, resHojas, resU2] = await Promise.all([
        callGAS('GET_DATA', { sheetName: 'CLIENTES' }),
        callGAS('GET_DATA', { sheetName: 'HOJAS_SERVICIO' }),
        callGAS('GET_DATA', { sheetName: 'GESTIONES_U2' })
      ]);

      if (resClients?.success) setClients(resClients.data);
      if (resHojas?.success) setHojas(resHojas.data);
      if (resU2?.success) setGestionesU2(resU2.data);
    } catch (err) {
      console.error("Error fetching dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(c => {
    const matchesSearch = (c.nombre + ' ' + c.apellidos).toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPromotor = promotorFilter ? c.promotor === promotorFilter : true;
    return matchesSearch && matchesPromotor;
  });

  const promotores = Array.from(new Set(clients.map(c => c.promotor).filter(Boolean)));

  const handleOpenWA = (client: any) => {
    setSelectedClientForWA(client);
    setShowWAModal(true);
  };

  const sendWAMessage = (option: number) => {
    if (!selectedClientForWA) return;
    const name = selectedClientForWA.nombre;
    const monto = selectedClientForWA.monto || "0";
    let message = "";

    switch(option) {
      case 1:
        message = `Hola ${name}, te informamos que inició el periodo para asegurar tu continuidad en el IMSS. Es importante realizar tu pago a la brevedad para evitar retrasos en tu gestión.`;
        break;
      case 2:
        message = `Hola ${name}, te recordamos que tu pago para tu gestión vence en 2 días. Por favor, realiza el depósito y envíanos tu comprobante para procesar tu trámite.`;
        break;
      case 3:
        message = `Hola ${name}. Te notificamos que, ante el vencimiento inminente y para evitar pérdida de derechos, BAKSO S.C. actuando de buena fe bajo Gestión de Negocios ha realizado el pago de tu cuota. Te agradeceremos reembolsar el monto de $${monto} a la brevedad.`;
        break;
    }

    const phone = selectedClientForWA.whatsapp?.replace(/\D/g, '') || '';
    const url = `https://wa.me/52${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    setShowWAModal(false);
  };

  // Lógica de Conciliación
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseCSV(file);
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const parsed = lines.slice(1).map(line => {
        const parts = line.split(',');
        if (parts.length < 3) return null;
        const [fecha, concepto, monto] = parts;
        return {
          fecha,
          concepto,
          monto: parseFloat(monto),
          sugerencia: findSuggestedClient(concepto),
          match: 85 // Mocked match percentage
        };
      }).filter(Boolean);
      setCsvData(parsed);
    };
    reader.readAsText(file);
  };

  const findSuggestedClient = (concepto: string) => {
    const term = concepto.toUpperCase();
    // Intenta buscar por ID o Nombre
    const match = clients.find(c => {
      const full = (c.apellidos + ' ' + c.nombre).toUpperCase();
      const idMatch = c.id && term.includes(c.id.toUpperCase());
      const nameMatch = term.includes(c.nombre.toUpperCase()) || term.includes(c.apellidos.toUpperCase());
      return idMatch || nameMatch;
    });
    return match ? `${match.nombre} ${match.apellidos}` : 'No Identificado';
  };

  return (
    <div className="min-h-screen bg-[#0A0D14] text-white p-8">
      <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-gold">Dashboard Operativo</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mt-1">Centro de Mando, Gestión & Cobranza</p>
        </div>
        
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 shadow-2xl">
          {(['clientes', 'pagos_u2', 'conciliacion'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === tab ? "bg-gold text-black shadow-[0_0_20px_rgba(218,165,32,0.3)]" : "text-white/40 hover:text-white"
              )}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>
      </header>

      <main>
        {activeTab === 'clientes' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row gap-4 mb-8">
              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold transition-colors" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar por Nombre o ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-gold/20 text-xs font-bold uppercase tracking-widest transition-all"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                <select
                  value={promotorFilter}
                  onChange={(e) => setPromotorFilter(e.target.value)}
                  className="pl-12 pr-10 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-gold/20 text-[10px] font-black uppercase tracking-widest appearance-none cursor-pointer min-w-[200px]"
                >
                  <option value="">Todos los Promotores</option>
                  {promotores.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" size={16} />
              </div>
            </div>

            <section className="bg-white/5 rounded-[32px] border border-white/10 overflow-hidden backdrop-blur-md shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="px-8 py-5 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">ID / Cliente</th>
                      <th className="px-8 py-5 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Universo</th>
                      <th className="px-8 py-5 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Auditoría</th>
                      <th className="px-8 py-5 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Promotor</th>
                      <th className="px-8 py-5 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredClients.map((client) => {
                      const id_carpeta = client.id_carpeta_drive || client.id_carpeta_drive || client.idcarpetadrive || client.id_carpeta_drive;
                      return (
                        <tr key={client.id} className="hover:bg-white/10 transition-colors group">
                          <td className="px-8 py-6">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-white tracking-widest uppercase">{client.nombre} {client.apellidos}</span>
                              <span className="text-[9px] font-bold text-gold/60 mt-0.5 tracking-widest">ID: {client.id}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span className="text-[10px] font-black bg-white/10 text-white px-3 py-1 rounded-lg uppercase tracking-widest">
                              {client.serviciosSeleccionados?.some(s => s.includes('U2')) ? 'MIXTO / U2' : 'U1'}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                client.estadoauditoria === 'ENTREVISTA_CONCLUIDA' ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-amber-500"
                              )} />
                              <span className="text-[9px] font-black uppercase tracking-widest text-white/60">
                                {client.estadoauditoria || 'SIN_ESTADO'}
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest italic">{client.promotor || 'DIRECTO'}</span>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <div className="flex justify-end gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                              {id_carpeta ? (
                                <button 
                                  onClick={() => window.open(`https://drive.google.com/drive/folders/${id_carpeta}`, '_blank')}
                                  className="p-2 hover:bg-white/10 rounded-xl text-blue-400 transition-all hover:scale-110" 
                                  title="Abrir Carpeta Drive"
                                >
                                  <FolderOpen size={18} />
                                </button>
                              ) : <span className="p-2 text-white/10"><FolderOpen size={18} /></span>}
                              
                              {client.contrato_url ? (
                                <button 
                                  onClick={() => window.open(client.contrato_url, '_blank')}
                                  className="p-2 hover:bg-white/10 rounded-xl text-gold transition-all hover:scale-110" 
                                  title="Ver Contrato"
                                >
                                  <FileText size={18} />
                                </button>
                              ) : <span className="p-2 text-white/10"><FileText size={18} /></span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'pagos_u2' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white/5 rounded-[32px] border border-white/10 overflow-hidden backdrop-blur-md shadow-2xl">
               <div className="p-8 border-b border-white/5 flex items-center justify-between">
                 <h2 className="text-xl font-black text-gold italic uppercase tracking-tight">Semáforo de Pagos U2</h2>
                 <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">Estado por Mes: {new Date().toLocaleString('es-MX', { month: 'long', year: 'numeric' })}</p>
               </div>
               
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead>
                     <tr className="bg-white/5 text-white/30 text-[10px] font-black uppercase tracking-widest">
                       <th className="px-8 py-5">Cliente</th>
                       <th className="px-8 py-5">Mes de Gestión</th>
                       <th className="px-8 py-5">Estatus</th>
                       <th className="px-8 py-5">Monto</th>
                       <th className="px-8 py-5 text-right">Notificación</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                     {gestionesU2.length > 0 ? gestionesU2.map((g, i) => {
                       const client = clients.find(c => c.id === g.ClienteID);
                       return (
                         <tr key={i} className="hover:bg-white/10 transition-colors">
                           <td className="px-8 py-6">
                             <div className="flex flex-col">
                               <span className="text-xs font-black text-white uppercase">{client?.nombre || 'Desconocido'} {client?.apellidos || ''}</span>
                               <span className="text-[9px] font-bold text-white/30 tracking-widest">ID: {g.ClienteID}</span>
                             </div>
                           </td>
                           <td className="px-8 py-6">
                             <span className="text-[10px] font-black text-white/60 uppercase">{g.Mes || 'N/A'}</span>
                           </td>
                           <td className="px-8 py-6">
                             <div className={cn(
                               "px-4 py-1.5 rounded-full text-[9px] font-black border text-center w-fit uppercase tracking-widest",
                               g.Estatus === 'ACTIVO' ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-slate-500/20 bg-white/5 text-white/40"
                             )}>
                               {g.Estatus || 'SIN TICKET'}
                             </div>
                           </td>
                           <td className="px-8 py-6">
                             <span className="text-xs font-black text-emerald-400">${Number(g.Honorarios).toLocaleString()}</span>
                           </td>
                           <td className="px-8 py-6 text-right">
                             <button 
                               onClick={() => handleOpenWA({ ...client, monto: g.Honorarios })}
                               className="p-3 bg-[#25D366]/20 text-[#25D366] hover:bg-[#25D366] hover:text-white rounded-2xl transition-all shadow-lg active:scale-95"
                             >
                               <MessageCircle size={20} />
                             </button>
                           </td>
                         </tr>
                       );
                     }) : (
                       <tr>
                         <td colSpan={5} className="py-20 text-center">
                           <div className="flex flex-col items-center gap-3">
                             <div className="p-4 bg-white/5 rounded-full text-white/20">
                               <Smartphone size={32} />
                             </div>
                             <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">No hay gestiones U2 registradas este mes.</p>
                           </div>
                         </td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
            </section>
          </div>
        )}

        {activeTab === 'conciliacion' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div 
              className={cn(
                "h-64 rounded-[40px] border-2 border-dashed flex flex-col items-center justify-center transition-all cursor-pointer group",
                isDragging ? "border-gold bg-gold/10 scale-[0.99]" : "border-white/10 bg-white/5 hover:border-gold/50 hover:bg-white/10"
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) parseCSV(file);
              }}
            >
              <div className="w-16 h-16 bg-white/10 group-hover:bg-gold/20 rounded-[20px] flex items-center justify-center mb-6 transition-colors shadow-2xl">
                <Upload className="text-white/40 group-hover:text-gold" size={32} />
              </div>
              <h3 className="text-lg font-black text-white italic uppercase tracking-tight">Cargar CSV de Banco</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mt-1">Arrastra tu archivo aquí o haz clic para buscar</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept=".csv"
              />
            </div>

            {csvData.length > 0 && (
              <section className="bg-white/5 rounded-[32px] border border-white/10 overflow-hidden shadow-2xl animate-in slide-in-from-top-8 duration-500">
                 <div className="p-8 border-b border-white/5">
                   <h2 className="text-xl font-black text-gold italic uppercase tracking-tight">Revisión Humana Requerida</h2>
                   <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">Resultados del cruce inteligente con base de clientes</p>
                 </div>
                 
                 <div className="overflow-x-auto">
                   <table className="w-full text-left">
                     <thead>
                       <tr className="bg-white/5 text-white/30 text-[10px] font-black uppercase tracking-widest">
                         <th className="px-8 py-5">Fecha</th>
                         <th className="px-8 py-5">Concepto Banco</th>
                         <th className="px-8 py-5">Monto</th>
                         <th className="px-8 py-5">Cliente Sugerido</th>
                         <th className="px-8 py-5 text-center">Match %</th>
                         <th className="px-8 py-5 text-right">Acción</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                        {csvData.map((row, i) => (
                          <tr key={i} className="hover:bg-white/10 transition-colors">
                            <td className="px-8 py-6 text-[11px] font-bold text-white uppercase">{row.fecha}</td>
                            <td className="px-8 py-6">
                               <p className="text-[10px] font-black text-white/80 max-w-[200px] truncate uppercase">{row.concepto}</p>
                            </td>
                            <td className="px-8 py-6">
                               <span className="text-xs font-black text-emerald-400">${row.monto}</span>
                            </td>
                            <td className="px-8 py-6">
                               <div className="flex flex-col">
                                  <span className="text-[10px] font-black text-gold uppercase">{row.sugerencia}</span>
                               </div>
                            </td>
                            <td className="px-8 py-6 text-center">
                               <div className="flex items-center justify-center gap-1.5">
                                  <div className="w-12 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                     <div className="h-full bg-gold shadow-[0_0_10px_rgba(218,165,32,0.5)]" style={{ width: `${row.match}%` }} />
                                  </div>
                                  <span className="text-[9px] font-black text-gold">{row.match}%</span>
                               </div>
                            </td>
                            <td className="px-8 py-6 text-right">
                               <button className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all shadow-lg active:scale-95">Validar Pago</button>
                            </td>
                          </tr>
                        ))}
                     </tbody>
                   </table>
                 </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Modal WhatsApp Reminders */}
      <AnimatePresence>
        {showWAModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#0A0D14]/90 backdrop-blur-sm"
              onClick={() => setShowWAModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              className="relative w-full max-w-xl bg-[#141821] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden p-8"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-xl font-black text-white italic uppercase tracking-tight">Recordatorio de Pago</h3>
                  <p className="text-[10px] text-gold font-black uppercase tracking-widest mt-1">Cliente: {selectedClientForWA?.nombre}</p>
                </div>
                <button onClick={() => setShowWAModal(false)} className="p-2 text-white/20 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={() => sendWAMessage(1)}
                  className="w-full p-6 text-left bg-white/5 border border-white/10 rounded-2xl hover:bg-gold/10 hover:border-gold/30 transition-all group"
                >
                  <p className="text-[10px] font-black text-gold uppercase tracking-widest mb-2 italic">Opción 1: Apertura de Periodo</p>
                  <p className="text-xs text-white/60 leading-relaxed group-hover:text-white">"Hola [Nombre], te informamos que inició el periodo para asegurar tu continuidad en el IMSS..."</p>
                </button>

                <button 
                  onClick={() => sendWAMessage(2)}
                  className="w-full p-6 text-left bg-white/5 border border-white/10 rounded-2xl hover:bg-gold/10 hover:border-gold/30 transition-all group"
                >
                  <p className="text-[10px] font-black text-gold uppercase tracking-widest mb-2 italic">Opción 2: Aviso Próximo (2 días)</p>
                  <p className="text-xs text-white/60 leading-relaxed group-hover:text-white">"Hola [Nombre], te recordamos que tu pago para tu gestión vence en 2 días..."</p>
                </button>

                <button 
                  onClick={() => sendWAMessage(3)}
                  className="w-full p-6 text-left bg-white/5 border border-white/10 rounded-2xl hover:bg-gold/10 hover:border-gold/30 transition-all group"
                >
                  <p className="text-[10px] font-black text-gold uppercase tracking-widest mb-2 italic">Opción 3: Gestión de Negocios (Saldado)</p>
                  <p className="text-xs text-white/60 leading-relaxed group-hover:text-white">"Hola [Nombre]. Te notificamos que, ante el vencimiento inminente y para evitar pérdida de derechos..."</p>
                </button>
              </div>
              
              <p className="text-[9px] text-center text-white/20 font-black uppercase tracking-widest mt-8">El mensaje se abrirá en una nueva ventana de WhatsApp</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {loading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0A0D14]/80 backdrop-blur-xl">
           <div className="flex flex-col items-center gap-6">
              <div className="w-16 h-16 border-4 border-white/5 border-t-gold rounded-full animate-spin shadow-[0_0_30px_rgba(218,165,32,0.3)]"></div>
              <p className="text-[10px] font-black text-gold uppercase tracking-[0.4em] animate-pulse italic">Conectando con Backend...</p>
           </div>
        </div>
      )}
    </div>
  );
}
