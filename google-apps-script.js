const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const ROOT_FOLDER_ID = "1xzILR2Afad-feJ-CHAkNiCHjHwLocvhX"; 

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let debugSheet = ss.getSheetByName("DEBUG") || ss.insertSheet("DEBUG");
  
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || (data.payload && data.payload.action);
    const payload = data.payload || data; 
    
    debugSheet.appendRow([new Date(), "POST Action: " + action, JSON.stringify(payload).substring(0, 500)]);

    if (action === 'CREATE_CLIENTE') {
      return handleCreateCliente(payload);
    } else if (action === 'CREATE_HOJA') {
      return handleCreateHoja(payload);
    } else if (action === 'DELETE_FILE') {
      return handleDeleteFile(payload);
    } else if (action === 'UPLOAD_FILE') {
      return handleUploadFile(payload);
    } else if (action === 'GET_DATA') {
      return handleGetData(payload.sheetName);
    } else if (action === 'LOGIN') {
      return handleLogin(payload.email || payload);
    } else if (action === 'LOG_ACTION') {
      return handleLogAction(payload, data.userEmail);
    } else if (action === 'FINALIZE_AUDIT') {
      return handleFinalizeAudit(payload);
    } else if (action === 'UPDATE_CLIENTE_SIGNATURE') {
      return handleUpdateSignature(payload);
    } else {
      return createResponse({ error: 'Acción no válida: ' + action }, 400);
    }
  } catch (error) {
    debugSheet.appendRow([new Date(), "❌ ERROR POST", error.toString()]);
    return createResponse({ error: error.toString() }, 500);
  }
}

/**
 * Registra la firma y selfie del cliente, y cambia el estatus a FIRMADO.
 */
function handleUpdateSignature(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("CLIENTES");
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  const idCol = headers.indexOf("id");
  const curpCol = headers.indexOf("curp");
  const estatusCol = headers.indexOf("estatusfirma");

  const searchId = payload.clienteId.toString().toUpperCase();
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    const rowId = data[i][idCol] ? data[i][idCol].toString().toUpperCase() : "";
    const rowCurp = data[i][curpCol] ? data[i][curpCol].toString().toUpperCase() : "";
    if (rowId === searchId || rowCurp === searchId) {
      rowIndex = i;
      break;
    }
  }

  if (rowIndex === -1) return createResponse({ success: false, error: "Cliente no encontrado" }, 404);

  // 1. Guardar archivos en Drive
  const cliente = getSheetData("CLIENTES")[rowIndex - 1]; // getSheetData devuelve objetos sin header
  const folderId = cliente.id_carpeta_drive || cliente.idcarpetadrive;
  
  if (folderId) {
    const folder = DriveApp.getFolderById(folderId);
    if (payload.selfieBase64 && payload.selfieBase64.length > 50) {
      const selfieBlob = Utilities.newBlob(Utilities.base64Decode(payload.selfieBase64.split(",")[1]), "image/jpeg", `SELFIE_${searchId}.jpg`);
      folder.createFile(selfieBlob);
    }
    if (payload.firmaBase64 && payload.firmaBase64.length > 50) {
      const firmaBlob = Utilities.newBlob(Utilities.base64Decode(payload.firmaBase64.split(",")[1]), "image/png", `FIRMA_CLIENTE_${searchId}.png`);
      folder.createFile(firmaBlob);
    }
  }

  // 2. Actualizar estatus en Excel
  sheet.getRange(rowIndex + 1, estatusCol + 1).setValue("FIRMADO");
  
  return createResponse({ success: true });
}

/**
 * Procesa la certificación final del asesor, actualiza el cliente
 * y registra la hoja de servicio.
 */
