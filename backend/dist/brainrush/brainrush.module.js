"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrainrushModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const auth_module_1 = require("../auth/auth.module");
const brainrush_controller_1 = require("./brainrush.controller");
const brainrush_service_1 = require("./brainrush.service");
const brainrush_gateway_1 = require("./brainrush.gateway");
const adaptation_service_1 = require("./services/adaptation.service");
const scoring_service_1 = require("./services/scoring.service");
const ai_service_1 = require("./services/ai.service");
const leaderboard_service_1 = require("./services/leaderboard.service");
const game_session_schema_1 = require("./schemas/game-session.schema");
const player_session_schema_1 = require("./schemas/player-session.schema");
const question_instance_schema_1 = require("./schemas/question-instance.schema");
const score_schema_1 = require("./schemas/score.schema");
let BrainrushModule = class BrainrushModule {
};
exports.BrainrushModule = BrainrushModule;
exports.BrainrushModule = BrainrushModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                useFactory: async (configService) => ({
                    secret: configService.get('JWT_SECRET', 'your-secret-key'),
                    signOptions: { expiresIn: '1d' },
                }),
                inject: [config_1.ConfigService],
            }),
            mongoose_1.MongooseModule.forFeature([
                { name: game_session_schema_1.GameSession.name, schema: game_session_schema_1.GameSessionSchema },
                { name: player_session_schema_1.PlayerSession.name, schema: player_session_schema_1.PlayerSessionSchema },
                { name: question_instance_schema_1.QuestionInstance.name, schema: question_instance_schema_1.QuestionInstanceSchema },
                { name: score_schema_1.Score.name, schema: score_schema_1.ScoreSchema },
            ]),
        ],
        controllers: [brainrush_controller_1.BrainrushController],
        providers: [
            brainrush_service_1.BrainrushService,
            brainrush_gateway_1.BrainrushGateway,
            adaptation_service_1.AdaptationService,
            scoring_service_1.ScoringService,
            ai_service_1.AiService,
            leaderboard_service_1.LeaderboardService,
        ],
        exports: [brainrush_service_1.BrainrushService],
    })
], BrainrushModule);
//# sourceMappingURL=brainrush.module.js.map