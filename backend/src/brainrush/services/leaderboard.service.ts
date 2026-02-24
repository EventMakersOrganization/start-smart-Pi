import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Score, ScoreDocument } from '../schemas/score.schema';

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectModel(Score.name) private scoreModel: Model<ScoreDocument>,
  ) {}

  async getLeaderboard(limit = 10): Promise<Score[]> {
    return this.scoreModel
      .find()
      .sort({ score: -1, timeSpent: 1 }) // Highest score, then lowest time
      .limit(limit)
      .exec();
  }

  async getLeaderboardByDifficulty(difficulty: 'easy' | 'medium' | 'hard', limit = 10): Promise<Score[]> {
    return this.scoreModel
      .find({ difficulty })
      .sort({ score: -1, timeSpent: 1 })
      .limit(limit)
      .exec();
  }
}
