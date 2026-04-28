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
  ChevronDown,
  Calendar,
  ShieldPlus,
  Loader2,
  DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { callGAS } from '@/services/apiService';
import { extractDocumentData } from '@/services/geminiService';
import { Cliente, HojaServicio } from '@/types';

type Tab = 'clientes' | 'pagos_u2' | 'comisiones' | 'conciliacion';

const parseCSV = (text: string) => {
  const lines = text.split(/\r?\n/);
  const result: string[][] = [];
  for(const line of lines) {
    if(!line.trim()) continue;
    
    const fields = [];
    let field = '';
    let inQuotes = false;
    for(let i=0; i<line.length; i++) {
      const char = line[i];
      if(char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(field.trim());
        field = '';
      } else {
        field += char;
      }
    }
    fields.push(field.trim());
    result.push(fields);
  }
  return result;
};

const findClientMatch = (conceptoReal: string, clientesArray: any[]) => {
  const concepto = (conceptoReal || '').toUpperCase();
  
  // Nivel 1: Regex ID Exacto
  const idRegex = /[A-Z]{4}\d{6}/g;
  const idsExactos = concepto.match(idRegex) || [];
  for (const matchId of idsExactos) {
    const exactMatch = clientesArray.find(c => c.id?.toUpperCase() === matchId);
    if (exactMatch) return { matchType: 'exact', client: exactMatch, reason: 'ID Exacto' };
  }

  // Nivel 2: CURP (18) -> primeros 10
  const curpRegex = /[A-Z]{4}\d{6}[HM][A-Z]{5}\d{2}/g;
  const curps = concepto.match(curpRegex) || [];
  for (const curp of curps) {
    const tenCurp = curp.substring(0, 10);
    const curpMatch = clientesArray.find(c => c.id?.toUpperCase() === tenCurp || c.curp?.toUpperCase().startsWith(tenCurp));
    if (curpMatch) return { matchType: 'exact', client: curpMatch, reason: 'CURP Exacto' };
  }

  // Iterate for level 3, 4, 5
  let suggestedMatch = null;
  for (const c of clientesArray) {
    const nombresSplit = (c.nombre || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(' ').filter((x: string) => x);
    const apellidosSplit = (c.apellidos || c.apellido || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(' ').filter((x: string) => x);
    
    const fullname = [...nombresSplit, ...apellidosSplit].join(' ');
    
    // Nivel 3: Nombre Exacto
    if (fullname && concepto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(fullname)) {
       return { matchType: 'exact', client: c, reason: 'Nombre Exacto' };
    }
    
    // Nivel 4: Nombre Fusionado (Cajeros)
    const fused = [...nombresSplit, ...apellidosSplit].join('');
    if (fused && concepto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(fused)) {
       return { matchType: 'exact', client: c, reason: 'Nombre Fusionado' };
    }
    
    // Nivel 5: Match Sugerido (Primer Nombre + Primer Apellido sep)
    if (nombresSplit.length > 0 && apellidosSplit.length > 0) {
      if (concepto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(nombresSplit[0]) && concepto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(apellidosSplit[0])) {
         suggestedMatch = { matchType: 'suggested', client: c, reason: 'Coincidencia Parcial' };
      }
    }
  }

  if (suggestedMatch) return suggestedMatch;

  return { matchType: 'none', client: null, reason: 'Sin Match' };
};

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

  // Modal Migración
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [migrationModalStep, setMigrationModalStep] = useState<'Carga' | 'Revision'>('Carga');
  const [migrationData, setMigrationData] = useState({
    nombre: '',
    curp: '',
    rfc: '',
    nss: '',
    email: '',
    cp: '',
    semanasCotizadas: 0,
    ultimoSalario: 0,
    regimenFiscal: '',
    promotor: '',
    origen: 'Migración',
    whatsapp: ''
  });
  const [aiIdentifiedFields, setAiIdentifiedFields] = useState<Set<string>>(new Set());
  const [isExtractingDocuments, setIsExtractingDocuments] = useState(false);
  const [isSavingMigration, setIsSavingMigration] = useState(false);
  const [migrationFiles, setMigrationFiles] = useState<{name: string, content: string}[]>([]);
  const [promotoresList, setPromotoresList] = useState<any[]>([]);
  const migrationFileInputRef = useRef<HTMLInputElement>(null);
  const paymentInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPaymentFor, setUploadingPaymentFor] = useState<string | null>(null);

  // Conciliación
  const [csvData, setCsvData] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // RPA
  const [rpaStatus, setRpaStatus] = useState<{[key: string]: string}>({});
  const rpaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
    fetchPromotores();
  }, []);

  const fetchPromotores = async () => {
    try {
      const res = await callGAS('GET_DATA', { sheetName: 'PROMOTORES' });
      if (res?.success) setPromotoresList(res.data);
    } catch (err) {
      console.warn("Error fetching promotores", err);
    }
  };

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
    const matchesSearch = (c.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
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
  const handleDualCSVUpload = (e: React.ChangeEvent<HTMLInputElement>, tipoCuenta: 'U1' | 'U2') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const rows = parseCSV(text);
      
      let headerRowIdx = -1;
      let fechaIdx = 0, conceptoIdx = 1, abonoIdx = 3;
      
      for(let i=0; i<rows.length; i++) {
        const rLower = rows[i].map(x => (x || '').toLowerCase());
        if (rLower.some(x => x.includes('fecha')) && rLower.some(x => x.includes('abono'))) {
          headerRowIdx = i;
          fechaIdx = rLower.findIndex(x => x.includes('fecha'));
          conceptoIdx = rLower.findIndex(x => x.includes('concepto') || x.includes('referencia'));
          abonoIdx = rLower.findIndex(x => x.includes('abono'));
          break;
        }
      }

      if (headerRowIdx === -1) {
        fechaIdx = 0;
        conceptoIdx = 2; // Columna base BBVA
        abonoIdx = 5;
      }

      const processedData: any[] = [];
      
      for (let i = headerRowIdx + 1; i < rows.length; i++) {
         const row = rows[i];
         if (row.length <= Math.max(fechaIdx, conceptoIdx, abonoIdx)) continue;
         
         const abonoStr = (row[abonoIdx] || '').replace(/[$,]/g, '').trim();
         const abonoVal = parseFloat(abonoStr);
         
         if (!isNaN(abonoVal) && abonoVal > 0) {
            const fecha = row[fechaIdx] || '';
            let concepto = row[conceptoIdx] || '';
            if (headerRowIdx === -1 && row[3]) concepto += ` ${row[3]}`;
            
            const matchResult = findClientMatch(concepto, clients);
            
            processedData.push({
               uid: `${Date.now()}-${i}`,
               fecha: fecha,
               concepto: concepto,
               monto: abonoVal,
               matchType: matchResult.matchType as any,
               client: matchResult.client,
               reason: matchResult.reason,
               status: 'PENDING',
               selectedClientId: matchResult.client?.id || ''
            });
         }
      }
      
      setCsvData(processedData);
    };
    reader.readAsText(file);
    e.target.value = ''; // clean input
  };

  const handleRpaDrop = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
       const file = files[i];
       setRpaStatus(prev => ({ ...prev, [file.name]: '⏳ Procesando...' }));

       const reader = new FileReader();
       reader.onload = async (event) => {
          const base64 = event.target?.result as string;
          try {
             const res = await callGAS('RPA_UPLOAD', { fileData: base64, fileName: file.name });
             if (res?.success) {
                setRpaStatus(prev => ({ ...prev, [file.name]: '✔️ ' + res.message }));
             } else {
                setRpaStatus(prev => ({ ...prev, [file.name]: '❌ Error: ' + res.error }));
             }
          } catch(err) {
             setRpaStatus(prev => ({ ...prev, [file.name]: '❌ Hubo un error de conexión' }));
          }
       };
       reader.readAsDataURL(file);
    }
  };

  const handlePaymentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0] && uploadingPaymentFor) {
      const file = e.target.files[0];
      const clientId = uploadingPaymentFor;
      const currentMonth = new Date().toLocaleString('es-MX', { month: 'long' }).toUpperCase();
      const fileName = `PAGO_${currentMonth}_${clientId}.${file.name.split('.').pop()}`;
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        const fileData = event.target?.result as string;
        try {
          const clientFilter = clients.find(c => c.id === clientId);
          const folderId = clientFilter?.id_carpeta_drive || clientFilter?.idcarpetadrive;
          
          if (!folderId) {
            alert("No se encontró carpeta de Drive para este cliente.");
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
              alert("Pago registrado y expediente activado.");
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

  const handleMigrationFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).slice(0, 5); // Max 5
      
      setMigrationFiles([]); // Reset
      setIsExtractingDocuments(true);
      setAiIdentifiedFields(new Set());

      let mergedData = { ...migrationData };
      const newAiFields = new Set<string>();

      for (const file of files) {
        const reader = new FileReader();
        const filePromise = new Promise<{name: string, content: string}>((resolve) => {
          reader.onload = (event) => {
            resolve({ name: file.name, content: event.target?.result as string });
          };
        });
        reader.readAsDataURL(file);
        const fileObj = await filePromise;
        setMigrationFiles(prev => [...prev, fileObj]);

        try {
          const extracted = await extractDocumentData(fileObj.content, file.type);
          if (extracted) {
             const fieldsToSync = ['nombre', 'curp', 'rfc', 'nss', 'semanasCotizadas', 'ultimoSalario', 'regimenFiscal', 'cp'];
             fieldsToSync.forEach(field => {
                let val = (extracted as any)[field === 'cp' ? 'codigoPostal' : field];
                
                // Limpieza agresiva y técnica según directiva de Operaciones
                if (field === 'ultimoSalario' && val !== null) {
                  const cleanedVal = String(val).replace(/[^0-9.]/g, '');
                  val = parseFloat(cleanedVal) || 0;
                }
                if (field === 'semanasCotizadas' && val !== null) {
                  const cleanedVal = String(val).replace(/[^0-9]/g, '');
                  val = Math.floor(parseInt(cleanedVal)) || 0;
                }

                // Merge Inteligente: Solo actualiza si Gemini encontró el dato (no nulo)
                if (val !== null && val !== "" && val !== 0 && !mergedData[field as keyof typeof mergedData]) {
                   (mergedData as any)[field] = val;
                   newAiFields.add(field);
                } else if (val !== null && val !== "" && val !== 0) {
                   // Si ya tiene valor, pero Gemini trae algo nuevo, priorizamos si el anterior era nulo o vacío
                   if (!(mergedData as any)[field]) {
                      (mergedData as any)[field] = val;
                      newAiFields.add(field);
                   }
                }
             });
          }
        } catch (err) {
          console.warn("OCR Error for file:", file.name, err);
        }
      }

      setMigrationData(mergedData);
      setAiIdentifiedFields(newAiFields);
      setIsExtractingDocuments(false);
      setMigrationModalStep('Revision');
    }
  };

  const handleSaveMigration = async () => {
    // Validaciones basicas
    if (!migrationData.nombre || !migrationData.curp) {
      alert("Nombre y CURP son obligatorios.");
      return;
    }
    
    if (migrationData.whatsapp && migrationData.whatsapp.length !== 10) {
      alert("El WhatsApp debe ser de 10 dígitos si se proporciona.");
      return;
    }

    setIsSavingMigration(true);
    try {
      const res = await callGAS('CREATE_CLIENTE', {
        ...migrationData,
        estadoauditoria: 'MIGRACION_PENDIENTE',
        documentos: migrationFiles
      });
      if (res?.success) {
        setShowMigrationModal(false);
        setMigrationData({ 
          nombre: '', curp: '', rfc: '', nss: '', 
          email: '', cp: '', semanasCotizadas: 0, ultimoSalario: 0, 
          regimenFiscal: '', promotor: '', origen: 'Migración', whatsapp: '' 
        });
        setMigrationFiles([]);
        setMigrationModalStep('Carga');
        fetchData();
      } else {
        alert("Error: " + res?.error);
      }
    } catch (e) {
      console.error("Error saving migration", e);
    } finally {
      setIsSavingMigration(false);
    }
  };

  const findSuggestedClient = (concepto: string) => {
    const term = concepto.toUpperCase();
    // Intenta buscar por ID o Nombre
    const match = clients.find(c => {
      const full = (c.nombre || '').toUpperCase();
      const idMatch = c.id && term.includes(c.id.toUpperCase());
      const nameMatch = term.includes((c.nombre || '').toUpperCase());
      return idMatch || nameMatch;
    });
    return match ? `${match.nombre}` : 'No Identificado';
  };

  const getClientUniverso = (clientId: string) => {
    const clientHojas = hojas
      .filter((h: any) => h.clienteid === clientId || h.id_cliente === clientId || h.idcliente === clientId)
      .sort((a: any, b: any) => new Date(b.createdat || b.fecha || 0).getTime() - new Date(a.createdat || a.fecha || 0).getTime());
    if (clientHojas.length > 0) return clientHojas[0].universo || 'U1';
    return 'SIN REGISTRO';
  };

  const getClientDiagnosticUrl = (clientId: string) => {
    if (!clientId) return null;
    const idUpper = String(clientId).toUpperCase().trim();
    
    const isValidUrl = (url: any) => typeof url === 'string' && url.startsWith('http');

    // 1. Buscar en HOJAS_SERVICIO
    const hoja = hojas.find((h: any) => 
      String(h.id_cliente || h.clienteid || h.idcliente || h.id || '').toUpperCase().trim() === idUpper &&
      (isValidUrl(h.url_diagnostico) || isValidUrl(h.urldiagnostico) || isValidUrl(h.urldiagnóstico) || isValidUrl(h.firmaurl))
    );
    
    if (hoja) {
      if (isValidUrl(hoja.url_diagnostico)) return hoja.url_diagnostico;
      if (isValidUrl(hoja.urldiagnostico)) return hoja.urldiagnostico;
      if (isValidUrl(hoja.urldiagnóstico)) return hoja.urldiagnóstico;
      if (isValidUrl(hoja.firmaurl)) return hoja.firmaurl;
    }

    // 2. Buscar en GESTIONES_U2
    const gestion = gestionesU2.find((g: any) => 
      String(g.clienteid || g.id_cliente || g.idcliente || g.id || '').toUpperCase().trim() === idUpper &&
      (isValidUrl(g.url_diagnostico) || isValidUrl(g.urldiagnostico) || isValidUrl(g.urldiagnóstico) || isValidUrl(g.firmaurl))
    );
    
    if (gestion) {
      if (isValidUrl(gestion.url_diagnostico)) return gestion.url_diagnostico;
      if (isValidUrl(gestion.urldiagnostico)) return gestion.urldiagnostico;
      if (isValidUrl(gestion.urldiagnóstico)) return gestion.urldiagnóstico;
      if (isValidUrl(gestion.firmaurl)) return gestion.firmaurl;
    }

    return null;
  };

  const hasPaidThisMonth = (clientId: string) => {
    const currentMonth = new Date().toLocaleString('es-MX', { month: 'long', year: 'numeric' }).toLowerCase();
    return gestionesU2.some(g => 
      g.ClienteID === clientId && 
      (g.mes?.toLowerCase().includes(currentMonth.split(' ')[0]) || g.mes?.toLowerCase() === currentMonth) &&
      (g.Recibido === 1 || g.Recibido === true)
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0D14] text-white p-8">
      <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase text-white pt-2">Dashboard Operativo</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mt-1">Centro de Mando, Gestión & Cobranza</p>
        </div>

        <div className="flex gap-4 items-center">
          <button 
            onClick={() => window.open('https://calendar.app.google/xhQAeqCHTCsdgBei6', '_blank')}
            className="bg-white/5 text-white px-6 py-3 rounded-xl border border-white/10 font-bold text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <Calendar size={16} /> Agendar Cita
          </button>
          
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 shadow-2xl">
            {(['clientes', 'pagos_u2', 'comisiones', 'conciliacion', 'calendario'] as Tab[] | any[]).map((tab) => (
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
        </div>
      </header>

      <main>
        {activeTab === 'clientes' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row gap-4 mb-8 items-center">
              <div className="relative flex-1 group w-full">
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
              <button 
                onClick={() => setShowMigrationModal(true)}
                className="bg-gold text-black px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 transition-all flex items-center gap-2"
              >
                <ShieldPlus size={18} /> Nuevo Expediente Migración
              </button>
            </div>

            <section className="bg-white/5 rounded-[32px] border border-white/10 overflow-hidden backdrop-blur-md shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="px-8 py-5 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">ID / Cliente</th>
                      <th className="px-8 py-5 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Universo</th>
                      <th className="px-8 py-5 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Auditoría</th>
                      <th className="px-8 py-5 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Pago</th>
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
                              <span className="text-xs font-black text-white tracking-widest uppercase">{client.nombre}</span>
                              <span className="text-[9px] font-bold text-gold/60 mt-0.5 tracking-widest">ID: {client.id}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span className="text-[10px] font-black bg-white/10 text-white px-3 py-1 rounded-lg uppercase tracking-widest">
                              {getClientUniverso(client.id || '')}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                (client['estadoauditoría'] || client.estadoauditoria) === 'SERVICIO_ACTIVO' ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : 
                                (client['estadoauditoría'] || client.estadoauditoria) === 'ENTREVISTA_CONCLUIDA' ? "bg-blue-500" : "bg-amber-500"
                              )} />
                              <span className="text-[9px] font-black uppercase tracking-widest text-white/60">
                                {(client['estadoauditoría'] || client.estadoauditoria) === 'SERVICIO_ACTIVO' ? 'ACTIVO' : (client['estadoauditoría'] || client.estadoauditoria) || 'SIN_ESTADO'}
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                             {hasPaidThisMonth(client.id || '') ? (
                               <div className="w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center">
                                  <Check size={14} />
                               </div>
                             ) : (
                               <span className="text-[10px] text-white/10 uppercase font-black">Pendiente</span>
                             )}
                          </td>
                          <td className="px-8 py-6">
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest italic">{client.promotor || 'DIRECTO'}</span>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <div className="flex justify-end gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => {
                                  setUploadingPaymentFor(client.id || null);
                                  paymentInputRef.current?.click();
                                }}
                                className="p-2 hover:bg-white/10 rounded-xl text-emerald-400 transition-all hover:scale-110" 
                                title="Subir Comprobante de Pago"
                              >
                                <DollarSign size={18} />
                              </button>
                              {id_carpeta ? (
                                <button 
                                  onClick={() => window.open(`https://drive.google.com/drive/folders/${id_carpeta}`, '_blank')}
                                  className="p-2 hover:bg-white/10 rounded-xl text-blue-400 transition-all hover:scale-110" 
                                  title="Abrir Carpeta Drive"
                                >
                                  <FolderOpen size={18} />
                                </button>
                              ) : <span className="p-2 text-white/10"><FolderOpen size={18} /></span>}
                              
                              {id_carpeta ? (
                                <button 
                                  onClick={() => {
                                    const diagUrl = getClientDiagnosticUrl(client.id || '');
                                    if (diagUrl) {
                                      window.open(diagUrl, '_blank');
                                    } else {
                                      window.open(`https://drive.google.com/drive/folders/${client.id_carpeta_drive || client.idcarpetadrive}`, '_blank');
                                    }
                                  }}
                                  className="p-2 hover:bg-white/10 rounded-xl text-gold transition-all hover:scale-110" 
                                  title="Ver Diagnóstico Firmado"
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
                 <h2 className="text-xl font-black text-gold italic uppercase tracking-tight">Semáforo de Pagos {activeTab === 'pagos_u2' ? 'Integrales' : ''}</h2>
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
                             <span className="text-[10px] font-black text-white/60 uppercase">{g.mes || 'N/A'}</span>
                           </td>
                           <td className="px-8 py-6">
                             <div className={cn(
                               "px-4 py-1.5 rounded-full text-[9px] font-black border text-center w-fit uppercase tracking-widest",
                               g.Estatus === 'ACTIVO' ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : 
                               g.Estatus === 'PAGADO' ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]" :
                               "border-slate-500/20 bg-white/5 text-white/40"
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
                             <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">No hay gestiones integrales registradas este mes.</p>
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

        {activeTab === 'comisiones' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white/5 rounded-[32px] border border-white/10 overflow-hidden backdrop-blur-md shadow-2xl">
               <div className="p-8 border-b border-white/5 flex items-center justify-between">
                 <div>
                   <h2 className="text-xl font-black text-gold italic uppercase tracking-tight">Comisiones y Cartera</h2>
                   <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mt-1">Acumulados U1 y U2</p>
                 </div>
               </div>
               
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead>
                     <tr className="bg-white/5 text-white/30 text-[10px] font-black uppercase tracking-widest">
                       <th className="px-8 py-5">Asesor / Promotor</th>
                       <th className="px-8 py-5 text-right">Comisión Proyectada (Mes)</th>
                       <th className="px-8 py-5 text-center">Acción</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                     {promotores.map((p, i) => {
                       if (!p || p === 'N/A') return null;
                       // Calculate comisiones
                       let total = 0;
                       hojas.forEach(h => {
                         if (h.promotor === p || h.asesor === p) {
                           total += parseFloat(h.pago_promotor as any || 0);
                         }
                       });
                       let u2Comimsion = 0;
                       gestionesU2.forEach(g => {
                           const c = clients.find(cl => cl.id === g.ClienteID);
                           if (c && c.promotor === p) {
                               u2Comimsion += parseFloat(g.pago_promotor || g.Pago_Promotor || 0);
                           }
                       });
                       total += u2Comimsion;
                       
                       if (total === 0) return null;

                       return (
                         <tr key={i} className="hover:bg-white/10 transition-colors">
                           <td className="px-8 py-6">
                             <span className="text-xs font-black text-white uppercase">{p}</span>
                           </td>
                           <td className="px-8 py-6 text-right">
                             <span className="text-sm font-black text-emerald-400">${Number(total).toLocaleString('es-MX', {minimumFractionDigits:2})}</span>
                           </td>
                           <td className="px-8 py-6 text-center">
                             <button
                               onClick={async () => {
                                 try {
                                   setLoading(true);
                                   await callGAS('PAY_COMMISSION', {
                                     asesor: p,
                                     monto: total,
                                     tipo: 'COMISIÓN ACUMULADA U1/U2'
                                   });
                                   alert('Pago de comisión registrado satisfactoriamente.');
                                   // Idealmente recargaría la info, pero aquí mostramos el alert y continuamos.
                                 } catch(e) {
                                   alert('Error al registrar.');
                                 } finally {
                                   setLoading(false);
                                 }
                               }}
                               className="bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all shadow-lg active:scale-95"
                             >
                               Marcar Comisión Pagada
                             </button>
                           </td>
                         </tr>
                       );
                     })}
                     {promotores.length === 0 && (
                       <tr>
                         <td colSpan={3} className="py-20 text-center">
                           <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">No hay promotores registrados.</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Zona A: U2 */}
              <div 
                className="h-64 rounded-[40px] border-2 border-dashed border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500 hover:bg-emerald-500/10 flex flex-col items-center justify-center transition-all cursor-pointer group"
                onClick={() => document.getElementById('csv-u2')?.click()}
              >
                <div className="w-16 h-16 bg-emerald-500/20 group-hover:bg-emerald-500/40 rounded-[20px] flex items-center justify-center mb-6 transition-colors shadow-2xl">
                  <Upload className="text-emerald-400" size={32} />
                </div>
                <h3 className="text-lg font-black text-emerald-400 italic uppercase tracking-tight text-center">Cargar Estado de Cuenta</h3>
                <h4 className="text-xl font-black text-white uppercase tracking-widest mt-1">CONCENTRADORA (U2)</h4>
                <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-3 text-center px-4">Procesa automáticamente Líneas de Captura</p>
                <input 
                  id="csv-u2"
                  type="file" 
                  onChange={(e) => handleDualCSVUpload(e, 'U2')} 
                  className="hidden" 
                  accept=".csv"
                />
              </div>

              {/* Zona B: U1 */}
              <div 
                className="h-64 rounded-[40px] border-2 border-dashed border-gold/30 bg-gold/5 hover:border-gold hover:bg-gold/10 flex flex-col items-center justify-center transition-all cursor-pointer group"
                onClick={() => document.getElementById('csv-u1')?.click()}
              >
                <div className="w-16 h-16 bg-gold/20 group-hover:bg-gold/40 rounded-[20px] flex items-center justify-center mb-6 transition-colors shadow-2xl">
                  <Upload className="text-gold" size={32} />
                </div>
                <h3 className="text-lg font-black text-gold italic uppercase tracking-tight text-center">Cargar Estado de Cuenta</h3>
                <h4 className="text-xl font-black text-white uppercase tracking-widest mt-1">HONORARIOS (U1)</h4>
                <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-3 text-center px-4">Conciliación de Pagos Individuales</p>
                <input 
                  id="csv-u1"
                  type="file" 
                  onChange={(e) => handleDualCSVUpload(e, 'U1')} 
                  className="hidden" 
                  accept=".csv"
                />
              </div>
            </div>

            {/* BUZÓN DE DISPERSIÓN RPA */}
            <section className="bg-white/5 rounded-[32px] border border-white/10 overflow-hidden shadow-2xl mt-12 p-8">
               <div className="mb-6">
                 <h2 className="text-2xl font-black text-white italic uppercase tracking-tight">Buzón de Dispersión RPA</h2>
                 <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-1">Automatización de subidas para Líneas de Captura (LC) y Comprobantes (CI)</p>
               </div>
               
               <div 
                 className="h-32 rounded-3xl border-2 border-dashed border-white/20 bg-white/5 hover:border-white/50 hover:bg-white/10 flex flex-col items-center justify-center transition-all cursor-pointer group"
                 onClick={() => rpaInputRef.current?.click()}
               >
                 <Upload className="text-white/40 group-hover:text-white mb-2" size={24} />
                 <span className="text-xs font-black text-white/60 group-hover:text-white uppercase tracking-widest">Sube múltiples PDFs aquí</span>
                 <input 
                   type="file" 
                   ref={rpaInputRef} 
                   onChange={handleRpaDrop} 
                   className="hidden" 
                   multiple
                   accept=".pdf"
                 />
               </div>

               {Object.keys(rpaStatus).length > 0 && (
                 <div className="mt-6 space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                   {Object.entries(rpaStatus).map(([filename, status]) => (
                     <div key={filename} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                        <span className="text-[10px] font-bold text-white max-w-[200px] md:max-w-md truncate">{filename}</span>
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-wider",
                          status.includes('✔️') ? "text-emerald-400" :
                          status.includes('❌') ? "text-red-400" : "text-gold animate-pulse"
                        )}>{status}</span>
                     </div>
                   ))}
                 </div>
               )}
            </section>

            {csvData.length > 0 && (
              <section className="bg-white/5 rounded-[32px] border border-white/10 overflow-hidden shadow-2xl mt-12 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6 flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-black text-white italic uppercase tracking-tight">Conciliación Inteligente</h2>
                    <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-1">Verificación y registro de depósitos</p>
                  </div>
                  <button onClick={() => setCsvData([])} className="px-4 py-2 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Limpiar</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white/5">
                        <th className="px-6 py-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Fecha</th>
                        <th className="px-6 py-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Concepto</th>
                        <th className="px-6 py-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Monto</th>
                        <th className="px-6 py-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Cliente Match</th>
                        <th className="px-6 py-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {csvData.map((row, idx) => (
                        <tr key={row.uid} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 text-xs font-bold text-white/70">{row.fecha}</td>
                          <td className="px-6 py-4 text-xs text-white/50 w-64 break-words">{row.concepto}</td>
                          <td className="px-6 py-4 text-sm font-black text-gold">${row.monto.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                          <td className="px-6 py-4">
                             {row.matchType === 'exact' && (
                               <div className="flex flex-col">
                                 <span className="text-sm font-black text-emerald-400">{row.client?.nombre} {row.client?.apellidos || row.client?.apellido}</span>
                                 <span className="text-[9px] text-emerald-400/50 uppercase tracking-widest">{row.reason}</span>
                               </div>
                             )}
                             {row.matchType === 'suggested' && (
                               <div className="flex flex-col">
                                 <span className="text-sm font-black text-yellow-400">{row.client?.nombre} {row.client?.apellidos || row.client?.apellido}</span>
                                 <span className="text-[9px] text-yellow-400/50 uppercase tracking-widest">{row.reason}</span>
                               </div>
                             )}
                             {row.matchType === 'none' && (
                               <div className="flex flex-col space-y-1">
                                 <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest">Sin Match</span>
                                 <select 
                                    className="bg-black/50 border border-white/10 text-white text-xs px-2 py-1.5 rounded-lg outline-none"
                                    value={row.selectedClientId}
                                    onChange={(e) => {
                                       const newCsv = [...csvData];
                                       newCsv[idx].selectedClientId = e.target.value;
                                       setCsvData(newCsv);
                                    }}
                                 >
                                    <option value="" className="text-white/50">Seleccionar Cliente Manual...</option>
                                    {clients.map((c: any) => <option key={c.id} value={c.id}>{c.nombre} {c.apellidos || c.apellido}</option>)}
                                 </select>
                               </div>
                             )}
                          </td>
                          <td className="px-6 py-4 flex justify-center">
                             {row.status === 'PROCESADO' ? (
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
                                  <Check size={14} /> Procesado
                                </span>
                             ) : (
                                <button
                                  disabled={!row.selectedClientId || row.status === 'PROCESING'}
                                  onClick={async () => {
                                     const clientId = row.selectedClientId;
                                     if(!clientId) return;
                                     
                                     const newCsvStart = [...csvData];
                                     newCsvStart[idx].status = 'PROCESING';
                                     setCsvData(newCsvStart);

                                     try {
                                       const res = await callGAS('RECORD_PAYMENT', { clienteId: clientId });
                                       if (res?.success) {
                                          const newCsvEnd = [...csvData];
                                          newCsvEnd[idx].status = 'PROCESADO';
                                          setCsvData(newCsvEnd);
                                       } else {
                                          alert('Error al procesar: ' + res.error);
                                          const newCsvFail = [...csvData];
                                          newCsvFail[idx].status = 'PENDING';
                                          setCsvData(newCsvFail);
                                       }
                                     } catch(err) {
                                        alert('Error de conexión.');
                                        const newCsvFail = [...csvData];
                                        newCsvFail[idx].status = 'PENDING';
                                        setCsvData(newCsvFail);
                                     }
                                  }}
                                  className={cn(
                                     "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95",
                                     row.status === 'PROCESING' && "bg-white/10 text-white/40 cursor-wait",
                                     row.status !== 'PROCESING' && !row.selectedClientId && "bg-white/5 text-white/20 cursor-not-allowed",
                                     row.status !== 'PROCESING' && row.selectedClientId && row.matchType === 'exact' && "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/30",
                                     row.status !== 'PROCESING' && row.selectedClientId && row.matchType === 'suggested' && "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500 hover:text-black border border-yellow-500/30",
                                     row.status !== 'PROCESING' && row.selectedClientId && row.matchType === 'none' && "bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/30"
                                  )}
                                >
                                   {row.status === 'PROCESING' ? '⏳ Espere...' : 'Confirmar Pago'}
                                </button>
                             )}
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
        {activeTab === ('calendario' as any) && (
           <div className="h-[700px] w-full bg-white rounded-3xl border border-white/10 overflow-hidden shadow-2xl relative animate-in fade-in slide-in-from-bottom-4 duration-500">
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
        )}
      </main>

      {/* Modal Nuevo Expediente Migración */}
      <AnimatePresence>
        {showMigrationModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#0A0D14]/95 backdrop-blur-md"
              onClick={() => {
                if (!isExtractingDocuments && !isSavingMigration) setShowMigrationModal(false);
              }}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#141821] border border-white/10 rounded-[40px] shadow-2xl p-10 custom-scrollbar"
            >
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-gold/5 rounded-full blur-3xl" />
              
              <div className="flex justify-between items-start mb-8 relative">
                <div>
                  <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Nuevo Expediente Migración</h3>
                  <p className="text-[10px] text-gold font-black uppercase tracking-[0.2em] mt-1 italic">
                    {migrationModalStep === 'Carga' ? 'Carga masiva de documentos iniciales' : 'Revisión exhaustiva de datos (Ficha Técnica)'}
                  </p>
                </div>
                <button onClick={() => setShowMigrationModal(false)} className="p-2 text-white/20 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              {migrationModalStep === 'Carga' ? (
                <div 
                  className={cn(
                    "mt-8 p-12 border-2 border-dashed rounded-[40px] bg-white/5 flex flex-col items-center justify-center gap-6 group transition-all cursor-pointer relative overflow-hidden",
                    isExtractingDocuments ? "border-gold/50 cursor-wait" : "border-white/10 hover:border-gold/30"
                  )}
                  onClick={() => !isExtractingDocuments && migrationFileInputRef.current?.click()}
                >
                  {isExtractingDocuments ? (
                    <div className="flex flex-col items-center gap-6">
                      <div className="relative">
                        <div className="w-20 h-20 border-4 border-gold/20 border-t-gold rounded-full animate-spin" />
                        <Loader2 className="absolute inset-0 m-auto text-gold animate-pulse" size={32} />
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-black text-white uppercase tracking-widest animate-pulse">Reini está analizando los documentos...</p>
                        <p className="text-xs text-gold font-bold uppercase tracking-widest mt-2">Estamos pre-llenando el expediente por ti</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center text-white/20 group-hover:text-gold group-hover:scale-110 transition-all duration-500">
                        <Upload size={40} />
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-black text-white uppercase tracking-tighter">Cargar Documentación Maestro</p>
                        <p className="text-xs text-white/40 font-bold uppercase tracking-[0.2em] mt-2">Máximo 5 documentos para procesamiento OCR inteligente</p>
                      </div>
                      <div className="flex gap-4 mt-4">
                        <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-[9px] font-black text-white/40 uppercase tracking-widest">INE / RFC</div>
                        <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-[9px] font-black text-white/40 uppercase tracking-widest">CURP / NSS</div>
                        <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-[9px] font-black text-white/40 uppercase tracking-widest">ESTADOS CUENTA</div>
                      </div>
                    </>
                  )}
                  <input type="file" multiple accept=".pdf,image/*" ref={migrationFileInputRef} onChange={handleMigrationFileUpload} className="hidden" />
                </div>
              ) : (
                <div className="space-y-10 animate-in fade-in duration-500">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gold/10 border border-gold/20 rounded-2xl">
                    <CheckCircle2 className="text-gold" size={20} />
                    <p className="text-[10px] font-bold text-gold uppercase tracking-widest">Documentos analizados con éxito. Revisa la información resaltada.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 relative">
                    {/* SECCIÓN: IDENTIDAD */}
                    <div className="space-y-6">
                      <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] pb-2 border-b border-white/5">Datos de Identidad</h4>
                      <div className="grid grid-cols-1 gap-6">
                        {[
                          { label: 'Nombre Completo', key: 'nombre' },
                          { label: 'CURP', key: 'curp', max: 18 },
                          { label: 'RFC', key: 'rfc', max: 13 },
                          { label: 'NSS', key: 'nss', max: 11 }
                        ].map(field => (
                          <div key={field.key} className="space-y-1.5 group">
                            <div className="flex justify-between items-center px-1">
                              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">{field.label}</label>
                              {aiIdentifiedFields.has(field.key) && <span className="text-[8px] font-black text-gold bg-gold/10 px-1.5 py-0.5 rounded uppercase flex items-center gap-1">✨ AI</span>}
                            </div>
                            <input 
                              type="text" 
                              maxLength={field.max}
                              value={(migrationData as any)[field.key]}
                              onChange={(e) => setMigrationData({ ...migrationData, [field.key]: e.target.value.toUpperCase() })}
                              className={cn(
                                "w-full px-5 py-3.5 bg-white/5 border rounded-2xl outline-none text-xs font-bold uppercase transition-all",
                                aiIdentifiedFields.has(field.key) ? "border-gold/30 focus:border-gold shadow-[0_0_15px_rgba(218,165,32,0.1)]" : "border-white/10 focus:border-white/30"
                              )}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SECCIÓN: CONTACTO & TÉCNICOS */}
                    <div className="space-y-6">
                      <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] pb-2 border-b border-white/5">Contacto & Datos Técnicos</h4>
                      <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Email Técnico</label>
                           <input 
                            type="email" 
                            value={migrationData.email}
                            onChange={(e) => setMigrationData({ ...migrationData, email: e.target.value })}
                            className="w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl outline-none text-xs font-bold uppercase"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">C.P.</label>
                              <input 
                                type="text" 
                                maxLength={5}
                                value={migrationData.cp}
                                onChange={(e) => setMigrationData({ ...migrationData, cp: e.target.value.replace(/\D/g, '') })}
                                className={cn(
                                  "w-full px-5 py-3.5 bg-white/5 border rounded-2xl outline-none text-xs font-bold uppercase",
                                  aiIdentifiedFields.has('cp') ? "border-gold/30" : "border-white/10"
                                )}
                              />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">WhatsApp</label>
                              <input 
                                type="text" 
                                maxLength={10}
                                value={migrationData.whatsapp}
                                onChange={(e) => setMigrationData({ ...migrationData, whatsapp: e.target.value.replace(/\D/g, '') })}
                                className="w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl outline-none text-xs font-bold uppercase"
                              />
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Semanas</label>
                              <input 
                                type="number" 
                                value={migrationData.semanasCotizadas}
                                onChange={(e) => setMigrationData({ ...migrationData, semanasCotizadas: parseInt(e.target.value) || 0 })}
                                className={cn(
                                  "w-full px-5 py-3.5 bg-white/5 border rounded-2xl outline-none text-xs font-bold uppercase",
                                  aiIdentifiedFields.has('semanasCotizadas') ? "border-gold/30" : "border-white/10"
                                )}
                              />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Último Salario</label>
                              <input 
                                type="number" 
                                value={migrationData.ultimoSalario}
                                onChange={(e) => setMigrationData({ ...migrationData, ultimoSalario: parseFloat(e.target.value) || 0 })}
                                className={cn(
                                  "w-full px-5 py-3.5 bg-white/5 border rounded-2xl outline-none text-xs font-bold uppercase",
                                  aiIdentifiedFields.has('ultimoSalario') ? "border-gold/30" : "border-white/10"
                                )}
                              />
                           </div>
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Régimen Fiscal</label>
                           <input 
                            type="text" 
                            value={migrationData.regimenFiscal}
                            onChange={(e) => setMigrationData({ ...migrationData, regimenFiscal: e.target.value })}
                            className={cn(
                              "w-full px-5 py-3.5 bg-white/5 border rounded-2xl outline-none text-xs font-bold uppercase",
                              aiIdentifiedFields.has('regimenFiscal') ? "border-gold/30" : "border-white/10"
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    {/* SECCIÓN: ESTRATEGIA (ANCHO COMPLETO) */}
                    <div className="md:col-span-2 space-y-6 pt-6 border-t border-white/5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Promotor Asignado</label>
                           <select 
                            value={migrationData.promotor}
                            onChange={(e) => setMigrationData({ ...migrationData, promotor: e.target.value })}
                            className="w-full px-5 py-3.5 bg-[#1C222D] border border-white/10 rounded-2xl outline-none text-xs font-bold text-white uppercase appearance-none"
                           >
                             <option value="">Seleccionar Promotor...</option>
                             {promotoresList.map((p: any, i: number) => (
                               <option key={i} value={p.nombre || p.Nombre}>{p.nombre || p.Nombre}</option>
                             ))}
                           </select>
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Origen del Cliente</label>
                           <select 
                            value={migrationData.origen}
                            onChange={(e) => setMigrationData({ ...migrationData, origen: e.target.value })}
                            className="w-full px-5 py-3.5 bg-[#1C222D] border border-white/10 rounded-2xl outline-none text-xs font-bold text-white uppercase appearance-none"
                           >
                             <option value="Migración">Migración</option>
                             <option value="Externo">Externo</option>
                           </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
                    {migrationFiles.map((f, i) => (
                      <div key={i} className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-[9px] font-bold text-white/60">
                        <FileText size={14} className="text-gold" />
                        <span className="max-w-[100px] truncate">{f.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-10 flex gap-4">
                <button 
                  onClick={() => setShowMigrationModal(false)}
                  disabled={isExtractingDocuments || isSavingMigration}
                  className="flex-1 py-5 bg-white/5 text-white/40 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveMigration}
                  disabled={isExtractingDocuments || isSavingMigration || migrationModalStep === 'Carga'}
                  className="flex-[2] py-5 bg-gold text-black rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                >
                  {isSavingMigration ? <Loader2 className="animate-spin" size={18} /> : "Confirmar y Crear Expediente"} <ShieldPlus size={18} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      <input type="file" accept=".pdf,image/*" ref={paymentInputRef} onChange={handlePaymentUpload} className="hidden" />

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
