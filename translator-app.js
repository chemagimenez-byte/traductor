/**
 * Aplicación de Interfaz de Usuario para Traductor SCORM
 */
(function(global) {
    'use strict';

    // Estado de la aplicación
    const state = {
        files: [],
        isTranslating: false,
        service: null,
        core: null,
        patch: null
    };

    // Referencias DOM
    const dom = {};

    function initDOM() {
        dom.dropzone = document.getElementById('dropzone');
        dom.fileInput = document.getElementById('fileInput');
        dom.selectBtn = document.getElementById('selectBtn');
        dom.sourceLang = document.getElementById('sourceLang');
        dom.targetLang = document.getElementById('targetLang');
        dom.startBtn = document.getElementById('startBtn');
        dom.clearBtn = document.getElementById('clearBtn');
        dom.fileList = document.getElementById('fileList');
        dom.logContainer = document.getElementById('logContainer');
        dom.progressBar = document.getElementById('progressBar');
        dom.progressText = document.getElementById('progressText');
        dom.resultsArea = document.getElementById('resultsArea');
    }

    function log(message) {
        const line = document.createElement('div');
        line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        dom.logContainer.appendChild(line);
        dom.logContainer.scrollTop = dom.logContainer.scrollHeight;
    }

    function populateLanguages() {
        if (!state.service) return;
        
        const langs = state.service.getSupportedLanguages();
        const addOptions = (select, includeAuto = false) => {
            select.innerHTML = '';
            if (includeAuto) {
                const opt = document.createElement('option');
                opt.value = 'auto';
                opt.textContent = 'Detectar automáticamente';
                select.appendChild(opt);
            }
            langs.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l.code;
                opt.textContent = l.name;
                select.appendChild(opt);
            });
        };

        addOptions(dom.sourceLang, true);
        addOptions(dom.targetLang, false);
        
        // Seleccionar español como destino por defecto si existe
        dom.targetLang.value = 'es';
    }

    function updateUIState() {
        const disabled = state.isTranslating;
        dom.selectBtn.disabled = disabled;
        dom.clearBtn.disabled = disabled;
        dom.sourceLang.disabled = disabled;
        dom.targetLang.disabled = disabled;
        dom.startBtn.disabled = disabled || state.files.length === 0;
        
        if (disabled) {
            dom.dropzone.classList.add('disabled');
            dom.startBtn.textContent = 'Traduciendo...';
        } else {
            dom.dropzone.classList.remove('disabled');
            dom.startBtn.textContent = 'Iniciar Traducción';
        }
    }

    function renderFileList() {
        dom.fileList.innerHTML = '';
        state.files.forEach(file => {
            const div = document.createElement('div');
            div.className = 'file-item';
            div.innerHTML = `
                <span class="file-name">${file.name}</span>
                <span class="file-size">${(file.size / 1024).toFixed(1)} KB</span>
            `;
            dom.fileList.appendChild(div);
        });
        updateUIState();
    }

    async function handleFiles(fileList) {
        if (state.isTranslating) return;
        
        const newFiles = Array.from(fileList).filter(f => f.name.endsWith('.zip'));
        if (newFiles.length === 0) {
            alert('Por favor, sube archivos .zip (paquetes SCORM).');
            return;
        }

        state.files = [...state.files, ...newFiles];
        renderFileList();
        log(`${newFiles.length} archivo(s) añadido(s). Total: ${state.files.length}`);
    }

    async function startTranslation() {
        if (state.isTranslating || state.files.length === 0) return;

        const source = dom.sourceLang.value;
        const target = dom.targetLang.value;

        if (source === target) {
            alert('El idioma de origen y destino no pueden ser iguales.');
            return;
        }

        state.isTranslating = true;
        updateUIState();
        dom.resultsArea.innerHTML = '';
        log(`Iniciando traducción: ${source.toUpperCase()} -> ${target.toUpperCase()}`);

        const results = [];

        for (let i = 0; i < state.files.length; i++) {
            const file = state.files[i];
            log(`Procesando ${i + 1}/${state.files.length}: ${file.name}`);
            
            try {
                const result = await state.core.processFile(file, source, target, (current, total, fname) => {
                    dom.progressText.textContent = `Archivo: ${Math.round((current/total)*100)}% - ${fname.substring(0, 20)}...`;
                    dom.progressBar.style.width = `${(current/total)*100}%`;
                });

                if (result.success) {
                    const url = URL.createObjectURL(result.blob);
                    const fileName = `TRADUCIDO_${file.name}`;
                    
                    const resDiv = document.createElement('div');
                    resDiv.className = 'result-item success';
                    resDiv.innerHTML = `
                        <strong>${file.name}</strong><br>
                        Traducido correctamente (${result.stats.modified} archivos internos).<br>
                        <a href="${url}" download="${fileName}" class="download-btn">Descargar Paquete</a>
                    `;
                    dom.resultsArea.appendChild(resDiv);
                    log(`Éxito: ${file.name}`);
                    results.push(true);
                } else {
                    throw new Error(result.error);
                }
            } catch (err) {
                log(`ERROR en ${file.name}: ${err.message}`);
                const resDiv = document.createElement('div');
                resDiv.className = 'result-item error';
                resDiv.innerHTML = `<strong>${file.name}</strong><br>Error: ${err.message}`;
                dom.resultsArea.appendChild(resDiv);
                results.push(false);
            }
            
            dom.progressBar.style.width = '0%';
            dom.progressText.textContent = 'Esperando...';
        }

        state.isTranslating = false;
        updateUIState();
        log('Proceso de lote finalizado.');
    }

    function setupEventListeners() {
        dom.selectBtn.addEventListener('click', () => dom.fileInput.click());
        dom.fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
        
        dom.dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!state.isTranslating) dom.dropzone.classList.add('dragover');
        });
        
        dom.dropzone.addEventListener('dragleave', () => dom.dropzone.classList.remove('dragover'));
        
        dom.dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dom.dropzone.classList.remove('dragover');
            if (!state.isTranslating) handleFiles(e.dataTransfer.files);
        });

        dom.startBtn.addEventListener('click', startTranslation);
        
        dom.clearBtn.addEventListener('click', () => {
            if (state.isTranslating) return;
            state.files = [];
            dom.fileInput.value = '';
            dom.fileList.innerHTML = '';
            dom.resultsArea.innerHTML = '';
            dom.logContainer.innerHTML = '';
            updateUIState();
            log('Interfaz limpiada.');
        });
    }

    function initializeApp() {
        console.log('[SCORM-TRANSLATOR-APP] Iniciando aplicación...');
        initDOM();

        // Verificar dependencias globales
        if (!global.TranslationService || !global.TranslatorPatch || !global.TranslatorCore || !global.JSZip) {
            console.error('Faltan dependencias críticas. Asegúrate de cargar JSZip y los scripts en orden.');
            alert('Error de carga: Faltan librerías necesarias (JSZip o módulos internos). Revisa la consola.');
            return;
        }

        try {
            state.service = new global.TranslationService();
            state.patch = new global.TranslatorPatch();
            state.core = new global.TranslatorCore(state.service, state.patch);
            
            populateLanguages();
            setupEventListeners();
            updateUIState();
            log('Aplicación lista. Seleccione un archivo ZIP (SCORM).');
        } catch (e) {
            console.error('Error fatal inicializando la app:', e);
            alert('Error inicializando la aplicación: ' + e.message);
        }
    }

    // Esperar a que el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp();
    }

})(window);