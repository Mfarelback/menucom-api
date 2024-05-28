/* eslint-disable prettier/prettier */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { MercadoPagoConfig, Payment } from 'mercadopago';

@Injectable()
export class MercadopagoService {
  constructor() {
    try {
       
    //   MercadoPago.configure({
    //     access_token: process.env.MP_ACCESS_TOKEN,
    //     sandbox: true, // TODO
    //   });
    } catch (error) {
      console.log(error);
      // Log error into DB - not await
      throw new InternalServerErrorException(
        'Error al inicializar MercadoPagoService',
      );
    }
  }

  async createPreference(or: any) {
    try {
        const client = new MercadoPagoConfig({accessToken: ''});
        const payment = new Payment(client);
      let items = [];

      or.products.forEach((element) => {
        const mpC = parseFloat(element.price) * 0.0992;
        items = [
          ...items,
          {
            title: element.name,
            quantity: element.quantity,
            currency_id: 'ARS',
            unit_price: parseFloat(element.price) + mpC,
          },
        ];
      });
      const body = {
        transaction_amount: 12.34,
        description: '<DESCRIPTION>',
        payment_method_id: '<PAYMENT_METHOD_ID>',
        payer: {
            email: '<EMAIL>'
        },
    };

    //   const preference = {
    //     items: items,
    //     payer: {
    //       name: user.name,
    //       surname: '',
    //       email: user.email,
    //     },
    //     payment_methods: {
    //       excluded_payment_methods: [
    //         { transaction_types: ['ticket', 'bank_transfer'] },
    //       ],
    //     },
    //   };
      const paymentResponse = await payment.create({body});
      return {
        id: `${paymentResponse.additional_info}`,
      };
    } catch (e) {
      console.log(`Tiene un error ${e}`);
      throw new InternalServerErrorException(e);
    }
  }
}
