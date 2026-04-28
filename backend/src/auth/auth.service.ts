import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { ActivityService, classifyChannelFromHeaders } from '../activity/activity.service';
import { SessionService } from '../activity/session.service';
import { ActivityAction } from '../activity/schemas/activity.schema';
import type { Request } from 'express';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private activityService: ActivityService,
    private sessionService: SessionService,
  ) {}

  async register(createUserDto: CreateUserDto): Promise<{ message: string }> {
    const { email, password, first_name, last_name, phone } = createUserDto;

    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new this.userModel({
      first_name,
      last_name,
      phone,
      email,
      password: hashedPassword,
      role: UserRole.STUDENT, // Default role
    });

    await user.save();

    // Send welcome email
    await this.sendWelcomeEmail(email, first_name);

    return { message: 'User registered successfully' };
  }

  private async sendWelcomeEmail(email: string, firstName: string) {
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
      } else {
        console.log('[Register] Welcome email log (no SMTP configured):', email);
      }
    } catch (err) {
      console.error('Send welcome email failed:', err);
    }
  }

  async loginWithGoogle(idToken: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new BadRequestException('Google client ID is not configured');
    }

    const client = new OAuth2Client(clientId);
    let ticket;
    try {
      ticket = await client.verifyIdToken({ idToken, audience: clientId });
    } catch (err) {
      throw new BadRequestException('Invalid Google ID token');
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new BadRequestException('Google token payload missing email');
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
        role: UserRole.STUDENT,
      });
      await user.save();
    }

    return this.login(user.toObject ? user.toObject() : user, undefined);
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userModel.findOne({ email }).select('+password');
    if (user && await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user.toObject();
      return result;
    }
    return null;
  }

  async login(user: any, req?: Request) {
    const payload = { email: user.email, sub: user._id, role: user.role };
    const token = this.jwtService.sign(payload);

    const channel = req
      ? classifyChannelFromHeaders(
          req.headers['user-agent'],
          req.headers['x-client-channel'] as string | undefined,
        )
      : undefined;
    await this.activityService.logActivity(user._id, ActivityAction.LOGIN, {
      channel,
    });

    return {
      token,
      user: {
        id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        // convenient combined name and email for frontend
        name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
        email: user.email,
        role: user.role,
      },
    };
  }

  async logout(user: { id?: string; _id?: string }) {
    const userId = String(user?.id || user?._id || '').trim();
    if (userId) {
      await this.sessionService.markSessionEnded(userId);
    }
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userModel.findOne({ email }).select('+passwordResetToken +passwordResetExpires');
    if (!user) {
      return { message: 'If an account exists with this email, you will receive a reset link.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
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
      } else {
        console.log('[Forgot password] Reset link (no SMTP configured):', resetUrl);
      }
    } catch (err) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      console.error('Send reset email failed:', err);
    }

    return { message: 'If an account exists with this email, you will receive a reset link.' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.userModel.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select('+password +passwordResetToken +passwordResetExpires');

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    // Skip full schema validation here to avoid failing on old records
    await user.save({ validateBeforeSave: false });

    return { message: 'Password has been reset. You can log in with your new password.' };
  }
}
