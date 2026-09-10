import serverless from 'serverless-http';
import { getApp } from '../../server.ts';

let handlerInstance: any;

export const handler = async (event: any, context: any) => {
  // Ensure the DB is initialized and Express app is cached across invocations
  if (!handlerInstance) {
    const app = await getApp();
    handlerInstance = serverless(app);
  }
  return handlerInstance(event, context);
};
