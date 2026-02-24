import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly OLLAMA_URL = 'http://localhost:11434/api/generate';

  // Fallback static questions
  private readonly STATIC_QUESTIONS = [
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

  async generateQuestion(
    studentLevel: string,
    weaknesses: Record<string, any>,
    courseObjectives: string[],
    difficulty: 'easy' | 'medium' | 'hard',
  ): Promise<{ question: string; options: string[]; correctAnswer: string }> {
    try {
      const prompt = this.buildPrompt(studentLevel, weaknesses, courseObjectives, difficulty);
      const response = await axios.post(this.OLLAMA_URL, {
        model: 'microsoft/phi',
        prompt,
        stream: false,
      });
      const aiResponse = response.data.response;
      return this.parseQuestion(aiResponse);
    } catch (error) {
      this.logger.error('Failed to generate question from AI, using fallback', error);
      return this.getFallbackQuestion(difficulty);
    }
  }

  private buildPrompt(
    studentLevel: string,
    weaknesses: Record<string, any>,
    courseObjectives: string[],
    difficulty: 'easy' | 'medium' | 'hard',
  ): string {
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

  private parseQuestion(aiResponse: string): { question: string; options: string[]; correctAnswer: string } {
    try {
      const parsed = JSON.parse(aiResponse);
      return {
        question: parsed.question,
        options: parsed.options,
        correctAnswer: parsed.correctAnswer,
      };
    } catch {
      throw new Error('Invalid AI response format');
    }
  }

  private getFallbackQuestion(difficulty: 'easy' | 'medium' | 'hard') {
    const filtered = this.STATIC_QUESTIONS.filter(q => q.difficulty === difficulty);
    const random = filtered[Math.floor(Math.random() * filtered.length)];
    return {
      question: random.question,
      options: random.options,
      correctAnswer: random.correct,
    };
  }
}
