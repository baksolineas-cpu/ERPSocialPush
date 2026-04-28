// Configuración Maestra
var SPREADSHEET_ID = ""; 
try {
  SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
} catch(e) {
  // Si el script no está vinculado, el programador debe poner el ID manualmente aquí
  // SPREADSHEET_ID = "ID_DE_TU_HOJA_AQUÍ";
}

const ROOT_FOLDER_ID = "1xzILR2Afad-feJ-CHAkNiCHjHwLocvhX"; 
const CONTRATO_TEMPLATE_ID = "12GVFwA_zkRs4olXQaF2sL5E6Tw6em7ne19tw3y6vHL0";
const DIAGNOSTICO_TEMPLATE_ID = "17Q_Z8_r_8_m_8_m_8_m_placeholder"; // REEMPLAZAR CON ID REAL SI EXISTE

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
    } else if (action === 'RECORD_PAYMENT') {
      return handleRecordPayment(payload);
    } else if (action === 'UPDATE_CLIENTE') {
      return handleUpdateCliente(payload);
    } else if (action === 'RPA_UPLOAD') {
      return handleRpaUpload(payload);
    } else if (action === 'PAY_COMMISSION') {
      return handlePayCommission(payload);
    } else {
      return createResponse({ error: 'Acción no válida: ' + action }, 400);
    }
  } catch (error) {
    logDebug("❌ ERROR POST", error.toString());
    return createResponse({ error: error.toString() }, 500);
  }
}

/**
 * Actualiza un cliente existente en la hoja CLIENTES.
 */