function handleFinalizeAudit(payload) {
  // Aseguramos que el id esté presente para handleCreateCliente
  const searchId = payload.id || payload.clienteId;
  if (!payload.id) payload.id = searchId;

  // 1. Actualizamos el registro del cliente (incluyendo estatusfirma si se envió)
  const res = handleCreateCliente(payload);
  
  // 2. Registramos formalmente la hoja de servicio/diagnóstico
  handleCreateHoja(payload);

  // 3. GENERACIÓN DE CONTRATO PERSONALIZADO (Copia del Template)
  try {
    const templateId = "12GVFwA_zkRs4olXQaF2sL5E6Tw6em7ne19tw3y6vHL0";
    const folderId = payload.id_carpeta_drive || payload.idcarpetadrive;
    if (folderId && templateId) {
       const folder = DriveApp.getFolderById(folderId);
       // Eliminar contratos previos si existen para no duplicar
       const oldFiles = folder.getFiles();
       while(oldFiles.hasNext()) {
         const f = oldFiles.next();
         if (f.getName().includes("CONTRATO_PERSONALIZADO")) f.setTrashed(true);
       }
       
       const copy = DriveApp.getFileById(templateId).makeCopy(`CONTRATO_PERSONALIZADO_${payload.curp || payload.id}`, folder);
       const doc = DocumentApp.openById(copy.getId());
       const body = doc.getBody();
       
       // Reemplazos robustos
       body.replaceText("{{NOMBRE}}", payload.nombre || "");
       body.replaceText("{{CURP}}", payload.curp || "");
       body.replaceText("{{RFC}}", payload.rfc || "");
       body.replaceText("{{FECHA}}", new Date().toLocaleDateString('es-MX'));
       body.replaceText("{{DOMICILIO}}", payload.domicilio || payload.domicilioExtraido || "");
       body.replaceText("{{NSS}}", payload.nss || "");
       
       doc.saveAndClose();
       copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }
  } catch(e) {
    debugSheet.appendRow([new Date(), "❌ ERROR GENERANDO CONTRATO", e.toString()]);
  }
  
  return res;
}

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'LOGIN') {
    return handleLogin(e.parameter.email);
  }
  if (action === 'GET_CLIENTE_STATUS') {
    const identifier = e.parameter.curp || e.parameter.id;
    if (!identifier) return createResponse({ status: 'error' }, 400);
    
    const clientes = getSheetData("CLIENTES");
    // CORRECCIÓN CRÍTICA: Busca tanto en la columna ID (A) como en la columna CURP (D)
    const cliente = clientes.find(c => 
      (c.id && c.id.toString().toUpperCase() === identifier.toUpperCase()) || 
      (c.curp && c.curp.toString().toUpperCase() === identifier.toUpperCase())
    );
    
    if (cliente) {
      const folderId = cliente.id_carpeta_drive || cliente.idcarpetadrive;
      if (folderId) {
        try {
          const folder = DriveApp.getFolderById(folderId);
          const files = folder.getFiles();
          cliente.drive_verificado = true;
          while (files.hasNext()) {
            const f = files.next();
            const name = f.getName().toUpperCase();
            const url = f.getUrl();
            if (name.includes("INE")) cliente.ine_url = url;
            if (name.includes("FISCAL") || name.includes("CSF")) cliente.csf_url = url;
            if (name.includes("DOMICILIO") || name.includes("COMPROBANTE")) cliente.domicilio_url = url;
            if (name.includes("SEMANAS")) cliente.semanas_url = url;
            if (name.includes("AFORE")) cliente.afore_url = url;
            if (name.includes("SELFIE")) cliente.selfie_url = url;
            if (name.includes("CONTRATO")) cliente.contrato_url = url;
            if (name.includes("COMPLEMENTARIO")) cliente.complementario_url = url;
          }
        } catch(err) { cliente.drive_verificado = false; }
      }
      // CORRECCIÓN CRÍTICIA: Buscar Diagnóstico (Hoja de Servicio) para el portal de firma
      const hojas = getSheetData("HOJAS_SERVICIO");
      const miHoja = hojas.reverse().find(h => 
        (h.idcliente && h.idcliente.toString().toUpperCase() === identifier.toUpperCase()) ||
        (h.clienteid && h.clienteid.toString().toUpperCase() === identifier.toUpperCase())
      );
      if (miHoja) {
        cliente.hojaservicio = miHoja;
        // Mapeo específico para compatibilidad con el frontend
        cliente.diagnosticoTexto = miHoja.diagnostico || miHoja.notasdiagnostico || "";
      }

      return createResponse({ status: 'success', data: cliente });
    }
    return createResponse({ status: 'error' }, 404);
  }
  if (action === 'GET_DATA') return handleGetData(e.parameter.sheetName);
  return createResponse({ message: "API BAKSO Activa" });
}

