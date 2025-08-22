import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl } from 'class-validator';

export class InitiateOAuthDto {
  @ApiProperty({
    description: 'URL de redirección después de la autorización',
    example: 'https://myapp.com/oauth/callback',
  })
  @IsUrl()
  redirectUri: string;

  @ApiProperty({
    description: 'Estado opcional para validación de seguridad',
    example: 'random_state_string',
    required: false,
  })
  @IsOptional()
  @IsString()
  state?: string;
}

export class OAuthCallbackDto {
  @ApiProperty({
    description: 'Código de autorización de Mercado Pago',
    example: 'AUTH_CODE_FROM_MP',
  })
  @IsString()
  code: string;

  @ApiProperty({
    description: 'Estado para validación de seguridad',
    example: 'random_state_string',
    required: false,
  })
  @IsOptional()
  @IsString()
  state?: string;
}

export class TokenExchangeDto {
  @ApiProperty({
    description: 'Código de autorización recibido del callback',
  })
  @IsString()
  authorizationCode: string;

  @ApiProperty({
    description: 'URI de redirección usada en la autorización inicial',
  })
  @IsUrl()
  redirectUri: string;

  @ApiProperty({
    description: 'ID de vinculación del usuario (recibido en initiateOAuth)',
    example: 'user-uuid-123',
  })
  @IsString()
  vinculation_id: string;
}
