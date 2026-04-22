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
Usa EXACTAMENTE estas claves, si el dato no está presente asigna un string vacío "":
- "nombre": Nombre completo de la persona.
- "curp": CURP (18 caracteres).
- "rfc": RFC con homoclave (13 caracteres).
- "nss": Número de Seguridad Social (11 dígitos).
- "semanasCotizadas": Número de semanas reconocidas.
- "ultimoSalario": Salario base de cotización o diario.
- "regimenFiscal": Régimen fiscal o tipo de contribuyente.
- "domicilio": Domicilio completo o dirección.
No inventes datos. Devuelve SOLO el bloque JSON validado.`;
  
  if (docType === 'COMPLEMENTARIO') {
      promptText = `Analiza este documento complementario de Seguridad Social (México). 
      1. Determina si es una 'Hoja Rosa' o una 'Resolución de Búsqueda de Semanas'.
      Devuelve SOLO JSON puro con llaves: "tipo_complemento" ('Hoja Rosa', 'Resolución', 'Ninguno'), "semanas_extra" (número), "notas_auditoria" (breve descripción técnica).`;
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
      throw new Error("Cuota de IA excedida. Has alcanzado el límite del plan gratuito o facturación. Intenta más tarde.");
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
    tipo_complemento: parsed.tipo_complemento || 'Ninguno',
    semanas_extra: parseInt(cleanNum(parsed.semanas_extra)) || 0
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
    TU MISIÓN: Redactar el DIAGNÓSTICO INICIAL TÉCNICO.
    
    INSTRUCCIÓN INNEGOCIABLE: Emite DIRECTAMENTE el texto del diagnóstico. 
    NO utilices frases introductorias como "Este es el dictamen elaborado...", "Hola", o "Aquí tienes la propuesta...".
    Empieza directamente con el análisis técnico profesional.
    
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