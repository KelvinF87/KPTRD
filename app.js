// =================================================================
//        app.js - CON RAZONAMIENTO DE BÚSQUEDA Y CONTEXTO
// =================================================================

// --- CONFIGURACIÓN Y SELECTORES ---
const elements = {
    chatView: document.getElementById('chatView'), settingsView: document.getElementById('settingsView'), historyView: document.getElementById('historyView'),
    newChatBtn: document.getElementById('newChatBtn'), settingsToggleBtn: document.getElementById('settingsToggleBtn'), historyToggleBtn: document.getElementById('historyToggleBtn'),
    welcomeContainer: document.querySelector('.welcome-container'), messagesArea: document.querySelector('.chat-messages-area'),
    promptInput: document.getElementById('promptInput'), sendBtn: document.getElementById('sendBtn'), searchToggleBtn: document.getElementById('searchToggleBtn'),
    modelSelector: document.getElementById('modelSelector'), customSelect: document.querySelector('.custom-select'), customSelectTrigger: document.querySelector('.custom-select-trigger'), customOptions: document.querySelectorAll('.custom-option'),
    historyList: document.getElementById('historyList'), statusMessage: document.getElementById('statusMessage'),
    appsScriptUrl: document.getElementById('appsScriptUrl'), geminiApiKey: document.getElementById('geminiApiKey'), openaiApiKey: document.getElementById('openaiApiKey'), openrouterApiKey: document.getElementById('openrouterApiKey'), ollamaApiUrl: document.getElementById('ollamaApiUrl'), saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    sidebar: document.getElementById('sidebar'), menuToggleBtn: document.getElementById('menuToggleBtn'), mobileOverlay: document.getElementById('mobileOverlay'),
};

// --- ESTADO DE LA APLICACIÓN ---
let state = {
    currentConversationId: null, chatHistory: [], activeModel: 'gemini', isBusy: false, isSearchModeActive: false,
    settings: { appsScriptUrl: '', geminiApiKey: '', openaiApiKey: '', openrouterApiKey: '', ollamaApiUrl: 'http://localhost:11434' }
};

// =================================================================
//        LÓGICA DE PROMPTS Y BÚSQUEDA INTELIGENTE
// =================================================================

