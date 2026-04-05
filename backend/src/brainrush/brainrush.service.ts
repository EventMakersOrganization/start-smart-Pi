import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GameSession, GameSessionDocument, GameMode } from './schemas/game-session.schema';
import { PlayerSession, PlayerSessionDocument } from './schemas/player-session.schema';
import { QuestionInstance, QuestionInstanceDocument } from './schemas/question-instance.schema';
import { Score, ScoreDocument } from './schemas/score.schema';
import { PlayerAnswer, PlayerAnswerDocument } from './schemas/player-answer.schema';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { AiService } from './services/ai.service';
import { AdaptationService } from './services/adaptation.service';
import { ScoringService } from './services/scoring.service';
import { LeaderboardService } from './services/leaderboard.service';

@Injectable()
export class BrainrushService {
  constructor(
    @InjectModel(GameSession.name) private gameSessionModel: Model<GameSessionDocument>,
    @InjectModel(PlayerSession.name) private playerSessionModel: Model<PlayerSessionDocument>,
    @InjectModel(QuestionInstance.name) private questionModel: Model<QuestionInstanceDocument>,
    @InjectModel(Score.name) private scoreModel: Model<ScoreDocument>,
    @InjectModel(PlayerAnswer.name) private answerModel: Model<PlayerAnswerDocument>,
    private readonly aiService: AiService,
    private readonly adaptationService: AdaptationService,
    private readonly scoringService: ScoringService,
    private readonly leaderboardService: LeaderboardService,
  ) { }

  async createRoom(dto: CreateRoomDto, userId: string) {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const uid = new Types.ObjectId(userId);

    const session = new this.gameSessionModel({
      roomCode,
      mode: dto.mode,
      topic: dto.topic || 'General',
      players: [uid],
    });
    await session.save();

    const playerSession = new this.playerSessionModel({
      userId: uid,
      gameSessionId: session._id,
      currentDifficulty: dto.difficulty || 'medium'
    });
    await playerSession.save();

    return session;
  }

  async generateSoloSession(gameSessionId: string, userId: string, topic: string, difficulty: string) {
    const questions = await this.aiService.generateSession(topic, difficulty, 10);
    const savedQuestions = [];

    for (const q of questions) {
      const qInst = new this.questionModel({
        gameSessionId: new Types.ObjectId(gameSessionId),
        questionText: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        difficulty: q.difficulty || difficulty,
        topic: q.topic || topic,
        timeLimit: q.timeLimit || 20,
        points: q.points || 100
      });
      await qInst.save();
      savedQuestions.push(qInst);
    }

    return {
      status: 'success',
      questions: savedQuestions.map(q => ({
        questionId: q._id,
        question: q.questionText,
        options: q.options,
        correct_answer: q.correctAnswer,
        time_limit: q.timeLimit,
        points: q.points
      }))
    };
  }

  async joinRoom(dto: JoinRoomDto, userId: string) {
    const session = await this.gameSessionModel.findOne({ roomCode: dto.roomCode, isActive: true });
    if (!session) throw new NotFoundException('Room not found or inactive');

    if (!session.players.includes(new Types.ObjectId(userId))) {
      session.players.push(new Types.ObjectId(userId));
      await session.save();

      const playerSession = new this.playerSessionModel({
        userId: new Types.ObjectId(userId),
        gameSessionId: session._id,
      });
      await playerSession.save();
    }
    return session;
  }

  async getNextQuestion(gameSessionId: string, userId: string) {
    const playerSession = await this.playerSessionModel.findOne({
      gameSessionId: new Types.ObjectId(gameSessionId),
      userId: new Types.ObjectId(userId)
    });

    if (!playerSession) throw new NotFoundException('Player session not found');

    const aiQ = await this.aiService.generateQuestion('student', playerSession.currentDifficulty);

    const question = new this.questionModel({
      gameSessionId: new Types.ObjectId(gameSessionId),
      questionText: aiQ.questionText,
      options: aiQ.options,
      correctAnswer: aiQ.correctAnswer,
      difficulty: playerSession.currentDifficulty,
    });
    await question.save();

    return {
      questionId: question._id,
      questionText: question.questionText,
      options: question.options,
    };
  }

  async submitAnswer(gameSessionId: string, userId: string, dto: SubmitAnswerDto) {
    try {
      const question = await this.questionModel.findById(dto.questionId);
      if (!question) throw new NotFoundException('Question not found');

      const gid = new Types.ObjectId(gameSessionId);
      const uid = new Types.ObjectId(userId);

      const playerSession = await this.playerSessionModel.findOne({
        gameSessionId: { $in: [gid, gameSessionId] },
        userId: { $in: [uid, userId] }
      });

      if (!playerSession) {
        throw new NotFoundException(`Player session not found for UID: ${userId} in Game: ${gameSessionId}`);
      }

      const isCorrect = question.correctAnswer === dto.answer;

      // Log the answer for stats
      const sessionDetail = await this.gameSessionModel.findById(gameSessionId);
      await new this.answerModel({
        userId: uid,
        gameSessionId: gid,
        questionId: new Types.ObjectId(dto.questionId),
        answerGiven: dto.answer,
        isCorrect,
        responseTime: dto.responseTime,
        difficulty: question.difficulty || 'medium',
        topic: sessionDetail?.topic || 'General'
      }).save();

      // Adapt difficulty
      playerSession.currentDifficulty = this.adaptationService.adaptDifficulty(
        playerSession.currentDifficulty,
        isCorrect,
        dto.responseTime
      );

      // Score
      const points = this.scoringService.calculateScore(isCorrect, dto.responseTime, question.difficulty);
      playerSession.score += points;
      await playerSession.save();

      return { isCorrect, points, nextDifficulty: playerSession.currentDifficulty };
    } catch (error) {
      console.error('[Error] submitAnswer failed:', error);
      throw error;
    }
  }

