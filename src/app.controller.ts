import { Controller, Get } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller()
export class AppController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  async test(): Promise<any> {
    return await this.authService.getCookie();
  }
}
