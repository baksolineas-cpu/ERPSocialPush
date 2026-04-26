// Configuración Maestra
var SPREADSHEET_ID = ""; 
try {
  SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
} catch(e) {
  // Si el script no está vinculado, el programador debe poner el ID manualmente aquí
  // SPREADSHEET_ID = "ID_DE_TU_HOJA_AQUÍ";
}

const ROOT_FOLDER_ID = "1xzILR2Afad-feJ-CHAkNiCHjHwLocvhX"; 

function logDebug(tag, message) {
  if (!SPREADSHEET_ID) {
    Logger.log("[" + tag + "] " + message);
    return;
  }
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName("DEBUG") || ss.insertSheet("DEBUG");
    sheet.appendRow([new Date(), tag, message]);
  } catch(e) {
    Logger.log("Error logging to debug: " + e.toString());
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || (data.payload && data.payload.action);
    const payload = data.payload || data; 
    
    logDebug("POST Action: " + action, JSON.stringify(payload).substring(0, 500));

    if (action === 'CREATE_CLIENTE') {
      return handleCreateCliente(payload);
    } else if (action === 'ONBOARDING_SYNC') {
      return handleOnboardingSync(payload);
    } else if (action === 'CREATE_HOJA') {
      return handleCreateHoja(payload);
    } else if (action === 'DELETE_FILE') {
      return handleDeleteFile(payload);
    } else if (action === 'UPLOAD_FILE') {
      return handleUploadFile(payload);
    } else if (action === 'GET_DATA') {
      return handleGetData(payload.sheetName);
    } else if (action === 'LOGIN') {
      return handleLogin(payload);
    } else if (action === 'LOG_ACTION') {
      return handleLogAction(payload, data.userEmail);
    } else if (action === 'FINALIZE_AUDIT') {
      return handleFinalizeAudit(payload);
    } else if (action === 'UPDATE_CLIENTE_SIGNATURE') {
      return handleUpdateSignature(payload);
    } else if (action === 'GET_CLIENTE_STATUS') {
      return handleGetClienteStatus(payload);
    } else {
      return createResponse({ error: 'Acción no válida: ' + action }, 400);
    }
  } catch (error) {
    logDebug("❌ ERROR POST", error.toString());
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
  logDebug("UPDATE_SIG", "Iniciando firma para: " + searchId);
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

  // 1. Guardar archivos físicos en Drive
  const rowObj = getSheetData("CLIENTES")[rowIndex - 1];
  const folderId = rowObj.id_carpeta_drive || rowObj.idcarpetadrive || rowObj.idCarpetaDrive;
  
  if (folderId) {
    try {
      const folder = DriveApp.getFolderById(folderId);
      if (payload.selfieBase64 && payload.selfieBase64.length > 50) {
        const selfieBlob = Utilities.newBlob(Utilities.base64Decode(payload.selfieBase64.split(",")[1]), "image/jpeg", `SELFIE_${searchId}.jpg`);
        folder.createFile(selfieBlob);
      }
      if (payload.firmaBase64 && payload.firmaBase64.length > 50) {
        const firmaBlob = Utilities.newBlob(Utilities.base64Decode(payload.firmaBase64.split(",")[1]), "image/png", `FIRMA_CLIENTE_${searchId}.png`);
        folder.createFile(firmaBlob);
      }
    } catch(e) { logDebug("SIG_SAVE_ERR", e.toString()); }
  }

  // 2. Actualizar estatus en Excel
  sheet.getRange(rowIndex + 1, estatusCol + 1).setValue("FIRMADO");

  // 3. SELLAR DOCUMENTOS CON BLOBS FÍSICOS
  const signedDocUrls = [];
  const signatureTimestamp = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
  const transactionId = Utilities.getUuid().substring(0, 8).toUpperCase();

  let folderUrl = "";
  let finalFirmaBlob = null;
  let finalSelfieBlob = null;

  if (folderId) {
    try {
      const folder = DriveApp.getFolderById(folderId);
      folderUrl = folder.getUrl();
      
      // Obtener Blobs físicos de Drive
      const filesDrive = folder.getFiles();
      while (filesDrive.hasNext()) {
        const df = filesDrive.next();
        const dName = df.getName().toUpperCase();
        if (dName.includes("FIRMA_CLIENTE")) finalFirmaBlob = df.getBlob();
        if (dName.includes("SELFIE")) finalSelfieBlob = df.getBlob();
      }

      const files = folder.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        const fileName = file.getName();
        
        // Buscamos contratos y diagnósticos
        const targetDocs = ["CONTRATO_MARCO", "CONTRATO_PERSONALIZADO", "DIAGNOSTICO_CERTIFICADO"];
        let shouldProcess = false;
        targetDocs.forEach(td => { if (fileName.includes(td) && !fileName.includes("_FIRMADO_")) shouldProcess = true; });
        
        if (shouldProcess && file.getMimeType() === MimeType.GOOGLE_DOCS) {
           logDebug("STAMPING", "Procesando: " + fileName);
           
           try {
             const docId = file.getId();
             const doc = DocumentApp.openById(docId);
             const body = doc.getBody();
             
             // Inyectar datos de firma e identidad
             body.replaceText("{{FECHA_FIRMA}}", signatureTimestamp);
             body.replaceText("{{ID_TRANSACCION}}", transactionId);
             
             // Etiquetas para Contrato Marco (Clean Replacement)
             if (fileName.includes("CONTRATO_MARCO")) {
               body.replaceText("{{NOMBRE_CLIENTE}}", rowObj.nombre || "");
               body.replaceText("{{ NOMBRE_CLIENTE }}", rowObj.nombre || "");
               body.replaceText("{{CURP}}", rowObj.curp || "");
               body.replaceText("{{RFC}}", rowObj.rfc || "");
               body.replaceText("{{NSS}}", rowObj.nss || "");
               body.replaceText("{{DOMICILIO}}", rowObj.domicilioextraido || "");
               body.replaceText("{{FECHA}}", new Date().toLocaleDateString('es-MX'));
             }
             
             // Estampado Seguro con Blobs (Triple Firma)
             if (finalFirmaBlob) {
               replaceTextWithImageBlob(body, "{{firma_cliente}}", finalFirmaBlob, 220, 110);
               replaceTextWithImageBlob(body, "{{FIRMA_CLIENTE}}", finalFirmaBlob, 220, 110);
               replaceTextWithImageBlob(body, "{{IMAGEN_FIRMA}}", finalFirmaBlob, 220, 110);
             }
             if (finalSelfieBlob) {
               replaceTextWithImageBlob(body, "{{selfie}}", finalSelfieBlob, 140, 140);
               replaceTextWithImageBlob(body, "{{SELFIE}}", finalSelfieBlob, 140, 140);
               replaceTextWithImageBlob(body, "{{IMAGEN_SELFIE}}", finalSelfieBlob, 140, 140);
             }
             
             
             doc.saveAndClose();
             
             // Generar PDF y Limpieza
             const pdfBlob = file.getAs('application/pdf');
             const pdfFile = folder.createFile(pdfBlob).setName(fileName + "_FIRMADO_" + transactionId + ".pdf");
             pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
             signedDocUrls.push({ name: pdfFile.getName(), url: pdfFile.getUrl() });
             
             // ELIMINACION DEL DOC TEMPORAL SEGUN DIRECTIVA
             file.setTrashed(true);
             
           } catch(err) { logDebug("ERR_STAMP", err.toString()); }
        }
      }
      
      // Notificar al cliente
      if (rowObj.email) {
        try {
          MailApp.sendEmail({
            to: rowObj.email,
            subject: "Expediente Formalizado - BAKSO S.C.",
            body: `Estimado(a) ${rowObj.nombre},\n\nSu expediente digital ha sido formalizado. Puede descargar sus documentos firmados desde su carpeta de Drive o adjuntos a este correo.\n\nCordialmente,\nEquipo BAKSO.`
          });
        } catch(e) {}
      }

    } catch (e) { logDebug("❌ ERR_FINAL_SIG", e.toString()); }
  }
  
  return createResponse({ success: true, signedDocUrls, folderUrl });
}

