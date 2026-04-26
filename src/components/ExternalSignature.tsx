import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Webcam from 'react-webcam';
import SignatureCanvas from 'react-signature-canvas';
import { 
  Camera, Signature, ShieldCheck, CheckCircle2, AlertCircle, 
  Loader2, ArrowRight, FileText, Lock, ExternalLink, MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { callGAS, getGASData } from '@/services/apiService';

export default function ExternalSignature() {
  const { clienteId } = useParams();
  const [searchParams] = useSearchParams();
  const tipoDoc = searchParams.get('tipoDoc') || 'CONTRATO';
  const skipSelfieParam = searchParams.get('skipSelfie') === 'true';
  
  const [step, setStep] = useState(0); // 0: Revisión, 1: Selfie, 2: Firma, 3: Éxito
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientData, setClientData] = useState<any>(null);
  const [selfieBase64, setSelfieBase64] = useState<string | undefined>(skipSelfieParam ? 'VALIDO' : undefined);
  const [firmaBase64, setFirmaBase64] = useState<string | undefined>();
  const [signedDocUrls, setSignedDocUrls] = useState<string[]>([]);
  const [folderUrl, setFolderUrl] = useState<string | null>(null);
  const [montoTotal, setMontoTotal] = useState<string>("0.00");
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [contractUrl, setContractUrl] = useState(`https://drive.google.com/file/d/1JVxjrR3k7EOwiCG9l8SSGMEvTU4G_PwO3cOWqm0wQpk/preview`);

  const webcamRef = useRef<Webcam>(null);
  const sigPad = useRef<SignatureCanvas>(null);

  useEffect(() => {
    if (clienteId) {
      getGASData('GET_CLIENTE_STATUS', { curp: clienteId }).then(res => {
         if (res?.data) {
           setClientData(res.data);
           if (res.data.folder_url) setFolderUrl(res.data.folder_url);
           if (res.data.contrato_url) setContractUrl(res.data.contrato_url);
           // Hydrate montoTotal state if coming from payload
           if (res.data.montoTotal) {
             setMontoTotal(res.data.montoTotal);
           } else if (res.data.monto) {
             setMontoTotal(res.data.monto);
           }
         }
      }).catch(() => setError("No se pudo cargar la información del expediente."));
    }
  }, [clienteId]);

  const captureSelfie = () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) setSelfieBase64(imageSrc);
  };

  const handleCameraError = () => {
    setCameraError(true);
    setError("Error de acceso a cámara. Verifique permisos en su navegador.");
  };

  const handleSubmit = async () => {
    if (!selfieBase64 || !firmaBase64 || !clienteId) return;
    setIsProcessing(true);
    setError(null);
    try {
      const res = await callGAS("UPDATE_CLIENTE_SIGNATURE", {
          clienteId: clienteId.toUpperCase(),
          tipoDocumento: tipoDoc,
          selfieBase64,
          firmaBase64,
          timestamp: new Date().toISOString()
      });
      if (res?.signedDocUrls) setSignedDocUrls(res.signedDocUrls);
      if (res?.folderUrl) setFolderUrl(res.folderUrl);
      setStep(3); // Éxito
    } catch (err) {
      setError("Fallo en la vinculación. Intente de nuevo.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (step === 3) {
    const waMessage = `Hola ${clientData?.nombre || 'Cliente'}. Tu expediente ha sido formalizado.\n\nPuedes descargar tus documentos aquí:\n${signedDocUrls.join('\n')}${folderUrl ? `\n\nTu carpeta de expediente completa en Drive:\n${folderUrl}` : ''}`;
    const waUrl = `https://api.whatsapp.com/send?phone=${(clientData?.whatsapp || '').toString().replace(/\D/g, '')}&text=${encodeURIComponent(waMessage)}`;

    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-10 text-center">
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-6 w-full max-w-sm">
          <div className="bg-emerald-100 p-8 rounded-full inline-block"><CheckCircle2 className="text-emerald-600" size={64} /></div>
          <h2 className="text-3xl font-black text-slate-900 uppercase">¡Firma Recibida!</h2>
          <p className="text-slate-500 mx-auto">Su expediente digital ha sido formalizado correctamente.</p>
          
          <div className="space-y-3 pt-6">
            {signedDocUrls.map((url, idx) => (
              <a 
                key={idx} 
                href={url} 
                target="_blank" 
                rel="noreferrer"
                className="w-full flex items-center justify-between p-4 bg-slate-50 border rounded-2xl hover:bg-slate-100 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <FileText className="text-slate-400 group-hover:text-blue-600 transition-colors" size={20} />
                  <span className="text-[10px] font-black uppercase text-slate-600">Documento {idx + 1}</span>
                </div>
                <ExternalLink size={14} className="text-slate-300" />
              </a>
            ))}
          </div>

          <button 
            onClick={() => window.open(waUrl, '_blank')}
            className="w-full py-4 bg-[#25D366] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 mt-4"
          >
            <MessageSquare size={16} /> Enviar a mi WhatsApp
          </button>

          <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest pt-10">SOCIAL PUSH © 2026</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-[#003366] py-6 px-8 sticky top-0 z-50 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-[#DAA520] p-1.5 rounded-lg"><ShieldCheck className="text-[#003366]" size={20} /></div>
          <div><h1 className="text-sm font-black text-white leading-none uppercase">Social Push Digital</h1><p className="text-[8px] font-bold text-white/50 uppercase tracking-widest">Portal de Firma Segura</p></div>
        </div>
        <div className="bg-white/10 px-4 py-1.5 rounded-full text-white text-[10px] font-black uppercase border border-white/10">ID: {clienteId?.toUpperCase()}</div>
      </header>
 
       <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-8 space-y-8">
        
        {step === 0 && (
          <div className="bg-white p-6 md:p-12 rounded-[40px] shadow-2xl border border-slate-100 space-y-10 animate-in slide-in-from-bottom duration-700">
            <div className="text-center space-y-3">
              <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Certificación de Expediente</h3>
              <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Revisión de Diagnóstico y Contrato Marco</p>
            </div>
            
            <div className="space-y-10">
               <div className="bg-[#003366] p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-10 opacity-5 rotate-12"><ShieldCheck size={120} /></div>
                  <div className="relative z-10">
                    <p className="text-[10px] font-black uppercase text-[#DAA520] tracking-widest mb-2">Titular del Expediente</p>
                    <p className="text-3xl font-black uppercase tracking-tight leading-none mb-4">{clientData?.nombre || 'Cargando...'}</p>
                    <div className="flex flex-wrap gap-6 opacity-80 text-[11px] font-mono border-t border-white/10 pt-4">
                      <span>CURP: {clientData?.curp || '---'}</span>
                      <span>RFC: {clientData?.rfc || '---'}</span>
                    </div>
                  </div>
               </div>

               <div className="space-y-12">
                 {tipoDoc.includes('CONTRATO') && (
                   <div className="space-y-6">
                     <div className="flex items-center gap-3 border-b border-slate-100 pb-4 text-[#DAA520]">
                        <FileText size={18} />
                        <h4 className="text-xs font-black uppercase tracking-widest font-bold">I. Contrato Marco de Servicios</h4>
                     </div>
                     <div className="relative group rounded-3xl overflow-hidden border-2 border-slate-100 shadow-inner bg-slate-50">
                        <iframe 
                           src={contractUrl.includes('drive.google.com') && !contractUrl.includes('/preview') ? contractUrl.replace('/view', '/preview') : contractUrl} 
                           className="w-full h-[700px] border-none"
                           title="Contrato"
                        />
                        <div className="absolute inset-0 pointer-events-none border-4 border-emerald-500/0 group-hover:border-emerald-500/5 transition-all" />
                     </div>
                   </div>
                 )}

                 <div className="space-y-6">
                   <div className="flex items-center gap-3 border-b border-slate-100 pb-4 text-[#DAA520]">
                      <FileText size={18} />
                      <h4 className="text-sm font-black uppercase tracking-widest font-bold font-sans">II. Diagnóstico Inicial Certificado</h4>
                   </div>
                   <div className="bg-white p-8 md:p-12 rounded-[40px] border-2 border-slate-100 shadow-xl relative group">
                      <div className="absolute top-0 left-0 w-3 h-full bg-[#DAA520]" />
                      <div className="flex justify-between items-start mb-8 border-b border-slate-50 pb-6">
                        <div className="space-y-1">
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Dictamen para:</p>
                          <p className="text-sm font-black text-[#003366] uppercase">{clientData?.nombre} | CURP: {clientData?.curp} | RFC: {clientData?.rfc || '[RFC]'}</p>
                        </div>
                        <FileText className="text-slate-100 group-hover:text-slate-200 transition-colors" size={48} />
                      </div>
                      <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 italic text-slate-900 leading-relaxed whitespace-pre-wrap text-sm shadow-inner mb-10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none -rotate-12"><FileText size={80} /></div>
                        <div className="relative z-10">
                          {clientData?.diagnosticoTexto || clientData?.hojaservicio?.diagnostico || "Cargando su diagnóstico personalizado..."}
                        </div>
                      </div>

                      {clientData?.hojaservicio && (
                        <div className="space-y-6">
                           <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                             <h5 className="text-[10px] font-black uppercase text-[#003366] mb-3">Resumen de Servicios Contratados</h5>
                             <p className="text-sm font-bold text-slate-800">{clientData.hojaservicio.servicios || 'No especificado'}</p>
                             <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                               <span className="text-[10px] font-bold text-slate-400 uppercase">Monto Total Estimado</span>
                               <span className="text-xl font-black text-[#DAA520]">${montoTotal}</span>
                             </div>
                           </div>

                           {clientData.hojaservicio.asesor && (
                             <div className="pt-6 border-t border-slate-100 mt-6 grid grid-cols-2">
                               <div className="space-y-2">
                                 <p className="text-[10px] font-black uppercase text-slate-400">Asesor a Cargo</p>
                                 <p className="text-xs font-bold text-[#003366] uppercase">{clientData.hojaservicio.asesor}</p>
                               </div>
                               {clientData.hojaservicio.firmaasesor && (
                                 <div className="flex flex-col items-end">
                                   <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Firma del Asesor</p>
                                   <div className="bg-white border rounded p-2 h-16 w-32 flex items-center justify-center">
                                      <img src={clientData.hojaservicio.firmaasesor} alt="Firma Asesor" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                                   </div>
                                 </div>
                               )}
                             </div>
                           )}
                        </div>
                      )}
                   </div>
                 </div>
               </div>
            </div>

            <button onClick={() => setStep(1)} className="w-full py-6 bg-[#003366] text-white rounded-[32px] font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-[#002244] active:scale-[0.98] transition-all flex items-center justify-center gap-4 group">
              He leído y acepto los términos <ArrowRight className="group-hover:translate-x-2 transition-transform" />
            </button>
          </div>
        )}
 
        {step === 1 && (
          <div className="bg-white p-8 rounded-[40px] shadow-xl border border-slate-100 space-y-6 animate-in fade-in duration-500 text-center">
            <div className="flex items-center gap-2 justify-center mb-4 text-[#DAA520]">
                <Camera size={24} />
                <h4 className="text-xs font-black uppercase tracking-widest">1. Validación Biométrica (Selfie)</h4>
            </div>
             <div className="aspect-square bg-slate-900 rounded-[32px] overflow-hidden ring-8 ring-slate-50 relative group shadow-2xl mx-auto max-w-[320px]">
               {selfieBase64 && selfieBase64 !== 'VALIDO' ? (
                 <img src={selfieBase64} className="w-full h-full object-cover" alt="Captured Selfie" />
               ) : (
                 <Webcam 
                   audio={false} 
                   ref={webcamRef}
                   screenshotFormat="image/jpeg" 
                   screenshotQuality={1} 
                   onUserMediaError={handleCameraError}
                   className="w-full h-full object-cover" 
                   videoConstraints={{ facingMode: "user" }} 
                 />
               )}
               {cameraError ? (
                 <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-900 text-white space-y-4">
                   <AlertCircle size={48} className="text-amber-500" />
                   <p className="text-xs font-bold leading-relaxed">No se detectó acceso a la cámara. Por favor asegúrese de:</p>
                   <ul className="text-[10px] text-slate-400 space-y-1 text-left list-disc pl-4">
                     <li>Dar permiso de cámara en el navegador</li>
                     <li>Activar la cámara en Configuración {'>'} Privacidad</li>
                     <li>Recargar esta página</li>
                   </ul>
                   <button onClick={() => window.location.reload()} className="px-6 py-2 bg-[#DAA520] text-[#003366] rounded-full font-black text-[10px] uppercase">Reintentar</button>
                 </div>
               ) : (
                 <button 
                   onClick={selfieBase64 ? () => setSelfieBase64(undefined) : captureSelfie} 
                   className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#003366]/80 backdrop-blur-md text-white px-8 py-3 rounded-full font-black text-[10px] uppercase border border-white/30 hover:bg-[#003366] transition-all"
                 >
                   {selfieBase64 ? "Capturar de nuevo" : "Tomar Foto Ahora"}
                 </button>
               )}
             </div>
            <button 
              disabled={!selfieBase64} 
              onClick={() => setStep(2)} 
              className="w-full py-6 bg-[#003366] text-white rounded-[24px] font-black uppercase text-xs tracking-widest shadow-lg transition-all disabled:opacity-50 mt-4"
            >
              Continuar a la Firma
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white p-8 rounded-[40px] shadow-xl border border-slate-100 space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Signature size={18} className="text-[#DAA520]" />
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2. Firma Manuscrita Digital</h4>
                </div>
                <button onClick={() => sigPad.current?.clear()} className="text-[9px] font-black text-red-500 uppercase tracking-tighter">Limpiar</button>
            </div>
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] h-64 overflow-hidden relative shadow-inner">
              <SignatureCanvas 
                ref={sigPad} 
                onEnd={() => setFirmaBase64(sigPad.current?.getTrimmedCanvas().toDataURL('image/png'))} 
                canvasProps={{ className: 'w-full h-full' }} 
              />
            </div>
            {error && <div className="p-4 bg-red-50 text-red-700 text-[10px] font-bold rounded-xl flex items-center gap-2"><AlertCircle size={14}/> {error}</div>}
            <button 
              onClick={handleSubmit} 
              disabled={!firmaBase64 || isProcessing} 
              className="w-full py-6 bg-emerald-600 text-white rounded-[24px] font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : <ShieldCheck />} {isProcessing ? "Vinculando..." : "Finalizar Formalización"}
            </button>
          </div>
        )}

        <footer className="space-y-4 pb-12">
          <div className="flex items-center gap-3 bg-white/50 p-4 rounded-2xl border border-white shadow-sm">
            <Lock className="text-slate-400" size={14} />
            <p className="text-[8px] text-slate-500 text-justify leading-relaxed italic">
                Protección de Datos: La firma electrónica estampada tiene plena validez jurídica conforme al <strong>Artículo 1803 del Código Civil Federal</strong>, reconociendo el consentimiento expreso del titular para SOCIAL PUSH S.C.
            </p>
          </div>
          <p className="text-center text-[7px] font-black text-slate-300 uppercase tracking-[0.4em]">SOCIAL PUSH © 2026 | TODOS LOS DERECHOS RESERVADOS</p>
        </footer>
      </main>
    </div>
  );
}