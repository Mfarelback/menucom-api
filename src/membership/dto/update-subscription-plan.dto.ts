import { PartialType } from '@nestjs/mapped-types';
import { CreateSubscriptionPlanDto } from './create-subscription-plan.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { PlanStatus } from '../entities/subscription-plan.entity';

export class UpdateSubscriptionPlanDto extends PartialType(
  CreateSubscriptionPlanDto,
) {
  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus;
}
