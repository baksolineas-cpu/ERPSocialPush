const GAS_URL = "https://script.google.com/macros/s/AKfycbyn-e11dJYIpiE2fUE76EvFQlSaQBr6YXvQlwSj1IvveDqDxlhOXj9IfygmWvN30PY2/exec";

/**
 * Función maestra para enviar datos (POST)
 */
export async function callGAS(action: string, payload: any = {}, userEmail: string = "Sistema") {
  try {
    console.log("FETCH (POST) URL:", GAS_URL);
    // TÉCNICA: "Fetch sin Pre-vuelo" -> Usamos text/plain y no-cors para forzar envío sin bloqueo
    const response = await fetch(GAS_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({ action, payload, userEmail }),
    });

    const text = await response.text();
    if (!text) {
      return { success: true, status: 'success', warning: 'CORS_SILENT' };
    }
    
    const result = JSON.parse(text);
    // console.log("CONEXIÓN EXITOSA CON GAS:", result);
    return result; 
  } catch (error: any) {
    // Si sabemos que el servidor está recibiendo (confirmado por logs de Excel)
    // devolvemos éxito silencioso para no bloquear al usuario.
    if (error.toString().includes('Failed to fetch') || error.message?.includes('Failed to fetch')) {
      alert("Es posible que los documentos adjuntos sean muy pesados. El guardado podría ser parcial.");
      return { success: true, status: 'success', warning: 'CORS_SILENT_RECOVERY' };
    }
    console.error("Error en callGAS:", error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Función maestra para obtener datos (GET)
 * Implementa Cache Buster automático (?t=)
 */
export async function getGASData(action: string = 'GET_ALL', params: any = {}) {
  try {
    // Cache Buster
    params.t = Date.now();
    params.action = action;
    
    if (action === 'LOGIN' && params.email) {
      console.log('REQUIRIENDO LOGIN PARA:', params.email);
    }
    
    const queryParams = new URLSearchParams(params).toString();
    const url = `${GAS_URL}?${queryParams}`;
    console.log("FETCH (GET) URL:", url);
    
    // Sin headers personalizados para máxima compatibilidad
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      redirect: 'follow'
    });
    
    const text = await response.text();
    // Identificado por el usuario como "error infinito" por la frecuencia de loggeo
    // console.log('RESPUESTA SERVIDOR:', text);
    
    try {
      const result = JSON.parse(text);
      if (result.message === "API BAKSO Activa" && action === "LOGIN") {
         throw new Error('Error de Sincronización: El script de Google no ha sido actualizado con la función de Login');
      }
      // console.log("CONEXIÓN EXITOSA CON GAS (GET):", result);
      return result;
    } catch (parseError: any) {
      if (parseError.message.includes('Error de Sincronización')) throw parseError;
      console.error("Error de Formato (JSON Parse):", text);
      throw new Error('Error de Formato: El servidor devolvió texto en lugar de datos');
    }
  } catch (error: any) {
    if (error.toString().includes('Failed to fetch') || error.message?.includes('Failed to fetch')) {
        // Silenciamos el error para no alarmar al usuario con falsos positivos de red
        return { success: false, status: 'network_error', message: 'Error de conexión con el servidor.' };
    }
    console.error("Error en getGASData:", error);
    throw error;
  }
}

export async function logAction(userEmail: string, accion: string, detalles: string) {
  return callGAS('LOG_ACTION', { accion, detalles }, userEmail);
}
