import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { 
  Shield, 
  Camera, 
  CheckCircle, 
  FileText, 
  Loader2,
  Lock,
  ArrowRight
} from 'lucide-react';
import { callGAS } from '@/services/apiService';
import { cn } from '@/lib/utils';

export default function ClientView() {
  const { clienteId } = useParams();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selfie, setSelfie] = useState<string | null>(null);
  const sigCanvas = useRef<SignatureCanvas>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error cámara:", err);
      alert("No se pudo acceder a la cámara");
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg');
    setSelfie(base64);
    // Stop stream
    const stream = video.srcObject as MediaStream;
    stream.getTracks().forEach(track => track.stop());
  };

  const handleFinish = async () => {
    if (sigCanvas.current?.isEmpty()) {
      alert("Por favor firma el documento");
      return;
    }
    if (!selfie) {
      alert("Por favor toma tu selfie de identidad");
      return;
    }

    setIsSubmitting(true);
    try {
      const firmaBase64 = sigCanvas.current?.getCanvas().toDataURL();
      await callGAS('UPDATE_CLIENTE_SIGNATURE', {
        clienteId,
        selfieBase64: selfie,
        firmaBase64
      });
      setStep(4);
    } catch (error) {
      console.error("Error:", error);
      alert("Hubo un error al enviar tus datos");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4">
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="text-blue-400" size={24} />
            <h1 className="font-bold">BAKSO - Firma Segura</h1>
          </div>
          <div className="text-[10px] font-bold px-2 py-1 bg-blue-500/20 rounded-full text-blue-400 uppercase">
            ID: {clienteId}
          </div>
        </div>

        <div className="p-8">
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-blue-600">
                <FileText size={24} />
                <h2 className="text-xl font-bold">Aviso de Privacidad y Contrato</h2>
              </div>
              <div className="h-64 overflow-y-auto p-4 bg-slate-50 rounded-2xl text-xs text-slate-600 leading-relaxed border border-slate-100">
                <p className="font-bold mb-2">BAKSO, S.C. - SERVICIOS DE CONSULTORÍA</p>
                <p className="mb-4">
                  En cumplimiento con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares, BAKSO, S.C. le informa que sus datos personales serán utilizados exclusivamente para la gestión de su expediente de Seguridad Social...
                </p>
                <p className="mb-4">
                  CONTRATO DE PRESTACIÓN DE SERVICIOS PROFESIONALES:
                  El cliente acepta los términos y condiciones de la asesoría integral para Modalidad 10/40...
                </p>
                <p>
                  [Texto completo del contrato scrolleable...]
                </p>
              </div>
              <button 
                onClick={() => setStep(2)}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all"
              >
                He leído y acepto <ArrowRight size={20} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="p-4 bg-blue-50 rounded-full">
                  <Camera size={32} className="text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Validación de Identidad</h2>
                <p className="text-sm text-slate-500">Por favor, tómate una selfie clara para validar tu firma.</p>
              </div>

              {!selfie ? (
                <div className="space-y-4">
                  <div className="aspect-square bg-slate-900 rounded-3xl overflow-hidden relative">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={startCamera} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm">Activar Cámara</button>
                    <button onClick={takePhoto} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm">Tomar Foto</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <img src={selfie} alt="Selfie" className="aspect-square w-full rounded-3xl object-cover border-4 border-blue-500" />
                  <button onClick={() => setSelfie(null)} className="text-sm font-bold text-red-500">Repetir Foto</button>
                  <button onClick={() => setStep(3)} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold">Continuar</button>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-slate-900">Firma Digital</h2>
                <p className="text-sm text-slate-500">Firma dentro del recuadro blanco.</p>
              </div>
              <div className="border-2 border-slate-200 rounded-3xl bg-slate-50 overflow-hidden h-64">
                <SignatureCanvas 
                  ref={sigCanvas}
                  penColor="black"
                  canvasProps={{ className: 'w-full h-full' }}
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => sigCanvas.current?.clear()} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm">Limpiar</button>
                <button 
                  onClick={handleFinish}
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Finalizar"}
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center space-y-6 py-10">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={48} className="text-green-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">¡Todo listo!</h2>
                <p className="text-slate-500">Tus documentos y firma han sido enviados con éxito. Ya puedes cerrar esta ventana.</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-2xl flex items-center gap-3 text-left">
                <Lock size={20} className="text-blue-600 flex-shrink-0" />
                <p className="text-[10px] text-blue-700 font-medium">Tus datos están protegidos con encriptación de grado bancario y cumplen con la LFPDPPP.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
