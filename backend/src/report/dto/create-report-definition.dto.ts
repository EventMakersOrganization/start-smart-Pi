import { IsArray, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateReportDefinitionDto {
  @IsString()
  name: string;

  @IsArray()
  @IsString({ each: true })
  metrics: string[];

  @IsOptional()
  @IsObject()
  filters?: Record<string, string>;

  @IsIn(['csv', 'xlsx'])
  format: 'csv' | 'xlsx';
}
