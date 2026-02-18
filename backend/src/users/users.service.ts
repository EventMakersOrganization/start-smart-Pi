import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { StudentProfile, StudentProfileDocument } from './schemas/student-profile.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ActivityService } from '../activity/activity.service';
import { ActivityAction } from '../activity/schemas/activity.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(StudentProfile.name) private profileModel: Model<StudentProfileDocument>,
    private activityService: ActivityService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId).select('-password');
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profile = await this.profileModel.findOne({ userId }).exec();
    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      profile: profile ? {
        academicLevel: profile.academicLevel,
        enrolledCourse: profile.enrolledCourse,
        preferences: profile.preferences,
        averageScore: profile.averageScore,
      } : null,
    };
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update user fields
    if (updateProfileDto.name) {
      user.name = updateProfileDto.name;
    }
    if (updateProfileDto.academicLevel || updateProfileDto.enrolledCourse || updateProfileDto.preferences) {
      let profile = await this.profileModel.findOne({ userId }).exec();
      if (!profile) {
        profile = new this.profileModel({ userId });
      }
      if (updateProfileDto.academicLevel) profile.academicLevel = updateProfileDto.academicLevel;
      if (updateProfileDto.enrolledCourse) profile.enrolledCourse = updateProfileDto.enrolledCourse;
      if (updateProfileDto.preferences) profile.preferences = { ...profile.preferences, ...updateProfileDto.preferences };
      await profile.save();
    }

    await user.save();

    // Log activity
    await this.activityService.logActivity(userId, ActivityAction.PROFILE_UPDATE);

    return this.getProfile(userId);
  }
}
