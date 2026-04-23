import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AttendanceDocument = Attendance & Document;

@Schema({ _id: false })
class AttendanceRecord {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  studentId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['present', 'absent', 'late'],
    default: 'present',
  })
  status: string;
}

const AttendanceRecordSchema = SchemaFactory.createForClass(AttendanceRecord);

@Schema({ timestamps: true })
export class Attendance {
  @Prop({ type: Types.ObjectId, ref: 'SchoolClass', required: true, index: true })
  schoolClassId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  instructorId: Types.ObjectId;

  @Prop({ type: Date, required: true, index: true })
  date: Date;

  @Prop({ type: [AttendanceRecordSchema], default: [] })
  records: AttendanceRecord[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);

// Ensure uniqueness per class per day
AttendanceSchema.index({ schoolClassId: 1, date: 1 }, { unique: true });
