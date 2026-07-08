import type { IncomingMessage, ServerResponse } from 'http';
import { getServerlessApp } from '../src/serverless';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getServerlessApp();
  app(req, res);
}
