export type UniversoServicio = 'U1' | 'U2';
export type EstatusGestion = 'Pendiente' | 'Recurso Recibido' | 'Pagado IMSS' | 'Finalizado';
export type UserRole = 'Admin' | 'Promoción';
export type EstatusExpediente = 'Completo' | 'Pendiente de Gestoría';
export type NivelCerteza = 'Alto' | 'Bajo - Sujeto a Verificación' | 'Bajo';

export interface User {
  email: string;
  role: UserRole;
  name: string;
}

export interface ServicioCotizado {
  nombre: string;
  monto: number;
  frecuencia: 'Único' | 'Recurrente';
  descripcion: string;
}

export interface Cliente {
  id: string; // CURP10
  nombre: string;
  apellidos: string;
  curp: string;
  nss: string;
  nssList?: string[];
  nssPrincipal?: string;
  rfc: string;
  regimen?: string;
  whatsapp: string;
  email: string;
  fechaNacimiento?: string; // YYYY-MM-DD
  edadExacta?: {
    anios: number;
    meses: number;
  };
  edadPensionCalculada?: number; // X+1 si meses > 6
  porcentajePension?: number;
  semanasCotizadas?: number;
  ultimoSalario?: number;
  salarioPromedio?: number;
  semanasExtra?: number;
  semanasExtraDictaminadas?: number;
  regimenFiscal?: string;
  contratourl?: string;
  estatusExpediente?: EstatusExpediente;
  notasSeguimiento?: string;
  contextoAsesor?: string;
  rutaCriticaSug?: string;
  serviciosSeleccionados?: string[];
  serviciosCotizados?: ServicioCotizado[];
  nombreAsesor?: string;
  nivelCerteza?: NivelCerteza;
  selfieUrl?: string;
  selfieurl?: string;
  selfieBase64?: string;
  firmaUrl?: string;
  firmaAsesorUrl?: string;
  ine_url?: string;
  comprobante_url?: string;
  comprobanteDomicilioUrl?: string;
  domicilioExtraido?: string;
  estatusAuditoria?: string;
  estatusfirma?: string;
  statusSignature?: string;
  idCarpetaDrive?: string;
  idcarpetadrive?: string;
  id_carpeta_drive?: string;
  drive_verificado?: boolean;
  contrato_url?: string;
  firma_url?: string;
  comprobantedomiciliourl?: string;
  afore_url?: string;
  semanas_url?: string;
  csf_url?: string;
  estadoauditoria?: string;
  expedienteExistingFiles?: {
    csf?: boolean;
    domicilio?: boolean;
    ine?: boolean;
    selfie?: boolean;
    afore?: boolean;
    semanas?: boolean;
    contrato?: boolean;
  };
  documentosExtraidos?: {
    curp?: any;
    nss?: any;
    rfc?: any;
    [key: string]: any;
  };
  metadatosAuditoria?: {
    metodoCaptura: 'OCR' | 'Manual';
    matchDocumental: boolean;
    timestampOperacion?: number;
    ipCaptura?: string;
    timestampFirma?: number;
    alertas?: string[];
    discrepancias?: {
      campo: string;
      doc1: string;
      doc2: string;
      valor1: string;
      valor2: string;
      msg?: string;
    }[];
    certezaJuridica?: 'Verde' | 'Amarillo' | 'Rojo';
  };
  semanasRecuperables?: {
    id: string;
    patron_nombre: string;
    fecha_inicio: string;
    fecha_fin: string;
    semanas_reconocidas: number;
    fileName?: string;
    relevancia?: string;
  }[];
  createdAt: number;
  modalidadFormalizacion?: 'Presencial' | 'A Distancia';
  remoteSyncSuccess?: boolean;
}

export interface HojaServicio {
  id: string;
  clienteId: string;
  universo: UniversoServicio;
  servicios: string[];
  honorariosAcordados: number;
  notasDiagnostico: string;
  firmaDigitalUrl: string;
  createdAt: number;
}

export interface AuditLog {
  usuario: string;
  fechaHora: number;
  accion: string;
  detalles: string;
}

export interface GestionMensual {
  id: string;
  clienteId: string;
  mesGestion: string; // YYYY-MM
  estatus: EstatusGestion;
  montoTotalRecibido: number;
  pagoImssRealizado: number;
  honorariosBakso: number;
  comprobantePagoImssUrl?: string;
  facturaHonorariosUrl?: string;
  updatedAt: number;
}

export const CATALOGO_SERVICIOS = [
  "Modalidad 10",
  "Modalidad 40",
  "Corrección de Datos",
  "Búsqueda de Semanas",
  "Recurso de Inconformidad",
  "Asesoría Integral",
  "Trámite de Pensión"
];
