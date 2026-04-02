import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Score, ScoreDocument } from '../schemas/score.schema';

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectModel(Score.name) private scoreModel: Model<ScoreDocument>,
  ) {}

  async getLeaderboard(gameSessionId: string) {
    return this.scoreModel
      .find({ gameSessionId })
      .populate('userId', 'first_name last_name')
      .sort({ score: -1 })
      .exec();
  }
}