async function generateSearchQuery(userPrompt) {
    if (!state.settings.geminiApiKey) throw new Error("Se requiere la clave API de Gemini para optimizar la búsqueda.");
    const metaPrompt = `**Instrucción de Sistema:** Eres un motor de extracción de palabras clave para búsquedas web. Tu única tarea es convertir la petición de un usuario en una consulta de búsqueda óptima y concisa para un motor de búsqueda estándar.\n- Elimina frases conversacionales como "puedes buscar", "quién es", "dime sobre", "encuentra información de".\n- Si se menciona un sitio específico (ej. "en LinkedIn", "en Wikipedia"), conviértelo a la sintaxis \`site:sitio.com\`.\n- Tu respuesta debe ser *únicamente* la consulta de búsqueda resultante, sin ninguna otra palabra o explicación.\n\n**Ejemplos:**\n- Usuario: "puedes buscar en internet especialmente en linkedin quien es kelvin jose familia"\n- Respuesta: Kelvin Jose Familia Adames site:linkedin.com\n\n- Usuario: "cuál es la capital de Mongolia"\n- Respuesta: capital de Mongolia\n\n**Petición del Usuario a Procesar:**\n"${userPrompt}"`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${state.settings.geminiApiKey}`;
    const payload = { contents: [{ parts: [{ text: metaPrompt }] }] };
    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error('La IA no pudo generar la consulta de búsqueda.');
        const result = await response.json();
        return result.candidates[0].content.parts[0].text.trim();
    } catch (error) {
        console.error("Error al generar la consulta de búsqueda:", error);
        return userPrompt;
    }
}

function createFinalPromptForSearch(originalUserPrompt, searchResultsText) {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const currentDate = now.toLocaleDateString('es-ES', options);
    const currentTime = now.toLocaleTimeString('es-ES');
    const contextBlock = `Fecha y hora actual: ${currentDate}, ${currentTime}.\n\nResultados de búsqueda en Internet:\n${searchResultsText}`;
    const finalPrompt = `**Instrucción Principal:** Eres un asistente experto que responde a la pregunta del usuario basándose *únicamente* en la información proporcionada en el siguiente contexto. Ignora por completo tu conocimiento previo. Si la respuesta no se encuentra de forma clara en el contexto, responde "No encontré información relevante sobre eso en la búsqueda que realicé.". Resume los hallazgos de manera clara y coherente.\n--- INICIO DEL CONTEXTO ---\n${contextBlock.trim()}\n--- FIN DEL CONTEXTO ---\n**Tarea:** Usando solo la información del contexto anterior, responde de manera exhaustiva a la siguiente pregunta original del usuario.\n**Pregunta original del usuario:** "${originalUserPrompt}"`;
    return finalPrompt.trim();
}

async function performSearch(query) {
    if (!state.settings.appsScriptUrl.startsWith('https')) throw new Error('La URL de Google Apps Script no está configurada en Ajustes.');
    const formData = new FormData();
    formData.append('action', 'websearch');
    formData.append('query', query);
    formData.append('maxResults', '5');
    const response = await fetch(state.settings.appsScriptUrl, { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`El servidor de búsqueda devolvió un error: ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error.message || 'Error desconocido del backend.');
    if (!result.data.results || result.data.results.length === 0) return `No se encontraron resultados para "${query}".`;
    return result.data.results.map((item, index) => `[${index + 1}] ${item.titulo}: ${item.enlace}\n${item.descripcion}`).join('\n\n');
}

// =================================================================
//        LÓGICA PRINCIPAL DE CHAT Y STREAMING (ORQUESTADOR)
// =================================================================

async function handleSendRequest() {
    const userPrompt = elements.promptInput.value.trim();
    if (!userPrompt || state.isBusy) return;

    setUiBusy(true);
    elements.welcomeContainer.style.display = 'none';
    addMessageToDOM('user', userPrompt);
    state.chatHistory.push({ role: 'user', content: userPrompt });
    elements.promptInput.value = '';
    elements.promptInput.style.height = 'auto';

    const botMessageElement = addMessageToDOM('bot', '', true);
    const botTextElement = botMessageElement.querySelector('.message-text');
    botTextElement.innerHTML = '<span class="typing-cursor"></span>';

    // *** SECCIÓN CORREGIDA ***
    // Definimos los callbacks una sola vez, correctamente.
    let fullResponse = "";
    const onChunk = (chunk) => {
        fullResponse += chunk;
        botTextElement.innerHTML = marked.parse(fullResponse + '<span class="typing-cursor"></span>');
        elements.messagesArea.scrollTop = elements.messagesArea.scrollHeight;
    };

    const onComplete = () => {
        botTextElement.innerHTML = marked.parse(fullResponse);
        botTextElement.querySelectorAll('pre').forEach(pre => {
            const code = pre.querySelector('code');
            if (code) {
                const copyBtn = document.createElement('button');
                copyBtn.className = 'copy-code-btn'; copyBtn.textContent = 'Copiar';
                copyBtn.onclick = () => { navigator.clipboard.writeText(code.innerText).then(() => { copyBtn.textContent = '¡Copiado!'; setTimeout(() => { copyBtn.textContent = 'Copiar'; }, 2000); }); };
                pre.appendChild(copyBtn);
                hljs.highlightElement(code);
            }
        });
        state.chatHistory.push({ role: 'assistant', content: fullResponse });
        saveCurrentConversation();
        setUiBusy(false);
        elements.promptInput.focus();
    };

    const onError = (error) => {
        botTextElement.innerHTML = `<p class="error-message">**Error:** ${error.message}</p>`;
        setUiBusy(false);
        elements.promptInput.focus();
    };

    try {
        let promptToSend;
        if (state.isSearchModeActive) {
            let statusMsg = addStatusMessageToDOM('Optimizando tu consulta para la búsqueda...');
            const searchQuery = await generateSearchQuery(userPrompt);
            statusMsg.remove();
            statusMsg = addStatusMessageToDOM(`Buscando en Internet: <i>"${searchQuery}"</i>...`);
            const searchResults = await performSearch(searchQuery);
            statusMsg.remove();
            promptToSend = createFinalPromptForSearch(userPrompt, searchResults);
            state.isSearchModeActive = false;
            elements.searchToggleBtn.classList.remove('active');
        } else {
            const now = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const currentDate = now.toLocaleDateString('es-ES', options);
            const systemPreamble = `System Preamble: Current date is ${currentDate}.`;
            promptToSend = `${systemPreamble}\n\n${userPrompt}`;
        }
        await getAiResponse(promptToSend, onChunk, onComplete, onError);
    } catch (error) {
        console.error('Error fatal en handleSendRequest:', error);
        onError(error);
    }
}

