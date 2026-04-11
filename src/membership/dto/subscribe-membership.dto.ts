import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsObject,
} from 'class-validator';
import { MembershipPlan } from '../enums/membership-plan.enum';

export class SubscribeMembershipDto {
  @IsEnum(MembershipPlan)
  plan: MembershipPlan;

  @IsString()
  paymentId: string;

  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string = 'ARS';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
