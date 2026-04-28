import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Filtro de Sanitización JSON Robusto
 * Extrae exclusivamente el bloque {...} para evitar errores por texto extra de la IA.
 */
function jsonSanitizer(text: string): any {
  try {
    const cleanText = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanText);
  } catch (e) {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch (e2) {
      console.error("[JSON-SANITIZER] Fallo total al parsear respuesta IA:", text);
    }
  }
  return {};
}

/**
 * OCR del Audit Digital - Extracción de datos maestros y complementarios.
 */
export async function extractDocumentData(base64Image: string, mimeType: string, docType: string = 'CSF') {
  if (!ai) throw new Error('CONFIG_ERROR: GEMINI_API_KEY no configurada');
  const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  
  let promptText = `Actúa como un extractor de datos oficial de México. Analiza este documento (${docType}) y extrae la información en un objeto JSON puro.
  
  PRIORIDAD TÉCNICA:
  - Si el documento es una "Constancia de Semanas Cotizadas" o "Estado de Cuenta AFORE", busca agresivamente el NSS y el historial de aportaciones.
  - El "nss" (Número de Seguridad Social) siempre tiene 11 dígitos.
  - "semanasCotizadas" suele aparecer como "Semanas Reconocidas" o "Semanas para trámite de pensión".
  - "ultimoSalario" puede aparecer como "SBC", "Salario Base de Cotización" o "Último Salario".

  Usa EXACTAMENTE estas claves, si el dato no está presente asigna un string vacío "":
  - "nombre": Nombre COMPLETO de la persona (incluyendo apellidos).
  - "curp": CURP (18 caracteres).
  - "rfc": RFC con homoclave (13 caracteres).
  - "nss": Número de Seguridad Social (11 dígitos).
  - "semanasCotizadas": Número de semanas reconocidas.
  - "ultimoSalario": Salario base de cotización o diario (Límpialo de símbolos como $ o comas).
  - "regimenFiscal": Régimen fiscal o tipo de contribuyente.
  - "domicilio": Domicilio completo o dirección.
  - "patrones": Lista de los últimos patrones o razones sociales.

  No inventes datos. Devuelve SOLO el bloque JSON validado.`;
  
  if (docType === 'COMPLEMENTARIO') {
      promptText = `Analiza este documento complementario de Seguridad Social (México). 
      1. Determina si es una 'Hoja Rosa' o una 'Resolución de Búsqueda de Semanas'.
      Devuelve SOLO JSON puro con llaves: "tipo_complemento" ('Hoja Rosa', 'Resolución', 'Ninguno'), "semanas_extra" (número), "notas_auditoria" (breve descripción técnica).`;
  } else if (docType === 'CSF' || docType === 'Constancia de Situación Fiscal') {
      promptText = `Analiza esta Constancia de Situación Fiscal (SAT México).
      Extrae rigurosamente la siguiente información en JSON puro (sin formato markdown):
      - "rfc": RFC con homoclave.
      - "curp": CURP.
      - "nombre": Nombre completo, denominación o razón social.
      - "regimenFiscal": Lista de regímenes fiscales o el principal.
      - "domicilio": Calle, número exterior, interior, colonia, municipio, entidad federativa.
      - "codigoPostal": El Código Postal MIDE EXACTAMENTE 5 DÍGITOS numéricos. Búscalo bajo el título "Datos del domicilio registrado", generalmente junto a la etiqueta "Código Postal:". 
      Devuelve SOLO los 5 dígitos numéricos. Ejemplo de salida esperada: {"rfc": "...", "curp": "...", "nombre": "...", "regimenFiscal": "...", "domicilio": "...", "codigoPostal": "53300"}. 
      Si no lo encuentras, devuelve "". No omitas esta clave.`;
  }

  let result;
  try {
    result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: promptText },
            { inlineData: { data: cleanBase64, mimeType: mimeType || 'application/pdf' } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
      }
    });
  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes("exceeded your current quota") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("⚠️ Cuota de IA excedida. Has alcanzado el límite de uso actual. Por favor, intenta de nuevo más tarde o procede con la captura manual de los datos.");
    }
    throw error;
  }
  
  const parsed = jsonSanitizer(result.text || "{}");
  
  // Limpieza de números y formatos
  const cleanNum = (v: any) => String(v || '').replace(/[^0-9]/g, '');

  return {
    nombre: String(parsed.nombre || '').trim().replace(/[\n\r]/g, ' '),
    curp: String(parsed.curp || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''),
    rfc: String(parsed.rfc || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''),
    nss: cleanNum(parsed.nss),
    semanasCotizadas: parseInt(cleanNum(parsed.semanasCotizadas)) || 0,
    ultimoSalario: parseFloat(String(parsed.ultimoSalario || 0).replace(/[^0-9.]/g, '')) || 0,
    regimenFiscal: String(parsed.regimenFiscal || '').trim(),
    domicilio: String(parsed.domicilio || '').trim().replace(/[\n\r]/g, ' '),
    codigoPostal: cleanNum(parsed.codigoPostal || parsed.cp).substring(0, 5) || '',
    tipo_complemento: parsed.tipo_complemento || 'Ninguno',
    semanas_extra: parseInt(cleanNum(parsed.semanas_extra)) || 0,
    patrones: String(parsed.patrones || '').trim()
  };
}

