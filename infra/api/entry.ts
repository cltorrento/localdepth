import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleGatewayRequest } from '../../services/api-gateway/src/index.ts';
import { handleAuthRequest } from '../../services/auth-service/src/index.ts';
import { handleContentRequest } from '../../services/content-service/src/index.ts';
import { handleMediaRequest } from '../../services/media-service/src/index.ts';
import { handleSearchRequest } from '../../services/search-service/src/index.ts';
import { handleRecommendationsRequest } from '../../services/recommendations-service/src/index.ts';

// Una sola función serverless: el gateway despacha en proceso a cada servicio
// (sin proxy HTTP ni puertos), igual que en local pero sin levantar 6 procesos.
const serviceHandlers = {
  auth: handleAuthRequest,
  content: handleContentRequest,
  media: handleMediaRequest,
  search: handleSearchRequest,
  recommendations: handleRecommendationsRequest,
};

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleGatewayRequest(req, res, serviceHandlers);
}
