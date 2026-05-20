/**
 * Núcleo de procesamiento de traducción SCORM
 */
(function(global) {
    'use strict';

    class TranslatorCore {
        constructor(translationService, patchManager) {
            this.service = translationService;
            this.patch = patchManager;
            if (!this.service || !this.patch) {
                throw new Error("Dependencies missing for TranslatorCore");
            }
        }

        async processFile(file, sourceLang, targetLang, onProgress) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const zip = await JSZip.loadAsync(arrayBuffer);
                let modifiedCount = 0;
                let totalFiles = 0;

                // Identificar archivos HTML relevantes
                const filesToProcess = [];
                zip.forEach((relativePath, zipEntry) => {
                    if (!zipEntry.dir && relativePath.endsWith('.html')) {
                        // Filtrar archivos de sistema de Storyline/RISE si es necesario
                        if (!relativePath.includes('__MACOSX') && !relativePath.startsWith('.')) {
                            filesToProcess.push(zipEntry);
                        }
                    }
                });

                totalFiles = filesToProcess.length;
                if (totalFiles === 0) {
                    throw new Error("No se encontraron archivos HTML válidos en el paquete.");
                }

                // Procesar archivos
                for (let i = 0; i < filesToProcess.length; i++) {
                    const entry = filesToProcess[i];
                    const content = await entry.async("string");
                    
                    // Verificar y limpiar traducciones previas
                    let cleanContent = content;
                    if (this.patch.hasExistingTranslation(content)) {
                        cleanContent = this.patch.removeExistingTranslation(content);
                    }

                    // Traducir contenido (simulado por bloques para no saturar API)
                    // En una implementación real, aquí parsearíamos el DOM y traduciríamos nodos de texto
                    // Para esta demo, traduciremos el cuerpo completo si es pequeño, o mostraremos un aviso
                    // NOTA: Traducir HTML crudo con regex es peligroso. Usaremos un enfoque simplificado.
                    
                    const translatedContent = await this.translateHtmlContent(cleanContent, sourceLang, targetLang);
                    
                    // Inyectar metadatos
                    const finalContent = this.patch.injectMetadata(translatedContent, sourceLang, targetLang);

                    zip.file(entry.name, finalContent);
                    modifiedCount++;

                    if (onProgress) {
                        onProgress(i + 1, totalFiles, entry.name);
                    }
                }

                // Generar nuevo ZIP
                const newBlob = await zip.generateAsync({
                    type: "blob",
                    compression: "DEFLATE",
                    compressionOptions: { level: 6 }
                });

                return {
                    success: true,
                    blob: newBlob,
                    stats: { modified: modifiedCount, total: totalFiles }
                };

            } catch (error) {
                console.error(error);
                return { success: false, error: error.message };
            }
        }

        async translateHtmlContent(html, source, target) {
            // Estrategia: Extraer texto, traducir, reinyectar.
            // Para mantener la estructura, usaremos un parser DOM virtual.
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Función recursiva para traducir nodos de texto
            const translateNode = async (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent.trim();
                    if (text.length > 0 && text.length < 5000) { // Límite de API
                        try {
                            const translated = await this.service.translateText(text, source, target);
                            node.textContent = translated;
                        } catch (e) {
                            console.warn("Fallo traducción nodo:", e);
                        }
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    // Ignorar scripts, estilos y atributos técnicos específicos de SCORM/JS
                    const tag = node.tagName.toLowerCase();
                    if (['script', 'style', 'svg'].includes(tag)) return;
                    
                    // No traducir atributos alt/title por ahora para simplificar, 
                    // pero se podría añadir aquí.
                    
                    for (let child of node.childNodes) {
                        await translateNode(child);
                    }
                }
            };

            // Traducir el body
            if (doc.body) {
                await translateNode(doc.body);
            }

            return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
        }
    }

    global.TranslatorCore = TranslatorCore;
    console.log('[SCORM-TRANSLATOR-CORE] Núcleo registrado.');

})(window);