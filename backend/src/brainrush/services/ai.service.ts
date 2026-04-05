import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly AI_SERVICE_URL = process.env['AI_SERVICE_URL'] || 'http://localhost:8000';

  constructor(private readonly httpService: HttpService) { }

  async generateSession(subject: string, difficulty: string, numQuestions: number = 5): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.AI_SERVICE_URL}/brainrush/generate-session`, {
          subject,
          difficulty,
          num_questions: numQuestions
        })
      );

      const rawQuestions = response.data.questions || [];
      return rawQuestions.map((q: any, i: number) => ({
        id: q.id || `q-${i}-${Date.now()}`,
        text: q.question || q.text || q.questionText || 'Question',
        options: q.options || [],
        correctAnswer: q.correct_answer || q.correctAnswer || '',
        explanation: q.explanation || '',
        timeLimit: q.time_limit || q.timeLimit || 20,
        points: q.points || 500
      }));
    } catch (error) {
      this.logger.error('Failed to call Python generate-session, using fallback', error);
      return Array.from({ length: numQuestions }).map((_, i) => {
        const fb = this.getFallbackQuestion(difficulty, i);
        return {
          id: fb.id,
          text: fb.text,
          options: fb.options,
          correctAnswer: fb.correctAnswer,
          explanation: fb.explanation,
          timeLimit: fb.timeLimit,
          points: fb.points
        };
      });
    }
  }

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
      const fallback = this.getFallbackQuestion(difficulty);
      return {
        questionText: fallback.text,
        options: fallback.options,
        correctAnswer: fallback.correctAnswer
      };
    }
  }

  async generateFeedback(strengths: string[], weaknesses: string[]): Promise<string> {
    try {
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

  private getFallbackQuestion(difficulty: string, index = 0) {
    const fallbacks = [
      { q: 'What is the capital of France?', options: ['Paris', 'Lyon', 'Marseille'], ans: 'Paris' },
      { q: 'What is 10 + 10?', options: ['15', '20', '25'], ans: '20' },
      { q: 'Which language is used for Web?', options: ['C++', 'HTML', 'Cobol'], ans: 'HTML' }
    ];
    const picked = fallbacks[index % fallbacks.length];
    return {
      id: `fallback-${index}-${Date.now()}`,
      text: picked.q + ' (Fallback)',
      options: picked.options,
      correctAnswer: picked.ans,
      explanation: 'General knowledge fallback.',
      timeLimit: 20,
      points: 20
    };
  }
}
