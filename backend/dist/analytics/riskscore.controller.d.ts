import { RiskScoreService } from './riskscore.service';
export declare class RiskScoreController {
    private readonly riskScoreService;
    constructor(riskScoreService: RiskScoreService);
    create(createRiskScoreDto: any): Promise<import("./schemas/riskscore.schema").RiskScore>;
    findAll(): Promise<import("./schemas/riskscore.schema").RiskScore[]>;
    count(): Promise<number>;
    findOne(id: string): Promise<import("./schemas/riskscore.schema").RiskScore>;
    findByUser(userId: string): Promise<import("./schemas/riskscore.schema").RiskScore[]>;
    update(id: string, updateRiskScoreDto: any): Promise<import("./schemas/riskscore.schema").RiskScore>;
    remove(id: string): Promise<void>;
}
