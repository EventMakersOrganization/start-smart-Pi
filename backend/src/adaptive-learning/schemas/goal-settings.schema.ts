import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type GoalSettingsDocument = GoalSettings & Document;

@Schema({ timestamps: true })
export class GoalSettings {
  @Prop({ required: true, unique: true, index: true })
  studentId: string;

  @Prop({ required: true, min: 1, max: 20, default: 8 })
  studyHoursPerWeek: number;

  @Prop({ required: true, default: "general" })
  targetTopic: string;

  @Prop({ required: true, min: 50, max: 100, default: 75 })
  targetScorePerTopic: number;

  @Prop({ required: true, min: 1, max: 10, default: 2 })
  exercisesPerDay: number;

  @Prop({
    required: true,
    enum: ["beginner", "intermediate", "advanced"],
    default: "intermediate",
  })
  targetLevel: string;

  @Prop({ required: true })
  deadline: string;
}

export const GoalSettingsSchema = SchemaFactory.createForClass(GoalSettings);
