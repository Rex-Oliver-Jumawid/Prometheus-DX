import { Module } from '@nestjs/common';
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

@Module({
  controllers: [
    ProjectsController,
    ProjectWorkflowController,
    OutcomeWorkController,
    OutcomeDeliveryController,
    ProjectActivityController,
    ProjectChatController,
  ],
  providers: [
    ProjectsService,
    ProjectWorkflowService,
    OutcomeWorkService,
    OutcomeDeliveryService,
    ProjectActivityService,
    ProjectChatService,
  ],
})
export class ProjectsModule {}
