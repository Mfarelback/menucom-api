import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from '../services/orders.service';
import { AppDataService } from '../../app-data/services/app-data.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order.item.entity';
import { Menu } from '../../menu/entities/menu.entity';
import { Wardrobes } from '../../wardrobes/entities/wardrobes.entity';
import { PaymentsService } from '../../payments/services/payments.service';
import { UserService } from '../../user/user.service';
import { AppConfigService } from '../../app-data';

describe('OrdersService - Marketplace Fee Integration', () => {
  let service: OrdersService;

  const mockOrderRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockOrderItemRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockMenuRepository = {
    findOne: jest.fn(),
  };

  const mockWardrobesRepository = {
    findOne: jest.fn(),
  };

  const mockPaymentsService = {
    createPayment: jest.fn(),
  };

  const mockUserService = {};

  const mockAppConfigService = {};

  const mockAppDataService = {
    getMarketplaceFeePercentage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepository,
        },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: mockOrderItemRepository,
        },
        {
          provide: getRepositoryToken(Menu),
          useValue: mockMenuRepository,
        },
        {
          provide: getRepositoryToken(Wardrobes),
          useValue: mockWardrobesRepository,
        },
        {
          provide: PaymentsService,
          useValue: mockPaymentsService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: AppConfigService,
          useValue: mockAppConfigService,
        },
        {
          provide: AppDataService,
          useValue: mockAppDataService,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateOrderAmounts', () => {
    it('should calculate amounts with marketplace fee correctly', async () => {
      // Arrange
      const subtotal = 1000;
      const marketplaceFeePercentage = 5.5;
      mockAppDataService.getMarketplaceFeePercentage.mockResolvedValue(
        marketplaceFeePercentage,
      );

      // Act
      const result = await (service as any).calculateOrderAmounts(subtotal);

      // Assert
      expect(result).toEqual({
        subtotal: 1000,
        marketplaceFeePercentage: 5.5,
        marketplaceFeeAmount: 55, // 5.5% of 1000
        total: 1055,
      });
    });

    it('should handle zero marketplace fee', async () => {
      // Arrange
      const subtotal = 1000;
      mockAppDataService.getMarketplaceFeePercentage.mockResolvedValue(0);

      // Act
      const result = await (service as any).calculateOrderAmounts(subtotal);

      // Assert
      expect(result).toEqual({
        subtotal: 1000,
        marketplaceFeePercentage: 0,
        marketplaceFeeAmount: 0,
        total: 1000,
      });
    });

    it('should handle decimal subtotals correctly', async () => {
      // Arrange
      const subtotal = 123.45;
      const marketplaceFeePercentage = 2.5;
      mockAppDataService.getMarketplaceFeePercentage.mockResolvedValue(
        marketplaceFeePercentage,
      );

      // Act
      const result = await (service as any).calculateOrderAmounts(subtotal);

      // Assert
      expect(result).toEqual({
        subtotal: 123.45,
        marketplaceFeePercentage: 2.5,
        marketplaceFeeAmount: 3.08625, // 2.5% of 123.45
        total: 126.53625,
      });
    });

    it('should return default values when marketplace fee service fails', async () => {
      // Arrange
      const subtotal = 1000;
      mockAppDataService.getMarketplaceFeePercentage.mockRejectedValue(
        new Error('Service error'),
      );

      // Spy on console.error to verify error handling
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      const result = await (service as any).calculateOrderAmounts(subtotal);

      // Assert
      expect(result).toEqual({
        subtotal: 1000,
        marketplaceFeePercentage: 0,
        marketplaceFeeAmount: 0,
        total: 1000,
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error calculating order amounts:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('should handle high marketplace fee percentages', async () => {
      // Arrange
      const subtotal = 100;
      const marketplaceFeePercentage = 25; // 25%
      mockAppDataService.getMarketplaceFeePercentage.mockResolvedValue(
        marketplaceFeePercentage,
      );

      // Act
      const result = await (service as any).calculateOrderAmounts(subtotal);

      // Assert
      expect(result).toEqual({
        subtotal: 100,
        marketplaceFeePercentage: 25,
        marketplaceFeeAmount: 25, // 25% of 100
        total: 125,
      });
    });
  });

  // Test scenarios with different marketplace fee percentages
  describe('Marketplace Fee Scenarios', () => {
    const testScenarios = [
      {
        name: 'No commission',
        subtotal: 1000,
        feePercentage: 0,
        expectedFeeAmount: 0,
        expectedTotal: 1000,
      },
      {
        name: 'Low commission',
        subtotal: 1000,
        feePercentage: 2.5,
        expectedFeeAmount: 25,
        expectedTotal: 1025,
      },
      {
        name: 'Standard commission',
        subtotal: 1000,
        feePercentage: 5.5,
        expectedFeeAmount: 55,
        expectedTotal: 1055,
      },
      {
        name: 'High commission',
        subtotal: 1000,
        feePercentage: 15,
        expectedFeeAmount: 150,
        expectedTotal: 1150,
      },
      {
        name: 'Decimal subtotal with decimal commission',
        subtotal: 99.99,
        feePercentage: 3.75,
        expectedFeeAmount: 3.749625,
        expectedTotal: 103.739625,
      },
    ];

    testScenarios.forEach((scenario) => {
      it(`should calculate correctly for ${scenario.name}`, async () => {
        // Arrange
        mockAppDataService.getMarketplaceFeePercentage.mockResolvedValue(
          scenario.feePercentage,
        );

        // Act
        const result = await (service as any).calculateOrderAmounts(
          scenario.subtotal,
        );

        // Assert
        expect(result).toEqual({
          subtotal: scenario.subtotal,
          marketplaceFeePercentage: scenario.feePercentage,
          marketplaceFeeAmount: scenario.expectedFeeAmount,
          total: scenario.expectedTotal,
        });
      });
    });
  });
});
