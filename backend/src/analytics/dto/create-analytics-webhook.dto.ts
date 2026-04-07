import { IsArray, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateAnalyticsWebhookDto {
  @IsString()
  name: string;

  @IsUrl({ require_tld: false })
  url: string;

  @IsString()
  secret: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];
}
