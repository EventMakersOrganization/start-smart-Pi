"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
let AiService = AiService_1 = class AiService {
    constructor(httpService) {
        this.httpService = httpService;
        this.logger = new common_1.Logger(AiService_1.name);
        this.AI_SERVICE_URL = process.env['AI_SERVICE_URL'] || 'http://localhost:8000';
    }
    async generateSession(subject, difficulty, numQuestions = 5) {
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.AI_SERVICE_URL}/brainrush/generate-session`, {
                subject,
                difficulty,
                num_questions: numQuestions,
            }));
            const qs = response.data.questions || [];
            return qs.map((q, idx) => ({
                id: `q-${idx}-${Date.now()}`,
                text: q.question,
                options: q.options,
                correctAnswer: q.correct_answer,
                explanation: q.explanation || 'Study hard!',
                timeLimit: q.time_limit || 20,
                points: q.points || 20
            }));
        }
        catch (error) {
            this.logger.error('Failed to generate session from AI service', error);
            return Array(numQuestions).fill(0).map((_, i) => this.getFallbackQuestion(difficulty, i));
        }
    }
    async generateQuestion(subject, difficulty) {
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.AI_SERVICE_URL}/brainrush/generate-question`, {
                subject,
                difficulty,
                topic: 'general',
                question_type: 'MCQ'
            }));
            const q = response.data.question;
            return {
                questionText: q.question,
                options: q.options,
                correctAnswer: q.correct_answer
            };
        }
        catch (error) {
            this.logger.error('Failed to call Python AI Service, using fallback', error);
            const fallback = this.getFallbackQuestion(difficulty);
            return {
                questionText: fallback.text,
                options: fallback.options,
                correctAnswer: fallback.correctAnswer
            };
        }
    }
    async generateFeedback(strengths, weaknesses) {
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.AI_SERVICE_URL}/chatbot/ask`, {
                question: `Analyse mes résultats : points forts (${strengths.join(', ')}), points faibles (${weaknesses.join(', ')}). Donne-moi un conseil court et encourageant.`,
                conversation_history: [],
                mode: 'explain_like_beginner'
            }));
            return response.data.answer;
        }
        catch (error) {
            return 'Super effort ! Continue de t\'entraîner pour monter en niveau.';
        }
    }
    getFallbackQuestion(difficulty, index = 0) {
        const fallbacks = [
            { q: 'What is the capital of France?', options: ['Paris', 'Lyon', 'Marseille'], ans: 'Paris' },
            { q: 'What is 10 + 10?', options: ['15', '20', '25'], ans: '20' },
            { q: 'Which language is used for Web?', options: ['C++', 'HTML', 'Cobol'], ans: 'HTML' }
        ];
        const picked = fallbacks[index % fallbacks.length];
        return {
            id: `fallback-${index}-${Date.now()}`,
            text: picked.q,
            options: picked.options,
            correctAnswer: picked.ans,
            explanation: 'General knowledge.',
            timeLimit: 20,
            points: 20
        };
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService])
], AiService);
//# sourceMappingURL=ai.service.js.map