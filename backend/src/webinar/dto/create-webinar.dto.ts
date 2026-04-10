import { IsString, IsNotEmpty, IsDateString, IsNumber, IsOptional } from 'class-validator';

export class CreateWebinarDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    description: string;

    @IsString()
    @IsOptional()
    thumbnailUrl?: string;

    @IsString()
    @IsNotEmpty()
    instructorName: string;

    @IsDateString()
    @IsNotEmpty()
    scheduledStartTime: string;

    @IsNumber()
    @IsNotEmpty()
    durationMinutes: number;
}
