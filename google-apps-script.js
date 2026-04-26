const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const ROOT_FOLDER_ID = "1xzILR2Afad-feJ-CHAkNiCHjHwLocvhX"; 

function logDebug(tag, message) {
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

  // 1. Guardar archivos en Drive
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

  // 3. SELLAR DOCUMENTOS CON FIRMA Y SELFIE (Fusión Final)
  const signedDocUrls = [];
  const signatureTimestamp = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
  const transactionId = Utilities.getUuid().substring(0, 8).toUpperCase();

  if (folderId) {
    try {
      const folder = DriveApp.getFolderById(folderId);
      const files = folder.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        const fileName = file.getName();
        
        const targetDocs = ["CONTRATO_PERSONALIZADO", "DIAGNOSTICO_CERTIFICADO"];
        let shouldProcess = false;
        targetDocs.forEach(td => { if (fileName.includes(td)) shouldProcess = true; });
        
        if (shouldProcess && file.getMimeType() === MimeType.GOOGLE_DOCS) {
           logDebug("FUSING_DOC", fileName + " with ID: " + transactionId);
           
           // SOLUCIÓN DEFINITIVA PRIVILEGIOS: Elevamos permiso a EDIT explícitamente antes de abrir
           try {
             file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
           } catch(shareErr) {
             logDebug("SHARE_ELEVATE_WARNING", shareErr.toString());
           }

           try {
             const doc = DocumentApp.openById(file.getId());
             const body = doc.getBody();
             
             // Actualización de Metadatos de Firma en el documento
             body.replaceText("{{FECHA_FIRMA}}", signatureTimestamp);
             body.replaceText("{{ID_TRANSACCION}}", transactionId);
             body.replaceText("{{NOMBRE_CLIENTE}}", rowObj.nombre || rowObj.Nombre || "");
             
             // Fusiones de Tags (Ajuste de tamaño dinámico)
             replaceTextWithImage(body, "{{IMAGEN_FIRMA}}", payload.firmaBase64, "image/png", 220, 110);
             replaceTextWithImage(body, "{{IMAGEN_SELFIE}}", payload.selfieBase64, "image/jpeg", 140, 140);
             
             // Si es el diagnóstico, agregamos tabla de evidencia con diseño mejorado
             if (fileName.includes("DIAGNOSTICO_CERTIFICADO")) {
               body.appendPageBreak();
               const table = body.appendTable();
               
               const headerRow = table.appendTableRow();
               const headerCell = headerRow.appendTableCell("PROTOCOLO DE SEGURIDAD Y VALIDEZ DIGITAL - BAKSO S.C.");
               headerCell.setBackgroundColor("#003366")
                        .setAttributes({
                          [DocumentApp.Attribute.FOREGROUND_COLOR]: "#FFFFFF",
                          [DocumentApp.Attribute.BOLD]: true,
                          [DocumentApp.Attribute.HORIZONTAL_ALIGNMENT]: DocumentApp.HorizontalAlignment.CENTER
                        });
               
               const dataRow = table.appendTableRow();
               dataRow.appendTableCell(`FECHA/HORA: ${signatureTimestamp}\nID RASTREO: ${transactionId}\nIP ORIGEN: ${payload.ip || "VERIFICADA"}`);
               
               const imgRow = table.appendTableRow();
               if (payload.selfieBase64) {
                 const cell = imgRow.appendTableCell("EVIDENCIA FACIAL (BIOMETRÍA)\n\n");
                 try {
                   const blob = Utilities.newBlob(Utilities.base64Decode(payload.selfieBase64.split(",")[1]), "image/jpeg");
                   cell.appendImage(blob).setWidth(160).setHeight(160);
                 } catch(e) {}
               }
               if (payload.firmaBase64) {
                 const cell = imgRow.appendTableCell("VOLUNTAD EXPRESA (RÚBRICA)\n\n");
                 try {
                   const blob = Utilities.newBlob(Utilities.base64Decode(payload.firmaBase64.split(",")[1]), "image/png");
                   cell.appendImage(blob).setWidth(180).setHeight(90);
                 } catch(e) {}
               }
               
               table.setBorderWidth(1).setBorderColor("#EEEEEE");
               
               const footerRow = table.appendTableRow();
               footerRow.appendTableCell("Este documento constituye una prueba electrónica fehaciente de conformidad. Social Push® No Repudio.")
                        .setAttributes({[DocumentApp.Attribute.ITALIC]: true, [DocumentApp.Attribute.FONT_SIZE]: 8});
             }
             
             doc.saveAndClose();
           } catch (docErr) {
             throw new Error("Privilegios denegados al editar el documento Google Doc. Asegúrate de ejecutar el Web App como 'Yo'. " + docErr.toString());
           }
           
           // Restaurar permisos a VIEW para el original
           try {
             file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
           } catch(e) {}
           
           // Convertir a PDF Final
           const pdfBlob = file.getAs('application/pdf');
           const finalPdf = folder.createFile(pdfBlob).setName(fileName + "_FIRMADO_" + transactionId + ".pdf");
           finalPdf.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
           signedDocUrls.push(finalPdf.getUrl());
        }
      }
      
      // 4. NOTIFICACIÓN POR CORREO AL CLIENTE (Si existe email)
      const dataObj = getSheetData("CLIENTES")[rowIndex - 1];
      const customerEmail = dataObj.email;
      if (customerEmail && customerEmail.includes("@")) {
         const pdfFiles = folder.getFilesByType(MimeType.PDF);
         const attachments = [];
         while (pdfFiles.hasNext()) {
           const f = pdfFiles.next();
           if (f.getName().includes("FIRMADO")) {
             attachments.push(f.getBlob());
           }
         }
         
         if (attachments.length > 0) {
           MailApp.sendEmail({
             to: customerEmail,
             subject: "Expediente Digital Formalizado - Social Push®",
             body: `Hola ${dataObj.nombre},\n\nTu expediente digital ha sido formalizado con éxito. Adjuntamos tu Contrato Marco y Certificación de Diagnóstico en formato PDF.\n\nGracias por confiar en Social Push®.`,
             attachments: attachments
           });
         }
      }
    } catch (e) {
      logDebug("❌ ERROR SELLANDO O ENVIANDO DOCS", e.toString());
    }
  }
  
  return createResponse({ success: true, signedDocUrls });
}

