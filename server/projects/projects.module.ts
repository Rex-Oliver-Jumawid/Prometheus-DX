import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectWorkflowController } from './project-workflow.controller';
import { ProjectWorkflowService } from './project-workflow.service';

@Module({
  controllers: [ProjectsController, ProjectWorkflowController],
  providers: [ProjectsService, ProjectWorkflowService],
})
export class ProjectsModule {}
