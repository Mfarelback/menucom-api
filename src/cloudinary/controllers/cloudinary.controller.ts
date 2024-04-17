import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { CloudinaryService } from '../services/cloudinary.service';

@ApiTags('uploads')
@Controller('cloudinary')
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @UseInterceptors(FileInterceptor('file'))
  @Post('upload')
  async upload(@UploadedFile('file') file: Express.Multer.File) {
    try {
      const dataUrl = await this.cloudinaryService.uploadImage(file);
      return {
        status: 200,
        body: dataUrl,
      };
    } catch (e) {
      console.log('Error:', e);
      throw new Error(e);
    }
  }

  @Post('uploads')
  @UseInterceptors(FilesInterceptor('files'))
  async uploades(@UploadedFiles() files: Array<Express.Multer.File>) {
    // console.log('files', files);
    let listUrl: string[] = [];
    try {
      for (let index = 0; index < files.length; index++) {
        const dataUrl = await this.cloudinaryService.uploadImage(files[index]);
        listUrl = [dataUrl.toString(), ...listUrl];
      }
      return {
        status: 200,
        body: listUrl,
      };
    } catch (e) {
      console.log('Error:', e);
      throw new Error(e);
    }
  }
}
