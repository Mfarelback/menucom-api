import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Catalog } from '../catalog/entities/catalog.entity';
import { CatalogItem } from '../catalog/entities/catalog-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Catalog, CatalogItem])],
})
export class MigrationModule {}
