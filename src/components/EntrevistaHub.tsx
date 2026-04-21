import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, User, FileText, CheckCircle, AlertCircle, Clock, Trash2,
  Loader2, RefreshCcw, ShieldCheck, ChevronRight, Smartphone,
  ArrowRight, ExternalLink, MapPin, Scale, FileSearch, CheckCircle2,
  Activity, AlertTriangle, RotateCcw, Sparkles, PlusCircle, MessageSquare, Send, Briefcase, FileSignature, Mail, QrCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { cn, calculateDetailedAge } from '@/lib/utils';
import { getGASData, callGAS } from '@/services/apiService';
import { extractDocumentData, getConsultorChatResponse } from '@/services/geminiService';
import { Cliente } from '@/types';

// --- SUB-COMPONENTE: INPUT DE AUDITORÍA PREMIUM ---
function AuditoriaInput({ label, value, isLoading, isLocked, onUnlock, onChange, hasAlert }: any) {
  return (
    <div className="space-y-1.5 group">
      <div className="flex justify-between items-center px-1">
        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">{label}</label>
        {isLocked && <ShieldCheck size={14} className="text-emerald-400" />}
        {hasAlert && <AlertTriangle size={14} className="text-orange-400" />}
      </div>
      <div className="relative">
        {isLoading ? (
          <div className="w-full h-[48px] bg-white/5 rounded-2xl animate-pulse overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite]" />
          </div>
        ) : (
          <>
            <input 
              value={value || ''} 
              onChange={(e) => onChange(e.target.value)}
              readOnly={isLocked}
              placeholder={`Capturar ${label}`}
              className={cn(
                "w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white transition-all outline-none focus:border-[#DAA520]/50",
                isLocked && "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 cursor-not-allowed",
                hasAlert && "border-orange-500/50 bg-orange-500/10"
              )}
            />
            {isLocked && (
              <button type="button" onClick={onUnlock} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/10 rounded-lg text-white/40 hover:text-white transition-all z-10" title="Editar manualmente">
                <RotateCcw size={14}/>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function EntrevistaHub() {
  const [activeStep, setActiveStep] = useState(1);
  const [curpSearch, setCurpSearch] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [foundClients, setFoundClients] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analyzingCount, setAnalyzingCount] = useState(0); 
  const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  
  const activeUploadRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<Partial<Cliente>>({
    estatusfirma: 'PENDIENTE',
    expedienteExistingFiles: {},
    nssList: [],
    ultimoSalario: 0,
    regimenFiscal: '',
    nivelCerteza: 'Bajo',
    semanasExtra: 0,
    metadatosAuditoria: { alertas: [], discrepancias: [] }
  });

  const [hojaServicio, setHojaServicio] = useState({
    universo: 'U1',
    servicios: [] as string[],
    otroServicioTexto: '',
    honorariosAcordados: 0,
    notasDiagnostico: ''
  });

  const [iaContext, setIaContext] = useState('');
  const [isAiDrafting, setIsAiDrafting] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<{ [key: string]: string }>({});

  const updateData = (newData: Partial<Cliente>) => {
    setData(prev => ({ ...prev, ...newData }));
  };

  const handleSearch = async () => {
    const cleanCurp = curpSearch.toUpperCase().replace(/\s+/g, '').trim();
    setIsSearching(true);
    setSearchPerformed(true);
    try {
      if (cleanCurp.length >= 10) {
        const res = await getGASData('GET_CLIENTE_STATUS', { curp: cleanCurp });
        const c = res?.data || res?.cliente;
        if (c) { setFoundClients([c]); return; }
      }
      const res = await getGASData('GET_DATA', { sheetName: 'CLIENTES' });
      const list = res?.data || [];
      const normalize = (s: string) => s?.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() || "";
      const queryTokens = normalize(nameSearch).split(/\s+/);
      
      setFoundClients(list.filter((c: any) => {
        const full = normalize(`${c.nombre || ''} ${c.apellidos || ''}`);
        return queryTokens.every(token => full.includes(token));
      }));
    } finally { setIsSearching(false); }
  };

  const handleNewClient = () => {
    const tempId = `NEW_${Date.now().toString().slice(-6)}`;
    setData({
      id: tempId,
      estatusfirma: 'PENDIENTE',
      expedienteExistingFiles: {},
      nombre: '',
      curp: '',
      rfc: '',
      nss: '',
      nssList: [],
      whatsapp: '',
      email: '',
      semanasCotizadas: 0,
      semanasExtra: 0,
      metadatosAuditoria: { alertas: [], discrepancias: [] }
    });
    setLockedFields(new Set());
    setActiveStep(2);
  };

  const loadClient = async (client: any) => {
    setIsSearching(true);
    try {
      const res = await getGASData('GET_CLIENTE_STATUS', { curp: client.curp || client.id });
      const fresh = res?.data || client;
      const hasData = (v: any) => v && v.toString().trim().length > 5;
      
      setData({ 
        ...fresh, 
        id: fresh.curp || fresh.id, 
        expedienteExistingFiles: {
          ine: hasData(fresh.ine_url),
          csf: hasData(fresh.csf_url),
          domicilio: hasData(fresh.domicilio_url),
          semanas: hasData(fresh.semanas_url),
          afore: hasData(fresh.afore_url),
          complementario: hasData(fresh.complementario_url)
        }
      });
      setActiveStep(2); 
    } finally { setIsSearching(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setAnalyzingCount(prev => prev + 1);
    setUploadingId(type);
    
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      
      try {
        const extracted = await extractDocumentData(base64, file.type, type.toUpperCase());
        
        const updatePayload: any = {
          nombre: extracted.nombre || data.nombre,
          curp: extracted.curp || data.curp,
          rfc: extracted.rfc || data.rfc,
          nss: extracted.nss || data.nss,
          semanasCotizadas: extracted.semanasCotizadas || data.semanasCotizadas,
          ultimoSalario: extracted.ultimoSalario || data.ultimoSalario,
          regimenFiscal: extracted.regimenFiscal || data.regimenFiscal,
          expedienteExistingFiles: { ...data.expedienteExistingFiles, [type]: true }
        };

        if (type === 'complementario') {
          const nuevasAlertas = [...((data.metadatosAuditoria as any)?.alertas || [])];
          if (extracted.domicilio?.includes("Rosa") || extracted.nombre?.includes("HOJA ROSA")) {
            nuevasAlertas.push('💡 Evidencia detectada: Este documento puede sustentar un Trámite de Búsqueda de Semanas Manual');
          }
          updatePayload.metadatosAuditoria = { ...data.metadatosAuditoria, alertas: nuevasAlertas } as any;
          if (extracted.semanasCotizadas > 0) updatePayload.semanasExtra = extracted.semanasCotizadas;
        }

        updateData(updatePayload);
      } catch (ocrError) {
        updateData({ expedienteExistingFiles: { ...data.expedienteExistingFiles, [type]: true } });
      }

      if (data.id?.startsWith('NEW_')) {
        setPendingUploads(prev => ({ ...prev, [type]: base64.split(',')[1] }));
      } else {
        callGAS('UPLOAD_FILE', { 
           fileName: `${type.toUpperCase()}_${data.id}.pdf`, 
           fileData: base64.split(',')[1], 
           id_carpeta_drive: data.id_carpeta_drive || data.idcarpetadrive 
        });
      }
    } finally { 
       setIsProcessing(false); 
       setAnalyzingCount(prev => Math.max(0, prev - 1));
       setUploadingId(null); 
    }
  };

  const handleDeleteFile = async (type: string) => {
    if (!window.confirm(`¿Desechar documento de ${type.toUpperCase()}?`)) return;
    updateData({ expedienteExistingFiles: { ...data.expedienteExistingFiles, [type]: false } });
    if (data.id && !data.id.startsWith('NEW_')) {
      await callGAS('DELETE_FILE', { docType: type, id_carpeta_drive: data.id_carpeta_drive || data.idcarpetadrive });
    }
  };

  const handleSiguientePasoDocs = async () => {
    if (data.id?.startsWith('NEW_')) {
      if (data.curp?.length !== 18) { alert("La CURP debe tener 18 caracteres para generar el ID."); return; }
      setIsProcessing(true);
      try {
        const curp10 = data.curp.substring(0, 10).toUpperCase();
        const res = await callGAS('CREATE_CLIENTE', { ...data, id: curp10 });
        if (res?.success) {
          if (Object.keys(pendingUploads).length > 0) {
            await Promise.all(Object.entries(pendingUploads).map(([type, base64]) => 
              callGAS('UPLOAD_FILE', { fileName: `${type.toUpperCase()}_${curp10}.pdf`, fileData: base64, id_carpeta_drive: res.id_carpeta_drive })
            ));
          }
          updateData({ id: curp10, id_carpeta_drive: res.id_carpeta_drive });
          setActiveStep(3);
        }
      } finally { setIsProcessing(false); }
    } else {
      setActiveStep(3);
    }
  };

  const redactarDiagnosticoIA = async () => {
    setIsAiDrafting(true);
    try {
      const promptText = `Basado en estas intenciones y necesidades que el asesor detectó: ${iaContext}, y los datos técnicos del caso: Semanas IMSS=${data.semanasCotizadas}, Edad=${calculateDetailedAge(data.curp || '').years}, Salario=${data.ultimoSalario}, redacta un dictamen profesional dirigido al cliente de Social Push.`;
      const draft = await getConsultorChatResponse([{ role: 'user', parts: [{ text: promptText }] }], data);
      setHojaServicio(prev => ({ ...prev, notasDiagnostico: draft }));
    } finally { 
      setIsAiDrafting(false); 
    }
  };

  const handleGuardarHoja = async () => {
    setIsProcessing(true);
    const serviciosFinales = [...hojaServicio.servicios];
    if (hojaServicio.otroServicioTexto) serviciosFinales.push(hojaServicio.otroServicioTexto);
    
    try {
      const res = await callGAS('CREATE_HOJA', { ...hojaServicio, servicios: serviciosFinales, clienteId: data.id });
      if (res?.success) setActiveStep(4);
    } finally { 
      setIsProcessing(false); 
    }
  };

  const detailedAge = data.curp ? calculateDetailedAge(data.curp) : null;
  const nivelCerteza = (data.expedienteExistingFiles?.semanas && data.expedienteExistingFiles?.csf) ? 'Alto' : 'Bajo';

  useEffect(() => {
    if (activeStep !== 4 || !data.id || data.id.startsWith('NEW_')) return;
    const interval = setInterval(async () => {
      const res = await getGASData('GET_CLIENTE_STATUS', { curp: data.id });
      if (res?.data?.estatusfirma) updateData({ estatusfirma: res.data.estatusfirma });
    }, 5000);
    return () => clearInterval(interval);
  }, [activeStep, data.id]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <header className="bg-[#003366] py-5 px-8 flex justify-between items-center shadow-xl sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-[#DAA520] p-2.5 rounded-xl shadow-lg"><ShieldCheck className="text-[#003366]" size={24} /></div>
          <div><h1 className="text-lg font-black text-white uppercase">Social Push® HUB</h1></div>
        </div>
        {data.id && <button onClick={() => {if(confirm("¿Cerrar caso?")) setData({id: undefined}); setActiveStep(1);}} className="px-5 py-2 bg-white/10 text-white rounded-lg text-[10px] font-black uppercase">Cerrar Caso</button>}
      </header>

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
        {!data.id ? (
          <div className="max-w-4xl mx-auto space-y-10 py-10">
            <div className="bg-white p-10 rounded-[48px] shadow-2xl border border-slate-100 space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <input type="text" value={curpSearch} onChange={(e) => setCurpSearch(e.target.value.toUpperCase())} className="px-8 py-5 bg-slate-50 border-2 border-transparent rounded-[24px] focus:border-[#003366] outline-none" placeholder="Buscar por CURP" />
                  <input type="text" value={nameSearch} onChange={(e) => setNameSearch(e.target.value)} className="px-8 py-5 bg-slate-50 border-2 border-transparent rounded-[24px] focus:border-[#003366] outline-none" placeholder="Buscar por Nombre" />
               </div>
               <div className="flex flex-col md:flex-row gap-4">
                 <button type="button" onClick={handleSearch} disabled={isSearching} className="flex-1 py-6 bg-[#003366] text-white rounded-[24px] font-black uppercase tracking-widest hover:bg-[#002244] transition-all flex items-center justify-center gap-3 shadow-xl">
                   {isSearching ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />} Verificar Ecosistema
                 </button>
                 <button type="button" onClick={handleNewClient} className="flex-1 py-6 bg-[#DAA520] text-[#003366] rounded-[24px] font-black uppercase tracking-widest hover:bg-[#c4941d] transition-all flex items-center justify-center gap-3 shadow-xl">
                   <PlusCircle size={20} /> Nuevo Expediente
                 </button>
               </div>
            </div>
            {searchPerformed && foundClients.map((c, i) => (
              <div key={i} onClick={() => loadClient(c)} className="bg-white p-6 rounded-[32px] border border-slate-100 hover:border-[#003366] shadow-xl flex items-center justify-between cursor-pointer mb-4 transition-all">
                 <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-[#003366] text-[#DAA520] rounded-xl flex items-center justify-center font-black">{c.nombre?.substring(0,1)}</div>
                    <div><h4 className="font-black uppercase">{c.nombre} {c.apellidos}</h4><p className="text-[10px] font-mono text-slate-400">{c.curp || c.id}</p></div>
                 </div>
                 <ChevronRight className="text-slate-300" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
             <div className="lg:col-span-8 space-y-8">
                {activeStep === 2 && (
                  <div className="bg-white p-10 rounded-[48px] shadow-2xl border border-slate-100 space-y-8">
                     <div className="flex items-center gap-4 border-b border-slate-100 pb-6"><FileSearch size={28} className="text-[#003366]"/><h3 className="text-2xl font-black text-[#003366] uppercase">1. Digitalización Segura</h3></div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                          { id: 'ine', label: 'INE Oficial', sub: 'Anverso y Reverso' }, 
                          { id: 'csf', label: 'Constancia Fiscal', sub: 'Extrae RFC y CP' },
                          { id: 'semanas', label: 'Reporte Semanas', sub: 'Extrae NSS y Semanas' },
                          { id: 'afore', label: 'Edo. Cuenta Afore', sub: 'Validación de Fondos' },
                          { id: 'domicilio', label: 'Comprobante Domicilio', sub: 'Antigüedad < 3 meses' },
                          { id: 'complementario', label: 'Doc. Complementario', sub: 'Hojas Rosas / Resoluciones' },
                        ].map((doc) => {
                          const exists = data.expedienteExistingFiles?.[doc.id];
                          return (
                            <div key={doc.id} className={cn("p-6 rounded-[32px] border-2 transition-all flex flex-col items-center text-center gap-4 relative", exists ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-100 hover:border-[#003366]")}>
                              {exists && <button onClick={() => handleDeleteFile(doc.id)} className="absolute top-4 right-4 p-2 text-red-400 hover:bg-red-50 rounded-full z-20"><Trash2 size={18}/></button>}
                              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-md", exists ? "bg-emerald-500 text-white" : "bg-white text-slate-300")}>
                                 {exists ? <CheckCircle2 size={24} /> : <FileText size={24} />}
                              </div>
                              <div>
                                 <p className="text-sm font-black uppercase leading-none text-slate-900">{doc.label}</p>
                                 <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{doc.sub}</p>
                              </div>
                              <button onClick={() => { activeUploadRef.current = doc.id; fileInputRef.current?.click(); }} className={cn("w-full py-3 rounded-xl font-black text-[10px] uppercase shadow-sm transition-all", exists ? "bg-white text-emerald-600 border border-emerald-100" : "bg-[#003366] text-white")}>
                                 {uploadingId === doc.id ? <Loader2 className="animate-spin" size={14}/> : (exists ? "Auditado ✅" : "Subir Archivo")}
                              </button>
                            </div>
                          );
                        })}
                     </div>
                  </div>
                )}

                {activeStep === 3 && (
                  <div className="bg-white p-10 rounded-[48px] shadow-2xl border border-slate-100 space-y-10">
                     <div className="flex items-center gap-4 border-b border-slate-100 pb-6"><Briefcase size={28} className="text-[#DAA520]"/><h3 className="text-2xl font-black text-[#003366] uppercase tracking-tighter">2. Hoja de Diagnóstico y Servicio</h3></div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                       <div className="space-y-6">
                         <div className="space-y-3">
                           <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Catálogo de Servicios</label>
                           {['Proyección de Pensión', 'Cálculo de Semanas', 'Alta Modalidad 40', 'Alta PTI (Mod 10)', 'Juicio de Unificación'].map(srv => (
                             <label key={srv} className="flex items-center gap-3 p-3 bg-slate-50 border rounded-xl cursor-pointer hover:bg-slate-100 transition-all">
                               <input type="checkbox" checked={hojaServicio.servicios.includes(srv)} onChange={(e) => setHojaServicio({...hojaServicio, servicios: e.target.checked ? [...hojaServicio.servicios, srv] : hojaServicio.servicios.filter(s => s !== srv)})} className="w-4 h-4 rounded text-[#003366]"/>
                               <span className="text-xs font-bold">{srv}</span>
                             </label>
                           ))}
                           <input type="text" value={hojaServicio.otroServicioTexto} onChange={(e) => setHojaServicio({...hojaServicio, otroServicioTexto: e.target.value})} placeholder="Otro Servicio (Especificar)" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold outline-none focus:border-[#003366]"/>
                         </div>
                         <div className="space-y-4 p-5 bg-slate-50 rounded-3xl border border-slate-200">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center block">Cotizador de Honorarios</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setHojaServicio({...hojaServicio, universo: 'U1'})} className={cn("p-4 border-2 rounded-2xl font-bold text-sm transition-all", hojaServicio.universo === 'U1' ? "border-[#003366] bg-white text-[#003366] shadow-md" : "bg-transparent text-slate-400 border-transparent")}>U1 (Única Vez)</button>
                                <button onClick={() => setHojaServicio({...hojaServicio, universo: 'U2'})} className={cn("p-4 border-2 rounded-2xl font-bold text-sm transition-all", hojaServicio.universo === 'U2' ? "border-[#DAA520] bg-white text-[#DAA520] shadow-md" : "bg-transparent text-slate-400 border-transparent")}>U2 (Recurrente)</button>
                            </div>
                            <div className="relative group">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">$</span>
                              <input type="number" value={hojaServicio.honorariosAcordados || ''} onChange={(e) => setHojaServicio({...hojaServicio, honorariosAcordados: Number(e.target.value)})} placeholder="0.00" className="w-full p-4 pl-8 bg-white border-2 border-slate-100 rounded-2xl font-black text-lg focus:border-[#DAA520] outline-none transition-all shadow-inner"/>
                              <p className="text-[8px] font-bold text-slate-400 mt-2 uppercase tracking-tighter text-center">Honorarios Acordados (MXN)</p>
                            </div>
                         </div>
                       </div>
                       <div className="bg-slate-900 rounded-[32px] p-6 flex flex-col h-[550px] border border-slate-800 shadow-2xl relative">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                             <div className="flex items-center gap-3"><MessageSquare className="text-emerald-400" size={20} /><h4 className="text-sm font-black text-white uppercase tracking-widest">IA Co-Pilot Consultivo</h4></div>
                             <button onClick={redactarDiagnosticoIA} disabled={isAiDrafting} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20">
                               {isAiDrafting ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} Redactar con IA
                             </button>
                          </div>
                          <textarea value={iaContext} onChange={(e) => setIaContext(e.target.value)} className="w-full bg-slate-800 text-white text-xs p-4 rounded-2xl mb-4 h-28 outline-none border border-slate-700 focus:border-emerald-500 transition-all placeholder:text-slate-500" placeholder="Instrucciones para Gemini: (Ej: El cliente Pedro quiere invertir 2 años en M40 para maximizar su pensión a los 63 años...)"/>
                          <div className="flex-1 relative">
                            <textarea value={hojaServicio.notasDiagnostico} onChange={(e) => setHojaServicio({...hojaServicio, notasDiagnostico: e.target.value})} className="w-full h-full bg-slate-800 text-emerald-50 border border-slate-700 rounded-2xl p-4 text-sm font-medium leading-relaxed outline-none focus:border-emerald-500 resize-none custom-scrollbar transition-all" placeholder="El dictamen técnico final aparecerá aquí para su ajuste..."/>
                          </div>
                       </div>
                     </div>
                  </div>
                )}

                {activeStep === 4 && (
                  <>
                  <div className="bg-white p-12 rounded-[48px] shadow-2xl border border-slate-100 space-y-10">
                    <div className="text-center space-y-4">
                        <div className="bg-[#DAA520]/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto shadow-inner"><FileSignature size={48} className="text-[#DAA520]" /></div>
                        <h4 className="text-4xl font-black uppercase text-[#003366] tracking-tighter">3. Hoja de Diagnóstico y Servicios</h4>
                    </div>
                    
                    {/* ... (rest of the form content) ... */}
                    {/* Resumen de Costos */}
                    <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl flex items-center justify-between">
                       <div><h5 className="text-[10px] font-black uppercase tracking-widest text-white/50">Servicios Seleccionados</h5>
                          <p className="text-lg font-bold">{hojaServicio.servicios.join(', ')}</p></div>
                       <div className="text-right"><h5 className="text-[10px] font-black uppercase tracking-widest text-white/50">Total Honorarios</h5>
                          <p className="text-4xl font-black text-[#DAA520]">${hojaServicio.honorariosAcordados.toLocaleString()}</p></div>
                    </div>

                    {/* Dictamen Final Editable */}
                    <textarea value={hojaServicio.notasDiagnostico} onChange={(e) => setHojaServicio({...hojaServicio, notasDiagnostico: e.target.value})} className="w-full h-48 p-6 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-medium leading-relaxed outline-none focus:border-[#003366] custom-scrollbar" placeholder="Dictamen técnico..."/>
                    
                    {/* Firma Asesor */}
                    <div className="space-y-4">
                      <label className="text-xs font-black uppercase text-slate-500">Firma del Asesor</label>
                      <input type="text" placeholder="Nombre completo del Asesor..." className="w-full p-4 bg-slate-50 border rounded-2xl text-sm font-bold"/>
                      <div className="border-2 border-slate-200 rounded-2xl h-32 bg-slate-50"><SignatureCanvas ref={sigCanvas} canvasProps={{className: "w-full h-full"}} /></div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 w-full justify-center">
                      <button onClick={() => setActiveStep(3)} className="py-6 px-10 bg-slate-100 text-slate-500 rounded-[24px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-sm">Atrás</button>
                      <button onClick={() => {
                          const existe = !!data.contratourl;
                          const tipoDoc = existe ? 'DIAGNOSTICO' : 'CONTRATO_Y_DIAGNOSTICO';
                          const link = `${window.location.origin}/firma/${data.id}?tipoDoc=${tipoDoc}`;
                          const text = `Hola ${data.nombre}, formaliza tu expediente de SOCIAL PUSH para tu firma y selfie: ${link}`;
                          window.open(`https://wa.me/52${data.whatsapp?.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                      }} className="flex-1 py-6 bg-[#25D366] text-white rounded-[24px] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] transition-all">WhatsApp <Smartphone size={20} /></button>
                       <button onClick={() => {
                          const existe = !!data.contratourl;
                          const tipoDoc = existe ? 'DIAGNOSTICO' : 'CONTRATO_Y_DIAGNOSTICO';
                          const link = `${window.location.origin}/firma/${data.id}?tipoDoc=${tipoDoc}`;
                          const body = `Hola ${data.nombre},\n\nFormaliza tu diagnóstico de SOCIAL PUSH aquí: ${link}\n\nConforme al Art. 1803 CCF, este acto es legalmente vinculante.`;
                          window.location.href = `mailto:${data.email}?subject=Firma de Formalización - SOCIAL PUSH&body=${encodeURIComponent(body)}`;
                      }} className="flex-1 py-6 bg-[#003366] text-white rounded-[24px] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] transition-all">Correo <Mail size={20} /></button>
                    </div>
                  </div>
                  
                  {/* Overlay de Éxito */}
                  <AnimatePresence>
                     {data.estatusfirma === 'FORMALIZADO' && (
                        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] bg-[#003366]/90 flex items-center justify-center p-10 text-center flex-col gap-6">
                           <Sparkles size={80} className="text-[#DAA520] animate-bounce"/>
                           <h2 className="text-5xl font-black text-white uppercase">¡Expediente Formalizado Exitosamente!</h2>
                           <p className="text-xl text-emerald-400 font-bold">Datos guardados en Drive</p>
                        </motion.div>
                     )}
                  </AnimatePresence>
                  </>
                )}
             </div>

             {/* PANEL DERECHO: AUDITORÍA (CEREBRO) */}
             <div className="lg:col-span-4">
                <div className="bg-[#003366] p-8 rounded-[48px] text-white shadow-2xl space-y-8 sticky top-28">
                   <div className="flex items-center gap-3 border-b border-white/10 pb-4"><Activity size={24} className="text-[#DAA520]" /><h4 className="text-lg font-black uppercase tracking-tighter">Panel de Auditoría</h4></div>
                   <div className="space-y-5">
                      {/* Indicador de Firma */}
                      <div className={cn("p-3 rounded-xl flex items-center justify-between mb-4 border", data.estatusfirma === 'FORMALIZADO' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-amber-500/10 border-amber-500/20 text-amber-400")}>
                        <div className="flex items-center gap-2">
                           {data.estatusfirma === 'FORMALIZADO' ? <CheckCircle size={16} /> : <Clock size={16} />}
                           <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                             {data.estatusfirma === 'FORMALIZADO' ? 'Expediente Formalizado ✅' : 'Esperando Firma ⏳'}
                           </span>
                        </div>
                        <button onClick={() => {
                          if (data.id && !data.id.startsWith('NEW_')) {
                              getGASData('GET_CLIENTE_STATUS', { curp: data.id }).then(res => {
                                  if (res?.data?.estatusfirma) updateData({ estatusfirma: res.data.estatusfirma });
                              });
                          }
                        }} className="p-1 hover:bg-white/10 rounded-full transition-all">
                          <RefreshCcw size={12} />
                        </button>
                      </div>
                      
                      {/* Checklist de Cierre */}
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-2">
                         <h5 className="text-[9px] font-black uppercase tracking-widest text-white/50 mb-3">Checklist de Cierre</h5>
                         <div className="flex flex-col gap-2 text-[10px] font-bold">
                            <span className={cn("flex items-center gap-2", Object.keys(data.expedienteExistingFiles || {}).length > 0 ? "text-emerald-400" : "text-slate-400")}><CheckSquare size={14}/> {Object.keys(data.expedienteExistingFiles || {}).length > 0 ? 'Documentos cargados' : 'Docs pend.'}</span>
                            <span className={cn("flex items-center gap-2", sigCanvas.current && !sigCanvas.current.isEmpty() ? "text-emerald-400" : "text-slate-400")}><PenTool size={14}/> Diagnóstico firmado</span>
                            <span className={cn("flex items-center gap-2", data.estatusfirma === 'PENDIENTE' ? "text-amber-400" : "text-emerald-400")}><Clock size={14}/> {data.estatusfirma === 'PENDIENTE' ? 'Esperando firma cliente' : 'Firma recibida'}</span>
                         </div>
                      </div>
                      
                      {nivelCerteza === 'Alto' ? (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center gap-2 mb-4 animate-in fade-in zoom-in duration-300">
                          <ShieldCheck className="text-emerald-400" size={16} /><span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Certeza Jurídica: Alta</span>
                        </div>
                      ) : (
                        <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center gap-2 mb-4 animate-in fade-in zoom-in duration-300">
                          <AlertTriangle className="text-amber-400" size={16} /><span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Certeza Jurídica: Baja</span>
                        </div>
                      )}
                      
                      {data.metadatosAuditoria?.alertas?.map((alerta, i) => (
                          <div key={i} className="bg-amber-500/10 p-3 rounded-xl text-[10px] font-bold text-amber-500 flex items-center gap-2 border border-amber-500/10"><AlertCircle size={14}/> {alerta}</div>
                      ))}

                      <AuditoriaInput label="Nombre del Cliente" value={data.nombre} isLoading={analyzingCount > 0 && !data.nombre} onChange={(v:any)=>updateData({nombre:v})} />
                      <AuditoriaInput label="CURP Oficial" value={data.curp} isLoading={analyzingCount > 0 && !data.curp} onChange={(v:any)=>updateData({curp:v.toUpperCase()})} />
                      <AuditoriaInput label="RFC Fiscal" value={data.rfc} isLoading={analyzingCount > 0 && !data.rfc} onChange={(v:any)=>updateData({rfc:v.toUpperCase()})} />
                      <AuditoriaInput label="Semanas Extra (Dictaminadas)" value={data.semanasExtra} onChange={(v:any)=>updateData({semanasExtra: v})} />
                      <AuditoriaInput label="NSS IMSS" value={data.nss} isLoading={analyzingCount > 0 && !data.nss} onChange={(v:any)=>updateData({nss:v})} />
                      
                      <div className="grid grid-cols-2 gap-3">
                         <AuditoriaInput label="Semanas IMSS" value={data.semanasCotizadas} isLoading={analyzingCount > 0 && !data.semanasCotizadas} onChange={(v:any)=>updateData({semanasCotizadas:v})} />
                         <AuditoriaInput label="Último Salario" value={data.ultimoSalario} isLoading={analyzingCount > 0 && !data.ultimoSalario} onChange={(v:any)=>updateData({ultimoSalario:v})} />
                      </div>
                      <AuditoriaInput label="WhatsApp" value={data.whatsapp} onChange={(v:any)=>updateData({whatsapp:v})} />
                      <AuditoriaInput label="Email de Contacto" value={data.email} onChange={(v:any)=>updateData({email:v})} />
                      <AuditoriaInput label="Régimen Fiscal" value={data.regimenFiscal} onChange={(v:any)=>updateData({regimenFiscal:v})} />
                      
                      {detailedAge && detailedAge.hasRoundingBenefit && (
                         <div className="bg-[#DAA520]/20 border border-[#DAA520]/40 p-4 rounded-2xl flex items-center justify-between mb-4 animate-pulse">
                           <div className="flex items-center gap-2"><Sparkles className="text-[#DAA520]" size={16} /><span className="text-[9px] font-black text-[#DAA520] uppercase tracking-widest">Incentivo 6+1</span></div>
                           <span className="bg-[#DAA520] text-[#003366] text-[9px] font-black px-2 py-0.5 rounded-full">Redondeo Aplicable</span>
                         </div>
                      )}
                   </div>
                   {activeStep === 2 && (
                     <button type="button" onClick={handleSiguientePasoDocs} disabled={isProcessing} className="w-full py-5 bg-[#DAA520] text-[#003366] rounded-[24px] font-black uppercase shadow-xl hover:bg-[#c9961d] active:scale-95 transition-all flex items-center justify-center gap-3">
                       {isProcessing ? <Loader2 size={18} className="animate-spin" /> : null}
                       {data.id?.startsWith('NEW_') ? "Crear Expediente" : "Siguiente Paso"} <ArrowRight size={18} />
                     </button>
                   )}
                   {activeStep === 3 && (
                     <button type="button" onClick={handleGuardarHoja} disabled={isProcessing} className="w-full py-5 bg-[#DAA520] text-[#003366] rounded-[24px] font-black uppercase shadow-xl hover:bg-[#c9961d] active:scale-95 transition-all flex items-center justify-center gap-3">
                       {isProcessing ? <Loader2 size={18} className="animate-spin" /> : null} Generar Hoja de Servicio <ArrowRight size={18} />
                     </button>
                   )}
                </div>
             </div>
          </div>
        )}
      </main>
      <input type="file" ref={fileInputRef} onChange={(e) => activeUploadRef.current && handleFileUpload(e, activeUploadRef.current)} className="hidden" accept="application/pdf,image/*" />
    </div>
  );
}