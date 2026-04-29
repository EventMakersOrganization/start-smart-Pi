import { IsString, IsOptional, MinLength, IsIn } from 'class-validator';

export class GenerateVideoDto {
    @IsOptional()
    @IsString()
    courseContent?: string;

    @IsOptional()
    @IsIn(['en', 'fr'])
    language?: string = 'en';

    @IsOptional()
    @IsString()
    presenterUrl?: string;
}
