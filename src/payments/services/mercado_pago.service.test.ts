import { Test, TestingModule } from '@nestjs/testing';
import { MercadopagoService } from './mercado_pago.service';

import {
  CreatePreferenceOptions,
  MercadoPagoItem,
  MercadoPagoBackUrls,
} from '../interfaces/mercado-pago.interfaces';
import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

describe('MercadopagoService', () => {
  let service: MercadopagoService;
  const mockMercadoPagoClient = {
    preference: {
      create: jest.fn(),
      get: jest.fn(),
    },
    payment: {
      search: jest.fn(),
    },
    merchantOrder: {
      search: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MercadopagoService,
        {
          provide: 'MERCADOPAGO_CLIENT',
          useValue: mockMercadoPagoClient,
        },
        Logger,
      ],
    }).compile();

    service = module.get<MercadopagoService>(MercadopagoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPreference', () => {
    it('should create a preference successfully and return the ID', async () => {
      const mockPreferenceId = 'test-preference-id';
      (mockMercadoPagoClient.preference.create as jest.Mock).mockResolvedValue({
        id: mockPreferenceId,
      });

      const options: CreatePreferenceOptions = {
        items: [
          {
            title: 'Test Item',
            quantity: 1,
            unit_price: 100,
            currency_id: 'ARS',
          },
        ],
        external_reference: 'test-external-reference',
      };

      const preferenceId = await service.createPreference(options);
      expect(preferenceId).toBe(mockPreferenceId);
      expect(mockMercadoPagoClient.preference.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if options are invalid', async () => {
      const options: CreatePreferenceOptions = {
        items: [],
        external_reference: '',
      };

      await expect(service.createPreference(options)).rejects.toThrowError(
        BadRequestException,
      );
    });

    it('should handle MercadoPago errors and throw InternalServerErrorException', async () => {
      (mockMercadoPagoClient.preference.create as jest.Mock).mockRejectedValue(
        new Error('MercadoPago error'),
      );

      const options: CreatePreferenceOptions = {
        items: [
          {
            title: 'Test Item',
            quantity: 1,
            unit_price: 100,
            currency_id: 'ARS',
          },
        ],
        external_reference: 'test-external-reference',
      };

      await expect(service.createPreference(options)).rejects.toThrowError(
        InternalServerErrorException,
      );
    });

    it('should generate unique IDs for items without IDs', async () => {
      const mockPreferenceId = 'test-preference-id';
      (mockMercadoPagoClient.preference.create as jest.Mock).mockResolvedValue({
        id: mockPreferenceId,
      });

      const options: CreatePreferenceOptions = {
        items: [
          {
            title: 'Test Item',
            quantity: 1,
            unit_price: 100,
            currency_id: 'ARS',
          },
        ],
        external_reference: 'test-external-reference',
      };

      await service.createPreference(options);

      expect(
        (mockMercadoPagoClient.preference.create as jest.Mock).mock.calls[0][0]
          .body.items[0].id,
      ).toBeDefined();
    });

    it('should use default back URLs if custom URLs are not provided', async () => {
      process.env.MP_BACK_URL = 'http://test.com';
      process.env.MP_CHECKOUT_PATH = '/checkout';

      const mockPreferenceId = 'test-preference-id';
      (mockMercadoPagoClient.preference.create as jest.Mock).mockResolvedValue({
        id: mockPreferenceId,
      });

      const options: CreatePreferenceOptions = {
        items: [
          {
            title: 'Test Item',
            quantity: 1,
            unit_price: 100,
            currency_id: 'ARS',
          },
        ],
        external_reference: 'test-external-reference',
      };

      await service.createPreference(options);

      const expectedBackUrls: MercadoPagoBackUrls = {
        success: 'http://test.com/checkout?status=success',
        failure: 'http://test.com/checkout?status=failure',
        pending: 'http://test.com/checkout?status=pending',
      };

      expect(
        (mockMercadoPagoClient.preference.create as jest.Mock).mock.calls[0][0]
          .body.back_urls,
      ).toEqual(expectedBackUrls);

      delete process.env.MP_BACK_URL;
      delete process.env.MP_CHECKOUT_PATH;
    });
  });

  describe('createSimplePreference', () => {
    it('should call createPreference with correct options', async () => {
      const mockPreferenceId = 'test-preference-id';
      (mockMercadoPagoClient.preference.create as jest.Mock).mockResolvedValue({
        id: mockPreferenceId,
      });

      const externalId = 'test-external-id';
      const items: MercadoPagoItem[] = [
        {
          title: 'Test Item',
          quantity: 1,
          unit_price: 100,
          currency_id: 'ARS',
        },
      ];

      const preferenceId = await service.createSimplePreference(
        externalId,
        items,
      );

      expect(preferenceId).toBe(mockPreferenceId);
      expect(mockMercadoPagoClient.preference.create).toHaveBeenCalled();
    });
  });

  describe('searchPayments', () => {
    it('should search payments successfully and return the results', async () => {
      const mockSearchResults = [{ id: 'test-payment-id' }];
      (mockMercadoPagoClient.payment.search as jest.Mock).mockResolvedValue({
        results: mockSearchResults,
      });

      const searchOptions = { external_reference: 'test-external-reference' };
      const searchResults = await service.searchPayments(searchOptions);

      expect(searchResults).toEqual(mockSearchResults);
      expect(mockMercadoPagoClient.payment.search).toHaveBeenCalledWith({
        options: searchOptions,
      });
    });

    it('should throw BadRequestException if search options are empty', async () => {
      await expect(service.searchPayments({})).rejects.toThrowError(
        BadRequestException,
      );
    });

    it('should handle MercadoPago errors and throw InternalServerErrorException', async () => {
      (mockMercadoPagoClient.payment.search as jest.Mock).mockRejectedValue(
        new Error('MercadoPago error'),
      );

      const searchOptions = { external_reference: 'test-external-reference' };

      await expect(service.searchPayments(searchOptions)).rejects.toThrowError(
        InternalServerErrorException,
      );
    });
  });

  describe('getPaymentsByExternalReference', () => {
    it('should call searchPayments with the correct external reference', async () => {
      const mockSearchResults = [{ id: 'test-payment-id' }];
      (mockMercadoPagoClient.payment.search as jest.Mock).mockResolvedValue({
        results: mockSearchResults,
      });

      const externalReference = 'test-external-reference';
      const searchResults =
        await service.getPaymentsByExternalReference(externalReference);

      expect(searchResults).toEqual(mockSearchResults);
      expect(mockMercadoPagoClient.payment.search).toHaveBeenCalledWith({
        options: { external_reference: externalReference },
      });
    });

    it('should throw BadRequestException if external reference is empty', async () => {
      await expect(
        service.getPaymentsByExternalReference(''),
      ).rejects.toThrowError(BadRequestException);
    });
  });

  describe('searchMerchantOrders', () => {
    it('should search merchant orders successfully and return the results', async () => {
      const mockSearchResults = [{ id: 'test-merchant-order-id' }];
      (
        mockMercadoPagoClient.merchantOrder.search as jest.Mock
      ).mockResolvedValue({
        elements: mockSearchResults,
      });

      const searchOptions = { preference_id: 'test-preference-id' };
      const searchResults = await service.searchMerchantOrders(searchOptions);

      expect(searchResults).toEqual(mockSearchResults);
      expect(mockMercadoPagoClient.merchantOrder.search).toHaveBeenCalledWith({
        options: searchOptions,
      });
    });

    it('should throw BadRequestException if search options are empty', async () => {
      await expect(service.searchMerchantOrders({})).rejects.toThrowError(
        BadRequestException,
      );
    });

    it('should handle MercadoPago errors and throw InternalServerErrorException', async () => {
      (
        mockMercadoPagoClient.merchantOrder.search as jest.Mock
      ).mockRejectedValue(new Error('MercadoPago error'));

      const searchOptions = { preference_id: 'test-preference-id' };

      await expect(
        service.searchMerchantOrders(searchOptions),
      ).rejects.toThrowError(InternalServerErrorException);
    });
  });

  describe('getMerchantOrdersByPreferenceId', () => {
    it('should call searchMerchantOrders with the correct preference ID', async () => {
      const mockSearchResults = [{ id: 'test-merchant-order-id' }];
      (
        mockMercadoPagoClient.merchantOrder.search as jest.Mock
      ).mockResolvedValue({
        elements: mockSearchResults,
      });

      const preferenceId = 'test-preference-id';
      const searchResults =
        await service.getMerchantOrdersByPreferenceId(preferenceId);

      expect(searchResults).toEqual(mockSearchResults);
      expect(mockMercadoPagoClient.merchantOrder.search).toHaveBeenCalledWith({
        options: { preference_id: preferenceId },
      });
    });

    it('should throw BadRequestException if preference ID is empty', async () => {
      await expect(
        service.getMerchantOrdersByPreferenceId(''),
      ).rejects.toThrowError(BadRequestException);
    });
  });

  describe('getPreferenceById', () => {
    it('should get a preference by ID successfully', async () => {
      const mockPreference = { id: 'test-preference-id', items: [] };
      (mockMercadoPagoClient.preference.get as jest.Mock).mockResolvedValue(
        mockPreference,
      );

      const preferenceId = 'test-preference-id';
      const preference = await service.getPreferenceById(preferenceId);

      expect(preference).toEqual(mockPreference);
      expect(mockMercadoPagoClient.preference.get).toHaveBeenCalledWith({
        preferenceId: preferenceId,
      });
    });

    it('should throw BadRequestException if preference ID is empty', async () => {
      await expect(service.getPreferenceById('')).rejects.toThrowError(
        BadRequestException,
      );
    });

    it('should handle MercadoPago errors and throw InternalServerErrorException', async () => {
      (mockMercadoPagoClient.preference.get as jest.Mock).mockRejectedValue(
        new Error('MercadoPago error'),
      );

      const preferenceId = 'test-preference-id';

      await expect(
        service.getPreferenceById(preferenceId),
      ).rejects.toThrowError(InternalServerErrorException);
    });
  });
});