/**
 * Motor de Diálogo Consultivo - Redacción de Diagnóstico Inicial.
 * Diseñado para un intercambio dinámico entre el Asesor y la IA.
 */
export async function getConsultorChatResponse(history: any[], context: any) {
  if (!ai) return "Error: La inteligencia artificial no está configurada.";
  
  // Mapeo de historial para el formato del SDK
  const chatHistory = history.map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.parts[0].text }]
  }));

  const systemPrompt = `
    Eres el Redactor Jurídico y Consultor Senior de Social Push®.
    TU MISIÓN: Redactar el DIAGNÓSTICO INICIAL TÉCNICO enfocado en los servicios seleccionados y las observaciones del asesor.
    
    INSTRUCCIÓN INNEGOCIABLE: Emite DIRECTAMENTE el texto del diagnóstico. 
    NO utilices frases introductorias como "Este es el dictamen elaborado...", "Hola", o "Aquí tienes la propuesta...".
    Empieza directamente con el análisis técnico profesional.
    
    ESTRUCTURA SUGERIDA:
    1. Resumen técnico de la situación actual (Semanas, Salario, Edad).
    2. Análisis de Viabilidad basado en los servicios seleccionados (${context.serviciosStr || 'No especificados'}).
    3. Recomendaciones estratégicas puntuales basadas en las observaciones del asesor (${context.iaContext || 'Sin observaciones extras'}).
    
    CONTEXTO DEL CLIENTE:
    - Semanas Reconocidas: ${context.semanasCotizadas || 0}
    - Semanas Extra: ${context.semanasExtra || 0}
    - Salario Diario: ${context.ultimoSalario || 0}
    - Edad Calculada: ${context.edad || 'No especificada'}
    - Régimen: ${context.regimenFiscal || 'No especificado'}
    
    Usa un tono formal, ejecutivo y apegado a la Ley del Seguro Social (Ley 73).
  `;

  const chat = ai.chats.create({
    model: "gemini-2.5-flash",
    history: chatHistory,
    config: { systemInstruction: systemPrompt, temperature: 0.7 }
  });

  try {
    const result = await chat.sendMessage({ message: "Por favor, emite el diagnóstico." });
    return result.text;
  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes("exceeded your current quota") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      return "Hubo un error al generar el diagnóstico: Límite de Cuota de IA agotada. Por favor contacte con su administrador o revise la facturación.";
    }
    return `Error al generar el diagnóstico: ${error?.message || 'Error desconocido'}`;
  }
}

/**
 * Motor de Diálogo para el AISidebar (Consultor Técnico de Seguridad Social)
 */
