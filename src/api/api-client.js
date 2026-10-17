import { GatewayManager } from './gateway-manager.js';
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
