import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CourseDocument = Course & Document;

@Schema({ _id: false })
export class Module {
    @Prop({ required: true })
    title: string;

    @Prop()
    description: string;

    @Prop({ default: 0 })
    order: number;
}

export const ModuleSchema = SchemaFactory.createForClass(Module);

@Schema({ timestamps: true })
export class Course {
    @Prop({ required: true })
    title: string;

    @Prop({ required: true })
    description: string;

    @Prop({ required: true })
    level: string;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    instructorId: Types.ObjectId;

    @Prop({ type: [ModuleSchema], default: [] })
    modules: Module[];

    createdAt?: Date;
    updatedAt?: Date;
}

export const CourseSchema = SchemaFactory.createForClass(Course);