export async function getSidebarConsultantResponse(history: any[], context: any) {
  if (!ai) return "Error: La inteligencia artificial no está configurada.";
  
  // El AISidebar envía el historial completo (incluyendo el último mensaje del usuario).
  // Separamos el historial "pasado" y el "mensaje actual".
  const pastHistory = history.slice(0, -1).map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.parts[0].text }]
  }));
  const currentMessage = history[history.length - 1]?.parts[0]?.text || "Hola";

  const systemPrompt = `
    Eres el Director de Operaciones y Estratega Principal (Consultor Senior) experto en Seguridad Social Mexicana (IMSS, ISSSTE, Modalidad 40, Modalidad 10, AFORE).
    Trabajas como el "Co-pilot" para los asesores de BAKSO S.C. (Social Push®).

    TU MISIÓN: Tienes total libertad para ayudar al asesor. No te limites solo a datos del sistema. 
    Puedes:
    - Redactar correos electrónicos profesionales para enviarlos a clientes.
    - Explicar regulaciones o fundamentos legales (Ley 73, Ley 97).
    - Proveer soporte creativo, estratégico y comercial para el cierre de ventas o manejo de objeciones.
    - Asesorar, responder dudas técnicas, recomendar estrategias y sugerir los mejores servicios para el cliente actual en tiempo real. 
    
    Actúa con un tono empático, ejecutivo pero amigable. 
    Sé versátil y detallado cuando la tarea lo requiera (como redactar algo) y conciso cuando sean dudas rápidas.

    CONTEXTO COMPLETO DEL EXPEDIENTE DEL CLIENTE ACTUAL:
    (La siguiente información es el estado completo de la auditoría y expediente del cliente en formato JSON estructurado)
    ${JSON.stringify({
      cliente: context?.currentCase?.cliente || {},
      diagnostico: context?.currentCase?.diagnostico || {}
    }, null, 2)}
    
    INFORMACIÓN RELEVANTE DESTACADA:
    - Nombre: ${context?.currentCase?.cliente?.nombre || 'Usuario Anónimo'} (CURP: ${context?.currentCase?.cliente?.curp || 'N/A'})
    - Domicilio y CP: ${context?.currentCase?.cliente?.domicilioExtraido || 'No especificado'} - ${context?.currentCase?.cliente?.cp || ''}
    - Semanas IMSS: ${context?.currentCase?.cliente?.semanasCotizadas || 0} + Semanas Extra: ${context?.currentCase?.cliente?.semanasExtra || 0}
    - Régimen / Edad: ${context?.currentCase?.cliente?.regimenFiscal || 'No especificado'} / ${context?.currentCase?.cliente?.edad || 'No especificada'}
    - Análisis OCR/Documental: ${JSON.stringify(context?.currentCase?.cliente?.metadatosAuditoria || {}, null, 2)}
    - Alertas Críticas / Observaciones: ${context?.currentCase?.cliente?.alertas || context?.currentCase?.cliente?.notasSeguimiento || 'Ninguna'}
    - Servicios propuestos: ${context?.currentCase?.diagnostico?.servicios?.map((s:any) => s.nombre).join(', ') || 'Ninguno aún'}

    INSTRUCCIONES:
    - Evalúa las respuestas o dudas del asesor en el chat basándote puramente en la Seguridad Social Mexicana.
    - Utiliza el CONTEXTO DEL CLIENTE ACTUAL para basar tus respuestas (ej. Si ves pocas semanas para una Ley 73, sugiere una Búsqueda de Semanas Cotizadas o Modalidad 10 para vigencia).
    - Si el usuario te pide una recomendación general, lee los datos del contexto y dale un análisis exprés sobre si es candidato a Modalidad 40 o no.
  `;

  const chat = ai.chats.create({
    model: "gemini-2.5-flash",
    history: pastHistory,
    config: { systemInstruction: systemPrompt, temperature: 0.5 }
  });

  try {
    const result = await chat.sendMessage({ message: currentMessage });
    return result.text;
  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes("exceeded your current quota") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      return "Hubo un error al generar respuestas: Cuota de IA agotada. Reintente más tarde.";
    }
    return `Error en el asistente: ${error?.message || 'Error desconocido'}`;
  }
}