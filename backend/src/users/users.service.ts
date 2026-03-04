import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole, UserStatus } from './schemas/user.schema';
import { StudentProfile, StudentProfileDocument } from './schemas/student-profile.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ActivityService } from '../activity/activity.service';
import { ActivityAction } from '../activity/schemas/activity.schema';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(StudentProfile.name) private profileModel: Model<StudentProfileDocument>,
    private activityService: ActivityService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async count(): Promise<number> {
    return this.userModel.countDocuments().exec();
  }

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId).select('-password');
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profile = await this.profileModel.findOne({ userId }).exec();
    return {
      user: {
        id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
      },
      profile: profile
        ? {
            academic_level: profile.academic_level,
            risk_level: profile.risk_level,
            points_gamification: profile.points_gamification,
          }
        : null,
    };
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update user fields
    if (updateProfileDto.first_name) {
      user.first_name = updateProfileDto.first_name;
    }
    if (updateProfileDto.last_name) {
      user.last_name = updateProfileDto.last_name;
    }
    if (updateProfileDto.phone) {
      user.phone = updateProfileDto.phone;
    }
    // Only create/update student profile when user role is STUDENT
    if (
      user.role === UserRole.STUDENT && (
        updateProfileDto.academic_level ||
        updateProfileDto.risk_level ||
        updateProfileDto.points_gamification !== undefined
      )
    ) {
      let profile = await this.profileModel.findOne({ userId }).exec();
      if (!profile) {
        profile = new this.profileModel({ userId });
      }
      if (updateProfileDto.academic_level) profile.academic_level = updateProfileDto.academic_level;
      if (updateProfileDto.risk_level) profile.risk_level = updateProfileDto.risk_level as any;
      if (updateProfileDto.points_gamification !== undefined) profile.points_gamification = updateProfileDto.points_gamification as any;
      await profile.save();
    }

    await user.save();

    // Log activity
    await this.activityService.logActivity(userId, ActivityAction.PROFILE_UPDATE);

    return this.getProfile(userId);
  }

  async getUsersByRole(role: string) {
    // for backward compatibility treat 'instructor' as including legacy 'teacher' role
    let query: any;
    if (role === UserRole.INSTRUCTOR) {
      query = { role: { $in: [UserRole.INSTRUCTOR, 'teacher'] } };
    } else {
      query = { role };
    }

    const users = await this.userModel.find(query).select('-password').exec();

    // If requesting students, include their student profiles
    if (role === UserRole.STUDENT) {
      const userIds = users.map(u => u._id);
      const profiles = await this.profileModel.find({ userId: { $in: userIds } }).exec();
      const profileMap = new Map<string, StudentProfileDocument>();
      profiles.forEach(p => profileMap.set(String(p.userId), p));

      return users.map(u => {
        const p = profileMap.get(String(u._id));
        return {
          id: u._id,
          first_name: u.first_name,
          last_name: u.last_name,
          email: u.email,
          phone: u.phone,
          role: u.role,
          status: u.status,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
          academic_level: p ? p.academic_level : undefined,
          risk_level: p ? p.risk_level : undefined,
          points_gamification: p ? p.points_gamification : undefined,
        } as any;
      });
    }

    return users.map(u => ({
      id: u._id,
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }

  async getAllUsers() {
    const users = await this.userModel.find().select('-password').exec();

    // Get all student profiles
    const studentIds = users.filter(u => u.role === UserRole.STUDENT).map(u => u._id);
    const profiles = await this.profileModel.find({ userId: { $in: studentIds } }).exec();
    const profileMap = new Map<string, StudentProfileDocument>();
    profiles.forEach(p => profileMap.set(String(p.userId), p));

    return users.map(u => {
      const p = profileMap.get(String(u._id));
      return {
        id: u._id,
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        academic_level: p ? p.academic_level : undefined,
        risk_level: p ? p.risk_level : undefined,
        points_gamification: p ? p.points_gamification : undefined,
      } as any;
    });
  }

  async updateUserById(id: string, dto: any) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (dto.first_name) user.first_name = dto.first_name;
    if (dto.last_name) user.last_name = dto.last_name;
    if (dto.email) user.email = dto.email;
    if (dto.phone) user.phone = dto.phone;
    if (dto.role) user.role = dto.role;
    if (dto.status) user.status = dto.status;
    if (dto.password) {
      user.password = await bcrypt.hash(dto.password, 10);
    }

    await user.save();

    // Only create/update student profile when user role is STUDENT
    if (
      user.role === UserRole.STUDENT && (
        dto.academic_level ||
        dto.risk_level ||
        dto.points_gamification !== undefined
      )
    ) {
      let profile = await this.profileModel.findOne({ userId: id }).exec();
      if (!profile) {
        profile = new this.profileModel({ userId: id });
      }
      if (dto.academic_level) profile.academic_level = dto.academic_level;
      if (dto.risk_level) profile.risk_level = dto.risk_level as any;
      if (dto.points_gamification !== undefined) profile.points_gamification = dto.points_gamification as any;
      await profile.save();
    }

    await this.activityService.logActivity(id, ActivityAction.PROFILE_UPDATE);

    return { success: true };
  }

  async deleteUserById(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.profileModel.deleteOne({ userId: id }).exec();
    await this.userModel.deleteOne({ _id: id }).exec();

    await this.activityService.logActivity(id, ActivityAction.PROFILE_UPDATE);

    return { success: true };
  }

  async createUserByAdmin(dto: AdminCreateUserDto) {
    const existing = await this.userModel.findOne({ email: dto.email });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const plainPassword = dto.password && dto.password.trim().length >= 6
      ? dto.password
      : crypto.randomBytes(6).toString('base64').slice(0, 10);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const lastName = dto.last_name && dto.last_name.trim().length > 0
      ? dto.last_name
      : dto.first_name;

    const user = new this.userModel({
      first_name: dto.first_name,
      last_name: lastName,
      email: dto.email,
      phone: dto.phone,
      password: hashedPassword,
      role: dto.role || UserRole.STUDENT,
      status: dto.status || UserStatus.ACTIVE,
    });

    await user.save();

    // Send credentials by email if SMTP is configured, otherwise log to console
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });

    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/login`;

    try {
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: dto.email,
          subject: 'Your StartSmart account',
          text:
            `Hello ${dto.first_name},\n\n` +
            `An account has been created for you.\n\n` +
            `Email: ${dto.email}\n` +
            `Password: ${plainPassword}\n\n` +
            `You can log in here: ${loginUrl}\n`,
        });
      } else {
        console.log('[Admin create user] Credentials (no SMTP configured):', {
          email: dto.email,
          password: plainPassword,
        });
      }
    } catch (err) {
      console.error('Send create-user email failed:', err);
    }

    return {
      message: 'User created successfully',
      user: {
        id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
    };
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    // Find the user
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Upload image to Cloudinary
    const secureUrl = await this.cloudinaryService.uploadImage(file);

    // Update user avatar field
    user.avatar = secureUrl;
    await user.save();

    // Log activity
    await this.activityService.logActivity(userId, ActivityAction.PROFILE_UPDATE);

    // Return updated user without password
    return {
      id: user._id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      avatar: user.avatar,
    };
  }
}
