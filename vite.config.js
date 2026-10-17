import { defineConfig } from 'vite';
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
                banner: `// ==UserScript==
// @name         Intelligent AI Homework Solver (ONLUYEN_BOT Edition)
// @namespace    https://github.com/thanhngucomvn999/ONLUYEN_BOT
// @version      3.0.0
// @description  Advanced AI-powered homework solver for onluyen.vn
// @match        https://*.onluyen.vn/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==`,
            },
        },
    },
});
