import { IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class GradePrositDto {
  /**
   * 0–20 (recommandé). 0–100 accepté pour compatibilité : converti en /20 côté serveur.
   */
  @IsNumber()
  @Min(0)
  @Max(100)
  grade: number;

  @IsOptional()
  @IsString()
  feedback?: string;
}
