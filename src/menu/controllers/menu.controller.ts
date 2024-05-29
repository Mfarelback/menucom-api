import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateMenuDto } from '../dtos/menu.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.gards';
import { MenuService } from '../services/menu.service';
import { CreateMenuItemDto } from '../dtos/menu-item.dto';

@ApiTags('menú ')
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('/bydining/:id')
  async getMenuByDining(@Param('id') id: string) {
    return this.menuService.findMenuItemsByMenuId(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/create/')
  async createMenuwithItem(@Req() req: Request, @Body() menu: CreateMenuDto) {
    const userID = req['user']['userId'];
    return this.menuService.createMenu(menu, userID);
  }

  @UseGuards(JwtAuthGuard)
  @Put('/edit/')
  async editMenuwithItem(@Req() req: Request, @Body() item: CreateMenuItemDto) {
    return this.menuService.editItemsFromMenu(item);
  }
}
