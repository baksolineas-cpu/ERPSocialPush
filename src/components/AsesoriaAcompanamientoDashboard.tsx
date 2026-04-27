import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  TrendingUp, 
  Target, 
  Calendar,
  Send,
  Video,
  CheckCircle2,
  Clock,
  DollarSign,
  Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { callGAS } from '@/services/apiService';

export default function AsesoriaAcompanamientoDashboard() {
  const paymentInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPaymentFor, setUploadingPaymentFor] = useState<string | null>(null);

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
          // Buscamos info del cliente (aquí asumiendo que el ID es el del lead para simplificar el flujo)
          const res = await callGAS('GET_CLIENTE_STATUS', { clienteId: clientId });
          const clientData = res?.data;
          const folderId = clientData?.id_carpeta_drive || clientData?.idcarpetadrive;
          
          if (!folderId) {
             alert("No se encontró carpeta de Drive. ¿Ya se creó el expediente?");
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

  const kpis = [
    { label: 'Leads Recibidos vs. Contactados', value: '85%', subValue: '210/247', icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Contactados vs. Entrevistas', value: '42%', subValue: '88/210', icon: Target, color: 'text-gold', bg: 'bg-gold/10' },
  ];

  const leads = [
    { id: 'L-101', nombre: 'Juan Pérez', origen: 'Facebook Ads', fecha: '2026-04-25', estatus: 'PENDIENTE' },
    { id: 'L-102', nombre: 'María García', origen: 'WhatsApp', fecha: '2026-04-26', estatus: 'CONTACTADO' },
    { id: 'L-103', nombre: 'Roberto Sánchez', origen: 'Recomendación', fecha: '2026-04-27', estatus: 'CITA_AGENDADA' },
    { id: 'L-104', nombre: 'Elena Mendoza', origen: 'Web Form', fecha: '2026-04-27', estatus: 'PENDIENTE' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0D14] text-white p-8">
      <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-gold">Asesoría & Acompañamiento</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mt-1">Gestión de Leads y Primer Contacto</p>
        </div>
        <button 
          onClick={() => window.open('https://calendar.app.google/xhQAeqCHTCsdgBei6', '_blank')}
          className="bg-gold text-black px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-[0_0_30px_rgba(218,165,32,0.3)] hover:scale-105 transition-all flex items-center gap-3"
        >
          <Calendar size={18} /> Agendar Cita de Valoración
        </button>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column: Leads & KPIs */}
        <div className="xl:col-span-2 space-y-8">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {kpis.map((kpi, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white/5 p-8 rounded-[32px] border border-white/10 shadow-2xl flex items-center gap-6 backdrop-blur-md"
              >
                <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center", kpi.bg)}>
                  <kpi.icon className={kpi.color} size={32} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">{kpi.label}</p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-black text-white">{kpi.value}</span>
                    <span className="text-xs font-bold text-white/20">{kpi.subValue}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Leads Table */}
          <section className="bg-white/5 rounded-[40px] border border-white/10 shadow-2xl overflow-hidden backdrop-blur-md">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gold/10 rounded-2xl flex items-center justify-center text-gold border border-gold/20">
                  <Users size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight italic">Prospectos / Leads Recientes</h3>
                  <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">Seguimiento de Embudo de Ventas</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/5">
                    <th className="px-8 py-5 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Lead / Fecha</th>
                    <th className="px-8 py-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Origen</th>
                    <th className="px-8 py-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Estatus</th>
                    <th className="px-8 py-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {leads.map((lead, i) => (
                    <tr key={i} className="hover:bg-white/10 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-white tracking-widest uppercase">{lead.nombre}</span>
                          <span className="text-[9px] font-bold text-white/30 italic">{lead.fecha}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-[10px] font-black text-white/60 tracking-widest uppercase">{lead.origen}</span>
                      </td>
                      <td className="px-8 py-6">
                        <span className={cn(
                          "text-[9px] font-black uppercase px-3 py-1 rounded-lg border",
                          lead.estatus === 'CITA_AGENDADA' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]" :
                          lead.estatus === 'PENDIENTE' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                          "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        )}>
                          {lead.estatus}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => {
                              setUploadingPaymentFor(lead.id);
                              paymentInputRef.current?.click();
                            }}
                            className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl transition-all"
                            title="Subir Comprobante de Pago Inicial"
                          >
                            <DollarSign size={16} />
                          </button>
                          <button className="bg-white/5 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-gold hover:text-black transition-all shadow-xl">
                            Gestionar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <input type="file" accept=".pdf,image/*" ref={paymentInputRef} onChange={handlePaymentUpload} className="hidden" />
        </div>

        {/* Right Column: Sidebar / Calendar */}
        <div className="space-y-8">
           <section className="bg-white/5 rounded-[40px] border border-white/10 shadow-2xl overflow-hidden backdrop-blur-md h-full min-h-[600px] flex flex-col">
              <div className="p-8 border-b border-white/5 bg-white/5">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-500/20">
                       <Calendar size={24} />
                    </div>
                    <div>
                       <h3 className="text-lg font-black text-white uppercase tracking-tight italic">Disponibilidad</h3>
                       <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">Calendario de Citas Social Push</p>
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
