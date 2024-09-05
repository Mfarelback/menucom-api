import {
  //   HttpException,
  //   HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { Wardrobes } from '../entities/wardrobes.entity';
import { ClothingItem } from '../entities/clothing_item.entity';
import { WardrobeDto } from '../dtos/create-ward.dto';

@Injectable()
export class WardrobeServices {
  constructor(
    @InjectRepository(Wardrobes)
    private readonly wardRepository: Repository<Wardrobes>,
    @InjectRepository(ClothingItem)
    private readonly wardItemRepository: Repository<ClothingItem>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  //menu functions
  async createWardrobe(createWard: WardrobeDto, userId: string): Promise<any> {
    const wardItem = new Wardrobes();
    wardItem.id = uuidv4();
    wardItem.idOwner = userId;
    wardItem.description = createWard.description;
    wardItem.capacity = 15;
    const wardNewCreated = await this.wardRepository.save(wardItem);
    return {
      ...wardNewCreated,
    };
  }

  async editWardrobeByUser(newWardDto: WardrobeDto, userId: string) {
    const menuFind = await this.wardRepository.find({
      where: { idOwner: userId, id: newWardDto.id },
    });

    if (menuFind.length === 0) {
      throw new NotFoundException();
    }

    console.log(menuFind);
    const newWardEdited = menuFind[0];
    newWardEdited.description = newWardDto.description;

    await this.wardRepository.save(newWardEdited);
  }

  async deleteWardrobeByUser(wardrobeId: string, userId: string) {
    const menuFind = await this.wardRepository.find({
      where: { idOwner: userId, id: wardrobeId },
    });
    console.log(menuFind);

    if (menuFind.length === 0) {
      throw new NotFoundException();
    }

    await this.wardRepository.remove(menuFind[0]);
    return menuFind[0];
  }

  //   async addMenuItemByMenuID(item: CreateMenuItemDto) {
  //     const menu = await this.menuRepository.findOne({
  //       where: { id: item.idMenu },
  //     });
  //     if (menu == null)
  //       throw new NotFoundException('No se encontró un menu al que asociar');
  //     const newItem = new MenuItem();

  //     newItem.id = uuidv4();
  //     newItem.name = item.name;
  //     newItem.photoURL = item.photoURL;
  //     newItem.price = item.price;
  //     newItem.ingredients = item.ingredients;
  //     newItem.deliveryTime = item.deliveryTime;
  //     newItem.menu = menu;

  //     return this.menuItemRepository.save(newItem);
  //   }

  //   async findMenuItemsByMenuId(menuId: string): Promise<Menu[]> {
  //     try {
  //       const menu = await this.menuRepository.find({
  //         where: { id: menuId },
  //       });

  //       if (!menu || menu.length === 0) {
  //         throw new NotFoundException(
  //           `No se encontró un menu con el ID ${menuId}`,
  //         );
  //       }

  //       // Utiliza Promise.all para esperar a que todas las consultas de ítems se completen
  //       await Promise.all(
  //         menu.map(async (e) => {
  //           const items = await this.menuItemRepository.find({
  //             where: { menu: e },
  //           });
  //           if (items.length === 0) {
  //             throw new NotFoundException(
  //               'El menú no tiene elementos asociados.',
  //             );
  //           }
  //           e.items = items;
  //         }),
  //       );
  //       // menu[0].idOwner = userOwn[0].name;
  //       return menu;
  //     } catch (error) {
  //       throw error;
  //     }
  //   }

  async findAllWardsByUser(userId: string) {
    const userOwn = await this.userRepository.findOne({
      where: { id: userId },
    });

    const wards = await this.wardRepository.find({
      where: { idOwner: userOwn.id },
    });

    await Promise.all(
      wards.map(async (e) => {
        const itemsWar = await this.wardItemRepository.find({
          where: { wardrobe: e },
        });
        // if (itemsWar.length === 0) {
        //   throw new NotFoundException('El menú no tiene elementos asociados.');
        // }
        e.items = itemsWar;
      }),
    );

    return wards;
  }
}
