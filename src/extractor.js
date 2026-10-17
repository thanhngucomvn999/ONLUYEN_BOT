/**
 * Extractor Module - Chịu trách nhiệm lấy dữ liệu từ DOM của Onluyen.vn
 */
const Extractor = {
    /**
     * Sử dụng heuristic (tìm radio button và leo lên thẻ cha) để lấy toàn bộ text của câu hỏi.
     * Dựa trên hệ thống mẫu bạn đã cung cấp.
     */
    getQuestionData() {
        // 1. Tìm tất cả các nút radio (dấu hiệu của câu hỏi trắc nghiệm)
        const radios = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
        if (radios.length === 0) return null;

        // Lấy thẻ cha chung bao bọc tất cả các nút radio (thường là thẻ div chứa câu hỏi)
        let container = radios[0].parentElement;
        while (container && container !== document.body) {
            // Nếu thẻ cha này chứa hết các nút radio và có text dài
            if (container.textContent.length > 50 && container.contains(radios[radios.length - 1])) {
                break;
            }
            container = container.parentElement;
        }

        if (!container || container === document.body) return null;

        // 2. Lấy toàn bộ text (bạo lực nhưng hiệu quả)
        let rawText = container.innerText || container.textContent;
        
        // 3. Dọn dẹp rác
        rawText = rawText
            .replace(/Câu:\s*\d+/gi, '')
            .replace(/#\d+/g, '')
            .replace(/Báo lỗi/gi, '')
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // 4. Trích xuất các đáp án bằng Regex (Dựa vào chuỗi A...B...C...D...)
        // Ví dụ: A33,4665 lítB24,79 lítC17,92 lít.D33,60 lít
        const options = [];
        const optionRegex = /([A-D])\s*([^A-D]+)(?=[A-D]|$)/g;
        let match;
        while ((match = optionRegex.exec(rawText)) !== null) {
            options.push({
                letter: match[1],
                text: match[0].trim()
            });
        }

        // Nếu Regex không tìm thấy, trả về toàn bộ text làm câu hỏi
        let questionText = rawText;
        if (options.length > 0) {
            // Xóa phần đáp án khỏi câu hỏi
            options.forEach(opt => {
                questionText = questionText.replace(opt.text, '');
            });
            questionText = questionText.trim();
        }

        return { 
            questionText: questionText || rawText, 
            rawText: rawText,
            options: options.length > 0 ? options : null,
            radios: radios
        };
    },

    /**
     * Click vào đáp án dựa trên chữ cái (A, B, C, D)
     */
    clickAnswer(letter, radios) {
        const index = letter.toUpperCase().charCodeAt(0) - 65; // A -> 0, B -> 1...
        if (radios && radios[index]) {
            radios[index].click();
            return true;
        }
        return false;
    },

    /**
     * Click nút chuyển câu
     */
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
