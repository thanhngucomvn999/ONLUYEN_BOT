#!/usr/bin/env node
/**
 * fix.js - Hệ thống v13.0 (Phục hồi Scheduler gốc + DOM Scraper cho React).
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const REPO_URL = 'https://github.com/thanhngucomvn999/ONLUYEN_BOT.git';
const GIT_USER_NAME = 'thanhngucomvn999';
const GIT_USER_EMAIL = 'thanhngucomvn999@users.noreply.github.com';

const FILES = {};

// ------------------------------------------------------------
// 1. dist/solver.user.js (Hệ thống v13.0)
// ------------------------------------------------------------
FILES['dist/solver.user.js'] = String.raw`// ==UserScript==
// @name         Intelligent AI Homework Solver (ONLUYEN_BOT Edition)
// @namespace    https://github.com/thanhngucomvn999/ONLUYEN_BOT
// @version      13.0.0
// @description  Tự động giải bài tập ONLUYEN (Original Logic + Robust DOM Scraper)
// @match        https://*.onluyen.vn/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        GATEWAY: localStorage.getItem('HW_GATEWAY') || 'pollinations',
        API_KEY: localStorage.getItem('HW_API_KEY') || '',
        LOOP_INTERVAL_MS: 4000, // Thời gian chờ giữa các câu (giống bản gốc)
        HUMAN_DELAY_MIN: 500,   // Delay click để giống người thật
        HUMAN_DELAY_MAX: 1500
    };

    const logger = {
        info: (...a) => console.log('[HW-Solver]', ...a),
        error: (...a) => console.error('[HW-Solver]', ...a)
    };

    // Hàm delay ngẫu nhiên (Giống bản gốc)
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const humanDelay = () => sleep(Math.floor(Math.random() * (CONFIG.HUMAN_DELAY_MAX - CONFIG.HUMAN_DELAY_MIN + 1)) + CONFIG.HUMAN_DELAY_MIN);

    // ============================================================
    // 1. API CLIENT (Lấy logic từ bản gốc)
    // ============================================================
    const ApiClient = {
        async callAI(questionText, choicesText) {
            const prompt = "Bạn là chuyên gia giải bài tập. Hãy đọc câu hỏi và chọn đáp án đúng nhất.\n"
                         + "Câu hỏi: " + questionText + "\n"
                         + "Các đáp án:\n" + choicesText + "\n"
                         + "YÊU CẦU: Chỉ trả về 1 chữ cái duy nhất (A, B, C hoặc D). Không giải thích.";
            
            let url, options;
            if (CONFIG.GATEWAY === 'openai') {
                url = 'https://api.openai.com/v1/chat/completions';
                options = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.API_KEY },
                    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0 })
                };
            } else {
                url = 'https://gen.pollinations.ai/v1/chat/completions';
                options = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: 'gemini', messages: [{ role: 'user', content: prompt }], temperature: 0 })
                };
            }

            const res = await fetch(url, options);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const json = await res.json();
            const text = json?.choices?.[0]?.message?.content?.trim() || '';
            
            const match = text.match(/\b([A-D])\b/i) || text.match(/^([A-D])/i);
            return match ? match[0].toUpperCase() : 'A';
        }
    };

    // ============================================================
    // 2. SCRAPER (Thuật toán tìm khối đáp án qua giao diện)
    // ============================================================
    const Scraper = {
        getExamContext() {
            let nextBtn = null;
            // 1. Tìm nút "BỎ QUA" hoặc "TIẾP"
            const buttons = document.querySelectorAll('button, div[role="button"], a, span');
            for (let b of buttons) {
                const t = b.innerText?.trim().toUpperCase();
                if (['BỎ QUA', 'TIẾP THEO', 'CÂU TIẾP', 'TIẾP', 'NỘP BÀI'].includes(t)) {
                    nextBtn = b;
                    break;
                }
            }

            // 2. Tìm các lựa chọn A, B, C, D
            // Dựa vào ảnh: Các chữ cái nằm trong 1 ô vuông nhỏ, text đáp án nằm bên cạnh
            let choices = [];
            const elements = Array.from(document.querySelectorAll('div, span, label, p'));
            
            // Lọc các thẻ có text chính xác là A, B, C, D (ô vuông nhỏ)
            const letterBoxes = elements.filter(el => {
                const txt = el.innerText?.trim().toUpperCase();
                return ['A', 'B', 'C', 'D'].includes(txt) && el.children.length === 0;
            });

            letterBoxes.forEach(box => {
                const letter = box.innerText.trim().toUpperCase();
                if (choices.some(c => c.letter === letter)) return; // Bỏ qua nếu đã tìm thấy

                // Đi lên thẻ cha (VD: thẻ div bao bọc cả ô vuông A và nội dung đáp án)
                let row = box.parentElement;
                let text = '';
                
                // Thường thẻ cha sẽ chứa cả chữ A và nội dung
                while(row && row !== document.body) {
                    const rowText = row.innerText?.trim();
                    // Nếu text dài hơn chữ cái (tức là đã gom được nội dung đáp án)
                    if (rowText.length > letter.length + 2 && rowText.includes(letter)) {
                        text = rowText;
                        break;
                    }
                    row = row.parentElement;
                }

                if (text) {
                    choices.push({ letter: letter, element: row, text: text });
                }
            });

            choices.sort((a, b) => a.letter.localeCompare(b.letter));
            if (choices.length < 2) return null;

            // 3. Tìm câu hỏi (Lấy text phía trên đáp án A)
            let questionText = "";
            let parent = choices[0].element.parentElement;
            while (parent && parent !== document.body) {
                const rawText = parent.innerText;
                // Nếu thẻ cha chứa nội dung đáp án A, phần trước nó là câu hỏi
                if (rawText.includes(choices[0].text)) {
                    let splitText = rawText.split(choices[0].text)[0];
                    // Dọn dẹp
                    splitText = splitText
                        .replace(/Câu\s+\d+.*/i, '')
                        .replace(/#\d+/g, '')
                        .replace(/Báo lỗi/gi, '')
                        .replace(/\n{2,}/g, '\n')
                        .trim();
                    if (splitText.length > 10) {
                        questionText = splitText;
                        break;
                    }
                }
                parent = parent.parentElement;
            }

            return { questionText, choices, nextBtn };
        },

        // Logic click giống bản gốc
        async clickChoice(letter) {
            const context = this.getExamContext();
            if (!context) return false;
            
            const target = context.choices.find(c => c.letter === letter);
            if (target) {
                await humanDelay();
                const radio = target.element.querySelector('input[type="radio"]');
                if (radio) {
                    radio.click();
                } else {
                    target.element.click();
                }
                return true;
            }
            return false;
        },

        async clickNext() {
            const context = this.getExamContext();
            if (context && context.nextBtn) {
                await humanDelay();
                context.nextBtn.click();
                return true;
            }
            return false;
        }
    };

    // ============================================================
    // 3. SOLVER SCHEDULER (Lấy logic vòng lặp từ bản gốc)
    // ============================================================
    const Solver = {
        isRunning: false,
        intervalId: null,
        lastQuestion: '', // Tránh giải lại 1 câu

        async solveOnce(updateStatus) {
            try {
                const context = Scraper.getExamContext();
                if (!context || !context.questionText) {
                    updateStatus('❌ Không tìm thấy câu hỏi!', 'error');
                    return false;
                }

                // Nếu câu hỏi này đã giải rồi (đang chờ chuyển trang) thì bỏ qua
                if (this.lastQuestion === context.questionText) {
                    return false;
                }

                updateStatus('🧠 AI đang giải...');
                const choicesStr = context.choices.map(c => c.text).join('\n');
                const answerLetter = await ApiClient.callAI(context.questionText, choicesStr);
                
                updateStatus('🖱 Chọn ' + answerLetter + '...');
                await Scraper.clickChoice(answerLetter);
                
                this.lastQuestion = context.questionText; // Đánh dấu đã giải
                updateStatus('✅ Đã chọn ' + answerLetter, 'success');

                // Đợi 1 chút rồi chuyển câu
                setTimeout(async () => {
                    await Scraper.clickNext();
                    this.lastQuestion = ''; // Reset để giải câu tiếp theo
                }, 1500);
                
                return true;
            } catch (e) {
                updateStatus('❌ Lỗi: ' + e.message, 'error');
                return false;
            }
        },

        start(updateStatus) {
            if (this.isRunning) return;
            this.isRunning = true;
            this.lastQuestion = '';
            
            updateStatus('▶ Bắt đầu Auto Scheduler...');
            
            // Vòng lặp giống hệt bản gốc (Scheduler)
            this.intervalId = setInterval(async () => {
                if (!this.isRunning) return;
                await this.solveOnce(updateStatus);
            }, CONFIG.LOOP_INTERVAL_MS);
        },

        stop(updateStatus) {
            this.isRunning = false;
            clearInterval(this.intervalId);
            if (updateStatus) updateStatus('⏹ Đã dừng.');
        }
    };

    // ============================================================
    // 4. UI DASHBOARD
    // ============================================================
    function createUI() {
        if (document.getElementById('hw-solver-overlay')) return;

        const panel = document.createElement('div');
        panel.id = 'hw-solver-overlay';
        panel.style.cssText = 'position:fixed; bottom:20px; right:20px; width:330px; background:#2c3e50; color:white; border-radius:8px; box-shadow:0 5px 20px rgba(0,0,0,0.4); font-family:sans-serif; z-index:999999; overflow:hidden;';
        
        panel.innerHTML = [
            '<div style="padding:10px; background:#34495e; font-weight:bold; cursor:move; user-select:none;" id="hw-drag">🤖 AI Solver v13.0</div>',
            '<div style="padding:15px;">',
            '    <div id="hw-status" style="font-size:13px; margin-bottom:10px; padding:8px; background:rgba(0,0,0,0.2); border-left:4px solid #3498db; word-wrap:break-word;">Status: Ready</div>',
            '    <button id="hw-start" style="width:100%; padding:10px; margin-bottom:8px; background:#27ae60; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">▶ Start Auto</button>',
            '    <button id="hw-test" style="width:100%; padding:10px; margin-bottom:8px; background:#2980b9; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">🔍 Test Scraper</button>',
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

        document.getElementById('hw-start').onclick = () => Solver.start(updateStatus);
        document.getElementById('hw-stop').onclick = () => Solver.stop(updateStatus);

        document.getElementById('hw-test').onclick = () => {
            updateStatus('⏳ Đang quét thử...');
            const context = Scraper.getExamContext();
            
            if (!context) {
                updateStatus('❌ Không đọc được đề!', 'error');
                return;
            }
            
            let msg = '✅ ĐỌC THÀNH CÔNG!\n';
            msg += 'Câu hỏi: ' + context.questionText.substring(0, 40) + '...\n';
            msg += 'Đáp án: ' + context.choices.map(c => c.letter).join(', ');
            
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
`;

// ============================================================
// UTILITIES
// ============================================================
function writeFile(relPath, content) {
    const full = path.join(process.cwd(), relPath);
    const dir = path.dirname(full);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
    console.log('  [OK] ' + relPath);
}

function exec(cmd) {
    try {
        return execSync(cmd, { stdio: 'pipe', encoding: 'utf8' }).trim();
    } catch (e) {
        console.error('ERROR running: ' + cmd);
        console.error((e.stderr || e.message || '').toString());
        process.exit(1);
    }
}

console.log('\nSTEP 1: Tạo file...\n');
Object.keys(FILES).forEach((relPath) => {
    writeFile(relPath, FILES[relPath]);
});

console.log('\nSTEP 2: Đang đẩy lên GitHub...\n');
try {
    exec('git add -A');
    exec(`git config user.name "${GIT_USER_NAME}"`);
    exec(`git config user.email "${GIT_USER_EMAIL}"`);
    exec('git commit -m "feat: v13.0 Restored original Scheduler logic + Visual DOM Scraper"');
    
    try { execSync('git remote remove origin', { stdio: 'ignore' }); } catch (e) { }
    
    exec(`git remote add origin ${REPO_URL}`);
    exec('git push -u origin main -f');
    
    console.log('\n✅ THÀNH CÔNG! Đã nâng cấp lên v13.0.');
    console.log('👉 Hãy F5 trang web và bấm Test Scraper để kiểm tra.');
} catch (e) {
    console.log('\n⚠️ Lỗi push, kiểm tra đăng nhập Git.');
}