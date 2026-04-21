import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, User, FileText, CheckCircle, AlertCircle, Clock, Trash2,
  Loader2, RefreshCcw, ShieldCheck, ChevronRight, Smartphone,
  ArrowRight, ExternalLink, MapPin, Scale, FileSearch, CheckCircle2,
  Activity, AlertTriangle, RotateCcw, Sparkles, PlusCircle, MessageSquare, 
  Send, Briefcase, FileSignature, Mail, CheckSquare, PenTool, FileCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SignatureCanvas from 'react-signature-canvas';

import { cn, calculateDetailedAge } from '@/lib/utils';
import { getGASData, callGAS } from '@/services/apiService';
import { extractDocumentData, getConsultorChatResponse } from '@/services/geminiService';
import { Cliente } from '@/types';

  // --- SUB-COMPONENTE: INPUT DE AUDITORÍA PREMIUM ---
  function AuditoriaInput({ label, value, isLoading, isLocked, onUnlock, onChange, hasAlert, fieldKey }: any) {
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
                onChange={(e) => {
                    onChange(e.target.value);
                    if (fieldKey && !isLocked) registrarAccion(`Modificación manual en ${label}: ${e.target.value}`);
                }}
                readOnly={isLocked}
                placeholder={`Capturar ${label}`}
                className={cn(
                  "w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white transition-all outline-none focus:border-[#DAA520]/50",
                  isLocked && "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 cursor-not-allowed",
                  hasAlert && "border-orange-500/50 bg-orange-500/10"
                )}
              />
              {isLocked && (
                <button type="button" onClick={() => {onUnlock(); registrarAccion(`Campo ${label} desbloqueado.`);}} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/10 rounded-lg text-white/40 hover:text-white transition-all z-10" title="Editar manualmente">
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
  const sigCanvasAsesor = useRef<SignatureCanvas>(null);

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
  const [asesorNombre, setAsesorNombre] = useState('');
  const [pendingUploads, setPendingUploads] = useState<{ [key: string]: string }>({});
  const [auditLog, setAuditLog] = useState<{fecha: string, accion: string}[]>([]);

  const registrarAccion = (texto: string) => setAuditLog(prev => [{fecha: new Date().toLocaleTimeString(), accion: texto}, ...prev]);

  const updateData = (newData: Partial<Cliente>) => {
    setData(prev => ({ ...prev, ...newData }));
  };

  // --- MONITOR DE FIRMA EN TIEMPO REAL (POLLING) ---
  useEffect(() => {
    if (activeStep !== 4 || !data.id || data.id.startsWith('NEW_')) return;
    const interval = setInterval(async () => {
      const res = await getGASData('GET_CLIENTE_STATUS', { curp: data.id });
      if (res?.data?.estatusfirma === 'FIRMADO' || res?.data?.estatusfirma === 'FORMALIZADO') {
        updateData({ estatusfirma: 'FIRMADO' });
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [activeStep, data.id]);

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
        const matchesName = queryTokens.every(token => full.includes(token));
        const matchesCurp = cleanCurp ? (c.curp?.includes(cleanCurp) || c.id?.includes(cleanCurp)) : true;
        return matchesName && matchesCurp;
      }));
    } finally { setIsSearching(false); }
  };

  const handleNewClient = () => {
    const tempId = `NEW_${Date.now().toString().slice(-6)}`;
    setData({
      id: tempId, estatusfirma: 'PENDIENTE', expedienteExistingFiles: {}, nombre: '', curp: '', rfc: '', nss: '', nssList: [], whatsapp: '', email: '', semanasCotizadas: 0, semanasExtra: 0, metadatosAuditoria: { alertas: [], discrepancias: [] }
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
        ...fresh, id: fresh.curp || fresh.id, 
        expedienteExistingFiles: {
          ine: hasData(fresh.ine_url), csf: hasData(fresh.csf_url), domicilio: hasData(fresh.domicilio_url || fresh.comprobantedomiciliourl), semanas: hasData(fresh.semanas_url), afore: hasData(fresh.afore_url), complementario: hasData(fresh.complementario_url)
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
        const updatePayload: any = { expedienteExistingFiles: { ...data.expedienteExistingFiles, [type]: true } };

        if (type === 'domicilio') {
           updatePayload.domicilio = extracted.domicilio || data.domicilio;
        } else {
           updatePayload.nombre = extracted.nombre || data.nombre;
           updatePayload.curp = extracted.curp || data.curp;
           updatePayload.rfc = extracted.rfc || data.rfc;
           updatePayload.nss = extracted.nss || data.nss;
           updatePayload.semanasCotizadas = extracted.semanasCotizadas || data.semanasCotizadas;
           updatePayload.ultimoSalario = extracted.ultimoSalario || data.ultimoSalario;
           updatePayload.regimenFiscal = extracted.regimenFiscal || data.regimenFiscal;
        }

        if (type === 'complementario') {
          const nuevasAlertas = [...((data.metadatosAuditoria as any)?.alertas || [])];
          if (extracted.tipo_complemento === 'Hoja Rosa') {
            nuevasAlertas.push('💡 Evidencia detectada: Este documento puede sustentar un Trámite de Búsqueda de Semanas Manual para incrementar la cuantía');
          }
          updatePayload.metadatosAuditoria = { ...data.metadatosAuditoria, alertas: nuevasAlertas } as any;
          if (extracted.tipo_complemento === 'Resolución') updatePayload.semanasExtra = extracted.semanas_extra || 0;
        }
        updateData(updatePayload);
        registrarAccion(`Archivo ${type.toUpperCase()} cargado y validado vía OCR.`);
      } catch (ocrError) {
        updateData({ expedienteExistingFiles: { ...data.expedienteExistingFiles, [type]: true } });
        registrarAccion(`Archivo ${type.toUpperCase()} cargado (fallo OCR).`);
      }

      if (data.id?.startsWith('NEW_')) {
        setPendingUploads(prev => ({ ...prev, [type]: base64.split(',')[1] }));
      } else {
        callGAS('UPLOAD_FILE', { fileName: `${type.toUpperCase()}_${data.id}.pdf`, fileData: base64.split(',')[1], id_carpeta_drive: data.id_carpeta_drive || data.idcarpetadrive });
      }
    } finally { 
       setIsProcessing(false); 
       setAnalyzingCount(prev => Math.max(0, prev - 1));
       setUploadingId(null); 
    }
  };

  const handleSiguientePasoDocs = async () => {
    if (data.id?.startsWith('NEW_')) {
      if (!data.nombre || !data.curp || data.curp.length !== 18) { alert("La CURP debe tener 18 caracteres."); return; }
      setIsProcessing(true);
      try {
        const curp10 = data.curp.substring(0, 10).toUpperCase();
        const res = await callGAS('CREATE_CLIENTE', { ...data, id: curp10 });
        if (res?.success) {
          if (Object.keys(pendingUploads).length > 0) {
            await Promise.all(Object.entries(pendingUploads).map(([type, base64]) => 
              callGAS('UPLOAD_FILE', { fileName: `${type.toUpperCase()}_${curp10}.pdf`, fileData: base64, id_carpeta_drive: res.id_carpeta_drive })
            ));
            setPendingUploads({});
          }
          updateData({ id: curp10, id_carpeta_drive: res.id_carpeta_drive });
          setActiveStep(3);
        }
      } finally { setIsProcessing(false); }
    } else {
      setActiveStep(3);
    }
  };

  const redactarIA = async () => {
    setIsAiDrafting(true);
    try {
      const promptText = `Basado en estas intenciones y necesidades que el asesor detectó: ${iaContext}, y los datos técnicos del caso: Semanas IMSS=${data.semanasCotizadas}, Edad=${calculateDetailedAge(data.curp || '').years}, Salario=${data.ultimoSalario}, redacta un diagnóstico inicial profesional dirigido al cliente.`;
      const draft = await getConsultorChatResponse([{ role: 'user', parts: [{ text: promptText }] }], data);
      setHojaServicio(prev => ({ ...prev, notasDiagnostico: draft }));
    } finally { setIsAiDrafting(false); }
  };

  const handleFinalizarCertificacion = async () => {
    if (!asesorNombre || sigCanvasAsesor.current?.isEmpty()) {
      alert("El asesor debe firmar la hoja de diagnóstico antes de enviarla."); return;
    }
    setIsProcessing(true);
    const firmaAsesor = sigCanvasAsesor.current?.getTrimmedCanvas().toDataURL('image/png');
    const serviciosFinales = [...hojaServicio.servicios];
    if (hojaServicio.otroServicioTexto) serviciosFinales.push(hojaServicio.otroServicioTexto);

    try {
      const res = await callGAS('FINALIZE_AUDIT', {
        clienteId: data.id,
        asesor: asesorNombre,
        firmaAsesor,
        dictamen: hojaServicio.notasDiagnostico,
        servicios: serviciosFinales.join(', '),
        monto: hojaServicio.honorariosAcordados,
        auditLog: JSON.stringify(auditLog)
      });
      if (res?.success) setActiveStep(4);
    } finally { setIsProcessing(false); }
  };

  const detailedAge = data.curp ? calculateDetailedAge(data.curp) : null;
  const nivelCerteza = (data.expedienteExistingFiles?.semanas && data.expedienteExistingFiles?.csf) ? 'Alto' : 'Bajo';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <header className="bg-[#003366] py-5 px-8 flex justify-between items-center shadow-xl sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-[#DAA520] p-2.5 rounded-xl shadow-lg"><ShieldCheck className="text-[#003366]" size={24} /></div>
          <h1 className="text-lg font-black text-white uppercase tracking-tight">Social Push® HUB</h1>
        </div>
        {data.id && <button onClick={() => {if(confirm("¿Cerrar caso?")) window.location.reload();}} className="px-5 py-2 bg-white/10 text-white rounded-lg text-[10px] font-black uppercase">Cerrar Caso</button>}
      </header>

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
        {activeStep === 1 && (
          <div className="max-w-4xl mx-auto space-y-10 py-10">
            <div className="bg-white p-10 rounded-[48px] shadow-2xl border border-slate-100 space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <input type="text" value={curpSearch} onChange={(e) => setCurpSearch(e.target.value.toUpperCase())} className="px-8 py-5 bg-slate-50 border-2 border-transparent rounded-[24px] focus:border-[#003366] outline-none font-mono" placeholder="Buscar por ID / CURP10" />
                  <input type="text" value={nameSearch} onChange={(e) => setNameSearch(e.target.value)} className="px-8 py-5 bg-slate-50 border-2 border-transparent rounded-[24px] focus:border-[#003366] outline-none font-bold" placeholder="Buscar por Nombre" />
               </div>
               <div className="flex flex-col md:flex-row gap-4">
                 <button onClick={handleSearch} disabled={isSearching} className="flex-1 py-6 bg-[#003366] text-white rounded-[24px] font-black uppercase tracking-widest hover:bg-[#002244] transition-all flex items-center justify-center gap-3 shadow-xl">
                   {isSearching ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />} Verificar Ecosistema
                 </button>
                 <button onClick={handleNewClient} className="flex-1 py-6 bg-[#DAA520] text-[#003366] rounded-[24px] font-black uppercase tracking-widest hover:bg-[#c4941d] transition-all flex items-center justify-center gap-3 shadow-xl">
                   <PlusCircle size={20} /> Nuevo Expediente
                 </button>
               </div>
            </div>
            {searchPerformed && foundClients.map((c, i) => (
              <div key={i} onClick={() => loadClient(c)} className="bg-white p-6 rounded-[32px] border border-slate-100 hover:border-[#003366] shadow-xl flex items-center justify-between cursor-pointer group transition-all mb-4">
                 <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-[#003366] text-[#DAA520] rounded-xl flex items-center justify-center font-black">{c.nombre?.substring(0,1)}</div>
                    <div><h4 className="font-black uppercase">{c.nombre} {c.apellidos}</h4><p className="text-[10px] font-mono text-slate-400">{c.curp || c.id}</p></div>
                 </div>
                 <ChevronRight className="text-slate-300" />
              </div>
            ))}
          </div>
        )}

        {activeStep === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in">
             <div className="lg:col-span-8 space-y-8">
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
                          { id: 'selfie', label: 'Identidad Biométrica', sub: 'Captura de Rostro' },
                        ].map((doc) => {
                          const exists = data.expedienteExistingFiles?.[doc.id];
                          if (doc.id === 'selfie' && data.id?.startsWith('NEW_')) return null;

                          return (
                            <div key={doc.id} className={cn("p-6 rounded-[32px] border-2 transition-all flex flex-col items-center text-center gap-4 relative", exists ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-100 hover:border-[#003366]")}>
                              {exists && <button onClick={() => updateData({ expedienteExistingFiles: {...data.expedienteExistingFiles, [doc.id]: false}})} className="absolute top-4 right-4 p-2 text-red-400 hover:bg-red-50 rounded-full z-20"><Trash2 size={18}/></button>}
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
             </div>
             <div className="lg:col-span-4">{/* Panel de Auditoría siempre visible */}</div>
          </div>
        )}

        {activeStep === 3 && (
            <div className="bg-white p-10 rounded-[48px] shadow-2xl border border-slate-100 space-y-10 animate-in fade-in">
                <div className="flex items-center gap-4 border-b pb-6"><Briefcase size={28} className="text-[#DAA520]"/><h3 className="text-2xl font-black text-[#003366] uppercase tracking-tighter">2. Hoja de Diagnóstico y Servicio</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Catálogo de Servicios</label>
                            {['Proyección de Pensión', 'Cálculo de Semanas', 'Alta Modalidad 40', 'Alta PTI (Mod 10)', 'Juicio de Unificación', 'Asesoría Única'].map(srv => (
                                <label key={srv} className="flex items-center gap-3 p-3 bg-slate-50 border rounded-xl cursor-pointer hover:bg-slate-100 transition-all">
                                    <input type="checkbox" checked={hojaServicio.servicios.includes(srv)} onChange={(e) => setHojaServicio({...hojaServicio, servicios: e.target.checked ? [...hojaServicio.servicios, srv] : hojaServicio.servicios.filter(s => s !== srv)})} className="w-4 h-4 rounded text-[#003366]"/>
                                    <span className="text-xs font-bold text-slate-700">{srv}</span>
                                </label>
                            ))}
                            <input type="text" value={hojaServicio.otroServicioTexto} onChange={(e) => setHojaServicio({...hojaServicio, otroServicioTexto: e.target.value})} placeholder="Otro Servicio (Especificar)" className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold outline-none focus:border-[#003366]"/>
                        </div>
                        <div className="space-y-4 p-5 bg-slate-50 rounded-3xl border border-slate-200">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center block">Cotizador de Honorarios</label>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <button onClick={() => setHojaServicio({...hojaServicio, universo: 'U1'})} className={cn("p-4 border-2 rounded-2xl font-bold text-sm transition-all", hojaServicio.universo === 'U1' ? "border-[#003366] bg-white text-[#003366] shadow-md" : "bg-transparent text-slate-400 border-transparent")}>U1 (Única Vez)</button>
                                <button onClick={() => setHojaServicio({...hojaServicio, universo: 'U2'})} className={cn("p-4 border-2 rounded-2xl font-bold text-sm transition-all", hojaServicio.universo === 'U2' ? "border-[#DAA520] bg-white text-[#DAA520] shadow-md" : "bg-transparent text-slate-400 border-transparent")}>U2 (Recurrente)</button>
                            </div>
                            <input type="number" value={hojaServicio.honorariosAcordados || ''} onChange={(e) => setHojaServicio({...hojaServicio, honorariosAcordados: Number(e.target.value)})} placeholder="Honorarios ($)" className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl font-black text-lg focus:border-[#DAA520] outline-none shadow-inner"/>
                        </div>
                    </div>
                    <div className="bg-slate-900 rounded-[32px] p-6 flex flex-col h-[550px] border border-slate-800 shadow-2xl relative">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                            <div className="flex items-center gap-3"><MessageSquare className="text-emerald-400" size={20} /><h4 className="text-sm font-black text-white uppercase tracking-widest">IA Co-Pilot Consultivo</h4></div>
                            <button onClick={redactarIA} disabled={isAiDrafting} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-emerald-500 shadow-lg">
                                {isAiDrafting ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} Redactar con IA
                            </button>
                        </div>
                        <textarea value={iaContext} onChange={(e) => setIaContext(e.target.value)} className="w-full bg-slate-800 text-white text-xs p-4 rounded-2xl mb-4 h-28 outline-none border border-slate-700" placeholder="Instrucciones para Gemini (Ej: El cliente quiere invertir 2 años en M40...)"/>
                        <textarea value={hojaServicio.notasDiagnostico} onChange={(e) => setHojaServicio({...hojaServicio, notasDiagnostico: e.target.value})} className="flex-1 w-full bg-slate-800 text-emerald-50 border border-slate-700 rounded-2xl p-4 text-sm font-medium leading-relaxed outline-none focus:border-emerald-500 resize-none custom-scrollbar" placeholder="El dictamen técnico final aparecerá aquí..."/>
                    </div>
                </div>
                <button onClick={handleFinalizarCertificacion} className="w-full py-5 bg-[#DAA520] text-[#003366] rounded-[24px] font-black uppercase shadow-xl flex items-center justify-center gap-3">Certificar Diagnóstico Inicial <ArrowRight /></button>
            </div>
        )}

        {activeStep === 4 && (
            <div className="bg-white p-12 rounded-[48px] shadow-2xl border border-slate-100 space-y-10 animate-in slide-in-from-bottom">
                <div className="text-center space-y-4">
                    <div className="bg-[#DAA520]/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto shadow-inner"><FileSignature size={48} className="text-[#DAA520]" /></div>
                    <h4 className="text-4xl font-black uppercase text-[#003366] tracking-tighter">3. Hoja de Diagnóstico y Servicios</h4>
                </div>

                <div className="bg-slate-900 text-white p-8 rounded-[32px] shadow-xl flex items-center justify-between">
                   <div><h5 className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">Servicios Acordados</h5><p className="text-lg font-bold">{hojaServicio.servicios.join(', ')} {hojaServicio.otroServicioTexto}</p></div>
                   <div className="text-right"><h5 className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">Inversión Social</h5><p className="text-4xl font-black text-[#DAA520]">${hojaServicio.honorariosAcordados.toLocaleString()}</p></div>
                </div>

                <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 h-96 overflow-y-auto text-xs font-mono text-slate-700 leading-relaxed shadow-inner custom-scrollbar">
                  <div className="space-y-6">
                    <div className="border-b border-slate-200 pb-4 text-center"><h3 className="font-black text-lg uppercase text-slate-900">HOJA DE DIAGNÓSTICO TÉCNICO</h3><p className="text-[10px] text-slate-400 mt-1">BAKSO, S.C. | SOCIAL PUSH®</p></div>
                    <p>BAKSO, S.C. emite el siguiente <strong>diagnóstico inicial</strong> para el C. <strong>{data.nombre || '[NOMBRE COMPLETO]'}</strong>, identificado con CURP <strong>{data.curp || '[CURP]'}</strong> y RFC <strong>{data.rfc || '[RFC]'}</strong>.</p>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 italic text-slate-900 leading-normal whitespace-pre-wrap">{hojaServicio.notasDiagnostico}</div>
                    <div className="border-t border-slate-200 pt-6">
                        <p className="font-black text-slate-900 uppercase">Fundamentación Legal:</p>
                        <p className="mt-2">La firma electrónica estampada en el portal externo tiene plena validez jurídica conforme al <strong>Artículo 1803 del Código Civil Federal</strong>.</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-100 pt-10">
                   <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sello de Responsabilidad (Asesor)</label>
                      <input type="text" value={asesorNombre} onChange={(e) => setAsesorNombre(e.target.value)} placeholder="Nombre del Asesor Certificador" className="w-full p-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none"/>
                      <div className="border-2 border-slate-200 rounded-3xl h-32 bg-slate-50 relative overflow-hidden">
                         <SignatureCanvas ref={sigCanvasAsesor} canvasProps={{className: "w-full h-full"}} />
                         <button type="button" onClick={() => sigCanvasAsesor.current?.clear()} className="absolute top-2 right-2 p-1.5 bg-white/50 rounded-lg text-red-500 hover:bg-white transition-all"><Trash2 size={14}/></button>
                      </div>
                   </div>
                   <div className="space-y-4 flex flex-col justify-center">
                      <div className={cn("p-6 rounded-3xl border text-center space-y-6 transition-all", asesorNombre ? "bg-white" : "bg-slate-50 opacity-50")}>
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Enviar Firma Externa (Cliente)</p>
                         <div className="flex gap-2">
                            <button type="button" disabled={!asesorNombre} onClick={() => {
                                const tipoDoc = !!data.contratourl ? 'DIAGNOSTICO' : 'CONTRATO_Y_DIAGNOSTICO';
                                const link = `${window.location.origin}/firma/${data.id}?tipoDoc=${tipoDoc}`;
                                window.open(`https://wa.me/52${data.whatsapp?.replace(/\D/g, '')}?text=${encodeURIComponent("Formaliza tu Diagnóstico Inicial de SOCIAL PUSH aquí: " + link)}`, '_blank');
                            }} className="flex-1 py-5 bg-[#25D366] text-white rounded-2xl font-black uppercase text-[10px] shadow-xl hover:scale-[1.02] transition-all">WhatsApp <Smartphone size={16}/></button>
                            <button type="button" disabled={!asesorNombre} onClick={() => {
                                const link = `${window.location.origin}/firma/${data.id}?tipoDoc=${data.contratourl ? 'DIAGNOSTICO' : 'CONTRATO_Y_DIAGNOSTICO'}`;
                                window.location.href = `mailto:${data.email}?subject=Firma de Diagnóstico&body=Ingresa aquí: ${link}`;
                            }} className="flex-1 py-5 bg-[#003366] text-white rounded-2xl font-black uppercase text-[10px] shadow-xl hover:scale-[1.02] transition-all">Email <Mail size={16}/></button>
                         </div>
                      </div>
                   </div>
                </div>
            </div>
        )}
      </main>

      {/* PANEL DERECHO (AUDITORÍA) */}
      {activeStep > 1 && (
        <aside className="fixed right-8 top-28 w-80 bg-[#003366] p-8 rounded-[48px] text-white shadow-2xl space-y-8 hidden xl:block">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4"><Activity size={24} className="text-[#DAA520]" /><h4 className="text-lg font-black uppercase tracking-tighter">Panel de Auditoría</h4></div>
            <div className="space-y-5">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3">
                    <h5 className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Resumen de Materialidad</h5>
                    <div className="flex flex-col gap-2 text-[10px] font-bold">
                        <span className={cn("flex items-center gap-2", Object.keys(data.expedienteExistingFiles || {}).length > 0 ? "text-emerald-400" : "text-white/30")}><CheckSquare size={14}/> {Object.keys(data.expedienteExistingFiles || {}).length > 0 ? 'Documental OK' : 'Docs Pendientes'}</span>
                        <span className={cn("flex items-center gap-2", asesorNombre ? "text-emerald-400" : "text-white/30")}><PenTool size={14}/> {asesorNombre ? 'Dictamen Certificado' : 'Firma Asesor Pend.'}</span>
                    </div>
                </div>

                <div className={cn("p-4 rounded-2xl flex items-center gap-3 border", nivelCerteza === 'Alto' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-amber-500/10 border-amber-500/20 text-amber-400")}>
                  {nivelCerteza === 'Alto' ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{nivelCerteza === 'Alto' ? 'Certeza Jurídica: Alta. Match total entre CSF y Reporte de Semanas. Datos oficiales vinculados.' : `Certeza Jurídica: Baja. Razones: ${(data.metadatosAuditoria as any)?.discrepancias?.join('. ') || 'Sin especificar razones detalladas.'}`}</span>
                </div>
                
                {data.metadatosAuditoria?.alertas?.map((alerta: string, i: number) => (
                    <div key={i} className="bg-amber-500/10 p-3 rounded-xl text-[9px] font-bold text-amber-500 flex items-center gap-2 border border-amber-500/10"><AlertCircle size={14}/> {alerta}</div>
                ))}

                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3">
                    <h5 className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Historial de Auditoría</h5>
                    <div className="text-[9px] font-bold text-white/70 space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                        {auditLog.map((l, i) => <div key={i}><span className="text-white/30">[{l.fecha}]</span> {l.accion}</div>)}
                    </div>
                </div>

                <AuditoriaInput label="Nombre del Cliente" value={data.nombre} fieldKey="nombre" isLoading={analyzingCount > 0 && !data.nombre} onChange={(v:any)=>updateData({nombre:v})} />
                <AuditoriaInput label="CURP Oficial" value={data.curp} fieldKey="curp" isLoading={analyzingCount > 0 && !data.curp} onChange={(v:any)=>updateData({curp:v.toUpperCase()})} />
                <AuditoriaInput label="RFC Fiscal" value={data.rfc} fieldKey="rfc" isLoading={analyzingCount > 0 && !data.rfc} onChange={(v:any)=>updateData({rfc:v.toUpperCase()})} />
                <AuditoriaInput label="Semanas Extra" value={data.semanasExtra} fieldKey="semanasExtra" onChange={(v:any)=>updateData({semanasExtra: v})} />
                <AuditoriaInput label="NSS IMSS" value={data.nss} fieldKey="nss" isLoading={analyzingCount > 0 && !data.nss} onChange={(v:any)=>updateData({nss:v})} />
                
                <div className="grid grid-cols-2 gap-3">
                    <AuditoriaInput label="Semanas IMSS" value={data.semanasCotizadas} fieldKey="semanasCotizadas" isLoading={analyzingCount > 0 && !data.semanasCotizadas} onChange={(v:any)=>updateData({semanasCotizadas:v})} />
                    <AuditoriaInput label="Último Salario" value={data.ultimoSalario} fieldKey="ultimoSalario" isLoading={analyzingCount > 0 && !data.ultimoSalario} onChange={(v:any)=>updateData({ultimoSalario:v})} />
                </div>
                <AuditoriaInput label="WhatsApp" value={data.whatsapp} fieldKey="whatsapp" onChange={(v:any)=>updateData({whatsapp:v})} />
                <AuditoriaInput label="Email de Contacto" value={data.email} fieldKey="email" onChange={(v:any)=>updateData({email:v})} />
                <AuditoriaInput label="Régimen Fiscal" value={data.regimenFiscal} fieldKey="regimenFiscal" onChange={(v:any)=>updateData({regimenFiscal:v})} />
                
                {detailedAge?.hasRoundingBenefit && (
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
        </aside>
      )}

      {/* OVERLAY DE ÉXITO */}
      <AnimatePresence>
         {data.estatusfirma === 'FIRMADO' && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] bg-[#003366]/95 flex items-center justify-center p-10 text-center flex-col gap-6 backdrop-blur-md">
               <div className="bg-[#DAA520] p-8 rounded-full shadow-2xl animate-pulse"><CheckCircle size={80} className="text-[#003366]"/></div>
               <h2 className="text-5xl font-black text-white uppercase tracking-tighter">¡Expediente Formalizado!</h2>
               <p className="text-xl text-emerald-400 font-bold">Firma y Selfie recibidas. El diagnóstico ha sido archivado en Drive.</p>
               <button type="button" onClick={() => window.location.reload()} className="mt-8 px-10 py-4 bg-white text-[#003366] rounded-full font-black uppercase tracking-widest hover:bg-slate-100 transition-all">Regresar al Tablero Maestro</button>
            </motion.div>
         )}
      </AnimatePresence>

      <input type="file" ref={fileInputRef} onChange={(e) => activeUploadRef.current && handleFileUpload(e, activeUploadRef.current)} className="hidden" accept="application/pdf,image/*" />
    </div>
  );
}