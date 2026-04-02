import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly AI_SERVICE_URL = process.env['AI_SERVICE_URL'] || 'http://localhost:8000';

  constructor(private readonly httpService: HttpService) { }

  async generateQuestion(subject: string, difficulty: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.AI_SERVICE_URL}/brainrush/generate-question`, {
          subject,
          difficulty,
          topic: 'general',
          question_type: 'MCQ'
        }),
      );

      const q = response.data.question;
      return {
        questionText: q.question,
        options: q.options,
        correctAnswer: q.correct_answer
      };
    } catch (error) {
      this.logger.error('Failed to call Python AI Service, using fallback', error);
      return this.getFallbackQuestion(difficulty);
    }
  }

  async generateFeedback(strengths: string[], weaknesses: string[]): Promise<string> {
    try {
      // Use the Chatbot endpoint with a specific instruction for feedback
      const response = await firstValueFrom(
        this.httpService.post(`${this.AI_SERVICE_URL}/chatbot/ask`, {
          question: `Analyse mes résultats : points forts (${strengths.join(', ')}), points faibles (${weaknesses.join(', ')}). Donne-moi un conseil court et encourageant.`,
          conversation_history: [],
          mode: 'explain_like_beginner'
        }),
      );
      return response.data.answer;
    } catch (error) {
      return 'Super effort ! Continue de t\'entraîner pour monter en niveau.';
    }
  }

  private getFallbackQuestion(difficulty: string) {
    return {
      questionText: 'What is the capital of France? (Fallback)',
      options: ['London', 'Berlin', 'Paris', 'Madrid'],
      correctAnswer: 'Paris',
    };
  }
}
