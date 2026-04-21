import { GoogleGenAI } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
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
  if (!ai) throw new Error('CONFIG_ERROR: VITE_GEMINI_API_KEY no configurada');
  const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  
  let prompt = `Extrae de este ${docType}: nombre, curp, rfc, nss, semanas_cotizadas, salario_diario, domicilio. Devuelve SOLO JSON puro.`;
  
  if (docType === 'COMPLEMENTARIO') {
      prompt = `Analiza este documento complementario de Seguridad Social (México). 
      1. Determina si es una 'Hoja Rosa' (evidencia de patrones antiguos) o una 'Resolución de Búsqueda de Semanas'. 
      2. Si es Resolución, extrae el número de semanas dictaminadas.
      Devuelve SOLO JSON con campos: tipo_complemento ('Hoja Rosa', 'Resolución', 'Ninguno'), semanas_extra (número), notas_auditoria (breve descripción técnica).`;
  }

  const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent([
    prompt,
    { inlineData: { data: cleanBase64, mimeType: mimeType || 'application/pdf' } }
  ]);
  
  const responseText = result.response.text();
  return jsonSanitizer(responseText);
}

/**
 * Motor de Diálogo Consultivo - Redacción de Diagnóstico Inicial.
 * Diseñado para un intercambio dinámico entre el Asesor y la IA.
 */
export async function getConsultorChatResponse(history: any[], context: any) {
  if (!ai) return "Error: La inteligencia artificial no está configurada.";
  
  const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  // Mapeo de historial para el formato del SDK
  const chatHistory = history.map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.parts[0].text }]
  }));

  const chat = model.startChat({
    history: chatHistory,
    generationConfig: { maxOutputTokens: 1500, temperature: 0.7 }
  });

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

  // Se envía el prompt de sistema como instrucción de control sobre el último mensaje
  const result = await chat.sendMessage(systemPrompt);
  return result.response.text();
}