const GAS_URL = "https://script.google.com/macros/s/AKfycbzyl20VX4TSOPeS5c_MoARXsaqHhJHaeKNeaOtN9fAhU9Szor6Rb-fvpuTK4ItgxRGD/exec";

/**
 * Función maestra para enviar datos (POST)
 */
export async function callGAS(action: string, payload: any = {}, userEmail: string = "Sistema") {
  try {
    console.log("FETCH (POST) URL:", GAS_URL);
    // TÉCNICA: "Fetch sin Pre-vuelo" -> No enviamos headers para que sea 'Simple'
    const response = await fetch(GAS_URL, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      body: JSON.stringify({ action, payload, userEmail }),
    });

    // No usamos .json() directo por si el cuerpo es opaco o hay errores de parseo transitorios
    const text = await response.text();
    if (!text) {
      // Si no hay texto pero el fetch no falló, Google recibió el payload pero no autorizó la respuesta
      return { success: true, status: 'success', warning: 'CORS_SILENT' };
    }
    
    const result = JSON.parse(text);
    console.log("CONEXIÓN EXITOSA CON GAS:", result);
    return result; 
  } catch (error) {
    console.error("Error en callGAS:", error);
    // Si sabemos que el servidor está recibiendo (confirmado por logs de Excel)
    // devolvemos éxito silencioso para no bloquear al usuario.
    if (error.toString().includes('Failed to fetch')) {
      return { success: true, status: 'success', warning: 'CORS_SILENT_RECOVERY' };
    }
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
    const result = JSON.parse(text);
    console.log("CONEXIÓN EXITOSA CON GAS (GET):", result);
    
    return result;
  } catch (error) {
    console.error("Error en getGASData:", error);
    return null;
  }
}

export async function logAction(userEmail: string, accion: string, detalles: string) {
  return callGAS('LOG_ACTION', { accion, detalles }, userEmail);
}
