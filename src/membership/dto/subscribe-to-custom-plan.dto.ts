import { IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SubscribeToCustomPlanDto {
  @IsString()
  subscriptionPlanId: string;

  @IsString()
  paymentId: string;

  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @IsOptional()
  @IsString()
  currency?: string = 'ARS';

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  metadata?: Record<string, any>;
}
