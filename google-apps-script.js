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
    
    const searchId = (payload.id || "").toString().toUpperCase().trim();
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
          const selfieFile = folder.createFile(selfieBlob);
          const selfieUrl = selfieFile.getUrl();
          selfieFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          
          // Buscar columna SelfieURL (Columna I)
          const selfieColIndex = headers.indexOf("selfieurl");
          if (selfieColIndex !== -1) {
            sheet.getRange(rowIndex + 1, selfieColIndex + 1).setValue(selfieUrl);
          }
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
             Utilities.sleep(3000);
             
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
  // Asegurar que searchId sea CURP10
  const rawId = (payload.curp || payload.id || payload.clienteId || "").toString().replace("NEW_", "");
  const searchId = rawId.substring(0, 10).toUpperCase();
  
  if (!payload.id) payload.id = searchId;
  payload.id_cliente = searchId;

  // 1. Actualizamos el registro del cliente
  try {
    handleCreateCliente(payload);
  } catch(e) { logDebug("ERR_CLIENTE_UPDATE", e.toString()); }
  
  // 2. Registramos formalmente la hoja de servicio (UPSERT)
  try {
    handleCreateHoja(payload);
  } catch(e) { logDebug("ERR_HOJA_CREATION", e.toString()); }

  // 3. GENERACIÓN DE DOCUMENTOS (Blindada con try/catch independientes)
  try {
    const clientes = getSheetData("CLIENTES");
    const searchIdClean = searchId.substring(0, 10).toUpperCase();
    const cliente = clientes.find(c => (c.curp && c.curp.toString().substring(0,10).toUpperCase() === searchIdClean) || (c.id && c.id.toString().toUpperCase() === searchIdClean));
    
    if (cliente) {
      const folderId = cliente.id_carpeta_drive || cliente.idcarpetadrive;
      let folder;
      try {
        if (folderId) folder = DriveApp.getFolderById(folderId);
      } catch(e) { logDebug("FOLDER_BY_ID_FAIL", "ID inválido: " + folderId); }

      if (!folder) {
        // Fallback: Buscar por nombre según requerimiento 'CLIENTE_' + curp10
        const folderName = "CLIENTE_" + searchIdClean;
        const folders = DriveApp.getFoldersByName(folderName);
        if (folders.hasNext()) {
          folder = folders.next();
        } else {
          // Intento Alternativo: Buscar por el formato [CURP10]
          const altFolders = DriveApp.getFoldersByName(`[${searchIdClean}]`);
          if (altFolders.hasNext()) folder = altFolders.next();
        }
      }

      if (folder) {
        let finalContratoUrl = "";
        let finalDiagUrl = "";
        
        // --- CLONAR CONTRATO MARCO ---
        if (payload.tipoDocEval && payload.tipoDocEval.includes('CONTRATO')) {
          try {
            const templateDoc = DriveApp.getFileById(CONTRATO_TEMPLATE_ID);
            const newDocFile = templateDoc.makeCopy("CONTRATO_MARCO_" + searchIdClean, folder);
            if (newDocFile) {
              const doc = DocumentApp.openById(newDocFile.getId());
              const body = doc.getBody();
              body.replaceText("{{nombre_cliente}}", cliente.nombre || "");
              body.replaceText("{{NOMBRE_CLIENTE}}", cliente.nombre || "");
              body.replaceText("{{CURP}}", cliente.curp || "");
              body.replaceText("{{FECHA}}", new Date().toLocaleDateString('es-MX'));
              body.replaceText("{{NSS}}", cliente.nss || "");
              body.replaceText("{{DOMICILIO}}", cliente.domicilio || cliente.domicilioextraido || "");
              
              replaceTextWithImage(body, "{{firma_cliente}}", payload.firmaBase64, "image/png", 220, 110);
              replaceTextWithImage(body, "{{selfie}}", payload.selfieBase64, "image/jpeg", 140, 140);
              replaceTextWithImage(body, "{{IMAGEN_FIRMA}}", payload.firmaBase64, "image/png", 200, 100);
              replaceTextWithImage(body, "{{IMAGEN_SELFIE}}", payload.selfieBase64, "image/jpeg", 150, 150);
              
              doc.saveAndClose();
              Utilities.sleep(2000);
              const pdfFile = folder.createFile(newDocFile.getAs('application/pdf')).setName(`CONTRATO_MARCO_${searchIdClean}.pdf`);
              pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
              finalContratoUrl = pdfFile.getUrl();
              
              // LIMPIEZA DRIVE: Trashed temporal
              newDocFile.setTrashed(true);
            }
          } catch(e) {
            logDebug("ERR_CLONE_CONTRATO", e.toString());
          }
        }

        // --- CLONAR/GENERAR DIAGNOSTICO ---
        try {
          if (DIAGNOSTICO_TEMPLATE_ID && !DIAGNOSTICO_TEMPLATE_ID.includes("placeholder")) {
            const diagTemplateDoc = DriveApp.getFileById(DIAGNOSTICO_TEMPLATE_ID);
            const newDiagFile = diagTemplateDoc.makeCopy("DIAGNOSTICO_CERTIFICADO_" + searchIdClean, folder);
            if (newDiagFile) {
              const doc = DocumentApp.openById(newDiagFile.getId());
              const body = doc.getBody();
              body.replaceText("{{nombre_cliente}}", cliente.nombre || "");
              body.replaceText("{{NOMBRE_CLIENTE}}", cliente.nombre || "");
              body.replaceText("{{CURP}}", cliente.curp || "");
              doc.saveAndClose();
              Utilities.sleep(2000);
              
              const pdfFile = folder.createFile(newDiagFile.getAs('application/pdf')).setName(`DIAGNOSTICO_CERTIFICADO_${searchIdClean}.pdf`);
              pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
              finalDiagUrl = pdfFile.getUrl();
              
              newDiagFile.setTrashed(true);
            }
          } else {
             // Modificado para retornar URL de PDF y auto-limpiar
             finalDiagUrl = generateDiagnosticPDF(cliente, payload.servicios, payload.montoAcordado || payload.monto || payload.honorariosAcordados, payload.asesor, payload.firmaAsesor, payload.id_hoja, payload.montoU2);
          }
        } catch(e) {
          logDebug("ERR_CLONE_DIAGNOSTICO", e.toString());
        }


        // C. AUTO-SELLADO (Solo si tenemos URL de documento y es recurrente)
        if (finalDiagUrl && (payload.tipoDocEval === 'DIAGNOSTICO' || !payload.tipoDocEval)) {
          try {
            let prevFirma = null;
            let prevSelfie = null;
            const filesDrive = folder.getFiles();
            while (filesDrive.hasNext()) {
              const df = filesDrive.next();
              const dName = df.getName().toUpperCase();
              if (dName.includes("FIRMA_ONB") || dName.includes("FIRMA_CLIENTE")) prevFirma = df.getBlob();
              if (dName.includes("SELFIE")) prevSelfie = df.getBlob();
            }

            if (prevFirma && prevSelfie && finalDiagUrl.includes("/d/")) {
               const diagId = finalDiagUrl.split('/d/')[1].split('/')[0];
               const docFile = DriveApp.getFileById(diagId);
               if (docFile.getMimeType() === MimeType.GOOGLE_DOCS) {
                  const doc = DocumentApp.openById(diagId);
                  const body = doc.getBody();
                  body.replaceText("{{FECHA_FIRMA}}", new Date().toLocaleString('es-MX'));
                  body.replaceText("{{ID_TRANSACCION}}", "AUTO-" + Utilities.getUuid().substring(0, 8).toUpperCase());
                  replaceTextWithImageBlob(body, "{{firma_cliente}}", prevFirma, 220, 110);
                  replaceTextWithImageBlob(body, "{{selfie}}", prevSelfie, 140, 140);
                  doc.saveAndClose();
                  Utilities.sleep(3000);
                  const pdfBlob = docFile.getAs('application/pdf');
                  const pdfFile = folder.createFile(pdfBlob).setName(docFile.getName() + "_FIRMADO.pdf");
                  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
                  finalDiagUrl = pdfFile.getUrl();
                  docFile.setTrashed(true);
               }
            }
          } catch(e) { logDebug("ERR_AUTO_SEALING", e.toString()); }
        }
        
        // D. PERSISTENCIA EN CLIENTES Y HOJAS
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const sheetClientes = ss.getSheetByName("CLIENTES");
        if (sheetClientes) {
          const cDataArr = sheetClientes.getDataRange().getValues();
          const cHeadersArr = cDataArr[0].map(h => h.toString().toLowerCase().trim());
          const cidColIdx = cHeadersArr.indexOf("id");
          const cContratoIdx = cHeadersArr.indexOf("contrato_url");
          const cDiagIdx = cHeadersArr.indexOf("url_diagnostico");
          const audColIdx = cHeadersArr.indexOf("estadoauditoria") !== -1 ? cHeadersArr.indexOf("estadoauditoria") : cHeadersArr.indexOf("estado auditoría");

          for (let i = 1; i < cDataArr.length; i++) {
            const rowIdVal = cDataArr[i][cidColIdx] ? cDataArr[i][cidColIdx].toString().toUpperCase().trim() : "";
            if (rowIdVal === searchId.toUpperCase().trim()) {
              if (finalContratoUrl && cContratoIdx !== -1) sheetClientes.getRange(i+1, cContratoIdx + 1).setValue(finalContratoUrl);
              if (finalDiagUrl && cDiagIdx !== -1) sheetClientes.getRange(i+1, cDiagIdx + 1).setValue(finalDiagUrl);
              if (audColIdx !== -1) sheetClientes.getRange(i+1, audColIdx + 1).setValue("AUDITORIA_FINALIZADA");
              break;
            }
          }
        }

        if (finalDiagUrl && payload.id_hoja) {
          const isU2 = payload.universo === 'U2' || (payload.serviciosU2 && payload.montoU2 > 0);
          let sheetH = ss.getSheetByName(isU2 ? "GESTIONES_U2" : "HOJAS_SERVICIO");
          if (sheetH) {
            const dH = sheetH.getDataRange().getValues(); 
            const headersH = dH[0].map(h => h.toString().toLowerCase().trim());
            const idCol = headersH.indexOf("id_hoja") !== -1 ? headersH.indexOf("id_hoja") : headersH.indexOf("id");
            let uCol = headersH.indexOf("url_diagnostico");
            if (uCol === -1) uCol = headersH.indexOf("firmaurl");
            for (let i = 1; i < dH.length; i++) { 
              if (dH[i][idCol] && dH[i][idCol].toString().toUpperCase().trim() === payload.id_hoja.toString().toUpperCase().trim()) { 
                sheetH.getRange(i + 1, uCol + 1).setValue(finalDiagUrl); 
                break; 
              } 
            }
          }
        }
      }
    }
  } catch(e) { logDebug("ERR_DOC_GEN_MAIN", e.toString()); }

  return createResponse({ success: true });
}

