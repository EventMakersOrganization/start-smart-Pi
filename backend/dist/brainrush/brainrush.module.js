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
const axios_1 = require("@nestjs/axios");
const brainrush_controller_1 = require("./brainrush.controller");
const brainrush_service_1 = require("./brainrush.service");
const ai_service_1 = require("./services/ai.service");
const adaptation_service_1 = require("./services/adaptation.service");
const scoring_service_1 = require("./services/scoring.service");
const leaderboard_service_1 = require("./services/leaderboard.service");
const room_service_1 = require("./services/room.service");
const brainrush_gateway_1 = require("./gateways/brainrush.gateway");
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
            mongoose_1.MongooseModule.forFeature([
                { name: game_session_schema_1.GameSession.name, schema: game_session_schema_1.GameSessionSchema },
                { name: player_session_schema_1.PlayerSession.name, schema: player_session_schema_1.PlayerSessionSchema },
                { name: question_instance_schema_1.QuestionInstance.name, schema: question_instance_schema_1.QuestionInstanceSchema },
                { name: score_schema_1.Score.name, schema: score_schema_1.ScoreSchema },
            ]),
            axios_1.HttpModule,
        ],
        controllers: [brainrush_controller_1.BrainrushController],
        providers: [
            brainrush_service_1.BrainrushService,
            ai_service_1.AiService,
            adaptation_service_1.AdaptationService,
            scoring_service_1.ScoringService,
            leaderboard_service_1.LeaderboardService,
            room_service_1.RoomService,
            brainrush_gateway_1.BrainrushGateway,
        ],
        exports: [brainrush_service_1.BrainrushService],
    })
], BrainrushModule);
//# sourceMappingURL=brainrush.module.js.map