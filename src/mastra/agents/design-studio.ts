import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { configuredModel } from '@/lib/model-provider';
import { generateDesignImage, convertDesignToTemplate, reviseDesignTemplate } from '@/lib/design-operations';
import { renameTemplate, saveDraft } from '@/lib/storage';
import type { StudioState } from '@/types';

export function designStudioAgent(design: StudioState) {
  const { config, provider } = configuredModel('vision');
  const tools = {
    generateImage: createTool({
      id: 'generate-design-image',
      description: '根据用户描述生成全新海报参考图片。如果用户要求完成可复用模板，生成图片后继续调用 convertToTemplate。',
      inputSchema: z.object({ prompt: z.string().min(3).describe('海报的视觉风格和构图要求') }),
      execute: async ({ prompt }: { prompt: string }) => {
        const referencePath = await generateDesignImage(prompt);
        design.referencePath = referencePath;
        design.draftId = '';
        design.templateId = '';
        return { referencePath, message: '参考图片已生成，可直接继续转成模板。' };
      },
    }),
    convertToTemplate: createTool({
      id: 'convert-to-template',
      description: '将当前上传的参考图或刚生成的图片转为可填模型名称、折扣的 HTML 模板。用户明确要求“做模板/转模板/制作可复用海报”时调用。',
      inputSchema: z.object({ instructions: z.string().describe('希望保留的布局、风格和可填充区域') }),
      execute: async ({ instructions }: { instructions: string }) => {
        if (!design.referencePath) return { success: false, message: '请先上传参考图片，或让我生成一张海报。' };
        const result = await convertDesignToTemplate(design.referencePath, instructions, design.width, design.height);
        design.draftId = result.draftId;
        design.templateId = '';
        return { success: true, draftId: result.draftId, preview: result.preview, fields: result.manifest.fields };
      },
    }),
    reviseTemplate: createTool({
      id: 'revise-template',
      description: '用户要求“修改当前海报/变得更立体/调整布局、颜色”等，修改当前 HTML 模板并重新渲染预览。',
      inputSchema: z.object({ instruction: z.string().min(1).describe('具体设计修改意见') }),
      execute: async ({ instruction }: { instruction: string }) => {
        const kind = design.templateId ? 'templates' : 'drafts';
        const id = design.templateId || design.draftId;
        if (!id) return { success: false, message: '目前还没有 HTML 模板，请先把图片转换成模板。' };
        const result = await reviseDesignTemplate(kind, id, instruction);
        return { success: true, preview: result.preview, fields: result.manifest.fields };
      },
    }),
    saveTemplate: createTool({
      id: 'save-template',
      description: '仅当用户明确要求保存、入库当前设计模板时使用。已有模板则更新名称，未保存的草稿则写入模板库。',
      inputSchema: z.object({ name: z.string().min(1).describe('用户指定或确认的模板名称') }),
      execute: async ({ name }: { name: string }) => {
        if (!design.draftId && !design.templateId) return { success: false, message: '尚未生成可保存的 HTML 模板。' };
        if (design.templateId) renameTemplate(design.templateId, name);
        else design.templateId = await saveDraft(design.draftId, name);
        return { success: true, templateId: design.templateId, message: '模板已保存，可以到海报生成页面导入 Excel。' };
      },
    }),
  };
  return new Agent({
    id: 'poster-design-studio',
    name: 'AI 海报设计师',
    model: provider.chatModel(config.modelId),
    instructions: `你是 AI Design 的海报创作 Agent，你不仅可以给建议，还能调用工具真正完成设计操作。
当前工作状态：${JSON.stringify(design)}。
用户需要海报时：先理解需求。若要从零设计图，调用 generateImage；若已提供参考图并要求做模板，调用 convertToTemplate；如果用户要从零完成“可复用模板”，先 generateImage 再 convertToTemplate。用户要求调整已有 HTML 模板，调用 reviseTemplate。仅在用户明确要求保存时才调用 saveTemplate。
用户只是讨论创意、询问问题时正常回答，不调用工具。不要声称执行了没有调用的工具。工具执行后告诉用户得到的成果及下一步，不要输出内部文件源码。
所有模板必须准确包含模型名称 name、折扣 discount 的可填充字段；Excel 只有这两列，不虚构价格或计算折扣。用简洁自然的中文交流。`,
    tools,
  });
}
