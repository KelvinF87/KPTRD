// =================================================================
//        SCRIPT A PRUEBA DE FALLOS - COMPATIBLE CON MOTOR ANTIGUO
// =================================================================

const SCRAPER_API_KEY = "aqui va tu clave de ScraperAPI"; // Reemplaza con tu clave real
const MIME_TYPE_JSON = ContentService.MimeType.JSON;

// =================================================================
//             PUNTO DE ENTRADA PRINCIPAL (POST)
// =================================================================

function doPost(e) {
  try {
    const payload = e.parameter; 
    const action = payload.action;

    if (!action) {
      return createErrorResponse('Falta el parámetro "action".', 400);
    }
    
    switch (action) {
      case 'testConnection':
        return createSuccessResponse({ message: "PRUEBA INTERNA EXITOSA. El script está funcionando." });
      case 'websearch':
        return searchWeb(payload);
      case 'sendEmail':
        payload.body = decodeURIComponent(payload.body);
        return sendEmail(payload);
      case 'scrape':
        return scrapeUrl(payload);
      default:
        return createErrorResponse(`Acción desconocida: "${action}"`, 404);
    }
    
  } catch (error) {
    Logger.log(`Error CRÍTICO en doPost: ${error.stack}`);
    return createErrorResponse(`Error interno del servidor: ${error.message}`, 500);
  }
}

function doGet(e) {
  return createErrorResponse('Este endpoint solo responde a solicitudes POST.', 405);
}

// =================================================================
//    FUNCIONES DE AYUDA (VERSIÓN COMPATIBLE SIN .setHeader)
// =================================================================

function createSuccessResponse(data) {
  // Versión compatible que funcionará en el editor.
  // La corrección de CORS se manejará en la implementación.
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, data: data }))
    .setMimeType(MIME_TYPE_JSON);
}

function createErrorResponse(message, statusCode = 400) {
  // Versión compatible que funcionará en el editor.
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: { code: statusCode, message: String(message) } }))
    .setMimeType(MIME_TYPE_JSON);
}

// =================================================================
//      FUNCIONES DE LÓGICA DE NEGOCIO (Las tuyas, sin cambios)
// =================================================================

function scrapeUrl(payload) {
  const urlToScrape = payload.url;
  if (!urlToScrape) { return createErrorResponse("Para 'scrape', se requiere el parámetro 'url'.", 400); }
  try {
    const urlProxy = `http://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(urlToScrape)}`;
    const response = UrlFetchApp.fetch(urlProxy, { 'muteHttpExceptions': true });
    const statusCode = response.getResponseCode();
    if (statusCode !== 200) { return createErrorResponse(`No se pudo acceder a la URL. El servidor devolvió el código: ${statusCode}`, 502); }
    const htmlContent = response.getContentText();
    const textContent = htmlContent.replace(/<style([\s\S]*?)<\/style>/gi, '').replace(/<script([\s\S]*?)<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const MAX_LENGTH = 4000;
    const truncatedText = textContent.length > MAX_LENGTH ? textContent.substring(0, MAX_LENGTH) + "..." : textContent;
    return createSuccessResponse({ url: urlToScrape, content: truncatedText });
  } catch (err) {
    Logger.log(`Error grave en scrapeUrl para ${urlToScrape}: ${err.stack}`);
    return createErrorResponse(`Excepción al intentar extraer contenido de la URL: ${err.message}`, 500);
  }
}

function sendEmail(payload) {
  if (!payload.to || !payload.subject || !payload.body) { return createErrorResponse("Para 'sendEmail', se requieren: 'to', 'subject', y 'body'.", 400); }
  GmailApp.sendEmail(payload.to, payload.subject, payload.body, { htmlBody: payload.body });
  return createSuccessResponse({ message: 'Correo enviado a ' + payload.to });
}

function searchWeb(payload) {
  const query = payload.query;
  if (!query) { return createErrorResponse('Para \'websearch\', se requiere el parámetro "query".', 400); }
  const maxResults = parseInt(payload.maxResults || '5', 10);
  try {
    const urlOriginal = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query);
    const urlProxy = `http://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(urlOriginal)}`;
    const response = UrlFetchApp.fetch(urlProxy, { 'muteHttpExceptions': true });
    const statusCode = response.getResponseCode();
    if (statusCode !== 200) { return createErrorResponse(`ScraperAPI devolvió un error (Código: ${statusCode}).`, 502); }
    const htmlContent = response.getContentText();
    const resultados = [];
    const resultBlockRegex = /<div class="result.*?web-result.*?">[\s\S]*?<\/div>/g;
    const blocks = htmlContent.match(resultBlockRegex);
    if (blocks) {
      for (const block of blocks) {
        if (resultados.length >= maxResults) break;
        const linkAndTitleRegex = /<a[^>]*?class="result__a"[^>]*?href="([^"]+)"[^>]*?>([\s\S]+?)<\/a>/;
        const match = block.match(linkAndTitleRegex);
        if (match) {
          let cleanLink = "about:blank";
          try {
            const urlParams = new URLSearchParams(match[1].split('?')[1]);
            cleanLink = urlParams.get('uddg') || match[1];
          } catch (err) { cleanLink = match[1]; }
          resultados.push({ titulo: match[2].replace(/<[^>]*>/g, '').trim(), enlace: decodeURIComponent(cleanLink) });
        }
      }
    }
    return createSuccessResponse({ count: resultados.length, results: resultados });
  } catch (err) {
    Logger.log(`Error grave en searchWeb: ${err.stack}`);
    return createErrorResponse(`Excepción en el servidor durante el scraping: ${err.message}`, 500);
  }
}

// =================================================================
//        FUNCIÓN DE PRUEBA (Para usar en el editor)
// =================================================================
function testTheConnection() {
  const mock_e = {
    parameter: {
      action: "testConnection"
    }
  };
  const response = doPost(mock_e);
  Logger.log("--- Resultado de testTheConnection ---");
  Logger.log(response.getContent());
}