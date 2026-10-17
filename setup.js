#!/usr/bin/env node
/**
 * setup.js - Auto create FULL project structure, configure git, and push.
 * No token required. Uses local Git credentials.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================
// CONFIGURATION
// ============================================================
const REPO_URL = 'https://github.com/thanhngucomvn999/ONLUYEN_BOT.git';
const GIT_USER_NAME = 'thanhngucomvn999';
const GIT_USER_EMAIL = 'thanhngucomvn999@users.noreply.github.com';

// ============================================================
// FILE CONTENTS (EMBEDDED FULL STRUCTURE)
// ============================================================
const FILES = {};

// ------------------------------------------------------------
// 1. package.json
// ------------------------------------------------------------
FILES['package.json'] = JSON.stringify({
    name: 'onluyen-homework-auto-solver',
    version: '3.0.0',
    description: 'Advanced AI-powered homework solver with multi-gateway support',
    type: 'module',
    scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview'
    },
    devDependencies: {
        vite: '^5.0.0'
    },
    author: 'thanhngucomvn999',
    license: 'MIT'
}, null, 2) + '\n';

// ------------------------------------------------------------
// 2. vite.config.js
// ------------------------------------------------------------
FILES['vite.config.js'] = `import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/main.js'),
            name: 'Solver',
            fileName: () => 'solver.user.js',
            formats: ['iife'],
        },
        outDir: 'dist',
        minify: false,
        rollupOptions: {
            output: {
                banner: \`// ==UserScript==
// @name         Intelligent AI Homework Solver (ONLUYEN_BOT Edition)
// @namespace    https://github.com/thanhngucomvn999/ONLUYEN_BOT
// @version      3.0.0
// @description  Advanced AI-powered homework solver for onluyen.vn
// @match        https://*.onluyen.vn/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==\`,
            },
        },
    },
});
`;

// ------------------------------------------------------------
// 3. test.html
// ------------------------------------------------------------
FILES['test.html'] = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Solver Test Page</title>
</head>
<body>
    <h1>Test Page for AI Solver</h1>
    <p>This page is used to test the UI and logic of the userscript without visiting onluyen.vn.</p>
    
    <div class="question-container">
        <p class="question-text">What is 2 + 2?</p>
    </div>

    <script type="module" src="/src/main.js"></script>
</body>
</html>
`;

// ------------------------------------------------------------
// 4. src/constants.js
// ------------------------------------------------------------
FILES['src/constants.js'] = `export const CONFIG = {
    GATEWAY: localStorage.getItem('HW_SOLVER_GATEWAY') || 'onluyen_bot',
    API_KEY: localStorage.getItem('HW_SOLVER_API_KEY') || '',
    CUSTOM_URL: localStorage.getItem('HW_SOLVER_CUSTOM_URL') || '',
    DEFAULT_MODEL: localStorage.getItem('HW_SOLVER_DEFAULT_MODEL') || 'gemini',
    VISION_MODEL: localStorage.getItem('HW_SOLVER_VISION_MODEL') || 'gemini',
    PROXY_TIMEOUT_MS: 300000,
    LOOP_INTERVAL_MS: 4000,
    HUMAN_DELAY_MIN: 200,
    HUMAN_DELAY_MAX: 800,
    LOG_LEVEL: localStorage.getItem('HW_SOLVER_LOG_LEVEL') || 'INFO',
    LOG_HISTORY_LIMIT: 100,
    INSTANT_MODE: localStorage.getItem('HW_SOLVER_INSTANT_MODE') === 'true',
    THINK_BEFORE_ANSWER: localStorage.getItem('HW_SOLVER_THINK_BEFORE_ANSWER') !== 'false',
    IDLE_THRESHOLD: parseInt(localStorage.getItem('HW_SOLVER_IDLE_THRESHOLD'), 10) || 10,
};
`;

// ------------------------------------------------------------
// 5. src/logger.js
// ------------------------------------------------------------
FILES['src/logger.js'] = `import { CONFIG } from './constants.js';

class Logger {
    constructor() {
        this.history = [];
        this.levels = { DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4, NONE: 5 };
    }
    _log(level, ...args) {
        const numericLevel = this.levels[level.toUpperCase()];
        const configLevel = this.levels[CONFIG.LOG_LEVEL.toUpperCase()] || this.levels.NONE;
        if (!numericLevel || numericLevel < configLevel) return;
        const timestamp = new Date().toISOString();
        const message = \`[HW-Solver][\${level.toUpperCase()}]\`;
        if (this.history.length >= CONFIG.LOG_HISTORY_LIMIT) this.history.shift();
        this.history.push({ timestamp, level, messages: args });
        const logArgs = [message, \`(\${timestamp})\`, ...args];
        switch (level.toUpperCase()) {
            case 'WARN': console.warn(...logArgs); break;
            case 'ERROR': console.error(...logArgs); break;
            case 'DEBUG': console.debug(...logArgs); break;
            default: console.log(...logArgs); break;
        }
    }
    info(...args) { this._log('INFO', ...args); }
    warn(...args) { this._log('WARN', ...args); }
    error(...args) { this._log('ERROR', ...args); }
    debug(...args) { this._log('DEBUG', ...args); }
}

export const logger = new Logger();
`;

// ------------------------------------------------------------
// 6. src/api/gateway-manager.js
// ------------------------------------------------------------
FILES['src/api/gateway-manager.js'] = `import { CONFIG } from '../constants.js';
import { logger } from '../logger.js';

export const GATEWAYS = {
    onluyen_bot: {
        name: 'ONLUYEN_BOT (thanhngucomvn999)',
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
        name: 'Pollinations (legacy)',
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
        name: 'Custom (user endpoint)',
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

export class GatewayManager {
    getGateway(name) { return GATEWAYS[name] || GATEWAYS.onluyen_bot; }

    async chat(messages, opts = {}) {
        const gwName = CONFIG.GATEWAY;
        const gw = this.getGateway(gwName);
        const apiKey = CONFIG.API_KEY;
        
        if (!apiKey && gwName !== 'pollinations') {
            throw new Error('Missing API key. Please configure in Settings.');
        }
        
        const model = opts.model || CONFIG.DEFAULT_MODEL || gw.defaultModel;
        const payload = { messages, model, temperature: opts.temperature, max_tokens: opts.max_tokens };
        
        let req;
        if (gwName === 'custom') {
            if (!CONFIG.CUSTOM_URL) throw new Error('Missing Custom URL in Settings.');
            req = gw.buildRequest(payload, apiKey, CONFIG.CUSTOM_URL);
        } else {
            req = gw.buildRequest(payload, apiKey);
        }

        logger.info(\`Calling gateway: \${gw.name} | model: \${model}\`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), CONFIG.PROXY_TIMEOUT_MS);
        
        try {
            const res = await fetch(req.url, { ...req.options, signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(\`HTTP \${res.status}: \${errText.slice(0, 200)}\`);
            }
            const json = await res.json();
            const content = gw.parseResponse(json);
            if (!content) throw new Error('Empty response from gateway.');
            logger.info('Response received.');
            return content;
        } catch (e) {
            clearTimeout(timeout);
            logger.error(\`Gateway error (\${gw.name}): \${e.message}\`);
            throw e;
        }
    }
}
`;

// ------------------------------------------------------------
// 7. src/api/api-client.js
// ------------------------------------------------------------
FILES['src/api/api-client.js'] = `import { GatewayManager } from './gateway-manager.js';
import { logger } from '../logger.js';

export class APIClient {
    constructor() {
        this.gateway = new GatewayManager();
    }

    async call(prompt, images = []) {
        const userContent = [{ type: 'text', text: prompt }];
        images.forEach((imgSrc) => {
            userContent.push({ type: 'image_url', image_url: { url: imgSrc } });
        });

        const messages = [
            { role: 'system', content: 'Bạn là trợ lý chính xác. Hãy trả lời đúng yêu cầu, không thêm giải thích thừa.' },
            { role: 'user', content: userContent },
        ];

        try {
            return await this.gateway.chat(messages);
        } catch (error) {
            logger.error('APIClient.call failed:', error);
            throw error;
        }
    }
}
`;

// ------------------------------------------------------------
// 8. src/api/web-search.js
// ------------------------------------------------------------
FILES['src/api/web-search.js'] = `import { logger } from '../logger.js';
export class WebSearch {
    async search(query) {
        logger.info('WebSearch stub: ' + query);
        return '';
    }
}
`;

// ------------------------------------------------------------
// 9. src/core/math-logic.js
// ------------------------------------------------------------
FILES['src/core/math-logic.js'] = `import { logger } from '../logger.js';
export class MathLogic {
    solve(expression) {
        logger.info('MathLogic stub: ' + expression);
        return expression;
    }
}
`;

// ------------------------------------------------------------
// 10. src/core/pdf-processor.js
// ------------------------------------------------------------
FILES['src/core/pdf-processor.js'] = `import { logger } from '../logger.js';
export class PDFProcessor {
    async extractText(file) {
        logger.info('PDFProcessor stub');
        return '';
    }
}
`;

// ------------------------------------------------------------
// 11. src/core/scheduler.js
// ------------------------------------------------------------
FILES['src/core/scheduler.js'] = `import { CONFIG } from '../constants.js';
import { logger } from '../logger.js';

export class Scheduler {
    constructor(callback) {
        this.callback = callback;
        this.intervalId = null;
    }
    start() {
        if (this.intervalId) return;
        logger.info('Scheduler started');
        this.intervalId = setInterval(() => this.callback(), CONFIG.LOOP_INTERVAL_MS);
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger.info('Scheduler stopped');
        }
    }
}
`;

// ------------------------------------------------------------
// 12. src/core/scraper.js
// ------------------------------------------------------------
FILES['src/core/scraper.js'] = `import { logger } from '../logger.js';

export class Scraper {
    getQuestions() {
        // Giả lập lấy câu hỏi
        logger.info('Scraping questions...');
        const questions = [];
        document.querySelectorAll('.question-text').forEach((el, index) => {
            questions.push({ id: index, text: el.innerText });
        });
        return questions;
    }
}
`;

// ------------------------------------------------------------
// 13. src/core/homework-solver.js
// ------------------------------------------------------------
FILES['src/core/homework-solver.js'] = `import { Scraper } from './scraper.js';
import { Scheduler } from './scheduler.js';
import { APIClient } from '../api/api-client.js';
import { logger } from '../logger.js';
import { BasicUI } from '../ui/dashboard.js';

export class HomeworkSolver {
    constructor() {
        this.scraper = new Scraper();
        this.apiClient = new APIClient();
        this.scheduler = new Scheduler(() => this.solveOnce());
        this.overlay = new BasicUI(this);
    }

    start() {
        this.scheduler.start();
        this.overlay.updateStatus('Running...');
    }

    stop() {
        this.scheduler.stop();
        this.overlay.updateStatus('Stopped.');
    }

    async solveOnce() {
        try {
            const questions = this.scraper.getQuestions();
            if (questions.length === 0) {
                logger.info('No questions found.');
                return;
            }
            this.overlay.updateStatus(\`Solving \${questions.length} questions...\`);
            for (const q of questions) {
                const answer = await this.apiClient.call(q.text);
                logger.info(\`Q: \${q.text} -> A: \${answer}\`);
            }
            this.overlay.updateStatus('Solved!');
        } catch (e) {
            logger.error('Solve error: ' + e.message);
            this.overlay.updateStatus('Error: ' + e.message);
        }
    }
}
`;

// ------------------------------------------------------------
// 14. src/ui/dashboard.js
// ------------------------------------------------------------
FILES['src/ui/dashboard.js'] = `import { CONFIG } from '../constants.js';
import { GATEWAYS } from '../api/gateway-manager.js';
import { logger } from '../logger.js';

export class BasicUI {
    constructor(solver) {
        this.solver = solver;
        this.statusEl = null;
        this.init();
    }

    init() {
        if (document.getElementById('hw-solver-overlay')) return;

        const styles = \`
            #hw-solver-overlay { position: fixed; bottom: 20px; right: 20px; width: 280px; background: #2c3e50; color: white; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); font-family: 'Segoe UI', sans-serif; z-index: 999999; overflow: hidden; }
            #hw-solver-header { padding: 10px; background: #34495e; display: flex; justify-content: space-between; align-items: center; cursor: move; user-select: none; }
            #hw-solver-status { font-size: 13px; font-weight: bold; margin-bottom: 5px; color: #ecf0f1; }
            .hw-input-group { display: flex; flex-direction: column; gap: 5px; margin-bottom: 8px; }
            .hw-input-group label { font-size: 11px; color: #bdc3c7; }
            .hw-input { padding: 6px; border: 1px solid #34495e; border-radius: 4px; background: #3d566e; color: white; font-size: 12px; }
            .hw-btn { padding: 8px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; color: white; margin-bottom: 5px; width: 100%; }
            .hw-btn-start { background: #27ae60; } .hw-btn-start:hover { background: #2ecc71; }
            .hw-btn-stop { background: #c0392b; } .hw-btn-stop:hover { background: #e74c3c; }
            .hw-tab-content { padding: 12px; display: none; flex-direction: column; }
            .hw-tab-content.active { display: flex; }
            #hw-tab-bar { display: flex; background: #34495e; }
            .hw-tab { flex: 1; padding: 8px; text-align: center; font-size: 12px; cursor: pointer; color: #bdc3c7; }
            .hw-tab.active { color: white; background: #2c3e50; border-bottom: 2px solid #3498db; }
        \`;

        const styleSheet = document.createElement('style');
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);

        const panel = document.createElement('div');
        panel.id = 'hw-solver-overlay';
        panel.innerHTML = \`
            <div id="hw-solver-header">
                <span>AI Solver v3.0</span>
            </div>
            <div id="hw-tab-bar">
                <div class="hw-tab active" data-tab="solver">Solver</div>
                <div class="hw-tab" data-tab="settings">Settings</div>
            </div>
            <div id="hw-solver-content" class="hw-tab-content active">
                <div id="hw-solver-status">Status: Ready</div>
                <button id="hw-start-btn" class="hw-btn hw-btn-start">Start Auto</button>
                <button id="hw-once-btn" class="hw-btn" style="background:#2980b9;">Solve Once</button>
                <button id="hw-stop-btn" class="hw-btn hw-btn-stop">Stop</button>
            </div>
            <div id="hw-settings-content" class="hw-tab-content">
                <div class="hw-input-group">
                    <label>Gateway:</label>
                    <select id="hw-gateway" class="hw-input"></select>
                </div>
                <div class="hw-input-group">
                    <label>API Key:</label>
                    <input type="password" id="hw-api-key" class="hw-input" />
                </div>
                <div class="hw-input-group" id="hw-custom-group" style="display:none;">
                    <label>Custom Endpoint:</label>
                    <input type="text" id="hw-custom-url" class="hw-input" />
                </div>
            </div>
        \`;
        document.body.appendChild(panel);

        this.statusEl = panel.querySelector('#hw-solver-status');

        // Tabs
        panel.querySelectorAll('.hw-tab').forEach(tab => {
            tab.onclick = () => {
                panel.querySelectorAll('.hw-tab').forEach(t => t.classList.remove('active'));
                panel.querySelectorAll('.hw-tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                panel.querySelector('#hw-' + tab.dataset.tab + '-content').classList.add('active');
            };
        });

        // Buttons
        panel.querySelector('#hw-start-btn').onclick = () => this.solver.start();
        panel.querySelector('#hw-once-btn').onclick = () => this.solver.solveOnce();
        panel.querySelector('#hw-stop-btn').onclick = () => this.solver.stop();

        // Settings Logic
        const gwSelect = panel.querySelector('#hw-gateway');
        const apiKeyInput = panel.querySelector('#hw-api-key');
        const customGroup = panel.querySelector('#hw-custom-group');
        const customUrlInput = panel.querySelector('#hw-custom-url');

        Object.keys(GATEWAYS).forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = GATEWAYS[k].name;
            if (k === CONFIG.GATEWAY) opt.selected = true;
            gwSelect.appendChild(opt);
        });

        apiKeyInput.value = CONFIG.API_KEY;
        customUrlInput.value = CONFIG.CUSTOM_URL;

        const toggleCustom = () => {
            customGroup.style.display = gwSelect.value === 'custom' ? 'flex' : 'none';
        };
        gwSelect.onchange = toggleCustom;
        toggleCustom();

        const saveSettings = () => {
            CONFIG.GATEWAY = gwSelect.value;
            CONFIG.API_KEY = apiKeyInput.value.trim();
            CONFIG.CUSTOM_URL = customUrlInput.value.trim();
            localStorage.setItem('HW_SOLVER_GATEWAY', CONFIG.GATEWAY);
            localStorage.setItem('HW_SOLVER_API_KEY', CONFIG.API_KEY);
            localStorage.setItem('HW_SOLVER_CUSTOM_URL', CONFIG.CUSTOM_URL);
            logger.info('Settings saved.');
            this.updateStatus('Settings saved.', '#2ecc71');
            setTimeout(() => this.updateStatus('Ready'), 2000);
        };

        gwSelect.onchange = () => { toggleCustom(); saveSettings(); };
        apiKeyInput.onchange = saveSettings;
        customUrlInput.onchange = saveSettings;
    }

    updateStatus(text, color = '#ecf0f1') {
        if (this.statusEl) {
            this.statusEl.innerText = \`Status: \${text}\`;
            this.statusEl.style.color = color;
        }
    }
}
`;

// ------------------------------------------------------------
// 15. src/main.js
// ------------------------------------------------------------
FILES['src/main.js'] = `import { logger } from './logger.js';
import { HomeworkSolver } from './core/homework-solver.js';

logger.info('Initializing Homework Solver (ONLUYEN_BOT Edition)...');

const solver = new HomeworkSolver();

window.hwSolver = {
    start: solver.start.bind(solver),
    stop: solver.stop.bind(solver),
    solveOnce: solver.solveOnce.bind(solver),
    help: () => console.log('Use hwSolver.start(), hwSolver.stop(), or hwSolver.solveOnce()')
};

// Guardian Loop for UI Persistence
const startGuardian = () => {
    setInterval(() => {
        if (!document.getElementById('hw-solver-overlay')) {
            logger.warn('UI overlay missing. Re-initializing...');
            solver.overlay.init();
        }
    }, 2000);
};
startGuardian();
`;

// ------------------------------------------------------------
// 16. wrapper.user.js
// ------------------------------------------------------------
FILES['wrapper.user.js'] = `// ==UserScript==
// @name         Intelligent AI Homework Solver (Loader)
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Dynamic loader for the Intelligent AI Homework Solver.
// @author       NGUYEN CONG ANH
// @match        *://*.onluyen.vn/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';
    var SCRIPT_URL = 'https://raw.githubusercontent.com/thanhngucomvn999/ONLUYEN_BOT/main/dist/solver.user.js';
    var LOAD_DELAY = 2000;
    console.log('[AI Solver] Waiting ' + LOAD_DELAY + 'ms for page stabilization...');
    setTimeout(function () {
        console.log('[AI Solver] Loading core logic from GitHub...');
        fetch(SCRIPT_URL)
            .then(function (response) {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.text();
            })
            .then(function (code) {
                eval(code);
                console.log('[AI Solver] Core logic loaded successfully.');
            })
            .catch(function (error) {
                console.error('[AI Solver] Failed to load core logic:', error);
            });
    }, LOAD_DELAY);
})();
`;

// ------------------------------------------------------------
// 17. README.md & .gitignore & .github
// ------------------------------------------------------------
FILES['README.md'] = `# ONLUYEN Homework Auto Solver (ONLUYEN_BOT Edition)

This version replaces the Pollinations gateway with **ONLUYEN_BOT** and adds multi-gateway support via UI settings.

## Development
\`\`\`bash
npm install
npm run build
\`\`\`
`;

FILES['.gitignore'] = `node_modules/\n.DS_Store\n*.log\n.env\n.vscode/\n.idea/\n`;

FILES['.github/workflows/deploy.yml'] = `name: Deploy Userscript

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Verify files
        run: |
          test -f dist/solver.user.js || (echo "Missing dist/solver.user.js" && exit 1)
          echo "All files present"
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: userscripts-build
          path: dist/solver.user.js
`;

// ============================================================
// UTILITIES
// ============================================================
function writeFile(relPath, content) {
    const full = path.join(process.cwd(), relPath);
    const dir = path.dirname(full);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
    const size = (Buffer.byteLength(content, 'utf8') / 1024).toFixed(1);
    console.log('  [OK] ' + relPath + ' (' + size + ' KB)');
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

// ============================================================
// EXECUTION
// ============================================================
console.log('\nSTEP 1: Creating FULL project structure...\n');
Object.keys(FILES).forEach(function (relPath) {
    writeFile(relPath, FILES[relPath]);
});

console.log('\nSTEP 2: Initializing Git...\n');
if (!fs.existsSync(path.join(process.cwd(), '.git'))) {
    exec('git init');
    exec('git branch -M main');
} else {
    console.log('  [INFO] .git already exists, skipping init');
}

exec(`git config user.name "${GIT_USER_NAME}"`);
exec(`git config user.email "${GIT_USER_EMAIL}"`);
console.log(`  [OK] Configured Git User: ${GIT_USER_NAME}`);

exec('git add -A');
console.log('  [OK] git add -A');

try {
    exec('git commit -m "feat: Full source code structure with ONLUYEN_BOT multi-gateway"');
    console.log('  [OK] git commit');
} catch (e) {
    console.log('  [INFO] Nothing new to commit');
}

console.log('\nSTEP 3: Pushing to GitHub...\n');
try {
    execSync('git remote remove origin', { stdio: 'ignore' });
} catch (e) { }

exec(`git remote add origin ${REPO_URL}`);
exec('git push -u origin main -f');
console.log('  [OK] Pushed to ' + REPO_URL);

console.log('\nDONE! Toàn bộ file đã được tạo và push thành công.');
console.log('Vì bạn vừa push file nguồn (src/), hãy chạy lệnh sau để build ra file userscript:');
console.log('  > npm install');
console.log('  > npm run build');
console.log('\nSau đó push lại thư mục dist/ (nếu cần).');