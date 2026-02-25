import { IsOptional, IsString, IsIn, IsInt, IsEmail, MinLength } from 'class-validator';
import { UserRole, UserStatus } from '../schemas/user.schema';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  // email field added so admins can update user email addresses
  // validated by class-validator's IsEmail decorator
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(Object.values(UserRole))
  role?: UserRole;

  @IsOptional()
  @IsIn(Object.values(UserStatus))
  status?: UserStatus;

  @IsOptional()
  @IsString()
  academic_level?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  risk_level?: 'LOW' | 'MEDIUM' | 'HIGH';

  @IsOptional()
  @IsInt()
  points_gamification?: number;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
