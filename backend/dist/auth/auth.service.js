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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const google_auth_library_1 = require("google-auth-library");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const user_schema_1 = require("../users/schemas/user.schema");
const activity_service_1 = require("../activity/activity.service");
const activity_schema_1 = require("../activity/schemas/activity.schema");
let AuthService = class AuthService {
    constructor(userModel, jwtService, activityService) {
        this.userModel = userModel;
        this.jwtService = jwtService;
        this.activityService = activityService;
    }
    async register(createUserDto) {
        const { email, password, first_name, last_name, phone } = createUserDto;
        const existingUser = await this.userModel.findOne({ email });
        if (existingUser) {
            throw new common_1.ConflictException('Email already exists');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new this.userModel({
            first_name,
            last_name,
            phone,
            email,
            password: hashedPassword,
            role: user_schema_1.UserRole.STUDENT,
        });
        await user.save();
        await this.sendWelcomeEmail(email, first_name);
        return { message: 'User registered successfully' };
    }
    async sendWelcomeEmail(email, firstName) {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
            tls: {
                rejectUnauthorized: false,
            },
        });
        try {
            if (process.env.SMTP_HOST && process.env.SMTP_USER) {
                await transporter.sendMail({
                    from: process.env.SMTP_FROM || process.env.SMTP_USER,
                    to: email,
                    subject: 'Welcome to TechNova!',
                    text: `Hello ${firstName},\n\nWelcome to TechNova! Your account has been successfully created.\n\nBest regards,\nThe TechNova Team`,
                    html: `<p>Hello ${firstName},</p><p>Welcome to TechNova! Your account has been successfully created.</p><p>Best regards,<br>The TechNova Team</p>`,
                });
            }
            else {
                console.log('[Register] Welcome email log (no SMTP configured):', email);
            }
        }
        catch (err) {
            console.error('Send welcome email failed:', err);
        }
    }
    async loginWithGoogle(idToken) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId) {
            throw new common_1.BadRequestException('Google client ID is not configured');
        }
        const client = new google_auth_library_1.OAuth2Client(clientId);
        let ticket;
        try {
            ticket = await client.verifyIdToken({ idToken, audience: clientId });
        }
        catch (err) {
            throw new common_1.BadRequestException('Invalid Google ID token');
        }
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            throw new common_1.BadRequestException('Google token payload missing email');
        }
        const email = payload.email;
        const first_name = payload.given_name || '';
        const last_name = payload.family_name || '';
        let user = await this.userModel.findOne({ email });
        if (!user) {
            user = new this.userModel({
                first_name,
                last_name,
                email,
                role: user_schema_1.UserRole.STUDENT,
            });
            await user.save();
        }
        return this.login(user.toObject ? user.toObject() : user);
    }
    async validateUser(email, password) {
        const user = await this.userModel.findOne({ email }).select('+password');
        if (user && await bcrypt.compare(password, user.password)) {
            const { password, ...result } = user.toObject();
            return result;
        }
        return null;
    }
    async login(user) {
        const payload = { email: user.email, sub: user._id, role: user.role };
        const token = this.jwtService.sign(payload);
        await this.activityService.logActivity(user._id, activity_schema_1.ActivityAction.LOGIN);
        return {
            token,
            user: {
                id: user._id,
                first_name: user.first_name,
                last_name: user.last_name,
                name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
                email: user.email,
                role: user.role,
            },
        };
    }
    async forgotPassword(email) {
        const user = await this.userModel.findOne({ email }).select('+passwordResetToken +passwordResetExpires');
        if (!user) {
            return { message: 'If an account exists with this email, you will receive a reset link.' };
        }
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.passwordResetToken = hashedToken;
        user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
        await user.save({ validateBeforeSave: false });
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
        const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
            tls: {
                rejectUnauthorized: false,
            },
        });
        try {
            if (process.env.SMTP_HOST && process.env.SMTP_USER) {
                await transporter.sendMail({
                    from: process.env.SMTP_FROM || process.env.SMTP_USER,
                    to: email,
                    subject: 'Password reset',
                    text: `Use this link to reset your password (valid 1 hour): ${resetUrl}`,
                    html: `<p>Use this link to reset your password (valid 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
                });
            }
            else {
                console.log('[Forgot password] Reset link (no SMTP configured):', resetUrl);
            }
        }
        catch (err) {
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save({ validateBeforeSave: false });
            console.error('Send reset email failed:', err);
        }
        return { message: 'If an account exists with this email, you will receive a reset link.' };
    }
    async resetPassword(token, newPassword) {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const user = await this.userModel.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: new Date() },
        }).select('+password +passwordResetToken +passwordResetExpires');
        if (!user) {
            throw new common_1.BadRequestException('Invalid or expired reset token');
        }
        user.password = await bcrypt.hash(newPassword, 10);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });
        return { message: 'Password has been reset. You can log in with your new password.' };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        jwt_1.JwtService,
        activity_service_1.ActivityService])
], AuthService);
//# sourceMappingURL=auth.service.js.map