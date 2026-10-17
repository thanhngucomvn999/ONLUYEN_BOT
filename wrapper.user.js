// ==UserScript==
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
