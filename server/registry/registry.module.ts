import { Module } from '@nestjs/common';
import { RegistryController } from './registry.controller';
import { RegistryService } from './registry.service';
import {
  BrevoInvitationService,
  INVITATION_DELIVERY,
} from './invitation.service';

@Module({
  controllers: [RegistryController],
  providers: [
    RegistryService,
    BrevoInvitationService,
    {
      provide: INVITATION_DELIVERY,
      useExisting: BrevoInvitationService,
    },
  ],
})
export class RegistryModule {}
