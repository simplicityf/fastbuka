import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { MailService } from '../mail/mail.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, MailService],
})
export class OrdersModule {}
