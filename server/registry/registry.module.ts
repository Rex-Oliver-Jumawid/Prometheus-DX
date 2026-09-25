import { Module } from '@nestjs/common';
import { RegistryController } from './registry.controller';
import { RegistryService } from './registry.service';
import {
  BrevoInvitationService,
  DisabledInvitationService,
  INVITATION_DELIVERY,
} from './invitation.service';
import { serverEnvironment } from '../config/env';
import { ApiRateLimitGuard } from '../common/rate-limit';

@Module({
  controllers: [RegistryController],
  providers: [
    RegistryService,
    ApiRateLimitGuard,
    BrevoInvitationService,
    DisabledInvitationService,
    {
      provide: INVITATION_DELIVERY,
      useFactory: (
        brevoInvitationService: BrevoInvitationService,
        disabledInvitationService: DisabledInvitationService,
      ) =>
        serverEnvironment.invitationDeliveryMode === 'disabled'
          ? disabledInvitationService
          : brevoInvitationService,
      inject: [BrevoInvitationService, DisabledInvitationService],
    },
  ],
})
export class RegistryModule {}
