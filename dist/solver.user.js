// ==UserScript==
// @name         Intelligent AI Homework Solver (ONLUYEN_BOT Edition)
// @namespace    https://github.com/thanhngucomvn999/ONLUYEN_BOT
// @version      5.0.0
// @description  Tự động quét câu hỏi, gọi AI và click đáp án
// @match        https://*.onluyen.vn/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const GATEWAYS = {
        pollinations: {
            name: 'Pollinations (Miễn phí)',
            baseUrl: 'https://gen.pollinations.ai/v1/chat/completions',
            defaultModel: 'gemini',
            buildRequest(messages) {
                return {
                    url: this.baseUrl,
                    options: {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ model: this.defaultModel, messages: messages, temperature: 0.1 })
                    }
                };
            },
            parseResponse(json) { return json?.choices?.[0]?.message?.content ?? ''; }
        },
        openai: {
            name: 'OpenAI (Cần Key)',
            baseUrl: 'https://api.openai.com/v1/chat/completions',
            defaultModel: 'gpt-4o-mini',
            buildRequest(messages, apiKey) {
                return {
                    url: this.baseUrl,
                    options: {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
                        body: JSON.stringify({ model: this.defaultModel, messages: messages })
                    }
                };
            },
            parseResponse(json) { return json?.choices?.[0]?.message?.content ?? ''; }
        }
    };

    const CONFIG = {
        GATEWAY: localStorage.getItem('HW_GATEWAY') || 'pollinations',
        API_KEY: localStorage.getItem('HW_API_KEY') || '',
        AUTO_DELAY: 3000 // Chờ 3 giây trước khi click câu tiếp
    };

    const logger = {
        info: (...a) => console.log('[HW-Solver]', ...a),
        error: (...a) => console.error('[HW-Solver]', ...a)
    };

    // ============================================================
    // 1. GATEWAY MANAGER (Gọi AI)
    // ============================================================
    const GatewayManager = {
        async askAI(prompt) {
            const gw = GATEWAYS[CONFIG.GATEWAY] || GATEWAYS.pollinations;
            const messages = [
                { role: 'system', content: 'Bạn là chuyên gia giải bài tập. Hãy đọc kỹ đề bài và đưa ra đáp án chính xác nhất. Nếu là trắc nghiệm, CHỈ trả về nội dung của đáp án đúng (không giải thích, không ghi A/B/C).' },
                { role: 'user', content: prompt }
            ];

            const req = gw.buildRequest(messages, CONFIG.API_KEY);
            const res = await fetch(req.url, req.options);
            if (!res.ok) throw new Error('Lỗi gọi API: ' + res.status);
            const json = await res.json();
            return gw.parseResponse(json).trim();
        }
    };

    // ============================================================
    // 2. LÕI XỬ LÝ BÀI TẬP (SCRAPER & CLICKER)
    // ============================================================
    const SolverCore = {
        isRunning: false,
        loopInterval: null,

        // Lấy nội dung câu hỏi
        getQuestionText() {
            // Các selector phổ biến trên onluyen.vn
            const questionEl = document.querySelector('.question-content, .question-title, .q-text, .question-text');
            if (questionEl) return questionEl.innerText.trim();
            
            // Fallback: Lấy toàn bộ text ở khu vực làm bài
            const mainContent = document.querySelector('.main-content, .exam-content');
            return mainContent ? mainContent.innerText.trim() : null;
        },

        // Thực hiện click / điền đáp án
        async fillAnswer(answerText) {
            // 1. Xử lý trắc nghiệm (Radio buttons)
            const choices = document.querySelectorAll('.choice-item, .answer-item, label.radio, .option-item');
            if (choices.length > 0) {
                for (let choice of choices) {
                    if (choice.innerText.toLowerCase().includes(answerText.toLowerCase())) {
                        // Click vào label hoặc input bên trong
                        const input = choice.querySelector('input[type="radio"]') || choice;
                        input.click();
                        return 'Đã click trắc nghiệm: ' + choice.innerText.substring(0, 30);
                    }
                }
                // Nếu không tìm thấy text khớp, click đại option đầu tiên (phòng hờ)
                choices[0].click();
                return 'Không khớp đáp án, click mặc định option 1';
            }

            // 2. Xử lý điền từ (Text Input / Textarea)
            const inputField = document.querySelector('input[type="text"].answer-input, textarea.answer-input, .fill-in-blank input');
            if (inputField) {
                inputField.value = answerText;
                inputField.dispatchEvent(new Event('input', { bubbles: true }));
                return 'Đã điền vào ô trống: ' + answerText;
            }

            return 'Không tìm thấy phần tử để click/điền!';
        },

        // Chuyển câu tiếp theo
        clickNext() {
            const nextBtn = document.querySelector('.btn-next, .next-question, button[title="Câu tiếp"], .btn-submit');
            if (nextBtn) {
                nextBtn.click();
                return true;
            }
            return false;
        },

        // Luồng chạy chính
        async solveCurrentQuestion(uiUpdater) {
            try {
                uiUpdater('⏳ Đang đọc đề bài...');
                const question = this.getQuestionText();
                
                if (!question) {
                    uiUpdater('❌ Không tìm thấy câu hỏi trên màn hình.', 'error');
                    return false;
                }

                uiUpdater('🧠 AI đang suy nghĩ...');
                const answer = await GatewayManager.askAI(question);
                
                uiUpdater('🖱 Đang chọn đáp án: ' + answer.substring(0, 20) + '...');
                const clickResult = await this.fillAnswer(answer);
                
                uiUpdater('✅ ' + clickResult, 'success');

                // Đợi 1 chút rồi chuyển câu
                setTimeout(() => {
                    if (this.clickNext()) {
                        uiUpdater('➡️ Đã chuyển câu tiếp theo');
                    } else {
                        uiUpdater('🏁 Đã hoàn thành bài thi (Không có nút Next)', 'success');
                        this.stop();
                    }
                }, CONFIG.AUTO_DELAY);

                return true;
            } catch (e) {
                uiUpdater('❌ Lỗi: ' + e.message, 'error');
                return false;
            }
        },

        start(uiUpdater) {
            if (this.isRunning) return;
            this.isRunning = true;
            
            const runLoop = async () => {
                if (!this.isRunning) return;
                const success = await this.solveCurrentQuestion(uiUpdater);
                if (success && this.isRunning) {
                    // Lặp lại sau khoảng thời gian (chờ trang load câu mới)
                    this.loopInterval = setTimeout(runLoop, 5000);
                }
            };
            
            runLoop();
        },

        stop(uiUpdater) {
            this.isRunning = false;
            clearTimeout(this.loopInterval);
            if (uiUpdater) uiUpdater('⏹ Đã dừng tự động.');
        }
    };

    // ============================================================
    // 3. UI DASHBOARD
    // ============================================================
    function createUI() {
        if (document.getElementById('hw-solver-overlay')) return;

        const panel = document.createElement('div');
        panel.id = 'hw-solver-overlay';
        panel.style.cssText = 'position:fixed; bottom:20px; right:20px; width:320px; background:#2c3e50; color:white; border-radius:8px; box-shadow:0 5px 20px rgba(0,0,0,0.4); font-family:sans-serif; z-index:999999; overflow:hidden;';
        
        panel.innerHTML = [
            '<div style="padding:10px; background:#34495e; font-weight:bold; cursor:move;" id="hw-drag">🤖 AI Solver v5.0</div>',
            '<div style="padding:15px;">',
            '    <div id="hw-status" style="font-size:13px; margin-bottom:10px; padding:8px; background:rgba(0,0,0,0.2); border-left:4px solid #3498db;">Status: Ready</div>',
            '    <button id="hw-start" style="width:100%; padding:10px; margin-bottom:8px; background:#27ae60; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">▶ Start Auto</button>',
            '    <button id="hw-stop" style="width:100%; padding:10px; margin-bottom:15px; background:#c0392b; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">⏹ Stop</button>',
            '    <div style="font-size:11px; margin-bottom:5px;">Gateway API:</div>',
            '    <select id="hw-gw" style="width:100%; padding:8px; margin-bottom:10px; border-radius:4px; border:none;">',
            '        <option value="pollinations">Pollinations (Miễn phí)</option>',
            '        <option value="openai">OpenAI (Cần Key)</option>',
            '    </select>',
            '    <div style="font-size:11px; margin-bottom:5px;">API Key (Nếu dùng OpenAI):</div>',
            '    <input type="password" id="hw-key" style="width:100%; padding:8px; margin-bottom:10px; border-radius:4px; border:none;" placeholder="sk-..." />',
            '    <button id="hw-save" style="width:100%; padding:8px; background:#d35400; color:white; border:none; border-radius:4px; cursor:pointer;">💾 Lưu Cài Đặt</button>',
            '</div>'
        ].join('');
        
        document.body.appendChild(panel);

        const statusEl = document.getElementById('hw-status');
        const updateStatus = (text, type) => {
            statusEl.innerText = text;
            statusEl.style.borderLeftColor = type === 'error' ? '#e74c3c' : (type === 'success' ? '#2ecc71' : '#3498db');
        };

        // Load config
        const gwSelect = document.getElementById('hw-gw');
        const keyInput = document.getElementById('hw-key');
        gwSelect.value = CONFIG.GATEWAY;
        keyInput.value = CONFIG.API_KEY;

        document.getElementById('hw-save').onclick = () => {
            CONFIG.GATEWAY = gwSelect.value;
            CONFIG.API_KEY = keyInput.value.trim();
            localStorage.setItem('HW_GATEWAY', CONFIG.GATEWAY);
            localStorage.setItem('HW_API_KEY', CONFIG.API_KEY);
            updateStatus('✅ Đã lưu cài đặt!', 'success');
        };

        document.getElementById('hw-start').onclick = () => {
            updateStatus('▶ Bắt đầu chạy Auto...');
            SolverCore.start(updateStatus);
        };

        document.getElementById('hw-stop').onclick = () => {
            SolverCore.stop(updateStatus);
        };

        // Drag & Drop
        const drag = document.getElementById('hw-drag');
        let isDragging = false, offsetX, offsetY;
        drag.onmousedown = (e) => {
            isDragging = true;
            offsetX = e.clientX - panel.getBoundingClientRect().left;
            offsetY = e.clientY - panel.getBoundingClientRect().top;
        };
        document.onmousemove = (e) => {
            if (!isDragging) return;
            panel.style.left = (e.clientX - offsetX) + 'px';
            panel.style.top = (e.clientY - offsetY) + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        };
        document.onmouseup = () => { isDragging = false; };
    }

    if (document.body) createUI();
    else window.addEventListener('DOMContentLoaded', createUI);

})();
