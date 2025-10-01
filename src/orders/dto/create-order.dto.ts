import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsPositive,
  IsEnum,
} from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  mealId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
