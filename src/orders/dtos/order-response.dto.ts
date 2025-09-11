import { ApiProperty } from '@nestjs/swagger';
import { OrderItem } from '../entities/order.item.entity';

export class OrderResponseDto {
  @ApiProperty({ example: 'uuid-123-456' })
  id: string;

  @ApiProperty({ example: 'cliente@email.com', required: false })
  customerEmail?: string;

  @ApiProperty({ example: '333-3133-333', required: false })
  customerPhone?: string;

  @ApiProperty({ example: 'anonymous-user-123', required: false })
  createdBy?: string;

  @ApiProperty({
    example: 'owner-uuid-123',
    description: 'ID del propietario del menú/wardrobe',
    required: false,
  })
  ownerId?: string;

  @ApiProperty({ example: 'mp-operation-123', required: false })
  operationID?: string;

  @ApiProperty({
    example: 'https://mercadopago.com/checkout/123',
    required: false,
  })
  paymentUrl?: string;

  @ApiProperty({ type: [OrderItem] })
  items: OrderItem[];

  @ApiProperty({ example: 1200.0, description: 'Subtotal sin comisiones' })
  subtotal: number;

  @ApiProperty({
    example: 5.5,
    description: 'Porcentaje de comisión del marketplace aplicado',
  })
  marketplaceFeePercentage: number;

  @ApiProperty({
    example: 66.0,
    description: 'Monto de la comisión del marketplace',
  })
  marketplaceFeeAmount: number;

  @ApiProperty({ example: 1266.0, description: 'Total final con comisiones' })
  total: number;

  @ApiProperty({ example: 'pending' })
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
