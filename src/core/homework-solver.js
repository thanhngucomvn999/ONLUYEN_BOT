import { Scraper } from './scraper.js';
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
            this.overlay.updateStatus(`Solving ${questions.length} questions...`);
            for (const q of questions) {
                const answer = await this.apiClient.call(q.text);
                logger.info(`Q: ${q.text} -> A: ${answer}`);
            }
            this.overlay.updateStatus('Solved!');
        } catch (e) {
            logger.error('Solve error: ' + e.message);
            this.overlay.updateStatus('Error: ' + e.message);
        }
    }
}
