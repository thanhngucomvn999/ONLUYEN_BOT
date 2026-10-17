/**
 * Extractor Module - Tìm đáp án qua vòng tròn chữ cái (A, B, C, D).
 */
const Extractor = {
    getQuestionData() {
        // 1. Tìm các thẻ chứa CHÍNH XÁC chữ A, B, C, D (vòng tròn nhỏ)
        const allEls = Array.from(document.querySelectorAll('div, span, p, label'));
        const letterBoxes = allEls.filter(el => {
            const txt = el.textContent.trim().toUpperCase();
            // Chỉ lấy những thẻ có text là A, B, C, D và độ dài text ngắn (tránh lấy cả câu)
            return ['A', 'B', 'C', 'D'].includes(txt) && el.children.length === 0;
        });

        if (letterBoxes.length === 0) return null;

        // 2. Từ vòng tròn chữ cái, tìm thẻ cha chứa nội dung đáp án
        const options = [];
        letterBoxes.forEach(box => {
            const letter = box.textContent.trim().toUpperCase();
            if (options.some(o => o.letter === letter)) return; // Bỏ qua nếu đã có

            // Đi lên thẻ cha (thường là khung đáp án)
            let row = box.parentElement;
            // Đi lên tối đa 3 cấp để tìm thẻ có chứa cả nội dung chữ
            for (let i = 0; i < 3; i++) {
                if (!row || row === document.body) break;
                // Nếu thẻ cha chứa cả chữ cái và nội dung (dài hơn 3 ký tự)
                if (row.innerText.trim().length > letter.length + 2) break;
                row = row.parentElement;
            }

            if (row && row !== document.body) {
                let text = row.innerText.trim()
                    .replace(/Đáp án của bạn/gi, '') // Xóa rác
                    .replace(/^[A-D][\.\s]*/i, '')  // Xóa chữ A. ở đầu
                    .trim();
                
                options.push({ 
                    letter: letter, 
                    text: text, 
                    element: row 
                });
            }
        });

        options.sort((a, b) => a.letter.localeCompare(b.letter));
        if (options.length < 2) return null;

        // 3. Tìm câu hỏi (Lấy text phía trên đáp án A)
        let questionText = "";
        let parent = options[0].element.parentElement;
        
        while (parent && parent !== document.body) {
            const rawText = parent.innerText;
            // Nếu thẻ cha chứa nội dung đáp án A, phần trước nó là câu hỏi
            if (rawText.includes(options[0].text)) {
                let splitText = rawText.split(options[0].text)[0];
                // Dọn dẹp rác
                splitText = splitText
                    .replace(/Câu\s+\d+.*/i, '')
                    .replace(/#\d+/g, '')
                    .replace(/Báo lỗi/gi, '')
                    .replace(/\n{2,}/g, '\n')
                    .trim();
                    
                if (splitText.length > 10) {
                    questionText = splitText;
                    break;
                }
            }
            parent = parent.parentElement;
        }

        return { 
            type: 'multiple_choice', 
            questionText: questionText || "Không đọc được câu hỏi", 
            options: options, 
            radios: options.map(o => o.element) // Dùng thẻ cha làm nút click
        };
    },

    clickAnswer(letter, dataOptions) {
        const target = dataOptions.find(o => o.letter === letter);
        if (target) {
            target.element.click(); // Click thẳng vào thẻ cha
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
