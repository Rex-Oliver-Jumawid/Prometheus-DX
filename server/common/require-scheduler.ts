import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { serverEnvironment } from '../config/env';

export function requireScheduler(authorization?: string): void {
  const secret = serverEnvironment.cronSecret;
  if (!secret)
    throw new ServiceUnavailableException('The scheduler is not configured.');
  const expected = Buffer.from('Bearer ' + secret);
  const provided = Buffer.from(authorization ?? '');
  if (
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {
    throw new UnauthorizedException('Invalid scheduler credentials.');
  }
}
