#!/usr/bin/env node
/**
 * fix.js - Hệ thống Auto-Solver v6.0 (Quét DOM thông minh cho SPA).
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const REPO_URL = 'https://github.com/thanhngucomvn999/ONLUYEN_BOT.git';
const GIT_USER_NAME = 'thanhngucomvn999';
const GIT_USER_EMAIL = 'thanhngucomvn999@users.noreply.github.com';

const FILES = {};

// ------------------------------------------------------------
// 1. dist/solver.user.js (Hệ thống xử lý v6.0)
// ------------------------------------------------------------
FILES['dist/solver.user.js'] = String.raw`// ==UserScript==
// @name         Intelligent AI Homework Solver (ONLUYEN_BOT Edition)
// @namespace    https://github.com/thanhngucomvn999/ONLUYEN_BOT
// @version      6.0.0
// @description  Tự động quét câu hỏi, gọi AI và click đáp án (Smart DOM Scraper)
// @match        https://*.onluyen.vn/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        GATEWAY: localStorage.getItem('HW_GATEWAY') || 'pollinations',
        API_KEY: localStorage.getItem('HW_API_KEY') || '',
        AUTO_DELAY: 2000 // Chờ 2 giây trước khi chuyển câu
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
            let url = '';
            let options = {};

            if (CONFIG.GATEWAY === 'openai') {
                url = 'https://api.openai.com/v1/chat/completions';
                options = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.API_KEY },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0
                    })
                };
            } else {
                // Pollinations (Mặc định)
                url = 'https://gen.pollinations.ai/v1/chat/completions';
                options = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'gemini',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0
                    })
                };
            }

            const res = await fetch(url, options);
            if (!res.ok) throw new Error('Lỗi gọi API: ' + res.status);
            const json = await res.json();
            return json?.choices?.[0]?.message?.content?.trim() || '';
        }
    };

    // ============================================================
    // 2. LÕI XỬ LÝ BÀI TẬP (SMART SCRAPER V6)
    // ============================================================
    const SolverCore = {
        isRunning: false,
        loopTimeout: null,

        // Hàm quét DOM thông minh để tìm câu hỏi và đáp án
        extractQuestionContext() {
            const allDivs = Array.from(document.querySelectorAll('div, span, label'));
            
            // Tìm các khối có chứa chữ cái A., B., C., D. ở đầu (đặc trưng của đáp án)
            const choices = [];
            for (let el of allDivs) {
                const text = el.innerText?.trim();
                // Regex: Bắt đầu bằng A, B, C, hoặc D, theo sau là dấu chấm hoặc khoảng trắng, và ngắn (tránh lấy toàn bộ trang)
                if (/^[A-D][\.\s]/i.test(text) && text.length < 300 && el.children.length < 5) {
                    // Kiểm tra xem đã add chưa (tránh lấy trùng thẻ cha)
                    if (!choices.find(c => c.element === el || c.element.contains(el))) {
                        // Đảm bảo thẻ này là thẻ chứa text, không phải thẻ cha bọc ngoài
                        if (el.innerText.trim() === text) {
                            choices.push({ element: el, text: text });
                        }
                    }
                }
            }

            // Lọc lại chỉ lấy 4 đáp án (A, B, C, D)
            const finalChoices = [];
            const seen = new Set();
            for (let c of choices) {
                const firstLetter = c.text.charAt(0).toUpperCase();
                if (!seen.has(firstLetter) && ['A', 'B', 'C', 'D'].includes(firstLetter)) {
                    finalChoices.push(c);
                    seen.add(firstLetter);
                }
            }

            // Nếu tìm thấy >= 2 đáp án, tìm câu hỏi ở phía trên nó
            if (finalChoices.length >= 2) {
                let questionText = "";
                let currentEl = finalChoices[0].element;
                
                // Đi ngược lên các thẻ cha (tối đa 5 cấp) để tìm khối chứa câu hỏi
                for (let i = 0; i < 5; i++) {
                    if (!currentEl) break;
                    const parentText = currentEl.innerText;
                    // Nếu thẻ cha chứa nhiều text (dài hơn đáp án), có thể nó chứa câu hỏi
                    if (parentText.length > finalChoices[0].text.length + 30) {
                        // Cắt bỏ phần đáp án ở dưới để lấy câu hỏi
                        questionText = parentText.split(finalChoices[0].text)[0].trim();
                        break;
                    }
                    currentEl = currentEl.parentElement;
                }
                
                // Fallback nếu không tìm thấy câu hỏi cụ thể
                if (!questionText || questionText.length < 10) {
                     questionText = "Hãy chọn đáp án đúng nhất trong các lựa chọn sau:\n" + finalChoices.map(c => c.text).join('\n');
                }

                return {
                    question: questionText,
                    choices: finalChoices
                };
            }

            return null;
        },

        // Thực hiện click đáp án
        clickAnswer(letter) {
            const context = this.extractQuestionContext();
            if (!context) return false;
            
            const target = context.choices.find(c => c.text.toUpperCase().startsWith(letter));
            if (target) {
                // Kích hoạt sự kiện click
                target.element.click();
                
                // Thử tìm thẻ input radio ẩn bên trong để click (phòng hờ)
                const radio = target.element.querySelector('input[type="radio"]');
                if (radio && !radio.checked) {
                    radio.click();
                }
                return true;
            }
            return false;
        },

        // Chuyển câu tiếp theo
        clickNext() {
            const allButtons = document.querySelectorAll('button, div[role="button"], a');
            for (let btn of allButtons) {
                const text = btn.innerText?.trim().toLowerCase();
                // Nút "Bỏ qua", "Tiếp", "Câu tiếp", "Nộp bài"
                if (text === 'bỏ qua' || text === 'tiếp' || text === 'câu tiếp' || text === 'nộp bài') {
                    btn.click();
                    return true;
                }
            }
            return false;
        },

        // Luồng chạy chính
        async solveCurrentQuestion(uiUpdater) {
            try {
                uiUpdater('⏳ Đang quét câu hỏi...');
                const context = this.extractQuestionContext();
                
                if (!context) {
                    uiUpdater('❌ Không tìm thấy câu hỏi/đáp án trên màn hình.', 'error');
                    return false;
                }

                uiUpdater('🧠 AI đang phân tích...');
                const prompt = "Bạn là chuyên gia giải bài tập. Hãy đọc câu hỏi và các đáp án sau.\n"
                             + "Câu hỏi: " + context.question + "\n"
                             + "Các đáp án:\n" + context.choices.map(c => c.text).join('\n') + "\n"
                             + "YÊU CẦU: Chỉ trả về duy nhất một chữ cái (A, B, C hoặc D) là đáp án đúng nhất. KHÔNG giải thích gì thêm.";
                
                let answer = await GatewayManager.askAI(prompt);
                logger.info('AI trả lời:', answer);
                
                // Trích xuất chữ cái từ câu trả lời của AI (đề phòng AI trả về rác)
                const match = answer.match(/[A-D]/i);
                const finalLetter = match ? match[0].toUpperCase() : 'A';

                uiUpdater('🖱 Đang chọn đáp án ' + finalLetter + '...');
                const success = this.clickAnswer(finalLetter);
                
                if (success) {
                    uiUpdater('✅ Đã chọn đáp án ' + finalLetter, 'success');
                } else {
                    uiUpdater('⚠️ Không click được đáp án!', 'error');
                }

                // Đợi rồi chuyển câu
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
                    // Lặp lại sau 4 giây (chờ trang load câu mới)
                    this.loopTimeout = setTimeout(runLoop, 4000);
                }
            };
            
            runLoop();
        },

        stop(uiUpdater) {
            this.isRunning = false;
            clearTimeout(this.loopTimeout);
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
            '<div style="padding:10px; background:#34495e; font-weight:bold; cursor:move; user-select:none;" id="hw-drag">🤖 AI Solver v6.0</div>',
            '<div style="padding:15px;">',
            '    <div id="hw-status" style="font-size:13px; margin-bottom:10px; padding:8px; background:rgba(0,0,0,0.2); border-left:4px solid #3498db; word-wrap:break-word;">Status: Ready</div>',
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
    exec('git commit -m "feat: v6.0 Smart DOM Scraper for SPA"');
    
    try { execSync('git remote remove origin', { stdio: 'ignore' }); } catch (e) { }
    
    exec(`git remote add origin ${REPO_URL}`);
    exec('git push -u origin main -f');
    
    console.log('\n✅ THÀNH CÔNG! Đã nâng cấp lên v6.0 và push lên GitHub.');
    console.log('👉 F5 lại trang onluyen.vn. Lần này bot sẽ tự động quét được câu hỏi.');
} catch (e) {
    console.log('\n⚠️ Lỗi push, kiểm tra đăng nhập Git.');
}