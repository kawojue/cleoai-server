import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';
import {
  Injectable,
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { parse } from 'file-type-mime';
import { config } from 'configs/env.config';
import * as toStream from 'buffer-to-stream';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      ...config.cloudinary,
      secure: true,
    });
  }

  upload({
    file,
    folder,
    maxSize,
    public_id,
    mimeTypes,
  }: UploadOption): Promise<UploadApiResponse | UploadApiErrorResponse> {
    let size: number;

    if (Buffer.isBuffer(file)) {
      size = file.length;
    } else if (file && file.size) {
      size = file.size;
    } else {
      throw new BadRequestException('Invalid input type');
    }

    if (size > maxSize) {
      throw new PayloadTooLargeException(`File is too large`);
    }

    if (mimeTypes?.length) {
      let mimeType: string;

      if (Buffer.isBuffer(file)) {
        const type = parse(file);

        mimeType = type?.mime || '';
      } else if (file && file.originalname) {
        mimeType = file.mimetype;
      }

      if (!mimeTypes.includes(mimeType)) {
        throw new UnsupportedMediaTypeException('File is not allowed');
      }
    }

    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
          public_id:
            public_id || Buffer.isBuffer(file)
              ? randomUUID()
              : file.originalname.split('.')[0],
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      if (Buffer.isBuffer(file)) {
        toStream(file).pipe(upload);
      } else {
        toStream(file.buffer).pipe(upload);
      }
    });
  }

  elete(public_id: string) {
    return cloudinary.uploader.destroy(public_id);
  }
}
