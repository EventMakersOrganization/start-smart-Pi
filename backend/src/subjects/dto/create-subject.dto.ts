import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateSubjectDto {
  @ApiProperty({ example: "Application côté client 2_4TWIN3" })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    example: "Sujet principal regroupant les chapitres du module.",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: "MongoDB user id of the instructor",
    example: "66f2d8c3b5d9f9e1d0a00001",
  })
  @IsString()
  @IsOptional()
  instructorId?: string;
}
