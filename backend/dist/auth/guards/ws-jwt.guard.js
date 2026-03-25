"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsJwtGuard = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
let WsJwtGuard = class WsJwtGuard {
    constructor(jwtService) {
        this.jwtService = jwtService;
        this.logger = new common_1.Logger('WsJwtGuard');
    }
    async canActivate(context) {
        try {
            const client = context.switchToWs().getClient();
            const authToken = client.handshake?.auth?.token || client.handshake?.query?.token;
            if (!authToken) {
                this.logger.error('No token found in handshake');
                return false;
            }
            const payload = await this.jwtService.verifyAsync(authToken);
            client.data.user = {
                id: payload.sub || payload.id,
                email: payload.email,
                role: payload.role,
            };
            return true;
        }
        catch (err) {
            this.logger.error(`Invalid token: ${err.message}`);
            return false;
        }
    }
};
exports.WsJwtGuard = WsJwtGuard;
exports.WsJwtGuard = WsJwtGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService])
], WsJwtGuard);
//# sourceMappingURL=ws-jwt.guard.js.map