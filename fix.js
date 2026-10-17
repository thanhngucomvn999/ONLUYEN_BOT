#!/usr/bin/env node
/**
 * fix.js - Hệ thống v8.0 (Bạo lực quét DOM, Fix lỗi không tìm thấy câu hỏi).
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const REPO_URL = 'https://github.com/thanhngucomvn999/ONLUYEN_BOT.git';
const GIT_USER_NAME = 'thanhngucomvn999';
const GIT_USER_EMAIL = 'thanhngucomvn999@users.noreply.github.com';

const FILES = {};

// ------------------------------------------------------------
// 1. dist/solver.user.js (Hệ thống xử lý v8.0)
// ------------------------------------------------------------
FILES['dist/solver.user.js'] = String.raw`// ==UserScript==
// @name         Intelligent AI Homework Solver (ONLUYEN_BOT Edition)
// @namespace    https://github.com/thanhngucomvn999/ONLUYEN_BOT
// @version      8.0.0
// @description  Tự động giải bài tập ONLUYEN (Bạo lực quét DOM)
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
            } else if (CONFIG.GATEWAY === 'onluyen_bot') {
                url = 'https://raw.githubusercontent.com/thanhngucomvn999/ONLUYEN_BOT/main/api/chat'; // Placeholder
                options = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.API_KEY },
                    body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] })
                };
            } else {
                // Pollinations (Mặc định)
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
            
            // Trích xuất chữ cái A, B, C, D từ phản hồi của AI
            const match = text.match(/\b([A-D])\b/i) || text.match(/^([A-D])/i);
            return match ? match[0].toUpperCase() : 'A';
        }
    };

    // ============================================================
    // 2. SCRAPER V8 (Bạo lực - Quét text thay vì class)
    // ============================================================
    const Scraper = {
        getExamContext() {
            // 1. Tìm nút "BỎ QUA" hoặc "TIẾP" để làm mốc
            let nextBtn = null;
            const allButtons = Array.from(document.querySelectorAll('button, div[role="button"]'));
            for (let btn of allButtons) {
                const text = btn.innerText?.trim().toUpperCase();
                if (text === 'BỎ QUA' || text === 'TIẾP THEO' || text === 'CÂU TIẾP' || text === 'TIẾP' || text === 'NỘP BÀI') {
                    nextBtn = btn;
                    break;
                }
            }

            // Nếu không tìm thấy nút, lấy toàn bộ body
            let container = nextBtn ? nextBtn.parentElement.parentElement.parentElement : document.body;
            
            // 2. Tìm các hộp chứa chữ A, B, C, D (Dựa vào text chính xác)
            let choices = [];
            // Tìm tất cả các thẻ div, span có text là A, B, C hoặc D và không có con
            const letterBoxes = Array.from(container.querySelectorAll('div, span')).filter(el => {
                const t = el.innerText?.trim().toUpperCase();
                return ['A', 'B', 'C', 'D'].includes(t) && el.children.length === 0;
            });

            if (letterBoxes.length >= 4) {
                // Với mỗi hộp chữ cái, thẻ cha của nó chính là dòng đáp án
                letterBoxes.forEach(box => {
                    const row = box.parentElement; 
                    const letter = box.innerText.trim().toUpperCase();
                    
                    // Chỉ lấy 1 đáp án cho mỗi chữ cái
                    if (!choices.find(c => c.letter === letter)) {
                        choices.push({ 
                            letter: letter, 
                            element: row, 
                            fullText: row.innerText.trim() 
                        });
                    }
                });
            } 
            
            // Fallback: Nếu không tìm thấy hộp chữ cái, tìm text bắt đầu bằng "A.", "B."
            if (choices.length < 4) {
                choices = [];
                const textNodes = Array.from(container.querySelectorAll('div, label, p'));
                for (let el of textNodes) {
                    const t = el.innerText?.trim();
                    if (/^[A-D][\.\s]/i.test(t) && t.length < 150 && el.children.length <= 2) {
                        const letter = t.charAt(0).toUpperCase();
                        if (!choices.find(c => c.letter === letter)) {
                            choices.push({ letter: letter, element: el, fullText: t });
                        }
                    }
                }
            }

            choices.sort((a, b) => a.letter.localeCompare(b.letter));

            if (choices.length < 2) return null;

            // 3. Trích xuất câu hỏi (Lấy text của container, cắt bỏ phần đáp án và nút)
            let rawText = container.innerText;
            
            if (nextBtn) rawText = rawText.replace(nextBtn.innerText, '');
            choices.forEach(c => {
                rawText = rawText.replace(c.fullText, '');
            });
            
            // Xóa các dòng rác (Câu số, mã đề)
            let questionText = rawText
                .replace(/Câu\s+\d+.*$/gm, '')
                .replace(/#\d+/g, '')
                .replace(/Báo lỗi/gi, '')
                .trim();

            // Nếu câu hỏi quá ngắn, lấy toàn bộ text của container
            if (questionText.length < 10) questionText = rawText.trim();

            return { questionText, choices, nextBtn };
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

                if (!context) {
                    updateStatus('❌ Không đọc được đề! Hãy thử lại.', 'error');
                    return false;
                }

                updateStatus('🧠 AI đang suy nghĩ...');
                const prompt = "Bạn là chuyên gia giải bài tập. Hãy đọc câu hỏi và chọn đáp án đúng nhất.\n"
                             + "Câu hỏi: " + context.questionText + "\n"
                             + "Các đáp án:\n" + context.choices.map(c => c.fullText).join('\n') + "\n"
                             + "YÊU CẦU: Chỉ trả về 1 chữ cái duy nhất (A, B, C hoặc D). Không giải thích.";
                
                const correctLetter = await ApiClient.askAI(prompt);
                
                updateStatus('🖱 Chọn đáp án ' + correctLetter + '...');
                const success = Scraper.clickChoice(correctLetter);
                
                if (success) {
                    updateStatus('✅ Đã chọn ' + correctLetter, 'success');
                } else {
                    updateStatus('⚠️ Không click được đáp án!', 'error');
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
            '<div style="padding:10px; background:#34495e; font-weight:bold; cursor:move; user-select:none;" id="hw-drag">🤖 AI Solver v8.0</div>',
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
            updateStatus('⏳ Đang quét thử...');
            const context = Scraper.getExamContext();
            
            if (!context) {
                updateStatus('❌ Vẫn không đọc được đề! Cấu trúc web quá lạ.', 'error');
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
    exec('git commit -m "feat: v8.0 brute-force DOM scraper for complex SPAs"');
    
    try { execSync('git remote remove origin', { stdio: 'ignore' }); } catch (e) { }
    
    exec(`git remote add origin ${REPO_URL}`);
    exec('git push -u origin main -f');
    
    console.log('\n✅ THÀNH CÔNG! Đã nâng cấp lên v8.0.');
    console.log('👉 F5 lại trang onluyen.vn. Hãy thử bấm nút "Test Scraper (Kiểm tra)" trước khi Start Auto.');
} catch (e) {
    console.log('\n⚠️ Lỗi push, kiểm tra đăng nhập Git.');
}