/**
 * Parche de inyección de metadatos para SCORM traducido
 */
(function(global) {
    'use strict';

    const CONFIG = {
        patchSignaturePrefix: 'MAINJOBS',
        patchVersion: '1.0.0'
    };

    class TranslatorPatch {
        constructor() {
            this.signatureStart = `<!-- ${CONFIG.patchSignaturePrefix} TRANSLATION v${CONFIG.patchVersion} START -->`;
            this.signatureEnd = `<!-- ${CONFIG.patchSignaturePrefix} TRANSLATION v${CONFIG.patchVersion} END -->`;
            this.markerRegex = /<!--\s*MAINJOBS\s+TRANSLATION(?:\s+v[\d.]+)?\s+START\s*-->/i;
        }

        hasExistingTranslation(html) {
            return this.markerRegex.test(html);
        }

        removeExistingTranslation(html) {
            // Eliminar bloque completo de metadatos antiguos
            const regex = new RegExp(
                `<!--\\s*${CONFIG.patchSignaturePrefix}\\s+TRANSLATION[\\s\\S]*?-->\\s*.*?<!--\\s*${CONFIG.patchSignaturePrefix}\\s+TRANSLATION[\\s\\S]*?END\\s*-->`,
                'gi'
            );
            // Aproximación más segura: buscar el bloque START hasta END
            const blockRegex = /<!--\s*MAINJOBS\s+TRANSLATION[\s\S]*?END\s*-->/gi;
            return html.replace(blockRegex, '');
        }

        buildMetadata(sourceLang, targetLang) {
            const date = new Date().toISOString();
            return `
${this.signatureStart}
<!-- Source Language: ${sourceLang} -->
<!-- Target Language: ${targetLang} -->
<!-- Translation Date: ${date} -->
<!-- Tool: MainJobs SCORM Translator -->
${this.signatureEnd}`;
        }

        injectMetadata(html, metadata) {
            // Inyectar justo después de <head> o <html>
            if (html.includes('<head>')) {
                return html.replace('<head>', `<head>\n${metadata}`);
            }
            if (html.includes('<html')) {
                return html.replace(/<html[^>]*>/i, match => `${match}\n${metadata}`);
            }
            return metadata + '\n' + html;
        }
    }

    global.TranslatorPatch = TranslatorPatch;
    console.log('[SCORM-TRANSLATOR-PATCH] Módulo de parche registrado.');

})(window);