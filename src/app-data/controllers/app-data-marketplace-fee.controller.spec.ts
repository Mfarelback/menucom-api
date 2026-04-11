import { Test, TestingModule } from '@nestjs/testing';
import { AppDataController } from '../controllers/app-data.controller';
import { AppDataService } from '../services/app-data.service';
import { SetMarketplaceFeeDto } from '../dtos/marketplace-fee.dto';
import { AppData } from '../entities/app-data.entity';
import { NotFoundException } from '@nestjs/common';

describe('AppDataController - Marketplace Fee', () => {
  let controller: AppDataController;

  const mockAppDataService = {
    getValueByKey: jest.fn(),
    findByKey: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppDataController],
      providers: [
        {
          provide: AppDataService,
          useValue: mockAppDataService,
        },
      ],
    }).compile();

    controller = module.get<AppDataController>(AppDataController);
    controller = module.get<AppDataController>(AppDataController);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMarketplaceFee', () => {
    it('should return marketplace fee percentage when it exists', async () => {
      // Arrange
      const expectedPercentage = 5.5;
      mockAppDataService.getValueByKey.mockResolvedValue(expectedPercentage);

      // Act
      const result = await controller.getMarketplaceFee();

      // Assert
      expect(result).toEqual({ percentage: expectedPercentage });
      expect(mockAppDataService.getValueByKey).toHaveBeenCalledWith(
        'marketplace_fee_percentage',
      );
    });

    it('should return 0 when marketplace fee is not configured', async () => {
      // Arrange
      mockAppDataService.getValueByKey.mockRejectedValue(
        new NotFoundException('Not found'),
      );

      // Act
      const result = await controller.getMarketplaceFee();

      // Assert
      expect(result).toEqual({ percentage: 0 });
    });

    it('should return 0 when marketplace fee value is null', async () => {
      // Arrange
      mockAppDataService.getValueByKey.mockResolvedValue(null);

      // Act
      const result = await controller.getMarketplaceFee();

      // Assert
      expect(result).toEqual({ percentage: 0 });
    });
  });

  describe('setMarketplaceFee', () => {
    it('should update existing marketplace fee configuration', async () => {
      // Arrange
      const setMarketplaceFeeDto: SetMarketplaceFeeDto = { percentage: 7.5 };
      const existingData = {
        id: 'existing-id',
        key: 'marketplace_fee_percentage',
        value: '5.0',
      } as AppData;
      const updatedData = {
        ...existingData,
        value: '7.5',
      } as AppData;

      mockAppDataService.findByKey.mockResolvedValue(existingData);
      mockAppDataService.update.mockResolvedValue(updatedData);

      // Act
      const result = await controller.setMarketplaceFee(setMarketplaceFeeDto);

      // Assert
      expect(result).toEqual(updatedData);
      expect(mockAppDataService.findByKey).toHaveBeenCalledWith(
        'marketplace_fee_percentage',
      );
      expect(mockAppDataService.update).toHaveBeenCalledWith('existing-id', {
        value: '7.5',
      });
    });

    it('should create new marketplace fee configuration when it does not exist', async () => {
      // Arrange
      const setMarketplaceFeeDto: SetMarketplaceFeeDto = { percentage: 10.0 };
      const newData = {
        id: 'new-id',
        key: 'marketplace_fee_percentage',
        value: '10.0',
        dataType: 'number',
        description: 'Porcentaje de comisión del marketplace por transacción',
        isActive: true,
      } as AppData;

      mockAppDataService.findByKey.mockRejectedValue(
        new NotFoundException('Not found'),
      );
      mockAppDataService.create.mockResolvedValue(newData);

      // Act
      const result = await controller.setMarketplaceFee(setMarketplaceFeeDto);

      // Assert
      expect(result).toEqual(newData);
      expect(mockAppDataService.create).toHaveBeenCalledWith({
        key: 'marketplace_fee_percentage',
        value: '10.0',
        dataType: 'number',
        description: 'Porcentaje de comisión del marketplace por transacción',
        isActive: true,
      });
    });

    it('should handle zero percentage correctly', async () => {
      // Arrange
      const setMarketplaceFeeDto: SetMarketplaceFeeDto = { percentage: 0 };
      const newData = {
        id: 'new-id',
        key: 'marketplace_fee_percentage',
        value: '0',
        dataType: 'number',
        description: 'Porcentaje de comisión del marketplace por transacción',
        isActive: true,
      } as AppData;

      mockAppDataService.findByKey.mockRejectedValue(
        new NotFoundException('Not found'),
      );
      mockAppDataService.create.mockResolvedValue(newData);

      // Act
      const result = await controller.setMarketplaceFee(setMarketplaceFeeDto);

      // Assert
      expect(result).toEqual(newData);
      expect(mockAppDataService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          value: '0',
        }),
      );
    });

    it('should handle decimal percentages correctly', async () => {
      // Arrange
      const newData = {
        id: 'new-id',
        key: 'marketplace_fee_percentage',
        value: '2.75',
      } as AppData;

      mockAppDataService.findByKey.mockRejectedValue(
        new NotFoundException('Not found'),
      );
      mockAppDataService.create.mockResolvedValue(newData);

      // Act

      // Assert
      expect(mockAppDataService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          value: '2.75',
        }),
      );
    });
  });
});