function handleUpdateCliente(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return createResponse({ success: false, error: 'Sistema ocupado' }, 429);
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName("CLIENTES");
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    
    const idCol = headers.indexOf("id");
    const curpCol = headers.indexOf("curp");
    
    const searchId = (payload.id || "").toString().toUpperCase().replace("NEW_", "").trim();
    const searchCurp = (payload.curp || "").toString().toUpperCase().trim();
    
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      const rowId = data[i][idCol] ? data[i][idCol].toString().toUpperCase().trim() : "";
      const rowCurp = data[i][curpCol] ? data[i][curpCol].toString().toUpperCase().trim() : "";
      
      if ((searchId && rowId === searchId) || (searchCurp && rowCurp === searchCurp)) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      return createResponse({ success: false, error: "Cliente no encontrado" }, 404);
    }

    // Actualizamos solo los campos permitidos y enviados
    // Mapeo exacto basado en handleCreateCliente
    // 1 (B): Nombre
    if (payload.nombre !== undefined) sheet.getRange(rowIndex + 1, 2).setValue(payload.nombre);
    // 5 (E): NSS (headers 1-indexed -> index 5)
    if (payload.nss !== undefined) sheet.getRange(rowIndex + 1, 5).setValue(payload.nss);
    // 7 (G): WhatsApp
    if (payload.whatsapp !== undefined) sheet.getRange(rowIndex + 1, 7).setValue(payload.whatsapp);
    // 8 (H): Email
    if (payload.email !== undefined) sheet.getRange(rowIndex + 1, 8).setValue(payload.email);
    // 11 (K): Domicilio
    if (payload.domicilio !== undefined) sheet.getRange(rowIndex + 1, 11).setValue(payload.domicilio);
    // 15 (O): Semanas
    if (payload.semanasCotizadas !== undefined) sheet.getRange(rowIndex + 1, 15).setValue(payload.semanasCotizadas);
    // 16 (P): Salario
    if (payload.ultimoSalario !== undefined) sheet.getRange(rowIndex + 1, 16).setValue(payload.ultimoSalario);
    // 18 (R): Notas
    if (payload.notasSeguimiento !== undefined) sheet.getRange(rowIndex + 1, 18).setValue(payload.notasSeguimiento);

    return createResponse({ success: true });
  } catch (error) {
    logDebug("ERR_UPDATE_CLIENTE", error.toString());
    return createResponse({ success: false, error: error.toString() }, 500);
  } finally {
    lock.releaseLock();
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

  const clientesArr = getSheetData("CLIENTES");
  const idBruto = (payload.clienteId || "").toString().toUpperCase().replace("NEW_", "").trim();
  const searchId = idBruto.substring(0, 10);
  logDebug("UPDATE_SIG", "Iniciando firma para: " + searchId);
  
  let rowIndex = -1;
  let rowObj = null;

  for (let i = 0; i < clientesArr.length; i++) {
    const c = clientesArr[i];
    const rowId = (c.id || "").toString().toUpperCase().replace("NEW_", "").trim();
    if (rowId === searchId || (c.curp && c.curp.toString().toUpperCase().includes(searchId))) {
      rowIndex = i + 1; // 1-indexed for SpreadsheetApp
      rowObj = c;
      break;
    }
  }

  if (rowIndex === -1) return createResponse({ success: false, error: "Cliente no encontrado" }, 404);

    // 1. Guardar archivos físicos en Drive
    let folderId = rowObj.id_carpeta_drive || rowObj.idcarpetadrive || rowObj.idCarpetaDrive;
    
    if (!folderId) {
      try {
        const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
        const it = root.searchFolders(`title contains '[${searchId.substring(0,10)}]'`);
        if (it.hasNext()) folderId = it.next().getId();
      } catch(e) {}
    }
    
    if (folderId) {
      try {
        const folder = DriveApp.getFolderById(folderId);
        if (payload.selfieBase64 && payload.selfieBase64.length > 50) {
          const sRaw = payload.selfieBase64.includes(",") ? payload.selfieBase64.split(",")[1] : payload.selfieBase64;
          const selfieBlob = Utilities.newBlob(Utilities.base64Decode(sRaw), "image/jpeg", `SELFIE_${searchId}.jpg`);
          const selfieFile = folder.createFile(selfieBlob);
          const selfieUrl = selfieFile.getUrl();
          selfieFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          
          // Buscar columna SelfieURL
          const selfieColIndex = headers.indexOf("selfieurl");
          if (selfieColIndex !== -1) {
            sheet.getRange(rowIndex + 1, selfieColIndex + 1).setValue(selfieUrl);
          }
        }
        if (payload.firmaBase64 && payload.firmaBase64.length > 50) {
          const fRaw = payload.firmaBase64.includes(",") ? payload.firmaBase64.split(",")[1] : payload.firmaBase64;
          const firmaBlob = Utilities.newBlob(Utilities.base64Decode(fRaw), "image/png", `FIRMA_CLIENTE_${searchId}.png`);
          const fFile = folder.createFile(firmaBlob);
          fFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          logDebug("SIGN_SAVED", "Imagen de firma guardada en Drive para: " + searchId);
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
            const docId = file.getId();
            logDebug("STAMPING_MATCH", "Iniciando estampado de: " + fileName + " (ID: " + docId + ")");
           
           try {
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
             Utilities.sleep(2000);
             
             // Generar PDF y Conservar Originales
             const pdfBlob = file.getAs('application/pdf');
             const pdfFile = folder.createFile(pdfBlob).setName(fileName + "_FIRMADO_" + transactionId + ".pdf");
             pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
             signedDocUrls.push({ name: pdfFile.getName(), url: pdfFile.getUrl() });
             
             // Por requerimiento de auditoría, conservamos el DOC editable firmado hasta revisión manual
             // file.setTrashed(true);
             
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
  logDebug("FINALIZE_AUDIT_START", "Iniciando flujo para: " + (payload.curp || payload.id));
  
  const rawCurp = (payload.curp || "").toString().toUpperCase().trim();
  const curp10 = rawCurp.substring(0, 10);
  if (!curp10) return createResponse({ status: 'error', message: 'CURP Inválida o faltante' }, 400);

  const skipContract = payload.tipoDocEval === 'DIAGNOSTICO';

  // 1. Localizar Carpeta
  let folder;
  try {
    const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
    const folderIdMatch = payload.id_carpeta_drive || payload.idcarpetadrive;
    if (folderIdMatch) {
      folder = DriveApp.getFolderById(folderIdMatch);
    } else {
      const it = root.searchFolders(`title contains '[${curp10}]'`);
      if (it.hasNext()) folder = it.next();
    }
  } catch(e) { logDebug("FOLDER_SEARCH_ERR", e.toString()); }

  if (!folder) return createResponse({ status: 'error', message: 'No se localizó la carpeta del cliente para ' + curp10 }, 404);
  const folderId = folder.getId();

  // Búsqueda flexible de archivos si no vienen en payload
  const getBlobFromDrive = (keyword, mime) => {
    try {
      const it = folder.getFiles();
      while (it.hasNext()) {
        const f = it.next();
        if (f.getName().toUpperCase().includes(keyword.toUpperCase())) return f.getBlob();
      }
    } catch(e) {}
    return null;
  };

  const getBlobFromBase64 = (base64, name, mime) => {
    if (!base64 || base64.length < 50) return null;
    const raw = base64.includes(",") ? base64.split(",")[1] : base64;
    return Utilities.newBlob(Utilities.base64Decode(raw), mime, name);
  };

  let bFirmaCliente = getBlobFromBase64(payload.firmaBase64 || payload.firmaCliente, "FIRMA_CLIENTE.png", "image/png") || getBlobFromDrive("FIRMA_CLIENTE", "image/png");
  const bFirmaAsesor = getBlobFromBase64(payload.firmaAsesor || payload.firmaAsesorBase64, "FIRMA_ASESOR.png", "image/png");
  let bSelfie = getBlobFromBase64(payload.selfieBase64 || payload.selfie_url, "SELFIE.jpg", "image/jpeg") || getBlobFromDrive("SELFIE", "image/jpeg");

  const pdfUrls = { contrato: "", diagnostico: "" };

  // Reemplazo Unificado
  const processDoc = (docId, fileName) => {
    const doc = DocumentApp.openById(docId);
    const body = doc.getBody();
    
    const cleanRepl = (tag, val) => {
       if (val !== undefined && val !== null) {
          body.replaceText(`{{${tag.toUpperCase()}}}`, val);
          body.replaceText(`{{${tag.toLowerCase()}}}`, val);
       }
    };

    cleanRepl("NOMBRE_CLIENTE", payload.nombre);
    cleanRepl("CURP", rawCurp);
    cleanRepl("NSS", payload.nss);
    cleanRepl("FECHA", new Date().toLocaleDateString('es-MX'));
    cleanRepl("DIAGNOSTICO", payload.dictamen || payload.diagnosticoTexto || "");
    cleanRepl("SERVICIOS", payload.serviciosContratados || (Array.isArray(payload.servicios) ? payload.servicios.join(", ") : payload.servicios) || "");
    cleanRepl("MONTO", payload.montoAcordado || payload.monto || "");

    if (bSelfie) {
      replaceTextWithImageBlob(body, "{{IMAGEN_SELFIE}}", bSelfie, 140, 140);
      replaceTextWithImageBlob(body, "{{selfie}}", bSelfie, 140, 140);
    }
    if (bFirmaCliente) {
      replaceTextWithImageBlob(body, "{{FIRMA_CLIENTE}}", bFirmaCliente, 200, 100);
      replaceTextWithImageBlob(body, "{{firma_cliente}}", bFirmaCliente, 200, 100);
    }
    if (bFirmaAsesor) {
      replaceTextWithImageBlob(body, "{{FIRMA_ASESOR}}", bFirmaAsesor, 200, 100);
      replaceTextWithImageBlob(body, "{{firma_asesor}}", bFirmaAsesor, 200, 100);
    }
    
    doc.saveAndClose();
    Utilities.sleep(1000);
    
    const pdfBlob = doc.getBlob().getAs('application/pdf');
    const pdfFile = folder.createFile(pdfBlob).setName(fileName + "_" + curp10 + ".pdf");
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Trash literal (Google Doc)
    try { DriveApp.getFileById(docId).setTrashed(true); } catch(e) {}
    
    return pdfFile.getUrl();
  };

  // Paso 2: Contrato Marco
  try {
    if (!skipContract && CONTRATO_TEMPLATE_ID && !CONTRATO_TEMPLATE_ID.includes("placeholder")) {
      const copy = DriveApp.getFileById(CONTRATO_TEMPLATE_ID).makeCopy("TEMP_CONTRATO_" + curp10, folder);
      pdfUrls.contrato = processDoc(copy.getId(), "CONTRATO_MARCO");
    }
  } catch(e) { logDebug("CONTRATO_GEN_ERR", e.toString()); }

  // Paso 3: Diagnóstico
  try {
    if (DIAGNOSTICO_TEMPLATE_ID && !DIAGNOSTICO_TEMPLATE_ID.includes("placeholder")) {
      const copy = DriveApp.getFileById(DIAGNOSTICO_TEMPLATE_ID).makeCopy("TEMP_DIAG_" + curp10, folder);
      pdfUrls.diagnostico = processDoc(copy.getId(), "DIAGNOSTICO_CERTIFICADO");
    } else {
      const docUrl = generateDiagnosticDoc(payload, payload.servicios, payload.montoAcordado, payload.asesor, payload.firmaAsesor || payload.firmaAsesorBase64, payload.id_hoja, payload.montoU2);
      if (docUrl) {
         const docId = docUrl.split("/d/")[1].split("/")[0];
         pdfUrls.diagnostico = processDoc(docId, "DIAGNOSTICO_CERTIFICADO");
      }
    }
  } catch(e) { logDebug("DIAG_GEN_ERR", e.toString()); }

  // 4. Sincronización Final de URLs y Persistencia
  try {
    handleCreateCliente({ ...payload, id: curp10 });
    handleCreateHoja({ 
      ...payload, 
      clienteId: curp10, 
      diagnostico_url: pdfUrls.diagnostico,
      contrato_url: pdfUrls.contrato 
    });
  } catch(e) { logDebug("SYNC_FINAL_ERR", e.toString()); }

  return createResponse({ 
    success: true, 
    id: curp10, 
    pdfUrls: pdfUrls 
  });
}

function generateDiagnosticDoc(clientData, servicesData, montoTotal, asesorName, firmaAsesorBase64, idHoja, montoU2) {
  try {
    const rawId = (clientData.id || clientData.curp || "").toString().replace("NEW_", "");
    const searchId = rawId.substring(0, 10).toUpperCase();

    let folderId = clientData.id_carpeta_drive || clientData.idcarpetadrive;
    if (!folderId) {
      const it = DriveApp.getFolderById(ROOT_FOLDER_ID).searchFolders(`title contains '[${searchId}]'`);
      if (it.hasNext()) folderId = it.next().getId();
    }
    if (!folderId) return;
    const folder = DriveApp.getFolderById(folderId);

    // Crear Documento Temporal con VERSIONAMIENTO
    const suffix = idHoja || new Date().getTime();
    const doc = DocumentApp.create("DIAGNOSTICO_CERTIFICADO_" + clientData.curp + "_" + suffix);
    const docFile = DriveApp.getFileById(doc.getId());
    docFile.moveTo(folder); // Moverlo a la carpeta del cliente
    
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
    body.appendParagraph("\nII. SERVICIOS CONTRATADOS:").setBold(true);
    let serviciosStr = Array.isArray(servicesData) ? servicesData.join(", ") : (servicesData || "Asesoría Técnica y Legal Especializada");
    body.appendParagraph(serviciosStr).setAttributes({[DocumentApp.Attribute.FONT_SIZE]: 10});

    // 4. VALOR TOTAL E INSTRUCCIONES DE DEPÓSITO
    body.appendParagraph("\nIII. VALORES DE PROYECTO E INSTRUCCIONES DE DEPÓSITO:").setBold(true);
    
    let valU2 = parseFloat(montoU2 || 0);
    let valU1 = parseFloat(montoTotal || 0) - valU2;
    if (valU1 < 0) valU1 = 0;

    if (valU1 > 0) {
       body.appendParagraph(`Monto por Servicios Individuales (U1): $${Number(valU1).toLocaleString('es-MX', {minimumFractionDigits:2})} MXN\n> Depositar en Cuenta de Honorarios BAKSO [Datos Bancarios]\n`);
    }
    if (valU2 > 0) {
       body.appendParagraph(`Monto por Servicios Integrales (U2): $${Number(valU2).toLocaleString('es-MX', {minimumFractionDigits:2})} MXN\n> Depositar en Cuenta Concentradora [Datos Bancarios]\n`);
    }
    body.appendParagraph(`IMPORTANTE: Favor de incluir su ID (${clientData.curp || clientData.id || "SP"}) en el concepto de cualquier transferencia para su validación automatizada.`).setBold(true);
    
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
    return docFile.getUrl(); // Retornar URL del DOC editable
  } catch(e) {
    logDebug("ERR_GEN_DIAG_DOC_HELPER", e.toString());
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'LOGIN') {
      return handleLogin(e.parameter.email);
    }
    if (action === 'GET_CLIENTE_STATUS') {
      return handleGetClienteStatus(e.parameter);
    }
    if (action === 'GET_DATA') return handleGetData(e.parameter.sheetName);
    return createResponse({ message: "API BAKSO Activa" });
  } catch (err) {
    logDebug("❌ ERROR GET", err.toString());
    return createResponse({ error: err.toString() }, 500);
  }
}

/**
 * Consulta de estatus del cliente para el portal externo.
 * Paso 6: Busca archivos PDF específicos en Drive y devuelve sus URLs.
 */
function handleGetClienteStatus(payload) {
  try {
    const identifier = payload.curp || payload.id || payload.clienteId;
    if (!identifier) return createResponse({ status: 'error', message: 'ID Requerido' }, 400);
    
    // Normalizar ID de búsqueda a CURP10
    const rawId = identifier.toString().replace("NEW_", "");
    const curp10 = rawId.substring(0, 10).toUpperCase();

    const clientesArr = getSheetData("CLIENTES");
    const cliente = clientesArr.find(c => 
      (c.id && c.id.toString().toUpperCase().trim().includes(curp10)) || 
      (c.curp && c.curp.toString().toUpperCase().trim().includes(curp10))
    );
    
    if (cliente) {
      // 1. Localizar Carpeta
      let folder;
      try {
        const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
        const folderId = cliente.id_carpeta_drive || cliente.idcarpetadrive;
        if (folderId) {
          folder = DriveApp.getFolderById(folderId);
        } else {
          const it = root.searchFolders(`title contains '[${curp10}]'`);
          if (it.hasNext()) folder = it.next();
        }
      } catch(e) {}

      if (folder) {
        cliente.folder_url = folder.getUrl();
        cliente.drive_verificado = true;
        
        // Paso 6: Buscar SOLO archivos PDF específicos
        const files = folder.getFiles();
        while (files.hasNext()) {
          const file = files.next();
          const name = file.getName();
          const isPdf = file.getMimeType() === MimeType.PDF || name.toLowerCase().endsWith(".pdf");
          
          if (isPdf) {
            if (name.startsWith("CONTRATO_MARCO")) {
              cliente.contrato_url = file.getUrl();
            }
            if (name.startsWith("DIAGNOSTICO_CERTIFICADO")) {
              cliente.diagnostico_url = file.getUrl();
            }
          }
          
          // Otros archivos de interés (INE, etc)
          if (name.toUpperCase().includes("INE")) cliente.ine_url = file.getUrl();
          if (name.toUpperCase().includes("FISCAL") || name.toUpperCase().includes("CSF")) cliente.csf_url = file.getUrl();
        }
      }

      // Sincronizar con Hoja de Servicio para mostrar montos y diagnóstico
      try {
        const hojas = getSheetData("HOJAS_SERVICIO");
        const hoja = hojas.reverse().find(h => {
          const rowId = (h.id_cliente || h.clienteid || h.id || "").toString().toUpperCase();
          return rowId.includes(curp10);
        });
        
        if (hoja) {
          cliente.hojaservicio = hoja;
          // Mapeo enriquecido para el portal
          cliente.diagnosticoTexto = hoja.diagnostico || hoja.dictamen || "";
          cliente.serviciosContratados = hoja.servicios || "";
          cliente.montoTotal = (hoja.monto || hoja.honorarios || 0).toString();
          cliente.montoAcordado = cliente.montoTotal;
          cliente.asesorAsignado = hoja.asesor || "";
          if (hoja.url_diagnostico && hoja.url_diagnostico.toLowerCase().endsWith(".pdf")) {
            cliente.diagnostico_url = hoja.url_diagnostico;
          }
        }
      } catch(e) {}

      return createResponse({ status: 'success', data: cliente });
    }
    return createResponse({ status: 'error', message: 'Cliente no encontrado' }, 404);
  } catch(e) {
    logDebug("ERR_GET_STATUS", e.toString());
    return createResponse({ status: 'error', error: e.toString() }, 500);
  }
}

function getNextEmptyRow(sheet) {
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 0; i--) {
     if (data[i].some(cell => cell.toString().trim() !== "")) return i + 2;
  }
  return 2;
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
    
    // 1. BLINDAJE DE BÚSQUEDA: Busca por CURP o por ID (Soporta renames)
    let existingRowIndex = -1;
    const searchId = (payload.id || "").toString().toUpperCase().replace("NEW_", "").trim();
    const searchCurp = (payload.curp || "").toString().toUpperCase().trim();
    const searchClienteId = (payload.clienteId || "").toString().toUpperCase().replace("NEW_", "").trim();
    
    for (let i = 1; i < values.length; i++) {
      const rowIdRaw = values[i][idCol] ? values[i][idCol].toString().toUpperCase().replace("NEW_", "").trim() : "";
      const rowId = rowIdRaw.substring(0, 10);
      const rowCurp = values[i][curpCol] ? values[i][curpCol].toString().toUpperCase().trim() : "";
      
      // Coincidencia robusta por CURP, por ID normalized (id) o por ID de sesión (clienteId)
      if ((searchCurp && rowCurp === searchCurp) || 
          (searchId && rowId === searchId.substring(0, 10)) ||
          (searchClienteId && rowId === searchClienteId.substring(0, 10))) {
        existingRowIndex = i;
        break;
      }
    }

    const rawCurp = (payload.curp || payload.id || "").toString().replace("NEW_", "");
    const curp10 = rawCurp.substring(0, 10).toUpperCase();
    
    // 2. RECUPERAR DATOS PREVIOS PARA NO SOBREESCRIBIR CON VACÍOS (MERGE)
    let rowData = [];
    if (existingRowIndex > -1) {
      rowData = [...values[existingRowIndex]];
      while (rowData.length < 27) rowData.push(""); // A-AA
    } else {
      // Fila por defecto con 27 columnas (A-AA)
      rowData = new Array(27).fill("");
    }

    // 3. ACTUALIZACIÓN SELECTIVA (Solo si el payload trae el dato)
    const mapUpdate = (index, value) => { if (value !== undefined && value !== null) rowData[index] = value; };

    mapUpdate(idCol !== -1 ? idCol : 0, curp10);               // A: id (Forzamos realId)
    mapUpdate(1, payload.nombre);                              // B: Nombre
    mapUpdate(2, "");                                          // C: Apellidos (Mantenemos columna vacía para no desplazar)
    mapUpdate(3, payload.curp || rawCurp);                     // D: CURP
    
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
    mapUpdate(25, payload.promotor || "");                     // Z: Promotor
    
    // Lógica Inteligente de Estatus de Comisión
    let estatusComision = payload.comisionActiva;
    if (!estatusComision && payload.promotor && payload.promotor.trim() !== "") {
      estatusComision = "ACTIVA"; // Si hay promotor pero no tocaron el select, por defecto es ACTIVA
    } else if (!estatusComision) {
      estatusComision = "INACTIVA"; // Si no hay promotor ni estatus, es INACTIVA
    }
    
    mapUpdate(26, estatusComision);                            // AA: ComisionActiva
    
    // Carpeta Drive (Inteligencia de Carpetas) - Robustecida
    let folderId = (rowData[11] || payload.id_carpeta_drive || "").toString().trim();
    if (folderId.length < 5) folderId = ""; // No usar IDs basura

    if (!folderId && ROOT_FOLDER_ID && ROOT_FOLDER_ID.length > 5) {
      try {
        const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
        if (rootFolder) {
          // Buscar si ya existe una carpeta con este CURP (Ej. de Onboarding)
          const folders = rootFolder.searchFolders(`title contains '[${curp10}]'`);
          if (folders.hasNext()) {
             const folder = folders.next();
             folderId = folder.getId();
             payload.id_carpeta_drive = folderId; // ACTUALIZACIÓN PARA REUSO EN PAYLOAD
             logDebug("FOLDER_SYNC", "Carpeta encontrada en Drive: " + folderId);
          } else {
             const folderName = `[${curp10}] ${payload.nombre || "NUEVO"}`;
             const folder = rootFolder.createFolder(folderName);
             folderId = folder.getId();
             payload.id_carpeta_drive = folderId; // ACTUALIZACIÓN PARA REUSO EN PAYLOAD
             if (payload.email && payload.email.indexOf('@') > -1) {
               try { folder.addViewer(payload.email); } catch(e) {}
             }
          }
        }
      } catch(e) {
        logDebug("DRIVE_ERR", "No se pudo gestionar la carpeta Drive en ROOT: " + e.toString());
        folderId = "";
      }
    }
    
    // Fix Smart Folder Renaming - Robustecido
    if (folderId && folderId.length > 5 && payload.nombre) {
      try {
        const folder = DriveApp.getFolderById(folderId);
        if (folder && (!folder.getName().includes(curp10) || folder.getName().includes("NUEVO"))) {
           folder.setName(`[${curp10}] ${payload.nombre}`.trim());
        }
      } catch(e) {
        logDebug("RENAME_ERR", "Error al renombrar o acceder a folderId " + folderId + ": " + e.toString());
      }
    }
    mapUpdate(11, folderId);                                   // L: ID_Carpeta_Drive
    
    // PROCESAR DOCUMENTOS ENVIADOS DESDE FRONTEND (Si existen)
    if (payload.documentos && Array.isArray(payload.documentos) && folderId && folderId.length > 5) {
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
    mapUpdate(16, payload.estadoAuditoria || rowData[16] || "PENDIENTE_ENTREVISTA"); // Q: Estado Auditoría
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
      const nextRow = getNextEmptyRow(sheet);
      sheet.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);
    }

    return createResponse({ success: true, id: curp10, id_carpeta_drive: folderId });
  } catch(e) {
    logDebug("CREATE_CLIENTE_FATAL", e.toString());
    return createResponse({ status: 'error', error: e.toString() }, 500);
  } finally {
    lock.releaseLock();
  }
}

