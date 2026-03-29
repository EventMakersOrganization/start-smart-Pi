import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsArray,
} from "class-validator";

export class CreateStudentProfileDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsEnum(["beginner", "intermediate", "advanced"])
  level?: string;

  @IsOptional()
  learningPreferences?: {
    preferredStyle?: string;
    preferredDifficulty?: string;
    studyHoursPerDay?: number;
  };

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  strengths?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  weaknesses?: string[];
}
