import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { AuthService } from '../services/auth.service';
// import { LocalAuthGuard } from './local-auth.guard';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt.auth.gards';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthGuard('local'))
  @Post('/login')
  async login(@Req() payload: Request) {
    return this.authService.login(payload);
  }

  // @UseGuards(LocalAuthGuard)
  @Post('/register')
  async register(@Body() payload: CreateUserDto) {
    console.log(payload);
    return this.authService.registerUser(payload);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/create/client')
  async registerClient(@Req() req: Request, @Body() client: CreateUserDto) {
    return this.authService.registerClient(client, req['user']['userId']);
  }

  @Post('/social')
  async loginSocial(@Body() payload: CreateUserDto) {
    return this.authService.loginSocial(payload);
  }
}