  async finishGame(gameSessionId: string, userId: string) {
    try {
      const gid = new Types.ObjectId(gameSessionId);
      const uid = new Types.ObjectId(userId);

      // Search by both ObjectId and String to handle legacy or mis-typed data
      const playerSession = await this.playerSessionModel.findOne({
        gameSessionId: { $in: [gid, gameSessionId] },
        userId: { $in: [uid, userId] }
      });

      if (!playerSession) {
        throw new NotFoundException(`Result session not found for user ${userId} and game ${gameSessionId}`);
      }

      let aiFeedback = 'Great progress! Keep sharpening your skills.';
      try {
        aiFeedback = await this.aiService.generateFeedback(['Speed'], ['Accuracy']);
      } catch (fError) {
        console.warn('Feedback generation failed, using default');
      }

      const finalScore = new this.scoreModel({
        userId: uid,
        gameSessionId: gid,
        score: playerSession.score || 0,
        timeSpent: 60,
        difficultyAchieved: playerSession.currentDifficulty || 'medium',
        aiFeedback,
      });

      await finalScore.save();

      // Also mark game session as inactive if everyone finished
      // (Optional logic for multiplayer, but for solo we just return)

      return finalScore;
    } catch (error) {
      console.error('[Error] finishGame failed:', error);
      throw error;
    }
  }

  async getSoloStats(userId: string) {
    const uid = new Types.ObjectId(userId);
    console.log('[Stats] Fetching for (UID/String):', userId);

    const soloSessions = await this.gameSessionModel.find({
      mode: GameMode.SOLO,
      players: { $in: [uid, userId] }
    }).select('_id');

    console.log('[Stats] Solo Sessions found:', soloSessions.length);
    const sessionIds = soloSessions.map(s => s._id);

    if (sessionIds.length === 0) {
      return {
        summary: { totalGames: 0, avgScore: 0, bestScore: 0, successRate: 0, avgResponseTime: 0 },
        charts: { difficultyDistribution: [], topicPerformance: [], scoreProgression: [] }
      };
    }

    // Aggregations using $in for IDs
    const answers = await this.answerModel.aggregate([
      { $match: { userId: { $in: [uid, userId] }, gameSessionId: { $in: sessionIds } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          correct: { $sum: { $cond: ['$isCorrect', 1, 0] } },
          avgResponse: { $avg: '$responseTime' }
        }
      }
    ]);

    const statsByDiff = await this.answerModel.aggregate([
      { $match: { userId: { $in: [uid, userId] }, gameSessionId: { $in: sessionIds } } },
      {
        $group: {
          _id: '$difficulty',
          count: { $sum: 1 },
          successRate: { $avg: { $cond: ['$isCorrect', 100, 0] } }
        }
      }
    ]);

    const statsByTopic = await this.answerModel.aggregate([
      { $match: { userId: { $in: [uid, userId] }, gameSessionId: { $in: sessionIds } } },
      {
        $group: {
          _id: '$topic',
          count: { $sum: 1 },
          avgSuccess: { $avg: { $cond: ['$isCorrect', 1, 0] } }
        }
      }
    ]);

    const scores = await this.scoreModel.aggregate([
      { $match: { userId: { $in: [uid, userId] }, gameSessionId: { $in: sessionIds } } },
      {
        $group: {
          _id: null,
          totalGames: { $sum: 1 },
          avgScore: { $avg: '$score' },
          maxScore: { $max: '$score' }
        }
      }
    ]);

    const progression = await this.scoreModel.aggregate([
      { $match: { userId: { $in: [uid, userId] }, gameSessionId: { $in: sessionIds } } },
      {
        $project: {
          score: 1,
          createdAt: 1,
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        }
      },
      { $sort: { createdAt: 1 } }
    ]);

    const summary = {
      totalGames: scores[0]?.totalGames || 0,
      avgScore: Math.round(scores[0]?.avgScore || 0),
      bestScore: scores[0]?.maxScore || 0,
      successRate: answers[0] ? Math.round((answers[0].correct / answers[0].total) * 100) : 0,
      avgResponseTime: answers[0] ? parseFloat((answers[0].avgResponse / 1000).toFixed(2)) : 0
    };

    // Calculate Insights
    let strengths = 'N/A';
    let weaknesses = 'N/A';
    if (statsByDiff.length > 0) {
      const sorted = [...statsByDiff].sort((a, b) => b.count - a.count);
      strengths = `${sorted[0]._id} difficulty`;
      weaknesses = sorted.length > 1 ? `${sorted[sorted.length - 1]._id} difficulty` : 'N/A';
    }

    return {
      summary,
      charts: {
        progression: progression.map(p => ({ date: p.date, score: p.score })),
        difficultyPerf: statsByDiff.map(d => ({ _id: d._id, successRate: d.successRate })),
        topicDist: statsByTopic.map(t => ({ _id: t._id, count: t.count }))
      },
      insights: { strengths, weaknesses }
    };
  }
}
