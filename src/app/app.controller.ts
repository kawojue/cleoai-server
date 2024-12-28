import {
  Res,
  Get,
  Post,
  Controller,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { randomUUID } from 'crypto';
import { AppService } from './app.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(
    @Res() res: Response,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const data = await this.cloudinary.upload({
      file,
      folder: 'CleoAI',
      maxSize: 512,
      public_id: randomUUID(),
      mimeTypes: ['image/png', 'image/jpeg', 'image/jpg'],
    });

    res.status(HttpStatus.OK).json({ url: data.secure_url });
  }
}
