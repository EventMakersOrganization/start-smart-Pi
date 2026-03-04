import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Alert, AlertDocument } from './schemas/alert.schema';

@Injectable()
export class AlertService {
  constructor(
    @InjectModel(Alert.name)
    private alertModel: Model<AlertDocument>,
  ) {}

  async create(createAlertDto: any): Promise<Alert> {
    const alert = new this.alertModel(createAlertDto);
    return alert.save();
  }

  async findAll(): Promise<Alert[]> {
    return this.alertModel
      .find()
      .populate('student', 'first_name last_name email')
      .populate('instructor', 'first_name last_name email')
      .exec();
  }

  async findOne(id: string): Promise<Alert> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid Alert ID: ${id}`);
    }
    const alert = await this.alertModel
      .findById(id)
      .populate('student', 'first_name last_name email')
      .populate('instructor', 'first_name last_name email')
      .exec();
    if (!alert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
    }
    return alert;
  }

  async findByStudent(studentId: string): Promise<Alert[]> {
    if (!Types.ObjectId.isValid(studentId)) {
      throw new NotFoundException(`Invalid Student ID: ${studentId}`);
    }
    return this.alertModel
      .find({ student: studentId })
      .populate('student', 'first_name last_name email')
      .populate('instructor', 'first_name last_name email')
      .exec();
  }

  async findByInstructor(instructorId: string): Promise<Alert[]> {
    if (!Types.ObjectId.isValid(instructorId)) {
      throw new NotFoundException(`Invalid Instructor ID: ${instructorId}`);
    }
    return this.alertModel
      .find({ instructor: instructorId })
      .populate('student', 'first_name last_name email')
      .populate('instructor', 'first_name last_name email')
      .exec();
  }

  async findUnresolved(): Promise<Alert[]> {
    return this.alertModel
      .find({ resolved: false })
      .populate('student', 'first_name last_name email')
      .populate('instructor', 'first_name last_name email')
      .exec();
  }

  async update(id: string, updateAlertDto: any): Promise<Alert> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid Alert ID: ${id}`);
    }
    const alert = await this.alertModel
      .findByIdAndUpdate(id, updateAlertDto, { new: true })
      .populate('student', 'first_name last_name email')
      .populate('instructor', 'first_name last_name email')
      .exec();
    if (!alert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
    }
    return alert;
  }

  async resolve(id: string): Promise<Alert> {
    return this.update(id, { resolved: true });
  }

  async remove(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid Alert ID: ${id}`);
    }
    const result = await this.alertModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
    }
  }

  async count(): Promise<number> {
    return this.alertModel.countDocuments().exec();
  }
}