/**
 * Procesa la certificación final del asesor, actualiza el cliente
 * y registra la hoja de servicio.
 */
function handleFinalizeAudit(payload) {
  logDebug("DEBUG_ENTRADA", "Payload recibido: " + JSON.stringify(payload));
  const searchId = payload.id || payload.clienteId;
  if (!payload.id) payload.id = searchId;

  // 1. Actualizamos el registro del cliente
  try {
    handleCreateCliente(payload);
  } catch(e) { logDebug("ERR_CLIENTE_UPDATE", e.toString()); }
  
  // 2. Registramos formalmente la hoja de servicio (Upsert)
  try {
    handleCreateHoja(payload);
  } catch(e) { logDebug("ERR_HOJA_CREATION", e.toString()); }

  // 3. GENERACIÓN DE DOCUMENTOS (Diagnóstico y Contrato Marco)
  try {
    const clientes = getSheetData("CLIENTES");
    const cliente = clientes.find(c => (c.curp === (payload.curp || searchId) || c.id === searchId));
    
    if (cliente) {
      const folderId = cliente.id_carpeta_drive || cliente.idcarpetadrive;
      if (folderId) {
        const folder = DriveApp.getFolderById(folderId);
        
        // A. RE-RESTAURACIÓN DEL CONTRATO MARCO (Template ID Especial solicitado)
        const templateId = "12GVFwA_zkRs4olXQaF2sL5E6Tw6em7ne19tw3y6vHL0";
        try {
           const copy = DriveApp.getFileById(templateId).makeCopy('CONTRATO_MARCO_' + (payload.id_hoja || new Date().getTime()) + ' - ' + (cliente.nombre || ''), folder);
           const doc = DocumentApp.openById(copy.getId());
           const body = doc.getBody();
           
           // Inyectar datos primarios
           body.replaceText("{{nombre_cliente}}", cliente.nombre || "");
           body.replaceText("{{NOMBRE_CLIENTE}}", cliente.nombre || "");
           body.replaceText("{{CURP}}", cliente.curp || "");
           body.replaceText("{{FECHA}}", new Date().toLocaleDateString('es-MX'));
           body.replaceText("{{NSS}}", cliente.nss || "");
           body.replaceText("{{DOMICILIO}}", cliente.domicilioextraido || "");

           doc.saveAndClose();
           copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
        } catch(errC) { logDebug("ERR_CLONE_CONTRATO", errC.toString()); }

        // B. GENERACIÓN DE DIAGNÓSTICO CERTIFICADO REDISEÑADO
        generateDiagnosticPDF(cliente, payload.servicios, payload.montoAcordado || payload.monto || payload.honorariosAcordados, payload.asesor, payload.firmaAsesor, payload.id_hoja);
      }
    }
  } catch(e) { logDebug("ERR_DOC_GEN_MAIN", e.toString()); }

  return createResponse({ success: true });
}

