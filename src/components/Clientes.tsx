import React from 'react';
import { 
  Plus, 
  Search, 
  UserPlus, 
  Camera, 
  FileImage,
  MoreVertical,
  ExternalLink,
  Phone,
  Loader2,
  X
} from 'lucide-react';
import { generateCurp10, cn } from '@/lib/utils';
import { Cliente } from '@/types';
import { callGAS, getGASData } from '@/services/apiService';
import { extractDocumentData } from '@/services/geminiService';

export default function Clientes() {
  const [showForm, setShowForm] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [clientes, setClientes] = React.useState<Cliente[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isExtracting, setIsExtracting] = React.useState(false);
  const [domicilioExtraido, setDomicilioExtraido] = React.useState('');
  const [selfieBase64, setSelfieBase64] = React.useState<string | null>(null);
  const [domicilioBase64, setDomicilioBase64] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    const data = await getGASData();
    if (data && data.clientes) {
      setClientes(data.clientes);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'selfie' | 'domicilio') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      if (type === 'selfie') {
        setSelfieBase64(base64);
      } else {
        setDomicilioBase64(base64);
        setIsExtracting(true);
        const result = await extractDocumentData(base64, file.type);
        setDomicilioExtraido(result.domicilio || '');
        setIsExtracting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const formData = new FormData(e.currentTarget);
      const curp = formData.get('curp') as string;
      const id = generateCurp10(curp);

      const payload = {
        id,
        nombre: formData.get('nombre') as string,
        apellidos: formData.get('apellidos') as string,
        curp,
        nss: formData.get('nss') as string,
        rfc: formData.get('rfc') as string,
        whatsapp: formData.get('whatsapp') as string,
        email: formData.get('email') as string,
        domicilioExtraido: domicilioExtraido,
        selfieBase64: selfieBase64,
        domicilioBase64: domicilioBase64,
        createdAt: Date.now(),
      };

      await callGAS('CREATE_CLIENTE', payload);
      setShowForm(false);
      setDomicilioExtraido('');
      setSelfieBase64(null);
      setDomicilioBase64(null);
      loadClientes(); // Recargar datos
    } catch (error) {
      console.error("Error registrando cliente:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredClientes = clientes.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.apellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.curp.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.nss.includes(searchTerm)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Maestro de Clientes</h2>
          <p className="text-slate-500">Gestión de expedientes digitales y datos personales</p>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
        >
          <Plus size={20} />
          Nuevo Cliente
        </button>
      </div>

      {/* Search and Filters */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text"
          placeholder="Buscar por nombre, CURP o NSS..."
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Gallery View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredClientes.map((cliente) => (
          <div key={cliente.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group">
            <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden">
              {cliente.selfieUrl ? (
                <img 
                  src={cliente.selfieUrl} 
                  alt={cliente.nombre} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <UserPlus size={48} />
                </div>
              )}
              <div className="absolute top-3 right-3">
                <button className="p-1.5 bg-white/90 backdrop-blur rounded-lg shadow-sm text-slate-600 hover:text-slate-900">
                  <MoreVertical size={18} />
                </button>
              </div>
              <div className="absolute bottom-3 left-3">
                <span className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-md uppercase tracking-wider">
                  {cliente.id}
                </span>
              </div>
            </div>
            <div className="p-4">
              <h4 className="font-bold text-slate-900 truncate">{cliente.nombre} {cliente.apellidos}</h4>
              <p className="text-xs text-slate-500 mb-4 font-mono">{cliente.curp}</p>
              
              <div className="grid grid-cols-2 gap-2">
                <a 
                  href={`https://wa.me/${cliente.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                >
                  <Phone size={14} />
                  WhatsApp
                </a>
                <button className="flex items-center justify-center gap-2 py-2 bg-slate-50 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-100 transition-colors">
                  <ExternalLink size={14} />
                  Expediente
                </button>
              </div>
            </div>
          </div>
        ))}
        {filteredClientes.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
            <UserPlus className="mx-auto text-slate-300 mb-4" size={48} />
            <p className="text-slate-500 font-medium">No se encontraron clientes</p>
          </div>
        )}
      </div>

      {/* Registration Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Registro de Nuevo Cliente</h3>
              <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleRegister} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Nombre(s)</label>
                  <input name="nombre" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Apellidos</label>
                  <input name="apellidos" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">CURP Completa</label>
                  <input name="curp" required maxLength={18} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">NSS</label>
                  <input name="nss" required maxLength={11} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">RFC</label>
                  <input name="rfc" required maxLength={13} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">WhatsApp</label>
                  <input name="whatsapp" required type="tel" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                <input name="email" required type="email" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="p-4 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'selfie')} />
                  <Camera className="text-slate-400 group-hover:text-blue-500" size={32} />
                  <p className="text-xs font-bold text-slate-500 group-hover:text-blue-600">Selfie Cliente</p>
                </label>
                <label className="p-4 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group relative">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'domicilio')} />
                  {isExtracting ? (
                    <Loader2 className="text-blue-500 animate-spin" size={32} />
                  ) : (
                    <FileImage className="text-slate-400 group-hover:text-blue-500" size={32} />
                  )}
                  <p className="text-xs font-bold text-slate-500 group-hover:text-blue-600">Comprobante Domicilio</p>
                </label>
              </div>

              {domicilioExtraido && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Domicilio Extraído (AI)</p>
                  <p className="text-sm text-slate-700">{domicilioExtraido}</p>
                </div>
              )}

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={isSubmitting || isExtracting}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="animate-spin" size={20} />}
                  Guardar y Generar ID
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
