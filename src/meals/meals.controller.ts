import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { MealsService } from './meals.service';
import { CreateMealDto, UpdateMealDto } from './dto/create-meal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, MealCategory, MealStatus, User } from '@prisma/client';
import { AuthUser } from '../auth/decorators/auth-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileUploadService } from '../fileupload/file-upload.service';

@Controller('meals')
@UseGuards(JwtAuthGuard)
export class MealsController {
  constructor(
    private readonly mealsService: MealsService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  // Helpers to validate/parse multipart fields at runtime ---
  private parsePrice(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const n = parseFloat(value);
      if (!Number.isFinite(n))
        throw new BadRequestException('price must be a number');
      return n;
    }
    throw new BadRequestException(
      'price must be provided as a number or numeric string',
    );
  }

  private parseCategories(value: unknown): MealCategory[] {
    // Always return an array
    if (value === undefined || value === null) return [];

    let arr: string[] = [];

    if (Array.isArray(value)) {
      arr = value.map((v) => {
        if (v === null || v === undefined) {
          throw new BadRequestException(
            'Category values cannot be null or undefined',
          );
        }
        return String(v);
      });
    } else if (typeof value === 'string') {
      arr = value.includes(',')
        ? value.split(',').map((s) => s.trim())
        : [value.trim()];
    } else {
      throw new BadRequestException(
        'categories must be a string, CSV string or array of strings',
      );
    }

    const validValues = Object.values(MealCategory).map(String);
    const invalid = arr.filter((c) => !validValues.includes(c));
    if (invalid.length) {
      throw new BadRequestException(
        `Invalid categories: ${invalid.join(', ')}`,
      );
    }
    return arr as MealCategory[];
  }

  private parseStatus(value: unknown): MealStatus {
    if (value === undefined || value === null || value === '') {
      return MealStatus.IN_STOCK;
    }

    let stringValue: string;
    if (typeof value === 'string') {
      stringValue = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      stringValue = value.toString();
    } else {
      throw new BadRequestException(
        'status must be a string, number, or boolean',
      );
    }

    const validValues = Object.values(MealStatus).map(String);
    if (!validValues.includes(stringValue)) {
      throw new BadRequestException(`Invalid status: ${stringValue}`);
    }
    return stringValue as MealStatus;
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @AuthUser() user: Omit<User, 'password'>,
    @Body() body: Record<string, unknown>,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    try {
      // Validate and process the image first
      let imageUrl = '';
      if (image) {
        this.fileUploadService.validateFile(image);
        imageUrl = this.fileUploadService.getImageUrl(image.filename);
        console.log('Image URL generated:', imageUrl);
      }

      const name = body.name;
      const description = body.description;
      const priceRaw = body.price ?? body['price'];
      const statusRaw = body.status ?? body['status'];
      const categoriesRaw = body['categories[]'] ?? body['categories'];

      // Validation (keep your existing validation)
      if (typeof name !== 'string' || name.trim() === '') {
        throw new BadRequestException('name is required and must be a string');
      }

      if (typeof description !== 'string') {
        throw new BadRequestException(
          'description is required and must be a string',
        );
      }

      const price = this.parsePrice(priceRaw);
      const status = this.parseStatus(statusRaw);
      const categories = this.parseCategories(categoriesRaw);

      if (categories.length === 0) {
        throw new BadRequestException('At least one category is required');
      }

      const createMealDto: CreateMealDto = {
        name: name.trim(),
        description: description.trim(),
        price,
        status,
        categories,
        imageUrl,
      };

      console.log('Creating meal with data:', { ...createMealDto, imageUrl });

      return await this.mealsService.create(createMealDto, user.id);
    } catch (error: unknown) {
      console.error('Create meal error:', {
        error: error instanceof Error ? error.message : String(error),
        body,
        userId: user.id,
        image: image
          ? {
              filename: image.filename,
              originalname: image.originalname,
              size: image.size,
              mimetype: image.mimetype,
            }
          : 'No image',
      });
      throw error;
    }
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @AuthUser() user: Omit<User, 'password'>,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    const updateMealDto: UpdateMealDto = {};

    // Validate and process the image first
    if (image) {
      this.fileUploadService.validateFile(image);
      updateMealDto.imageUrl = this.fileUploadService.getImageUrl(
        image.filename,
      );
      console.log('Update - Image URL generated:', updateMealDto.imageUrl);
    }

    if (body.name !== undefined) {
      if (typeof body.name !== 'string')
        throw new BadRequestException('name must be a string');
      if (body.name.trim() === '')
        throw new BadRequestException('name cannot be empty');
      updateMealDto.name = body.name.trim();
    }

    if (body.description !== undefined) {
      if (typeof body.description !== 'string')
        throw new BadRequestException('description must be a string');
      updateMealDto.description = body.description.trim();
    }

    if (body.price !== undefined) {
      updateMealDto.price = this.parsePrice(body.price);
    }

    if (body.status !== undefined) {
      updateMealDto.status = this.parseStatus(body.status);
    }

    const categoriesRaw = body['categories[]'] ?? body['categories'];
    if (categoriesRaw !== undefined) {
      updateMealDto.categories = this.parseCategories(categoriesRaw) ?? [];
    }

    console.log('Updating meal with data:', { id, updateMealDto }); // Debug log

    return this.mealsService.update(id, updateMealDto, user.id, user.role);
  }

  @Get()
  findAll(
    @AuthUser() user: Omit<User, 'password'>,
    @Query('categories') categories?: string,
    @Query('vendorId') vendorId?: string,
    @Query('status') status?: string,
  ) {
    const categoryArray = categories
      ? (categories.split(',').map((s) => s.trim()) as MealCategory[])
      : undefined;

    const statusArray = status
      ? (status.split(',').map((s) => s.trim()) as MealStatus[])
      : undefined;

    return this.mealsService.findAll({
      categories: categoryArray,
      vendorId,
      status: statusArray,
    });
  }

  @Get('categories')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getCategories(@AuthUser() user: Omit<User, 'password'>) {
    return this.mealsService.getCategories();
  }

  @Get(':id')
  findOne(@AuthUser() user: Omit<User, 'password'>, @Param('id') id: string) {
    return this.mealsService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  remove(@AuthUser() user: Omit<User, 'password'>, @Param('id') id: string) {
    return this.mealsService.remove(id, user.id, user.role);
  }
}