function generateDiagnosticPDF(clientData, servicesData, montoTotal, asesorName, firmaAsesorBase64, idHoja) {
  try {
    const folderId = clientData.id_carpeta_drive || clientData.idcarpetadrive;
    if (!folderId) return;
    const folder = DriveApp.getFolderById(folderId);

    // Crear Documento Temporal con VERSIONAMIENTO (ID_Hoja o Timestamp)
    const suffix = idHoja || new Date().getTime();
    const doc = DocumentApp.create("DIAGNOSTICO_CERTIFICADO_" + clientData.curp + "_" + suffix);
    const body = doc.getBody();

    // 1. ENCABEZADO BAKSO S.C.
    body.insertParagraph(0, "Social Push® - La Visión del Mañana...HOY").setHeading(DocumentApp.ParagraphHeading.HEADING1).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    body.appendParagraph("CERTIFICACIÓN TÉCNICA DE ESTATUS SEGURIDAD SOCIAL").setAlignment(DocumentApp.HorizontalAlignment.CENTER).setItalic(true);
    body.appendParagraph(`\nFECHA DE EMISIÓN: ${new Date().toLocaleDateString('es-MX')}`);
    body.appendParagraph(`EXPENDIENTE: ${clientData.curp || clientData.id || "SP-2024"}`);
    
    body.appendHorizontalRule();
    
    // 2. DIAGNÓSTICO TÉCNICO DETALLADO
    body.appendParagraph("I. EVALUACIÓN Y DICTAMEN TÉCNICO:").setBold(true);
    const diagStr = clientData.diagnosticoTexto || clientData.dictamen || "Análisis integral de historial laboral, semanas cotizadas ante el IMSS y proyección de derechos.";
    body.appendParagraph(diagStr).setAttributes({[DocumentApp.Attribute.FONT_SIZE]: 10});
    
    // 3. SERVICIOS CONTRATADOS
    body.appendParagraph("\nII. SERVICIOS INTEGRALES CONTRATADOS:").setBold(true);
    let serviciosStr = Array.isArray(servicesData) ? servicesData.join(", ") : (servicesData || "Asesoría Técnica y Legal Especializada");
    body.appendParagraph(serviciosStr).setAttributes({[DocumentApp.Attribute.FONT_SIZE]: 10});

    // 4. VALOR TOTAL & CLÁUSULA
    body.appendParagraph("\nIII. VALOR TOTAL DEL PROYECTO:").setBold(true);
    body.appendParagraph(`Inversión Total Acordada: $${Number(montoTotal || 0).toLocaleString('es-MX', {minimumFractionDigits:2})} MXN`);
    
    body.appendParagraph("\nIV. CLÁUSULA DE PRIVACIDAD Y VALIDEZ:").setBold(true);
    body.appendParagraph("Este Diagnóstico Técnico de Viabilidad de Derechos se emite bajo los estándares de materialidad fiscal de BAKSO, S.C. La identidad del solicitante ha sido validada mediante biometría facial (Selfie) y firma autógrafa digital, vinculando el presente dictamen al expediente único de cliente en nuestra bóveda de seguridad social.").setAttributes({[DocumentApp.Attribute.FONT_SIZE]: 8, [DocumentApp.Attribute.ITALIC]: true});

    body.appendParagraph("\n\n__________________________\nDIRECCIÓN TÉCNICA - " + (asesorName || "ASESOR"));

    // Firma del asesor
    try {
      const fa = firmaAsesorBase64 || clientData.firmaAsesor || clientData.firmaasesor;
      if (fa && fa.length > 50) {
        const faBlob = Utilities.newBlob(Utilities.base64Decode(fa.split(",")[1]), "image/png");
        body.appendImage(faBlob).setWidth(140).setHeight(70);
      }
    } catch(e) {}

    // TRIPLE FIRMA AREA (Table for organization)
    body.appendParagraph("\n\nVALIDACIÓN DIGITAL DEL TITULAR:").setBold(true).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    const table = body.appendTable();
    const sigRow = table.appendTableRow();
    sigRow.appendTableCell("FIRMA DEL CLIENTE\n\n{{firma_cliente}}");
    sigRow.appendTableCell("BIOMETRÍA (SELFIE)\n\n{{selfie}}");
    table.setBorderWidth(0);

    
    doc.saveAndClose();
    
    const file = DriveApp.getFileById(doc.getId());
    file.moveTo(folder);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
    
    return file.getUrl();
  } catch(e) {
    logDebug("ERR_GEN_DIAG_PDF_HELPER", e.toString());
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'LOGIN') {
      return handleLogin(e.parameter.email);
    }
    if (action === 'GET_CLIENTE_STATUS') {
      const identifier = (e.parameter.curp || e.parameter.id || "").toString().toUpperCase();
      if (!identifier) return createResponse({ status: 'error' }, 400);
      
      const clientes = getSheetData("CLIENTES");
      // CORRECCIÓN CRÍTICA: Busca tanto en la columna ID (A) como en la columna CURP (D)
      const cliente = clientes.find(c => 
        (c.id && c.id.toString().toUpperCase() === identifier) || 
        (c.curp && c.curp.toString().toUpperCase() === identifier)
      );
      
      if (cliente) {
        const folderId = cliente.id_carpeta_drive || cliente.idcarpetadrive;
        if (folderId) {
          try {
            const folder = DriveApp.getFolderById(folderId);
            cliente.folder_url = folder.getUrl();
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
              if (name.includes("CONTRATO") && !name.includes("FIRMADO")) cliente.contrato_url = url;
              if (name.includes("COMPLEMENTARIO")) cliente.complementario_url = url;
            }
          } catch(err) { cliente.drive_verificado = false; }
        }
        
        // CORRECCIÓN CRÍTICA: Buscar Diagnóstico (Hoja de Servicio) para el portal de firma
        const hojas = getSheetData("HOJAS_SERVICIO");
        const miHoja = hojas.reverse().find(h => 
          (h.id_cliente && h.id_cliente.toString().toUpperCase() === identifier) ||
          (h.idcliente && h.idcliente.toString().toUpperCase() === identifier) ||
          (h.clienteid && h.clienteid.toString().toUpperCase() === identifier) ||
          (h.id && h.id.toString().toUpperCase() === identifier)
        );
        
        if (miHoja) {
          cliente.hojaservicio = miHoja;
          // Mapeo específico para compatibilidad con el frontend
          cliente.diagnosticoTexto = miHoja.diagnostico || miHoja.dictamen || miHoja.notasdiagnostico || miHoja.notas || "";
          cliente.serviciosContratados = miHoja.servicios || "";
          cliente.montoAcordado = miHoja.honorarios || "0.00";
          cliente.asesorAsignado = miHoja.asesor || "";
          cliente.firmaAsesor = miHoja.firmaasesor || "";
          // Refuerzo de visualización: Si el monto viene en 0, lo forzamos a mostrar lo que hallemos en el registro (honorarios)
          const finalMonto = miHoja.honorarios ? Number(miHoja.honorarios) : 0;
          cliente.monto = finalMonto.toFixed(2);
          cliente.montoTotal = finalMonto;
          cliente.montoAcordado = finalMonto.toFixed(2);
        }
        
        // RESTRICCIÓN DE VISUALIZACIÓN: Usar estrictamente el ID del contrato protegido proporcionado por el usuario
        cliente.contrato_url = `https://drive.google.com/file/d/1JVxjrR3k7EOwiCG9l8SSGMEvTU4G_PwO3cOWqm0wQpk/preview`;

        return createResponse({ status: 'success', data: cliente });
      }
      return createResponse({ status: 'error' }, 404);
    }
    if (action === 'GET_DATA') return handleGetData(e.parameter.sheetName);
    return createResponse({ message: "API BAKSO Activa" });
  } catch (err) {
    logDebug("❌ ERROR GET", err.toString());
    return createResponse({ error: err.toString() }, 500);
  }
}

