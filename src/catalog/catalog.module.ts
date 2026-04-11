import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Catalog } from './entities/catalog.entity';
import { CatalogItem } from './entities/catalog-item.entity';
import { CatalogService } from './services/catalog.service';
import { CatalogController } from './controllers/catalog.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { MembershipModule } from '../membership/membership.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Catalog, CatalogItem]),
    CloudinaryModule,
    MembershipModule,
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
