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
import { CreateClothingItemDto } from '../dtos/create_clothing.dto';

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

  async addWardItemByMenuID(item: CreateClothingItemDto) {
    const ward = await this.wardRepository.findOne({
      where: { id: item.idWard },
    });
    if (ward == null) {
      throw new NotFoundException('No se encontró un menu al que asociar');
    }
    console.log(ward);
    console.log('Waaaaard');
    const newItem = new ClothingItem();

    newItem.id = uuidv4();
    newItem.name = item.name;
    newItem.photoURL = item.photoURL;
    newItem.price = item.price;
    newItem.sizes = item.sizes;
    newItem.brand = item.brand;
    newItem.color = '';
    newItem.quantity = item.quantity;
    newItem.wardrobe = ward;
    console.log(newItem);
    console.log('Menuuuuuuuuuuuuu');

    return this.wardItemRepository.save(newItem);
  }

  async findAllWardsByUser(userId: string) {
    const userOwn = await this.userRepository.findOne({
      where: { id: userId },
    });

    const wards = await this.wardRepository.find({
      where: { idOwner: userOwn.id },
    });

    if (wards.length === 0) {
      throw new NotFoundException('El menú no tiene elementos asociados.');
    }
    console.log(wards);
    return wards;
  }

  async findClothingItemsByWardId(menuId: string): Promise<any> {
    try {
      if (menuId.length === 0) {
        throw new NotFoundException(`No se encontró un menu con el ID vacio`);
      }
      const menu = await this.wardRepository.find({
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
          const items = await this.wardItemRepository.find({
            where: { wardrobe: e },
          });
          // if (items.length === 0) {
          //   throw new NotFoundException(
          //     'El menú no tiene elementos asociados.',
          //   );
          // }
          e.items = items;
        }),
      );
      // menu[0].idOwner = userOwn[0].name;
      const userOwn = await this.userRepository.findOne({
        where: { id: menu[0].idOwner },
      });
      return {
        owner: userOwn.name,
        listmenu: menu,
      };
    } catch (error) {
      throw error;
    }
  }
}
