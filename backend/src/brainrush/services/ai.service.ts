import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly AI_SERVICE_URL = process.env['AI_SERVICE_URL'] || 'http://localhost:8000';

  constructor(private readonly httpService: HttpService) { }

  async generateSession(subject: string, difficulty: string, numQuestions = 5): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.AI_SERVICE_URL}/brainrush/generate-session`, {
          subject,
          difficulty,
          num_questions: numQuestions,
        }),
      );

      const qs = response.data.questions || [];
      return qs.map((q: any, idx: number) => ({
        id: `q-${idx}-${Date.now()}`,
        text: q.question,
        options: q.options,
        correctAnswer: q.correct_answer,
        explanation: q.explanation || 'Study hard!',
        timeLimit: q.time_limit || 20,
        points: q.points || 20
      }));
    } catch (error) {
      this.logger.error('Failed to generate session from AI service', error);
      // Fallback: generate multiple basic questions locally if needed
      return Array(numQuestions).fill(0).map((_, i) => this.getFallbackQuestion(difficulty, i));
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
        const fb = this.getFallbackQuestion(difficulty);
        return {
          id: `fb-${i}`,
          text: fb.questionText,
          options: fb.options,
          correctAnswer: fb.correctAnswer,
          explanation: 'Standard fallback explanation.',
          timeLimit: 20,
          points: 500
        };
      });
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
      text: picked.q,
      options: picked.options,
      correctAnswer: picked.ans,
      explanation: 'General knowledge.',
      timeLimit: 20,
      points: 20
    };
  }
}
