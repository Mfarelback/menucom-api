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
import { EditMenuDto } from '../dtos/menu-edit.dto';
import { UrlTransformService } from 'src/image-proxy/services/url-transform.service';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    @InjectRepository(MenuItem)
    private readonly menuItemRepository: Repository<MenuItem>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly urlTransformService: UrlTransformService,
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

  async editMenu(newMenuDto: EditMenuDto, userId: string) {
    const menuFind = await this.menuRepository.find({
      where: { idOwner: userId, id: newMenuDto.id },
    });

    if (menuFind.length === 0) {
      throw new NotFoundException();
    }

    const newMenuEdited = menuFind[0];
    newMenuEdited.description = newMenuDto.description;

    return await this.menuRepository.save(newMenuEdited);
  }
  async deleteMenuByUser(menuId: string, userId: string) {
    const menuFind = await this.menuRepository.find({
      where: { idOwner: userId, id: menuId },
    });
    console.log(menuFind);

    if (menuFind.length === 0) {
      throw new NotFoundException();
    }

    // Encuentra todos los items del menú relacionados
    const findItemsMenu = await this.menuItemRepository.find({
      where: { menu: menuFind[0] },
    });

    // Elimina todos los items del menú relacionados
    if (findItemsMenu.length > 0) {
      await this.menuItemRepository.remove(findItemsMenu);
    }

    // Elimina el menú
    await this.menuRepository.remove(menuFind[0]);
    return menuFind[0];
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

  async deleteItemFromMenu(item: CreateMenuItemDto) {
    try {
      const itemToDelete = await this.menuItemRepository.findOne({
        where: { id: item.idMenu },
      });
      if (itemToDelete == null) throw new NotFoundException('Item not found');
      await this.menuItemRepository.remove(itemToDelete);
      return { message: 'Item deleted successfully' };
    } catch (error) {
      throw new HttpException('Error: ' + error, HttpStatus.CONFLICT);
    }
  }

  async addMenuItemByMenuID(item: CreateMenuItemDto) {
    const menu = await this.menuRepository.findOne({
      where: { id: item.idMenu },
    });
    if (menu == null) {
      throw new NotFoundException('No se encontró un menu al que asociar');
    }
    console.log(menu);
    console.log('Menuuuuuuuuuuuuu');
    const newItem = new MenuItem();

    newItem.id = uuidv4();
    newItem.name = item.name;
    newItem.photoURL = item.photoURL;
    newItem.price = item.price;
    newItem.ingredients = item.ingredients;
    newItem.deliveryTime = item.deliveryTime;
    newItem.menu = menu;
    console.log(newItem);
    console.log('Menuuuuuuuuuuuuu');

    return this.menuItemRepository.save(newItem);
  }

  async findMenuItemsByMenuId(menuId: string): Promise<any> {
    try {
      if (menuId.length === 0) {
        throw new NotFoundException(`No se encontró un menu con el ID vacio`);
      }

      const menu = await this.menuRepository.find({
        where: { idOwner: menuId },
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
          e.items = items;
        }),
      );

      const userOwn = await this.userRepository.findOne({
        where: { id: menuId },
      });
      if (userOwn) {
        delete userOwn.password;
        delete userOwn.needToChangepassword;
      }

      // Transformar las URLs de imágenes usando el proxy
      const responseData = {
        owner: userOwn,
        listmenu: menu,
      };

      return this.urlTransformService.transformDataUrls(responseData);
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