function handleGetClienteStatus(payload) {
  try {
    const identifier = payload.curp || payload.id || payload.clienteId;
    if (!identifier) return createResponse({ status: 'error', message: 'ID Requerido' }, 400);
    
    const clientes = getSheetData("CLIENTES");
    const cliente = clientes.find(c => 
      (c.id && c.id.toString().toUpperCase() === identifier.toString().toUpperCase()) || 
      (c.curp && c.curp.toString().toUpperCase() === identifier.toString().toUpperCase())
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
            if (name.includes("INE")) cliente.ine_url = f.getUrl();
            if (name.includes("FISCAL") || name.includes("CSF")) cliente.csf_url = f.getUrl();
            // ... otros mapeos si son críticos, pero los más importantes están en doGet
          }
        } catch(e) {}
      }

      // Append hoja de servicio
      try {
        const hojas = getSheetData("HOJAS_SERVICIO");
        const searchId = identifier.toString().substring(0, 10).toUpperCase();
        const hoja = hojas.find(h => 
          (h.id_cliente && h.id_cliente.toString().toUpperCase() === searchId) ||
          (h.clienteid && h.clienteid.toString().toUpperCase() === searchId) ||
          (h.idcliente && h.idcliente.toString().toUpperCase() === searchId) ||
          (h.id && h.id.toString().toUpperCase() === searchId)
        );
        if (hoja) {
          cliente.hojaservicio = hoja;
          cliente.montoTotal = hoja.honorarios || "0.00";
        }
      } catch(e) {}

      return createResponse({ status: 'success', data: cliente });
    }
    return createResponse({ status: 'error', message: 'No encontrado' }, 404);
  } catch(e) {
    return createResponse({ status: 'error', error: e.toString() }, 500);
  }
}

