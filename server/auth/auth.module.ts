import { Global, Module } from '@nestjs/common';
import { AuthService, createSupabaseAuthClient, SUPABASE_AUTH_CLIENT } from './auth.service';
import { MeController } from './me.controller';
import { RolesGuard } from './roles.guard';
import { SupabaseAuthGuard } from './supabase-auth.guard';

@Global()
@Module({
  controllers: [MeController],
  providers: [
    AuthService,
    SupabaseAuthGuard,
    RolesGuard,
    { provide: SUPABASE_AUTH_CLIENT, useFactory: createSupabaseAuthClient },
  ],
  exports: [AuthService, SupabaseAuthGuard, RolesGuard],
})
export class AuthModule {}
