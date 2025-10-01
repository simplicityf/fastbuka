import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserRole, Gender } from '@prisma/client';

// Mock bcrypt globally
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let mailService: MailService;

  const mockUser = {
    id: '1',
    email: 'test@example.com',
    password: 'hashedPassword',
    name: 'Test User',
    username: 'testuser',
    role: UserRole.CUSTOMER,
    gender: Gender.MALE,
    phone: '1234567890',
    location: 'Test City',
  };

  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('jwt-token'),
  };

  const mockMailService = {
    sendWelcomeEmail: jest.fn(),
  };

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    mailService = module.get<MailService>(MailService);

    jest.clearAllMocks();
  });

  describe('signUp', () => {
    it('should throw if user already exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.signUp({
          email: mockUser.email,
          password: 'password123',
          username: mockUser.username,
          role: UserRole.CUSTOMER,
          gender: Gender.MALE,
          phoneNumber: '+1234567890',
          name: 'Test',
          phone: '1234567890',
          location: 'Test City',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw if vendor fields are missing', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.signUp({
          email: 'vendor@example.com',
          password: 'password123',
          username: 'vendor',
          role: UserRole.VENDOR,
          gender: Gender.MALE,
          phoneNumber: '+1234567890',
          name: 'Vendor Test',
          phone: '1234567890',
          location: 'Vendor City',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create a user successfully', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

      const result = await service.signUp({
        email: 'new@example.com',
        password: 'password123',
        username: 'newuser',
        role: UserRole.CUSTOMER,
        gender: Gender.MALE,
        phoneNumber: '+1234567890',
        name: 'New User',
        phone: '1234567890',
        location: 'New City',
      });

      expect(result).toEqual(mockUser);
      expect(mailService.sendWelcomeEmail).toHaveBeenCalledWith(
        mockUser.email,
        mockUser.name,
        mockUser.role,
      );
    });

    it('should not fail if email sending throws', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      mockMailService.sendWelcomeEmail.mockRejectedValue(
        new Error('SMTP error'),
      );

      const result = await service.signUp({
        email: 'new@example.com',
        password: 'password123',
        username: 'newuser',
        role: UserRole.CUSTOMER,
        gender: Gender.MALE,
        phoneNumber: '+1234567890',
        name: 'New User',
        phone: '1234567890',
        location: 'New City',
      });

      expect(result).toEqual(mockUser);
      expect(mailService.sendWelcomeEmail).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should throw if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'wrong@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if password is invalid', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: mockUser.email, password: 'wrongpass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return token and user if login is successful', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: mockUser.email,
        password: 'password123',
      });

      expect(result).toEqual({
        access_token: 'jwt-token',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          role: mockUser.role,
        },
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        email: mockUser.email,
        sub: mockUser.id,
        role: mockUser.role,
      });
    });
  });
});
