import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { CloudinaryService } from '../services/cloudinary.service';
import { CanManageUsers } from '../../auth/decorators/role-helpers.decorator';

@ApiTags('uploads')
@Controller('cloudinary')
export class CloudinaryController {
  private readonly logger = new Logger(CloudinaryController.name);

  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @CanManageUsers()
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
      this.logger.error(
        'Error uploading file',
        e instanceof Error ? e.stack : undefined,
      );
      throw new Error(e);
    }
  }

  @CanManageUsers()
  @Post('uploads')
  @UseInterceptors(FilesInterceptor('files'))
  async uploades(@UploadedFiles() files: Array<Express.Multer.File>) {
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
      this.logger.error(
        'Error uploading files',
        e instanceof Error ? e.stack : undefined,
      );
      throw new Error(e);
    }
  }
}
