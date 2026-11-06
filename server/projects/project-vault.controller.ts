import { BadRequestException, Body, Controller, Delete, Get, Header, Inject, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import type { Member } from '@prisma/client';
import { RevealVaultRequestSchema, SaveVaultItemRequestSchema, SetVaultGrantRequestSchema } from '../../shared/contracts/project-vault';
import { CurrentMember } from '../auth/current-member.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ProjectVaultService } from './project-vault.service';

@Controller('projects/:projectId/vault')
@UseGuards(SupabaseAuthGuard)
@Header('Cache-Control', 'private, no-store')
export class ProjectVaultController {
  constructor(@Inject(ProjectVaultService) private readonly vault: ProjectVaultService) {}
  private parse<T>(schema: { safeParse: (value: unknown) => { success: boolean; data?: T; error?: { issues: { message: string }[] } } }, body: unknown): T {
    const p = schema.safeParse(body);
    if (!p.success || p.data === undefined) throw new BadRequestException(p.error?.issues[0]?.message ?? 'Invalid vault input.');
    return p.data;
  }
  @Get('access')
  status(@CurrentMember() m: Member, @Param('projectId', ParseUUIDPipe) p: string) { return this.vault.status(m,p); }
  @Patch('access/:memberId')
  grant(@CurrentMember() m: Member, @Param('projectId', ParseUUIDPipe) p: string,
    @Param('memberId', ParseUUIDPipe) target: string, @Body() body: unknown) {
    return this.vault.grant(m,p,target,this.parse(SetVaultGrantRequestSchema,body).approved);
  }
  @Get()
  list(@CurrentMember() m: Member, @Param('projectId', ParseUUIDPipe) p: string) { return this.vault.list(m,p); }
  @Post()
  create(@CurrentMember() m: Member, @Param('projectId', ParseUUIDPipe) p: string, @Body() body: unknown) {
    return this.vault.create(m,p,this.parse(SaveVaultItemRequestSchema,body));
  }
  @Get(':itemId/versions')
  versions(@CurrentMember() m: Member, @Param('projectId', ParseUUIDPipe) p: string,
    @Param('itemId', ParseUUIDPipe) i: string) { return this.vault.versions(m,p,i); }
  @Post(':itemId/reveal')
  reveal(@CurrentMember() m: Member, @Param('projectId', ParseUUIDPipe) p: string,
    @Param('itemId', ParseUUIDPipe) i: string, @Body() body: unknown) {
    return this.vault.reveal(m,p,i,this.parse(RevealVaultRequestSchema,body ?? {}).purpose);
  }
  @Patch(':itemId')
  update(@CurrentMember() m: Member, @Param('projectId', ParseUUIDPipe) p: string,
    @Param('itemId', ParseUUIDPipe) i: string, @Body() body: unknown) {
    return this.vault.update(m,p,i,this.parse(SaveVaultItemRequestSchema,body));
  }
  @Delete(':itemId')
  remove(@CurrentMember() m: Member, @Param('projectId', ParseUUIDPipe) p: string,
    @Param('itemId', ParseUUIDPipe) i: string) { return this.vault.remove(m,p,i); }
}
