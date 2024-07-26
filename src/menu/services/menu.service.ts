import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
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

  async createMenu(createMenuDto: CreateMenuDto, userId: string): Promise<any> {
    if (
      createMenuDto.idMenuDirect.length <= 0 ||
      createMenuDto.idMenuDirect == null
    ) {
      const menu = new Menu();
      menu.id = uuidv4();
      menu.idOwner = userId;
      menu.description = createMenuDto.description;
      const menuNewCreated = await this.menuRepository.save(menu);
      // Creamos el item del menu
      const menuItem = new MenuItem();
      menuItem.id = uuidv4();
      menuItem.photoURL = createMenuDto.menuItems[0].photoURL;
      menuItem.name = createMenuDto.menuItems[0].name;
      menuItem.price = createMenuDto.menuItems[0].price;
      menuItem.deliveryTime = createMenuDto.menuItems[0].deliveryTime;
      menuItem.menu = menuNewCreated;

      const menuItemSave = await this.menuItemRepository.save(menuItem);

      return {
        ...menuNewCreated,
        ...menuItemSave,
      };
    }
    const menuExist = await this.menuRepository.findOne({
      where: { id: createMenuDto.idMenuDirect },
    });
    console.log('El menu existe');
    console.log(menuExist);

    const menuItem = new MenuItem();
    menuItem.id = uuidv4();
    menuItem.photoURL = createMenuDto.menuItems[0].photoURL;
    menuItem.name = createMenuDto.menuItems[0].name;
    menuItem.price = createMenuDto.menuItems[0].price;
    menuItem.deliveryTime = createMenuDto.menuItems[0].deliveryTime;
    menuItem.menu = menuExist;

    const menuItemSave = await this.menuItemRepository.save(menuItem);
    console.log('El item del menu guardado en el menu');
    console.log(menuItemSave);
    return {
      ...menuExist,
      item: menuItemSave,
    };
  }

  async editItemsFromMenu(newItem: CreateMenuItemDto) {
    try {
      const itemOfMenu = await this.menuItemRepository.findOne({
        where: { id: newItem.id },
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

  async addMenuItemByUserID(userId: string, item: CreateMenuItemDto) {
    const menu = await this.menuRepository.findOne({
      where: { idOwner: userId },
    });

    const newItem = new MenuItem();

    newItem.id = uuidv4();
    newItem.name = item.name;
    newItem.photoURL = item.photoURL;
    newItem.price = item.price;
    newItem.deliveryTime = item.deliveryTime;
    newItem.menu = menu;

    return this.menuItemRepository.save(newItem);
  }

  async findMenuItemsByMenuId(userId: string): Promise<Menu[]> {
    try {
      const userOwn = await this.userRepository.find({
        where: { id: userId },
      });
      const menu = await this.menuRepository.find({
        where: { idOwner: userId },
      });

      if (!menu || menu.length === 0) {
        throw new NotFoundException(
          `No se encontró un menu ${userOwn[0].name} con el ID ${userId}`,
        );
      }

      // Utiliza Promise.all para esperar a que todas las consultas de ítems se completen
      await Promise.all(
        menu.map(async (e) => {
          const items = await this.menuItemRepository.find({
            where: { menu: e },
          });
          if (items.length === 0) {
            throw new UnprocessableEntityException(
              'El menú no tiene elementos asociados.',
            );
          }
          e.items = items;
        }),
      );
      menu[0].idOwner = userOwn[0].name;
      return menu;
    } catch (error) {
      throw error;
    }
  }
}
