import React from 'react';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  DollarSign,
  FileImage,
  MoreVertical,
  X,
  Loader2,
  Save
} from 'lucide-react';
import { GestionMensual, EstatusGestion, Cliente } from '@/types';
import { formatCurrency, cn, getMesActual } from '@/lib/utils';
import { callGAS, getGASData } from '@/services/apiService';

export default function GestionU2() {
  const [gestiones, setGestiones] = React.useState<GestionMensual[]>([]);
  const [clientes, setClientes] = React.useState<Cliente[]>([]);
  const [selectedMes, setSelectedMes] = React.useState(getMesActual());
  const [showForm, setShowForm] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [searchTermCliente, setSearchTermCliente] = React.useState('');
  const [selectedClienteId, setSelectedClienteId] = React.useState('');
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);

  React.useEffect(() => {
    loadData();
  }, [selectedMes]);

  const loadData = async () => {
    const data = await getGASData();
    if (data) {
      if (data.gestiones) {
        const findVal = (obj: any, targetKey: string) => {
          const keys = Object.keys(obj);
          if (obj[targetKey] !== undefined) return obj[targetKey];
          const lowerTarget = targetKey.toLowerCase();
          const foundKey = keys.find(k => k.toLowerCase() === lowerTarget || k.toLowerCase().replace(/_/g, '') === lowerTarget.replace(/_/g, ''));
          return foundKey ? obj[foundKey] : undefined;
        };

        const filtered = data.gestiones
          .filter((g: any) => (findVal(g, 'mesGestion') || findVal(g, 'mesgestion')) === selectedMes)
          .map((g: any) => ({
            ...g,
            id: findVal(g, 'id') || findVal(g, 'ID'),
            clienteId: findVal(g, 'clienteId') || findVal(g, 'clienteid'),
            mesGestion: findVal(g, 'mesGestion') || findVal(g, 'mesgestion'),
            montoTotalRecibido: Number(findVal(g, 'montoTotalRecibido') || findVal(g, 'montototalrecibido') || 0),
            pagoImssRealizado: Number(findVal(g, 'pagoImssRealizado') || findVal(g, 'pagoimssrealizado') || 0),
            honorariosBakso: Number(findVal(g, 'honorariosBakso') || findVal(g, 'honorariosbakso') || 0),
          }));
        setGestiones(filtered);
      }
      if (data.clientes) {
        setClientes(data.clientes);
      }
    }
  };

  const loadGestiones = loadData;

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedClienteId) {
      alert("Debes seleccionar un cliente");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      const clienteId = selectedClienteId;
      const id = `${clienteId}-${selectedMes}`;

      const payload = {
        id,
        clienteId,
        mesGestion: selectedMes,
        estatus: formData.get('estatus') as EstatusGestion,
        montoTotalRecibido: Number(formData.get('montoRecibido')),
        pagoImssRealizado: Number(formData.get('pagoImss')),
        honorariosBakso: Number(formData.get('honorarios')),
        updatedAt: Date.now(),
      };

      await callGAS('CREATE_GESTION', payload);
      setShowForm(false);
      setSelectedClienteId('');
      setSearchTermCliente('');
      loadGestiones();
    } catch (error) {
      console.error("Error guardando gestión:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const estatusColors: Record<EstatusGestion, string> = {
    'Pendiente': 'bg-slate-100 text-slate-600',
    'Recurso Recibido': 'bg-blue-100 text-blue-700',
    'Pagado IMSS': 'bg-amber-100 text-amber-700',
    'Finalizado': 'bg-emerald-100 text-emerald-700'
  };

  const totals = gestiones.reduce((acc, curr) => ({
    recibido: acc.recibido + (curr.montoTotalRecibido || 0),
    imss: acc.imss + (curr.pagoImssRealizado || 0),
    honorarios: acc.honorarios + (curr.honorariosBakso || 0),
  }), { recibido: 0, imss: 0, honorarios: 0 });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gestión Mensual U2</h2>
          <p className="text-slate-500">Control de Modalidad 10 y 40 (Gestión de Negocios)</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="month" 
            value={selectedMes}
            onChange={(e) => setSelectedMes(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none"
          />
          <button 
            onClick={() => setShowForm(true)}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            <Plus size={20} />
            Nueva Gestión
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Recibido</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totals.recibido)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Pagos IMSS</p>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(totals.imss)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Honorarios BAKSO</p>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totals.honorarios)}</p>
        </div>
      </div>

      {/* Gestiones Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estatus</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Monto Recibido</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Pago IMSS</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Honorarios</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Evidencia</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {gestiones.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">{item.clienteId}</p>
                    <p className="text-[10px] text-slate-400">Mes: {item.mesGestion}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                      estatusColors[item.estatus]
                    )}>
                      {item.estatus}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">{formatCurrency(item.montoTotalRecibido)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-amber-600">{formatCurrency(item.pagoImssRealizado)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-emerald-600">{formatCurrency(item.honorariosBakso)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button className="p-1.5 bg-slate-100 text-slate-500 rounded hover:text-blue-600 transition-colors" title="Comprobante IMSS">
                        <FileImage size={14} />
                      </button>
                      <button className="p-1.5 bg-slate-100 text-slate-500 rounded hover:text-blue-600 transition-colors" title="Factura Honorarios">
                        <DollarSign size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {gestiones.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No hay gestiones registradas para este mes.
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
          <div className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Nueva Gestión Mensual</h3>
              <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                              (c.id || '').toLowerCase().includes(searchTermCliente.toLowerCase())
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
                  <label className="text-xs font-bold text-slate-500 uppercase">Estatus Inicial</label>
                  <select name="estatus" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all">
                    <option value="Pendiente">Pendiente</option>
                    <option value="Recurso Recibido">Recurso Recibido</option>
                    <option value="Pagado IMSS">Pagado IMSS</option>
                    <option value="Finalizado">Finalizado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Monto Recibido</label>
                  <input name="montoRecibido" type="number" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Pago IMSS</label>
                  <input name="pagoImss" type="number" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Honorarios</label>
                  <input name="honorarios" type="number" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" placeholder="0.00" />
                </div>
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  Crear Gestión
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
