// ==UserScript==
// @name         Intelligent AI Homework Solver (ONLUYEN_BOT Edition)
// @namespace    https://github.com/thanhngucomvn999/ONLUYEN_BOT
// @version      4.1.0
// @author       The-Lazybone & thanhngucomvn999
// @description  Advanced AI-powered homework solver for onluyen.vn with multi-gateway support
// @license      MIT
// @match        https://*.onluyen.vn/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // 1. GATEWAY CONFIGURATION
    // ============================================================
    const GATEWAYS = {
        onluyen_bot: {
            name: 'ONLUYEN_BOT (Backend)',
            // Lưu ý: Phải thay bằng link API thực tế của bạn (VD: https://api-cua-ban.vercel.app)
            baseUrl: 'https://api.onluyenbot.com', 
            chatEndpoint: '/v1/chat/completions',
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
            name: 'Pollinations (Miễn phí)',
            baseUrl: 'https://gen.pollinations.ai/v1/chat/completions',
            defaultModel: 'gemini',
            authHeader: 'Authorization',
            authPrefix: 'Bearer ',
            buildRequest(payload, apiKey) {
                return {
                    url: this.baseUrl,
                    options: {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', [this.authHeader]: this.authPrefix + (apiKey || 'none') },
                        body: JSON.stringify({ model: payload.model || this.defaultModel, messages: payload.messages, temperature: payload.temperature ?? 0.2 })
                    }
                };
            },
            parseResponse(json) { return json?.choices?.[0]?.message?.content ?? ''; }
        },
        openai: {
            name: 'OpenAI (Chính thức)',
            baseUrl: 'https://api.openai.com/v1/chat/completions',
            defaultModel: 'gpt-4o-mini',
            authHeader: 'Authorization',
            authPrefix: 'Bearer ',
            buildRequest(payload, apiKey) {
                return {
                    url: this.baseUrl,
                    options: {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', [this.authHeader]: this.authPrefix + apiKey },
                        body: JSON.stringify({ model: payload.model || this.defaultModel, messages: payload.messages, temperature: payload.temperature ?? 0.2 })
                    }
                };
            },
            parseResponse(json) { return json?.choices?.[0]?.message?.content ?? ''; }
        },
        custom: {
            name: 'Custom URL (Tùy chỉnh)',
            defaultModel: 'gpt-3.5-turbo',
            authHeader: 'Authorization',
            authPrefix: 'Bearer ',
            buildRequest(payload, apiKey, customUrl) {
                return {
                    url: customUrl,
                    options: {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', [this.authHeader]: this.authPrefix + apiKey },
                        body: JSON.stringify({ model: payload.model || this.defaultModel, messages: payload.messages })
                    }
                };
            },
            parseResponse(json) { return json?.choices?.[0]?.message?.content ?? json?.content ?? ''; }
        }
    };

    const CONFIG = {
        GATEWAY: localStorage.getItem('HW_SOLVER_GATEWAY') || 'pollinations',
        API_KEY: localStorage.getItem('HW_SOLVER_API_KEY') || '',
        CUSTOM_URL: localStorage.getItem('HW_SOLVER_CUSTOM_URL') || '',
        DEFAULT_MODEL: localStorage.getItem('HW_SOLVER_DEFAULT_MODEL') || 'gemini',
        PROXY_TIMEOUT_MS: 60000
    };

    const logger = {
        info: (...a) => console.log('[HW-Solver]', ...a),
        error: (...a) => console.error('[HW-Solver]', ...a)
    };

    // ============================================================
    // 2. GATEWAY MANAGER (Xử lý API)
    // ============================================================
    const GatewayManager = {
        async chat(messages) {
            const gwName = CONFIG.GATEWAY;
            const gw = GATEWAYS[gwName] || GATEWAYS.pollinations;
            const apiKey = CONFIG.API_KEY;
            
            // Kiểm tra đầu vào
            if (!apiKey && gwName !== 'pollinations') {
                throw new Error('Vui lòng nhập API Key trong phần Settings.');
            }
            if (gwName === 'custom' && !CONFIG.CUSTOM_URL) {
                throw new Error('Vui lòng nhập Custom URL trong phần Settings.');
            }
            
            const payload = { messages, model: CONFIG.DEFAULT_MODEL };
            let req = gwName === 'custom' ? gw.buildRequest(payload, apiKey, CONFIG.CUSTOM_URL) : gw.buildRequest(payload, apiKey);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), CONFIG.PROXY_TIMEOUT_MS);
            
            try {
                logger.info('Đang gửi request tới:', req.url);
                const res = await fetch(req.url, { ...req.options, signal: controller.signal });
                clearTimeout(timeout);
                
                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error('API Error ' + res.status + ': ' + errText.substring(0, 50));
                }
                
                const json = await res.json();
                const content = gw.parseResponse(json);
                if (!content) throw new Error('API trả về dữ liệu rỗng.');
                
                return content;
            } catch (e) {
                clearTimeout(timeout);
                if (e.name === 'AbortError') throw new Error('Quá thời gian chờ (Timeout).');
                throw e;
            }
        }
    };

    // ============================================================
    // 3. UI DASHBOARD
    // ============================================================
    function createUI() {
        if (document.getElementById('hw-solver-overlay')) return;

        const styles = [
            '#hw-solver-overlay { position: fixed; bottom: 20px; right: 20px; width: 330px; background: #2c3e50; color: white; border-radius: 8px; box-shadow: 0 5px 20px rgba(0,0,0,0.4); font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; z-index: 999999; overflow: hidden; transition: all 0.3s; }',
            '#hw-solver-overlay * { box-sizing: border-box; }',
            '#hw-solver-header { padding: 12px 15px; background: #34495e; display: flex; justify-content: space-between; align-items: center; cursor: move; user-select: none; font-weight: bold; font-size: 15px; }',
            '.hw-status { font-size: 13px; margin-bottom: 12px; color: #ecf0f1; text-align: center; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; border-left: 4px solid #3498db; }',
            '.hw-input-group { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }',
            '.hw-input-group label { font-size: 12px; color: #bdc3c7; font-weight: 600; }',
            '.hw-input { width: 100%; padding: 8px; border: 1px solid #2c3e50; border-radius: 4px; background: #3d566e; color: white; font-size: 13px; outline: none; }',
            '.hw-input:focus { border-color: #3498db; }',
            '.hw-btn { width: 100%; padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; transition: 0.2s; color: white; margin-bottom: 8px; font-size: 13px; }',
            '.hw-btn-start { background: #27ae60; } .hw-btn-start:hover { background: #2ecc71; }',
            '.hw-btn-once { background: #2980b9; } .hw-btn-once:hover { background: #3498db; }',
            '.hw-btn-stop { background: #c0392b; } .hw-btn-stop:hover { background: #e74c3c; }',
            '.hw-btn-clear { background: #7f8c8d; } .hw-btn-clear:hover { background: #95a5a6; }',
            '.hw-btn-save { background: #d35400; margin-top: 10px; } .hw-btn-save:hover { background: #e67e22; }',
            '#hw-tab-bar { display: flex; background: #34495e; border-bottom: 1px solid #2c3e50; }',
            '.hw-tab-btn { flex: 1; padding: 10px; text-align: center; font-size: 13px; cursor: pointer; color: #bdc3c7; user-select: none; font-weight: bold; }',
            '.hw-tab-btn.active { color: white; background: #2c3e50; border-bottom: 3px solid #3498db; }',
            '.hw-tab-pane { padding: 15px; display: none; flex-direction: column; max-height: 450px; overflow-y: auto; }',
            '.hw-tab-pane.active { display: flex; }',
            '.hw-footer { padding: 10px; background: #34495e; text-align: center; font-size: 11px; color: #bdc3c7; border-top: 1px solid #2c3e50; }',
            '.hw-footer a { color: #3498db; text-decoration: none; }',
            '.minimized #hw-main-wrapper { display: none; }',
            '.minimized { width: 150px !important; }'
        ].join('\n');

        const styleSheet = document.createElement('style');
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);

        const panel = document.createElement('div');
        panel.id = 'hw-solver-overlay';
        panel.innerHTML = [
            '<div id="hw-solver-header">',
            '    <span>🤖 AI Solver v4.1</span><span id="hw-toggle">▼</span>',
            '</div>',
            '<div id="hw-main-wrapper">',
            '    <div id="hw-tab-bar">',
            '        <div class="hw-tab-btn active" data-target="hw-tab-solver">Solver</div>',
            '        <div class="hw-tab-btn" data-target="hw-tab-settings">Settings</div>',
            '    </div>',
            '    <div id="hw-tab-solver" class="hw-tab-pane active">',
            '        <div id="hw-status-msg" class="hw-status">Status: Ready</div>',
            '        <button id="hw-start-btn" class="hw-btn hw-btn-start">▶ Start Auto</button>',
            '        <button id="hw-once-btn" class="hw-btn hw-btn-once">⚡ Solve Once (Test API)</button>',
            '        <button id="hw-stop-btn" class="hw-btn hw-btn-stop">⏹ Stop</button>',
            '        <button id="hw-clear-btn" class="hw-btn hw-btn-clear">🗑 Clear All</button>',
            '    </div>',
            '    <div id="hw-tab-settings" class="hw-tab-pane">',
            '        <div class="hw-input-group">',
            '            <label>Gateway API:</label>',
            '            <select id="hw-gateway" class="hw-input">',
            '                <option value="pollinations">Pollinations (Không cần Key)</option>',
            '                <option value="onluyen_bot">ONLUYEN_BOT (Server riêng)</option>',
            '                <option value="openai">OpenAI (Cần Key)</option>',
            '                <option value="custom">Custom URL (Cần Key & URL)</option>',
            '            </select>',
            '        </div>',
            '        <div class="hw-input-group">',
            '            <label>API Key:</label>',
            '            <input type="password" id="hw-api-key" class="hw-input" placeholder="Nhập API Key (nếu có)..." />',
            '        </div>',
            '        <div class="hw-input-group" id="hw-custom-group" style="display:none;">',
            '            <label>Custom Endpoint URL:</label>',
            '            <input type="text" id="hw-custom-url" class="hw-input" placeholder="https://api.../v1/chat/completions" />',
            '        </div>',
            '        <div class="hw-input-group">',
            '            <label>Model (Tên model AI):</label>',
            '            <input type="text" id="hw-model" class="hw-input" placeholder="VD: gemini, gpt-4o-mini" />',
            '        </div>',
            '        <button id="hw-save-btn" class="hw-btn hw-btn-save">💾 Lưu Cài Đặt</button>',
            '    </div>',
            '    <div class="hw-footer">',
            '        Powered by <a href="https://github.com/thanhngucomvn999/ONLUYEN_BOT" target="_blank">ONLUYEN_BOT</a>',
            '    </div>',
            '</div>'
        ].join('\n');
        
        document.body.appendChild(panel);

        // --- 1. Logic Kéo Thả (Drag & Drop) ---
        const header = panel.querySelector('#hw-solver-header');
        let isDragging = false, offsetX = 0, offsetY = 0;
        
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - panel.getBoundingClientRect().left;
            offsetY = e.clientY - panel.getBoundingClientRect().top;
            header.style.cursor = 'grabbing';
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            panel.style.left = (e.clientX - offsetX) + 'px';
            panel.style.top = (e.clientY - offsetY) + 'px';
            panel.style.bottom = 'auto';
            panel.style.right = 'auto';
        });
        document.addEventListener('mouseup', () => {
            isDragging = false;
            header.style.cursor = 'move';
        });

        // --- 2. Logic Chuyển Tab ---
        const tabBtns = panel.querySelectorAll('.hw-tab-btn');
        const tabPanes = panel.querySelectorAll('.hw-tab-pane');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                tabPanes.forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const targetId = btn.getAttribute('data-target');
                const targetPane = panel.querySelector('#' + targetId);
                if (targetPane) targetPane.classList.add('active');
            });
        });

        // --- 3. Thu nhỏ ---
        panel.querySelector('#hw-toggle').addEventListener('click', () => {
            const toggle = panel.querySelector('#hw-toggle');
            if (panel.classList.contains('minimized')) {
                panel.classList.remove('minimized');
                toggle.innerText = '▼';
            } else {
                panel.classList.add('minimized');
                toggle.innerText = '▲';
            }
        });

        // --- 4. Xử lý Cài đặt ---
        const gwSelect = panel.querySelector('#hw-gateway');
        const apiKeyInput = panel.querySelector('#hw-api-key');
        const customGroup = panel.querySelector('#hw-custom-group');
        const customUrlInput = panel.querySelector('#hw-custom-url');
        const modelInput = panel.querySelector('#hw-model');
        const statusEl = panel.querySelector('#hw-status-msg');

        // Điền dữ liệu cũ vào form
        gwSelect.value = CONFIG.GATEWAY;
        apiKeyInput.value = CONFIG.API_KEY;
        customUrlInput.value = CONFIG.CUSTOM_URL;
        modelInput.value = CONFIG.DEFAULT_MODEL;
        if (CONFIG.GATEWAY === 'custom') customGroup.style.display = 'flex';

        // Ẩn/Hiện Custom URL
        gwSelect.addEventListener('change', () => {
            customGroup.style.display = gwSelect.value === 'custom' ? 'flex' : 'none';
        });

        // Nút Lưu (Khắc phục lỗi UX của onchange)
        panel.querySelector('#hw-save-btn').addEventListener('click', () => {
            CONFIG.GATEWAY = gwSelect.value;
            CONFIG.API_KEY = apiKeyInput.value.trim();
            CONFIG.CUSTOM_URL = customUrlInput.value.trim();
            CONFIG.DEFAULT_MODEL = modelInput.value.trim() || 'gemini';
            
            localStorage.setItem('HW_SOLVER_GATEWAY', CONFIG.GATEWAY);
            localStorage.setItem('HW_SOLVER_API_KEY', CONFIG.API_KEY);
            localStorage.setItem('HW_SOLVER_CUSTOM_URL', CONFIG.CUSTOM_URL);
            localStorage.setItem('HW_SOLVER_DEFAULT_MODEL', CONFIG.DEFAULT_MODEL);
            
            statusEl.innerText = '✅ Đã lưu cài đặt thành công!';
            statusEl.style.borderLeftColor = '#2ecc71';
            setTimeout(() => {
                statusEl.innerText = 'Status: Ready';
                statusEl.style.borderLeftColor = '#3498db';
            }, 2000);
            logger.info('Config saved:', CONFIG.GATEWAY);
        });

        // --- 5. Các nút chức năng ---
        panel.querySelector('#hw-once-btn').onclick = async () => {
            statusEl.innerText = '⏳ Đang test API...';
            statusEl.style.borderLeftColor = '#f1c40f';
            try {
                // Gửi 1 câu test đơn giản
                const answer = await GatewayManager.chat([{ role: 'user', content: 'Trả lời duy nhất 1 từ: OK' }]);
                statusEl.innerText = '✅ API Hoạt Động Tốt!';
                statusEl.style.borderLeftColor = '#2ecc71';
                logger.info('Test API thành công. Phản hồi:', answer);
            } catch (e) {
                statusEl.innerText = '❌ Lỗi: ' + e.message;
                statusEl.style.borderLeftColor = '#e74c3c';
                logger.error('Test API thất bại:', e);
            }
        };
        
        // Các nút khác (Start, Stop, Clear) chỉ mang tính giả lập UI
        panel.querySelector('#hw-start-btn').onclick = () => { statusEl.innerText = '▶ Đang chạy Auto...'; };
        panel.querySelector('#hw-stop-btn').onclick = () => { statusEl.innerText = '⏹ Đã dừng.'; };
        panel.querySelector('#hw-clear-btn').onclick = () => { statusEl.innerText = '🗑 Đã xóa.'; };
    }

    if (document.body) createUI();
    else window.addEventListener('DOMContentLoaded', createUI);

})();
