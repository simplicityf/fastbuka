import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole } from '@prisma/client';
import { AuthUser } from '../auth/decorators/auth-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  create(
    @AuthUser() user: Omit<User, 'password'>,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.ordersService.create(createOrderDto, user.id);
  }

  @Get()
  findAll(@AuthUser() user: Omit<User, 'password'>) {
    return this.ordersService.findAll(user.id, user.role);
  }

  @Get(':id')
  findOne(@AuthUser() user: Omit<User, 'password'>, @Param('id') id: string) {
    return this.ordersService.findOne(id, user.id, user.role);
  }

  @Patch(':id/status')
  updateStatus(
    @AuthUser() user: Omit<User, 'password'>,
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(
      id,
      updateOrderStatusDto,
      user.id,
      user.role,
    );
  }
}
