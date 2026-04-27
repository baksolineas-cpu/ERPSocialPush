import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  TrendingUp, 
  Target, 
  Calendar,
  DollarSign,
  Upload,
  Search,
  FolderOpen,
  CheckCircle2,
  Clock,
  X,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { callGAS } from '@/services/apiService';
import { Cliente } from '@/types';

export default function AsesoriaAcompanamientoDashboard() {
  const [clients, setClients] = useState<Cliente[]>([]);
  const [hojas, setHojas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const paymentInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPaymentFor, setUploadingPaymentFor] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [clientsRes, hojasRes] = await Promise.all([
        callGAS('GET_DATA', { sheetName: 'CLIENTES' }),
        callGAS('GET_DATA', { sheetName: 'HOJA_SERVICIO' })
      ]);
      if (clientsRes?.success) setClients(clientsRes.data);
      if (hojasRes?.success) setHojas(hojasRes.data);
    } catch (err) {
      console.error("Error fetching advisory data", err);
    } finally {
      setLoading(false);
    }
  };

  const getClientUniverso = (clientId: string) => {
    const clientHojas = hojas
      .filter((h: any) => h.clienteid === clientId || h.id_cliente === clientId)
      .sort((a: any, b: any) => new Date(b.createdat || 0).getTime() - new Date(a.createdat || 0).getTime());
    
    const universo = clientHojas.length > 0 ? (clientHojas[0].universo || 'U1') : 'U1';
    return universo === 'U2' ? 'Servicios Integrales' : 'Servicios Individuales';
  };

  const handlePaymentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0] && uploadingPaymentFor) {
      const file = e.target.files[0];
      const clientId = uploadingPaymentFor;
      const currentMonth = new Date().toLocaleString('es-MX', { month: 'long' }).toUpperCase();
      const fileName = `PAGO_INICIAL_${currentMonth}_${clientId}.${file.name.split('.').pop()}`;
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        const fileData = event.target?.result as string;
        try {
          const clientFilter = clients.find(c => c.id === clientId);
          const folderId = clientFilter?.id_carpeta_drive || clientFilter?.idcarpetadrive;
          
          if (!folderId) {
             alert("No se encontró carpeta de Drive. Asegúrate de que el expediente esté creado.");
             return;
          }

          const uploadRes = await callGAS('UPLOAD_FILE', {
            id_carpeta_drive: folderId,
            fileName,
            fileData
          });
          
          if (uploadRes?.success) {
            const recordRes = await callGAS('RECORD_PAYMENT', { clienteId: clientId });
            if (recordRes?.success) {
              fetchData();
              alert("Pago registrado y expediente activado exitosamente.");
            }
          }
        } catch (err) {
          console.error("Error uploading payment", err);
        } finally {
          setUploadingPaymentFor(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredClients = clients.filter(c => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${c.nombre} ${c.apellidos}`.toLowerCase();
    return fullName.includes(searchLower) || (c.id && c.id.toLowerCase().includes(searchLower)) || (c.curp && c.curp.toLowerCase().includes(searchLower));
  });

  const getUniversoLabel = (estado: string | undefined) => {
    if (!estado) return 'Por Definir';
    return estado.includes('U2') ? 'Servicios Integrales' : 'Servicios Individuales';
  };

  return (
    <div className="min-h-screen bg-[#0A0D14] text-white p-8">
      <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase text-gold py-2">Asesoría & Acompañamiento Estratégico</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mt-1">Centro de Activación y Seguimiento de Consultoría</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => window.open('https://calendar.app.google/xhQAeqCHTCsdgBei6', '_blank')}
            className="bg-gold text-black px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-[0_0_30px_rgba(218,165,32,0.3)] hover:scale-105 transition-all flex items-center gap-3"
          >
            <Calendar size={18} /> Agendar Cita de Valoración
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          {/* Monitor de Clientes Activos */}
          <section className="bg-white/5 rounded-[40px] border border-white/10 shadow-2xl overflow-hidden backdrop-blur-md">
            <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gold/10 rounded-2xl flex items-center justify-center text-gold border border-gold/20">
                  <Users size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight italic">Monitor de Clientes Activos</h3>
                  <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">Seguimiento de Expedientes y Firmas</p>
                </div>
              </div>
              
              <div className="relative w-full md:w-72 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold transition-colors" size={16} />
                <input 
                  type="text" 
                  placeholder="Buscar cliente..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-gold/50 transition-all text-xs font-bold uppercase tracking-widest"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/5">
                    <th className="px-8 py-5 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Cliente / ID</th>
                    <th className="px-8 py-5 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Tipo de Servicio</th>
                    <th className="px-8 py-5 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Estatus Firma</th>
                    <th className="px-8 py-5 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr><td colSpan={4} className="py-20 text-center text-white/20 animate-pulse font-black uppercase text-xs tracking-widest">Sincronizando expedientes...</td></tr>
                  ) : filteredClients.length > 0 ? (
                      filteredClients.map((client, i) => {
                        const id_carpeta = client.id_carpeta_drive || client.idcarpetadrive;
                        const hasSigned = client.estatusfirma === 'FIRMADO' || (client['estadoauditoría'] || client.estadoauditoria) === 'SERVICIO_ACTIVO';
                        
                        return (
                        <tr key={i} className="hover:bg-white/10 transition-colors">
                          <td className="px-8 py-6">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-white tracking-widest uppercase">{client.nombre} {client.apellidos}</span>
                              <span className="text-[9px] font-bold text-white/30 italic">{client.id || client.curp}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span className="text-[10px] font-black px-3 py-1 bg-white/5 text-white/60 rounded-lg border border-white/10 uppercase tracking-widest">
                              {getClientUniverso(client.id || '')}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2">
                              {hasSigned ? (
                                <>
                                  <CheckCircle2 size={14} className="text-emerald-400" />
                                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest font-mono">
                                    {client.estatusfirma || 'Contrato Firmado'}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Clock size={14} className="text-amber-400" />
                                  <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest font-mono">
                                    {client.estatusfirma || 'Pendiente de Firma'}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <div className="flex justify-end gap-3">
                              {client.estadoauditoria !== 'SERVICIO_ACTIVO' && (
                                <button 
                                  onClick={() => {
                                    setUploadingPaymentFor(client.id || client.curp || '');
                                    paymentInputRef.current?.click();
                                  }}
                                  className="p-2.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black rounded-xl transition-all shadow-xl hover:shadow-emerald-500/20"
                                  title="Activar Contrato (Subir Pago Inicial)"
                                >
                                  <DollarSign size={18} />
                                </button>
                              )}
                              
                              {id_carpeta && (
                                <>
                                  <button 
                                    onClick={() => window.open(`https://drive.google.com/drive/folders/${id_carpeta}`, '_blank')}
                                    className="p-2.5 bg-blue-500/10 text-blue-400 hover:bg-blue-400 hover:text-black rounded-xl transition-all"
                                    title="Abrir Expediente Drive"
                                  >
                                    <FolderOpen size={18} />
                                  </button>
                                  <button 
                                    onClick={() => window.open(`https://drive.google.com/drive/folders/${id_carpeta}`, '_blank')}
                                    className="p-2.5 bg-gold/10 text-gold hover:bg-gold hover:text-black rounded-xl transition-all"
                                    title="Ver Diagnóstico"
                                  >
                                    <FileText size={18} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan={4} className="py-20 text-center text-white/20 font-black uppercase text-xs tracking-widest">No se encontraron clientes activos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <input type="file" accept=".pdf,image/*" ref={paymentInputRef} onChange={handlePaymentUpload} className="hidden" />
        </div>

        {/* Right Column: Sidebar / Calendar */}
        <div className="space-y-8">
           <section className="bg-white/5 rounded-[40px] border border-white/10 shadow-2xl overflow-hidden backdrop-blur-md h-[700px] flex flex-col">
              <div className="p-8 border-b border-white/5 bg-white/5">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-500/20">
                       <Calendar size={24} />
                    </div>
                    <div>
                       <h3 className="text-lg font-black text-white uppercase tracking-tight italic">Citas de Valoración</h3>
                       <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">Calendario Estratégico Social Push</p>
                    </div>
                 </div>
              </div>
              <div className="flex-1 w-full bg-white relative rounded-3xl overflow-hidden">
                 <iframe 
                    src="https://calendar.google.com/calendar/embed?height=600&wkst=1&bgcolor=%23ffffff&ctz=America%2FMexico_City&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&showTz=1&mode=WEEK" 
                    style={{ border: 0 }} 
                    width="100%" 
                    height="100%" 
                    frameBorder="0" 
                    scrolling="no"
                    className="grayscale brightness-90 contrast-125 invert-0 filter-none"
                 />
              </div>
           </section>
        </div>
      </div>
    </div>
  );
}

const Monitor = ({ size, className }: { size: number, className: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <rect width="20" height="14" x="2" y="3" rx="2" />
    <line x1="8" x2="16" y1="21" y2="21" />
    <line x1="12" x2="12" y1="17" y2="21" />
  </svg>
);
