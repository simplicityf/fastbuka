import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { SignUpDto, LoginDto } from './dto/auth.dto';
import { UserRole } from '@prisma/client';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  async signUp(signUpDto: SignUpDto) {
    const { password, email, username, role, ...rest } = signUpDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, ...(username ? [{ username }] : [])],
      },
    });

    if (existingUser) {
      throw new ConflictException(
        'User with this email or username already exists',
      );
    }

    // Validate vendor fields
    if (role === UserRole.VENDOR) {
      if (!rest.restaurantName || !rest.businessId) {
        throw new ConflictException(
          'Vendor must provide restaurant name and business ID',
        );
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        ...rest,
        email,
        username,
        role,
        password: hashedPassword,
      },
    });

    try {
      await this.mailService.sendWelcomeEmail(user.email, user.name, user.role);
    } catch (error) {
      // Log error but don't fail the signup process
      console.error('Failed to send welcome email:', error);
    }

    const { ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { email: user.email, sub: user.id, role: user.role };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}