function generateDiagnosticPDF(clientData, servicesData, montoTotal, asesorName, firmaAsesorBase64, idHoja, montoU2) {
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
    Utilities.sleep(2000);
    
    // CONVERSIÓN A PDF Y TRASH DEL DOC
    const docFile = DriveApp.getFileById(doc.getId());
    const pdfBlob = docFile.getAs('application/pdf');
    const finalPdf = folder.createFile(pdfBlob).setName(`DIAGNOSTICO_CERTIFICADO_${clientData.curp}_${suffix}.pdf`);
    finalPdf.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    docFile.setTrashed(true);
    return finalPdf.getUrl();
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
    const identifierUpper = identifier.toString().toUpperCase().trim();
    const cliente = clientes.find(c => 
      (c.id && c.id.toString().toUpperCase().trim() === identifierUpper) || 
      (c.curp && c.curp.toString().toUpperCase().trim() === identifierUpper)
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
            if (name.startsWith("CONTRATO_MARCO")) cliente.contrato_url = url;
            if (name.startsWith("DIAGNOSTICO_CERTIFICADO")) cliente.diagnostico_url = url;
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
          if (hoja.url_diagnostico) cliente.diagnostico_url = hoja.url_diagnostico;
        }
      } catch(e) {}

      return createResponse({ status: 'success', data: cliente });
    }
    return createResponse({ status: 'error', message: 'No encontrado' }, 404);
  } catch(e) {
    return createResponse({ status: 'error', error: e.toString() }, 500);
  }
}

