import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SearchCoursesDto {
  @ApiProperty({ description: 'Search query text', example: 'programming basics' })
  @IsString()
  query: string;

  @ApiPropertyOptional({ description: 'Number of results to return', default: 5, minimum: 1, maximum: 50 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  nResults?: number = 5;
}
