/**
 * Servicio de Traducción SCORM
 * Soporta LibreTranslate (auto-hospedado o público) y MyMemory (API gratuita limitada)
 */

(function(global) {
    'use strict';

    const LANGUAGES = [
        { code: 'es', name: 'Español' },
        { code: 'en', name: 'Inglés' },
        { code: 'ca', name: 'Catalán' },
        { code: 'eu', name: 'Euskera' },
        { code: 'gl', name: 'Gallego' },
        { code: 'fr', name: 'Francés' },
        { code: 'de', name: 'Alemán' },
        { code: 'pt', name: 'Portugués' },
        { code: 'it', name: 'Italiano' },
        { code: 'ru', name: 'Ruso' },
        { code: 'zh', name: 'Chino' },
        { code: 'ja', name: 'Japonés' },
        { code: 'ar', name: 'Árabe' }
    ];

    class TranslationService {
        constructor() {
            this.serviceName = 'LibreTranslate (Público)';
            // Usamos una instancia pública de LibreTranslate si está disponible, 
            // o fallback a MyMemory si falla.
            this.endpoints = {
                libre: 'https://libretranslate.com/translate',
                mymemory: 'https://api.mymemory.translated.net/get'
            };
            // Rate limiting para evitar bloqueos 429
            this.requestDelay = 2000; // 2 segundos entre peticiones
            this.lastRequestTime = 0;
        }

        getSupportedLanguages() {
            return LANGUAGES;
        }

        async detectLanguage(text) {
            // Detección simple basada en librerías externas o heurística básica
            // Para esta versión, asumimos que el usuario selecciona o devolvemos 'auto'
            return 'auto'; 
        }

        // Espera el tiempo necesario para respetar el rate limiting
        async waitForRateLimit() {
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            if (timeSinceLastRequest < this.requestDelay) {
                await new Promise(resolve => 
                    setTimeout(resolve, this.requestDelay - timeSinceLastRequest)
                );
            }
            this.lastRequestTime = Date.now();
        }

        async translateText(text, sourceLang, targetLang) {
            if (!text || text.trim() === '') return text;

            // Respetar rate limiting
            await this.waitForRateLimit();

            // Intento 1: LibreTranslate
            try {
                const response = await fetch(this.endpoints.libre, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        q: text,
                        source: sourceLang === 'auto' ? 'auto' : sourceLang,
                        target: targetLang,
                        format: 'html' // Importante para SCORM
                    })
                });

                if (!response.ok) throw new Error(`LibreTranslate error: ${response.status}`);
                const data = await response.json();
                if (data.error) throw new Error(data.error);
                return data.translatedText;
            } catch (e) {
                console.warn('LibreTranslate falló, intentando MyMemory...', e);
                
                // Esperar antes de intentar con MyMemory
                await this.waitForRateLimit();
                
                // Intento 2: MyMemory (No requiere key para uso bajo, pero tiene límites)
                try {
                    const pair = `${sourceLang}|${targetLang}`;
                    const url = `${this.endpoints.mymemory}?q=${encodeURIComponent(text)}&langpair=${pair}`;
                    const response = await fetch(url);
                    const data = await response.json();
                    
                    if (data.responseStatus !== 200) {
                        throw new Error(data.responseDetails || 'MyMemory error');
                    }
                    return data.responseData.translatedText;
                } catch (e2) {
                    console.error('Todos los servicios de traducción fallaron.', e2);
                    throw new Error('Servicio de traducción no disponible temporalmente.');
                }
            }
        }
    }

    // Exponer globalmente
    global.TranslationService = TranslationService;
    console.log('[SCORM-TRANSLATOR] Servicio de traducción registrado.');

})(window);