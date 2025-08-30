import { IsEnum, IsOptional } from 'class-validator';
import { MembershipPlan } from '../enums/membership-plan.enum';

export class UpdateMembershipDto {
  @IsOptional()
  @IsEnum(MembershipPlan)
  plan?: MembershipPlan;

  @IsOptional()
  isActive?: boolean;
}
