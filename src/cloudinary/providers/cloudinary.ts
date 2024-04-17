import { v2, ConfigOptions } from 'cloudinary';
import { CLOUDINARY } from '../constanst';

//TODO:Agregar variables de entorno
export const CloudinaryProvider = {
  provide: CLOUDINARY,
  useFactory: (): ConfigOptions => {
    return v2.config({
      cloud_name: 'photographer',
      api_key: '584713331577219',
      api_secret: '6ay4UUi0qUNcCTvVBYvr8ROs3gg',
    });
  },
};