/**
 * Procesa la certificación final del asesor, actualiza el cliente
 * y registra la hoja de servicio.
 */
function handleFinalizeAudit(payload) {
  logDebug("DEBUG_ENTRADA", "Payload recibido: " + JSON.stringify(payload));
  // Aseguramos que el id esté presente para handleCreateCliente
  const searchId = payload.id || payload.clienteId;
  if (!payload.id) payload.id = searchId;

  // 1. Actualizamos el registro del cliente (incluyendo estatusfirma si se envió)
  let res;
  try {
    res = handleCreateCliente(payload);
  } catch(e) { logDebug("ERR_CLIENTE_UPDATE", e.toString()); }
  
  // 2. Registramos formalmente la hoja de servicio/diagnóstico
  try {
    handleCreateHoja(payload);
  } catch(e) { logDebug("ERR_HOJA_CREATION", e.toString()); }

  // 3. GENERACIÓN DE CONTRATO PERSONALIZADO (Copia del Template)
  try {
    const templateId = "12GVFwA_zkRs4olXQaF2sL5E6Tw6em7ne19tw3y6vHL0";
    const folderId = payload.id_carpeta_drive || payload.idcarpetadrive;
    
    // Si viene del portal EntrevistaHub e indica que ya hay contrato, solo generamos el diagnóstico.
    const skipContrato = payload.tipoDocEval === 'DIAGNOSTICO';
    
    logDebug("FINALIZE_AUDIT", "Iniciando generación. folderId: " + folderId + ", skipContrato: " + skipContrato);
    
    if (folderId) {
       const folder = DriveApp.getFolderById(folderId);
       logDebug("FINALIZE_AUDIT", "Folder accesible: " + folder.getName());
       
       if (!skipContrato && templateId) {
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
         body.replaceText("{{NOMBRE_CLIENTE}}", payload.nombre || (payload.nombre + " " + payload.apellidos) || "");
         body.replaceText("{{CURP}}", payload.curp || "");
         body.replaceText("{{RFC}}", payload.rfc || "");
         body.replaceText("{{FECHA}}", new Date().toLocaleDateString('es-MX'));
         body.replaceText("{{DOMICILIO}}", payload.domicilio || payload.domicilioExtraido || "");
         body.replaceText("{{NSS}}", payload.nss || "");
         
         doc.saveAndClose();
         copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
       }

       // 4. GENERACIÓN DE DIAGNÓSTICO CERTIFICADO
       const diagDoc = DocumentApp.create(`DIAGNOSTICO_CERTIFICADO_${payload.curp || payload.id}`);
       const diagBody = diagDoc.getBody();

       diagBody.insertParagraph(0, "SOCIAL PUSH® - CERTIFICACIÓN TÉCNICA").setHeading(DocumentApp.ParagraphHeading.HEADING1).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
       diagBody.appendParagraph(`FECHA: ${new Date().toLocaleDateString('es-MX')}`);
       diagBody.appendParagraph(`CLIENTE: ${payload.nombre || ""}`);
       diagBody.appendParagraph(`CURP: ${payload.curp || ""}`);
       diagBody.appendParagraph(`SERVICIOS: ${payload.servicios || ""}`);
       diagBody.appendHorizontalRule();
       diagBody.appendParagraph("DICTAMEN TÉCNICO:").setBold(true);
       diagBody.appendParagraph(payload.dictamen || "");
       diagBody.appendHorizontalRule();
       diagBody.appendParagraph(`ASESOR CERTIFICADOR: ${payload.asesor || ""}`);

       if (payload.firmaAsesor) {
         try {
           const faBlob = Utilities.newBlob(Utilities.base64Decode(payload.firmaAsesor.split(",")[1]), "image/png");
           diagBody.appendImage(faBlob).setWidth(150).setHeight(75);
         } catch(errFirma) { logDebug("FIRMA_ASESOR_ERR", errFirma.toString()); }
       }
       
       // Agregamos llaves de firma para el flujo de handleUpdateSignature (Fase 2: Cliente)
       diagBody.appendParagraph("\n\n{{IMAGEN_FIRMA}}\n\n{{IMAGEN_SELFIE}}").setAlignment(DocumentApp.HorizontalAlignment.CENTER);

       diagDoc.saveAndClose();
       const diagFile = DriveApp.getFileById(diagDoc.getId());
       diagFile.moveTo(folder);
       diagFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
    }
  } catch(e) {
    logDebug("❌ ERROR PROCESANDO AUDITORIA", e.toString());
  }
  
  return createResponse({ success: true, message: "Certificación generada. Pendiente firma de cliente." });
}

