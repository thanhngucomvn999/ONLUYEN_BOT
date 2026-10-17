import { CONFIG } from '../constants.js';
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