// =================================================================
//        EL RESTO DEL CÓDIGO (SIN CAMBIOS)
// =================================================================

async function getAiResponse(prompt, onChunk, onComplete, onError) { const history = state.chatHistory.slice(0, -1); try { const apiCallers = { 'gemini': () => callGeminiAPI(prompt, history, onChunk, onComplete), 'openai': () => callOpenAIAPI(prompt, history, 'https://api.openai.com/v1/chat/completions', 'gpt-4o', state.settings.openaiApiKey, onChunk, onComplete), 'openrouter': () => callOpenAIAPI(prompt, history, 'https://openrouter.ai/api/v1/chat/completions', 'openai/gpt-4o', state.settings.openrouterApiKey, onChunk, onComplete), 'ollama': () => callOllamaAPI(prompt, history, onChunk, onComplete), }; const caller = apiCallers[state.activeModel]; if (caller) { await caller(); } else { throw new Error(`Modelo '${state.activeModel}' no reconocido.`); } } catch (error) { onError(error); } }
async function processStream(response, chunkParser, onChunk, onComplete) { if (!response.body) throw new Error("La respuesta no contiene un cuerpo para leer."); const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const parts = buffer.split('\n'); buffer = parts.pop() || ""; for (const part of parts) { if (part.trim() === "") continue; const chunk = chunkParser(part); if (chunk) onChunk(chunk); } } if (buffer.trim()) { const chunk = chunkParser(buffer); if (chunk) onChunk(chunk); } onComplete(); }
async function callGeminiAPI(prompt, history, onChunk, onComplete) { if (!state.settings.geminiApiKey) throw new Error("La clave API de Gemini no está configurada."); const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:streamGenerateContent?key=${state.settings.geminiApiKey}&alt=sse`; const payload = { contents: history.map(t => ({ role: t.role === 'user' ? 'user' : 'model', parts: [{ text: t.content }] })).concat([{ role: 'user', parts: [{ text: prompt }] }]) }; const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (!response.ok) throw new Error(`Error de Gemini: ${response.statusText}`); await processStream(response, line => { if (!line.startsWith('data: ')) return null; try { return JSON.parse(line.substring(6)).candidates[0].content.parts[0].text; } catch { return null; } }, onChunk, onComplete); }
async function callOpenAIAPI(prompt, history, apiUrl, model, apiKey, onChunk, onComplete) { if (!apiKey) throw new Error(`La clave API para ${state.activeModel} no está configurada.`); const payload = { model, messages: history.concat([{ role: 'user', content: prompt }]), stream: true }; const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(payload) }); if (!response.ok) throw new Error(`Error de ${state.activeModel}: ${response.statusText}`); await processStream(response, line => { if (!line.startsWith('data: ') || line.includes('[DONE]')) return null; try { return JSON.parse(line.substring(6)).choices[0]?.delta?.content || ""; } catch { return null; } }, onChunk, onComplete); }
async function callOllamaAPI(prompt, history, onChunk, onComplete) { if (!state.settings.ollamaApiUrl) throw new Error("La URL de la API de Ollama no está configurada."); const payload = { model: "codegemma:7b", messages: history.concat([{ role: 'user', content: prompt }]), stream: true }; const response = await fetch(`${state.settings.ollamaApiUrl}/api/chat`, { method: 'POST', body: JSON.stringify(payload) }); if (!response.ok) throw new Error(`Error de Ollama: ${await response.text()}`); await processStream(response, line => { try { return JSON.parse(line).message?.content || ""; } catch { return null; } }, onChunk, onComplete); }
function setUiBusy(isBusy) { state.isBusy = isBusy; elements.promptInput.disabled = isBusy; elements.sendBtn.disabled = isBusy; elements.searchToggleBtn.disabled = isBusy; }
function addStatusMessageToDOM(text) { const wrapper = document.createElement('div'); wrapper.className = 'message-wrapper status-wrapper'; wrapper.innerHTML = `<div class="message-content" style="text-align: center; width: 100%; color: var(--text-secondary);">${text}</div>`; elements.messagesArea.appendChild(wrapper); elements.messagesArea.scrollTop = elements.messagesArea.scrollHeight; return wrapper; }
function addMessageToDOM(role, content, returnElement = false) { const wrapper = document.createElement('div'); wrapper.className = `message-wrapper ${role}-wrapper`; const avatar = document.createElement('div'); avatar.className = 'message-avatar'; avatar.textContent = role === 'user' ? 'K' : '🤖'; const contentDiv = document.createElement('div'); contentDiv.className = 'message-content'; const textDiv = document.createElement('div'); textDiv.className = 'message-text'; textDiv.innerHTML = marked.parse(content); contentDiv.append(textDiv); wrapper.append(avatar, contentDiv); elements.messagesArea.appendChild(wrapper); elements.messagesArea.scrollTop = elements.messagesArea.scrollHeight; if (returnElement) return wrapper; }
function showStatus(message, type, duration = 3000) { elements.statusMessage.textContent = message; elements.statusMessage.className = `status-message ${type} show`; setTimeout(() => { elements.statusMessage.classList.remove('show'); }, duration); }
function switchView(viewId) { document.querySelectorAll('.view').forEach(v => v.classList.remove('active')); document.getElementById(viewId).classList.add('active'); document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active')); if (viewId === 'chatView') elements.newChatBtn.classList.add('active'); if (viewId === 'historyView') elements.historyToggleBtn.classList.add('active'); if (viewId === 'settingsView') elements.settingsToggleBtn.classList.add('active'); if (viewId === 'historyView') loadHistoryList(); if (viewId === 'settingsView') loadSettingsToUI(); }
function saveSettings() { state.settings.appsScriptUrl = elements.appsScriptUrl.value.trim(); state.settings.geminiApiKey = elements.geminiApiKey.value.trim(); state.settings.openaiApiKey = elements.openaiApiKey.value.trim(); state.settings.openrouterApiKey = elements.openrouterApiKey.value.trim(); state.settings.ollamaApiUrl = elements.ollamaApiUrl.value.trim(); localStorage.setItem('appSettings', JSON.stringify(state.settings)); showStatus('Configuración guardada.', 'success'); }
function loadSettings() { const savedSettings = JSON.parse(localStorage.getItem('appSettings')); if (savedSettings) { state.settings = { ...state.settings, ...savedSettings }; } }
function loadSettingsToUI() { for (const key in state.settings) { if (elements[key]) { elements[key].value = state.settings[key]; } } }
function saveCurrentConversation() { if (!state.currentConversationId || state.chatHistory.length < 2) return; const conversation = { id: state.currentConversationId, title: state.chatHistory[0].content.substring(0, 40) + '...', history: state.chatHistory, model: state.activeModel }; const allConversations = JSON.parse(localStorage.getItem('chatHistory') || '[]'); const index = allConversations.findIndex(c => c.id === conversation.id); if (index > -1) allConversations[index] = conversation; else allConversations.unshift(conversation); localStorage.setItem('chatHistory', JSON.stringify(allConversations.slice(0, 50))); }
function loadHistoryList() { const conversations = JSON.parse(localStorage.getItem('chatHistory') || '[]'); elements.historyList.innerHTML = conversations.length ? '' : '<p>No hay conversaciones guardadas.</p>'; conversations.forEach(conv => { const item = document.createElement('div'); item.className = 'history-item'; item.textContent = conv.title; item.onclick = () => loadConversation(conv.id); elements.historyList.appendChild(item); }); }
function loadConversation(id) { if (state.isBusy) return; const conversations = JSON.parse(localStorage.getItem('chatHistory') || '[]'); const conv = conversations.find(c => c.id === id); if (!conv) return; state.currentConversationId = conv.id; state.chatHistory = conv.history; state.activeModel = conv.model; elements.messagesArea.innerHTML = ''; elements.welcomeContainer.style.display = 'none'; conv.history.forEach(turn => addMessageToDOM(turn.role, turn.content)); switchView('chatView'); updateCustomSelect(state.activeModel); }
function updateCustomSelect(selectedValue) { elements.customOptions.forEach(option => { const isSelected = option.getAttribute('data-value') === selectedValue; option.classList.toggle('selected', isSelected); if (isSelected) { elements.customSelectTrigger.querySelector('span').textContent = option.textContent; } }); elements.modelSelector.value = selectedValue; state.activeModel = selectedValue; }
function initialize() { loadSettings(); loadSettingsToUI(); updateCustomSelect(state.activeModel); const closeSidebar = () => { elements.sidebar.classList.remove('open'); elements.mobileOverlay.classList.remove('visible'); }; elements.menuToggleBtn.addEventListener('click', () => { elements.sidebar.classList.add('open'); elements.mobileOverlay.classList.add('visible'); }); elements.mobileOverlay.addEventListener('click', closeSidebar); elements.customSelectTrigger.addEventListener('click', () => { elements.customSelect.classList.toggle('open'); }); window.addEventListener('click', (e) => { if (!elements.customSelect.contains(e.target)) { elements.customSelect.classList.remove('open'); } }); elements.customOptions.forEach(option => { option.addEventListener('click', () => { if (state.isBusy) return; const selectedValue = option.getAttribute('data-value'); updateCustomSelect(selectedValue); elements.customSelect.classList.remove('open'); }); }); elements.searchToggleBtn.addEventListener('click', () => { if (state.isBusy) return; state.isSearchModeActive = !state.isSearchModeActive; elements.searchToggleBtn.classList.toggle('active', state.isSearchModeActive); }); elements.newChatBtn.addEventListener('click', () => { if (state.isBusy) return; saveCurrentConversation(); state.currentConversationId = Date.now(); state.chatHistory = []; elements.messagesArea.innerHTML = ''; elements.welcomeContainer.style.display = 'flex'; switchView('chatView'); closeSidebar(); }); elements.historyToggleBtn.addEventListener('click', () => { switchView('historyView'); closeSidebar(); }); elements.settingsToggleBtn.addEventListener('click', () => { switchView('settingsView'); closeSidebar(); }); elements.sendBtn.addEventListener('click', handleSendRequest); elements.promptInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendRequest(); } }); elements.saveSettingsBtn.addEventListener('click', saveSettings); elements.promptInput.addEventListener('input', () => { elements.promptInput.style.height = 'auto'; elements.promptInput.style.height = `${elements.promptInput.scrollHeight}px`; }); elements.newChatBtn.click(); }

document.addEventListener('DOMContentLoaded', initialize);