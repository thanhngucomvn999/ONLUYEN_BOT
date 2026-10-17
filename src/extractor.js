/**
 * Extractor Module - Nhận diện loại câu hỏi và lấy dữ liệu.
 */
const Extractor = {
    getQuestionData() {
        // 1. Kiểm tra loại câu hỏi
        let radios = Array.from(document.querySelectorAll('input[type="radio"]'));
        // Lọc các ô text hiển thị (loại bỏ ô search ẩn)
        let textInputs = Array.from(document.querySelectorAll('input[type="text"], textarea'))
            .filter(el => !el.classList.contains('search-input') && el.offsetParent !== null);
        
        let type = 'unknown';
        let container = null;
        let targetNode = null;

        if (radios.length > 0) {
            type = 'multiple_choice';
            container = radios[0].parentElement;
            targetNode = radios[radios.length - 1];
        } else if (textInputs.length > 0) {
            type = 'short_answer';
            container = textInputs[0].parentElement;
            targetNode = textInputs[0];
        }

        if (!container) return null;

        // Tìm thẻ cha chung bao bọc toàn bộ câu hỏi
        while (container && container !== document.body) {
            if (container.contains(targetNode) && container.textContent.length > 50) {
                break;
            }
            container = container.parentElement;
        }
        if (!container || container === document.body) return null;

        let options = [];
        let rawText = container.innerText || container.textContent;
        rawText = rawText.replace(/Câu:\s*\d+/gi, '').replace(/#\d+/g, '').replace(/Báo lỗi/gi, '');

        // Xử lý riêng cho trắc nghiệm
        if (type === 'multiple_choice') {
            radios.forEach((radio, index) => {
                const letter = String.fromCharCode(65 + index); // 0->A, 1->B
                let label = radio.closest('label') || radio.parentElement;
                if (label.innerText.length < 3) label = label.parentElement;
                
                // Sửa lỗi dùng dấu huyền (dùng nối chuỗi thay thế)
                let text = label.innerText
                    .replace(new RegExp('^' + letter + '[\\.\\s]*', 'i'), '')
                    .replace(/Đáp án của bạn/gi, '')
                    .trim();
                    
                options.push({ letter: letter, text: text || ('Đáp án ' + letter), element: label });
            });
        }

        let questionText = rawText;
        options.forEach(opt => { questionText = questionText.replace(opt.text, ''); });
        questionText = questionText
            .replace(/Đáp án của bạn/gi, '')
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        return { 
            type: type, 
            questionText: questionText || rawText, 
            options: options, 
            radios: radios,
            textInputs: textInputs
        };
    },

    clickAnswer(letter, dataOptions) {
        const target = dataOptions.find(o => o.letter === letter);
        if (target) {
            const radio = target.element.querySelector('input[type="radio"]');
            if (radio) radio.click(); else target.element.click();
            return true;
        }
        return false;
    },

    fillShortAnswer(answerText, textInputs) {
        if (textInputs && textInputs.length > 0) {
            let input = textInputs[0];
            input.value = answerText;
            // Giả lập gõ phím để React/Web nhận diện
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
        return false;
    },

    clickNext() {
        const buttons = document.querySelectorAll('button, div[role="button"]');
        for (let b of buttons) {
            const t = b.innerText?.trim().toUpperCase();
            if (['BỎ QUA', 'TIẾP THEO', 'CÂU TIẾP', 'TIẾP'].includes(t)) {
                b.click();
                return true;
            }
        }
        return false;
    }
};

export default Extractor;
