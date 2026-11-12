import { afterEach, describe, expect, it, vi } from 'vitest';
import { serverEnvironment } from '../config/env';
import { PushWorkerController } from './push-worker.controller';
import type { PushDeliveryService } from './push-delivery.service';
describe('scheduled push worker', () => {
  const original = serverEnvironment.cronSecret;
  afterEach(() => {
    serverEnvironment.cronSecret = original;
  });
  it('rejects missing configuration and invalid credentials before dispatch', async () => {
    const flush = vi.fn();
    const worker = new PushWorkerController({
      flushPendingDeliveries: flush,
    } as unknown as PushDeliveryService);
    serverEnvironment.cronSecret = undefined;
    await expect(worker.run()).rejects.toThrow('not configured');
    serverEnvironment.cronSecret = 'a-long-ci-scheduler-secret';
    await expect(worker.run('Bearer wrong')).rejects.toThrow(
      'Invalid scheduler',
    );
    expect(flush).not.toHaveBeenCalled();
    await worker.run('Bearer a-long-ci-scheduler-secret');
    expect(flush).toHaveBeenCalledTimes(1);
  });
});
