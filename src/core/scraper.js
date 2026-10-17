import { logger } from '../logger.js';

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
