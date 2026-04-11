import * as MercadoPago from 'mercadopago';

export const MERCADOPAGO_CLIENT_TOKEN = 'MERCADOPAGO_CLIENT';

export const mercadoPagoClientProvider = {
  provide: MERCADOPAGO_CLIENT_TOKEN,
  useFactory: () => {
    if (!process.env.MP_ACCESS_TOKEN) {
      throw new Error('Falta el Access Token de MercadoPago');
    }
    return new MercadoPago.MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN,
      options: {},
    });
  },
};
