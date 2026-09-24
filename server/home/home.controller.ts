import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import type { Member } from '@prisma/client';
import { CurrentMember } from '../auth/current-member.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { HomeService } from './home.service';

@Controller('home')
@UseGuards(SupabaseAuthGuard)
export class HomeController {
  constructor(@Inject(HomeService) private readonly homeService: HomeService) {}

  @Get()
  getDashboard(@CurrentMember() member: Member) {
    return this.homeService.getDashboard(member);
  }
}
