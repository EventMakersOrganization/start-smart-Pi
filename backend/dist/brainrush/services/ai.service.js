"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
let AiService = AiService_1 = class AiService {
    constructor() {
        this.logger = new common_1.Logger(AiService_1.name);
        this.OLLAMA_URL = 'http://localhost:11434/api/generate';
        this.STATIC_QUESTIONS = [
            {
                question: 'What is 2 + 2?',
                options: ['3', '4', '5', '6'],
                correct: '4',
                difficulty: 'easy',
            },
            {
                question: 'What is the capital of France?',
                options: ['London', 'Berlin', 'Paris', 'Madrid'],
                correct: 'Paris',
                difficulty: 'medium',
            },
            {
                question: 'What is the square root of 144?',
                options: ['10', '11', '12', '13'],
                correct: '12',
                difficulty: 'hard',
            },
        ];
    }
    async generateQuestion(studentLevel, weaknesses, courseObjectives, difficulty) {
        try {
            const prompt = this.buildPrompt(studentLevel, weaknesses, courseObjectives, difficulty);
            const response = await axios_1.default.post(this.OLLAMA_URL, {
                model: 'microsoft/phi',
                prompt,
                stream: false,
            });
            const aiResponse = response.data.response;
            return this.parseQuestion(aiResponse);
        }
        catch (error) {
            this.logger.error('Failed to generate question from AI, using fallback', error);
            return this.getFallbackQuestion(difficulty);
        }
    }
    buildPrompt(studentLevel, weaknesses, courseObjectives, difficulty) {
        return `
Generate a multiple-choice question for a ${difficulty} level student.
Student level: ${studentLevel}
Weaknesses: ${JSON.stringify(weaknesses)}
Course objectives: ${courseObjectives.join(', ')}

Format the response as JSON:
{
  "question": "What is...",
  "options": ["A", "B", "C", "D"],
  "correctAnswer": "A"
}
`;
    }
    parseQuestion(aiResponse) {
        try {
            const parsed = JSON.parse(aiResponse);
            return {
                question: parsed.question,
                options: parsed.options,
                correctAnswer: parsed.correctAnswer,
            };
        }
        catch {
            throw new Error('Invalid AI response format');
        }
    }
    getFallbackQuestion(difficulty) {
        const filtered = this.STATIC_QUESTIONS.filter(q => q.difficulty === difficulty);
        const random = filtered[Math.floor(Math.random() * filtered.length)];
        return {
            question: random.question,
            options: random.options,
            correctAnswer: random.correct,
        };
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)()
], AiService);
//# sourceMappingURL=ai.service.js.map