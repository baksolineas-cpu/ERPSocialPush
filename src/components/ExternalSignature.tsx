import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Webcam from 'react-webcam';
import SignatureCanvas from 'react-signature-canvas';
import { 
  Camera, Signature, ShieldCheck, CheckCircle2, AlertCircle, 
  Loader2, ArrowRight, FileText, Lock, ChevronDown
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
  const [error, setError] = useState<string | null>(null);

  const webcamRef = useRef<Webcam>(null);
  const sigPad = useRef<SignatureCanvas>(null);

  useEffect(() => {
    if (clienteId) {
      getGASData('GET_CLIENTE_STATUS', { curp: clienteId }).then(res => {
         if (res?.data) setClientData(res.data);
      }).catch(err => setError("No se pudo cargar la información del expediente."));
    }
  }, [clienteId]);

  const captureSelfie = () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) setSelfieBase64(imageSrc);
  };

  const handleSubmit = async () => {
    if (!selfieBase64 || !firmaBase64 || !clienteId) return;
    setIsProcessing(true);
    try {
      await callGAS("UPDATE_CLIENTE_SIGNATURE", {
          clienteId: clienteId.toUpperCase(),
          tipoDocumento: tipoDoc,
          selfieBase64,
          firmaBase64,
          timestamp: new Date().toISOString()
      });
      setStep(3);
    } catch (err) {
      setError("Fallo en la vinculación. Intente de nuevo.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (step === 3) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-10 text-center">
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-6">
          <div className="bg-emerald-100 p-8 rounded-full inline-block"><CheckCircle2 className="text-emerald-600" size={64} /></div>
          <h2 className="text-3xl font-black text-slate-900 uppercase">¡Firma Recibida!</h2>
          <p className="text-slate-500 max-w-xs mx-auto">Su expediente digital ha sido formalizado correctamente. Ya puede cerrar esta ventana.</p>
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
          <div><h1 className="text-sm font-black text-white leading-none">SOCIAL PUSH DIGITAL</h1><p className="text-[8px] font-bold text-white/50 uppercase tracking-widest">Portal de Firma Segura</p></div>
        </div>
        <div className="bg-white/10 px-4 py-1.5 rounded-full border border-white/10 text-white text-[10px] font-black uppercase">ID: {clienteId?.toUpperCase()}</div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full p-6 space-y-6">
        
        {/* Stepper de Navegación */}
        {step < 3 && (
          <div className="flex items-center justify-between px-2 mb-8">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex-1 flex items-center">
                <button 
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] transition-all",
                    step === i ? "bg-[#DAA520] text-[#003366] scale-110 shadow-lg" : 
                    step > i ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"
                  )}
                >
                  {step > i ? <CheckCircle2 size={16} /> : i + 1}
                </button>
                {i < 2 && <div className={cn("flex-1 h-0.5 mx-2", step > i ? "bg-emerald-500" : "bg-slate-200")} />}
              </div>
            ))}
          </div>
        )}

        {step === 0 && (
          <div className="bg-white p-8 rounded-[40px] shadow-xl border border-slate-100 space-y-8 animate-in slide-in-from-bottom duration-500">
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-black text-slate-900 uppercase">Revisión de Documentos</h3>
              <p className="text-xs text-slate-500">Lea atentamente su diagnóstico y contrato antes de firmar.</p>
            </div>
            
            <div className="bg-slate-50 p-6 rounded-3xl border space-y-4 max-h-[450px] overflow-y-auto custom-scrollbar shadow-inner">
               <div className="border-b pb-4">
                  <p className="text-[10px] font-black text-[#003366] uppercase">Titular del Servicio</p>
                  <p className="text-lg font-bold text-slate-800">{clientData?.nombre || 'Cargando...'}</p>
               </div>

               {tipoDoc.includes('CONTRATO') && (
                 <div className="space-y-4">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">I. Contrato de Prestación de Servicios</p>
                   <iframe 
                      src={`https://docs.google.com/viewer?url=https://docs.google.com/document/d/12GVFwA_zkRs4olXQaF2sL5E6Tw6em7ne19tw3y6vHL0/export?format=pdf&embedded=true`} 
                      className="w-full h-64 rounded-xl border-2 border-slate-200"
                   />
                 </div>
               )}

               <div className="space-y-4 pt-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">II. Hoja de Diagnóstico Técnico</p>
                  <div className="bg-white p-6 rounded-2xl text-xs text-slate-600 leading-relaxed italic border">
                    {clientData?.dictamen || "Dictamen técnico personalizado en proceso..."}
                  </div>
               </div>
            </div>

            <button onClick={() => setStep(1)} className="w-full py-6 bg-[#003366] text-white rounded-[24px] font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-xl">
              He leído y acepto los términos <ArrowRight size={18} />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="bg-white p-8 rounded-[40px] shadow-xl border border-slate-100 space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-2"><Camera size={18} className="text-[#DAA520]" /><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">1. Validación Biométrica</h4></div>
            <div className="aspect-square bg-slate-900 rounded-[32px] overflow-hidden ring-8 ring-slate-50 relative group">
              {selfieBase64 && selfieBase64 !== 'VALIDO' ? (
                <img src={selfieBase64} className="w-full h-full object-cover" />
              ) : (
                <Webcam ref={webcamRef} screenshotFormat="image/jpeg" screenshotQuality={1} className="w-full h-full object-cover" videoConstraints={{ facingMode: "user" }} />
              )}
              <button onClick={selfieBase64 ? () => setSelfieBase64(undefined) : captureSelfie} className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-md text-white px-8 py-3 rounded-full font-black text-[10px] uppercase border border-white/30">
                {selfieBase64 ? "Capturar de nuevo" : "Tomar Selfie Ahora"}
              </button>
            </div>
            <button disabled={!selfieBase64} onClick={() => setStep(2)} className="w-full py-6 bg-[#003366] text-white rounded-[24px] font-black uppercase text-xs tracking-widest disabled:opacity-50 transition-all">Continuar a la Firma</button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white p-8 rounded-[40px] shadow-xl border border-slate-100 space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Signature size={18} className="text-[#DAA520]" /><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2. Firma Digital</h4></div><button onClick={() => sigPad.current?.clear()} className="text-[9px] font-black text-red-500 uppercase tracking-tighter">Limpiar</button></div>
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] h-64 overflow-hidden relative">
              <SignatureCanvas ref={sigPad} onEnd={() => setFirmaBase64(sigPad.current?.getTrimmedCanvas().toDataURL('image/png'))} canvasProps={{ className: 'w-full h-full' }} />
            </div>
            {error && <div className="p-4 bg-red-50 text-red-700 text-[10px] font-bold rounded-xl flex items-center gap-2"><AlertCircle size={14}/> {error}</div>}
            <button onClick={handleSubmit} disabled={!firmaBase64 || isProcessing} className="w-full py-6 bg-emerald-600 text-white rounded-[24px] font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3">
              {isProcessing ? <Loader2 className="animate-spin" /> : <ShieldCheck />} {isProcessing ? "Vinculando..." : "Finalizar Formalización"}
            </button>
          </div>
        )}

        <footer className="space-y-4 pb-12">
          <div className="flex items-center gap-3 bg-white/50 p-4 rounded-2xl border border-white shadow-sm">
            <Lock className="text-slate-400" size={14} />
            <p className="text-[8px] text-slate-500 text-justify leading-relaxed italic">Protección de Datos: La firma electrónica estampada tiene plena validez jurídica conforme al <strong>Artículo 1803 del Código Civil Federal</strong>, reconociendo el consentimiento expreso del titular para SOCIAL PUSH S.C.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}