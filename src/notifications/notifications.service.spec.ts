import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { FirebaseAdminService } from '../auth/firebase-admin.service';
import { NotificationTemplate } from './entities/notification-template.entity';
import { User } from '../user/entities/user.entity';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { SendFromTemplateDto } from './dto/send-from-template.dto';
import { SendAdminNotificationDto } from './dto/send-admin-notification.dto';

describe('NotificationsService — Admin Templates', () => {
  let service: NotificationsService;
  let firebaseAdmin: jest.Mocked<FirebaseAdminService>;

  const mockTemplateRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockFirebaseAdmin = {
    isInitialized: jest.fn().mockReturnValue(true),
    messaging: {
      send: jest.fn(),
      sendEachForMulticast: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        {
          provide: getRepositoryToken(NotificationTemplate),
          useValue: mockTemplateRepo,
        },
        { provide: FirebaseAdminService, useValue: mockFirebaseAdmin },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    firebaseAdmin = module.get(FirebaseAdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------- extractPlaceholders ----------
  describe('extractPlaceholders', () => {
    it('1: extrae placeholders de los 3 campos', () => {
      const result = service.extractPlaceholders(
        'Hola {{name}}',
        '{{amount}} pagado',
        '/{{slug}}',
      );
      expect(result).toEqual(['amount', 'name', 'slug']);
    });

    it('2: retorna array vacío sin placeholders', () => {
      expect(service.extractPlaceholders('Sin variables', 'Nada', '')).toEqual(
        [],
      );
    });

    it('3: deduplica placeholders repetidos', () => {
      const result = service.extractPlaceholders(
        '{{x}}',
        '{{x}} {{y}} {{x}}',
        null,
      );
      expect(result).toEqual(['x', 'y']);
    });

    it('4: ignora llaves no balanceadas (sin cierre }})', () => {
      const result = service.extractPlaceholders(
        'sin {{placeholders {{rotos',
        '',
        null,
      );
      expect(result).toEqual([]);
    });

    it('5: placeholder con guion bajo y números', () => {
      const result = service.extractPlaceholders(
        '{{user_id}} {{order_2}}',
        '',
        null,
      );
      expect(result).toEqual(['order_2', 'user_id']);
    });

    it('6: deepLink es null', () => {
      const result = service.extractPlaceholders('{{a}}', '', null);
      expect(result).toEqual(['a']);
    });

    it('7: deepLink es string vacía', () => {
      const result = service.extractPlaceholders('{{a}}', '', '');
      expect(result).toEqual(['a']);
    });
  });

  // ---------- resolvePlaceholders ----------
  describe('resolvePlaceholders', () => {
    it('1: resuelve todos los placeholders', () => {
      const r = service.resolvePlaceholders('{{a}} y {{b}}', {
        a: '1',
        b: '2',
      });
      expect(r.resolved).toBe('1 y 2');
      expect(r.unresolved).toEqual([]);
    });

    it('2: deja placeholder si falta param', () => {
      const r = service.resolvePlaceholders('Hola {{name}}', {});
      expect(r.resolved).toBe('Hola {{name}}');
      expect(r.unresolved).toEqual(['name']);
    });

    it('3: resuelve parcialmente', () => {
      const r = service.resolvePlaceholders('{{a}} {{b}} {{c}}', {
        a: '1',
        c: '3',
      });
      expect(r.resolved).toBe('1 {{b}} 3');
      expect(r.unresolved).toEqual(['b']);
    });

    it('4: texto sin placeholders queda igual', () => {
      const r = service.resolvePlaceholders('Sin cambios', { x: '1' });
      expect(r.resolved).toBe('Sin cambios');
      expect(r.unresolved).toEqual([]);
    });

    it('5: sanitiza valores con comillas dobles', () => {
      const r = service.resolvePlaceholders('{{msg}}', { msg: 'Hola "mundo"' });
      expect(r.resolved).toBe('Hola \\"mundo\\"');
      expect(r.unresolved).toEqual([]);
    });

    it('6: placeholder repetido se reemplaza en todas partes', () => {
      const r = service.resolvePlaceholders('{{x}} y {{x}}', { x: 'OK' });
      expect(r.resolved).toBe('OK y OK');
    });

    it('7: trunca valor > 1000 chars', () => {
      const long = 'a'.repeat(5000);
      const r = service.resolvePlaceholders('{{long}}', { long });
      expect(r.resolved.length).toBe(1000);
      expect(r.unresolved).toEqual([]);
    });

    it('8: valor undefined se trata como faltante', () => {
      const r = service.resolvePlaceholders('{{x}}', { x: undefined as any });
      expect(r.resolved).toBe('{{x}}');
      expect(r.unresolved).toEqual(['x']);
    });

    it('9: valor null se trata como faltante', () => {
      const r = service.resolvePlaceholders('{{x}}', { x: null as any });
      expect(r.resolved).toBe('{{x}}');
      expect(r.unresolved).toEqual(['x']);
    });
  });

  // ---------- createTemplate ----------
  describe('createTemplate', () => {
    const dto: CreateNotificationTemplateDto = {
      name: 'welcome',
      title: '¡Hola!',
      body: 'Bienvenido',
    };

    it('1: crea template exitosamente cuando name no existe', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);
      const created = { ...dto, isActive: true };
      mockTemplateRepo.create.mockReturnValue(created);
      mockTemplateRepo.save.mockResolvedValue(created);

      const result = await service.createTemplate(dto);
      expect(mockTemplateRepo.findOne).toHaveBeenCalledWith({
        where: { name: 'welcome' },
      });
      expect(mockTemplateRepo.save).toHaveBeenCalled();
      expect(result).toMatchObject({ name: 'welcome', isActive: true });
    });

    it('2: lanza ConflictException si name ya existe', async () => {
      mockTemplateRepo.findOne.mockResolvedValue({ id: 'exists' } as any);
      await expect(service.createTemplate(dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('3: crea template con solo campos requeridos (opcionales null)', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);
      const created = { ...dto, data: null, deepLink: null, imageUrl: null };
      mockTemplateRepo.create.mockReturnValue(created);
      mockTemplateRepo.save.mockResolvedValue(created);
      const result = (await service.createTemplate(dto)) as any;
      expect(result.data).toBeNull();
      expect(result.deepLink).toBeNull();
      expect(result.imageUrl).toBeNull();
    });

    it('4: crea template con isActive: true por defecto', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);
      mockTemplateRepo.create.mockReturnValue({ ...dto, isActive: true });
      mockTemplateRepo.save.mockResolvedValue({ ...dto, isActive: true });
      const result = await service.createTemplate(dto);
      expect(result.isActive).toBe(true);
    });

    it('5: rechaza data con claves sensibles', async () => {
      await expect(
        service.createTemplate({ ...dto, data: { password: 'x' } } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('6: propaga errores de BD', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);
      mockTemplateRepo.create.mockReturnValue({ ...dto });
      mockTemplateRepo.save.mockRejectedValue(new Error('DB down'));
      await expect(service.createTemplate(dto)).rejects.toThrow('DB down');
    });
  });

  // ---------- listTemplates ----------
  describe('listTemplates', () => {
    const buildQbMock = (data: any[], total: number) => {
      const qb: any = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([data, total]),
      };
      mockTemplateRepo.createQueryBuilder.mockReturnValue(qb);
      return qb;
    };

    it('1: retorna templates paginados (skip/take correctos)', async () => {
      const qb = buildQbMock(
        [{ id: 't1', title: 'a', body: 'b', deepLink: null }],
        1,
      );
      const res = await service.listTemplates({ page: 1, limit: 10 });
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(res.meta.total).toBe(1);
    });

    it('2: filtra por isActive: true', async () => {
      const qb = buildQbMock([], 0);
      await service.listTemplates({ page: 1, limit: 10, isActive: true });
      expect(qb.andWhere).toHaveBeenCalledWith('t.isActive = :isActive', {
        isActive: true,
      });
    });

    it('3: filtra por search (ILIKE sobre name, title, body)', async () => {
      const qb = buildQbMock([], 0);
      await service.listTemplates({ page: 1, limit: 10, search: 'promo' });
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(t.name ILIKE :s OR t.title ILIKE :s OR t.body ILIKE :s)',
        { s: '%promo%' },
      );
    });

    it('4: ordena por sortBy y sortOrder', async () => {
      const qb = buildQbMock([], 0);
      await service.listTemplates({
        page: 1,
        limit: 10,
        sortBy: 'name',
        sortOrder: 'ASC',
      });
      expect(qb.orderBy).toHaveBeenCalledWith('t.name', 'ASC');
    });

    it('5: usa default updatedAt/DESC cuando sortBy inválido', async () => {
      const qb = buildQbMock([], 0);
      await service.listTemplates({ page: 1, limit: 10, sortBy: undefined });
      expect(qb.orderBy).toHaveBeenCalledWith('t.updatedAt', 'DESC');
    });

    it('6: retorna lista vacía si no hay templates', async () => {
      buildQbMock([], 0);
      const res = await service.listTemplates({ page: 1, limit: 10 });
      expect(res.data).toEqual([]);
      expect(res.meta.total).toBe(0);
    });

    it('7: calcula placeholderCount en cada template', async () => {
      buildQbMock([{ id: 't1', title: '{{x}}', body: '', deepLink: null }], 1);
      const res = await service.listTemplates({ page: 1, limit: 10 });
      expect((res.data[0] as any).placeholderCount).toBe(1);
    });

    it('8: calcula totalPages correctamente', async () => {
      buildQbMock([], 25);
      const res = await service.listTemplates({ page: 1, limit: 10 });
      expect(res.meta.totalPages).toBe(3);
    });
  });

  // ---------- getTemplate ----------
  describe('getTemplate', () => {
    it('1: retorna template por ID', async () => {
      const t = { id: 'abc', name: 'x' } as any;
      mockTemplateRepo.findOne.mockResolvedValue(t);
      const res = await service.getTemplate('abc');
      expect(res).toBe(t);
    });

    it('2: lanza NotFoundException si no existe', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);
      await expect(service.getTemplate('nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------- updateTemplate ----------
  describe('updateTemplate', () => {
    const existing = {
      id: 't1',
      name: 'old',
      title: 't',
      body: 'b',
      deepLink: null,
      data: null,
      imageUrl: null,
      isActive: true,
    } as any;

    it('1: actualiza campos parcialmente (solo title)', async () => {
      mockTemplateRepo.findOne.mockResolvedValue({ ...existing });
      mockTemplateRepo.save.mockResolvedValue({ ...existing, title: 'new' });
      const res = await service.updateTemplate('t1', { title: 'new' });
      expect(res.title).toBe('new');
    });

    it('2: lanza ConflictException si cambia name a uno existente', async () => {
      mockTemplateRepo.findOne
        .mockResolvedValueOnce({ ...existing }) // getTemplate
        .mockResolvedValueOnce({ id: 'other', name: 'taken' } as any); // name check
      await expect(
        service.updateTemplate('t1', { name: 'taken' }),
      ).rejects.toThrow(ConflictException);
    });

    it('3: permite mismo name si es el propio template', async () => {
      mockTemplateRepo.findOne
        .mockResolvedValueOnce({ ...existing })
        .mockResolvedValueOnce(null); // name no existe en otro
      mockTemplateRepo.save.mockResolvedValue({ ...existing });
      await expect(
        service.updateTemplate('t1', { name: 'old' }),
      ).resolves.toBeDefined();
    });

    it('4: lanza NotFoundException si template no existe', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateTemplate('nope', { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('5: actualiza isActive correctamente', async () => {
      mockTemplateRepo.findOne.mockResolvedValue({ ...existing });
      mockTemplateRepo.save.mockResolvedValue({ ...existing, isActive: false });
      const res = await service.updateTemplate('t1', { isActive: false });
      expect(res.isActive).toBe(false);
    });
  });

  // ---------- deleteTemplate ----------
  describe('deleteTemplate', () => {
    it('1: soft-delete setea isActive=false (no llama delete)', async () => {
      mockTemplateRepo.update.mockResolvedValue({ affected: 1 } as any);
      await service.deleteTemplate('t1');
      expect(mockTemplateRepo.update).toHaveBeenCalledWith('t1', {
        isActive: false,
      });
    });

    it('2: lanza NotFoundException si affected === 0', async () => {
      mockTemplateRepo.update.mockResolvedValue({ affected: 0 } as any);
      await expect(service.deleteTemplate('nope')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('3: retorna success al desactivar', async () => {
      mockTemplateRepo.update.mockResolvedValue({ affected: 1 } as any);
      const res = await service.deleteTemplate('t1');
      expect(res).toEqual({ success: true, message: 'Template desactivado' });
    });
  });

  // ---------- sendFromTemplate ----------
  describe('sendFromTemplate', () => {
    const template = {
      id: 'tpl-1',
      name: 'promo',
      title: '¡{{productName}}!',
      body: 'Hola {{userName}}',
      deepLink: 'menucom://p/{{productSlug}}',
      data: { type: 'promotion' },
      imageUrl: 'https://img.example.com/a.jpg',
      isActive: true,
    } as any;

    const dto: SendFromTemplateDto = {
      userIds: ['u1', 'u2'],
      params: {
        productName: 'Burger',
        userName: 'Juan',
        productSlug: 'burger',
      },
    };

    beforeEach(() => {
      mockTemplateRepo.findOne.mockResolvedValue({ ...template });
    });

    it('1: resuelve y envía correctamente', async () => {
      const spy = jest
        .spyOn(service, 'sendNotificationToMultipleUsers')
        .mockResolvedValue({ successCount: 2, failureCount: 0 });
      const res = await service.sendFromTemplate('tpl-1', dto);
      expect(spy).toHaveBeenCalledWith(
        dto.userIds,
        '¡Burger!',
        'Hola Juan',
        expect.objectContaining({
          type: 'promotion',
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          deep_link: 'menucom://p/burger',
        }),
        'https://img.example.com/a.jpg',
      );
      expect(res.success).toBe(true);
      expect(res.results).toEqual({ successCount: 2, failureCount: 0 });
    });

    it('2: lanza NotFoundException si template no existe', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);
      await expect(service.sendFromTemplate('nope', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('3: lanza BadRequestException si template inactivo', async () => {
      mockTemplateRepo.findOne.mockResolvedValue({
        ...template,
        isActive: false,
      });
      await expect(service.sendFromTemplate('tpl-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('4: lanza BadRequestException si params vacío', async () => {
      await expect(
        service.sendFromTemplate('tpl-1', { userIds: ['u1'], params: {} }),
      ).rejects.toThrow(BadRequestException);
    });

    it('5: incluye warning si placeholders sin resolver', async () => {
      jest
        .spyOn(service, 'sendNotificationToMultipleUsers')
        .mockResolvedValue({ successCount: 1, failureCount: 0 });
      const res = (await service.sendFromTemplate('tpl-1', {
        userIds: ['u1'],
        params: { productName: 'Burger' },
      } as any)) as any;
      expect(res.unresolvedPlaceholders).toContain('userName');
      expect(res.unresolvedPlaceholders).toContain('productSlug');
      expect(res.warning).toBeDefined();
    });

    it('6: inyecta deep_link en resolvedData', async () => {
      const spy = jest
        .spyOn(service, 'sendNotificationToMultipleUsers')
        .mockResolvedValue({ successCount: 1, failureCount: 0 });
      await service.sendFromTemplate('tpl-1', dto);
      const passedData = spy.mock.calls[0][3] as any;
      expect(passedData.deep_link).toBe('menucom://p/burger');
    });

    it('7: no incluye deep_link si template no tiene deepLink', async () => {
      mockTemplateRepo.findOne.mockResolvedValue({
        ...template,
        deepLink: null,
      });
      const spy = jest
        .spyOn(service, 'sendNotificationToMultipleUsers')
        .mockResolvedValue({ successCount: 1, failureCount: 0 });
      await service.sendFromTemplate('tpl-1', dto);
      const passedData = spy.mock.calls[0][3] as any;
      expect(passedData.deep_link).toBeUndefined();
    });

    it('8: mergea template.data con click_action y deep_link', async () => {
      const spy = jest
        .spyOn(service, 'sendNotificationToMultipleUsers')
        .mockResolvedValue({ successCount: 1, failureCount: 0 });
      await service.sendFromTemplate('tpl-1', dto);
      const passedData = spy.mock.calls[0][3] as any;
      expect(passedData.type).toBe('promotion');
      expect(passedData.click_action).toBe('FLUTTER_NOTIFICATION_CLICK');
      expect(passedData.deep_link).toBe('menucom://p/burger');
    });

    it('9: lanza BadRequestException si title resuelto > 200 chars', async () => {
      mockTemplateRepo.findOne.mockResolvedValue({
        ...template,
        title: '{{x}}',
        deepLink: null,
      });
      await expect(
        service.sendFromTemplate('tpl-1', {
          userIds: ['u1'],
          params: { x: 'a'.repeat(201) },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('10: lanza BadRequestException si body resuelto > 4000 chars', async () => {
      mockTemplateRepo.findOne.mockResolvedValue({
        ...template,
        title: 'ok',
        body: 'x'.repeat(4000) + '{{a}}',
        deepLink: null,
      });
      await expect(
        service.sendFromTemplate('tpl-1', {
          userIds: ['u1'],
          params: { a: 'y' },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('11: lanza BadRequestException si data serializado > 4KB', async () => {
      const big = { x: 'a'.repeat(5000) };
      mockTemplateRepo.findOne.mockResolvedValue({
        ...template,
        title: 'ok',
        body: 'ok',
        deepLink: null,
        data: big,
      });
      await expect(
        service.sendFromTemplate('tpl-1', {
          userIds: ['u1'],
          params: { userName: 'a' },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('12: retorna successCount/failureCount del multicast', async () => {
      jest
        .spyOn(service, 'sendNotificationToMultipleUsers')
        .mockResolvedValue({ successCount: 3, failureCount: 1 });
      const res = await service.sendFromTemplate('tpl-1', dto);
      expect(res.results).toEqual({ successCount: 3, failureCount: 1 });
    });

    it('13: Firebase no inicializado → 503', async () => {
      (firebaseAdmin.isInitialized as jest.Mock).mockReturnValueOnce(false);
      await expect(service.sendFromTemplate('tpl-1', dto)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('14: template.data no sobrescribe deep_link', async () => {
      mockTemplateRepo.findOne.mockResolvedValue({
        ...template,
        data: { type: 'promotion', deep_link: 'otro' },
      });
      const spy = jest
        .spyOn(service, 'sendNotificationToMultipleUsers')
        .mockResolvedValue({ successCount: 1, failureCount: 0 });
      await service.sendFromTemplate('tpl-1', dto);
      const passedData = spy.mock.calls[0][3] as any;
      expect(passedData.deep_link).toBe('menucom://p/burger');
    });
  });

  // ---------- getUsersWithTokens ----------
  describe('getUsersWithTokens', () => {
    const buildUserQb = (data: any[], total: number) => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([data, total]),
      };
      mockUserRepo.createQueryBuilder.mockReturnValue(qb);
      return qb;
    };

    it('1: retorna usuarios paginados con FCM token', async () => {
      const qb = buildUserQb([{ id: 'u1', name: 'Juan', email: 'j@e.com' }], 1);
      const res = await service.getUsersWithTokens(1, 20);
      expect(qb.where).toHaveBeenCalledWith('user.fcmToken IS NOT NULL');
      expect(res.data[0]).toMatchObject({
        id: 'u1',
        name: 'Juan',
        hasFcmToken: true,
      });
    });

    it('2: filtra por search en name y email', async () => {
      const qb = buildUserQb([], 0);
      await service.getUsersWithTokens(1, 20, 'juan');
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(user.name ILIKE :search OR user.email ILIKE :search)',
        { search: '%juan%' },
      );
    });

    it('3: retorna lista vacía si no hay usuarios con token', async () => {
      buildUserQb([], 0);
      const res = await service.getUsersWithTokens(1, 20);
      expect(res.data).toEqual([]);
      expect(res.meta.total).toBe(0);
    });

    it('4: respeta paginación en primera página', async () => {
      const qb = buildUserQb([], 0);
      await service.getUsersWithTokens(1, 5);
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(5);
    });

    it('5: respeta paginación en página N', async () => {
      const qb = buildUserQb([], 0);
      await service.getUsersWithTokens(3, 5);
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(5);
    });

    it('6: mapea respuesta con hasFcmToken: true', async () => {
      buildUserQb([{ id: 'u1', name: 'A', email: 'a@e.com' }], 1);
      const res = await service.getUsersWithTokens(1, 20);
      expect(res.data.every((u: any) => u.hasFcmToken === true)).toBe(true);
    });
  });

  // ---------- sendDirectNotification ----------
  describe('sendDirectNotification', () => {
    const dto: SendAdminNotificationDto = {
      userIds: ['u1', 'u2'],
      title: 'Aviso',
      body: 'Mensaje',
    };

    it('1: envía notificación directa a múltiples usuarios', async () => {
      const spy = jest
        .spyOn(service, 'sendNotificationToMultipleUsers')
        .mockResolvedValue({ successCount: 2, failureCount: 0 });
      const res = await service.sendDirectNotification(dto);
      expect(spy).toHaveBeenCalledWith(
        dto.userIds,
        dto.title,
        dto.body,
        dto.data,
        dto.imageUrl,
      );
      expect(res).toEqual({ successCount: 2, failureCount: 0 });
    });

    it('2: pasa imageUrl al servicio de envío', async () => {
      const spy = jest
        .spyOn(service, 'sendNotificationToMultipleUsers')
        .mockResolvedValue({ successCount: 1, failureCount: 0 });
      await service.sendDirectNotification({
        ...dto,
        imageUrl: 'https://img.example.com/a.jpg',
      });
      expect(spy.mock.calls[0][4]).toBe('https://img.example.com/a.jpg');
    });

    it('3: no pasa imageUrl si es undefined', async () => {
      const spy = jest
        .spyOn(service, 'sendNotificationToMultipleUsers')
        .mockResolvedValue({ successCount: 1, failureCount: 0 });
      await service.sendDirectNotification(dto);
      expect(spy.mock.calls[0][4]).toBeUndefined();
    });

    it('4: retorna results del multicast', async () => {
      jest
        .spyOn(service, 'sendNotificationToMultipleUsers')
        .mockResolvedValue({ successCount: 1, failureCount: 1 });
      const res = await service.sendDirectNotification(dto);
      expect(res).toEqual({ successCount: 1, failureCount: 1 });
    });

    it('5: Firebase no inicializado → 503', async () => {
      (firebaseAdmin.isInitialized as jest.Mock).mockReturnValueOnce(false);
      await expect(service.sendDirectNotification(dto)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
