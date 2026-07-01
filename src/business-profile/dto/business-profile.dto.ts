import { IsOptional, IsString, IsArray, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BusinessHour, SocialLinks, BusinessPolicies } from '../entities/business-profile.entity';

export class UpdateBusinessProfileDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessHourDto)
  hours?: BusinessHour[];

  @IsOptional()
  @IsObject()
  socialLinks?: SocialLinks;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  coverage?: string;

  @IsOptional()
  @IsObject()
  policies?: BusinessPolicies;
}

export class BusinessHourDto {
  @IsString()
  day: string;

  @IsString()
  open: string;

  @IsString()
  close: string;

  @IsOptional()
  isHoliday?: boolean;
}
