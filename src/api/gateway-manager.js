import { CONFIG } from '../constants.js';
import { logger } from '../logger.js';

export const GATEWAYS = {
    onluyen_bot: {
        name: 'ONLUYEN_BOT (thanhngucomvn999)',
        baseUrl: 'https://raw.githubusercontent.com/thanhngucomvn999/ONLUYEN_BOT/main',
        chatEndpoint: '/api/chat',
        defaultModel: 'onluyen-v1',
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
        buildRequest(payload, apiKey) {
            return {
                url: this.baseUrl + this.chatEndpoint,
                options: {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', [this.authHeader]: this.authPrefix + apiKey },
                    body: JSON.stringify({ model: payload.model || this.defaultModel, messages: payload.messages, temperature: payload.temperature ?? 0.2, max_tokens: payload.max_tokens ?? 4096 })
                }
            };
        },
        parseResponse(json) { return json?.choices?.[0]?.message?.content ?? ''; }
    },
    pollinations: {
        name: 'Pollinations (legacy)',
        baseUrl: 'https://gen.pollinations.ai/v1/chat/completions',
        defaultModel: 'gemini',
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
        buildRequest(payload, apiKey) {
            return {
                url: this.baseUrl,
                options: {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', [this.authHeader]: this.authPrefix + apiKey },
                    body: JSON.stringify({ model: payload.model || this.defaultModel, messages: payload.messages, temperature: payload.temperature ?? 0.2, max_tokens: payload.max_tokens ?? 4096 })
                }
            };
        },
        parseResponse(json) { return json?.choices?.[0]?.message?.content ?? ''; }
    },
    openai: {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1/chat/completions',
        defaultModel: 'gpt-4o',
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
        buildRequest(payload, apiKey) {
            return {
                url: this.baseUrl,
                options: {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', [this.authHeader]: this.authPrefix + apiKey },
                    body: JSON.stringify({ model: payload.model || this.defaultModel, messages: payload.messages, temperature: payload.temperature ?? 0.2, max_tokens: payload.max_tokens ?? 4096 })
                }
            };
        },
        parseResponse(json) { return json?.choices?.[0]?.message?.content ?? ''; }
    },
    custom: {
        name: 'Custom (user endpoint)',
        defaultModel: 'gpt-4o',
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
        buildRequest(payload, apiKey, customUrl) {
            return {
                url: customUrl,
                options: {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', [this.authHeader]: this.authPrefix + apiKey },
                    body: JSON.stringify({ model: payload.model || this.defaultModel, messages: payload.messages, temperature: payload.temperature ?? 0.2, max_tokens: payload.max_tokens ?? 4096 })
                }
            };
        },
        parseResponse(json) { return json?.choices?.[0]?.message?.content ?? json?.content ?? ''; }
    }
};

export class GatewayManager {
    getGateway(name) { return GATEWAYS[name] || GATEWAYS.onluyen_bot; }

    async chat(messages, opts = {}) {
        const gwName = CONFIG.GATEWAY;
        const gw = this.getGateway(gwName);
        const apiKey = CONFIG.API_KEY;
        
        if (!apiKey && gwName !== 'pollinations') {
            throw new Error('Missing API key. Please configure in Settings.');
        }
        
        const model = opts.model || CONFIG.DEFAULT_MODEL || gw.defaultModel;
        const payload = { messages, model, temperature: opts.temperature, max_tokens: opts.max_tokens };
        
        let req;
        if (gwName === 'custom') {
            if (!CONFIG.CUSTOM_URL) throw new Error('Missing Custom URL in Settings.');
            req = gw.buildRequest(payload, apiKey, CONFIG.CUSTOM_URL);
        } else {
            req = gw.buildRequest(payload, apiKey);
        }

        logger.info(`Calling gateway: ${gw.name} | model: ${model}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), CONFIG.PROXY_TIMEOUT_MS);
        
        try {
            const res = await fetch(req.url, { ...req.options, signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
            }
            const json = await res.json();
            const content = gw.parseResponse(json);
            if (!content) throw new Error('Empty response from gateway.');
            logger.info('Response received.');
            return content;
        } catch (e) {
            clearTimeout(timeout);
            logger.error(`Gateway error (${gw.name}): ${e.message}`);
            throw e;
        }
    }
}
