import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RiskScore, RiskScoreDocument } from './schemas/riskscore.schema';
import {
  StudentProfile,
  StudentProfileDocument,
} from '../users/schemas/student-profile.schema';

export interface StudentComparisonItem {
  userId: string;
  score: number;
  vsAverage: number;
}

export interface ComparisonAnalyticsData {
  classLevel: string;
  classAverageScore: number;
  classAverageRisk: number;
  studentComparison: StudentComparisonItem[];
}

@Injectable()
export class ComparisonService {
  constructor(
    @InjectModel(StudentProfile.name)
    private readonly studentProfileModel: Model<StudentProfileDocument>,
    @InjectModel(RiskScore.name)
    private readonly riskScoreModel: Model<RiskScoreDocument>,
  ) {}

  async getComparativeAnalytics(classLevel?: string): Promise<ComparisonAnalyticsData> {
    const normalizedClassLevel = classLevel?.trim();

    const profileMatch: Record<string, any> = {
      points_gamification: { $type: 'number' },
    };

    if (normalizedClassLevel) {
      profileMatch.academic_level = normalizedClassLevel;
    }

    const comparison = await this.studentProfileModel
      .aggregate([
        {
          $match: profileMatch,
        },
        {
          $lookup: {
            from: this.riskScoreModel.collection.name,
            let: { studentUserId: '$userId' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$user', '$$studentUserId'] },
                },
              },
              {
                $sort: {
                  lastUpdated: -1,
                  _id: -1,
                },
              },
              {
                $limit: 1,
              },
              {
                $project: {
                  _id: 0,
                  score: { $ifNull: ['$score', 0] },
                },
              },
            ],
            as: 'latestRiskScore',
          },
        },
        {
          $addFields: {
            effectiveClassLevel: {
              $ifNull: ['$academic_level', 'UNASSIGNED'],
            },
            riskScore: {
              $ifNull: [{ $arrayElemAt: ['$latestRiskScore.score', 0] }, 0],
            },
          },
        },
        {
          $group: {
            _id: '$effectiveClassLevel',
            classAverageScore: { $avg: '$points_gamification' },
            classAverageRisk: { $avg: '$riskScore' },
            students: {
              $push: {
                userId: { $toString: '$userId' },
                score: '$points_gamification',
              },
            },
            totalStudents: { $sum: 1 },
          },
        },
        {
          $sort: {
            totalStudents: -1,
            _id: 1,
          },
        },
        {
          $limit: 1,
        },
        {
          $project: {
            _id: 0,
            classLevel: '$_id',
            classAverageScore: { $round: ['$classAverageScore', 2] },
            classAverageRisk: { $round: ['$classAverageRisk', 2] },
            studentComparison: {
              $map: {
                input: '$students',
                as: 'student',
                in: {
                  userId: '$$student.userId',
                  score: '$$student.score',
                  vsAverage: {
                    $round: [
                      {
                        $subtract: ['$$student.score', '$classAverageScore'],
                      },
                      2,
                    ],
                  },
                },
              },
            },
          },
        },
      ])
      .exec();

    if (comparison.length === 0) {
      return {
        classLevel: normalizedClassLevel || 'UNASSIGNED',
        classAverageScore: 0,
        classAverageRisk: 0,
        studentComparison: [],
      };
    }

    return comparison[0] as ComparisonAnalyticsData;
  }
}