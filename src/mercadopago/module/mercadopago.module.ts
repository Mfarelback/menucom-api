/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { MercadopagoService } from '../sercvices/mercadopago.service';

@Module({
  providers: [MercadopagoService],
})
export class MercadopagoModule {}
