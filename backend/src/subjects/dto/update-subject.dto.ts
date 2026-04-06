import { IsArray, IsMongoId, IsOptional, IsString, ArrayUnique } from 'class-validator';

export class UpdateSubjectDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  instructorIds?: string[];
}
