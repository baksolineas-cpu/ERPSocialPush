const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const ROOT_FOLDER_ID = "1xzILR2Afad-feJ-CHAkNiCHjHwLocvhX"; 

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let debugSheet = ss.getSheetByName("DEBUG") || ss.insertSheet("DEBUG");
  
  try {
    const data = JSON.parse(e.postData.contents);
    // Soporta tanto si la acción viene en la raíz como si viene dentro del payload
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
    } else {
      return createResponse({ error: 'Acción no válida: ' + action }, 400);
    }
  } catch (error) {
    debugSheet.appendRow([new Date(), "❌ ERROR POST", error.toString()]);
    return createResponse({ error: error.toString() }, 500);
  }
}

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'LOGIN') {
    return handleLogin(e.parameter.email);
  }
  if (action === 'GET_CLIENTE_STATUS') {
    const curp = e.parameter.curp;
    if (!curp) return createResponse({ status: 'error' }, 400);
    const clientes = getSheetData("CLIENTES");
    const cliente = clientes.find(c => c.curp && c.curp.toString().toUpperCase() === curp.toUpperCase());
    
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
      return createResponse({ status: 'success', data: cliente });
    }
    return createResponse({ status: 'error' }, 404);
  }
  if (action === 'GET_DATA') return handleGetData(e.parameter.sheetName);
  return createResponse({ message: "API BAKSO Activa" });
}

function handleCreateCliente(payload) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("CLIENTES");
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => h.toString().toLowerCase().trim());
  const curpCol = headers.indexOf("curp");
  
  let existingRowIndex = -1;
  if (payload.curp) {
    existingRowIndex = values.findIndex(row => row[curpCol] === payload.curp);
  }

  // BLINDAJE DE IDENTIDAD: Extrae los primeros 10 dígitos de la CURP obligatoriamente
  const curp10 = payload.curp ? payload.curp.toString().substring(0, 10).toUpperCase() : payload.id;

  let folder;
  if (existingRowIndex > -1 && payload.id_carpeta_drive) {
    try { folder = DriveApp.getFolderById(payload.id_carpeta_drive); } 
    catch(e) { folder = DriveApp.getFolderById(ROOT_FOLDER_ID).createFolder(`[${curp10}] ${payload.nombre}`); }
  } else {
    folder = DriveApp.getFolderById(ROOT_FOLDER_ID).createFolder(`[${curp10}] ${payload.nombre}`);
  }
  
  const folderId = folder.getId();

  // Compartir Lector
  if (payload.email && payload.email.indexOf('@') > -1) {
    try { folder.addViewer(payload.email); } catch(e) {}
  }

  let nssString = payload.nss || "";
  if (payload.nssList && Array.isArray(payload.nssList) && payload.nssList.length > 0) {
    nssString = payload.nssList.join(", ");
  }

  // MAPEO EXACTO A TUS 22 COLUMNAS
  const rowData = [
    curp10,                                   // A: id (CURP10 forzado)
    payload.nombre,                           // B: Nombre
    payload.apellidos || "",                  // C: Apellidos
    payload.curp,                             // D: CURP
    nssString,                                // E: # NSS
    payload.rfc || "",                        // F: RFC
    payload.whatsapp || "",                   // G: WhatsApp
    payload.email || "",                      // H: Email
    payload.selfie_url || "",                 // I: SelfieURL
    payload.comprobantedomiciliourl || "",    // J: ComprobanteDomicilioUrl
    payload.domicilioExtraido || "",          // K: DomicilioExtraido
    folderId,                                 // L: ID_Carpeta_Drive
    new Date().toISOString(),                 // M: CreatedAt
    payload.regimenFiscal || "",              // N: Régimen Fiscal
    payload.semanasCotizadas || 0,            // O: Semanas Cotizadas
    payload.ultimoSalario || 0,               // P: Último Salario
    "PENDIENTE_ENTREVISTA",                   // Q: Estado Auditoría
    payload.notasSeguimiento || "",           // R: Notas Seguimiento
    payload.nivelCerteza || "Bajo",           // S: Nivel Certeza
    payload.desgloseSemanas || "",            // T: Desglose de Semanas
    "PENDIENTE",                              // U: estatusfirma
    payload.ine_url || ""                     // V: ine_url
  ];

  if (existingRowIndex > -1) {
    sheet.getRange(existingRowIndex + 1, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return createResponse({ success: true, id: curp10, id_carpeta_drive: folderId });
}

function handleCreateHoja(payload) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("HOJAS_SERVICIO");
  sheet.appendRow([
    payload.id, payload.clienteId, payload.universo, 
    payload.servicios.join(", "), payload.honorariosAcordados, 
    payload.notasDiagnostico, "", payload.createdAt
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

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return createResponse({ success: false, error: 'No hay usuarios autorizados' }, 404);

  const headers = values[0].map(h => h.toString().toLowerCase().trim());
  const emailCol = headers.indexOf('email');
  const rolCol = headers.indexOf('rol');
  const nombreCol = headers.indexOf('nombre');

  if (emailCol === -1) return createResponse({ success: false, error: 'Columna email no encontrada' }, 500);

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const sheetEmail = row[emailCol] ? row[emailCol].toString().replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase() : "";
    if (sheetEmail === cleanIncomingEmail) {
      
      // REGISTRO DE LOGS ESTRICTO
      let logSheet = ss.getSheetByName("LOGS");
      if (!logSheet) {
        logSheet = ss.insertSheet("LOGS");
        logSheet.appendRow(["FechaHora", "Usuario", "Accion", "Detalles"]);
      }
      const fechaExacta = new Date();
      logSheet.appendRow([fechaExacta, cleanIncomingEmail, "LOGIN EXITOSO", `Acceso autorizado (Rol: ${rolCol > -1 ? row[rolCol] : "ASESOR"})`]);

      return createResponse({
        success: true,
        user: {
          email: sheetEmail,
          rol: rolCol > -1 ? row[rolCol].toString().trim() : "ASESOR",
          nombre: nombreCol > -1 ? row[nombreCol].toString().trim() : sheetEmail
        }
      });
    }
  }

  // Si falló, registrar fallo también
  let logSheet = ss.getSheetByName("LOGS");
  if (!logSheet) {
    logSheet = ss.insertSheet("LOGS");
    logSheet.appendRow(["FechaHora", "Usuario", "Accion", "Detalles"]);
  }
  logSheet.appendRow([new Date(), cleanIncomingEmail, "LOGIN FALLIDO", "Usuario no encontrado en BBDD"]);

  return createResponse({ success: false, error: `Usuario ${cleanIncomingEmail} no autorizado en la base de datos de Social Push` }, 401);
}

function handleLogAction(payload, email) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName("LOGS");
  if (!logSheet) {
    logSheet = ss.insertSheet("LOGS");
    logSheet.appendRow(["FechaHora", "Usuario", "Accion", "Detalles"]);
  }
  logSheet.appendRow([new Date(), email || "Desconocido", payload.accion || "INFO", payload.detalles || ""]);
  return createResponse({ success: true });
}

function createResponse(data, code = 200) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}