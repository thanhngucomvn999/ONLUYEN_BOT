// ==UserScript==
// @name         Intelligent AI Homework Solver (ONLUYEN_BOT Edition)
// @namespace    https://github.com/thanhngucomvn999/ONLUYEN_BOT
// @version      7.0.0
// @description  Tự động giải bài tập ONLUYEN (Phục hồi logic gốc + Multi-gateway)
// @match        https://*.onluyen.vn/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // 1. CẤU HÌNH GATEWAY (Logic từ bản gốc nâng cấp)
    // ============================================================
    const GATEWAYS = {
        onluyen_bot: {
            name: 'ONLUYEN_BOT',
            baseUrl: 'https://raw.githubusercontent.com/thanhngucomvn999/ONLUYEN_BOT/main',
            chatEndpoint: '/api/chat',
            defaultModel: 'onluyen-v1',
            buildRequest(payload, apiKey) {
                return {
                    url: this.baseUrl + this.chatEndpoint,
                    options: {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
                        body: JSON.stringify({ model: payload.model || this.defaultModel, messages: payload.messages, temperature: 0.1 })
                    }
                };
            },
            parseResponse(json) { return json?.choices?.[0]?.message?.content ?? ''; }
        },
        pollinations: {
            name: 'Pollinations (Free)',
            baseUrl: 'https://gen.pollinations.ai/v1/chat/completions',
            defaultModel: 'gemini',
            buildRequest(payload, apiKey) {
                return {
                    url: this.baseUrl,
                    options: {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (apiKey || 'none') },
                        body: JSON.stringify({ model: payload.model || this.defaultModel, messages: payload.messages, temperature: 0.1 })
                    }
                };
            },
            parseResponse(json) { return json?.choices?.[0]?.message?.content ?? ''; }
        },
        openai: {
            name: 'OpenAI',
            baseUrl: 'https://api.openai.com/v1/chat/completions',
            defaultModel: 'gpt-4o-mini',
            buildRequest(payload, apiKey) {
                return {
                    url: this.baseUrl,
                    options: {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
                        body: JSON.stringify({ model: payload.model || this.defaultModel, messages: payload.messages, temperature: 0.1 })
                    }
                };
            },
            parseResponse(json) { return json?.choices?.[0]?.message?.content ?? ''; }
        }
    };

    const CONFIG = {
        GATEWAY: localStorage.getItem('HW_GATEWAY') || 'pollinations',
        API_KEY: localStorage.getItem('HW_API_KEY') || '',
        DELAY: 2500
    };

    const logger = {
        info: (...a) => console.log('[HW-Solver]', ...a),
        error: (...a) => console.error('[HW-Solver]', ...a)
    };

    // ============================================================
    // 2. API CLIENT (Logic gửi nhận từ bản gốc)
    // ============================================================
    const ApiClient = {
        async generateContent(prompt) {
            const gw = GATEWAYS[CONFIG.GATEWAY] || GATEWAYS.pollinations;
            const messages = [
                { role: 'system', content: 'Bạn là trợ lý giải bài tập. Hãy đọc kỹ đề và chọn đáp án đúng nhất. Chỉ trả về chữ cái đầu tiên của đáp án đúng (A, B, C, hoặc D).' },
                { role: 'user', content: prompt }
            ];
            
            const req = gw.buildRequest({ messages }, CONFIG.API_KEY);
            const res = await fetch(req.url, req.options);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const json = await res.json();
            const answer = gw.parseResponse(json).trim();
            
            // Trích xuất chữ cái A, B, C, D từ câu trả lời của AI (phòng hờ AI lan man)
            const match = answer.match(/[A-D]/i);
            return match ? match[0].toUpperCase() : 'A';
        }
    };

    // ============================================================
    // 3. SCRAPER (Phục hồi & Nâng cấp logic cào dữ liệu)
    // ============================================================
    const Scraper = {
        // Lấy nội dung câu hỏi
        getQuestionText() {
            // Thử các selector phổ biến của ONLUYEN
            const selectors = ['.question-content', '.question-title', '.q-text', '.question-text', '.question-body'];
            for (let sel of selectors) {
                const el = document.querySelector(sel);
                if (el && el.innerText.trim().length > 10) return el.innerText.trim();
            }
            
            // Fallback: Tìm khối div lớn nhất chứa chữ ở giữa màn hình
            const mainContent = document.querySelector('.main-content, .exam-content, #app');
            if (mainContent) {
                const paragraphs = Array.from(mainContent.querySelectorAll('p, div'));
                // Lọc các div chứa text dài và không chứa nút A,B,C,D
                const candidates = paragraphs.filter(p => p.innerText.length > 20 && !p.innerText.match(/^[A-D][\.\s]/i));
                if (candidates.length > 0) {
                    // Sắp xếp theo độ dài text giảm dần và lấy cái đầu tiên
                    candidates.sort((a, b) => b.innerText.length - a.innerText.length);
                    return candidates[0].innerText.trim();
                }
            }
            return null;
        },

        // Lấy danh sách các nút đáp án A, B, C, D
        getChoices() {
            const choices = [];
            // Quét tất cả các thẻ div, label, button có text bắt đầu bằng A., B., C., D.
            const elements = Array.from(document.querySelectorAll('div, label, button, span'));
            
            for (let el of elements) {
                const text = el.innerText?.trim();
                // Regex: A., B., C., D. hoặc A B C D (có khoảng trắng)
                if (/^[A-D][\.\s]/i.test(text) && text.length < 200) {
                    // Đảm bảo đây là thẻ lá (chứa text trực tiếp, không chứa các thẻ div con phức tạp)
                    if (el.children.length <= 2) {
                        // Tránh lấy trùng lặp thẻ cha
                        if (!choices.some(c => c.element === el || c.element.contains(el))) {
                            choices.push({ element: el, text: text });
                        }
                    }
                }
            }
            
            // Lọc trùng và chỉ lấy 4 đáp án A, B, C, D
            const uniqueChoices = [];
            const seenLetters = new Set();
            for (let c of choices) {
                const letter = c.text.charAt(0).toUpperCase();
                if (['A', 'B', 'C', 'D'].includes(letter) && !seenLetters.has(letter)) {
                    uniqueChoices.push(c);
                    seenLetters.add(letter);
                }
            }
            
            return uniqueChoices.sort((a, b) => a.text.localeCompare(b.text));
        },

        // Thực hiện click đáp án
        clickChoice(letter) {
            const choices = this.getChoices();
            const target = choices.find(c => c.text.toUpperCase().startsWith(letter));
            
            if (target) {
                // Tìm thẻ input radio ẩn bên trong để click (chuẩn xác nhất)
                const radio = target.element.querySelector('input[type="radio"]');
                if (radio) {
                    radio.click();
                } else {
                    // Nếu không có radio, click thẳng vào thẻ div/label
                    target.element.click();
                }
                return true;
            }
            return false;
        },

        // Click nút chuyển câu
        clickNext() {
            const buttons = Array.from(document.querySelectorAll('button, div[role="button"], a'));
            for (let btn of buttons) {
                const text = btn.innerText?.trim().toLowerCase();
                // ONLUYEN dùng nút "BỎ QUA", "TIẾP", hoặc "CÂU TIẾP"
                if (text === 'bỏ qua' || text === 'tiếp' || text === 'câu tiếp' || text === 'nộp bài') {
                    btn.click();
                    return true;
                }
            }
            return false;
        }
    };

    // ============================================================
    // 4. SOLVER LOOP (Vòng lặp tự động)
    // ============================================================
    const SolverLoop = {
        isRunning: false,
        timer: null,

        async runCycle(updateStatus) {
            try {
                updateStatus('⏳ Đang tìm câu hỏi...');
                const question = Scraper.getQuestionText();
                const choices = Scraper.getChoices();

                if (!question || choices.length === 0) {
                    updateStatus('❌ Không tìm thấy câu hỏi hoặc đáp án!', 'error');
                    return false;
                }

                updateStatus('🧠 AI đang giải...');
                const prompt = "Câu hỏi: " + question + "\n\nCác đáp án:\n" + choices.map(c => c.text).join('\n') + "\n\nChỉ trả lời 1 chữ cái A, B, C hoặc D.";
                
                const correctLetter = await ApiClient.generateContent(prompt);
                
                updateStatus('🖱 Đang chọn đáp án ' + correctLetter + '...');
                const success = Scraper.clickChoice(correctLetter);
                
                if (success) {
                    updateStatus('✅ Đã chọn ' + correctLetter, 'success');
                } else {
                    updateStatus('⚠️ Lỗi click đáp án!', 'error');
                }

                setTimeout(() => {
                    if (Scraper.clickNext()) {
                        updateStatus('➡️ Chuyển câu tiếp...');
                    } else {
                        updateStatus('🏁 Đã hết câu hỏi (Không tìm thấy nút Next)', 'success');
                        this.stop();
                    }
                }, CONFIG.DELAY);
                
                return true;
            } catch (e) {
                updateStatus('❌ Lỗi API: ' + e.message, 'error');
                return false;
            }
        },

        start(updateStatus) {
            if (this.isRunning) return;
            this.isRunning = true;
            const loop = async () => {
                if (!this.isRunning) return;
                const success = await this.runCycle(updateStatus);
                if (success && this.isRunning) {
                    this.timer = setTimeout(loop, 4000);
                }
            };
            loop();
        },

        stop(updateStatus) {
            this.isRunning = false;
            clearTimeout(this.timer);
            if (updateStatus) updateStatus('⏹ Đã dừng.');
        }
    };

    // ============================================================
    // 5. UI DASHBOARD
    // ============================================================
    function createUI() {
        if (document.getElementById('hw-solver-overlay')) return;

        const panel = document.createElement('div');
        panel.id = 'hw-solver-overlay';
        panel.style.cssText = 'position:fixed; bottom:20px; right:20px; width:330px; background:#2c3e50; color:white; border-radius:8px; box-shadow:0 5px 20px rgba(0,0,0,0.4); font-family:sans-serif; z-index:999999; overflow:hidden;';
        
        panel.innerHTML = [
            '<div style="padding:10px; background:#34495e; font-weight:bold; cursor:move; user-select:none;" id="hw-drag">🤖 AI Solver v7.0</div>',
            '<div style="padding:15px;">',
            '    <div id="hw-status" style="font-size:13px; margin-bottom:10px; padding:8px; background:rgba(0,0,0,0.2); border-left:4px solid #3498db; word-wrap:break-word;">Status: Ready</div>',
            '    <button id="hw-start" style="width:100%; padding:10px; margin-bottom:8px; background:#27ae60; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">▶ Start Auto</button>',
            '    <button id="hw-test" style="width:100%; padding:10px; margin-bottom:8px; background:#2980b9; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">🔍 Test Scraper (Kiểm tra)</button>',
            '    <button id="hw-stop" style="width:100%; padding:10px; margin-bottom:15px; background:#c0392b; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">⏹ Stop</button>',
            '    <div style="font-size:11px; margin-bottom:5px;">Gateway API:</div>',
            '    <select id="hw-gw" style="width:100%; padding:8px; margin-bottom:10px; border-radius:4px; border:none;">',
            '        <option value="pollinations">Pollinations (Miễn phí)</option>',
            '        <option value="openai">OpenAI (Cần Key)</option>',
            '        <option value="onluyen_bot">ONLUYEN_BOT (Cần Key)</option>',
            '    </select>',
            '    <div style="font-size:11px; margin-bottom:5px;">API Key:</div>',
            '    <input type="password" id="hw-key" style="width:100%; padding:8px; margin-bottom:10px; border-radius:4px; border:none;" placeholder="Nhập key..." />',
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
            SolverLoop.start(updateStatus);
        };

        document.getElementById('hw-stop').onclick = () => {
            SolverLoop.stop(updateStatus);
        };

        // --- NÚT TEST SCRAPER QUAN TRỌNG ---
        document.getElementById('hw-test').onclick = () => {
            updateStatus('⏳ Đang kiểm tra khả năng đọc đề...');
            const q = Scraper.getQuestionText();
            const choices = Scraper.getChoices();
            
            if (!q) {
                updateStatus('❌ Không đọc được câu hỏi! Hãy chụp ảnh màn hình gửi lại.', 'error');
                return;
            }
            if (choices.length === 0) {
                updateStatus('❌ Đọc được câu hỏi nhưng KHÔNG tìm thấy đáp án A,B,C,D!', 'error');
                return;
            }
            
            let msg = '✅ ĐỌC THÀNH CÔNG!\n';
            msg += 'Câu hỏi: ' + q.substring(0, 50) + '...\n';
            msg += 'Đáp án tìm thấy: ' + choices.map(c => c.text.substring(0, 10)).join(' | ');
            
            statusEl.innerText = msg;
            statusEl.style.whiteSpace = 'pre-wrap';
            statusEl.style.borderLeftColor = '#2ecc71';
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
