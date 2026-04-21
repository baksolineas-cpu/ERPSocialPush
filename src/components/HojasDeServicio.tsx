import React from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { 
  FileText, 
  Plus, 
  Search, 
  Trash2, 
  Save,
  CheckCircle,
  X,
  Loader2
} from 'lucide-react';
import { CATALOGO_SERVICIOS, HojaServicio, UniversoServicio, Cliente } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { callGAS, getGASData } from '@/services/apiService';

export default function HojasDeServicio() {
  const [showForm, setShowForm] = React.useState(false);
  const [hojas, setHojas] = React.useState<HojaServicio[]>([]);
  const [clientes, setClientes] = React.useState<Cliente[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [searchTermCliente, setSearchTermCliente] = React.useState('');
  const [selectedClienteId, setSelectedClienteId] = React.useState('');
  const [honorariosValue, setHonorariosValue] = React.useState<number>(0);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const sigCanvas = React.useRef<SignatureCanvas>(null);

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const data = await getGASData();
    if (data) {
      if (data.hojas) {
        const normalized = data.hojas.map((h: any) => {
          // Helper to find value regardless of key variations
          const findVal = (obj: any, targetKey: string) => {
            const keys = Object.keys(obj);
            // Try exact match
            if (obj[targetKey] !== undefined) return obj[targetKey];
            // Try lowercase match
            const lowerTarget = targetKey.toLowerCase();
            const foundKey = keys.find(k => k.toLowerCase() === lowerTarget || k.toLowerCase().replace(/_/g, '') === lowerTarget.replace(/_/g, ''));
            return foundKey ? obj[foundKey] : undefined;
          };

          return {
            ...h,
            id: findVal(h, 'id') || findVal(h, 'ID'),
            clienteId: findVal(h, 'clienteId') || findVal(h, 'clienteid') || findVal(h, 'cliente_id'),
            universo: findVal(h, 'universo'),
            honorariosAcordados: Number(findVal(h, 'honorariosAcordados') || findVal(h, 'honorarios_acordados') || findVal(h, 'honorariosacordados') || findVal(h, 'honorarios') || 0),
            notasDiagnostico: findVal(h, 'notasDiagnostico') || findVal(h, 'notas_diagnostico') || findVal(h, 'notasdiagnostico'),
            createdAt: findVal(h, 'createdAt') || findVal(h, 'created_at') || findVal(h, 'createdat'),
            servicios: typeof (findVal(h, 'servicios') || '') === 'string' 
              ? (findVal(h, 'servicios') || '').split(',').map((s: string) => s.trim()) 
              : (Array.isArray(findVal(h, 'servicios')) ? findVal(h, 'servicios') : [])
          };
        });
        setHojas(normalized);
      }
      if (data.clientes) {
        setClientes(data.clientes);
      }
    }
  };

  const loadHojas = loadData; // Alias for compatibility

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sigCanvas.current?.isEmpty()) {
      alert("La firma es obligatoria");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      const selectedServicios = Array.from(formData.getAll('servicios')) as string[];
      const clienteId = selectedClienteId;
      
      if (!clienteId) {
        alert("Debes seleccionar un cliente");
        setIsSubmitting(false);
        return;
      }

      const id = `HS-${clienteId}-${Date.now()}`;
      const firmaBase64 = sigCanvas.current?.getCanvas().toDataURL();

      const payload = {
        id,
        clienteId,
        universo: formData.get('universo') as UniversoServicio,
        servicios: selectedServicios,
        honorariosAcordados: honorariosValue,
        notasDiagnostico: formData.get('notas') as string,
        firmaBase64,
        createdAt: Date.now(),
      };

      await callGAS('CREATE_HOJA', payload);
      setShowForm(false);
      setSelectedClienteId('');
      setSearchTermCliente('');
      setHonorariosValue(0);
      loadHojas();
    } catch (error) {
      console.error("Error guardando hoja de servicio:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Hojas de Servicio</h2>
          <p className="text-slate-500">Documentación de entrevistas y diagnósticos 1:1</p>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
        >
          <Plus size={20} />
          Nueva Hoja
        </button>
      </div>

      {/* List of Hojas */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ID / Fecha</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Universo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Servicios</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Honorarios</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hojas.map((hoja, index) => (
                <tr key={`${hoja.id}-${index}`} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">{hoja.id}</p>
                    <p className="text-[10px] text-slate-400">{new Date(hoja.createdAt).toLocaleDateString()}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-700">{hoja.clienteId}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                      hoja.universo === 'U1' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                    )}>
                      {hoja.universo}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {hoja.servicios.map((s, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">{formatCurrency(hoja.honorariosAcordados)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                      <FileText size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {hojas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No hay hojas de servicio registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Nueva Hoja de Servicio</h3>
              <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-bold text-slate-500 uppercase">Seleccionar Cliente</label>
                  <div className="relative">
                    <div 
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer flex items-center justify-between"
                    >
                      <span className={cn("truncate", !selectedClienteId && "text-slate-400")}>
                        {selectedClienteId 
                          ? `[${selectedClienteId}] - ${clientes.find(c => c.id === selectedClienteId)?.nombre} ${clientes.find(c => c.id === selectedClienteId)?.apellidos}`
                          : "Selecciona un cliente..."}
                      </span>
                      <Search size={16} className="text-slate-400" />
                    </div>

                    {isDropdownOpen && (
                      <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-2 border-b border-slate-100">
                          <input 
                            type="text"
                            placeholder="Buscar por nombre..."
                            className="w-full px-3 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-0 outline-none"
                            value={searchTermCliente}
                            onChange={(e) => setSearchTermCliente(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                          />
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          {clientes
                            .filter(c => 
                              `${c.nombre} ${c.apellidos}`.toLowerCase().includes(searchTermCliente.toLowerCase()) ||
                              c.id.toLowerCase().includes(searchTermCliente.toLowerCase())
                            )
                            .map(cliente => (
                              <div 
                                key={cliente.id}
                                onClick={() => {
                                  setSelectedClienteId(cliente.id);
                                  setIsDropdownOpen(false);
                                  setSearchTermCliente('');
                                }}
                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors border-b border-slate-50 last:border-none"
                              >
                                <p className="text-sm font-bold text-slate-900">
                                  {cliente.nombre} {cliente.apellidos}
                                </p>
                                <p className="text-[10px] font-mono text-slate-500 uppercase">
                                  ID: {cliente.id}
                                </p>
                              </div>
                            ))}
                          {clientes.length === 0 && (
                            <div className="px-4 py-8 text-center text-slate-400 text-sm">
                              No hay clientes registrados
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Universo de Servicio</label>
                  <select name="universo" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all">
                    <option value="U1">Única Vez (U1)</option>
                    <option value="U2">Recurrente (U2)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase">Servicios Requeridos</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CATALOGO_SERVICIOS.map((servicio) => (
                    <label key={servicio} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 hover:bg-white hover:border-blue-400 transition-all cursor-pointer">
                      <input type="checkbox" name="servicios" value={servicio} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                      <span className="text-sm font-medium text-slate-700">{servicio}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Honorarios Acordados (MXN)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input 
                    name="honorarios" 
                    type="number" 
                    required 
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                    placeholder="0.00"
                    value={honorariosValue || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setHonorariosValue(isNaN(val) ? 0 : val);
                    }}
                    onBlur={() => {
                      if (!honorariosValue) setHonorariosValue(0);
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Notas de Diagnóstico</label>
                <textarea name="notas" rows={4} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none" placeholder="Detalles de la entrevista..." />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500 uppercase">Firma Digital del Cliente</label>
                  <button type="button" onClick={() => sigCanvas.current?.clear()} className="text-[10px] font-bold text-red-500 uppercase hover:text-red-600">
                    Limpiar
                  </button>
                </div>
                <div className="border-2 border-slate-200 rounded-2xl bg-slate-50 overflow-hidden h-48">
                  <SignatureCanvas 
                    ref={sigCanvas}
                    penColor="black"
                    canvasProps={{ className: 'w-full h-full' }}
                  />
                </div>
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  Finalizar y Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
