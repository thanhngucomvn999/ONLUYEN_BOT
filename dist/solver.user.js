// ==UserScript==
// @name         Onluyen Auto Solver (v15.0)
// @namespace    https://github.com/thanhngucomvn999/ONLUYEN_BOT
// @version      15.0.0
// @description  Visual UI Scraper - Fix lỗi không tìm thấy dữ liệu
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

    // [NHÚNG EXTRACTOR V15]
    const Extractor = {
        getQuestionData() {
            const allEls = Array.from(document.querySelectorAll('div, span, p, label'));
            const letterBoxes = allEls.filter(el => {
                const txt = el.textContent.trim().toUpperCase();
                return ['A', 'B', 'C', 'D'].includes(txt) && el.children.length === 0;
            });

            if (letterBoxes.length === 0) return null;

            const options = [];
            letterBoxes.forEach(box => {
                const letter = box.textContent.trim().toUpperCase();
                if (options.some(o => o.letter === letter)) return;

                let row = box.parentElement;
                for (let i = 0; i < 3; i++) {
                    if (!row || row === document.body) break;
                    if (row.innerText.trim().length > letter.length + 2) break;
                    row = row.parentElement;
                }

                if (row && row !== document.body) {
                    let text = row.innerText.trim()
                        .replace(/Đáp án của bạn/gi, '')
                        .replace(/^[A-D][\.\s]*/i, '')
                        .trim();
                    options.push({ letter: letter, text: text, element: row });
                }
            });

            options.sort((a, b) => a.letter.localeCompare(b.letter));
            if (options.length < 2) return null;

            let questionText = "";
            let parent = options[0].element.parentElement;
            while (parent && parent !== document.body) {
                const rawText = parent.innerText;
                if (rawText.includes(options[0].text)) {
                    let splitText = rawText.split(options[0].text)[0];
                    splitText = splitText.replace(/Câu\s+\d+.*/i, '').replace(/#\d+/g, '').replace(/Báo lỗi/gi, '').replace(/\n{2,}/g, '\n').trim();
                    if (splitText.length > 10) { questionText = splitText; break; }
                }
                parent = parent.parentElement;
            }

            return { type: 'multiple_choice', questionText: questionText || "Không đọc được câu hỏi", options: options, radios: options.map(o => o.element) };
        },
        clickAnswer(letter, dataOptions) {
            const target = dataOptions.find(o => o.letter === letter);
            if (target) { target.element.click(); return true; }
            return false;
        },
        clickNext() {
            const buttons = document.querySelectorAll('button, div[role="button"]');
            for (let b of buttons) {
                const t = b.innerText?.trim().toUpperCase();
                if (['BỎ QUA', 'TIẾP THEO', 'CÂU TIẾP', 'TIẾP'].includes(t)) { b.click(); return true; }
            }
            return false;
        }
    };

    // [API CLIENT]
    const ApiClient = {
        async askAI(questionText, options) {
            let prompt = "Bạn là chuyên gia giải bài tập. Đây là câu hỏi:\n" + questionText + "\n";
            if (options && options.length > 0) {
                prompt += "Các đáp án:\n" + options.map(o => o.letter + ". " + o.text).join('\n') + "\n";
            }
            prompt += "YÊU CẦU: Chỉ trả về 1 chữ cái duy nhất (A, B, C hoặc D). Không giải thích.";

            let url = CONFIG.GATEWAY === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://gen.pollinations.ai/v1/chat/completions';
            let headers = { 'Content-Type': 'application/json' };
            if (CONFIG.GATEWAY === 'openai') headers['Authorization'] = 'Bearer ' + CONFIG.API_KEY;

            const res = await fetch(url, {
                method: 'POST', headers: headers,
                body: JSON.stringify({
                    model: CONFIG.GATEWAY === 'openai' ? 'gpt-4o-mini' : 'gemini',
                    messages: [{ role: 'user', content: prompt }], temperature: 0
                })
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const json = await res.json();
            const text = json?.choices?.[0]?.message?.content?.trim() || '';
            const match = text.match(/\b([A-D])\b/i) || text.match(/^([A-D])/i);
            return match ? match[0].toUpperCase() : 'A';
        }
    };

    // [SOLVER LOOP]
    const Solver = {
        isRunning: false, timer: null,

        async solveOnce(updateStatus) {
            try {
                updateStatus('⏳ Đang quét câu hỏi...');
                const data = Extractor.getQuestionData();

                if (!data) { updateStatus('❌ Không tìm thấy câu hỏi!', 'error'); return false; }

                updateStatus('🧠 AI đang giải...');
                const answerLetter = await ApiClient.askAI(data.questionText, data.options);
                
                const selectedOption = data.options.find(o => o.letter === answerLetter);
                const answerText = selectedOption ? selectedOption.text : '';

                updateStatus('🖱 Chọn ' + answerLetter + ': ' + (answerText.length > 20 ? answerText.substring(0, 20) + '...' : answerText));
                const success = Extractor.clickAnswer(answerLetter, data.options);
                
                if (success) {
                    updateStatus('✅ Đã chọn ' + answerLetter + ' (' + (answerText.length > 15 ? answerText.substring(0, 15) + '...' : answerText) + ')', 'success');
                } else {
                    updateStatus('⚠️ Lỗi click!', 'error');
                }

                setTimeout(() => {
                    if (Extractor.clickNext()) updateStatus('➡️ Đã chuyển câu...');
                    else { updateStatus('🏁 Đã hết câu hỏi.', 'success'); this.stop(); }
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
                if (success && this.isRunning) this.timer = setTimeout(loop, 3000);
            };
            loop();
        },

        stop(updateStatus) {
            this.isRunning = false;
            clearTimeout(this.timer);
            if (updateStatus) updateStatus('⏹ Đã dừng.');
        }
    };

    // [UI DASHBOARD]
    function createUI() {
        if (document.getElementById('hw-solver-overlay')) return;

        const panel = document.createElement('div');
        panel.id = 'hw-solver-overlay';
        panel.style.cssText = 'position:fixed; bottom:20px; right:20px; width:330px; background:#2c3e50; color:white; border-radius:8px; box-shadow:0 5px 20px rgba(0,0,0,0.4); font-family:sans-serif; z-index:999999; overflow:hidden;';
        
        panel.innerHTML = [
            '<div style="padding:10px; background:#34495e; font-weight:bold; cursor:move; user-select:none;" id="hw-drag">🤖 AI Solver v15.0</div>',
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

        document.getElementById('hw-start').onclick = () => { updateStatus('▶ Bắt đầu...'); Solver.start(updateStatus); };
        document.getElementById('hw-stop').onclick = () => { Solver.stop(updateStatus); };

        document.getElementById('hw-test').onclick = () => {
            updateStatus('⏳ Đang quét thử...');
            const data = Extractor.getQuestionData();
            
            if (!data) { updateStatus('❌ Không tìm thấy dữ liệu!', 'error'); return; }
            
            let msg = '✅ ĐỌC THÀNH CÔNG!\n';
            msg += 'Câu hỏi: ' + data.questionText.substring(0, 30) + '...\n';
            msg += 'Đáp án tìm thấy:\n';
            data.options.forEach(o => { msg += '  ' + o.letter + '. ' + o.text.substring(0, 15) + '...\n'; });
            
            statusEl.innerText = msg;
            statusEl.style.whiteSpace = 'pre-wrap';
            statusEl.style.borderLeftColor = '#2ecc71';
        };

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
            panel.style.right = 'auto'; panel.style.bottom = 'auto';
        };
        document.onmouseup = () => { isDragging = false; };
    }

    if (document.body) createUI();
    else window.addEventListener('DOMContentLoaded', createUI);
})();
