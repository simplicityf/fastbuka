/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  UserRole,
  OrderStatus,
  MealStatus,
  MealCategory,
} from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

//  mock types for the dependencies
type MockPrismaService = DeepMockProxy<PrismaService>;
type MockMailService = DeepMockProxy<MailService>;

// Mock Data
const mockCustomer = {
  id: 'customer1',
  name: 'John Doe',
  email: 'john@example.com',
  phone: '1234567890',
  location: 'City A',
  role: UserRole.CUSTOMER,
  password: 'hashedpassword',
  createdAt: new Date(),
  updatedAt: new Date(),
  restaurantName: null,
};

const mockVendor = {
  id: 'vendor1',
  name: 'Jane Smith',
  email: 'jane@example.com',
  phone: '0987654321',
  location: 'City B',
  role: UserRole.VENDOR,
  password: 'hashedpassword',
  createdAt: new Date(),
  updatedAt: new Date(),
  restaurantName: 'The Great Eats',
};

const mockMeal = {
  id: 'meal1',
  name: 'Burger',
  description: 'Tasty beef burger',
  price: 10.0,
  status: MealStatus.IN_STOCK,
  vendorId: 'vendor1',
  imageUrl: 'url',
  categories: [MealCategory.LOCAL],
  createdAt: new Date(),
  updatedAt: new Date(),
  vendor: mockVendor,
};

const mockOrder = {
  id: 'order12345678',
  quantity: 2,
  totalPrice: 20.0,
  customerId: mockCustomer.id,
  vendorId: mockVendor.id,
  mealId: mockMeal.id,
  status: OrderStatus.ORDERED,
  createdAt: new Date(),
  updatedAt: new Date(),
  meal: mockMeal,
  customer: mockCustomer,
  vendor: mockVendor,
};

