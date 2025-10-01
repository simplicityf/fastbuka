import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMealDto, UpdateMealDto } from './dto/create-meal.dto';
import { Prisma, UserRole, MealCategory, MealStatus } from '@prisma/client';

type FindMealsFilters = {
  categories?: MealCategory[];
  vendorId?: string;
  status?: MealStatus[];
};

@Injectable()
export class MealsService {
  constructor(private prisma: PrismaService) {}

  async create(createMealDto: CreateMealDto, vendorId: string) {
    return this.prisma.meal.create({
      data: {
        ...createMealDto,
        vendorId,
      },
    });
  }

  async findAll(filters?: FindMealsFilters) {
    const where: Prisma.MealWhereInput = {};

    if (filters?.categories && filters.categories.length > 0) {
      where.categories = {
        hasSome: filters.categories,
      };
    }

    if (filters?.vendorId) {
      where.vendorId = filters.vendorId;
    }

    if (filters?.status && filters.status.length > 0) {
      where.status = {
        in: filters.status,
      };
    }

    return this.prisma.meal.findMany({
      where,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            restaurantName: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const meal = await this.prisma.meal.findUnique({
      where: { id },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            restaurantName: true,
            location: true,
          },
        },
      },
    });

    if (!meal) {
      throw new NotFoundException('Meal not found');
    }

    return meal;
  }

  async update(
    id: string,
    updateMealDto: UpdateMealDto,
    userId: string,
    userRole: UserRole,
  ) {
    const meal = await this.prisma.meal.findUnique({
      where: { id },
    });

    if (!meal) {
      throw new NotFoundException('Meal not found');
    }

    if (userRole !== UserRole.VENDOR || meal.vendorId !== userId) {
      throw new ForbiddenException('You can only update your own meals');
    }

    return this.prisma.meal.update({
      where: { id },
      data: updateMealDto,
    });
  }

  async remove(id: string, userId: string, userRole: UserRole) {
    const meal = await this.prisma.meal.findUnique({
      where: { id },
    });

    if (!meal) {
      throw new NotFoundException('Meal not found');
    }

    if (userRole !== UserRole.VENDOR || meal.vendorId !== userId) {
      throw new ForbiddenException('You can only delete your own meals');
    }

    return this.prisma.meal.delete({
      where: { id },
    });
  }

  getCategories() {
    return Object.values(MealCategory);
  }
}
