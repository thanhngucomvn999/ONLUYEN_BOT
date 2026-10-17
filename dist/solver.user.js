// ==UserScript==
// @name         Intelligent AI Homework Solver (ONLUYEN_BOT Edition)
// @namespace    https://github.com/thanhngucomvn999/ONLUYEN_BOT
// @version      3.1.0
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
            name: 'ONLUYEN_BOT',
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
            name: 'Pollinations',
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
            name: 'Custom',
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
        if (document.getElementById('hw-solver-overlay')) return;

        const styles = [
            '#hw-solver-overlay { position: fixed; bottom: 20px; right: 20px; width: 260px; background: #2c3e50; color: white; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; z-index: 999999; overflow: hidden; transition: all 0.3s ease; }',
            '#hw-solver-header { padding: 10px; background: #34495e; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; }',
            '#hw-solver-status { font-size: 14px; font-weight: bold; margin-bottom: 5px; color: #ecf0f1; }',
            '.hw-input-group { display: flex; flex-direction: column; gap: 5px; margin-bottom: 5px; }',
            '.hw-input-group label { font-size: 11px; color: #bdc3c7; }',
            '.hw-key-input, .hw-select { padding: 6px; border: 1px solid #34495e; border-radius: 4px; background: #3d566e; color: white; font-size: 12px; }',
            '.hw-btn { padding: 8px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.2s; color: white; margin-bottom: 5px; }',
            '.hw-btn-start { background: #27ae60; } .hw-btn-start:hover { background: #2ecc71; }',
            '.hw-btn-once { background: #2980b9; } .hw-btn-once:hover { background: #3498db; }',
            '.hw-btn-stop { background: #c0392b; } .hw-btn-stop:hover { background: #e74c3c; }',
            '.hw-btn-clear { background: #7f8c8d; } .hw-btn-clear:hover { background: #95a5a6; }',
            '#hw-tab-bar { display: flex; background: #34495e; border-bottom: 1px solid #2c3e50; }',
            '.hw-tab { flex: 1; padding: 8px; text-align: center; font-size: 11px; cursor: pointer; color: #bdc3c7; transition: all 0.2s; }',
            '.hw-tab.active { color: white; background: #2c3e50; border-bottom: 2px solid #3498db; }',
            '.hw-tab-content { padding: 15px; display: none; flex-direction: column; gap: 10px; max-height: 400px; overflow-y: auto; }',
            '.hw-tab-content.active { display: flex; }',
            '.hw-checkbox-group { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #ecf0f1; cursor: pointer; margin-top: 5px; }',
            '.hw-checkbox-group input { cursor: pointer; }',
            '.hw-footer { padding: 8px; background: #34495e; text-align: center; font-size: 10px; color: #bdc3c7; border-top: 1px solid #2c3e50; }',
            '.hw-footer a { color: #3498db; text-decoration: none; }',
            '.hw-footer a:hover { text-decoration: underline; }',
            '.minimized { height: 40px !important; width: 140px !important; }',
            '.minimized #hw-tab-bar, .minimized .hw-tab-content, .minimized .hw-footer { display: none !important; }'
        ].join('\n');

        const styleSheet = document.createElement('style');
        styleSheet.id = 'hw-solver-styles';
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);

        const panel = document.createElement('div');
        panel.id = 'hw-solver-overlay';
        panel.innerHTML = [
            '<div id="hw-solver-header">',
            '    AI Solver <span id="hw-solver-toggle">▼</span>',
            '</div>',
            '<div id="hw-solver-content">',
            '    <div id="hw-tab-bar">',
            '        <div class="hw-tab active" data-tab="solver">Solver</div>',
            '        <div class="hw-tab" data-tab="settings">Settings</div>',
            '    </div>',
            '    <div id="hw-solver-content-tab" class="hw-tab-content active">',
            '        <div id="hw-solver-status">Status: Ready</div>',
            '        <button id="hw-start-btn" class="hw-btn hw-btn-start">Start Auto</button>',
            '        <button id="hw-once-btn" class="hw-btn hw-btn-once">Solve Once</button>',
            '        <button id="hw-stop-btn" class="hw-btn hw-btn-stop">Stop</button>',
            '        <button id="hw-clear-btn" class="hw-btn hw-btn-clear">Clear All</button>',
            '    </div>',
            '    <div id="hw-settings-content" class="hw-tab-content">',
            '        <div class="hw-input-group">',
            '            <label>Gateway:</label>',
            '            <select id="hw-gateway-select" class="hw-select">',
            '                <option value="onluyen_bot">ONLUYEN_BOT</option>',
            '                <option value="pollinations">Pollinations</option>',
            '                <option value="openai">OpenAI</option>',
            '                <option value="custom">Custom</option>',
            '            </select>',
            '        </div>',
            '        <div class="hw-input-group">',
            '            <label>API Key:</label>',
            '            <input type="password" id="hw-api-key" class="hw-key-input" placeholder="Nhập API Key..." />',
            '        </div>',
            '        <div class="hw-input-group" id="hw-custom-url-group" style="display:none;">',
            '            <label>Custom Endpoint URL:</label>',
            '            <input type="text" id="hw-custom-url" class="hw-key-input" placeholder="https://..." />',
            '        </div>',
            '        <div class="hw-input-group">',
            '            <label>Text Model:</label>',
            '            <input type="text" id="hw-text-model" class="hw-key-input" placeholder="gemini" />',
            '        </div>',
            '        <div class="hw-input-group">',
            '            <label>Vision Model:</label>',
            '            <input type="text" id="hw-vision-model" class="hw-key-input" placeholder="gemini" />',
            '        </div>',
            '        <div class="hw-input-group">',
            '            <label>Idle Threshold (Cycles):</label>',
            '            <input type="number" id="hw-idle-threshold" class="hw-key-input" value="10" />',
            '        </div>',
            '        <label class="hw-checkbox-group">',
            '            <input type="checkbox" id="hw-instant-mode" /> Instant Mode',
            '        </label>',
            '        <label class="hw-checkbox-group">',
            '            <input type="checkbox" id="hw-think-mode" /> Reasoning',
            '        </label>',
            '    </div>',
            '    <div class="hw-footer">',
            '        Powered by <a href="https://github.com/thanhngucomvn999/ONLUYEN_BOT" target="_blank">ONLUYEN_BOT</a>',
            '    </div>',
            '</div>'
        ].join('\n');
        
        document.body.appendChild(panel);

        const statusEl = panel.querySelector('#hw-solver-status');

        // Tab switching
        panel.querySelectorAll('.hw-tab').forEach(tab => {
            tab.onclick = () => {
                panel.querySelectorAll('.hw-tab').forEach(t => t.classList.remove('active'));
                panel.querySelectorAll('.hw-tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                panel.querySelector('#hw-' + tab.dataset.tab + '-content').classList.add('active');
            };
        });

        // Minimize
        panel.querySelector('#hw-solver-header').onclick = () => {
            const content = panel.querySelector('#hw-solver-content');
            const toggle = panel.querySelector('#hw-solver-toggle');
            if (panel.classList.contains('minimized')) {
                panel.classList.remove('minimized');
                content.style.display = 'flex';
                toggle.innerText = '▼';
            } else {
                panel.classList.add('minimized');
                content.style.display = 'none';
                toggle.innerText = '▲';
            }
        };

        // Buttons
        panel.querySelector('#hw-start-btn').onclick = () => { logger.info('Start Auto clicked'); statusEl.innerText = 'Status: Running...'; };
        panel.querySelector('#hw-once-btn').onclick = async () => {
            statusEl.innerText = 'Status: Solving...';
            try {
                const answer = await GatewayManager.chat([{ role: 'user', content: 'Test gateway' }]);
                statusEl.innerText = 'Status: OK';
                logger.info('Gateway response:', answer);
            } catch (e) {
                statusEl.innerText = 'Status: Error';
                logger.error(e.message);
            }
        };
        panel.querySelector('#hw-stop-btn').onclick = () => { logger.info('Stop clicked'); statusEl.innerText = 'Status: Stopped'; };
        panel.querySelector('#hw-clear-btn').onclick = () => { logger.info('Clear All clicked'); statusEl.innerText = 'Status: Cleared'; };

        // Settings Logic
        const gwSelect = panel.querySelector('#hw-gateway-select');
        const apiKeyInput = panel.querySelector('#hw-api-key');
        const customUrlGroup = panel.querySelector('#hw-custom-url-group');
        const customUrlInput = panel.querySelector('#hw-custom-url');
        const textModelInput = panel.querySelector('#hw-text-model');
        const visionModelInput = panel.querySelector('#hw-vision-model');
        const idleThresholdInput = panel.querySelector('#hw-idle-threshold');
        const instantModeCheck = panel.querySelector('#hw-instant-mode');
        const thinkModeCheck = panel.querySelector('#hw-think-mode');

        // Load config
        gwSelect.value = CONFIG.GATEWAY;
        apiKeyInput.value = CONFIG.API_KEY;
        customUrlInput.value = CONFIG.CUSTOM_URL;
        if (CONFIG.GATEWAY === 'custom') customUrlGroup.style.display = 'flex';

        const saveSettings = () => {
            CONFIG.GATEWAY = gwSelect.value;
            CONFIG.API_KEY = apiKeyInput.value.trim();
            CONFIG.CUSTOM_URL = customUrlInput.value.trim();
            
            localStorage.setItem('HW_SOLVER_GATEWAY', CONFIG.GATEWAY);
            localStorage.setItem('HW_SOLVER_API_KEY', CONFIG.API_KEY);
            localStorage.setItem('HW_SOLVER_CUSTOM_URL', CONFIG.CUSTOM_URL);
            
            logger.info('Settings saved.');
            statusEl.innerText = 'Status: Settings Saved';
            statusEl.style.color = '#2ecc71';
            setTimeout(() => {
                statusEl.innerText = 'Status: Ready';
                statusEl.style.color = '#ecf0f1';
            }, 2000);
        };

        gwSelect.onchange = () => {
            customUrlGroup.style.display = gwSelect.value === 'custom' ? 'flex' : 'none';
            saveSettings();
        };
        apiKeyInput.onchange = saveSettings;
        customUrlInput.onchange = saveSettings;
        textModelInput.onchange = saveSettings;
        visionModelInput.onchange = saveSettings;
        idleThresholdInput.onchange = saveSettings;
        instantModeCheck.onchange = saveSettings;
        thinkModeCheck.onchange = saveSettings;
    }

    if (document.body) createUI();
    else window.addEventListener('DOMContentLoaded', createUI);

    logger.info('AI Solver v3.1.0 (ONLUYEN_BOT Edition) started.');
})();