function doGet(e) {
  try {
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
        // CORRECCIÓN CRÍTICA: Buscar Diagnóstico (Hoja de Servicio) para el portal de firma
        const hojas = getSheetData("HOJAS_SERVICIO");
        const miHoja = hojas.reverse().find(h => 
          (h.idcliente && h.idcliente.toString().toUpperCase() === identifier.toUpperCase()) ||
          (h.clienteid && h.clienteid.toString().toUpperCase() === identifier.toUpperCase())
        );
        if (miHoja) {
          cliente.hojaservicio = miHoja;
          // Mapeo específico para compatibilidad con el frontend
          cliente.diagnosticoTexto = miHoja.diagnostico || miHoja.notasdiagnostico || miHoja.notas || miHoja.dictamen || "";
        }

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
        const hojas = getSheetData("hojas_de_Servicio");
        const hoja = hojas.find(h => 
          (h.clienteid && h.clienteid.toString().toUpperCase() === identifier.toString().toUpperCase()) ||
          (h.id && h.id.toString().toUpperCase() === identifier.toString().toUpperCase())
        );
        if (hoja) {
          cliente.hojaservicio = hoja;
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
    // Merge main NSS with list if not already there
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
}

function handleCreateHoja(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("hojas_de_Servicio");
  if (!sheet) {
    sheet = ss.insertSheet("hojas_de_Servicio");
    sheet.appendRow(["ID_Hoja", "ID_Cliente", "Universo", "Servicios", "Monto", "Diagnostico", "Status", "Fecha", "Asesor", "FirmaAsesor"]);
  }
  
  // BLINDAJE: servicios puede venir como Array o como String ya unido
  let serviciosStr = "";
  if (Array.isArray(payload.servicios)) {
    serviciosStr = payload.servicios.join(", ");
  } else {
    serviciosStr = payload.servicios || "";
  }
  
  sheet.appendRow([
    Utilities.getUuid(),                                       // A: ID Hoja (Generado)
    payload.clienteId || payload.id,                          // B: ID Cliente
    payload.universo || "U1",                                  // C: Universo
    serviciosStr,                                              // D: Servicios
    payload.honorariosAcordados || payload.monto || 0,         // E: Monto
    payload.notasDiagnostico || payload.dictamen || "",        // F: Diagnostico
    "ACTIVO",                                                  // G: Status
    payload.createdAt || new Date().toISOString(),             // H: Fecha
    payload.asesor || "",                                      // I: Asesor
    payload.firmaAsesor || ""                                  // J: FirmaAsesor
  ]);
  return createResponse({ success: true });
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
  if (!base64Data) return;
  try {
    const match = body.findText(searchText);
    if (match) {
      const textElement = match.getElement().asText();
      const parent = textElement.getParent();
      
      // Sanitización segura del texto
      const currentText = textElement.getText();
      if (currentText.includes(searchText)) {
        textElement.setText(currentText.replace(searchText, ''));
      }
      
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Data.split(",")[1]), mimeType);
      
      let img;
      if (parent.getType() === DocumentApp.ElementType.PARAGRAPH) {
        const paragraph = parent.asParagraph();
        img = paragraph.insertInlineImage(paragraph.getChildIndex(textElement), blob);
        // Centrar si es contenido de firma/selfie
        paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      } else if (parent.getType() === DocumentApp.ElementType.TABLE_CELL) {
        const cell = parent.asTableCell();
        img = cell.appendImage(blob);
        cell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
      } else {
        img = body.appendImage(blob);
      }
      
      if (img && width && height) {
        // Validación de dimensiones máximas para evitar desbordamiento de página
        const maxWidth = 500; 
        const actualWidth = Math.min(width, maxWidth);
        const ratio = actualWidth / width;
        img.setWidth(actualWidth).setHeight(height * ratio);
      }
    }
  } catch(e) {
    logDebug("REPLACE_IMG_ERR", "Error en " + searchText + ": " + e.toString());
  }
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
     while(oldFiles.hasNext()) { const f = oldFiles.next(); if (f.getName().includes("CONTRATO_PERSONALIZADO")) f.setTrashed(true); }
     
     const copy = DriveApp.getFileById(templateId).makeCopy(`CONTRATO_PERSONALIZADO_${curp10}`, folder);
     const doc = DocumentApp.openById(copy.getId());
     const body = doc.getBody();
     body.replaceText("{{NOMBRE_CLIENTE}}", payload.nombre || (payload.nombre + " " + payload.apellidos) || "");
     body.replaceText("{{CURP}}", payload.curp || "");
     body.replaceText("{{RFC}}", payload.rfc || "");
     body.replaceText("{{FECHA}}", new Date().toLocaleDateString('es-MX'));
     body.replaceText("{{DOMICILIO}}", payload.domicilioExtraido || "");
     body.replaceText("{{NSS}}", payload.nss || "");
     
     replaceTextWithImage(body, "{{IMAGEN_FIRMA}}", payload.firmaBase64, "image/png", 200, 100);
     replaceTextWithImage(body, "{{IMAGEN_SELFIE}}", payload.selfieBase64, "image/jpeg", 150, 150);
     
     doc.saveAndClose();
     copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
     
     // Convertir a PDF y guardar en la carpeta
     try {
       const pdfBlob = copy.getAs('application/pdf');
       const pdfFile = folder.createFile(pdfBlob).setName(`CONTRATO_PERSONALIZADO_${curp10}.pdf`);
       pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
       // Opcional: Eliminar el Google Doc original para solo dejar el PDF
       // copy.setTrashed(true);
       
       sheet.getRange(existingRowIndex > -1 ? existingRowIndex + 1 : sheet.getLastRow(), 24).setValue(pdfFile.getUrl());
     } catch (pdfErr) {
       logDebug("ONB_PDF_ERR", pdfErr.toString());
       sheet.getRange(existingRowIndex > -1 ? existingRowIndex + 1 : sheet.getLastRow(), 24).setValue(copy.getUrl());
     }

  } catch(e) { logDebug("ONB_DOC_ERR", e.toString()); }

  return createResponse({ success: true, id: curp10, id_carpeta_drive: folderId });
}