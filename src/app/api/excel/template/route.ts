import { createExcelTemplate } from '@/lib/excel';
import { withErrors } from '@/lib/http';
export const runtime='nodejs';
export const GET=withErrors(async()=>{
  const xlsx=await createExcelTemplate();
  return new Response(new Uint8Array(xlsx),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':"attachment; filename=model-discounts.xlsx"}});
});
