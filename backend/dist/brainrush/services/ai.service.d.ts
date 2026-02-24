export declare class AiService {
    private readonly logger;
    private readonly OLLAMA_URL;
    private readonly STATIC_QUESTIONS;
    generateQuestion(studentLevel: string, weaknesses: Record<string, any>, courseObjectives: string[], difficulty: 'easy' | 'medium' | 'hard'): Promise<{
        question: string;
        options: string[];
        correctAnswer: string;
    }>;
    private buildPrompt;
    private parseQuestion;
    private getFallbackQuestion;
}
