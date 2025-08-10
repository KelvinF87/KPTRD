# Asistente IA Multi-Modelo con Búsqueda Web

Este proyecto es una aplicación de chat de inteligencia artificial de código abierto que permite al usuario interactuar con diferentes modelos de lenguaje (**Gemini**, **OpenAI**, **OpenRouter** y **Ollama** local).  
Incluye una potente función de **búsqueda en Internet** que optimiza las consultas del usuario para obtener resultados más precisos y relevantes antes de formular la respuesta final.

**Creador:** Kelvin José Familia Adames  
**Contacto:** kelvinjosefamilia@gmail.com

---

## 📌 Características Principales

- **Multi-Modelo:** Cambia fácilmente entre los modelos de IA más populares (Gemini, OpenAI, OpenRouter) y modelos locales a través de Ollama.
- **Búsqueda Inteligente:** Activa el modo de búsqueda para que la IA primero busque en Internet, usando una consulta optimizada por IA, y luego responda basándose únicamente en los resultados encontrados.
- **Interfaz Moderna:** Diseño limpio, responsivo y fácil de usar, inspirado en las mejores interfaces de usuario de chat.
- **Historial de Chat:** Guarda y recarga conversaciones anteriores. El historial se almacena localmente en tu navegador.
- **Sin Servidor (Serverless):** El backend para la búsqueda web se ejecuta en Google Apps Script (gratuito para uso personal), y todas tus claves API se guardan de forma segura en el almacenamiento local de tu navegador.
- **Resaltado de Código:** Los bloques de código en las respuestas de la IA se formatean automáticamente y se pueden copiar con un solo clic.

---

## ⚙️ Manual de Configuración

Para que la aplicación funcione correctamente, necesitas configurar dos partes principales:

1. **Backend en Google Apps Script** (para la búsqueda web).
2. **Cliente Web** (interfaz de usuario en tu navegador).

---

### **Parte 1: Configuración del Backend en Google Apps Script**

El backend se utiliza exclusivamente para la función de búsqueda en Internet. Utiliza **ScraperAPI** como servicio intermediario para evitar bloqueos y captchas.

#### Pasos:

1. **Obtén una clave de API de ScraperAPI**
   - Ve a [scraperapi.com](https://www.scraperapi.com) y regístrate para obtener una clave gratuita.
   - Copia la **API Key** desde tu panel de control.

2. **Crea un nuevo proyecto en Google Apps Script**
   - Ve a [script.google.com](https://script.google.com) y haz clic en **"Nuevo proyecto"**.

3. **Pega el código del backend y tu clave API**
   - Elimina el contenido de `Código.gs`.
   - Copia y pega el contenido del archivo `code.js` del proyecto.
   - Busca la línea:
     ```javascript
     const SCRAPER_API_KEY = "api de scraperapi aqui ";
     ```
     Reemplázala con tu clave API de ScraperAPI.

4. **Actualiza el manifiesto (`appsscript.json`)**
   - En configuración del proyecto, habilita **"Mostrar archivo de manifiesto"**.
   - Abre `appsscript.json` y reemplaza todo su contenido con el del proyecto original.

5. **Despliega la aplicación web**
   - Clic en **"Implementar" → "Nueva implementación"**.
   - Tipo: **Aplicación web**.
   - **Descripción:** Ej. "API de Búsqueda Web v1".
   - **Ejecutar como:** Tú mismo.
   - **Acceso:** "Cualquier persona" o "Cualquier usuario anónimo".
   - Autoriza permisos y copia la **URL** que se te proporciona.

---

### **Parte 2: Configuración del Cliente (HTML/CSS/JS)**

El cliente es la interfaz de chat que usarás en tu navegador.

#### Pasos:

1. **Abrir la aplicación**
   - Asegúrate de tener `index.html`, `styles.css` y `app.js` en la misma carpeta.
   - Abre `index.html` en tu navegador.

2. **Configurar URLs y Claves API**
   - Haz clic en **"Configuración"**.
   - Completa el formulario:
     - **URL de Google Apps Script:** La obtenida en la configuración del backend.
     - **Clave API de Gemini:** Desde [Google AI Studio](https://aistudio.google.com).
     - **Clave API de OpenAI / OpenRouter:** Desde sus sitios oficiales.
     - **URL de API de Ollama:** Ej. `http://localhost:11434` para uso local.

3. **Guardar y comenzar a chatear**
   - Clic en **"Guardar Configuración"**.
   - Las claves se guardan **localmente** en tu navegador.
   - Inicia un nuevo chat, selecciona el modelo y envía mensajes.
   - Para activar la búsqueda web, haz clic en el **icono del globo terráqueo** antes de enviar el mensaje.

---

## 📄 Licencia

Este proyecto se distribuye bajo la **Licencia Apache 2.0**.

