import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessProfile } from '../entities/business-profile.entity';
import { UpdateBusinessProfileDto } from '../dto/business-profile.dto';
import { Commerce } from '../../commerce/entities/commerce.entity';

@Injectable()
export class BusinessProfileService {
  constructor(
    @InjectRepository(BusinessProfile)
    private readonly profileRepository: Repository<BusinessProfile>,
    @InjectRepository(Commerce)
    private readonly commerceRepository: Repository<Commerce>,
  ) {}

  async getProfile(commerceId: string): Promise<BusinessProfile> {
    let profile = await this.profileRepository.findOne({
      where: { commerceId },
    });

    if (!profile) {
      profile = this.profileRepository.create({ commerceId });
      profile = await this.profileRepository.save(profile);
    }

    return profile;
  }

  async updateProfile(
    commerceId: string,
    dto: UpdateBusinessProfileDto,
  ): Promise<BusinessProfile> {
    const profile = await this.getProfile(commerceId);
    Object.assign(profile, dto);
    return this.profileRepository.save(profile);
  }

  async getPublicProfile(identifier: string): Promise<any> {
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier,
      );

    const commerce = isUUID
      ? await this.commerceRepository.findOne({
          where: { id: identifier, isActive: true },
        })
      : await this.commerceRepository.findOne({
          where: { slug: identifier, isActive: true },
        });

    if (!commerce) {
      throw new NotFoundException('Commerce not found');
    }

    const profile = await this.profileRepository.findOne({
      where: { commerceId: commerce.id },
    });

    return {
      id: commerce.id,
      businessName: commerce.businessName,
      slug: commerce.slug,
      description: commerce.description,
      logoUrl: commerce.logoUrl,
      coverImageUrl: commerce.coverImageUrl,
      address: commerce.address,
      phone: commerce.phone,
      context: commerce.context,
      bio: profile?.bio || null,
      hours: profile?.hours || null,
      socialLinks: profile?.socialLinks || null,
      coverage: profile?.coverage || null,
      policies: profile?.policies || null,
      certifications: profile?.certifications || null,
    };
  }
}
