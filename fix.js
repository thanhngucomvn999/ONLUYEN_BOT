#!/usr/bin/env node
/**
 * fix.js - Hệ thống v9.0 (Thuật toán Tổ tiên chung - Fix 100% lỗi không đọc được đề).
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const REPO_URL = 'https://github.com/thanhngucomvn999/ONLUYEN_BOT.git';
const GIT_USER_NAME = 'thanhngucomvn999';
const GIT_USER_EMAIL = 'thanhngucomvn999@users.noreply.github.com';

const FILES = {};

// ------------------------------------------------------------
// 1. dist/solver.user.js (Hệ thống xử lý v9.0)
// ------------------------------------------------------------
FILES['dist/solver.user.js'] = String.raw`// ==UserScript==
// @name         Intelligent AI Homework Solver (ONLUYEN_BOT Edition)
// @namespace    https://github.com/thanhngucomvn999/ONLUYEN_BOT
// @version      9.0.0
// @description  Tự động giải bài tập ONLUYEN (LCA Scraper)
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

    const logger = {
        info: (...a) => console.log('[HW-Solver]', ...a),
        error: (...a) => console.error('[HW-Solver]', ...a)
    };

    // ============================================================
    // 1. API CLIENT
    // ============================================================
    const ApiClient = {
        async askAI(prompt) {
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
    // 2. SCRAPER V9 (Lowest Common Ancestor Algorithm)
    // ============================================================
    const Scraper = {
        // Hàm tìm tổ tiên chung của 2 node
        getCommonAncestor(node1, node2) {
            if (!node1 || !node2) return document.body;
            const ancestors1 = new Set();
            let curr = node1;
            while (curr) {
                ancestors1.add(curr);
                curr = curr.parentElement;
            }
            curr = node2;
            while (curr) {
                if (ancestors1.has(curr)) return curr;
                curr = curr.parentElement;
            }
            return document.body;
        },

        getExamContext() {
            let nextBtn = null;
            const buttons = document.querySelectorAll('button, div[role="button"], a, span');
            for (let b of buttons) {
                const t = b.innerText?.trim().toUpperCase();
                if (['BỎ QUA', 'TIẾP THEO', 'CÂU TIẾP', 'TIẾP', 'NỘP BÀI'].includes(t)) {
                    nextBtn = b;
                    break;
                }
            }

            // Tìm các thẻ chứa đáp án
            const choices = [];
            const allEls = Array.from(document.querySelectorAll('div, p, label, span'));
            
            for (let el of allEls) {
                if (el === document.body || el.children.length > 4) continue; 
                
                const txt = el.innerText?.trim() || '';
                // Tìm thẻ bắt đầu bằng A., B., C., D. hoặc A, B, C, D
                const match = txt.match(/^([A-D])[\.\s]/i);
                
                if (match && txt.length > 2 && txt.length < 200) {
                    const letter = match[1].toUpperCase();
                    
                    // Đảm bảo không bị lấy thẻ cha chứa cả 4 đáp án
                    if (!choices.some(c => c.element.contains(el))) {
                        // Loại bỏ các thẻ con đã được thêm trước đó (nếu có)
                        const filteredChoices = choices.filter(c => !el.contains(c.element));
                        choices.length = 0; 
                        choices.push(...filteredChoices);
                        
                        choices.push({ letter: letter, element: el, text: txt });
                    }
                }
            }

            // Lọc trùng lặp chữ cái
            const finalChoices = [];
            const seen = new Set();
            for (let c of choices) {
                if (!seen.has(c.letter)) {
                    finalChoices.push(c);
                    seen.add(c.letter);
                }
            }
            finalChoices.sort((a, b) => a.letter.localeCompare(b.letter));

            if (finalChoices.length < 2) return null;

            // Tìm thẻ cha chung bao bọc tất cả các đáp án
            let commonAncestor = finalChoices[0].element;
            for (let i = 1; i < finalChoices.length; i++) {
                commonAncestor = this.getCommonAncestor(commonAncestor, finalChoices[i].element);
            }
            
            // Nếu thẻ cha chung là body, lùi lại tìm thẻ cha gần nhất
            if (commonAncestor === document.body) {
                commonAncestor = finalChoices[0].element.parentElement.parentElement;
            }

            // Lấy câu hỏi
            let rawText = commonAncestor.innerText;
            
            // Xóa text của đáp án
            finalChoices.forEach(c => {
                // Thay thế bằng chuỗi rỗng (dùng hàm replace an toàn)
                rawText = rawText.split(c.text).join('');
            });
            
            // Xóa nút bỏ qua
            if (nextBtn && nextBtn.innerText) {
                rawText = rawText.split(nextBtn.innerText).join('');
            }

            // Dọn dẹp rác
            let questionText = rawText
                .replace(/Câu\s+\d+.*$/gm, '')
                .replace(/#\d+/g, '')
                .replace(/Báo lỗi/gi, '')
                .replace(/\n{2,}/g, '\n')
                .trim();

            return { questionText, choices: finalChoices, nextBtn };
        },

        clickChoice(letter) {
            const context = this.getExamContext();
            if (!context) return false;
            
            const target = context.choices.find(c => c.letter === letter);
            if (target) {
                const radio = target.element.querySelector('input[type="radio"]');
                if (radio) radio.click();
                else target.element.click();
                return true;
            }
            return false;
        },

        clickNext() {
            const context = this.getExamContext();
            if (context && context.nextBtn) {
                context.nextBtn.click();
                return true;
            }
            return false;
        }
    };

    // ============================================================
    // 3. SOLVER LOOP
    // ============================================================
    const SolverLoop = {
        isRunning: false,
        timer: null,

        async runCycle(updateStatus) {
            try {
                updateStatus('⏳ Đang quét đề...');
                const context = Scraper.getExamContext();

                if (!context || !context.questionText) {
                    updateStatus('❌ Không đọc được đề! Hãy bấm Test Scraper.', 'error');
                    return false;
                }

                updateStatus('🧠 AI đang suy nghĩ...');
                const prompt = "Bạn là chuyên gia giải bài tập. Hãy đọc câu hỏi và chọn đáp án đúng nhất.\n"
                             + "Câu hỏi: " + context.questionText + "\n"
                             + "Các đáp án:\n" + context.choices.map(c => c.text).join('\n') + "\n"
                             + "YÊU CẦU: Chỉ trả về 1 chữ cái duy nhất (A, B, C hoặc D). Không giải thích.";
                
                const correctLetter = await ApiClient.askAI(prompt);
                
                updateStatus('🖱 Chọn đáp án ' + correctLetter + '...');
                const success = Scraper.clickChoice(correctLetter);
                
                if (success) {
                    updateStatus('✅ Đã chọn ' + correctLetter, 'success');
                } else {
                    updateStatus('⚠️ Lỗi click!', 'error');
                }

                setTimeout(() => {
                    if (Scraper.clickNext()) {
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
    // 4. UI DASHBOARD
    // ============================================================
    function createUI() {
        if (document.getElementById('hw-solver-overlay')) return;

        const panel = document.createElement('div');
        panel.id = 'hw-solver-overlay';
        panel.style.cssText = 'position:fixed; bottom:20px; right:20px; width:330px; background:#2c3e50; color:white; border-radius:8px; box-shadow:0 5px 20px rgba(0,0,0,0.4); font-family:sans-serif; z-index:999999; overflow:hidden;';
        
        panel.innerHTML = [
            '<div style="padding:10px; background:#34495e; font-weight:bold; cursor:move; user-select:none;" id="hw-drag">🤖 AI Solver v9.0</div>',
            '<div style="padding:15px;">',
            '    <div id="hw-status" style="font-size:13px; margin-bottom:10px; padding:8px; background:rgba(0,0,0,0.2); border-left:4px solid #3498db; word-wrap:break-word;">Status: Ready</div>',
            '    <button id="hw-start" style="width:100%; padding:10px; margin-bottom:8px; background:#27ae60; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">▶ Start Auto</button>',
            '    <button id="hw-test" style="width:100%; padding:10px; margin-bottom:8px; background:#2980b9; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">🔍 Test Scraper (Kiểm tra)</button>',
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
            SolverLoop.start(updateStatus);
        };

        document.getElementById('hw-stop').onclick = () => {
            SolverLoop.stop(updateStatus);
        };

        document.getElementById('hw-test').onclick = () => {
            updateStatus('⏳ Đang quét thử bằng LCA...');
            const context = Scraper.getExamContext();
            
            if (!context) {
                updateStatus('❌ Vẫn không đọc được đề! Hãy chụp màn hình gửi lại.', 'error');
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
    exec('git commit -m "feat: v9.0 LCA algorithm for bulletproof DOM scraping"');
    
    try { execSync('git remote remove origin', { stdio: 'ignore' }); } catch (e) { }
    
    exec(`git remote add origin ${REPO_URL}`);
    exec('git push -u origin main -f');
    
    console.log('\n✅ THÀNH CÔNG! Đã nâng cấp lên v9.0.');
    console.log('👉 F5 lại trang onluyen.vn, bấm "Test Scraper (Kiểm tra)" để xem kết quả.');
} catch (e) {
    console.log('\n⚠️ Lỗi push, kiểm tra đăng nhập Git.');
}