import { Controller, Get, Redirect } from '@nestjs/common';

@Controller()
export class RootController {
  @Get()
  @Redirect('/docs', 302)
  root() {
    return { url: '/docs' };
  }

  @Get('favicon.ico')
  @Redirect('/docs', 302)
  favicon() {
    return { url: '/docs' };
  }
}
