import {
  CallHandler,
  ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { mergeMap, type Observable } from 'rxjs';
import { PushDeliveryService } from './push-delivery.service';

@Injectable()
export class PushDeliveryInterceptor implements NestInterceptor {
  constructor(private readonly deliveries: PushDeliveryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ method?: string }>();
    if (!request.method || ['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())) {
      return next.handle();
    }

    return next.handle().pipe(
      mergeMap(async (value) => {
        await this.deliveries.flushAfterCommit();
        return value;
      }),
    );
  }
}
