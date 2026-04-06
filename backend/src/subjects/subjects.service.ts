import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Subject, SubjectDocument } from './schemas/subject.schema';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(
    @InjectModel(Subject.name) private readonly subjectModel: Model<SubjectDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(dto: CreateSubjectDto) {
    const instructorIds = this.normalizeIds(dto.instructorIds);
    await this.assertAllInstructorsExist(instructorIds);

    const subject = await this.subjectModel.create({
      name: dto.name,
      description: dto.description || '',
      instructors: instructorIds.map((id) => new Types.ObjectId(id)),
    });

    return this.findOne(subject._id.toString());
  }

  async findAll() {
    const subjects = await this.subjectModel
      .find()
      .sort({ createdAt: -1 })
      .populate('instructors', 'first_name last_name email role')
      .exec();

    return subjects.map((subject) => this.toResponse(subject));
  }

  async findOne(id: string) {
    const subject = await this.subjectModel
      .findById(id)
      .populate('instructors', 'first_name last_name email role')
      .exec();

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    return this.toResponse(subject);
  }

  async update(id: string, dto: UpdateSubjectDto) {
    const subject = await this.subjectModel.findById(id);
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    if (dto.name !== undefined) {
      subject.name = dto.name;
    }
    if (dto.description !== undefined) {
      subject.description = dto.description;
    }
    if (dto.instructorIds !== undefined) {
      const instructorIds = this.normalizeIds(dto.instructorIds);
      await this.assertAllInstructorsExist(instructorIds);
      subject.instructors = instructorIds.map((instructorId) => new Types.ObjectId(instructorId));
    }

    await subject.save();

    return this.findOne(id);
  }

  async remove(id: string) {
    const deleted = await this.subjectModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Subject not found');
    }

    return { success: true };
  }

  private normalizeIds(ids: string[]) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('At least one instructor is required');
    }

    return [...new Set(ids.map((id) => id?.trim()).filter(Boolean))];
  }

  private async assertAllInstructorsExist(instructorIds: string[]) {
    const instructors = await this.userModel.find({
      _id: { $in: instructorIds },
      role: { $regex: /^(instructor|teacher)$/i },
    });

    if (instructors.length !== instructorIds.length) {
      throw new BadRequestException('One or more selected instructors are invalid');
    }
  }

  private toResponse(subject: SubjectDocument) {
    return {
      id: (subject as any)._id,
      name: subject.name,
      description: subject.description,
      instructors: ((subject as any).instructors || []).map((instructor: any) => ({
        id: instructor._id,
        first_name: instructor.first_name,
        last_name: instructor.last_name,
        email: instructor.email,
        role: instructor.role,
      })),
      createdAt: (subject as any).createdAt,
      updatedAt: (subject as any).updatedAt,
    };
  }
}
