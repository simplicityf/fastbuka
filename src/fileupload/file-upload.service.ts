import { Injectable, BadRequestException } from '@nestjs/common';
import {
  MulterOptionsFactory,
  MulterModuleOptions,
} from '@nestjs/platform-express';
import { diskStorage, FileFilterCallback } from 'multer';
import { extname } from 'path';
import { Request } from 'express';

@Injectable()
export class FileUploadService implements MulterOptionsFactory {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  }

  createMulterOptions(): MulterModuleOptions {
    return {
      storage: diskStorage({
        destination: './uploads/meals',
        filename: (
          req: Request,
          file: Express.Multer.File,
          callback: (err: Error | null, filename: string) => void,
        ) => {
          try {
            const uniqueSuffix =
              Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = extname(file.originalname);
            const filename = `meal-${uniqueSuffix}${ext}`;
            callback(null, filename);
          } catch (error) {
            callback(error as Error, '');
          }
        },
      }),
      fileFilter: (
        req: Request,
        file: Express.Multer.File,
        callback: FileFilterCallback,
      ) => {
        const allowedExt = /\.(jpg|jpeg|png|gif|webp)$/i;
        const isExtAllowed = allowedExt.test(file.originalname);
        const isMimeAllowed = /^image\/(jpe?g|png|gif|webp)$/i.test(
          file.mimetype,
        );

        if (!isExtAllowed || !isMimeAllowed) {
          return;
        }

        callback(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    };
  }

  getImageUrl(filename: string): string {
    return `${this.baseUrl}/uploads/meals/${filename}`;
  }

  validateFile(file: Express.Multer.File | undefined): void {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    if (!file.filename) {
      throw new BadRequestException(
        'File processing failed - no filename generated',
      );
    }
  }
}
