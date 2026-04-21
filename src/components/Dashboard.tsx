import React from 'react';
import { 
  TrendingUp, 
  Users, 
  Clock, 
  CheckCircle2,
  DollarSign,
  AlertCircle,
  FileText,
  ArrowUpRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { formatCurrency, cn } from '@/lib/utils';
import { getGASData } from '@/services/apiService';

export default function Dashboard() {
  const [counts, setCounts] = React.useState({ clientes: 0, hojas: 0, gestiones: 0, honorarios: 0 });
  const [chartData, setChartData] = React.useState([
    { name: 'Pendiente', value: 0, color: '#94a3b8' },
    { name: 'Recurso Recibido', value: 0, color: '#38bdf8' },
    { name: 'Pagado IMSS', value: 0, color: '#fbbf24' },
    { name: 'Finalizado', value: 0, color: '#22c55e' },
  ]);

  React.useEffect(() => {
    getGASData().then(data => {
      if (data) {
        const clientes = data.clientes || [];
        const hojas = data.hojas || [];
        const gestiones = data.gestiones || [];
        
        const honorarios = gestiones.reduce((acc: number, curr: any) => acc + (Number(curr.honorarios) || 0), 0);
        
        setCounts({
          clientes: clientes.length,
          hojas: hojas.length,
          gestiones: gestiones.length,
          honorarios
        });

        setChartData([
          { name: 'Pendiente', value: gestiones.filter((g: any) => g.estatus === 'Pendiente').length, color: '#94a3b8' },
          { name: 'Recurso Recibido', value: gestiones.filter((g: any) => g.estatus === 'Recurso Recibido').length, color: '#38bdf8' },
          { name: 'Pagado IMSS', value: gestiones.filter((g: any) => g.estatus === 'Pagado IMSS').length, color: '#fbbf24' },
          { name: 'Finalizado', value: gestiones.filter((g: any) => g.estatus === 'Finalizado').length, color: '#22c55e' },
        ]);
      }
    });
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Panel de Control</h2>
        <p className="text-slate-500">Resumen de gestión mensual Universo U2</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Clientes Activos', value: counts.clientes, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Hojas de Servicio', value: counts.hojas, icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Gestiones Mes', value: counts.gestiones, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Honorarios Est.', value: formatCurrency(counts.honorarios), icon: DollarSign, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-2 rounded-lg", stat.bg)}>
                <stat.icon className={stat.color} size={20} />
              </div>
              <TrendingUp size={16} className="text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Estatus de Gestión U2</h3>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              Actualizado hoy
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Alertas Recientes</h3>
            <button className="text-xs font-bold text-blue-600 hover:text-blue-700">Ver todas</button>
          </div>
          <div className="space-y-4">
            {[
              { title: 'Pago IMSS Pendiente', desc: 'Juan Pérez - Vence en 2 días', type: 'warning' },
              { title: 'Firma Faltante', desc: 'María García - Hoja de Servicio', type: 'error' },
              { title: 'Nueva Gestión', desc: 'Roberto Sosa - Recurso Recibido', type: 'info' },
            ].map((alert, i) => (
              <div key={i} className="flex gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                  alert.type === 'warning' ? 'bg-amber-50 text-amber-600' : 
                  alert.type === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                )}>
                  <AlertCircle size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{alert.title}</p>
                  <p className="text-xs text-slate-500 truncate">{alert.desc}</p>
                </div>
                <ArrowUpRight size={16} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
