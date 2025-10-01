import { Module } from '@nestjs/common';
import { MealsController } from './meals.controller';
import { MealsService } from './meals.service';
import { FileUploadService } from '../fileupload/file-upload.service';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [
    MulterModule.registerAsync({
      useClass: FileUploadService,
    }),
  ],
  controllers: [MealsController],
  providers: [MealsService, FileUploadService],
})
export class MealsModule {}
