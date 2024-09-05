import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateMenuDto } from '../dtos/menu.dto';
import { Menu } from '../entities/menu.entity';
import { v4 as uuidv4 } from 'uuid';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuItem } from '../entities/menu-item.entity';
import { CreateMenuItemDto } from '../dtos/menu-item.dto';
import { User } from 'src/user/entities/user.entity';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    @InjectRepository(MenuItem)
    private readonly menuItemRepository: Repository<MenuItem>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  //menu functions
  async createMenu(createMenuDto: CreateMenuDto, userId: string): Promise<any> {
    const menu = new Menu();
    menu.id = uuidv4();
    menu.idOwner = userId;
    menu.description = createMenuDto.description;
    menu.capacity = 15;
    const menuNewCreated = await this.menuRepository.save(menu);

    return {
      ...menuNewCreated,
    };
  }

  async editMenu(newMenuDto: CreateMenuDto, userId: string) {
    const menuFInd = this.menuRepository.find({ where: { idOwner: userId } });
    console.log(menuFInd);
  }

  //Items functions
  async editItemsFromMenu(newItem: CreateMenuItemDto) {
    try {
      const itemOfMenu = await this.menuItemRepository.findOne({
        where: { id: newItem.idMenu },
      });
      if (itemOfMenu == null) throw new NotFoundException();
      const mergeItem = await this.menuItemRepository.merge(
        itemOfMenu,
        newItem,
      );
      return await this.menuItemRepository.save(mergeItem);
    } catch (error) {
      throw new HttpException('Error: ' + error, HttpStatus.CONFLICT);
    }
  }

  async addMenuItemByMenuID(item: CreateMenuItemDto) {
    const menu = await this.menuRepository.findOne({
      where: { id: item.idMenu },
    });
    if (menu == null)
      throw new NotFoundException('No se encontró un menu al que asociar');
    const newItem = new MenuItem();

    newItem.id = uuidv4();
    newItem.name = item.name;
    newItem.photoURL = item.photoURL;
    newItem.price = item.price;
    newItem.ingredients = item.ingredients;
    newItem.deliveryTime = item.deliveryTime;
    newItem.menu = menu;

    return this.menuItemRepository.save(newItem);
  }

  async findMenuItemsByMenuId(menuId: string): Promise<Menu[]> {
    try {
      const menu = await this.menuRepository.find({
        where: { id: menuId },
      });

      if (!menu || menu.length === 0) {
        throw new NotFoundException(
          `No se encontró un menu con el ID ${menuId}`,
        );
      }

      // Utiliza Promise.all para esperar a que todas las consultas de ítems se completen
      await Promise.all(
        menu.map(async (e) => {
          const items = await this.menuItemRepository.find({
            where: { menu: e },
          });
          if (items.length === 0) {
            throw new NotFoundException(
              'El menú no tiene elementos asociados.',
            );
          }
          e.items = items;
        }),
      );
      // menu[0].idOwner = userOwn[0].name;
      return menu;
    } catch (error) {
      throw error;
    }
  }

  async findAllMenusbyUser(userId: string) {
    const userOwn = await this.userRepository.findOne({
      where: { id: userId },
    });

    const menus = this.menuRepository.find({ where: { idOwner: userOwn.id } });
    return menus;
  }
}