function handleCreateCliente(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("CLIENTES");
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => h.toString().toLowerCase().trim());
  
  const curpCol = headers.indexOf("curp");
  const idCol = headers.indexOf("id");
  
  // 1. BLINDAJE DE BÚSQUEDA: Busca por CURP o por ID
  let existingRowIndex = -1;
  const searchId = (payload.id || payload.curp || "").toString().toUpperCase();
  
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rowId = row[idCol] ? row[idCol].toString().toUpperCase() : "";
    const rowCurp = row[curpCol] ? row[curpCol].toString().toUpperCase() : "";
    
    if ((payload.curp && rowCurp === payload.curp.toString().toUpperCase()) || 
        (searchId && rowId === searchId)) {
      existingRowIndex = i;
      break;
    }
  }

  const curp10 = payload.curp ? payload.curp.toString().substring(0, 10).toUpperCase() : (payload.id || "");

  // 2. RECUPERAR DATOS PREVIOS PARA NO SOBREESCRIBIR CON VACÍOS (MERGE)
  let rowData = [];
  if (existingRowIndex > -1) {
    rowData = [...values[existingRowIndex]];
  } else {
    // Fila por defecto con 22 columnas
    rowData = new Array(22).fill("");
  }

  // 3. ACTUALIZACIÓN SELECTIVA (Solo si el payload trae el dato)
  const mapUpdate = (index, value) => { if (value !== undefined && value !== null) rowData[index] = value; };

  mapUpdate(0, curp10);                                       // A: id
  mapUpdate(1, payload.nombre);                              // B: Nombre
  mapUpdate(2, payload.apellidos);                           // C: Apellidos
  mapUpdate(3, payload.curp);                                // D: CURP
  
  if (payload.nssList && Array.isArray(payload.nssList)) {
    mapUpdate(4, payload.nssList.join(", "));                // E: # NSS
  } else if (payload.nss) {
    mapUpdate(4, payload.nss);
  }
  
  mapUpdate(5, payload.rfc);                                 // F: RFC
  mapUpdate(6, payload.whatsapp);                            // G: WhatsApp
  mapUpdate(7, payload.email);                               // H: Email
  mapUpdate(8, payload.selfie_url);                          // I: SelfieURL
  mapUpdate(9, payload.comprobantedomiciliourl);             // J: ComprobanteDomicilioUrl
  mapUpdate(10, payload.domicilioExtraido);                  // K: DomicilioExtraido
  
  // Carpeta Drive
  let folderId = rowData[11] || payload.id_carpeta_drive;
  if (!folderId) {
     const folder = DriveApp.getFolderById(ROOT_FOLDER_ID).createFolder(`[${curp10}] ${payload.nombre || "NUEVO"}`);
     folderId = folder.getId();
     if (payload.email && payload.email.indexOf('@') > -1) {
       try { folder.addViewer(payload.email); } catch(e) {}
     }
  }
  mapUpdate(11, folderId);                                   // L: ID_Carpeta_Drive
  
  if (!rowData[12]) mapUpdate(12, new Date().toISOString()); // M: CreatedAt
  mapUpdate(13, payload.regimenFiscal);                      // N: Régimen Fiscal
  mapUpdate(14, payload.semanasCotizadas);                   // O: Semanas Cotizadas
  mapUpdate(15, payload.ultimoSalario);                      // P: Último Salario
  mapUpdate(16, payload.estadoAuditoria || "PENDIENTE_ENTREVISTA"); // Q: Estado Auditoría
  mapUpdate(17, payload.notasSeguimiento);                   // R: Notas Seguimiento
  mapUpdate(18, payload.nivelCerteza);                      // S: Nivel Certeza
  mapUpdate(19, payload.desgloseSemanas);                     // T: Desglose de Semanas
  mapUpdate(20, payload.estatusfirma || rowData[20] || "PENDIENTE"); // U: estatusfirma
  mapUpdate(21, payload.ine_url);                             // V: ine_url

  if (existingRowIndex > -1) {
    sheet.getRange(existingRowIndex + 1, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return createResponse({ success: true, id: curp10, id_carpeta_drive: folderId });
}

function handleCreateHoja(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("HOJAS_SERVICIO");
  if (!sheet) {
    sheet = ss.insertSheet("HOJAS_SERVICIO");
    sheet.appendRow(["ID_Hoja", "ID_Cliente", "Universo", "Servicios", "Monto", "Diagnostico", "Status", "Fecha"]);
  }
  
  // BLINDAJE: servicios puede venir como Array o como String ya unido
  let serviciosStr = "";
  if (Array.isArray(payload.servicios)) {
    serviciosStr = payload.servicios.join(", ");
  } else {
    serviciosStr = payload.servicios || "";
  }
  
  sheet.appendRow([
    payload.id || Utilities.getUuid(),                         // A: ID Hoja (Generado si no viene)
    payload.clienteId || payload.id,                          // B: ID Cliente
    payload.universo || "U1",                                  // C: Universo
    serviciosStr,                                              // D: Servicios
    payload.honorariosAcordados || payload.monto || 0,         // E: Monto
    payload.notasDiagnostico || payload.dictamen || "",        // F: Diagnostico
    "ACTIVO",                                                  // G: Status
    payload.createdAt || new Date().toISOString()              // H: Fecha
  ]);
  return createResponse({ success: true });
}

function handleUploadFile(payload) {
  try {
    const folder = DriveApp.getFolderById(payload.id_carpeta_drive);
    const blob = Utilities.newBlob(Utilities.base64Decode(payload.fileData), 'application/pdf', payload.fileName);
    const file = folder.createFile(blob);
    return createResponse({ success: true, url: file.getUrl() });
  } catch (e) { return createResponse({ success: false, error: e.toString() }); }
}

function handleDeleteFile(payload) {
  try {
    const folder = DriveApp.getFolderById(payload.id_carpeta_drive);
    const files = folder.getFiles();
    const target = payload.docType.toUpperCase();
    let deleted = false;
    while (files.hasNext()) {
      const f = files.next();
      if (f.getName().toUpperCase().includes(target)) {
        f.setTrashed(true);
        deleted = true;
      }
    }
    return createResponse({ success: deleted });
  } catch (e) { return createResponse({ success: false, error: e.toString() }); }
}

function handleGetData(sheetName) {
  return createResponse({ success: true, data: getSheetData(sheetName) });
}

function getSheetData(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  return values.map(row => {
    const obj = {};
    headers.forEach((h, i) => { 
      const key = h.toString().toLowerCase().replace(/\s+/g, "").replace(/\./g, "");
      obj[key] = row[i]; 
    });
    return obj;
  });
}

function handleLogin(incomingEmail) {
  if (!incomingEmail) return createResponse({ success: false, error: 'Email requerido' }, 400);
  const cleanIncomingEmail = incomingEmail.toString().replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("USUARIOS");
  if (!sheet) {
    sheet = ss.insertSheet("USUARIOS");
    sheet.appendRow(["Email", "Rol", "Nombre"]);
  }
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return createResponse({ success: false, error: 'No hay usuarios autorizados' }, 404);
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  const emailCol = headers.indexOf('email');
  for (let i = 1; i < data.length; i++) {
    const sheetEmail = data[i][emailCol] ? data[i][emailCol].toString().trim().toLowerCase() : "";
    if (sheetEmail === cleanIncomingEmail) {
      return createResponse({
        success: true,
        user: { email: data[i][0], rol: data[i][1], nombre: data[i][2] }
      });
    }
  }
  return createResponse({ success: false, error: `Usuario ${cleanIncomingEmail} no autorizado` }, 401);
}

function handleLogAction(payload, email) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName("LOGS") || ss.insertSheet("LOGS");
  logSheet.appendRow([new Date(), email || "Desconocido", payload.accion || "INFO", payload.detalles || ""]);
  return createResponse({ success: true });
}

function createResponse(data, code = 200) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}