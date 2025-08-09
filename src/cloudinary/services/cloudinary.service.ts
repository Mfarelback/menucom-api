import { Injectable } from '@nestjs/common';
import { UploadApiErrorResponse, v2 } from 'cloudinary';

import toStream = require('buffer-to-stream');

@Injectable()
export class CloudinaryService {
  async uploadImage(
    file: Express.Multer.File,
  ): Promise<string | UploadApiErrorResponse> {
    try {
      return new Promise((resolve, reject) => {
        const upload = v2.uploader.upload_stream((error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result.url);
          }
        });

        toStream(file.buffer).pipe(upload);
      });
    } catch (error) {
      console.log(Date.now() + 'Error en el Throw:' + error);
      throw error;
    }
  }

  async uploadImages(files: Array<Express.Multer.File>): Promise<string[]> {
    let listUrl: string[] = [];
    return new Promise((resolve, rejects) => {
      files.forEach((image) => {
        const data = v2.uploader.upload_stream((error, result) => {
          if (error) rejects(error);
          listUrl.join(result.url);
          listUrl = listUrl;
          result;
        });
        toStream(image.buffer).pipe(data);
        resolve(listUrl);
      });
    });
  }
}
