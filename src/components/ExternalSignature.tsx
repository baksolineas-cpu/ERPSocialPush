import React, { useState, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Webcam from 'react-webcam';
import SignatureCanvas from 'react-signature-canvas';
import { 
  Camera, 
  Signature, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
  FileText,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { callGAS } from '@/services/apiService';

export default function ExternalSignature() {
  const { clienteId } = useParams();
  const [searchParams] = useSearchParams();
  const tipoDoc = searchParams.get('tipoDoc') || 'CONTRATO'; // CONTRATO o DIAGNOSTICO
  const skipSelfieParam = searchParams.get('skipSelfie') === 'true';
  
  const [step, setStep] = useState(0); // 0: Contrato, 1: Captura, 2: Éxito/Error
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientData, setClientData] = useState<any>(null);
  const [selfieBase64, setSelfieBase64] = useState<string | undefined>(skipSelfieParam ? 'URL_PREVIA' : undefined);
  const [firmaBase64, setFirmaBase64] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const webcamRef = useRef<Webcam>(null);
  const sigPad = useRef<SignatureCanvas>(null);

  useEffect(() => {
    // Carga de datos del cliente
    if (clienteId) {
      callGAS('GET_CLIENTE_STATUS', { curp: clienteId }).then(res => {
         if (res?.data) setClientData(res.data);
      }).catch(console.error);
    }
  }, [clienteId]);

  const captureSelfie = async () => {
    try {
        setError(null);
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) setSelfieBase64(imageSrc);
        else throw new Error("No se pudo capturar");
    } catch (err) {
        setError("Error al acceder a la cámara. Por favor verifica los permisos en la barra de direcciones del navegador.");
    }
  };

  const saveSignature = () => {
    if (sigPad.current) {
      setFirmaBase64(sigPad.current.getTrimmedCanvas().toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    sigPad.current?.clear();
    setFirmaBase64(undefined);
  };

  const handleSubmit = async () => {
    if (!selfieBase64 || !firmaBase64 || !clienteId) return;

    setIsProcessing(true);
    setError(null);

    try {
      const payload = {
        action: "UPDATE_CLIENTE_SIGNATURE",
        userEmail: "sistema@socialpush.com",
        payload: {
          clienteId: clienteId.toUpperCase(),
          tipoDocumento: tipoDoc,
          selfieBase64: selfieBase64,
          firmaBase64: firmaBase64,
          timestamp: new Date().toISOString()
        }
      };

      const response = await callGAS(payload.action, payload.payload, payload.userEmail);
      console.log("CONEXIÓN EXITOSA CON GAS:", response);

      // Si llega aquí asumimos éxito (o verificamos status si el servicio lo unifica)
      setStep(2);
    } catch (err) {
      console.error("Signature Error:", err);
      setError("Hubo un fallo en la conexión con el servidor. Por favor intente de nuevo.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (step === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col p-6 font-sans">
        <main className="flex-1 max-w-lg mx-auto w-full space-y-6">
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 text-center space-y-4">
             <FileText size={48} className="text-[#DAA520] mx-auto" />
             <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">Lectura de Contrato</h2>
             <p className="text-xs text-slate-500">Por favor, lee el siguiente contrato antes de proceder con tu validación biométrica y firma.</p>
          </div>
          <div className="bg-white p-6 rounded-[32px] border border-slate-200 h-96 overflow-hidden shadow-inner">
             {clientData ? (
                <iframe 
                    src={`https://docs.google.com/viewer?url=https://docs.google.com/document/d/12GVFwA_zkRs4olXQaF2sL5E6Tw6em7ne19tw3y6vHL0/export?format=pdf&embedded=true`} 
                    className="w-full h-full"
                    title="Contrato"
                />
             ) : <p className="text-center p-10">Cargando contrato...</p>}
          </div>
          <button onClick={() => setStep(1)} className="w-full py-5 bg-emerald-600 text-white rounded-[24px] font-black uppercase text-xs tracking-widest shadow-xl hover:scale-[1.02] transition-all">He leído y acepto el contrato</button>
        </main>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} 
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6"
        >
          <div className="bg-emerald-100 p-6 rounded-full inline-block">
            <CheckCircle2 className="text-emerald-600" size={48} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">¡Proceso Completado!</h2>
            <p className="text-slate-500 text-sm max-w-xs mx-auto">
              Tu firma y selfie han sido vinculadas correctamente a tu expediente digital. Ya puedes cerrar esta ventana.
            </p>
          </div>
          <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest leading-relaxed">
            SOCIAL PUSH © 2026 • TODOS LOS DERECHOS RESERVADOS
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header Branding */}
      <header className="bg-white border-b border-slate-100 py-4 px-6 sticky top-0 z-50">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <div className="bg-slate-900 p-1.5 rounded-lg">
              <ShieldCheck className="text-emerald-400" size={20} />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900 leading-none">SOCIAL PUSH DIGITAL</h1>
              <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Portal de Firma Externa</p>
            </div>
          </div>
          <div className="bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
             <span className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter">ID: {clienteId?.substring(0,8).toUpperCase()}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full p-6 space-y-8">
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 space-y-6">
          <div className="text-center space-y-1">
            <h3 className="text-xl font-black text-slate-900 uppercase">Firma de Documento</h3>
            <p className="text-xs text-slate-500 font-medium">Estás firmando: <span className="text-emerald-600 font-bold">{tipoDoc}</span></p>
          </div>

          {/* Selfie Section */}
          {!skipSelfieParam && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Camera size={16} className="text-slate-400" />
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-black">1. Evidencia Biométrica (Selfie)</h4>
            </div>
            <div className="aspect-square bg-slate-900 rounded-3xl overflow-hidden ring-4 ring-slate-50 relative group">
              {selfieBase64 ? (
                <img src={selfieBase64} className="w-full h-full object-cover" alt="Selfie" />
              ) : (
                <Webcam 
                  ref={webcamRef} 
                  screenshotFormat="image/jpeg"
                  screenshotQuality={1}
                  className="w-full h-full object-cover"
                  videoConstraints={{ facingMode: "user" }}
                />
              )}
              <button 
                onClick={selfieBase64 ? () => setSelfieBase64(undefined) : captureSelfie}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-md text-white px-6 py-2 rounded-full font-bold text-[10px] uppercase border border-white/30 hover:bg-white/40 transition-all"
              >
                {selfieBase64 ? "Capturar de nuevo" : "Tomar Selfie Ahora"}
              </button>
            </div>
          </section>
          )}

          {skipSelfieParam && (
             <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center gap-3 text-emerald-800">
                <CheckCircle2 size={18} className="shrink-0" />
                <p className="text-[10px] font-bold leading-tight">Tu selfie ya ha sido validada previamente. Por favor procede directamente a la firma.</p>
             </div>
          )}

          {/* Signature Section */}
          <section className="space-y-4">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Signature size={16} className="text-slate-400" />
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-black">2. Firma Manuscrita Digital</h4>
                </div>
                <button onClick={clearSignature} className="text-[9px] font-black text-red-400 uppercase tracking-tighter">Limpiar</button>
             </div>
             <div className="bg-slate-50 border-2 border-slate-100 rounded-3xl h-48 overflow-hidden relative">
                <SignatureCanvas 
                  ref={sigPad}
                  onEnd={saveSignature}
                  canvasProps={{ className: 'w-full h-full' }}
                />
                {!firmaBase64 && (
                  <p className="absolute inset-x-0 bottom-4 text-center text-[9px] text-slate-300 font-bold uppercase pointer-events-none">Firme sobre el área gris</p>
                )}
             </div>
          </section>

          {error && (
            <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-center gap-3 text-red-800">
               <AlertCircle size={18} className="shrink-0" />
               <p className="text-[10px] font-bold leading-tight">{error}</p>
            </div>
          )}

          <button 
            onClick={handleSubmit}
            disabled={!selfieBase64 || !firmaBase64 || isProcessing}
            className={cn(
              "w-full py-5 rounded-[24px] font-black text-xs uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-3 shadow-xl",
              (!selfieBase64 || !firmaBase64 || isProcessing) 
                ? "bg-slate-200 text-slate-400" 
                : "bg-emerald-600 text-white shadow-emerald-100 hover:scale-[1.02]"
            )}
          >
            {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
            {isProcessing ? "Vinculando..." : "Vincular Firma a Expediente"}
          </button>
        </div>

        {/* Legal Footer */}
        <footer className="space-y-4 pb-12">
          <div className="flex items-center gap-3 bg-white/50 p-4 rounded-2xl shadow-sm border border-white">
            <Lock className="text-slate-400" size={12} />
            <p className="text-[8px] text-slate-500 text-justify leading-relaxed italic">
              Sus datos personales y evidencia biométrica capturada en este portal están protegidos bajo la Ley Federal de Protección de Datos Personales en Posesión de los Particulares. La firma electrónica estampada tiene plena validez jurídica conforme al <span className="font-bold text-slate-700">Artículo 1803 del Código Civil Federal</span>, reconociendo el consentimiento expreso del titular para los fines de formalización de servicios profesionales con <span className="font-bold text-slate-700">SOCIAL PUSH S.C.</span>
            </p>
          </div>
          <p className="text-center text-[7px] font-black text-slate-300 uppercase tracking-[0.4em]">SOCIAL PUSH © 2026 | TODOS LOS DERECHOS RESERVADOS</p>
        </footer>
      </main>
    </div>
  );
}
