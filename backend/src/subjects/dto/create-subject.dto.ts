import { IsArray, IsOptional, IsString, IsMongoId, ArrayUnique, ArrayNotEmpty } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsMongoId({ each: true })
  instructorIds: string[];
}
