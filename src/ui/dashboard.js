import { CONFIG } from '../constants.js';
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

        const styles = `
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
        `;

        const styleSheet = document.createElement('style');
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);

        const panel = document.createElement('div');
        panel.id = 'hw-solver-overlay';
        panel.innerHTML = `
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
        `;
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
            this.statusEl.innerText = `Status: ${text}`;
            this.statusEl.style.color = color;
        }
    }
}