function handleCreateCliente(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return createResponse({ status: 'error', message: 'Sistema ocupado' }, 429);
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName("CLIENTES");
    const values = sheet.getDataRange().getValues();
    const headers = values[0].map(h => h.toString().toLowerCase().trim());
    
    const curpCol = headers.indexOf("curp");
    const idCol = headers.indexOf("id");
    
    // 1. BLINDAJE DE BÚSQUEDA: Busca por CURP o por ID
    let existingRowIndex = -1;
    const searchId = (payload.id || "").toString().toUpperCase().trim();
    const searchCurp = (payload.curp || "").toString().toUpperCase().trim();
    
    for (let i = 1; i < values.length; i++) {
      const rowId = values[i][idCol] ? values[i][idCol].toString().toUpperCase().trim() : "";
      const rowCurp = values[i][curpCol] ? values[i][curpCol].toString().toUpperCase().trim() : "";
      
      if ((searchCurp && rowCurp === searchCurp) || (searchId && rowId === searchId)) {
        existingRowIndex = i;
        break;
      }
    }

    const curp10 = payload.curp ? payload.curp.toString().substring(0, 10).toUpperCase() : (payload.id || "");
    // 2. RECUPERAR DATOS PREVIOS PARA NO SOBREESCRIBIR CON VACÍOS (MERGE)
    let rowData = [];
    if (existingRowIndex > -1) {
      rowData = [...values[existingRowIndex]];
      while (rowData.length < 25) rowData.push(""); // A-Y
    } else {
      // Fila por defecto con 25 columnas (A-Y)
      rowData = new Array(25).fill("");
    }

    // 3. ACTUALIZACIÓN SELECTIVA (Solo si el payload trae el dato)
    const mapUpdate = (index, value) => { if (value !== undefined && value !== null) rowData[index] = value; };

    mapUpdate(0, curp10);                                       // A: id
    mapUpdate(1, payload.nombre);                              // B: Nombre
    mapUpdate(2, payload.apellidos);                           // C: Apellidos
    mapUpdate(3, payload.curp);                                // D: CURP
    
    // NSS Handling: Prefer list if it has elements, else fallback to single nss
    let nssValue = "";
    if (payload.nssList && Array.isArray(payload.nssList) && payload.nssList.filter(n=>n).length > 0) {
      const allNss = [...new Set([payload.nss, ...payload.nssList].filter(n => n))];
      nssValue = allNss.join(", ");
    } else {
      nssValue = payload.nss || "";
    }
    mapUpdate(4, nssValue);                                    // E: NSS (Column 5)
    
    mapUpdate(5, payload.rfc);                                 // F: RFC
    mapUpdate(6, payload.whatsapp);                            // G: WhatsApp
    mapUpdate(7, payload.email);                               // H: Email
    mapUpdate(8, payload.selfie_url);                          // I: SelfieURL
    mapUpdate(9, payload.comprobantedomiciliourl);             // J: ComprobanteDomicilioUrl
    mapUpdate(10, payload.domicilioExtraido);                  // K: DomicilioExtraido
    mapUpdate(24, payload.patrones);                           // Y: Patrones
    
    // Carpeta Drive (Inteligencia de Carpetas)
    let folderId = rowData[11] || payload.id_carpeta_drive;
    if (!folderId) {
       // Buscar si ya existe una carpeta con este CURP (Ej. de Onboarding)
       const folders = DriveApp.getFolderById(ROOT_FOLDER_ID).searchFolders(`title contains '[${curp10}]'`);
       if (folders.hasNext()) {
          const folder = folders.next();
          folderId = folder.getId();
          logDebug("FOLDER_SYNC", "Carpeta encontrada en Drive: " + folderId);
       } else {
          const folder = DriveApp.getFolderById(ROOT_FOLDER_ID).createFolder(`[${curp10}] ${payload.nombre || "NUEVO"}`);
          folderId = folder.getId();
          if (payload.email && payload.email.indexOf('@') > -1) {
            try { folder.addViewer(payload.email); } catch(e) {}
          }
       }
    }
    mapUpdate(11, folderId);                                   // L: ID_Carpeta_Drive
    
    // PROCESAR DOCUMENTOS ENVIADOS DESDE FRONTEND (Si existen)
    if (payload.documentos && Array.isArray(payload.documentos)) {
      logDebug("DBG_DOCS", "Procesando " + payload.documentos.length + " doc(s) en folder: " + folderId);
      try {
        const folder = DriveApp.getFolderById(folderId);
        payload.documentos.forEach(doc => {
          try {
            if (doc.content) {
              const match = doc.content.match(/^data:(.*?);.*base64,(.*)$/);
              let mimeType = 'application/pdf';
              let base64Data = doc.content;
              if (match) {
                mimeType = match[1];
                base64Data = match[2];
              } else if (doc.content.includes("base64,")) {
                mimeType = doc.content.split(';')[0].split(':')[1] || 'application/pdf';
                base64Data = doc.content.split('base64,')[1];
              }
              const blob = Utilities.newBlob(Utilities.base64Decode(base64Data.replace(/[\r\n]/g, '').trim()), mimeType, doc.name);
              folder.createFile(blob);
            }
          } catch(innerErr) {
            logDebug("ERR_DOC_CREATION", doc.name + " - " + innerErr.toString());
          }
        });
      } catch(e) {
        logDebug("ERR_DOCS", e.toString());
      }
    }
    
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

    // 4. DATOS ESTRUCTURADOS (JSON) para campos dinámicos
    const extraMetadata = {
      nssList: payload.nssList || [],
      contactosExtra: payload.contactosExtra || [],
      metadatosAuditoria: payload.metadatosAuditoria || {}
    };
    mapUpdate(22, JSON.stringify(extraMetadata));               // W: Metadata_JSON
    mapUpdate(23, payload.codigoPostal || "");                  // X: Código Postal

    if (existingRowIndex > -1) {
      sheet.getRange(existingRowIndex + 1, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    return createResponse({ success: true, id: curp10, id_carpeta_drive: folderId });
  } finally {
    lock.releaseLock();
  }
}

function handleCreateHoja(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch(e) {}
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName("HOJAS_SERVICIO");
    if (!sheet) {
      sheet = ss.insertSheet("HOJAS_SERVICIO");
      sheet.appendRow(["ID_Hoja", "ID_Cliente", "Universo", "Servicios", "Monto", "Diagnostico", "Status", "Fecha", "Asesor", "FirmaAsesor"]);
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    const idHojaCol = headers.indexOf("id_hoja");
    const idClienteCol = headers.indexOf("id_cliente");
    
    // Búsqueda de registro existente (Upsert) por ID_Hoja (Columna A/0)
    let rowIndex = -1;
    const searchHojaId = (payload.id_hoja || "").toString().toUpperCase().trim();
    if (searchHojaId) {
      for (let i = 1; i < data.length; i++) {
        if (data[i][idHojaCol] && data[i][idHojaCol].toString().toUpperCase().trim() === searchHojaId) {
          rowIndex = i;
          break;
        }
      }
    }
    
    const searchClienteId = (payload.clienteId || payload.id || "").toString().toUpperCase().trim();
    
    // BLINDAJE: servicios puede venir como Array o como String ya unido
    let serviciosStr = "";
    if (Array.isArray(payload.servicios)) {
      serviciosStr = payload.servicios.join(", ");
    } else {
      serviciosStr = payload.servicios || "";
    }
    
    const rowData = [
      searchHojaId || Utilities.getUuid(),                      // A: ID_Hoja
      searchClienteId,                                          // B: ID_Cliente
      payload.universo || "U1/U2",                              // C: Universo
      serviciosStr,                                              // D: Servicios
      payload.honorariosAcordados || payload.monto || 0,         // E: Monto
      payload.notasDiagnostico || payload.dictamen || "",        // F: Diagnostico
      "ACTIVO",                                                  // G: Status
      payload.createdAt || new Date().toISOString(),             // H: Fecha
      payload.asesor || "",                                      // I: Asesor
      payload.firmaAsesor || "",                                 // J: FirmaAsesor
      payload.notasExtra || ""                                   // K: NotasExtra
    ];
    
    if (rowIndex > -1) {
      sheet.getRange(rowIndex + 1, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    
    return createResponse({ success: true });
  } finally {
    lock.releaseLock();
  }
}

function handleUploadFile(payload) {
  try {
    const fId = payload.id_carpeta_drive || payload.idcarpetadrive || payload.idCarpetaDrive;
    logDebug("UPLOAD_FILE", "Intentando subir a: " + fId + ", Archivo: " + payload.fileName);
    if (!fId) throw new Error("ID de carpeta no proporcionado.");
    
    const folder = DriveApp.getFolderById(fId);
    
    let base64Data = payload.fileData;
    if (base64Data.includes("base64,")) {
      base64Data = base64Data.split("base64,")[1];
    }
    base64Data = base64Data.replace(/[\r\n]/g, '').trim();
    
    let mimeType = 'application/pdf';
    const nameUpper = payload.fileName.toUpperCase();
    if (nameUpper.endsWith('.JPG') || nameUpper.endsWith('.JPEG')) mimeType = 'image/jpeg';
    else if (nameUpper.endsWith('.PNG')) mimeType = 'image/png';

    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, payload.fileName);
    const file = folder.createFile(blob);
    logDebug("UPLOAD_FILE", "Éxito URL: " + file.getUrl());
    return createResponse({ success: true, url: file.getUrl() });
  } catch (e) {
    logDebug("UPLOAD_FILE_ERR", e.toString());
    return createResponse({ success: false, error: e.toString() }); 
  }
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length === 0) return [];
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

function handleLogin(payload) {
  const incomingEmail = typeof payload === 'string' ? payload : payload.email;
  const incomingPassword = typeof payload === 'object' ? payload.password : null;
  
  if (!incomingEmail) return createResponse({ success: false, error: 'Email requerido' }, 400);
  const cleanIncomingEmail = incomingEmail.toString().replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("USUARIOS");
  if (!sheet) {
    sheet = ss.insertSheet("USUARIOS");
    sheet.appendRow(["Email", "Rol", "Nombre", "Contraseña"]);
  }
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return createResponse({ success: false, error: 'No hay usuarios autorizados' }, 404);
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  const emailCol = headers.indexOf('email');
  const pwdCol = headers.indexOf('contraseña');
  
  for (let i = 1; i < data.length; i++) {
    const sheetEmail = data[i][emailCol] ? data[i][emailCol].toString().trim().toLowerCase() : "";
    if (sheetEmail === cleanIncomingEmail) {
      if (pwdCol !== -1 && incomingPassword) {
        const sheetPwd = data[i][pwdCol] ? data[i][pwdCol].toString().trim() : "";
        if (sheetPwd && sheetPwd !== incomingPassword) {
          return createResponse({ success: false, error: 'Contraseña incorrecta' }, 401);
        }
      }
      return createResponse({
        success: true,
        user: { email: data[i][0], rol: data[i][1], nombre: data[i][2] }
      });
    }
  }
  return createResponse({ success: false, error: `Usuario ${cleanIncomingEmail} no autorizado` }, 401);
}

function handleLogAction(payload, email) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let logSheet = ss.getSheetByName("LOGS") || ss.insertSheet("LOGS");
  logSheet.appendRow([new Date(), email || "Desconocido", payload.accion || "INFO", payload.detalles || ""]);
  return createResponse({ success: true });
}

function createResponse(data, code = 200) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function replaceTextWithImage(body, searchText, base64Data, mimeType, width, height) {
  if (!base64Data || base64Data.length < 50) return;
  try {
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data.split(",")[1]), mimeType);
    replaceTextWithImageBlob(body, searchText, blob, width, height);
  } catch(e) { logDebug("ERR_REP_IMG", e.toString()); }
}

