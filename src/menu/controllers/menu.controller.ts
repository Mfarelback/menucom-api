import {
  Body,
  Controller,
  Delete,
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
import { EditMenuDto } from '../dtos/menu-edit.dto';

@ApiTags('menú ')
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @UseGuards(JwtAuthGuard)
  @Get('/me')
  async getMenusByUser(@Req() req: Request) {
    const userID = req['user']['userId'];
    return this.menuService.findAllMenusbyUser(userID);
  }

  @Get('/bydining/:id')
  async getMenuByDining(@Param('id') id: string) {
    return this.menuService.findMenuItemsByMenuId(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/create/')
  async createMenu(@Req() req: Request, @Body() menu: CreateMenuDto) {
    const userID = req['user']['userId'];
    return this.menuService.createMenu(menu, userID);
  }
  @UseGuards(JwtAuthGuard)
  @Put('/edit/')
  async editMenu(@Req() req: Request, @Body() menu: EditMenuDto) {
    const userID = req['user']['userId'];
    return this.menuService.editMenu(menu, userID);
  }
  @UseGuards(JwtAuthGuard)
  @Delete('/delete/')
  async deleteMenu(@Req() req: Request, @Body() menu: EditMenuDto) {
    const userID = req['user']['userId'];
    return this.menuService.deleteMenuByUser(menu.id, userID);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/add-item/')
  async addMenuItem(@Body() item: CreateMenuItemDto) {
    return this.menuService.addMenuItemByMenuID(item);
  }

  @UseGuards(JwtAuthGuard)
  @Put('/edit-item/')
  async editMenuwithItem(@Body() item: CreateMenuItemDto) {
    return this.menuService.editItemsFromMenu(item);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/delete-item/')
  async deleteItemMenu(@Body() item: CreateMenuItemDto) {
    return this.menuService.deleteItemFromMenu(item);
  }
}
