import { IsOptional, IsString, IsObject } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  academicLevel?: string;

  @IsOptional()
  @IsString()
  enrolledCourse?: string;

  @IsOptional()
  @IsObject()
  preferences?: Record<string, any>;
}
