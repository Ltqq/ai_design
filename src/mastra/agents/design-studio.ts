import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { configuredModel } from '@/lib/model-provider';
import { generateDesignImage, convertDesignToTemplate, createTemplateFromText, reviseDesignTemplate } from '@/lib/design-operations';
import { renameTemplate, saveDraft } from '@/lib/storage';
import type { StudioState } from '@/types';

export function designStudioAgent(design: StudioState, onUpdate?: (stage:string)=>void,runId?:string,allowRedesign=false,signal?:AbortSignal) {
  const { config, provider } = configuredModel('vision');
  const tools = {
    createTemplateFromText: createTool({
      id:'create-template-from-text',
      description:'直接按文字生成可复用 HTML/CSS 模板，不需要生成参考图片。用户没有提供参考图、只说要一个海报模板时优先调用此工具，省下生图和多模态图片理解费用。',
      inputSchema:z.object({prompt:z.string().min(3)}),
      execute:async ({prompt}:{prompt:string})=>{
        const result=await createTemplateFromText(prompt,design.width,design.height,onUpdate,runId,signal);
        design.draftId=result.draftId;design.templateId='';design.referencePath='';
        onUpdate?.('文字 HTML 模板已生成');
        return {success:true,draftId:result.draftId,preview:result.preview,fields:result.manifest.fields};
      },
    }),
    generateImage: createTool({
      id: 'generate-design-image',
      description: '根据用户描述生成全新海报参考图片。如果用户要求完成可复用模板，生成图片后继续调用 convertToTemplate。',
      inputSchema: z.object({ prompt: z.string().min(3).describe('海报的视觉风格和构图要求') }),
      execute: async ({ prompt }: { prompt: string }) => {
        onUpdate?.('AI 正在生成参考海报');
        const referencePath = await generateDesignImage(prompt,runId,design.width,design.height,signal);
        design.referencePath = referencePath;
        onUpdate?.('参考海报已生成');
        return { referencePath, message: '参考图片已生成，可直接继续转成模板。' };
      },
    }),
    convertToTemplate: createTool({
      id: 'convert-to-template',
      description: '将当前上传的参考图或刚生成的图片转为可填模型名称、折扣的 HTML 模板。用户明确要求“做模板/转模板/制作可复用海报”时调用。',
      inputSchema: z.object({ instructions: z.string().describe('希望保留的布局、风格和可填充区域') }),
      execute: async ({ instructions }: { instructions: string }) => {
        if (!design.referencePath) return { success: false, message: '请先上传参考图片，或让我生成一张海报。' };
        const result = await convertDesignToTemplate(design.referencePath, instructions, design.width, design.height, onUpdate,runId,signal);
        design.draftId = result.draftId;
        design.templateId = '';
        onUpdate?.('HTML 模板已生成并保存草稿');
        return { success: true, draftId: result.draftId, preview: result.preview, fields: result.manifest.fields };
      },
    }),
    reviseTemplate: createTool({
      id: 'revise-template',
      description: '默认局部修改当前 HTML/CSS。改变颜色、标签大小、阴影、局部布局、字体等均调用它。仅修改必要的片段，不重新生成整份源码。',
      inputSchema: z.object({ instruction: z.string().min(1).describe('具体设计修改意见') }),
      execute: async ({ instruction }: { instruction: string }) => {
        const kind = design.templateId ? 'templates' : 'drafts';
        const id = design.templateId || design.draftId;
        if (!id) return { success: false, message: '目前还没有 HTML 模板，请先把图片转换成模板。' };
        const result = await reviseDesignTemplate(kind, id, instruction, onUpdate, 'patch',undefined,runId,signal);
        onUpdate?.('模板修改已完成');
        return { success: true, editMode:'patch', changedFiles:result.changedFiles, preview: result.preview, fields: result.manifest.fields };
      },
    }),
    reviewTemplate: createTool({
      id:'review-poster-template',
      description:'仅在用户明确要求视觉检查、对照截图纠正布局或点击视觉复查按钮时调用。多模态模型查看实际 HTML 截图、可选参考图，输出局部代码修补，不整体重写。会额外产生一次视觉模型调用费用。',
      inputSchema:z.object({instruction:z.string().min(1)}),
      execute:async ({instruction}:{instruction:string})=>{
        const kind=design.templateId?'templates':'drafts';
        const id=design.templateId||design.draftId;
        if(!id)return {success:false,message:'当前还没有 HTML 模板可检查'};
        const result=await reviseDesignTemplate(kind,id,instruction,onUpdate,'review',design.referencePath,runId,signal);
        onUpdate?.('已根据实际渲染截图局部修正模板');
        return {success:true,editMode:'review',changedFiles:result.changedFiles,preview:result.preview};
      },
    }),
    redesignTemplate: createTool({
      id:'redesign-template',
      description:'仅当用户明确要求整体换风格、彻底重构模板，或局部编辑无法实现时调用。此操作会重新生成完整 HTML/CSS，费用明显高于局部编辑。',
      inputSchema:z.object({instruction:z.string().min(1)}),
      execute:async ({instruction}:{instruction:string})=>{
        if(!allowRedesign)return {success:false,message:'没有收到用户明确要求整体重构的指令，请使用局部编辑工具'};
        const kind=design.templateId?'templates':'drafts';
        const id=design.templateId||design.draftId;
        if(!id)return {success:false,message:'请先生成 HTML 模板'};
        const result=await reviseDesignTemplate(kind,id,instruction,onUpdate,'redesign',design.referencePath,runId,signal);
        onUpdate?.('模板整体重构已完成');
        return {success:true,editMode:'redesign',preview:result.preview};
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
        onUpdate?.('模板已保存到模板库');
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
用户没有参考图而想直接制作可复用海报模板时，优先使用 createTemplateFromText，不要浪费一次生图。用户明确要求先生成参考图才调用 generateImage；参考图转模板用 convertToTemplate。默认用 reviseTemplate 对 HTML/CSS 做局部修改，不重新生成整份源码。用户要求视觉检查或对比参考图微调时使用 reviewTemplate（截图+局部补丁，只有明确要求才调用，避免额外计费）。只有用户明确要求全新风格、整体重构才使用 redesignTemplate。用户只要说调整颜色、样式、局部位置、间距、排版，不要选整体重构。局部编辑无法精准定位时直接提示失败并继续澄清，禁止自动改用整体重构。用户明确要求保存才调用 saveTemplate。首次模板生成后只做本地渲染，不自动发起第二次视觉精修。
用户只是讨论创意、询问问题时正常回答，不调用工具。不要声称执行了没有调用的工具。工具执行后告诉用户得到的成果及下一步，不要输出内部文件源码。
所有模板必须准确包含模型名称 name、折扣 discount 的可填充字段；Excel 只有这两列，不虚构价格或计算折扣。用简洁自然的中文交流。`,
    tools,
  });
}