const createOrderDto = {
  mealId: mockMeal.id,
  quantity: 2,
};

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: MockPrismaService;
  let mailService: MockMailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaService>(),
        },
        {
          provide: MailService,
          useValue: mockDeep<MailService>(),
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prisma = module.get(PrismaService);
    mailService = module.get(MailService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should successfully create an order and send invoices', async () => {
      prisma.meal.findUnique.mockResolvedValueOnce(mockMeal);
      prisma.order.create.mockResolvedValueOnce(mockOrder);
      mailService.sendOrderInvoice.mockResolvedValue(true);

      const result = await service.create(createOrderDto, mockCustomer.id);

      expect(prisma.meal.findUnique).toHaveBeenCalledWith({
        where: { id: mockMeal.id },
        include: { vendor: true },
      });
      expect(prisma.order.create).toHaveBeenCalledWith({
        data: {
          quantity: createOrderDto.quantity,
          totalPrice: mockMeal.price * createOrderDto.quantity,
          customerId: mockCustomer.id,
          vendorId: mockVendor.id,
          mealId: mockMeal.id,
        },
        include: expect.any(Object),
      });
      expect(mailService.sendOrderInvoice).toHaveBeenCalledTimes(2);
      expect(mailService.sendOrderInvoice).toHaveBeenCalledWith(
        mockCustomer.email,
        mockOrder,
      );
      expect(mailService.sendOrderInvoice).toHaveBeenCalledWith(
        mockVendor.email,
        mockOrder,
      );
      expect(result).toEqual(mockOrder);
    });

    it('should throw NotFoundException if meal not found', async () => {
      prisma.meal.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.create(createOrderDto, mockCustomer.id),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(mailService.sendOrderInvoice).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if meal is out of stock', async () => {
      const outOfStockMeal = { ...mockMeal, status: MealStatus.OUT_OF_STOCK };
      prisma.meal.findUnique.mockResolvedValueOnce(outOfStockMeal);

      await expect(
        service.create(createOrderDto, mockCustomer.id),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(mailService.sendOrderInvoice).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all orders for a CUSTOMER', async () => {
      const mockOrdersList = [{ ...mockOrder }, { ...mockOrder, id: 'order2' }];
      prisma.order.findMany.mockResolvedValueOnce(mockOrdersList as any);

      const result = await service.findAll(mockCustomer.id, UserRole.CUSTOMER);

      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { customerId: mockCustomer.id },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockOrdersList);
    });

    it('should return all orders for a VENDOR', async () => {
      const mockOrdersList = [{ ...mockOrder }, { ...mockOrder, id: 'order2' }];
      prisma.order.findMany.mockResolvedValueOnce(mockOrdersList as any);

      const result = await service.findAll(mockVendor.id, UserRole.VENDOR);

      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { vendorId: mockVendor.id },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockOrdersList);
    });
  });

  describe('findOne', () => {
    it('should return an order if user is the customer', async () => {
      prisma.order.findUnique.mockResolvedValueOnce(mockOrder as any);

      const result = await service.findOne(
        mockOrder.id,
        mockCustomer.id,
        UserRole.CUSTOMER,
      );

      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: mockOrder.id },
        include: expect.any(Object),
      });
      expect(result).toEqual(mockOrder);
    });

    it('should return an order if user is the vendor', async () => {
      prisma.order.findUnique.mockResolvedValueOnce(mockOrder as any);

      const result = await service.findOne(
        mockOrder.id,
        mockVendor.id,
        UserRole.VENDOR,
      );

      expect(result).toEqual(mockOrder);
    });

    it('should throw NotFoundException if order not found', async () => {
      prisma.order.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.findOne(mockOrder.id, mockCustomer.id, UserRole.CUSTOMER),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not customer or vendor', async () => {
      const otherUserId = 'user-x';

      prisma.order.findUnique.mockResolvedValueOnce(mockOrder as any);

      await expect(
        service.findOne(mockOrder.id, otherUserId, UserRole.CUSTOMER),
      ).rejects.toThrow(ForbiddenException);

      prisma.order.findUnique.mockResolvedValueOnce(mockOrder as any);

      await expect(
        service.findOne(mockOrder.id, otherUserId, UserRole.VENDOR),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateStatus', () => {
    const updateDtoProcessing = { status: OrderStatus.PROCESSING };
    const updateDtoDelivered = { status: OrderStatus.DELIVERED };
    const mockOrderProcessing = {
      ...mockOrder,
      status: OrderStatus.PROCESSING,
    };

    it('should allow a VENDOR to update status to PROCESSING and send email', async () => {
      prisma.order.findUnique.mockResolvedValueOnce(mockOrder as any);
      prisma.order.update.mockResolvedValueOnce(mockOrderProcessing as any);
      mailService.sendOrderStatusUpdate.mockResolvedValue(true);

      const result = await service.updateStatus(
        mockOrder.id,
        updateDtoProcessing,
        mockVendor.id,
        UserRole.VENDOR,
      );

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: mockOrder.id },
        data: { status: OrderStatus.PROCESSING },
        include: expect.any(Object),
      });
      expect(mailService.sendOrderStatusUpdate).toHaveBeenCalledWith(
        mockCustomer.email,
        mockOrder,
        'Processing',
      );
      expect(mailService.sendDeliveryNotification).not.toHaveBeenCalled();
      expect(result).toEqual(mockOrderProcessing);
    });

    it('should allow a CUSTOMER to update status to DELIVERED and send emails', async () => {
      const mockOrderDelivered = {
        ...mockOrder,
        status: OrderStatus.DELIVERED,
      };
      prisma.order.findUnique.mockResolvedValueOnce(mockOrder as any);
      prisma.order.update.mockResolvedValueOnce(mockOrderDelivered as any);
      mailService.sendDeliveryNotification.mockResolvedValue(true);

      const result = await service.updateStatus(
        mockOrder.id,
        updateDtoDelivered,
        mockCustomer.id,
        UserRole.CUSTOMER,
      );

      expect(mailService.sendDeliveryNotification).toHaveBeenCalledTimes(2);
      expect(mailService.sendDeliveryNotification).toHaveBeenCalledWith(
        mockCustomer.email,
        mockOrder,
      );
      expect(mailService.sendDeliveryNotification).toHaveBeenCalledWith(
        mockVendor.email,
        mockOrder,
      );
      expect(result).toEqual(mockOrderDelivered);
    });

    it('should throw NotFoundException if order not found', async () => {
      prisma.order.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateStatus(
          'bad-id',
          updateDtoProcessing,
          mockVendor.id,
          UserRole.VENDOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if CUSTOMER tries to update to ORDERED', async () => {
      prisma.order.findUnique.mockResolvedValueOnce(mockOrder as any);
      const updateDtoPending = { status: OrderStatus.ORDERED };

      await expect(
        service.updateStatus(
          mockOrder.id,
          updateDtoPending,
          mockCustomer.id,
          UserRole.CUSTOMER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if VENDOR tries to update an order not belonging to them', async () => {
      const otherVendorId = 'vendor-x';
      prisma.order.findUnique.mockResolvedValueOnce(mockOrder as any);

      await expect(
        service.updateStatus(
          mockOrder.id,
          updateDtoProcessing,
          otherVendorId,
          UserRole.VENDOR,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
