import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';
import { UserRole, OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async create(createOrderDto: CreateOrderDto, customerId: string) {
    const { mealId, quantity } = createOrderDto;

    // Check if meal exists and is in stock
    const meal = await this.prisma.meal.findUnique({
      where: { id: mealId },
      include: { vendor: true },
    });

    if (!meal) {
      throw new NotFoundException('Meal not found');
    }

    if (meal.status !== 'IN_STOCK') {
      throw new BadRequestException('Meal is out of stock');
    }

    // Calculate total price
    const totalPrice = meal.price * quantity;

    // Create order
    const order = await this.prisma.order.create({
      data: {
        quantity,
        totalPrice,
        customerId,
        vendorId: meal.vendorId,
        mealId,
      },
      include: {
        meal: true,
        customer: true,
        vendor: true,
      },
    });

    // Send invoice emails
    await this.mailService.sendOrderInvoice(order.customer.email, order);
    await this.mailService.sendOrderInvoice(order.vendor.email, order);

    return order;
  }

  async findAll(userId: string, userRole: UserRole) {
    const where =
      userRole === UserRole.CUSTOMER
        ? { customerId: userId }
        : { vendorId: userId };

    return this.prisma.order.findMany({
      where,
      include: {
        meal: {
          select: {
            id: true,
            name: true,
            price: true,
            imageUrl: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            location: true,
          },
        },
        vendor: {
          select: {
            id: true,
            name: true,
            restaurantName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string, userId: string, userRole: UserRole) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        meal: true,
        customer: true,
        vendor: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (userRole === UserRole.CUSTOMER) {
      if (order.customerId !== userId) {
        throw new ForbiddenException('Access denied to this order');
      }
    } else if (userRole === UserRole.VENDOR) {
      if (order.vendorId !== userId) {
        throw new ForbiddenException('Access denied to this order');
      }
    } else {
      throw new ForbiddenException('Invalid role for accessing orders');
    }

    return order;
  }

  async updateStatus(
    id: string,
    updateOrderStatusDto: UpdateOrderStatusDto,
    userId: string,
    userRole: UserRole,
  ) {
    const { status } = updateOrderStatusDto;

    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        vendor: true,
        meal: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check permissions
    if (userRole === UserRole.CUSTOMER && status !== OrderStatus.DELIVERED) {
      throw new ForbiddenException(
        'Customers can only mark orders as delivered',
      );
    }

    if (userRole === UserRole.VENDOR && order.vendorId !== userId) {
      throw new ForbiddenException('You can only update orders for your meals');
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: { status },
      include: {
        customer: true,
        vendor: true,
        meal: true,
      },
    });

    // Send email notifications based on status change
    if (status === OrderStatus.PROCESSING) {
      await this.mailService.sendOrderStatusUpdate(
        order.customer.email,
        order,
        'Processing',
      );
    } else if (status === OrderStatus.DELIVERED) {
      await this.mailService.sendDeliveryNotification(
        order.customer.email,
        order,
      );
      await this.mailService.sendDeliveryNotification(
        order.vendor.email,
        order,
      );
    }

    return updatedOrder;
  }
}