function handleCreateHoja(payload) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch(e) { return createResponse({ status: 'error', message: 'Sistema de persistencia ocupado' }, 429); }
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const rawId = (payload.clienteId || payload.id || "").toString().toUpperCase().replace("NEW_", "").trim();
    const curp10 = rawId.substring(0, 10).toUpperCase();

    if (!curp10) return createResponse({ status: 'error', message: 'ID Inválido' }, 400);

    // Ruteo U1/U2
    const u2Services = ['Modalidad 40', 'PTI', 'Modalidad 10', 'Continuidad Voluntaria'];
    const serviciosStr = (payload.dictamen || "") + (payload.serviciosStr || "") + (Array.isArray(payload.servicios) ? payload.servicios.join(", ") : (payload.servicios || ""));
    const isU2 = u2Services.some(s => serviciosStr.includes(s)) || payload.universo === 'U2';

    const sheet = ss.getSheetByName(isU2 ? "GESTIONES_U2" : "HOJAS_SERVICIO") || ss.insertSheet(isU2 ? "GESTIONES_U2" : "HOJAS_SERVICIO");
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    
    // Buscar índice de ID_Cliente
    const idColIdx = headers.indexOf("id_cliente") !== -1 ? headers.indexOf("id_cliente") : headers.indexOf("clienteid");
    
    let targetRow = -1;
    for (let i = 1; i < data.length; i++) {
        if (data[i][idColIdx] && data[i][idColIdx].toString().toUpperCase().trim() === curp10) {
            targetRow = i + 1;
            break;
        }
    }
    
    if (targetRow === -1) targetRow = getNextEmptyRow(sheet);

    const mapping = {};
    const map = (name, val) => { const idx = headers.indexOf(name.toLowerCase()); if (idx !== -1) mapping[idx + 1] = val; };
    
    map("ID_Hoja", payload.id_hoja || Utilities.getUuid().substring(0,8));
    map("ID_Cliente", curp10);
    map("Servicios", Array.isArray(payload.servicios) ? payload.servicios.join(", ") : (payload.servicios || ""));
    map("Monto", payload.montoAcordado || payload.monto || 0);
    map("Diagnostico", payload.dictamen || payload.diagnosticoTexto || "");
    map("Status", "ACTIVO");
    map("Fecha", new Date().toISOString());
    map("Asesor", payload.asesor || "");
    map("FirmaAsesor", payload.firmaAsesor || "");
    if (payload.diagnostico_url) map("URL_Diagnostico", payload.diagnostico_url);
    if (payload.contrato_url) map("URL_Contrato", payload.contrato_url);

    for (let col in mapping) sheet.getRange(targetRow, Number(col)).setValue(mapping[col]);

    return createResponse({ success: true });
  } catch(e) {
    logDebug("ERR_CREATE_HOJA", e.toString());
    return createResponse({ status: 'error', message: e.toString() }, 500);
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

function parseNumeric(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  let clean = val.toString().replace(/,/g, '.').replace(/[^\d.-]/g, '');
  return parseFloat(clean) || 0;
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
    const selfieFile = folder.createFile(selfieBlob);
    const selfieUrl = selfieFile.getUrl();
    selfieFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    // Columna I es la posición 8 (9na columna)
    sheet.getRange(existingRowIndex > -1 ? existingRowIndex + 1 : sheet.getLastRow(), 9).setValue(selfieUrl);
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
     Utilities.sleep(3000);
     
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

function handleRecordPayment(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetU2 = ss.getSheetByName("GESTIONES_U2");
  if (!sheetU2) return createResponse({ success: false, error: "Hoja GESTIONES_U2 no encontrada" }, 404);

  const dataU2 = sheetU2.getDataRange().getValues();
  const headersU2 = dataU2[0].map(h => h.toString().toLowerCase().trim());
  const clienteIdCol = headersU2.indexOf("clienteid");
  const mesCol = headersU2.indexOf("mes");
  const estatusCol = headersU2.indexOf("estatus");
  const recibidoCol = headersU2.indexOf("recibido");
  const updatedAtCol = headersU2.indexOf("updatedat");

  const searchId = (payload.clienteId || payload.id || "").toString().toUpperCase();
  const currentMonth = new Date().toLocaleString('es-MX', {month: 'long', year: 'numeric'});

  logDebug("RECORD_PAYMENT", "Registrando pago para: " + searchId + " en mes: " + currentMonth);

  let rowIndexU2 = -1;
  for (let i = 1; i < dataU2.length; i++) {
    const rowId = dataU2[i][clienteIdCol] ? dataU2[i][clienteIdCol].toString().toUpperCase() : "";
    const rowMes = dataU2[i][mesCol] ? dataU2[i][mesCol].toString().toLowerCase() : "";
    if (rowId === searchId && (rowMes.includes(currentMonth.split(' ')[0].toLowerCase()) || rowMes === currentMonth.toLowerCase())) {
      rowIndexU2 = i;
      break;
    }
  }

  if (rowIndexU2 > -1) {
    if (recibidoCol !== -1) sheetU2.getRange(rowIndexU2 + 1, recibidoCol + 1).setValue(1);
    if (estatusCol !== -1) sheetU2.getRange(rowIndexU2 + 1, estatusCol + 1).setValue("PAGADO");
    if (updatedAtCol !== -1) sheetU2.getRange(rowIndexU2 + 1, updatedAtCol + 1).setValue(new Date().toISOString());
  } 

  const sheetClientes = ss.getSheetByName("CLIENTES");
  const dataClientes = sheetClientes.getDataRange().getValues();
  const headersClientes = dataClientes[0].map(h => h.toString().toLowerCase().trim());
  const idColClientes = headersClientes.indexOf("id");
  const curpColClientes = headersClientes.indexOf("curp");
  const auditoriaCol = headersClientes.indexOf("estadoauditoria");

  let clienteRowIndex = -1;
  for (let i = 1; i < dataClientes.length; i++) {
    const rowId = dataClientes[i][idColClientes] ? dataClientes[i][idColClientes].toString().toUpperCase() : "";
    const rowCurp = dataClientes[i][curpColClientes] ? dataClientes[i][curpColClientes].toString().toUpperCase() : "";
    if (rowId === searchId || rowCurp === searchId) {
      clienteRowIndex = i;
      break;
    }
  }

  if (clienteRowIndex > -1 && auditoriaCol > -1) {
    sheetClientes.getRange(clienteRowIndex + 1, auditoriaCol + 1).setValue("SERVICIO_ACTIVO");
  }

  return createResponse({ success: true });
}

function forzarPermisosReales() {
  // Forzamos al motor a tocar la API de Docs con un documento real
  var doc = DocumentApp.openById("12GVFwA_zkRs4olXQaF2sL5E6Tw6em7ne19tw3y6vHL0");
  console.log("Permiso concedido para: " + doc.getName());
}

function handleRpaUpload(payload) {
  try {
    const fileName = payload.fileName;
    if (!fileName) return createResponse({ error: "Falta fileName" }, 400);
    
    // Extraer ID del inicio del nombre "ID_LC_..." -> "ID"
    const parts = fileName.split('_');
    const clientId = parts[0].toUpperCase().trim();
    
    // Determinar tipo
    let tipoSubcarpeta = "";
    if (fileName.includes("LC")) tipoSubcarpeta = "_LC";
    else if (fileName.includes("CI")) tipoSubcarpeta = "_CI";
    else return createResponse({ error: "El archivo no contiene LC o CI en el nombre" }, 400);
    
    const targetSubfolderName = clientId + tipoSubcarpeta;
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetClientes = ss.getSheetByName("CLIENTES");
    const data = sheetClientes.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    
    const idCol = headers.indexOf("id");
    const curpCol = headers.indexOf("curp");
    let folderCol = headers.indexOf("id_carpeta_drive");
    if (folderCol === -1) folderCol = headers.indexOf("idcarpetadrive");
    
    if (idCol === -1 || folderCol === -1) return createResponse({ error: "Columnas requeridas no encontradas" }, 500);
    
    let folderId = null;
    for (let i = 1; i < data.length; i++) {
      const matchId = data[i][idCol] ? data[i][idCol].toString().toUpperCase().trim() : "";
      const matchCurp = data[i][curpCol] ? data[i][curpCol].toString().toUpperCase().trim() : "";
      if (clientId === matchId || clientId === matchCurp) {
        folderId = data[i][folderCol];
        break;
      }
    }
    
    if (!folderId) return createResponse({ error: "Carpeta no encontrada para ID " + clientId }, 404);
    
    const clientFolder = DriveApp.getFolderById(folderId);
    let targetFolder = null;
    
    const subfolders = clientFolder.getFolders();
    while (subfolders.hasNext()) {
      const sub = subfolders.next();
      if (sub.getName() === targetSubfolderName) {
        targetFolder = sub;
        break;
      }
    }
    
    if (!targetFolder) {
      targetFolder = clientFolder.createFolder(targetSubfolderName);
    }
    
    const base64Data = payload.fileData.split(',')[1] || payload.fileData;
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), "application/pdf", fileName);
    
    targetFolder.createFile(blob);
    
    return createResponse({ success: true, fileName: fileName, message: "Guardado en " + targetSubfolderName });
  } catch(e) {
    return createResponse({ error: e.toString() }, 500);
  }
}

function handlePayCommission(payload) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) {}
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName("COMISIONES_PAGADAS");
    if (!sheet) {
      sheet = ss.insertSheet("COMISIONES_PAGADAS");
      sheet.appendRow(["ID_Pago", "ID_Asesor", "Tipo", "Monto", "Mes", "Fecha_Pago"]);
    }
    
    sheet.appendRow([
      Utilities.getUuid(),
      payload.asesorId || payload.asesor || "Desconocido",
      payload.tipo || "COMISION",
      payload.monto || 0,
      payload.mes || new Date().toLocaleString('es-MX', {month: 'long', year: 'numeric'}),
      new Date().toISOString()
    ]);
    
    return createResponse({ success: true });
  } finally {
    lock.releaseLock();
  }
}