import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { mergeMap, type Observable } from 'rxjs';
import { PushDeliveryService } from './push-delivery.service';

@Injectable()
export class PushDeliveryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PushDeliveryInterceptor.name);

  constructor(private readonly deliveries: PushDeliveryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ method?: string }>();
    if (!request.method || ['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())) {
      return next.handle();
    }

    return next.handle().pipe(
      mergeMap(async (value) => {
        try {
          await this.deliveries.flushPendingDeliveries();
        } catch (error) {
          this.logger.error(
            'Device push delivery failed after the request completed.',
            error instanceof Error ? error.stack : undefined,
          );
        }
        return value;
      }),
    );
  }
}
