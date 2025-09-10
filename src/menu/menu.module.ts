import { Module } from '@nestjs/common';
import { MenuController } from './controllers/menu.controller';
import { MenuService } from './services/menu.service';
import { Menu } from './entities/menu.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuItem } from './entities/menu-item.entity';
import { User } from 'src/user/entities/user.entity';
import { ImageProxyModule } from 'src/image-proxy/image-proxy.module';

@Module({
  imports: [TypeOrmModule.forFeature([Menu, MenuItem, User]), ImageProxyModule],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
