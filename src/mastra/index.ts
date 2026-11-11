import { Mastra } from '@mastra/core/mastra';
import { createTemplateWorkflow } from './workflows/create-template';
export const mastra = new Mastra({workflows:{createTemplateWorkflow}});
