import { createNestApplication } from './bootstrap';
import { serverEnvironment } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await createNestApplication();
  await app.listen(serverEnvironment.port, '0.0.0.0');
}

void bootstrap();
