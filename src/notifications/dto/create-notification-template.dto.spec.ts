import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateNotificationTemplateDto } from './create-notification-template.dto';
import { UpdateNotificationTemplateDto } from './update-notification-template.dto';
import { SendAdminNotificationDto } from './send-admin-notification.dto';
import { SendFromTemplateDto } from './send-from-template.dto';

async function errorsOf(instance: any): Promise<string[]> {
  const errs = await validate(instance);
  return errs.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('CreateNotificationTemplateDto', () => {
  const valid = {
    name: 'welcome',
    title: '¡Hola!',
    body: 'Bienvenido',
  };

  it('1: DTO válido con todos los campos → 0 errores', async () => {
    const inst = plainToInstance(CreateNotificationTemplateDto, {
      ...valid,
      deepLink: 'menucom://x',
      imageUrl: 'https://img.example.com/a.jpg',
      data: { type: 'promo' },
    });
    expect(await errorsOf(inst)).toHaveLength(0);
  });

  it('2: name con mayúsculas → error matches', async () => {
    const inst = plainToInstance(CreateNotificationTemplateDto, {
      ...valid,
      name: 'Welcome',
    });
    const errs = await errorsOf(inst);
    expect(errs.some((e) => e.includes('minúsculas'))).toBe(true);
  });

  it('3: name con espacios → error matches', async () => {
    const inst = plainToInstance(CreateNotificationTemplateDto, {
      ...valid,
      name: 'wel come',
    });
    const errs = await errorsOf(inst);
    expect(errs.some((e) => e.includes('minúsculas'))).toBe(true);
  });

  it('4: name menor a 3 chars → error minLength', async () => {
    const inst = plainToInstance(CreateNotificationTemplateDto, {
      ...valid,
      name: 'ab',
    });
    const errs = await errorsOf(inst);
    expect(errs.some((e) => e.includes('longer than or equal to 3'))).toBe(
      true,
    );
  });

  it('5: name mayor a 100 chars → error maxLength', async () => {
    const inst = plainToInstance(CreateNotificationTemplateDto, {
      ...valid,
      name: 'a'.repeat(101),
    });
    const errs = await errorsOf(inst);
    expect(errs.some((e) => e.includes('shorter than or equal to 100'))).toBe(
      true,
    );
  });

  it('6: title vacío → error isNotEmpty', async () => {
    const inst = plainToInstance(CreateNotificationTemplateDto, {
      ...valid,
      title: '',
    });
    const errs = await errorsOf(inst);
    expect(errs.some((e) => e.includes('should not be empty'))).toBe(true);
  });

  it('7: title mayor a 200 chars → error maxLength', async () => {
    const inst = plainToInstance(CreateNotificationTemplateDto, {
      ...valid,
      title: 'a'.repeat(201),
    });
    const errs = await errorsOf(inst);
    expect(errs.some((e) => e.includes('200'))).toBe(true);
  });

  it('8: imageUrl con HTTP (no HTTPS) → error isUrl', async () => {
    const inst = plainToInstance(CreateNotificationTemplateDto, {
      ...valid,
      imageUrl: 'http://img.example.com/a.jpg',
    });
    const errs = await errorsOf(inst);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('9: imageUrl con formato inválido → error isUrl', async () => {
    const inst = plainToInstance(CreateNotificationTemplateDto, {
      ...valid,
      imageUrl: 'no-es-url',
    });
    const errs = await errorsOf(inst);
    expect(errs.length).toBeGreaterThan(0);
  });
});

describe('UpdateNotificationTemplateDto', () => {
  it('10: DTO vacío (todos opcionales) → 0 errores', async () => {
    const inst = plainToInstance(UpdateNotificationTemplateDto, {});
    expect(await errorsOf(inst)).toHaveLength(0);
  });

  it('11: solo isActive: false → 0 errores', async () => {
    const inst = plainToInstance(UpdateNotificationTemplateDto, {
      isActive: false,
    });
    expect(await errorsOf(inst)).toHaveLength(0);
  });
});

describe('SendAdminNotificationDto', () => {
  const valid = {
    userIds: ['550e8400-e29b-41d4-a716-446655440000'],
    title: 'Aviso',
    body: 'Mensaje',
  };

  it('12: userIds vacío → error arrayMinSize', async () => {
    const inst = plainToInstance(SendAdminNotificationDto, {
      ...valid,
      userIds: [],
    });
    const errs = await errorsOf(inst);
    expect(errs.some((e) => e.includes('al menos un userId'))).toBe(true);
  });

  it('13: userIds con string no UUID → error isUuid', async () => {
    const inst = plainToInstance(SendAdminNotificationDto, {
      ...valid,
      userIds: ['not-a-uuid'],
    });
    const errs = await errorsOf(inst);
    expect(errs.some((e) => e.toLowerCase().includes('uuid'))).toBe(true);
  });

  it('14: userIds con más de 5000 elementos → error arrayMaxSize', async () => {
    const ids = Array.from(
      { length: 5001 },
      () => '550e8400-e29b-41d4-a716-446655440000',
    );
    const inst = plainToInstance(SendAdminNotificationDto, {
      ...valid,
      userIds: ids,
    });
    const errs = await errorsOf(inst);
    expect(errs.some((e) => e.includes('5000'))).toBe(true);
  });

  it('15: title > 200 chars → error maxLength', async () => {
    const inst = plainToInstance(SendAdminNotificationDto, {
      ...valid,
      title: 'a'.repeat(201),
    });
    const errs = await errorsOf(inst);
    expect(errs.some((e) => e.includes('200'))).toBe(true);
  });
});

describe('SendFromTemplateDto', () => {
  it('16: userIds vacío → error arrayMinSize', async () => {
    const inst = plainToInstance(SendFromTemplateDto, {
      userIds: [],
      params: { a: '1' },
    });
    const errs = await errorsOf(inst);
    expect(errs.some((e) => e.includes('al menos un userId'))).toBe(true);
  });

  it('17: params presente y userIds válido → 0 errores', async () => {
    const inst = plainToInstance(SendFromTemplateDto, {
      userIds: ['550e8400-e29b-41d4-a716-446655440000'],
      params: { a: '1' },
    });
    expect(await errorsOf(inst)).toHaveLength(0);
  });
});
