import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.gards';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';
import { SendAdminNotificationDto } from './dto/send-admin-notification.dto';
import { SendFromTemplateDto } from './dto/send-from-template.dto';

describe('NotificationsController — Admin Endpoints', () => {
  let controller: NotificationsController;

  const mockNotificationsService = {
    createTemplate: jest.fn(),
    listTemplates: jest.fn(),
    getTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    sendFromTemplate: jest.fn(),
    sendDirectNotification: jest.fn(),
    getUsersWithTokens: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get<NotificationsController>(NotificationsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------- CRUD Templates ----------
  describe('POST /admin/templates', () => {
    const dto: CreateNotificationTemplateDto = {
      name: 'welcome',
      title: '¡Hola!',
      body: 'Bienvenido',
    };

    it('1: crea template y retorna resultado del servicio', async () => {
      mockNotificationsService.createTemplate.mockResolvedValue({
        id: 't1',
        ...dto,
      });
      const res = await controller.createTemplate(dto);
      expect(mockNotificationsService.createTemplate).toHaveBeenCalledWith(dto);
      expect(res).toMatchObject({ id: 't1', name: 'welcome' });
    });

    it('2: propaga ConflictException si name duplicado', async () => {
      mockNotificationsService.createTemplate.mockRejectedValue(
        new ConflictException('duplicado'),
      );
      await expect(controller.createTemplate(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('GET /admin/templates', () => {
    it('3: lista templates con query params recibidos', async () => {
      mockNotificationsService.listTemplates.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });
      await controller.listTemplates({
        page: 1,
        limit: 10,
        search: 'promo',
        isActive: true,
        sortBy: 'name',
        sortOrder: 'ASC',
      } as any);
      expect(mockNotificationsService.listTemplates).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        search: 'promo',
        isActive: true,
        sortBy: 'name',
        sortOrder: 'ASC',
      });
    });

    it('4: usa defaults (page 1, limit 20) si no hay query params', async () => {
      mockNotificationsService.listTemplates.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });
      await controller.listTemplates({} as any);
      expect(mockNotificationsService.listTemplates).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        search: undefined,
        isActive: undefined,
        sortBy: undefined,
        sortOrder: undefined,
      });
    });
  });

  describe('GET /admin/templates/:id', () => {
    it('5: retorna template por ID', async () => {
      mockNotificationsService.getTemplate.mockResolvedValue({ id: 't1' });
      const res = await controller.getTemplate('t1');
      expect(mockNotificationsService.getTemplate).toHaveBeenCalledWith('t1');
      expect(res).toEqual({ id: 't1' });
    });

    it('6: propaga NotFoundException si no existe', async () => {
      mockNotificationsService.getTemplate.mockRejectedValue(
        new NotFoundException(),
      );
      await expect(controller.getTemplate('nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('PATCH /admin/templates/:id', () => {
    const dto: UpdateNotificationTemplateDto = { title: 'nuevo' };

    it('7: actualiza template (id + dto)', async () => {
      mockNotificationsService.updateTemplate.mockResolvedValue({
        id: 't1',
        title: 'nuevo',
      });
      const res = await controller.updateTemplate('t1', dto);
      expect(mockNotificationsService.updateTemplate).toHaveBeenCalledWith(
        't1',
        dto,
      );
      expect(res).toMatchObject({ id: 't1', title: 'nuevo' });
    });

    it('8: propaga NotFoundException si no existe', async () => {
      mockNotificationsService.updateTemplate.mockRejectedValue(
        new NotFoundException(),
      );
      await expect(controller.updateTemplate('nope', dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('DELETE /admin/templates/:id', () => {
    it('9: desactiva template y retorna success', async () => {
      mockNotificationsService.deleteTemplate.mockResolvedValue({
        success: true,
        message: 'Template desactivado',
      });
      const res = await controller.deleteTemplate('t1');
      expect(mockNotificationsService.deleteTemplate).toHaveBeenCalledWith(
        't1',
      );
      expect(res).toEqual({ success: true, message: 'Template desactivado' });
    });
  });

  // ---------- Envío de notificaciones ----------
  describe('POST /admin/send', () => {
    const dto: SendAdminNotificationDto = {
      userIds: ['u1'],
      title: 'Aviso',
      body: 'Mensaje',
    };

    it('10: envía notificación directa (delega en servicio)', async () => {
      mockNotificationsService.sendDirectNotification.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
      });
      const res = await controller.sendDirectNotification(dto);
      expect(
        mockNotificationsService.sendDirectNotification,
      ).toHaveBeenCalledWith(dto);
      expect(res).toEqual({ successCount: 1, failureCount: 0 });
    });
  });

  describe('POST /admin/send-from-template/:id', () => {
    const dto: SendFromTemplateDto = {
      userIds: ['u1'],
      params: { name: 'Juan' },
    };

    it('12: envía desde template (id + dto)', async () => {
      mockNotificationsService.sendFromTemplate.mockResolvedValue({
        success: true,
        results: { successCount: 1, failureCount: 0 },
      });
      const res = await controller.sendFromTemplate('tpl-1', dto);
      expect(mockNotificationsService.sendFromTemplate).toHaveBeenCalledWith(
        'tpl-1',
        dto,
      );
      expect(res.success).toBe(true);
    });

    it('13: propaga NotFoundException si template no existe', async () => {
      mockNotificationsService.sendFromTemplate.mockRejectedValue(
        new NotFoundException(),
      );
      await expect(controller.sendFromTemplate('nope', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('14: retorna response con warning si placeholders faltan', async () => {
      mockNotificationsService.sendFromTemplate.mockResolvedValue({
        success: true,
        warning: '1 placeholder(s) sin resolver: x',
        unresolvedPlaceholders: ['x'],
        results: { successCount: 1, failureCount: 0 },
      });
      const res = (await controller.sendFromTemplate('tpl-1', dto)) as any;
      expect(res.warning).toBeDefined();
      expect(res.unresolvedPlaceholders).toEqual(['x']);
    });
  });

  describe('GET /admin/users-with-tokens', () => {
    it('15: lista usuarios paginados con query params', async () => {
      mockNotificationsService.getUsersWithTokens.mockResolvedValue({
        data: [{ id: 'u1', name: 'Juan', email: 'j@e.com', hasFcmToken: true }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
      await controller.getUsersWithTokens({
        page: 1,
        limit: 20,
        search: 'juan',
      } as any);
      expect(mockNotificationsService.getUsersWithTokens).toHaveBeenCalledWith(
        1,
        20,
        'juan',
      );
    });

    it('16: retorna lista vacía (data: [], total: 0)', async () => {
      mockNotificationsService.getUsersWithTokens.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });
      const res = await controller.getUsersWithTokens({} as any);
      expect(res.data).toEqual([]);
      expect(res.meta.total).toBe(0);
    });
  });
});
