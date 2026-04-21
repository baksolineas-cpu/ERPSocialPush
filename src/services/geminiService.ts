import { GoogleGenAI } from "@google/genai";
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

function jsonSanitizer(text: string): any {
  try { return JSON.parse(text); } 
  catch (e) {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch (e2) { console.error("JSON Error:", text); }
  }
  return {};
}

export async function extractDocumentData(base64Image: string, mimeType: string, docType: string = 'CSF') {
  if (!ai) throw new Error('CONFIG_ERROR: VITE_GEMINI_API_KEY no configurada');
  const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  
  // Prompt especializado según el tipo de documento
  let prompt = `Extrae de este ${docType}: nombre, curp, rfc, nss, semanas_cotizadas, domicilio. Devuelve SOLO JSON.`;
  if (docType === 'COMPLEMENTARIO') {
      prompt = "Analiza este documento y determina si es una 'Hoja Rosa' o una 'Resolución'. Si es resolución, extrae las semanas dictaminadas. Devuelve SOLO JSON con campos: tipo_complemento ('Hoja Rosa', 'Resolución', 'Ninguno'), semanas_extra (número).";
  }

  const response = await ai.models.generateContent({ 
    model: "gemini-3-flash-preview",
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        { inlineData: { data: cleanBase64, mimeType: mimeType || 'application/pdf' } }
      ]
    }],
    config: { responseMimeType: "application/json" }
  });
  
  const parsed = jsonSanitizer(response.text || "{}");
  const cleanNum = (v: any) => String(v || '').replace(/[^0-9]/g, '');
  let nssList: string[] = [];
  const rawNss = parsed.nss || parsed.NSS;
  if (rawNss) {
    nssList = Array.isArray(rawNss) ? rawNss.map((n: any) => cleanNum(n).substring(0, 11)).filter(Boolean) : [cleanNum(rawNss).substring(0, 11)].filter(Boolean);
  }
  
  return {
    nombre: parsed.nombre || '', curp: parsed.curp || '', rfc: parsed.rfc || '',
    nss: nssList[0] || '', nssList, semanasCotizadas: parseInt(cleanNum(parsed.semanas_cotizadas)) || 0,
    domicilio: parsed.domicilio || '',
    // Campos extra para complementario
    tipo_complemento: parsed.tipo_complemento || 'Ninguno',
    semanas_extra: parseInt(cleanNum(parsed.semanas_extra)) || 0
  };
}

export async function getConsultorChatResponse(history: any[], context: any) {
  if (!ai) return "Error IA";
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: history.map(h => ({ role: h.role, parts: [{ text: h.parts[0].text }] })),
    config: { systemInstruction: `Redacta un dictamen final para el cliente. Contexto: ${JSON.stringify(context)}` }
  });
  return response.text || "Error";
}
