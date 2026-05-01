import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, Max } from "class-validator";

export class UpdateContentEngagementDto {
  @ApiProperty({ example: "uuid-content-id" })
  @IsString()
  @IsNotEmpty()
  contentId: string;

  @ApiPropertyOptional({ example: 0.85, description: "0–1 fraction of video watched" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  videoWatchedFraction?: number;

  @ApiPropertyOptional({ example: 0.72, description: "0–1 scroll depth for reading" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  readingScrollFraction?: number;

  @ApiPropertyOptional({ example: 45, description: "Active reading time in seconds" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  readingActiveSeconds?: number;
}
