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

import { cn, calculateDetailedAge, VALIDATORS, copyToClipboard } from '@/lib/utils';
import { getGASData, callGAS } from '@/services/apiService';
import { extractDocumentData, getConsultorChatResponse } from '@/services/geminiService';
import { Cliente } from '@/types';
import { useCase } from './CaseContext';

  // --- SUB-COMPONENTE: INPUT DE AUDITORÍA PREMIUM ---
  function AuditoriaInput({ label, value, isLoading, isLocked, onUnlock, onChange, hasAlert, fieldKey, registrarAccion }: any) {
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
  const { setCurrentCase } = useCase();
  const [activeStep, setActiveStep] = useState(1);
  const [curpSearch, setCurpSearch] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [foundClients, setFoundClients] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [certificationReady, setCertificationReady] = useState(false);
  const [finalLink, setFinalLink] = useState('');
  const [analyzingCount, setAnalyzingCount] = useState(0); 
  const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [filePreviews, setFilePreviews] = useState<Record<string, string>>({});
  const [ocrSummaries, setOcrSummaries] = useState<Record<string, any>>({});
  const [clienteStatus, setClienteStatus] = useState<'idle' | 'loading' | 'verified' | 'not_found'>('idle');
  
  const renderStatusBanner = () => (
    <div className={cn("mb-6 p-4 rounded-2xl border flex items-center gap-3 text-sm font-bold",
        clienteStatus === 'loading' ? "bg-blue-50 border-blue-200 text-blue-700" :
        clienteStatus === 'verified' ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
        "bg-amber-50 border-amber-200 text-amber-700"
    )}>
        {clienteStatus === 'loading' && <Loader2 size={18} className="animate-spin" />}
        {clienteStatus === 'verified' && <ShieldCheck size={18} />}
        {clienteStatus === 'not_found' && <AlertTriangle size={18} />}
        {clienteStatus === 'loading' ? 'Verificando cliente en Bóveda...' : 
         clienteStatus === 'verified' ? 'Cliente validado y activo en el sistema.' : 
         'Cliente no encontrado en sistema. Procediendo como nuevo ingreso.'}
    </div>
  );
  
  const [data, setData] = useState<Partial<Cliente>>({
    estatusfirma: 'PENDIENTE',
    expedienteExistingFiles: {},
    nssList: [],
    contactosExtra: [],
    ultimoSalario: 0,
    regimenFiscal: '',
    nivelCerteza: 'Bajo',
    semanasExtra: 0,
    semanasExtraDictaminadas: 0,
    metadatosAuditoria: { 
      metodoCaptura: 'Manual', 
      matchDocumental: false, 
      alertas: [], 
      discrepancias: [] 
    }
  });
  
  useEffect(() => {
    const checkStatus = async () => {
        if ((data.curp || data.id) && clienteStatus === 'idle') {
            setClienteStatus('loading');
            try {
                const res = await callGAS('GET_CLIENTE_STATUS', { curp: data.curp, id: data.id });
                if (res?.status === 'success') {
                    setClienteStatus('verified');
                    updateData({ ...data, ...res.data });
                } else {
                    setClienteStatus('not_found');
                }
            } catch (e) {
                setClienteStatus('not_found');
            }
        }
    };
    checkStatus();
  }, [data.curp, data.id]);


  const [hojaServicio, setHojaServicio] = useState<{
    servicios: { nombre: string; universo: 'U1' | 'U2'; precio: number }[];
    universo: 'U1' | 'U2';
    otroServicioTexto: string;
    honorariosAcordados: number;
    notasDiagnostico: string;
  }>({
    servicios: [],
    universo: 'U1',
    otroServicioTexto: '',
    honorariosAcordados: 0,
    notasDiagnostico: ''
  });

  const CATALOGO_SERVICIOS = [
    'Asesoría Inicial (Diagnóstico Integral)',
    'Proyección Básica de Pensión (3 escenarios)',
    'Proyección Avanzada de Pensión (5 escenarios)',
    'Inscripción a Modalidad 40',
    'Gestión de Línea de Captura M40',
    'Unificación de NSS / Corrección de Datos',
    'Búsqueda Manual de Semanas',
    'Gestoría de Pensión IMSS (Trámite)',
    'Inscripción PTI (Modalidad 10)',
    'Recuperación de Recursos AFORE',
    'Financiamiento M40 Retroactivo'
  ];

  const [iaContext, setIaContext] = useState('');
  const [isAiDrafting, setIsAiDrafting] = useState(false);
  const [fileProgress, setFileProgress] = useState<{[key: string]: number}>({});
  const [asesorNombre, setAsesorNombre] = useState('');
  const [pendingUploads, setPendingUploads] = useState<{ [key: string]: string }>({});
  const [auditLog, setAuditLog] = useState<{fecha: string, accion: string}[]>([]);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [toasts, setToasts] = useState<{id: number, message: string, type: 'info' | 'error' | 'success'}[]>([]);
  
  const activeUploadRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sigCanvasAsesor = useRef<SignatureCanvas>(null);

  const addToast = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // --- MONITOR DE FIRMA EN TIEMPO REAL (UNIFICADO) ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    // Solo polleamos en Paso 4 si tenemos un ID válido y no está firmado aún
    const isValidId = data.id && !data.id.startsWith('NEW_') && data.id.length >= 10;
    
    if (activeStep === 4 && isValidId && data.estatusfirma !== 'FIRMADO' && data.estatusfirma !== 'COMPLETADO') {
      interval = setInterval(async () => {
        try {
          const res = await getGASData('GET_CLIENTE_STATUS', { curp: data.id });
          
          if (res?.status === 'success' && res.data) {
            const remoteStatus = res.data.estatusfirma || res.data.statusSignature;
            if (['FIRMADO', 'FORMALIZADO', 'COMPLETADO'].includes(remoteStatus)) {
              updateData({ estatusfirma: 'COMPLETADO' });
              setShowSuccessOverlay(true);
              registrarAccion("¡Expediente completado y formalizado detectado!");
              addToast("Expediente firmado y PDFs generados", 'success');
              clearInterval(interval);
            }
          } else if (res?.status === 'error') {
            // Si el backend dice error (ej. no encontrado), no spameamos logs de éxito
            console.warn("Polling: Cliente no encontrado aún o error de servidor.");
          }
        } catch (err) {
          console.error("Error en polling de estatus:", err);
        }
      }, 5000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeStep, data.id, data.estatusfirma]);

  useEffect(() => {
    setCurrentCase({
      cliente: data,
      diagnostico: hojaServicio
    });
  }, [data, hojaServicio, setCurrentCase]);

  const registrarAccion = (texto: string) => setAuditLog(prev => [{fecha: new Date().toLocaleTimeString(), accion: texto}, ...prev]);

  const updateData = (newData: Partial<Cliente>) => {
    setData(prev => ({ ...prev, ...newData }));
  };

  const addNssAdicional = () => {
    setData(prev => ({ ...prev, nssList: [...(prev.nssList || []), ""] }));
    registrarAccion("Se añadió un campo para NSS adicional.");
  };

  const updateNssAdicional = (index: number, val: string) => {
    const newList = [...(data.nssList || [])];
    newList[index] = val.replace(/\D/g, '').substring(0, 11);
    updateData({ nssList: newList });
  };

  const removeNssAdicional = (index: number) => {
    const newList = data.nssList?.filter((_, i) => i !== index);
    updateData({ nssList: newList });
    registrarAccion("Se eliminó un campo de NSS adicional.");
  };

  const addContactoExtra = () => {
    setData(prev => ({ ...prev, contactosExtra: [...(prev.contactosExtra || []), { etiqueta: '', valor: '' }] }));
    registrarAccion("Se añadió un campo para contacto adicional.");
  };

  const updateContactoExtra = (index: number, field: 'etiqueta' | 'valor', val: string) => {
    const newList = [...(data.contactosExtra || [])];
    newList[index] = { ...newList[index], [field]: val };
    updateData({ contactosExtra: newList });
  };

  const removeContactoExtra = (index: number) => {
    const newList = data.contactosExtra?.filter((_, i) => i !== index);
    updateData({ contactosExtra: newList });
    registrarAccion("Se eliminó un campo de contacto adicional.");
  };

  const handleSearch = async () => {
    const cleanCurp = curpSearch.toUpperCase().replace(/\s+/g, '').trim();
    if (!cleanCurp && !nameSearch) return; // Validación básica
    
    setIsSearching(true);
    setSearchPerformed(true);
    
    try {
      // 1. Búsqueda rápida por CURP/ID (Prioridad alta)
      if (cleanCurp.length >= 10) {
        const res = await getGASData('GET_CLIENTE_STATUS', { curp: cleanCurp });
        const c = res?.data || res?.cliente;
        if (c) { setFoundClients([c]); setIsSearching(false); return; }
      }

      // 2. Búsqueda filtrada (Solo si no hubo match por CURP y el nombre tiene al menos 3 letras)
      if (nameSearch.length < 3) {
        addToast("Ingresa al menos 3 letras para buscar por nombre.", "info");
        setFoundClients([]);
        setIsSearching(false);
        return;
      }

      const res = await getGASData('GET_DATA', { sheetName: 'CLIENTES' });
      const list = res?.data || [];
      const normalize = (s: string) => s?.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() || "";
      const queryTokens = normalize(nameSearch).split(/\s+/).filter(t => t.length > 0);
      
      // Filtrado optimizado: break temprano si no matchea
      setFoundClients(list.filter((c: any) => {
        const full = normalize(`${c.nombre || ''} ${c.apellidos || ''}`);
        return queryTokens.every(token => full.includes(token));
      }));
    } catch (e) {
      addToast("Error al buscar. Reintenta.", "error");
    } finally { 
      setIsSearching(false); 
    }
  };

  const handleNewClient = () => {
    const tempId = `NEW_${Date.now().toString().slice(-6)}`;
    setData({
      id: tempId, estatusfirma: 'PENDIENTE', expedienteExistingFiles: {}, nombre: '', curp: '', rfc: '', nss: '', nssList: [], whatsapp: '', email: '', semanasCotizadas: 0, semanasExtra: 0, metadatosAuditoria: { metodoCaptura: 'Manual', matchDocumental: false, alertas: [], discrepancias: [] }
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
    setFileProgress(prev => ({ ...prev, [type]: 5 }));
    
    // Simular progreso de análisis
    const progressInterval = setInterval(() => {
      setFileProgress(prev => {
        const current = prev[type] || 0;
        if (current < 90) return { ...prev, [type]: current + Math.floor(Math.random() * 5) + 2 };
        return prev;
      });
    }, 400);

    try {
      addToast(`Analizando ${type.toUpperCase()}...`, 'info');
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      
      setFilePreviews(prev => ({ ...prev, [type]: base64 }));
      setFileProgress(prev => ({ ...prev, [type]: 30 }));
      
      try {
        const extracted = await extractDocumentData(base64, file.type, type.toUpperCase());
        setOcrSummaries(prev => ({ ...prev, [type]: extracted }));
        setFileProgress(prev => ({ ...prev, [type]: 85 }));
        const updatePayload: any = { expedienteExistingFiles: { ...data.expedienteExistingFiles, [type]: true } };

        // Mapeo Inteligente Basado en el Tipo de Documento Oficial
        const newLocked = new Set(lockedFields);

        if (type === 'ine') {
          if (extracted.nombre) { updatePayload.nombre = extracted.nombre; newLocked.add('nombre'); }
          if (extracted.curp && extracted.curp.length === 18) { updatePayload.curp = extracted.curp; newLocked.add('curp'); }
          if (extracted.domicilio) { updatePayload.domicilio = extracted.domicilio; newLocked.add('domicilio'); }
          registrarAccion(`Identidad (INE) procesada vía OCR.`);
          addToast("INE validada correctamente", 'success');
        } else if (type === 'csf') {
          if (extracted.rfc) { updatePayload.rfc = extracted.rfc; newLocked.add('rfc'); }
          if (extracted.curp && extracted.curp.length === 18) { updatePayload.curp = extracted.curp; newLocked.add('curp'); }
          if (extracted.nombre && !data.nombre) { updatePayload.nombre = extracted.nombre; newLocked.add('nombre'); }
          if (extracted.regimenFiscal) { updatePayload.regimenFiscal = extracted.regimenFiscal; newLocked.add('regimenFiscal'); }
          if (extracted.codigoPostal) { updatePayload.codigoPostal = extracted.codigoPostal; newLocked.add('codigoPostal'); }
          if (extracted.domicilio) { updatePayload.domicilio = extracted.domicilio; newLocked.add('domicilio'); }
          
          registrarAccion(`Constancia Fiscal procesada vía OCR.`);
          addToast("CSF validada correctamente", 'success');
        } else if (type === 'semanas') {
          if (extracted.nss) { updatePayload.nss = extracted.nss; newLocked.add('nss'); }
          if (extracted.semanasCotizadas > 0) { updatePayload.semanasCotizadas = extracted.semanasCotizadas; newLocked.add('semanasCotizadas'); }
          if (extracted.ultimoSalario > 0) { updatePayload.ultimoSalario = extracted.ultimoSalario; newLocked.add('ultimoSalario'); }
          registrarAccion(`Reporte de Semanas procesado vía OCR.`);
          addToast("Semanas IMSS extraídas", 'success');
        } else if (type === 'domicilio') {
          if (extracted.domicilio) { updatePayload.domicilio = extracted.domicilio; newLocked.add('domicilio'); }
          registrarAccion(`Domicilio extraído. Identidad protegida (nombre de tercero ignorado).`);
          addToast("Domicilio validado", 'success');
        } else if (type === 'complementario') {
          const nuevasAlertas = [...((data.metadatosAuditoria as any)?.alertas || [])];
          if (extracted.tipo_complemento === 'Hoja Rosa') {
            const msg = '⚠️ Evidencia detectada: Este documento es sustento legal para un Trámite de Búsqueda de Semanas Manual.';
            nuevasAlertas.push(msg);
            addToast("Hoja Rosa Detectada", 'info');
          }
          
          if (extracted.semanas_extra > 0) {
            updatePayload.semanasExtra = (data.semanasExtra || 0) + extracted.semanas_extra;
            updatePayload.semanasExtraDictaminadas = extracted.semanas_extra;
            newLocked.add('semanasExtra');
            newLocked.add('semanasExtraDictaminadas');
            const msg = `✅ ${extracted.semanas_extra} semanas extra encontradas.`;
            nuevasAlertas.push(msg);
            addToast(msg, 'success');
          }

          updatePayload.metadatosAuditoria = { ...data.metadatosAuditoria, alertas: nuevasAlertas } as any;
          registrarAccion(`Doc Complementario procesado: ${extracted.tipo_complemento}. ${extracted.semanas_extra > 0 ? extracted.semanas_extra + ' semanas encontradas.' : ''}`);
        } else {
          // Fallback para otros documentos
           Object.assign(updatePayload, extracted);
           registrarAccion(`Archivo ${type.toUpperCase()} cargado y validado vía OCR.`);
           addToast(`${type.toUpperCase()} cargado`, 'success');
        }
        
        setLockedFields(newLocked);
        updateData(updatePayload);
        setFileProgress(prev => ({ ...prev, [type]: 100 }));
      } catch (ocrError: any) {
        console.error("OCR Process Failed:", ocrError);
        updateData({ expedienteExistingFiles: { ...data.expedienteExistingFiles, [type]: true } });
        setFileProgress(prev => ({ ...prev, [type]: 100 }));
        if (ocrError?.message && ocrError.message.includes("Cuota de IA excedida")) {
           addToast("Cuota de IA excedida. Captura manualmente.", 'error');
        } else {
           addToast(`Error al procesar ${type.toUpperCase()}`, 'error');
        }
        registrarAccion(`Archivo ${type.toUpperCase()} cargado (fallo OCR: ${ocrError?.message || 'Error desconocido'}).`);
      }

      if (data.id?.startsWith('NEW_')) {
        setPendingUploads(prev => ({ ...prev, [type]: base64.split(',')[1] }));
      } else {
        const folderId = data.id_carpeta_drive || data.idcarpetadrive || data.idCarpetaDrive;
        callGAS('UPLOAD_FILE', { 
          fileName: `${type.toUpperCase()}_${data.id}.pdf`, 
          fileData: base64.split(',')[1], 
          id_carpeta_drive: folderId 
        });
      }
    } finally { 
       clearInterval(progressInterval);
       setIsProcessing(false); 
       setAnalyzingCount(prev => Math.max(0, prev - 1));
       setUploadingId(null); 
       setTimeout(() => {
         setFileProgress(prev => {
            const n = {...prev};
            delete n[type];
            return n;
         });
       }, 2000);
    }
  };

  const handleSiguientePasoDocs = async () => {
      if (!data.whatsapp || data.whatsapp.length < 10) {
        addToast("El número de WhatsApp es obligatorio (mínimo 10 dígitos).", 'error');
        return;
      }
      if (!data.email || !data.email.includes('@')) {
        addToast("El correo electrónico es obligatorio y debe ser válido.", 'error');
        return;
      }

    if (data.id?.startsWith('NEW_')) {
      if (!data.nombre) {
        addToast("El nombre del cliente es obligatorio.", 'error');
        return;
      }
      if (!data.curp || data.curp.length !== 18) {
        addToast("Error: La CURP es obligatoria y debe tener exactamente 18 caracteres.", 'error');
        return;
      }
      setIsProcessing(true);
      try {
        const curp10 = data.curp.substring(0, 10).toUpperCase();
        // Garantizar payload de 22 campos 
        const payloadCompleto = {
          ...data,
          id: curp10,
          curp: data.curp.toUpperCase()
        };
        const res = await callGAS('CREATE_CLIENTE', payloadCompleto);
        
        if (res?.success || res?.id_carpeta_drive) {
          const idCarpetaDrive = res.id_carpeta_drive || res.idcarpetadrive;
          if (Object.keys(pendingUploads).length > 0) {
            await Promise.all(Object.entries(pendingUploads).map(([type, base64]) => 
              callGAS('UPLOAD_FILE', { fileName: `${type.toUpperCase()}_${curp10}.pdf`, fileData: base64, id_carpeta_drive: idCarpetaDrive })
            ));
            setPendingUploads({});
          }
          updateData({ id: curp10, id_carpeta_drive: idCarpetaDrive });
          setActiveStep(3);
          addToast("Expediente creado correctamente", 'success');
        } else {
           addToast(res?.error || "Hubo un problema al crear el expediente.", 'error');
        }
      } catch (err: any) {
         console.error(err);
         addToast("Error de conexión al crear expediente.", 'error');
      } finally { setIsProcessing(false); }
    } else {
      setActiveStep(3);
    }
  };

  const redactarIA = async () => {
    setIsAiDrafting(true);
    addToast("Generando diagnóstico con IA...", 'info');
    try {
      const edad = calculateDetailedAge(data.curp || '');
      const edadTexto = edad ? `${edad.anios} años` : 'Desconocida';
      const promptText = `Basado en estas intenciones y necesidades que el asesor detectó: ${iaContext}, y los datos técnicos del caso: Semanas IMSS=${data.semanasCotizadas}, Edad=${edadTexto}, Salario=${data.ultimoSalario}, redacta un diagnóstico inicial profesional dirigido al cliente.`;
      const draft = await getConsultorChatResponse([{ role: 'user', parts: [{ text: promptText }] }], data);
      setHojaServicio(prev => ({ ...prev, notasDiagnostico: draft }));
      addToast("Diagnóstico redactado", 'success');
    } catch (error: any) {
      addToast(`Error de IA: ${error.message || 'Desconocido'}`, 'error');
    } finally { setIsAiDrafting(false); }
  };

  const handleSiguientePasoDictamen = () => {
    if (hojaServicio.servicios.length === 0 && !hojaServicio.otroServicioTexto) {
      addToast("Selecciona al menos un servicio para continuar.", 'error');
      return;
    }
    if (!hojaServicio.notasDiagnostico.trim()) {
      addToast("El diagnóstico técnico no puede estar vacío.", 'error');
      return;
    }
    setActiveStep(4);
  };

  const handleSellarExpediente = async () => {
    if (!asesorNombre || sigCanvasAsesor.current?.isEmpty()) {
      addToast("El asesor debe firmar antes de formalizar el envío.", 'error'); return;
    }
    
    setIsProcessing(true);
    const firmaAsesor = sigCanvasAsesor.current?.getTrimmedCanvas().toDataURL('image/png');
    const serviciosFinales = hojaServicio.servicios.map(s => s.nombre);
    if (hojaServicio.otroServicioTexto) serviciosFinales.push(hojaServicio.otroServicioTexto);

    try {
      const yaTieneContrato = data.contrato_url && data.contrato_url.length > 5;
      const tipoDocEval = yaTieneContrato ? 'DIAGNOSTICO' : 'CONTRATO_Y_DIAGNOSTICO';

      console.log("DATA_DEBUG", "Payload enviado a FINALIZE_AUDIT:", data);
      const res = await callGAS('FINALIZE_AUDIT', {
        ...data,
        asesor: asesorNombre,
        firmaAsesor,
        dictamen: hojaServicio.notasDiagnostico,
        servicios: serviciosFinales.join(', '),
        monto: hojaServicio.honorariosAcordados,
        auditLog: JSON.stringify(auditLog),
        tipoDocEval // Send eval rule directly to backend
      });

      if (res?.success) {
         const realId = res.id || data.id;
         if (data.id !== realId) {
            setData(prev => ({ ...prev, id: realId, id_carpeta_drive: res.id_carpeta_drive || data.id_carpeta_drive }));
         }

         const tipoDoc = tipoDocEval;
         
         const baseUrl = window.location.origin;
         const link = `${baseUrl}/firma-externa/${realId}?tipoDoc=${tipoDoc}`;
         setFinalLink(link);
         setCertificationReady(true);

         addToast("Expediente sellado y sellos generados ✓", 'success');
         registrarAccion(`Expediente Certificado. Preparado para envío (${tipoDoc}).`);

         // Disparar WhatsApp automáticamente si hay número
         if (data.whatsapp) {
           setTimeout(() => {
             handleEnviarNotificacion('whatsapp', link);
           }, 500);
         }
      } else {
         addToast("La certificación falló", 'error');
      }
    } catch (e) {
      addToast("Error al finalizar", 'error');
    } finally { setIsProcessing(false); }
  };

  const handleEnviarNotificacion = (method: 'whatsapp' | 'email', overrideLink?: string) => {
    const yaTieneContrato = data.contrato_url && data.contrato_url.length > 5;
    const tipoDoc = yaTieneContrato ? 'DIAGNOSTICO' : 'CONTRATO_Y_DIAGNOSTICO';
    const linkAEnviar = overrideLink || finalLink;
    const mensaje = `Hola ${data.nombre || 'Cliente'}, soy ${asesorNombre} de Social Push®. Hemos generado tu ${yaTieneContrato ? 'Hoja de Diagnóstico' : 'Contrato y Diagnóstico'} técnico. Por favor, revísalo y fírmalo aquí: ${linkAEnviar}`;

    if (method === 'whatsapp') {
       const phone = (data.whatsapp || '').toString().replace(/\D/g, '');
       const waNumber = phone.length === 10 ? `52${phone}` : phone;
       const url = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(mensaje)}`;
       window.open(url, '_blank') || (window.location.href = url);
    } else {
       const mailUrl = `mailto:${data.email}?subject=${encodeURIComponent(`Formalización - Social Push® (${tipoDoc})`)}&body=${encodeURIComponent(mensaje)}`;
       window.location.href = mailUrl;
    }
  };

  const detailedAge = data.curp ? calculateDetailedAge(data.curp) : null;
  const nivelCerteza = (data.expedienteExistingFiles?.semanas && data.expedienteExistingFiles?.csf) ? 'Alto' : 'Bajo';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <header className="bg-[#003366] py-5 px-8 flex justify-between items-center shadow-xl sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-[#DAA520] p-2.5 rounded-xl shadow-lg"><ShieldCheck className="text-[#003366]" size={24} /></div>
          <h1 className="text-lg font-black text-white uppercase tracking-tight">Social Push® ERP</h1>
        </div>
        {data.id && <button onClick={() => {if(confirm("¿Cerrar caso?")) window.location.reload();}} className="px-5 py-2 bg-white/10 text-white rounded-lg text-[10px] font-black uppercase">Cerrar Caso</button>}
      </header>

      <div className={cn("flex-1 w-full mx-auto flex items-start", activeStep > 1 ? "max-w-[1600px] gap-8 px-6 lg:px-8 py-6" : "max-w-7xl")}>
        <main className={cn("flex-1 w-full min-w-0 origin-top", activeStep <= 1 && "p-6 md:p-8")}>
        {analyzingCount > 0 && (
           <div className="fixed top-[72px] left-0 right-0 h-1 z-50 overflow-hidden bg-slate-200">
             <div className="h-full bg-[#DAA520] animate-[shimmer_2s_infinite] transition-all duration-500" style={{ width: `${Math.min(95, (Object.values(fileProgress).reduce((a, b) => a + b, 0) / analyzingCount))}%` }} />
           </div>
        )}
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
          <div className="space-y-8 animate-in fade-in">
            {renderStatusBanner()}
            <div className="bg-white p-10 rounded-[48px] shadow-2xl border border-slate-100 space-y-8">
                <div className="flex items-center gap-4 border-b border-slate-100 pb-6"><FileSearch size={28} className="text-[#003366]"/><h3 className="text-2xl font-black text-[#003366] uppercase">1. Digitalización Segura</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                            <div key={doc.id} className={cn("p-6 rounded-[32px] border-2 transition-all flex flex-col gap-5 relative", exists ? "bg-emerald-50/30 border-emerald-100" : "bg-slate-50 border-slate-100 hover:border-[#003366]")}>
                              {exists && <button onClick={() => updateData({ expedienteExistingFiles: {...data.expedienteExistingFiles, [doc.id]: false}})} className="absolute top-4 right-4 p-2 text-red-400 hover:bg-red-50 rounded-full z-30 transition-all"><Trash2 size={18}/></button>}
                              
                              <div className="flex items-center gap-4">
                                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-md shrink-0 transition-transform duration-500", exists ? "bg-emerald-500 text-white" : "bg-white text-slate-300")}>
                                   {exists ? <CheckCircle2 size={24} /> : <FileText size={24} />}
                                </div>
                                <div className="text-left">
                                   <p className="text-[10px] md:text-[11px] font-black uppercase leading-tight text-slate-900 break-words">{doc.label}</p>
                                   <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 leading-tight">{doc.sub}</p>
                                </div>
                              </div>

                              {/* Preview Area */}
                              {exists && filePreviews[doc.id] && (
                                <div className="w-full aspect-[4/3] rounded-2xl bg-white border border-slate-100 overflow-hidden relative group/preview shadow-inner">
                                   {filePreviews[doc.id].includes('data:application/pdf') ? (
                                     <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 gap-2">
                                        <FileText size={32} />
                                        <span className="text-[8px] font-black uppercase tracking-widest">Documento PDF</span>
                                     </div>
                                   ) : (
                                     <img src={filePreviews[doc.id]} alt="Preview" className="w-full h-full object-cover grayscale group-hover/preview:grayscale-0 transition-all duration-700" />
                                   )}
                                   <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                                </div>
                              )}

                              {/* Extracted Details Summary */}
                              {exists && ocrSummaries[doc.id] && (
                                <div className="bg-white/60 p-4 rounded-2xl border border-slate-100 space-y-2 text-left animate-in slide-in-from-top-2 duration-500">
                                   <h5 className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                                      <FileSearch size={10} className="text-[#DAA520]" /> Datos Identificados
                                   </h5>
                                   <div className="grid grid-cols-1 gap-1.5">
                                      {ocrSummaries[doc.id].nombre && <div className="flex justify-between items-center"><span className="text-[7px] font-bold text-slate-400 uppercase">Nombre:</span><span className="text-[8px] font-black uppercase text-slate-600 truncate ml-2 max-w-[120px]">{ocrSummaries[doc.id].nombre}</span></div>}
                                      {ocrSummaries[doc.id].curp && <div className="flex justify-between items-center"><span className="text-[7px] font-bold text-slate-400 uppercase">CURP:</span><span className="text-[8px] font-mono font-bold text-[#003366]">{ocrSummaries[doc.id].curp}</span></div>}
                                      {ocrSummaries[doc.id].rfc && <div className="flex justify-between items-center"><span className="text-[7px] font-bold text-slate-400 uppercase">RFC:</span><span className="text-[8px] font-mono font-bold text-[#003366]">{ocrSummaries[doc.id].rfc}</span></div>}
                                      {(ocrSummaries[doc.id].codigoPostal || ocrSummaries[doc.id].codigo_postal || ocrSummaries[doc.id].cp) && (
                                        <div className="flex justify-between items-center">
                                          <span className="text-[7px] font-bold text-slate-400 uppercase">C.P.:</span>
                                          <span className="text-[8px] font-mono font-bold text-[#003366]">
                                            {ocrSummaries[doc.id].codigoPostal || ocrSummaries[doc.id].codigo_postal || ocrSummaries[doc.id].cp}
                                          </span>
                                        </div>
                                      )}
                                      {ocrSummaries[doc.id].nss && <div className="flex justify-between items-center"><span className="text-[7px] font-bold text-slate-400 uppercase">NSS:</span><span className="text-[8px] font-mono font-bold text-[#003366]">{ocrSummaries[doc.id].nss}</span></div>}
                                      {ocrSummaries[doc.id].semanasCotizadas > 0 && <div className="flex justify-between items-center"><span className="text-[7px] font-bold text-slate-400 uppercase">Semanas:</span><span className="text-[8px] font-black text-emerald-600">{ocrSummaries[doc.id].semanasCotizadas}</span></div>}
                                   </div>
                                </div>
                              )}

                              <button onClick={() => { activeUploadRef.current = doc.id; fileInputRef.current?.click(); }} disabled={uploadingId === doc.id} className={cn("w-full py-4 rounded-2xl font-black text-[10px] uppercase shadow-md transition-all relative overflow-hidden mt-auto", exists ? "bg-white text-emerald-600 border border-emerald-100" : "bg-[#003366] text-white")}>
                                 {uploadingId === doc.id ? (
                                    <>
                                       <div className="absolute inset-0 bg-[#002244] z-0" />
                                       <div 
                                          className="absolute inset-y-0 left-0 bg-[#DAA520] transition-all duration-300 z-10" 
                                          style={{ width: `${fileProgress[doc.id] || 0}%` }} 
                                       />
                                       <span className="relative z-20 flex items-center justify-center gap-2">
                                          <Loader2 className="animate-spin" size={12}/> 
                                          {fileProgress[doc.id] < 100 ? "Analizando..." : "Listo ✓"} {fileProgress[doc.id] || 0}%
                                       </span>
                                    </>
                                 ) : (exists ? "Auditado ✅" : "Subir Archivo")}
                              </button>
                              {uploadingId === doc.id && (
                                <p className="text-[8px] font-black uppercase text-[#DAA520] animate-pulse">Procesando OCR con Gemini...</p>
                              )}
                            </div>
                          );
                        })}
                    </div>
                </div>
          </div>
        )}

        {activeStep === 3 && (
            <div className="bg-white p-10 rounded-[48px] shadow-2xl border border-slate-100 space-y-10 animate-in fade-in">
                <div className="flex items-center gap-4 border-b pb-6"><Briefcase size={28} className="text-[#DAA520]"/><h3 className="text-2xl font-black text-[#003366] uppercase tracking-tighter">2. Hoja de Diagnóstico y Servicio</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Catálogo de Servicios</label>
                            <div className="grid grid-cols-1 gap-2">
                                {CATALOGO_SERVICIOS.map(srv => {
                                    const selectedService = hojaServicio.servicios.find(s => s.nombre === srv);
                                    const isSelected = !!selectedService;
                                    return (
                                        <div key={srv} className={cn("p-4 border rounded-2xl transition-all space-y-3", isSelected ? "bg-[#003366]/5 border-[#003366]/20" : "bg-slate-50 border-slate-100 hover:bg-slate-100")}>
                                            <label className="flex items-center justify-between cursor-pointer">
                                                <div className="flex items-center gap-3">
                                                    <input type="checkbox" checked={isSelected} onChange={(e) => {
                                                        const updated = e.target.checked 
                                                            ? [...hojaServicio.servicios, { nombre: srv, universo: 'U1' as const, precio: 0 }]
                                                            : hojaServicio.servicios.filter(s => s.nombre !== srv);
                                                        const total = updated.reduce((sum, s) => sum + s.precio, 0);
                                                        setHojaServicio(prev => ({...prev, servicios: updated, honorariosAcordados: total}));
                                                    }} className="hidden"/>
                                                    <span className={cn("text-xs font-bold", isSelected && "text-[#003366]")}>{srv}</span>
                                                </div>
                                                {isSelected && <CheckCircle2 size={16} className="text-[#DAA520]" />}
                                            </label>
                                            
                                            {/* Sub-form if selected */}
                                            <AnimatePresence>
                                              {isSelected && (
                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex gap-2 items-center pt-2 overflow-hidden">
                                                    <select 
                                                      className="p-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase text-slate-600 outline-none focus:border-[#003366] shadow-sm"
                                                      value={selectedService.universo}
                                                      onChange={(e) => {
                                                          const updated = [...hojaServicio.servicios];
                                                          const idx = updated.findIndex(s => s.nombre === srv);
                                                          if(idx>=0) updated[idx].universo = e.target.value as 'U1' | 'U2';
                                                          setHojaServicio({...hojaServicio, servicios: updated});
                                                      }}
                                                    >
                                                      <option value="U1">U1 (única vez)</option>
                                                      <option value="U2">U2 (recurrente)</option>
                                                    </select>
                                                    <div className="relative flex-1">
                                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                                      <input 
                                                        type="number"
                                                        placeholder="Honorario..."
                                                        className="w-full p-2 pl-6 bg-white border border-slate-200 rounded-lg text-xs font-bold text-[#003366] outline-none focus:border-[#DAA520] shadow-sm"
                                                        value={selectedService.precio || ''}
                                                        onChange={(e) => {
                                                            const price = Number(e.target.value);
                                                            const updated = [...hojaServicio.servicios];
                                                            const idx = updated.findIndex(s => s.nombre === srv);
                                                            if(idx>=0) updated[idx].precio = price;
                                                            const total = updated.reduce((sum, s) => sum + s.precio, 0);
                                                            setHojaServicio({...hojaServicio, servicios: updated, honorariosAcordados: total});
                                                        }}
                                                      />
                                                    </div>
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                                      <label className="text-[9px] font-black uppercase text-slate-400 px-2">Otros Servicios</label>
                                      <button 
                                        type="button" 
                                        onClick={() => setHojaServicio({...hojaServicio, servicios: [...hojaServicio.servicios, { nombre: 'Otro', universo: 'U1', precio: 0 }]})}
                                        className="bg-[#DAA520] text-[#003366] px-3 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 hover:bg-[#c9961d] transition-all"
                                      >
                                        <PlusCircle size={10}/> AGREGAR OTRO
                                      </button>
                                    </div>
                                    
                                    {hojaServicio.servicios.map((srv, idx) => {
                                      if (srv.nombre !== 'Otro' && CATALOGO_SERVICIOS.includes(srv.nombre)) return null; // Standard services are rendered above
                                      return (
                                        <div key={`custom-srv-${idx}`} className="flex gap-2 items-center group animate-in slide-in-from-left duration-300">
                                          <div className="flex-1 relative flex gap-2">
                                            <input 
                                              type="text" 
                                              placeholder="Nombre del servicio..." 
                                              className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-[#003366] shadow-sm"
                                              value={srv.nombre === 'Otro' ? '' : srv.nombre}
                                              onChange={(e) => {
                                                  const updated = [...hojaServicio.servicios];
                                                  updated[idx].nombre = e.target.value || 'Otro';
                                                  setHojaServicio({...hojaServicio, servicios: updated});
                                              }}
                                            />
                                            <select 
                                              className="p-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase text-slate-600 outline-none focus:border-[#003366] shadow-sm w-30"
                                              value={srv.universo}
                                              onChange={(e) => {
                                                  const updated = [...hojaServicio.servicios];
                                                  updated[idx].universo = e.target.value as 'U1' | 'U2';
                                                  setHojaServicio({...hojaServicio, servicios: updated});
                                              }}
                                            >
                                                <option value="U1">U1 (única vez)</option>
                                                <option value="U2">U2 (recurrente)</option>
                                            </select>
                                            <input 
                                              type="number" 
                                              placeholder="Precio..." 
                                              className="w-24 p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-[#003366] shadow-sm"
                                              value={srv.precio || ''}
                                              onChange={(e) => {
                                                  const price = Number(e.target.value);
                                                  const updated = [...hojaServicio.servicios];
                                                  updated[idx].precio = price;
                                                  const total = updated.reduce((sum, s) => sum + s.precio, 0);
                                                  setHojaServicio({...hojaServicio, servicios: updated, honorariosAcordados: total});
                                              }}
                                            />
                                            <button 
                                              type="button" 
                                              onClick={() => {
                                                  const updated = hojaServicio.servicios.filter((_, i) => i !== idx);
                                                  const total = updated.reduce((sum, s) => sum + s.precio, 0);
                                                  setHojaServicio({...hojaServicio, servicios: updated, honorariosAcordados: total});
                                              }}
                                              className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                                            >
                                              <Trash2 size={16}/>
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}

                                    <textarea 
                                      value={hojaServicio.otroServicioTexto} 
                                      onChange={(e) => setHojaServicio({...hojaServicio, otroServicioTexto: e.target.value})} 
                                      placeholder="Notas adicionales sobre servicios especiales..." 
                                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-[#003366] shadow-inner min-h-[80px]"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4 p-6 bg-[#003366] rounded-[32px] border border-white/10 shadow-2xl">
                            <label className="text-[10px] font-black uppercase text-[#DAA520] tracking-widest text-center block">Propuesta Económica y Recurrencia</label>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <button onClick={() => setHojaServicio(prev => ({...prev, universo: 'U1'}))} className={cn("p-4 border-2 rounded-2xl font-black text-[10px] uppercase transition-all flex flex-col items-center gap-1", hojaServicio.universo === 'U1' ? "border-[#DAA520] bg-[#DAA520] text-[#003366]" : "bg-white/5 text-white/40 border-white/10")}>
                                    <span>U1</span>
                                    <span className="text-[8px] opacity-70">Única Vez</span>
                                </button>
                                <button onClick={() => setHojaServicio(prev => ({...prev, universo: 'U2'}))} className={cn("p-4 border-2 rounded-2xl font-black text-[10px] uppercase transition-all flex flex-col items-center gap-1", hojaServicio.universo === 'U2' ? "border-[#DAA520] bg-[#DAA520] text-[#003366]" : "bg-white/5 text-white/40 border-white/10")}>
                                    <span>U2</span>
                                    <span className="text-[8px] opacity-70">Recurrente</span>
                                </button>
                            </div>
                            <div className="relative">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[#DAA520] font-black text-xl">$</span>
                                <input type="number" value={hojaServicio.honorariosAcordados || ''} onChange={(e) => setHojaServicio(prev => ({...prev, honorariosAcordados: Number(e.target.value)}))} placeholder="0.00" className="w-full pl-10 p-5 bg-white/10 border border-white/10 rounded-2xl font-black text-2xl text-white focus:border-[#DAA520] outline-none shadow-inner"/>
                            </div>
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
                        <textarea value={hojaServicio.notasDiagnostico} onChange={(e) => setHojaServicio(prev => ({...prev, notasDiagnostico: e.target.value}))} className="flex-1 w-full bg-slate-800 text-emerald-50 border border-slate-700 rounded-2xl p-4 text-sm font-medium leading-relaxed outline-none focus:border-emerald-500 resize-none custom-scrollbar" placeholder="El dictamen técnico final aparecerá aquí..."/>
                    </div>
                </div>
                <button onClick={handleSiguientePasoDictamen} className="w-full py-5 bg-[#DAA520] text-[#003366] rounded-[24px] font-black uppercase shadow-xl flex items-center justify-center gap-3">Previsualizar y Sellar Diagnóstico <ArrowRight /></button>
            </div>
        )}

        {activeStep === 4 && (
            <div className="bg-white p-12 rounded-[48px] shadow-2xl border border-slate-100 space-y-10 animate-in slide-in-from-bottom relative">
                {/* 3. COMUNICACIÓN Y MONITOREO EN TIEMPO REAL - Bloqueo de edición */}
                {data.estatusfirma === 'FIRMADO' && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-40 rounded-[48px] flex items-center justify-center p-10">
                    <div className="bg-[#003366] text-white p-12 rounded-[40px] shadow-2xl text-center space-y-6 max-w-sm border-4 border-[#DAA520] animate-bounce">
                      <CheckCircle2 size={80} className="text-[#DAA520] mx-auto" />
                      <h3 className="text-2xl font-black uppercase tracking-tighter italic">¡Expediente Formalizado y Guardado con Éxito! ✅</h3>
                      <p className="text-sm font-bold opacity-80 uppercase leading-tight">El cliente ha certificado el diagnóstico. Este caso ha sido cerrado.</p>
                      <button onClick={() => window.confirm('¿Cerrar este caso y volver al inicio?') && window.location.reload()} className="w-full py-4 bg-[#DAA520] text-[#003366] rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all">Panel de Inicio</button>
                    </div>
                  </div>
                )}

                <div className="text-center space-y-4">
                    <div className="bg-[#DAA520]/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto shadow-inner"><FileSignature size={48} className="text-[#DAA520]" /></div>
                    <h4 className="text-4xl font-black uppercase text-[#003366] tracking-tighter">3. Hoja de Diagnóstico y Servicios</h4>
                </div>

                <div className="bg-[#003366] text-white p-10 rounded-[40px] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 border-b-8 border-[#DAA520]">
                   <div className="flex-1">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-[#DAA520] mb-3">Resumen Ejecutivo de Servicios</h5>
                      <div className="flex flex-wrap gap-2">
                        {hojaServicio.servicios.map((s, idx) => (
                          <span key={`${s.nombre}-${idx}`} className="bg-white/10 px-4 py-1.5 rounded-full text-[10px] font-bold border border-white/10">{s.nombre}</span>
                        ))}
                        {hojaServicio.otroServicioTexto && <span className="bg-[#DAA520] text-[#003366] px-4 py-1.5 rounded-full text-[10px] font-black">{hojaServicio.otroServicioTexto}</span>}
                      </div>
                   </div>
                   <div className="text-right bg-black/20 p-6 rounded-3xl border border-white/5 shadow-inner min-w-[200px]">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-[#DAA520] mb-1">Monto Total de Honorarios</h5>
                      <p className="text-4xl font-black text-white">${hojaServicio.honorariosAcordados.toLocaleString()}</p>
                   </div>
                </div>

                <div className="bg-slate-50 p-10 rounded-[40px] border border-slate-200 h-[450px] overflow-y-auto text-xs font-mono text-slate-700 leading-relaxed shadow-inner custom-scrollbar relative">
                   {/* Diagnóstico Final Window */}
                   <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none -rotate-12"><FileText size={160} /></div>
                   <div className="relative z-10 space-y-8">
                      <div className="border-b border-slate-200 pb-6 text-center">
                         <img src="https://picsum.photos/seed/bakso/200/50" alt="BAKSO Logo" className="h-8 mx-auto grayscale mb-4 opacity-50" />
                         <h3 className="font-black text-xl uppercase text-slate-900 tracking-tighter">CERTIFICACIÓN DE DIAGNÓSTICO TÉCNICO</h3>
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Social Push® "La Visión del Mañana... HOY" | Bakso S.C.</p>
                      </div>
                      <div className="grid grid-cols-3 gap-6 text-[10px] uppercase font-black text-slate-400 border-b pb-6">
                        <div><p>CLIENTE:</p><p className="text-slate-900">{data.nombre}</p></div>
                        <div><p>CURP:</p><p className="text-slate-900">{data.curp}</p></div>
                        <div><p>RFC:</p><p className="text-slate-900">{data.rfc}</p></div>
                      </div>
                      <div className="bg-white p-8 rounded-3xl border border-slate-200 italic text-slate-900 leading-normal whitespace-pre-wrap text-sm shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-2 h-full bg-[#DAA520]" />
                        {hojaServicio.notasDiagnostico}
                      </div>
                      <div className="border-t border-slate-200 pt-8 flex justify-between items-end">
                          <div>
                            <p className="font-black text-slate-900 uppercase text-[10px] tracking-widest mb-4">Fundamentación Legal y Validez:</p>
                            <p className="max-w-md text-[9px] text-slate-400 leading-tight">La presente certificación y el consentimiento estampado vía firma digital en el portal externo institucional de SOCIAL PUSH® cuentan con plena validez jurídica conforme al Artículo 1803 del Código Civil Federal y leyes supletorias.</p>
                          </div>
                          {sigCanvasAsesor.current && !sigCanvasAsesor.current.isEmpty() && (
                            <div className="text-center">
                              <img src={sigCanvasAsesor.current.getTrimmedCanvas().toDataURL()} className="h-16 mx-auto mb-1 contrast-125 grayscale" alt="Firma Asesor" />
                              <div className="h-[1px] w-32 bg-slate-400 mx-auto" />
                              <p className="text-[8px] font-black uppercase text-slate-400 mt-1">{asesorNombre} (ASESOR CERTIFICADO)</p>
                            </div>
                          )}
                      </div>
                   </div>
                </div>

                {/* ADVERTENCIA DE VALIDACION ANTES DE SELLAR */}
                {Object.keys(data.expedienteExistingFiles || {}).length < 2 && (
                   <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl text-orange-600 font-bold text-xs flex items-center gap-3">
                      <AlertTriangle size={16} /> <span>Estás a punto de certificar un expediente con expedientes sin verificar. El sello del Asesor asume responsabilidad.</span>
                   </div>
                )}

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
                         {data.contrato_url && data.contrato_url.length > 5 ? (
                            <>
                               <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl flex items-center justify-center gap-3">
                                  <ShieldCheck size={24} />
                                  <div className="text-left">
                                     <p className="text-[10px] font-black uppercase tracking-widest">Identidad Validada en Bóveda</p>
                                     <p className="text-[10px] leading-tight mt-0.5">Cliente con Onboarding previo. Se omitirá firma repetida.</p>
                                  </div>
                               </div>
                               <p className="text-[9px] font-black text-[#003366] uppercase tracking-widest">Directo a Cierre (Sellar Diagnóstico)</p>
                            </>
                         ) : (
                            <p className="text-[9px] font-black text-[#003366] uppercase tracking-widest">Sellar Expediente y Enviar Firma Externa (Cliente)</p>
                         )}
                         <div className="flex flex-col gap-3">
                             {!certificationReady ? (
                                <button type="button" onClick={handleSellarExpediente} className="w-full py-5 bg-[#003366] text-white rounded-2xl font-black uppercase text-[11px] shadow-xl active:scale-95 transition-all flex justify-center items-center gap-2 tracking-widest">
                                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : (data.contrato_url && data.contrato_url.length > 5 ? "Sellar y Finalizar Expediente" : "Sellar y Generar Envío")} <ShieldCheck size={16}/>
                                </button>
                             ) : (
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => handleEnviarNotificacion('whatsapp')} className="flex-1 py-5 bg-[#25D366] text-white rounded-2xl font-black uppercase text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex justify-center items-center gap-2">
                                    WhatsApp <Smartphone size={16}/>
                                  </button>
                                  <button type="button" onClick={() => handleEnviarNotificacion('email')} className="flex-1 py-5 bg-[#003366] text-white rounded-2xl font-black uppercase text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex justify-center items-center gap-2">
                                    Email <Mail size={16}/>
                                  </button>
                                </div>
                             )}
                             {data.id && !data.id.startsWith('NEW_') && (
                               <button 
                                 type="button" 
                                 onClick={async () => {
                                   const yaTieneContrato = data.contrato_url && data.contrato_url.length > 5;
                                   const tipoDoc = yaTieneContrato ? 'DIAGNOSTICO' : 'CONTRATO_Y_DIAGNOSTICO';
                                   const link = `${window.location.origin}/firma-externa/${data.id}?tipoDoc=${tipoDoc}`;
                                   await copyToClipboard(link);
                                   addToast("Link copiado al portapapeles", 'success');
                                 }}
                                 className="w-full py-3 bg-slate-100 text-[#003366] rounded-xl font-bold uppercase text-[9px] hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                               >
                                 <FileSignature size={14}/> Copiar Link Manual
                               </button>
                             )}
                         </div>
                      </div>
                   </div>
                </div>
            </div>
        )}
      </main>

      {/* PANEL DERECHO (AUDITORÍA) */}
      <div className="fixed bottom-10 right-10 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
              className={cn(
                "px-6 py-4 rounded-2xl shadow-2xl pointer-events-auto border flex items-center gap-3 min-w-[300px]",
                toast.type === 'info' && "bg-[#003366] text-white border-white/20",
                toast.type === 'error' && "bg-red-500 text-white border-red-600",
                toast.type === 'success' && "bg-emerald-500 text-white border-emerald-600"
              )}
            >
              {toast.type === 'info' && <Loader2 size={18} className="animate-spin" />}
              {toast.type === 'error' && <AlertCircle size={18} />}
              {toast.type === 'success' && <CheckCircle2 size={18} />}
              <span className="text-xs font-black uppercase tracking-widest">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {activeStep > 1 && (
        <aside className="sticky top-28 w-80 xl:w-96 h-[calc(100vh-140px)] flex-shrink-0 bg-[#003366] p-8 pb-8 rounded-[48px] text-white shadow-2xl space-y-8 hidden lg:flex flex-col overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4"><Activity size={24} className="text-[#DAA520]" /><h4 className="text-lg font-black uppercase tracking-tighter">Panel de Auditoría</h4></div>
            
            <div className="space-y-5">
                {/* Badge de Certeza Jurídica (Dinamismo Legal-Tech) */}
                {(() => {
                  const hasINE = data.expedienteExistingFiles?.ine;
                  const hasCSF = data.expedienteExistingFiles?.csf;
                  const hasSemanas = data.expedienteExistingFiles?.semanas;
                  
                  let discrepancias = [];
                  if (!hasINE) discrepancias.push("Falta Identificación Oficial (INE)");
                  if (!hasCSF) discrepancias.push("Falta Constancia Fiscal (RFC)");
                  if (!hasSemanas) discrepancias.push("Falta Reporte de Semanas IMSS");
                  
                  // Validación cruzada simple
                  if (data.nombre && data.curp && data.rfc) {
                     // Podríamos añadir validación de regex aquí si fuera necesario
                  }
                  
                  const isHigh = hasINE && hasCSF && hasSemanas;
                  
                  return (
                    <div className={cn("p-6 rounded-[32px] border shadow-2xl transition-all duration-500", isHigh ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-amber-500/10 border-amber-500/30 text-amber-500")}>
                      <div className="flex items-center gap-3 mb-3">
                        {isHigh ? <ShieldCheck size={24} /> : <AlertTriangle size={24} />}
                        <h5 className="font-black uppercase tracking-widest text-[11px]">{isHigh ? 'Certeza: Alta' : 'Certeza: Baja / Observada'}</h5>
                      </div>
                      <div className="space-y-2">
                        {discrepancias.length > 0 ? (
                          discrepancias.map((d, i) => <p key={i} className="text-[9px] font-bold leading-tight opacity-80 uppercase">• {d}</p>)
                        ) : (
                          <p className="text-[9px] font-bold leading-tight opacity-80 uppercase">Match total detectado entre documentos oficiales. Expediente apto para dictaminación.</p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Badge 6+1 Visible de Inmediato si aplica */}
                {detailedAge?.hasRoundingBenefit && (
                    <div className="bg-[#DAA520]/20 border border-[#DAA520]/60 p-4 rounded-2xl flex items-center justify-between shadow-lg animate-pulse">
                        <div className="flex items-center gap-2"><Sparkles className="text-[#DAA520]" size={16} /><span className="text-[9px] font-black text-[#DAA520] uppercase tracking-widest">Incentivo 6+1</span></div>
                        <span className="bg-[#DAA520] text-[#003366] text-[9px] font-black px-2 py-0.5 rounded-full">Redondeo Aplicable</span>
                    </div>
                )}

                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3">
                    <h5 className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Estatus del Proceso</h5>
                    <div className="flex flex-col gap-2 text-[10px] font-bold">
                        <span className={cn("flex items-center gap-2", Object.keys(data.expedienteExistingFiles || {}).length > 0 ? "text-emerald-400" : "text-white/30")}><CheckSquare size={14}/> {Object.keys(data.expedienteExistingFiles || {}).length > 0 ? 'Documental OK' : 'Docs Pendientes'}</span>
                        <span className={cn("flex items-center gap-2", asesorNombre ? "text-emerald-400" : "text-white/30")}><PenTool size={14}/> {asesorNombre ? 'Dictamen Certificado' : 'Firma Asesor Pend.'}</span>
                        {activeStep === 4 && (
                          <span className={cn("flex items-center gap-2", data.estatusfirma === 'FIRMADO' ? "text-emerald-400" : "text-[#DAA520] animate-pulse")}>
                            <Clock size={14}/> {data.estatusfirma === 'FIRMADO' ? 'EXPEDIENTE CERRADO ✓' : 'ESPERANDO FIRMA CLIENTE...'}
                          </span>
                        )}
                    </div>
                </div>

                {data.metadatosAuditoria?.alertas?.map((alerta: string, i: number) => (
                    <div key={i} className="bg-amber-500/10 p-3 rounded-xl text-[9px] font-bold text-amber-500 flex items-center gap-2 border border-amber-500/10"><AlertCircle size={14}/> {alerta}</div>
                ))}

                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3">
                    <h5 className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Captura Digital de Materialidad</h5>
                    <div className="text-[10px] font-bold text-white/70 space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                        {auditLog.map((l, i) => <div key={i}><span className="text-white/30">[{l.fecha}]</span> {l.accion}</div>)}
                    </div>
                </div>

                <AuditoriaInput registrarAccion={registrarAccion} label="Nombre del Cliente" value={data.nombre} fieldKey="nombre" isLocked={lockedFields.has('nombre')} onUnlock={() => { const s = new Set(lockedFields); s.delete('nombre'); setLockedFields(s); }} isLoading={analyzingCount > 0 && !data.nombre} onChange={(v:any)=>updateData({nombre:v})} />
                <AuditoriaInput registrarAccion={registrarAccion} label="CURP" value={data.curp} fieldKey="curp" isLocked={lockedFields.has('curp')} onUnlock={() => { const s = new Set(lockedFields); s.delete('curp'); setLockedFields(s); }} isLoading={analyzingCount > 0 && !data.curp} hasAlert={data.curp && !VALIDATORS.CURP(data.curp)} onChange={(v:any)=>updateData({curp:v.toUpperCase()})} />
                <AuditoriaInput registrarAccion={registrarAccion} label="RFC" value={data.rfc} fieldKey="rfc" isLocked={lockedFields.has('rfc')} onUnlock={() => { const s = new Set(lockedFields); s.delete('rfc'); setLockedFields(s); }} isLoading={analyzingCount > 0 && !data.rfc} hasAlert={data.rfc && !VALIDATORS.RFC(data.rfc)} onChange={(v:any)=>updateData({rfc:v.toUpperCase()})} />
                
                <div className="pt-2 border-t border-white/5 space-y-3">
                  <h6 className="text-[8px] font-black uppercase text-white/20 tracking-widest pl-1">Ubicación Registrada</h6>
                  <AuditoriaInput registrarAccion={registrarAccion} label="Domicilio" value={data.domicilio} fieldKey="domicilio" isLocked={lockedFields.has('domicilio')} onUnlock={() => { const s = new Set(lockedFields); s.delete('domicilio'); setLockedFields(s); }} isLoading={analyzingCount > 0 && !data.domicilio} onChange={(v:any)=>updateData({domicilio:v})} />
                  <AuditoriaInput registrarAccion={registrarAccion} label="Código Postal" value={data.codigoPostal} fieldKey="codigoPostal" isLocked={lockedFields.has('codigoPostal')} onUnlock={() => { const s = new Set(lockedFields); s.delete('codigoPostal'); setLockedFields(s); }} hasAlert={data.codigoPostal && !VALIDATORS.CP(data.codigoPostal)} onChange={(v:any)=>updateData({codigoPostal:v.replace(/\D/g, '').substring(0, 5)})} />
                </div>
                
                <AuditoriaInput registrarAccion={registrarAccion} label="NSS IMSS" value={data.nss} fieldKey="nss" isLocked={lockedFields.has('nss')} onUnlock={() => { const s = new Set(lockedFields); s.delete('nss'); setLockedFields(s); }} isLoading={analyzingCount > 0 && !data.nss} hasAlert={data.nss && !VALIDATORS.NSS(data.nss)} onChange={(v:any)=>updateData({nss:v.replace(/\D/g, '').substring(0, 11)})} />
                
                {/* NSS ADICIONALES DINÁMICOS */}
                {data.nssList && data.nssList.map((extNss, idx) => (
                  <div key={`nss-ext-${idx}`} className="flex gap-2 items-end group/nss">
                    <div className="flex-1">
                      <AuditoriaInput 
                        label={`NSS Extra ${idx + 1}`} 
                        value={extNss} 
                        hasAlert={extNss && !VALIDATORS.NSS(extNss)}
                        onChange={(v:any) => updateNssAdicional(idx, v)} 
                      />
                    </div>
                    <button type="button" onClick={() => removeNssAdicional(idx)} className="mb-2 p-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 opacity-0 group-hover/nss:opacity-100 transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addNssAdicional} className="flex items-center gap-2 text-[10px] font-black text-[#DAA520] uppercase tracking-widest hover:text-[#c9961d] transition-all px-1">
                  <PlusCircle size={14} /> Añadir NSS Adicional
                </button>
                
                <div className="grid grid-cols-2 gap-4">
                    <AuditoriaInput registrarAccion={registrarAccion} label="Semanas IMSS" value={data.semanasCotizadas} fieldKey="semanasCotizadas" isLocked={lockedFields.has('semanasCotizadas')} onUnlock={() => { const s = new Set(lockedFields); s.delete('semanasCotizadas'); setLockedFields(s); }} isLoading={analyzingCount > 0 && !data.semanasCotizadas} onChange={(v:any)=>updateData({semanasCotizadas:v})} />
                    <AuditoriaInput registrarAccion={registrarAccion} label="Último Salario" value={data.ultimoSalario} fieldKey="ultimoSalario" isLocked={lockedFields.has('ultimoSalario')} onUnlock={() => { const s = new Set(lockedFields); s.delete('ultimoSalario'); setLockedFields(s); }} isLoading={analyzingCount > 0 && !data.ultimoSalario} onChange={(v:any)=>updateData({ultimoSalario:v})} />
                </div>
                <AuditoriaInput registrarAccion={registrarAccion} label="WhatsApp" value={data.whatsapp} fieldKey="whatsapp" isLocked={lockedFields.has('whatsapp')} onUnlock={() => { const s = new Set(lockedFields); s.delete('whatsapp'); setLockedFields(s); }} onChange={(v:any)=>updateData({whatsapp:v})} />
                <AuditoriaInput registrarAccion={registrarAccion} label="Email de Contacto" value={data.email} fieldKey="email" isLocked={lockedFields.has('email')} onUnlock={() => { const s = new Set(lockedFields); s.delete('email'); setLockedFields(s); }} hasAlert={data.email && !VALIDATORS.EMAIL(data.email)} onChange={(v:any)=>updateData({email:v})} />

                {/* CONTACTOS EXTRA DINÁMICOS */}
                {data.contactosExtra && data.contactosExtra.map((cX, idx) => (
                  <div key={`contact-ext-${idx}`} className="bg-white/5 p-3 rounded-2xl border border-white/10 space-y-3 relative group/contact">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-black text-white/30 uppercase block mb-1">Etiqueta (ej. Tel. Oficina)</label>
                        <input 
                           value={cX.etiqueta} 
                           onChange={(e)=>updateContactoExtra(idx, 'etiqueta', e.target.value)}
                           className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#DAA520]/50" 
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-white/30 uppercase block mb-1">Valor</label>
                        <input 
                           value={cX.valor} 
                           onChange={(e)=>updateContactoExtra(idx, 'valor', e.target.value)}
                           className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#DAA520]/50" 
                        />
                      </div>
                    </div>
                    <button type="button" onClick={() => removeContactoExtra(idx)} className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover/contact:opacity-100 transition-all shadow-lg scale-75">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addContactoExtra} className="flex items-center gap-2 text-[10px] font-black text-[#DAA520] uppercase tracking-widest hover:text-[#c9961d] transition-all px-1">
                  <PlusCircle size={14} /> Añadir Contacto Adicional
                </button>

                <AuditoriaInput registrarAccion={registrarAccion} label="Régimen Fiscal" value={data.regimenFiscal} fieldKey="regimenFiscal" isLocked={lockedFields.has('regimenFiscal')} onUnlock={() => { const s = new Set(lockedFields); s.delete('regimenFiscal'); setLockedFields(s); }} onChange={(v:any)=>updateData({regimenFiscal:v})} />
            </div>
            
            {/* Control Flotante Inferior fijo dentro del aside */}
            {activeStep === 2 && (
               <div className="sticky bottom-0 bg-[#003366] pt-4 border-t border-white/10 mt-auto">
                  <button type="button" onClick={handleSiguientePasoDocs} disabled={isProcessing} className="w-full py-5 bg-[#DAA520] text-[#003366] rounded-[24px] font-black uppercase shadow-xl hover:bg-[#c9961d] active:scale-95 transition-all flex items-center justify-center gap-3">
                      {isProcessing ? <Loader2 size={18} className="animate-spin" /> : null}
                      {data.id?.startsWith('NEW_') ? "Crear Expediente" : "Siguiente Paso"} <ArrowRight size={18} />
                  </button>
               </div>
            )}
        </aside>
      )}
      </div>

      {/* OVERLAY DE ÉXITO */}
      <AnimatePresence>
         {(data.estatusfirma === 'FIRMADO' || data.estatusfirma === 'COMPLETADO') && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] bg-[#003366]/95 flex items-center justify-center p-10 text-center flex-col gap-6 backdrop-blur-md">
               <div className="bg-[#DAA520] p-8 rounded-full shadow-2xl animate-pulse"><CheckCircle size={80} className="text-[#003366]"/></div>
               <h2 className="text-5xl font-black text-white uppercase tracking-tighter">¡Expediente Formalizado!</h2>
               <p className="text-xl text-emerald-400 font-bold italic tracking-tight">Firma y Selfie recibidas. El diagnóstico y contrato han sido sellados en PDF.</p>
               
               <div className="flex flex-col md:flex-row gap-4">
                 <button type="button" onClick={() => window.location.reload()} className="px-10 py-4 bg-white text-[#003366] rounded-full font-black uppercase tracking-widest hover:bg-slate-100 transition-all">Tablero Maestro</button>
                 {data.id_carpeta_drive && (
                   <a 
                     href={`https://drive.google.com/drive/folders/${data.id_carpeta_drive}`} 
                     target="_blank" 
                     referrerPolicy="no-referrer"
                     className="px-10 py-4 bg-[#DAA520] text-[#003366] rounded-full font-black uppercase tracking-widest hover:bg-[#c9961d] transition-all flex items-center gap-2"
                   >
                     <ExternalLink size={18} /> Ver Expediente en Drive
                   </a>
                 )}
               </div>
            </motion.div>
         )}
      </AnimatePresence>

      <input type="file" ref={fileInputRef} onChange={(e) => activeUploadRef.current && handleFileUpload(e, activeUploadRef.current)} className="hidden" accept="application/pdf,image/*" />
    </div>
  );
}