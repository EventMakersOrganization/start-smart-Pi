import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument, UserRole, UserStatus } from './schemas/user.schema';
import { StudentProfile, StudentProfileDocument } from './schemas/student-profile.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ActivityService } from '../activity/activity.service';
import { SessionService } from '../activity/session.service';
import { ActivityAction } from '../activity/schemas/activity.schema';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(StudentProfile.name)
    private profileModel: Model<StudentProfileDocument>,
    private activityService: ActivityService,
    private sessionService: SessionService,
  ) { }

  private profileLookupFilter(userId: string) {
    if (Types.ObjectId.isValid(userId)) {
      return { $or: [{ userId }, { userId: new Types.ObjectId(userId) }] } as any;
    }
    return { userId } as any;
  }

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId).select("-password");
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const profile = await this.profileModel.findOne(this.profileLookupFilter(userId)).exec();
    return {
      user: {
        id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
      profile: profile
        ? {
          class: (profile as any).class ?? (profile as any).academic_level,
          risk_level: profile.risk_level,
          points_gamification: profile.points_gamification,
        }
        : null,
    };
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (updateProfileDto.first_name)
      user.first_name = updateProfileDto.first_name;
    if (updateProfileDto.last_name)
      user.last_name = updateProfileDto.last_name;
    if (updateProfileDto.phone)
      user.phone = updateProfileDto.phone;

    if (
      user.role === UserRole.STUDENT &&
      (updateProfileDto.class ||
        updateProfileDto.risk_level ||
        updateProfileDto.points_gamification !== undefined)
    ) {
      const updateData: any = {};
      if (updateProfileDto.class)
        updateData.class = updateProfileDto.class;
      if (updateProfileDto.risk_level)
        updateData.risk_level = updateProfileDto.risk_level;
      if (updateProfileDto.points_gamification !== undefined)
        updateData.points_gamification = updateProfileDto.points_gamification;

      await this.profileModel
        .findOneAndUpdate(
          this.profileLookupFilter(userId),
          { $set: updateData, $setOnInsert: { userId } },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        )
        .exec();
    }

    await user.save();
    await this.activityService.logActivity(
      userId,
      ActivityAction.PROFILE_UPDATE,
    );

    return this.getProfile(userId);
  }

  async getUsersByRole(role: string, requesterId?: string, requesterRole?: string) {
    // ── Query compatible instructor/teacher ──
    let query: any;
    if (role.toLowerCase() === 'instructor') {
      query = {
        role: { $regex: new RegExp(`^(instructor|teacher)$`, 'i') }
      };
    } else {
      query = {
        role: { $regex: new RegExp(`^${role}$`, 'i') }
      };
    }

    const users = await this.userModel.find(query).select('-password').exec();
    const onlineUserIds = await this.sessionService.getOnlineUserIdSet('allUsers');

    // If requesting students, include their student profiles (match userId as ObjectId or string)
    if (role.toLowerCase() === 'student') {
      let requesterClass: string | undefined;
      if (requesterRole?.toLowerCase() === UserRole.STUDENT && requesterId) {
        const requesterProfile = await this.profileModel
          .findOne(this.profileLookupFilter(requesterId))
          .lean();
        requesterClass = ((requesterProfile as any)?.class ?? (requesterProfile as any)?.academic_level)?.toString();
        if (!requesterClass) {
          return [];
        }
      }

      const userIds = users.map((u) => u._id);
      const userIdStrings = userIds.map((id) => String(id));
      const objectIds = userIdStrings
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));
      const profiles = await this.profileModel
        .find({
          $or: [
            { userId: { $in: objectIds } },
            { userId: { $in: userIdStrings } },
          ],
        } as any)
        .exec();

      const profileMap = new Map<string, StudentProfileDocument>();
      profiles.forEach((p) => profileMap.set(String(p.userId), p));

      return users
        .map((u) => {
        const p = profileMap.get(String(u._id));
        const userClass = p ? ((p as any).class ?? (p as any).academic_level) : undefined;
        return {
          id: u._id,
          first_name: u.first_name,
          last_name: u.last_name,
          email: u.email,
          phone: u.phone,
          role: u.role,
          status: u.status,
          isOnline: onlineUserIds.has(String(u._id)),
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
          class: userClass,
          risk_level: p ? p.risk_level : undefined,
          points_gamification: p ? p.points_gamification : undefined,
        } as any;
      })
        .filter((u: any) => {
          if (!requesterClass) {
            return true;
          }
          return u.class === requesterClass && String(u.id) !== String(requesterId);
        });
    }

    return users.map((u) => ({
      id: u._id,
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      isOnline: onlineUserIds.has(String(u._id)),
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }

  /** All users with student profile fields when applicable (admin analytics UI). */
  async listAllUsersForAdmin() {
    const users = await this.userModel.find().select('-password').sort({ createdAt: -1 }).exec();
    const onlineUserIds = await this.sessionService.getOnlineUserIdSet('allUsers');
    const userIds = users.map((u) => u._id);
    const userIdStrings = userIds.map((id) => String(id));
    const objectIds = userIdStrings
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    const profiles = await this.profileModel
      .find({
        $or: [{ userId: { $in: objectIds } }, { userId: { $in: userIdStrings } }],
      } as any)
      .exec();
    const profileMap = new Map<string, StudentProfileDocument>();
    profiles.forEach((p) => profileMap.set(String(p.userId), p));

    return users.map((u) => {
      const p = profileMap.get(String(u._id));
      return {
        id: u._id,
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        isOnline: onlineUserIds.has(String(u._id)),
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        academic_level: p ? p.class : undefined,
        risk_level: p ? p.risk_level : undefined,
        points_gamification: p ? p.points_gamification : undefined,
      } as any;
    });
  }

  async updateUserById(id: string, dto: any) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException("User not found");

    if (dto.first_name) user.first_name = dto.first_name;
    if (dto.last_name) user.last_name = dto.last_name;
    if (dto.email) user.email = dto.email;
    if (dto.phone) user.phone = dto.phone;
    if (dto.role) user.role = dto.role;
    if (dto.status) user.status = dto.status;
    if (dto.password) user.password = await bcrypt.hash(dto.password, 10);

    await user.save();

    if (
      user.role === UserRole.STUDENT &&
      (dto.class ||
        dto.risk_level ||
        dto.points_gamification !== undefined)
    ) {
      const updateData: any = {};
      if (dto.class) updateData.class = dto.class;
      if (dto.risk_level) updateData.risk_level = dto.risk_level;
      if (dto.points_gamification !== undefined)
        updateData.points_gamification = dto.points_gamification;

      await this.profileModel
        .findOneAndUpdate(
          this.profileLookupFilter(id),
          { $set: updateData, $setOnInsert: { userId: id } },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        )
        .exec();
    }

    await this.activityService.logActivity(id, ActivityAction.PROFILE_UPDATE);
    return { success: true };
  }

  async deleteUserById(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException("User not found");

    await this.profileModel.deleteOne({ userId: id }).exec();
    await this.userModel.deleteOne({ _id: id }).exec();
    await this.activityService.logActivity(id, ActivityAction.PROFILE_UPDATE);

    return { success: true };
  }

  async createUserByAdmin(dto: AdminCreateUserDto) {
    const existing = await this.userModel.findOne({ email: dto.email });
    if (existing) throw new ConflictException("Email already exists");

    const plainPassword =
      dto.password && dto.password.trim().length >= 6
        ? dto.password
        : crypto.randomBytes(6).toString("base64").slice(0, 10);

    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const lastName =
      dto.last_name && dto.last_name.trim().length > 0
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

    if (user.role === UserRole.STUDENT) {
      const profile = new this.profileModel({
        userId: user._id,
        class: null,
      });
      await profile.save();
    }

    // Send credentials by email if SMTP is configured, otherwise log to console
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });

    const loginUrl = `${process.env.FRONTEND_URL || "http://localhost:4200"}/login`;

    try {
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: dto.email,
          subject: "Your StartSmart account",
          text:
            `Hello ${dto.first_name},\n\n` +
            `An account has been created for you.\n\n` +
            `Email: ${dto.email}\n` +
            `Password: ${plainPassword}\n\n` +
            `You can log in here: ${loginUrl}\n`,
        });
      } else {
        console.log("[Admin create user] Credentials (no SMTP):", {
          email: dto.email,
          password: plainPassword,
        });
      }
    } catch (err) {
      console.error("Send create-user email failed:", err);
    }

    return {
      message: "User created successfully",
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
}