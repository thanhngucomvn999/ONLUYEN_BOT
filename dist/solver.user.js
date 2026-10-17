// ==UserScript==
// @name         Onluyen Auto Solver (v14.0)
// @namespace    https://github.com/thanhngucomvn999/ONLUYEN_BOT
// @version      14.0.0
// @description  Tự động giải bài tập (Tách biệt Extractor)
// @match        https://*.onluyen.vn/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        GATEWAY: localStorage.getItem('HW_GATEWAY') || 'pollinations',
        API_KEY: localStorage.getItem('HW_API_KEY') || '',
        DELAY: 2500
    };

    // ============================================================
    // [NHÚNG LOGIC EXTRACTOR VÀO ĐÂY]
    // ============================================================
    const Extractor = {
        getQuestionData() {
            const radios = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
            if (radios.length === 0) return null;

            let container = radios[0].parentElement;
            while (container && container !== document.body) {
                if (container.textContent.length > 50 && container.contains(radios[radios.length - 1])) {
                    break;
                }
                container = container.parentElement;
            }

            if (!container || container === document.body) return null;

            let rawText = container.innerText || container.textContent;
            rawText = rawText.replace(/Câu:\s*\d+/gi, '').replace(/#\d+/g, '').replace(/Báo lỗi/gi, '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

            const options = [];
            const optionRegex = /([A-D])\s*([^A-D]+)(?=[A-D]|$)/g;
            let match;
            while ((match = optionRegex.exec(rawText)) !== null) {
                options.push({ letter: match[1], text: match[0].trim() });
            }

            let questionText = rawText;
            if (options.length > 0) {
                options.forEach(opt => { questionText = questionText.replace(opt.text, ''); });
                questionText = questionText.trim();
            }

            return { questionText: questionText || rawText, options: options.length > 0 ? options : null, radios: radios };
        },
        clickAnswer(letter, radios) {
            const index = letter.toUpperCase().charCodeAt(0) - 65;
            if (radios && radios[index]) {
                radios[index].click();
                return true;
            }
            return false;
        },
        clickNext() {
            const buttons = document.querySelectorAll('button, div[role="button"]');
            for (let b of buttons) {
                const t = b.innerText?.trim().toUpperCase();
                if (['BỎ QUA', 'TIẾP THEO', 'CÂU TIẾP', 'TIẾP'].includes(t)) {
                    b.click();
                    return true;
                }
            }
            return false;
        }
    };

    // ============================================================
    // [API CLIENT]
    // ============================================================
    const ApiClient = {
        async askAI(questionText, options) {
            let prompt = "Bạn là chuyên gia giải bài tập. Đây là câu hỏi:\n" + questionText + "\n";
            if (options && options.length > 0) {
                prompt += "Các đáp án:\n" + options.map(o => o.text).join('\n') + "\n";
            }
            prompt += "YÊU CẦU: Chỉ trả về 1 chữ cái duy nhất (A, B, C hoặc D). Không giải thích.";

            let url = CONFIG.GATEWAY === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://gen.pollinations.ai/v1/chat/completions';
            let headers = { 'Content-Type': 'application/json' };
            if (CONFIG.GATEWAY === 'openai') headers['Authorization'] = 'Bearer ' + CONFIG.API_KEY;

            const res = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: CONFIG.GATEWAY === 'openai' ? 'gpt-4o-mini' : 'gemini',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0
                })
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const json = await res.json();
            const text = json?.choices?.[0]?.message?.content?.trim() || '';
            const match = text.match(/\b([A-D])\b/i) || text.match(/^([A-D])/i);
            return match ? match[0].toUpperCase() : 'A';
        }
    };

    // ============================================================
    // [SOLVER LOOP]
    // ============================================================
    const Solver = {
        isRunning: false,
        timer: null,

        async solveOnce(updateStatus) {
            try {
                updateStatus('⏳ Đang quét DOM...');
                const data = Extractor.getQuestionData();

                if (!data) {
                    updateStatus('❌ Không tìm thấy câu hỏi!', 'error');
                    return false;
                }

                updateStatus('🧠 AI đang giải...');
                const answerLetter = await ApiClient.askAI(data.questionText, data.options);
                
                updateStatus('🖱 Chọn đáp án ' + answerLetter + '...');
                const success = Extractor.clickAnswer(answerLetter, data.radios);
                
                if (success) {
                    updateStatus('✅ Đã chọn ' + answerLetter, 'success');
                } else {
                    updateStatus('⚠️ Lỗi click!', 'error');
                }

                setTimeout(() => {
                    if (Extractor.clickNext()) {
                        updateStatus('➡️ Đã chuyển câu...');
                    } else {
                        updateStatus('🏁 Đã hết câu hỏi.', 'success');
                        this.stop();
                    }
                }, CONFIG.DELAY);
                
                return true;
            } catch (e) {
                updateStatus('❌ Lỗi: ' + e.message, 'error');
                return false;
            }
        },

        start(updateStatus) {
            if (this.isRunning) return;
            this.isRunning = true;
            const loop = async () => {
                if (!this.isRunning) return;
                const success = await this.solveOnce(updateStatus);
                if (success && this.isRunning) {
                    this.timer = setTimeout(loop, 3000);
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
    // [UI DASHBOARD]
    // ============================================================
    function createUI() {
        if (document.getElementById('hw-solver-overlay')) return;

        const panel = document.createElement('div');
        panel.id = 'hw-solver-overlay';
        panel.style.cssText = 'position:fixed; bottom:20px; right:20px; width:330px; background:#2c3e50; color:white; border-radius:8px; box-shadow:0 5px 20px rgba(0,0,0,0.4); font-family:sans-serif; z-index:999999; overflow:hidden;';
        
        panel.innerHTML = [
            '<div style="padding:10px; background:#34495e; font-weight:bold; cursor:move; user-select:none;" id="hw-drag">🤖 AI Solver v14.0</div>',
            '<div style="padding:15px;">',
            '    <div id="hw-status" style="font-size:13px; margin-bottom:10px; padding:8px; background:rgba(0,0,0,0.2); border-left:4px solid #3498db; word-wrap:break-word;">Status: Ready</div>',
            '    <button id="hw-start" style="width:100%; padding:10px; margin-bottom:8px; background:#27ae60; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">▶ Start Auto</button>',
            '    <button id="hw-test" style="width:100%; padding:10px; margin-bottom:8px; background:#2980b9; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">🔍 Test Extractor</button>',
            '    <button id="hw-stop" style="width:100%; padding:10px; margin-bottom:15px; background:#c0392b; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">⏹ Stop</button>',
            '    <div style="font-size:11px; margin-bottom:5px;">Gateway API:</div>',
            '    <select id="hw-gw" style="width:100%; padding:8px; margin-bottom:10px; border-radius:4px; border:none;">',
            '        <option value="pollinations">Pollinations (Miễn phí)</option>',
            '        <option value="openai">OpenAI (Cần Key)</option>',
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
            Solver.start(updateStatus);
        };

        document.getElementById('hw-stop').onclick = () => {
            Solver.stop(updateStatus);
        };

        document.getElementById('hw-test').onclick = () => {
            updateStatus('⏳ Đang quét thử...');
            const data = Extractor.getQuestionData();
            
            if (!data) {
                updateStatus('❌ Không tìm thấy dữ liệu!', 'error');
                return;
            }
            
            let msg = '✅ ĐỌC THÀNH CÔNG!\n';
            msg += 'Text: ' + data.questionText.substring(0, 50) + '...\n';
            msg += 'Số đáp án tìm thấy: ' + (data.options ? data.options.length : 0) + '\n';
            msg += 'Số nút Radio: ' + data.radios.length;
            
            statusEl.innerText = msg;
            statusEl.style.whiteSpace = 'pre-wrap';
            statusEl.style.borderLeftColor = '#2ecc71';
        };

        // Drag
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
