// ==UserScript==
// @name         Intelligent AI Homework Solver (ONLUYEN_BOT Edition)
// @namespace    https://github.com/thanhngucomvn999/ONLUYEN_BOT
// @version      3.0.0
// @author       The-Lazybone & thanhngucomvn999
// @description  Advanced AI-powered homework solver for onluyen.vn with multi-gateway support
// @license      MIT
// @match        https://*.onluyen.vn/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const GATEWAYS = {
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

    const CONFIG = {
        GATEWAY: localStorage.getItem('HW_SOLVER_GATEWAY') || 'onluyen_bot',
        API_KEY: localStorage.getItem('HW_SOLVER_API_KEY') || '',
        CUSTOM_URL: localStorage.getItem('HW_SOLVER_CUSTOM_URL') || '',
        DEFAULT_MODEL: localStorage.getItem('HW_SOLVER_DEFAULT_MODEL') || 'gemini',
        PROXY_TIMEOUT_MS: 300000
    };

    const logger = {
        info: (...a) => console.log('[HW-Solver]', ...a),
        error: (...a) => console.error('[HW-Solver]', ...a)
    };

    const GatewayManager = {
        async chat(messages) {
            const gwName = CONFIG.GATEWAY;
            const gw = GATEWAYS[gwName] || GATEWAYS.onluyen_bot;
            const apiKey = CONFIG.API_KEY;
            
            if (!apiKey && gwName !== 'pollinations') {
                throw new Error('Vui lòng nhập API Key trong Settings.');
            }
            
            const payload = { messages, model: CONFIG.DEFAULT_MODEL };
            let req = gwName === 'custom' ? gw.buildRequest(payload, apiKey, CONFIG.CUSTOM_URL) : gw.buildRequest(payload, apiKey);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), CONFIG.PROXY_TIMEOUT_MS);
            
            try {
                const res = await fetch(req.url, { ...req.options, signal: controller.signal });
                clearTimeout(timeout);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const json = await res.json();
                return gw.parseResponse(json);
            } catch (e) {
                clearTimeout(timeout);
                throw e;
            }
        }
    };

    function createUI() {
        if (document.getElementById('hw-solver-panel')) return;

        const style = document.createElement('style');
        style.innerText = [
            '#hw-solver-panel { position:fixed; top:20px; right:20px; width:320px; background:#1e1e2e; color:#cdd6f4; border-radius:12px; box-shadow:0 8px 32px rgba(0,0,0,0.5); font-family:sans-serif; font-size:13px; z-index:999999; overflow:hidden; }',
            '.hw-header { padding:10px 14px; background:#313244; display:flex; justify-content:space-between; cursor:move; }',
            '.hw-body { padding:12px 14px; }',
            '.hw-input-group { margin-bottom:8px; display:flex; flex-direction:column; gap:4px; }',
            '.hw-input { padding:6px; border-radius:6px; border:1px solid #45475a; background:#181825; color:#cdd6f4; }',
            '.hw-btn { padding:8px; border:none; border-radius:6px; font-weight:bold; cursor:pointer; color:#1e1e2e; background:#a6e3a1; width:100%; margin-top:5px; }'
        ].join('\n');
        document.head.appendChild(style);

        const panel = document.createElement('div');
        panel.id = 'hw-solver-panel';
        panel.innerHTML = [
            '<div class="hw-header">',
            '    <span style="font-weight:bold;">🤖 AI Solver v3.0</span>',
            '    <button id="hw-close" style="background:none;border:none;color:#cdd6f4;cursor:pointer;">✖</button>',
            '</div>',
            '<div class="hw-body">',
            '    <div class="hw-input-group">',
            '        <label>Gateway:</label>',
            '        <select id="hw-gw" class="hw-input">',
            '            <option value="onluyen_bot">ONLUYEN_BOT</option>',
            '            <option value="pollinations">Pollinations</option>',
            '            <option value="openai">OpenAI</option>',
            '            <option value="custom">Custom</option>',
            '        </select>',
            '    </div>',
            '    <div class="hw-input-group">',
            '        <label>API Key:</label>',
            '        <input type="password" id="hw-key" class="hw-input" placeholder="Nhập API Key..." />',
            '    </div>',
            '    <div class="hw-input-group" id="hw-custom-wrap" style="display:none;">',
            '        <label>Custom URL:</label>',
            '        <input type="text" id="hw-url" class="hw-input" placeholder="https://..." />',
            '    </div>',
            '    <button id="hw-save" class="hw-btn">💾 Lưu Cài Đặt</button>',
            '    <div style="margin-top:10px; font-size:11px; color:#a6adc8;" id="hw-status">Sẵn sàng.</div>',
            '</div>'
        ].join('\n');
        document.body.appendChild(panel);

        const gwSelect = document.getElementById('hw-gw');
        const keyInput = document.getElementById('hw-key');
        const urlWrap = document.getElementById('hw-custom-wrap');
        const urlInput = document.getElementById('hw-url');
        const statusEl = document.getElementById('hw-status');

        gwSelect.value = CONFIG.GATEWAY;
        keyInput.value = CONFIG.API_KEY;
        urlInput.value = CONFIG.CUSTOM_URL;
        if (CONFIG.GATEWAY === 'custom') urlWrap.style.display = 'flex';

        gwSelect.onchange = () => { urlWrap.style.display = gwSelect.value === 'custom' ? 'flex' : 'none'; };
        document.getElementById('hw-close').onclick = () => panel.style.display = 'none';
        
        document.getElementById('hw-save').onclick = () => {
            CONFIG.GATEWAY = gwSelect.value;
            CONFIG.API_KEY = keyInput.value.trim();
            CONFIG.CUSTOM_URL = urlInput.value.trim();
            
            localStorage.setItem('HW_SOLVER_GATEWAY', CONFIG.GATEWAY);
            localStorage.setItem('HW_SOLVER_API_KEY', CONFIG.API_KEY);
            localStorage.setItem('HW_SOLVER_CUSTOM_URL', CONFIG.CUSTOM_URL);
            
            statusEl.innerText = '✅ Đã lưu cài đặt!';
            statusEl.style.color = '#a6e3a1';
            setTimeout(() => statusEl.innerText = 'Sẵn sàng.', 2000);
        };

        let isDragging = false, offsetX, offsetY;
        panel.querySelector('.hw-header').onmousedown = (e) => {
            isDragging = true;
            offsetX = e.clientX - panel.getBoundingClientRect().left;
            offsetY = e.clientY - panel.getBoundingClientRect().top;
        };
        document.onmousemove = (e) => {
            if (!isDragging) return;
            panel.style.left = (e.clientX - offsetX) + 'px';
            panel.style.top = (e.clientY - offsetY) + 'px';
            panel.style.right = 'auto';
        };
        document.onmouseup = () => { isDragging = false; };
    }

    if (document.body) createUI();
    else window.addEventListener('DOMContentLoaded', createUI);

    logger.info('AI Solver started!');
})();