function getNextEmptyRow(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) return 1;
  const colA = sheet.getRange(1, 1, lastRow + 10, 1).getValues();
  for (let i = 0; i < colA.length; i++) {
    if (!colA[i][0]) return i + 1;
  }
  return lastRow + 1;
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
             logDebug("FOLDER_SYNC", "Carpeta encontrada en Drive: " + folderId);
          } else {
             const folderName = `[${curp10}] ${payload.nombre || "NUEVO"}`;
             const folder = rootFolder.createFolder(folderName);
             folderId = folder.getId();
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
        if (folder && folder.getName().includes("NUEVO")) {
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
      sheet.appendRow(rowData);
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
  try { lock.waitLock(10000); } catch(e) {}
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const searchHojaId = (payload.id_hoja || Utilities.getUuid()).toString().toUpperCase().trim();
    const rawCid = (payload.clienteId || payload.id || "").toString().replace("NEW_", "");
    const searchClienteId = rawCid.substring(0, 10).toUpperCase();

    let isMigracion = (payload.origen && (payload.origen.toLowerCase().includes('socio') || payload.origen.toLowerCase().includes('migra'))) || payload.esMigracion || payload.isMigracion;
    let tienePromotor = (payload.promotor && payload.promotor.trim() !== '') ? true : false;
    let folderId = payload.id_carpeta_drive;

    try {
      const clientesSheet = ss.getSheetByName("CLIENTES");
      if (clientesSheet) {
        const cData = clientesSheet.getDataRange().getValues();
        const cHeaders = cData[0].map(h => h.toString().toLowerCase().trim());
        const cIdCol = cHeaders.indexOf("id");
        const cCurpCol = cHeaders.indexOf("curp");
        const cOrigenCol = cHeaders.indexOf("origen");
        const cPromotorCol = cHeaders.indexOf("promotor");
        const cFolderCol = cHeaders.indexOf("id_carpeta_drive") !== -1 ? cHeaders.indexOf("id_carpeta_drive") : cHeaders.indexOf("idcarpetadrive");
        
        for(let i=1; i<cData.length; i++) {
          const id = cData[i][cIdCol] ? cData[i][cIdCol].toString().toUpperCase().trim() : "";
          const curp = cData[i][cCurpCol] ? cData[i][cCurpCol].toString().toUpperCase().trim() : "";
          if (searchClienteId !== "" && (id === searchClienteId || curp === searchClienteId)) {
            if (!isMigracion && cOrigenCol !== -1 && cData[i][cOrigenCol] && cData[i][cOrigenCol].toString().toLowerCase().includes('socio')) isMigracion = true;
            if (!tienePromotor && cPromotorCol !== -1 && cData[i][cPromotorCol] && cData[i][cPromotorCol].toString().trim() !== '') tienePromotor = true;
            if (!folderId && cFolderCol !== -1) folderId = cData[i][cFolderCol];
            break;
          }
        }
      }
    } catch(e) {}
    
    let montoTotal = parseFloat(payload.montoAcordado || payload.honorariosAcordados || payload.monto || 0);
    
    // RUTEO INTELIGENTE DE UNIVERSO (Directiva: 'Modalidad 40' o 'PTI' -> U2)
    const serviciosGlobalStr = (payload.serviciosU1 || "") + (payload.serviciosU2 || "") + (Array.isArray(payload.servicios) ? payload.servicios.join(", ") : (payload.servicios || ""));
    const forceU2 = serviciosGlobalStr.includes('Modalidad 40') || serviciosGlobalStr.includes('PTI') || serviciosGlobalStr.includes('Modalidad 10');
    const hasU2 = forceU2 || payload.universo === 'U2' || (payload.serviciosU2 && payload.montoU2 > 0);

    // Inteligencia de Carpetas (Subcarpetas U2)
    if (hasU2 && folderId) {
      try {
        const folder = DriveApp.getFolderById(folderId);
        const nameLC = `${searchClienteId}_LC`;
        const nameCI = `${searchClienteId}_CI`;
        const folders = folder.getFolders();
        let hasLC = false, hasCI = false;
        while(folders.hasNext()) {
          let f = folders.next();
          if (f.getName() === nameLC) hasLC = true;
          if (f.getName() === nameCI) hasCI = true;
        }
        if (!hasLC) folder.createFolder(nameLC);
        if (!hasCI) folder.createFolder(nameCI);
      } catch(e) {}
    }

    const getOrInitSheet = (sheetName, isU2Sheet) => {
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        if (isU2Sheet) sheet.appendRow(["ID", "ClienteID", "Mes", "Estatus", "Recibido", "IMSS", "Honorarios", "ComprobanteIMSS", "FacturaHonorarios", "UpdatedAt", "Servicios_U2", "URL_Diagnostico", "Subtotal", "IVA_Absorbido", "IVA_Cobrado", "Pago_Promotor", "Utilidad_Bruta"]);
        else sheet.appendRow(["ID_Hoja", "ID_Cliente", "Universo", "Servicios", "Monto", "Diagnostico", "Status", "Fecha", "Asesor", "FirmaAsesor", "NotasExtra", "URL_Diagnostico", "Subtotal", "IVA_Absorbido", "IVA_Cobrado", "Pago_Promotor", "Utilidad_Bruta"]);
      }
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => h.toString().toLowerCase().trim());
      const colsToAdd = ["url_diagnostico", "subtotal", "iva_absorbido", "iva_cobrado", "pago_promotor", "utilidad_bruta"];
      const exactNames = ["URL_Diagnostico", "Subtotal", "IVA_Absorbido", "IVA_Cobrado", "Pago_Promotor", "Utilidad_Bruta"];
      colsToAdd.forEach((col, idx) => {
        if (headers.indexOf(col) === -1) { headers.push(col); sheet.getRange(1, headers.length).setValue(exactNames[idx]); }
      });
      return { sheet, headers, data };
    };

    const mapVal = (headers, rowData, colName, val) => {
      let idx = headers.indexOf(colName.toLowerCase());
      if (idx !== -1) rowData[idx] = val;
    };

    // PARTE 1: HOJAS_SERVICIO (UPSERT por ClienteID y Universo)
    let serviciosU1Str = payload.serviciosU1 || (Array.isArray(payload.servicios) ? payload.servicios.join(", ") : (payload.servicios || ""));
    let montoU1 = parseFloat(payload.monto1 || payload.montoU1 || payload.monto || 0);

    const sheetU1Obj = getOrInitSheet("HOJAS_SERVICIO", false);
    const idClienteColIdx = sheetU1Obj.headers.indexOf("id_cliente");
    const universoColIdx = sheetU1Obj.headers.indexOf("universo");

    let rowIndexU1 = -1;
    for (let i = 1; i < sheetU1Obj.data.length; i++) {
        const rowCid = sheetU1Obj.data[i][idClienteColIdx] ? sheetU1Obj.data[i][idClienteColIdx].toString().toUpperCase().trim() : "";
        const rowUniv = sheetU1Obj.data[i][universoColIdx] ? sheetU1Obj.data[i][universoColIdx].toString().toUpperCase().trim() : "";
        const targetUniv = (payload.universo || (hasU2 ? "U1/U2" : "U1")).toUpperCase();
        
        if (rowCid === searchClienteId && rowUniv === targetUniv) {
            rowIndexU1 = i; break;
        }
    }

    const rowDataU1 = rowIndexU1 > -1 ? [...sheetU1Obj.data[rowIndexU1]] : new Array(sheetU1Obj.headers.length).fill("");
    while(rowDataU1.length < sheetU1Obj.headers.length) rowDataU1.push("");

    mapVal(sheetU1Obj.headers, rowDataU1, "id_hoja", rowIndexU1 > -1 ? rowDataU1[sheetU1Obj.headers.indexOf("id_hoja")] : searchHojaId);
    mapVal(sheetU1Obj.headers, rowDataU1, "id_cliente", searchClienteId);
    mapVal(sheetU1Obj.headers, rowDataU1, "universo", payload.universo || (hasU2 ? "U1/U2" : "U1"));
    mapVal(sheetU1Obj.headers, rowDataU1, "servicios", serviciosU1Str);
    mapVal(sheetU1Obj.headers, rowDataU1, "monto", montoU1);
    mapVal(sheetU1Obj.headers, rowDataU1, "diagnostico", payload.notasDiagnostico || payload.dictamen || "");
    mapVal(sheetU1Obj.headers, rowDataU1, "status", "ACTIVO");
    mapVal(sheetU1Obj.headers, rowDataU1, "fecha", payload.createdAt || new Date().toISOString());
    mapVal(sheetU1Obj.headers, rowDataU1, "asesor", payload.asesor || "");
    mapVal(sheetU1Obj.headers, rowDataU1, "firmaasesor", payload.firmaAsesor || "");
    mapVal(sheetU1Obj.headers, rowDataU1, "notasextra", payload.notasExtra || "");
    mapVal(sheetU1Obj.headers, rowDataU1, "url_diagnostico", payload.url_diagnostico || rowDataU1[sheetU1Obj.headers.indexOf("url_diagnostico")] || "");

    let subU1 = montoU1 / 1.16;
    mapVal(sheetU1Obj.headers, rowDataU1, "subtotal", subU1);
    mapVal(sheetU1Obj.headers, rowDataU1, "iva_absorbido", 0);
    mapVal(sheetU1Obj.headers, rowDataU1, "iva_cobrado", montoU1 - subU1);
    mapVal(sheetU1Obj.headers, rowDataU1, "pago_promotor", 0);
    mapVal(sheetU1Obj.headers, rowDataU1, "utilidad_bruta", subU1);

    if (rowIndexU1 > -1) sheetU1Obj.sheet.getRange(rowIndexU1 + 1, 1, 1, rowDataU1.length).setValues([rowDataU1]);
    else {
      const nextRow = getNextEmptyRow(sheetU1Obj.sheet);
      sheetU1Obj.sheet.getRange(nextRow, 1, 1, rowDataU1.length).setValues([rowDataU1]);
    }


    // PARTE 2: GESTIONES_U2 (UPSERT por ClienteID y Mes)
    if (hasU2) {
      const sheetU2Obj = getOrInitSheet("GESTIONES_U2", true);
      const clienteIdColU2 = sheetU2Obj.headers.indexOf("clienteid");
      const mesColU2 = sheetU2Obj.headers.indexOf("mes");
      const currentMonth = new Date().toLocaleString('es-MX', {month: 'long', year: 'numeric'});

      let rowIndexU2 = -1;
      for (let i = 1; i < sheetU2Obj.data.length; i++) {
        const rowCid = sheetU2Obj.data[i][clienteIdColU2] ? sheetU2Obj.data[i][clienteIdColU2].toString().toUpperCase().trim() : "";
        const rowMes = sheetU2Obj.data[i][mesColU2] ? sheetU2Obj.data[i][mesColU2].toString().toLowerCase().trim() : "";
        if (rowCid === searchClienteId && (rowMes === currentMonth.toLowerCase() || rowMes.includes(currentMonth.split(' ')[0].toLowerCase()))) {
          rowIndexU2 = i; break;
        }
      }

      const rowDataU2 = rowIndexU2 > -1 ? [...sheetU2Obj.data[rowIndexU2]] : new Array(sheetU2Obj.headers.length).fill("");
      while(rowDataU2.length < sheetU2Obj.headers.length) rowDataU2.push("");

      let montoU2 = parseFloat(payload.montoU2 || payload.monto || 0);

      // MOTOR MATEMÁTICO U2
      let honorariosFijos = 0; // Reset a 0 por directiva
      let cuotaIMSS = 0;
      let subU2 = 0, ivaAbsorbidoU2 = 0, ivaCobradoU2 = 0, pagoPromotorU2 = 0, utilidadBrutaU2 = 0;

      if (isMigracion) {
          cuotaIMSS = montoU2 - honorariosFijos;
          if (cuotaIMSS < 0) cuotaIMSS = 0;
          subU2 = honorariosFijos / 1.16;
          ivaAbsorbidoU2 = honorariosFijos - subU2;
          ivaCobradoU2 = 0;
          pagoPromotorU2 = tienePromotor ? 100 : 0;
          utilidadBrutaU2 = honorariosFijos - ivaAbsorbidoU2 - pagoPromotorU2;
      } else {
          let honorariosConIva = honorariosFijos * 1.16; 
          cuotaIMSS = montoU2 - honorariosConIva;
          if (cuotaIMSS < 0) cuotaIMSS = 0;
          subU2 = honorariosFijos;
          ivaAbsorbidoU2 = 0;
          ivaCobradoU2 = honorariosFijos * 0.16;
          pagoPromotorU2 = 0;
          utilidadBrutaU2 = honorariosFijos;
      }

      mapVal(sheetU2Obj.headers, rowDataU2, "id", searchHojaId);
      mapVal(sheetU2Obj.headers, rowDataU2, "clienteid", searchClienteId);
      mapVal(sheetU2Obj.headers, rowDataU2, "mes", new Date().toLocaleString('es-MX', {month: 'long', year: 'numeric'}));
      mapVal(sheetU2Obj.headers, rowDataU2, "estatus", rowDataU2[sheetU2Obj.headers.indexOf("estatus")] || "ACTIVO");
      mapVal(sheetU2Obj.headers, rowDataU2, "recibido", rowDataU2[sheetU2Obj.headers.indexOf("recibido")] || 0);
      mapVal(sheetU2Obj.headers, rowDataU2, "imss", cuotaIMSS);
      // Honorarios U2: En GESTIONES_U2, el campo Honorarios (Columna G) debe ser 0 o vacío por defecto
      mapVal(sheetU2Obj.headers, rowDataU2, "honorarios", 0);
      mapVal(sheetU2Obj.headers, rowDataU2, "updatedat", new Date().toISOString());
      mapVal(sheetU2Obj.headers, rowDataU2, "servicios_u2", payload.serviciosU2 || payload.servicios || "");
      mapVal(sheetU2Obj.headers, rowDataU2, "url_diagnostico", payload.url_diagnostico || rowDataU2[sheetU2Obj.headers.indexOf("url_diagnostico")] || "");
      mapVal(sheetU2Obj.headers, rowDataU2, "subtotal", subU2);
      mapVal(sheetU2Obj.headers, rowDataU2, "iva_absorbido", ivaAbsorbidoU2);
      mapVal(sheetU2Obj.headers, rowDataU2, "iva_cobrado", ivaCobradoU2);
      mapVal(sheetU2Obj.headers, rowDataU2, "pago_promotor", pagoPromotorU2);
      mapVal(sheetU2Obj.headers, rowDataU2, "utilidad_bruta", utilidadBrutaU2);

      if (rowIndexU2 > -1) sheetU2Obj.sheet.getRange(rowIndexU2 + 1, 1, 1, rowDataU2.length).setValues([rowDataU2]);
      else {
        const nextRowU2 = getNextEmptyRow(sheetU2Obj.sheet);
        sheetU2Obj.sheet.getRange(nextRowU2, 1, 1, rowDataU2.length).setValues([rowDataU2]);
      }
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