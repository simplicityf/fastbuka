import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Order, User, Meal } from '@prisma/client';

interface OrderWithRelations extends Order {
  meal: Meal;
  customer: User;
  vendor: User;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const mailUser = this.configService.get<string>('MAIL_USER');
    const mailPassword = this.configService.get<string>('MAIL_PASSWORD');

    if (!mailUser || !mailPassword) {
      this.logger.warn(
        'Mail credentials not found. Email service will not work properly.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: mailUser,
        pass: mailPassword,
      },
    });

    // Verify transporter configuration
    this.transporter.verify((error) => {
      if (error) {
        this.logger.error('Error with email transporter configuration:', error);
      } else {
        this.logger.log('Email transporter is ready to send messages');
      }
    });
  }

  private async sendEmail(to: string, subject: string, html: string) {
    if (!this.transporter) {
      this.logger.warn(
        'Email transporter not initialized. Skipping email send.',
      );
      return false;
    }

    try {
      const mailOptions = {
        from: {
          name:
            this.configService.get<string>('APP_NAME') || 'Food Delivery App',
          address: this.configService.get<string>('GMAIL_EMAIL')!,
        },
        to,
        subject,
        html,
      };

      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Email sent successfully to ${to}. Message ID: ${result.messageId}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw new InternalServerErrorException('Failed to send email');
    }
  }

  async sendOrderInvoice(to: string, order: OrderWithRelations) {
    const subject = `Order Invoice #${order.id.slice(-8).toUpperCase()}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .order-details { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #4CAF50; }
          .total { font-size: 1.2em; font-weight: bold; color: #4CAF50; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Confirmation</h1>
            <p>Thank you for your order!</p>
          </div>
          <div class="content">
            <h2>Order Details</h2>
            <div class="order-details">
              <p><strong>Order ID:</strong> ${order.id.slice(-8).toUpperCase()}</p>
              <p><strong>Date:</strong> ${order.createdAt.toLocaleDateString()}</p>
              <p><strong>Meal:</strong> ${order.meal.name}</p>
              <p><strong>Quantity:</strong> ${order.quantity}</p>
              <p><strong>Unit Price:</strong> $${order.meal.price.toFixed(2)}</p>
              <p class="total">Total Amount: $${order.totalPrice.toFixed(2)}</p>
            </div>
            
            <h3>Vendor Information</h3>
            <div class="order-details">
              <p><strong>Restaurant:</strong> ${order.vendor.restaurantName}</p>
              <p><strong>Location:</strong> ${order.vendor.location}</p>
              <p><strong>Phone:</strong> ${order.vendor.phone}</p>
            </div>
            
            <p>We'll notify you when your order status updates.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Food Delivery App. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(to, subject, html);
  }

  async sendOrderStatusUpdate(
    to: string,
    order: OrderWithRelations,
    status: string,
  ) {
    const subject = `Order Update - #${order.id.slice(-8).toUpperCase()}`;

    let statusMessage = '';
    let statusColor = '#2196F3';

    switch (status) {
      case 'PROCESSING':
        statusMessage =
          'Your food is being prepared and will be on its way soon!';
        statusColor = '#FF9800';
        break;
      case 'DELIVERED':
        statusMessage = 'Your order has been delivered! Enjoy your meal!';
        statusColor = '#4CAF50';
        break;
      default:
        statusMessage = `Your order status has been updated to: ${status}`;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${statusColor}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .status-info { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid ${statusColor}; }
          .order-summary { background: #e8f5e8; padding: 15px; border-radius: 5px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Status Updated</h1>
            <p>Your order status has changed to: <strong>${status}</strong></p>
          </div>
          <div class="content">
            <div class="status-info">
              <h3>Status Update</h3>
              <p>${statusMessage}</p>
            </div>
            
            <div class="order-summary">
              <h3>Order Summary</h3>
              <p><strong>Order ID:</strong> ${order.id.slice(-8).toUpperCase()}</p>
              <p><strong>Meal:</strong> ${order.meal.name}</p>
              <p><strong>Quantity:</strong> ${order.quantity}</p>
              <p><strong>Restaurant:</strong> ${order.vendor.restaurantName}</p>
            </div>
            
            <p>If you have any questions about your order, please contact the restaurant directly.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Food Delivery App. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(to, subject, html);
  }

  async sendDeliveryNotification(to: string, order: OrderWithRelations) {
    const subject = `Order Delivered - #${order.id.slice(-8).toUpperCase()}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .delivery-info { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #4CAF50; }
          .rating-reminder { background: #fff3cd; padding: 15px; border-radius: 5px; border: 1px solid #ffeaa7; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Delivered Successfully!</h1>
            <p>Your food has been delivered. Enjoy your meal!</p>
          </div>
          <div class="content">
            <div class="delivery-info">
              <h3>Delivery Confirmation</h3>
              <p>Your order has been successfully delivered to your specified location.</p>
              <p><strong>Order ID:</strong> ${order.id.slice(-8).toUpperCase()}</p>
              <p><strong>Delivered On:</strong> ${new Date().toLocaleDateString()}</p>
              <p><strong>Meal:</strong> ${order.meal.name}</p>
              <p><strong>Restaurant:</strong> ${order.vendor.restaurantName}</p>
            </div>
            
            <div class="rating-reminder">
              <h3>How was your experience?</h3>
              <p>We'd love to hear about your dining experience. Consider leaving a review for the restaurant!</p>
            </div>
            
            <p>Thank you for choosing our service!</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Food Delivery App. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(to, subject, html);
  }

  async sendWelcomeEmail(to: string, userName: string, role: string) {
    const subject = `Welcome to FaskBuka App!`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .welcome-info { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to FaskBuka App!</h1>
          </div>
          <div class="content">
            <div class="welcome-info">
              <h3>Hello ${userName}!</h3>
              <p>Welcome to our food delivery platform! Your account has been successfully created as a <strong>${role.toLowerCase()}</strong>.</p>
              
              ${
                role === 'VENDOR'
                  ? '<p>You can now start adding your delicious meals to our platform and reach more customers!</p>'
                  : '<p>You can now browse through our wide selection of meals and place orders from your favorite restaurants!</p>'
              }
              
              <p>We're excited to have you on board!</p>
            </div>
            
            <p>If you have any questions, feel free to contact our support team.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Food Delivery App. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(to, subject, html);
  }
}
