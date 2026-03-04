import { Model } from 'mongoose';
import { RiskScore, RiskScoreDocument } from './schemas/riskscore.schema';
export declare class RiskScoreService {
    private riskScoreModel;
    constructor(riskScoreModel: Model<RiskScoreDocument>);
    create(createRiskScoreDto: any): Promise<RiskScore>;
    findAll(): Promise<RiskScore[]>;
    findOne(id: string): Promise<RiskScore>;
    findByUser(userId: string): Promise<RiskScore[]>;
    update(id: string, updateRiskScoreDto: any): Promise<RiskScore>;
    remove(id: string): Promise<void>;
    count(): Promise<number>;
}
