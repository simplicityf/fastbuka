import { Test, TestingModule } from '@nestjs/testing';
import { MealsService } from './meals.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { MealCategory, MealStatus, UserRole } from '@prisma/client';

// Define the structure of the mock Prisma client methods
type MockPrisma = {
  meal: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

describe('MealsService', () => {
  let service: MealsService;
  let prisma: MockPrisma;

  const mockMeal = {
    id: 'meal-1',
    name: 'Jollof Rice',
    description: 'Delicious Nigerian dish',
    price: 1200,
    imageUrl: 'http://example.com/image.jpg',
    status: MealStatus.IN_STOCK,
    categories: [MealCategory.NIGERIA_DISH],
    vendorId: 'vendor-1',
  };

  const mockVendor = {
    id: 'vendor-1',
    name: 'Vendor One',
    restaurantName: 'Tasty Foods',
  };

  const mockPrismaService = {
    meal: {
      create: jest.fn() as any,
      findMany: jest.fn() as any,
      findUnique: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
    },
  };

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MealsService>(MealsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a meal with vendorId', async () => {
      prisma.meal.create.mockResolvedValue(mockMeal);

      const result = await service.create(
        {
          name: mockMeal.name,
          description: mockMeal.description,
          price: mockMeal.price,
          imageUrl: mockMeal.imageUrl,
          categories: mockMeal.categories,
          status: mockMeal.status,
        },
        'vendor-1',
      );

      expect(prisma.meal.create).toHaveBeenCalledWith({
        data: {
          name: mockMeal.name,
          description: mockMeal.description,
          price: mockMeal.price,
          imageUrl: mockMeal.imageUrl,
          categories: mockMeal.categories,
          status: mockMeal.status,
          vendorId: 'vendor-1',
        },
      });
      expect(result).toEqual(mockMeal);
    });
  });

  describe('findAll', () => {
    it('should return meals without filters', async () => {
      prisma.meal.findMany.mockResolvedValue([mockMeal]);

      const result = await service.findAll();

      expect(prisma.meal.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          vendor: { select: { id: true, name: true, restaurantName: true } },
        },
      });
      expect(result).toEqual([mockMeal]);
    });

    it('should apply category and status filters', async () => {
      prisma.meal.findMany.mockResolvedValue([mockMeal]);

      const result = await service.findAll({
        categories: [MealCategory.NIGERIA_DISH],
        vendorId: 'vendor-1',
        status: [MealStatus.IN_STOCK],
      });

      expect(prisma.meal.findMany).toHaveBeenCalledWith({
        where: {
          categories: { hasSome: [MealCategory.NIGERIA_DISH] },
          vendorId: 'vendor-1',
          status: { in: [MealStatus.IN_STOCK] },
        },
        include: {
          vendor: { select: { id: true, name: true, restaurantName: true } },
        },
      });
      expect(result).toEqual([mockMeal]);
    });
  });

  describe('findOne', () => {
    it('should return a meal with vendor details', async () => {
      prisma.meal.findUnique.mockResolvedValue({
        ...mockMeal,
        vendor: mockVendor,
      });

      const result = await service.findOne('meal-1');

      expect(prisma.meal.findUnique).toHaveBeenCalledWith({
        where: { id: 'meal-1' },
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
      expect(result).toEqual({ ...mockMeal, vendor: mockVendor });
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.meal.findUnique.mockResolvedValue(null);

      await expect(service.findOne('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update meal if vendor owns it', async () => {
      prisma.meal.findUnique.mockResolvedValue(mockMeal);
      prisma.meal.update.mockResolvedValue({ ...mockMeal, name: 'Updated' });

      const result = await service.update(
        'meal-1',
        { name: 'Updated' },
        'vendor-1',
        UserRole.VENDOR,
      );

      expect(prisma.meal.update).toHaveBeenCalledWith({
        where: { id: 'meal-1' },
        data: { name: 'Updated' },
      });
      expect(result.name).toBe('Updated');
    });

    it('should throw NotFoundException if meal not found', async () => {
      prisma.meal.findUnique.mockResolvedValue(null);

      await expect(
        service.update('bad-id', { name: 'Test' }, 'vendor-1', UserRole.VENDOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user not vendor or not owner', async () => {
      prisma.meal.findUnique.mockResolvedValue(mockMeal);

      await expect(
        service.update(
          'meal-1',
          { name: 'Test' },
          'wrong-vendor',
          UserRole.VENDOR,
        ),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.update(
          'meal-1',
          { name: 'Test' },
          'vendor-1',
          UserRole.CUSTOMER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should delete meal if vendor owns it', async () => {
      prisma.meal.findUnique.mockResolvedValue(mockMeal);
      prisma.meal.delete.mockResolvedValue(mockMeal);

      const result = await service.remove(
        'meal-1',
        'vendor-1',
        UserRole.VENDOR,
      );

      expect(prisma.meal.delete).toHaveBeenCalledWith({
        where: { id: 'meal-1' },
      });
      expect(result).toEqual(mockMeal);
    });

    it('should throw NotFoundException if meal not found', async () => {
      prisma.meal.findUnique.mockResolvedValue(null);

      await expect(
        service.remove('bad-id', 'vendor-1', UserRole.VENDOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not vendor or not owner', async () => {
      prisma.meal.findUnique.mockResolvedValue(mockMeal);

      await expect(
        service.remove('meal-1', 'wrong-vendor', UserRole.VENDOR),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.remove('meal-1', 'vendor-1', UserRole.CUSTOMER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getCategories', () => {
    it('should return all MealCategory values', () => {
      const result = service.getCategories();
      expect(result).toEqual(Object.values(MealCategory));
    });
  });
});
