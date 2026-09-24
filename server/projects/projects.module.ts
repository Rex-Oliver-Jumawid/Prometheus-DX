import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectWorkflowController } from './project-workflow.controller';
import { ProjectWorkflowService } from './project-workflow.service';
import { OutcomeWorkController } from './outcome-work.controller';
import { OutcomeWorkService } from './outcome-work.service';
import { OutcomeDeliveryController } from './outcome-delivery.controller';
import { OutcomeDeliveryService } from './outcome-delivery.service';
import { ProjectChatController } from './project-chat.controller';
import { ProjectChatService } from './project-chat.service';
import { ProjectAnnouncementController } from './project-announcement.controller';
import { ProjectAnnouncementService } from './project-announcement.service';

@Module({
  controllers: [
    ProjectsController,
    ProjectWorkflowController,
    OutcomeWorkController,
    OutcomeDeliveryController,
    ProjectChatController,
    ProjectAnnouncementController,
  ],
  providers: [
    ProjectsService,
    ProjectWorkflowService,
    OutcomeWorkService,
    OutcomeDeliveryService,
    ProjectChatService,
    ProjectAnnouncementService,
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}
