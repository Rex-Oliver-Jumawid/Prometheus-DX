import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_METADATA = 'prometheus:rate-limit';

export interface RateLimitPolicy {
  /** Stable operation identifier; never use a user-supplied value. */
  scope: string;
  limit: number;
  windowSeconds: number;
  /** Optional named route parameter to partition a member's quota by room. */
  resourceParam?: string;
}

export const RateLimit = (policy: RateLimitPolicy) =>
  SetMetadata(RATE_LIMIT_METADATA, policy);
