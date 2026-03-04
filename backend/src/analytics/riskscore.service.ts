import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RiskScore, RiskScoreDocument } from './schemas/riskscore.schema';

@Injectable()
export class RiskScoreService {
  constructor(
    @InjectModel(RiskScore.name)
    private riskScoreModel: Model<RiskScoreDocument>,
  ) {}

  async create(createRiskScoreDto: any): Promise<RiskScore> {
    const riskScore = new this.riskScoreModel({
      ...createRiskScoreDto,
      lastUpdated: new Date(),
    });
    return riskScore.save();
  }

  async findAll(): Promise<RiskScore[]> {
    return this.riskScoreModel.find().populate('user', 'first_name last_name email').exec();
  }

  async findOne(id: string): Promise<RiskScore> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid RiskScore ID: ${id}`);
    }
    const riskScore = await this.riskScoreModel
      .findById(id)
      .populate('user', 'first_name last_name email')
      .exec();
    if (!riskScore) {
      throw new NotFoundException(`RiskScore with ID ${id} not found`);
    }
    return riskScore;
  }

  async findByUser(userId: string): Promise<RiskScore[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException(`Invalid User ID: ${userId}`);
    }
    return this.riskScoreModel
      .find({ user: userId })
      .populate('user', 'first_name last_name email')
      .exec();
  }

  async update(id: string, updateRiskScoreDto: any): Promise<RiskScore> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid RiskScore ID: ${id}`);
    }
    const riskScore = await this.riskScoreModel
      .findByIdAndUpdate(
        id,
        { ...updateRiskScoreDto, lastUpdated: new Date() },
        { new: true },
      )
      .populate('user', 'first_name last_name email')
      .exec();
    if (!riskScore) {
      throw new NotFoundException(`RiskScore with ID ${id} not found`);
    }
    return riskScore;
  }

  async remove(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid RiskScore ID: ${id}`);
    }
    const result = await this.riskScoreModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`RiskScore with ID ${id} not found`);
    }
  }

  async count(): Promise<number> {
    return this.riskScoreModel.countDocuments().exec();
  }
}
