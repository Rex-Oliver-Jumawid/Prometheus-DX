import { ProjectVaultController } from './project-vault.controller';
import { ProjectVaultService } from './project-vault.service';
import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectWorkflowController } from './project-workflow.controller';
import { ProjectWorkflowService } from './project-workflow.service';
import { OutcomeWorkController } from './outcome-work.controller';
import { OutcomeWorkService } from './outcome-work.service';
import { OutcomeDeliveryController } from './outcome-delivery.controller';
import { OutcomeDeliveryService } from './outcome-delivery.service';
import { ProjectActivityController } from './project-activity.controller';
import { ProjectActivityService } from './project-activity.service';
import { ProjectChatController } from './project-chat.controller';
import { ProjectChatService } from './project-chat.service';
import { ProjectAnnouncementController } from './project-announcement.controller';
import { ProjectAnnouncementService } from './project-announcement.service';

@Module({
  imports: [NotificationsModule],
  controllers: [
    ProjectsController,
    ProjectWorkflowController,
    OutcomeWorkController,
    OutcomeDeliveryController,
    ProjectActivityController,
    ProjectChatController,
    ProjectAnnouncementController,
    ProjectVaultController,
  ],
  providers: [
    ProjectsService,
    ProjectWorkflowService,
    OutcomeWorkService,
    OutcomeDeliveryService,
    ProjectActivityService,
    ProjectChatService,
    ProjectAnnouncementService,
    ProjectVaultService,
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}
