import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsNumber,
  Min,
} from "class-validator";
import { ActivityAction } from "../schemas/activity.schema";

export class LogActivityDto {
  @ApiProperty({ enum: ActivityAction })
  @IsString()
  @IsIn(Object.values(ActivityAction))
  action: ActivityAction;

  @ApiPropertyOptional({ example: "/student-dashboard/my-courses" })
  @IsOptional()
  @IsString()
  page_path?: string;

  @ApiPropertyOptional({ example: "course" })
  @IsOptional()
  @IsString()
  resource_type?: string;

  @ApiPropertyOptional({ example: "chapter-1" })
  @IsOptional()
  @IsString()
  resource_id?: string;

  @ApiPropertyOptional({ example: "Spring Data JPA" })
  @IsOptional()
  @IsString()
  resource_title?: string;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  duration_sec?: number;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
