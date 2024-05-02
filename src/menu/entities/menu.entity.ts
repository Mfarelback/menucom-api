// menu.entity.ts
import { Entity, Column, OneToMany, PrimaryColumn } from 'typeorm';
import { MenuItem } from './menu-item.entity';
import { Exclude } from 'class-transformer';

@Entity()
export class Menu {

    @PrimaryColumn({ type: 'varchar', nullable: false })
    id: number;

    @Column({ type: 'varchar', nullable: false })
    idOwner: string;

    @Column({ type: 'varchar', nullable: true })
    description: string;

    @Exclude()
    @OneToMany(() => MenuItem, menuItem => menuItem.menu.id)
    items: MenuItem[];
}


