import { IsString, IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { MembershipPlan } from '../enums/membership-plan.enum';

export class UpdateMembershipDto {
  @IsOptional()
  @IsEnum(MembershipPlan)
  plan?: MembershipPlan;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
