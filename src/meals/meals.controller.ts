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
  Request,
} from '@nestjs/common';
import { MealsService } from './meals.service';
import { CreateMealDto, UpdateMealDto } from './dto/create-meal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, MealCategory, MealStatus, User } from '@prisma/client';
import { AuthUser } from '../auth/decorators/auth-user.decorator';

@Controller('meals')
@UseGuards(JwtAuthGuard)
export class MealsController {
  constructor(private readonly mealsService: MealsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  create(
    @AuthUser() user: Omit<User, 'password'>,
    @Body() createMealDto: CreateMealDto,
  ) {
    return this.mealsService.create(createMealDto, user.id);
  }

  @Get()
  findAll(
    @AuthUser() user: Omit<User, 'password'>,
    @Query('categories') categories?: string,
    @Query('vendorId') vendorId?: string,
    @Query('status') status?: string,
  ) {
    const categoryArray = categories
      ? (categories.split(',') as MealCategory[])
      : undefined;

    const statusArray = status
      ? (status.split(',') as MealStatus[])
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

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  update(
    @AuthUser() user: Omit<User, 'password'>,
    @Param('id') id: string,
    @Body() updateMealDto: UpdateMealDto,
  ) {
    return this.mealsService.update(id, updateMealDto, user.id, user.role);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  remove(@AuthUser() user: Omit<User, 'password'>, @Param('id') id: string) {
    return this.mealsService.remove(id, user.id, user.role);
  }
}