function replaceTextWithImageBlob(body, searchText, blob, width, height) {
  if (!blob) return;
  try {
    const match = body.findText(searchText);
    if (match) {
      const textElement = match.getElement().asText();
      const parent = textElement.getParent();
      const currentText = textElement.getText();
      if (currentText.includes(searchText)) textElement.setText(currentText.replace(searchText, ''));
      
      let img;
      if (parent.getType() === DocumentApp.ElementType.PARAGRAPH) {
         img = parent.asParagraph().insertInlineImage(parent.getChildIndex(textElement), blob);
         parent.asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      } else if (parent.getType() === DocumentApp.ElementType.TABLE_CELL) {
         img = parent.asTableCell().appendImage(blob);
         parent.asTableCell().setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
      }
      
      if (img && width && height) {
        const maxWidth = 500; 
        const actualWidth = Math.min(width, maxWidth);
        const ratio = actualWidth / width;
        img.setWidth(actualWidth).setHeight(height * ratio);
      }
    }
  } catch(e) { logDebug("ERR_REP_BLOB", e.toString()); }
}

function handleOnboardingSync(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("CLIENTES");
  if (!sheet) return createResponse({ success: false, error: "BD NO ESTA" });
  
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => h.toString().toLowerCase().trim());
  const idCol = headers.indexOf("id");
  const curpCol = headers.indexOf("curp");

  let existingRowIndex = -1;
  const searchId = (payload.id || payload.curp || "").toString().toUpperCase();
  
  for (let i = 1; i < values.length; i++) {
    const rowId = values[i][idCol] ? values[i][idCol].toString().toUpperCase() : "";
    const rowCurp = values[i][curpCol] ? values[i][curpCol].toString().toUpperCase() : "";
    if ((payload.curp && rowCurp === payload.curp.toString().toUpperCase()) || (searchId && rowId === searchId)) {
      existingRowIndex = i;
      break;
    }
  }

  const curp10 = payload.curp ? payload.curp.toString().substring(0, 10).toUpperCase() : (payload.id || "");
  let rowData = existingRowIndex > -1 ? [...values[existingRowIndex]] : new Array(25).fill("");
  while (rowData.length < 25) rowData.push(""); // A-Y
  const mapUpdate = (index, value) => { if (value !== undefined && value !== null) rowData[index] = value; };

  mapUpdate(0, curp10);                                       
  mapUpdate(1, payload.nombre);                              
  mapUpdate(2, payload.apellidos);                           
  mapUpdate(3, payload.curp);                                
  mapUpdate(4, payload.nss || "");                                    
  mapUpdate(5, payload.rfc || "");                                 
  mapUpdate(6, payload.whatsapp || "");                            
  mapUpdate(7, payload.email || "");                               
  mapUpdate(10, payload.domicilioExtraido || "");                  
  
  let folderId = rowData[11] || payload.id_carpeta_drive;
  if (!folderId) {
     const folders = DriveApp.getFolderById(ROOT_FOLDER_ID).searchFolders(`title contains '[${curp10}]'`);
     if (folders.hasNext()) {
        folderId = folders.next().getId();
        logDebug("ONBOARDING_SYNC", "Carpeta encontrada en Drive: " + folderId);
     } else {
        const folder = DriveApp.getFolderById(ROOT_FOLDER_ID).createFolder(`[${curp10}] ${payload.nombre || "NUEVO"}`);
        folderId = folder.getId();
        if (payload.email && payload.email.indexOf('@') > -1) {
          try { folder.addViewer(payload.email); } catch(e) {}
        }
     }
  }
  mapUpdate(11, folderId);
  if (!rowData[12]) mapUpdate(12, new Date().toISOString());
  
  mapUpdate(23, payload.codigoPostal || ""); // X: Código Postal
  mapUpdate(24, payload.patrones || ""); // Y: Patrones
  
  // ESTATUS COMPLETADO SI SE DA FIRMA
  mapUpdate(20, "FIRMADO"); // estatusfirma
  
  if (existingRowIndex > -1) {
    sheet.getRange(existingRowIndex + 1, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  // 1. Guardar Fotos Físicas y Documentos Extras Extras
  const folder = DriveApp.getFolderById(folderId);
  if (payload.selfieBase64 && payload.selfieBase64.length > 50) {
    const selfieBlob = Utilities.newBlob(Utilities.base64Decode(payload.selfieBase64.split(",")[1]), "image/jpeg", `SELFIE_ONB_${curp10}.jpg`);
    folder.createFile(selfieBlob);
  }
  if (payload.firmaBase64 && payload.firmaBase64.length > 50) {
    const firmaBlob = Utilities.newBlob(Utilities.base64Decode(payload.firmaBase64.split(",")[1]), "image/png", `FIRMA_ONB_${curp10}.png`);
    folder.createFile(firmaBlob);
  }
  if (payload.documentos && Array.isArray(payload.documentos)) { // INEs, etc..
    payload.documentos.forEach(doc => {
      try {
        if (doc.content) {
          const match = doc.content.match(/^data:(.*?);.*base64,(.*)$/);
          let mimeType = 'application/pdf';
          let base64Data = doc.content;
          if (match) { mimeType = match[1]; base64Data = match[2]; } 
          else if (doc.content.includes("base64,")) { mimeType = doc.content.split(';')[0].split(':')[1] || 'application/pdf'; base64Data = doc.content.split('base64,')[1]; }
          const blob = Utilities.newBlob(Utilities.base64Decode(base64Data.replace(/[\r\n]/g, '').trim()), mimeType, doc.name);
          folder.createFile(blob);
        }
      } catch(e) {}
    });
  }

  // 2. GENERACION AUTOMATICA DE CONTRATO (FORMATO MAESTRO) E INCRUSTACION DE FIRMA
  try {
     const templateId = "12GVFwA_zkRs4olXQaF2sL5E6Tw6em7ne19tw3y6vHL0";
     
     const oldFiles = folder.getFiles();
     while(oldFiles.hasNext()) { const f = oldFiles.next(); if (f.getName().includes("CONTRATO_MARCO") || f.getName().includes("CONTRATO_PERSONALIZADO")) f.setTrashed(true); }
     
     const copy = DriveApp.getFileById(templateId).makeCopy(`CONTRATO_MARCO - ${payload.nombre || ""}`, folder);
     const doc = DocumentApp.openById(copy.getId());
     const body = doc.getBody();
     body.replaceText("{{NOMBRE_CLIENTE}}", payload.nombre || (payload.nombre + " " + payload.apellidos) || "");
     body.replaceText("{{nombre_cliente}}", payload.nombre || (payload.nombre + " " + payload.apellidos) || "");
     body.replaceText("{{CURP}}", payload.curp || "");
     body.replaceText("{{FECHA}}", new Date().toLocaleDateString('es-MX'));
     body.replaceText("{{NSS}}", payload.nss || "");
     
     replaceTextWithImage(body, "{{firma_cliente}}", payload.firmaBase64, "image/png", 220, 110);
     replaceTextWithImage(body, "{{selfie}}", payload.selfieBase64, "image/jpeg", 140, 140);
     replaceTextWithImage(body, "{{IMAGEN_FIRMA}}", payload.firmaBase64, "image/png", 200, 100);
     replaceTextWithImage(body, "{{IMAGEN_SELFIE}}", payload.selfieBase64, "image/jpeg", 150, 150);
     
     doc.saveAndClose();
     copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
     
     // Convertir a PDF y guardar en la carpeta
     try {
       const pdfBlob = copy.getAs('application/pdf');
       const pdfFile = folder.createFile(pdfBlob).setName(`CONTRATO_MARCO_${curp10}.pdf`);
       pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
       // Limpieza
       copy.setTrashed(true);
       
       sheet.getRange(existingRowIndex > -1 ? existingRowIndex + 1 : sheet.getLastRow(), 24).setValue(pdfFile.getUrl());
     } catch (pdfErr) {
       logDebug("ONB_PDF_ERR", pdfErr.toString());
       sheet.getRange(existingRowIndex > -1 ? existingRowIndex + 1 : sheet.getLastRow(), 24).setValue(copy.getUrl());
     }

  } catch(e) { logDebug("ONB_DOC_ERR", e.toString()); }

  return createResponse({ success: true, id: curp10, id_carpeta_drive: folderId });
}

function forzarPermisosReales() {
  // Forzamos al motor a tocar la API de Docs con un documento real
  var doc = DocumentApp.openById("12GVFwA_zkRs4olXQaF2sL5E6Tw6em7ne19tw3y6vHL0");
  console.log("Permiso concedido para: " + doc.getName());
}