import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsObject,
} from 'class-validator';
import { MembershipPlan } from '../enums/membership-plan.enum';

export class SubscribeMembershipDto {
  @IsString()
  plan: string;

  @IsString()
  paymentId: string;

  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsNumber()
  originalAmount?: number;

  @IsOptional()
  @IsString()
  discountCode?: string;

  @IsOptional()
  @IsNumber()
  discountPercentage?: number;

  @IsOptional()
  @IsString()
  currency?: string = 'ARS';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
