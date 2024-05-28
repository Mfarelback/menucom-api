import { ConflictException, HttpException, HttpStatus, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CreateMenuDto } from '../dtos/menu.dto';
import { Menu } from '../entities/menu.entity';
import { v4 as uuidv4 } from 'uuid';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuItem } from '../entities/menu-item.entity';
import { CreateMenuItemDto } from '../dtos/menu-item.dto';


@Injectable()
export class MenuService {
    constructor(
        @InjectRepository(Menu)
        private readonly menuRepository: Repository<Menu>,
        @InjectRepository(MenuItem)
        private readonly menuItemRepository: Repository<MenuItem>,
    ) { }

    async createMenu(createMenuDto: CreateMenuDto, userId: string): Promise<any> {

        if (createMenuDto.idMenuDirect.length <= 0 || createMenuDto.idMenuDirect == null) {
            const menu = new Menu();
            menu.id = uuidv4();
            menu.idOwner = userId;
            menu.description = createMenuDto.description;
            const menuNewCreated = await this.menuRepository.save(menu)
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
            }
        }
        const menuExist = await this.menuRepository.findOne({ where: { id: createMenuDto.idMenuDirect, } });
        const itemsFinded = await this.menuItemRepository.find({ where: { menu: menuExist } })
        // Creamos el item del menu

        const menuItem = new MenuItem();
        menuItem.id = uuidv4();
        menuItem.photoURL = createMenuDto.menuItems[0].photoURL;
        menuItem.name = createMenuDto.menuItems[0].name;
        menuItem.price = createMenuDto.menuItems[0].price;
        menuItem.deliveryTime = createMenuDto.menuItems[0].deliveryTime;
        menuItem.menu = menuExist;

        const menuItemSave = await this.menuItemRepository.save(menuItem);
        return {
            ...menuExist,
            item: menuItemSave,
        }

    }

    async editItemsFromMenu(newItem: CreateMenuItemDto) {
        try {
            const itemOfMenu = await this.menuItemRepository.findOne({ where: { id: newItem.id } });
            if (itemOfMenu == null) throw new NotFoundException();
            const mergeItem = await this.menuItemRepository.merge(itemOfMenu, newItem);
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

            const menu = await this.menuRepository.find({
                where: { idOwner: userId },
            });

            if (!menu || menu.length === 0) {
                throw new NotFoundException('No se encontró ningún menú para el usuario especificado.');
            }


            // Utiliza Promise.all para esperar a que todas las consultas de ítems se completen
            await Promise.all(menu.map(async (e) => {
                const items = await this.menuItemRepository.find({ where: { menu: e } });
                if (items.length === 0) {
                    throw new UnprocessableEntityException('El menú no tiene elementos asociados.');
                }
                e.items = items;
            }));

            return menu;
        } catch (error) {
            throw error;
        }
    }
}
