import * as XLSX from "xlsx";

const headers = ["科目", "章节／主题（可选）", "题干", "A", "B", "C", "D", "正确答案", "解析（可选）", "难度（可选）", "图片文件名（可选）", "图片说明（可选）"];
const example = [
  "Matematik",
  "Nombor dan Operasi",
  "Calculate / Hitung: 3 + 5 =",
  "6",
  "7",
  "8",
  "9",
  "C",
  "3 + 5 = 8。",
  "基础",
  "triangle-q1.png",
  "标有边长与角度的三角形示意图",
];

export async function GET() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers, example]);
  sheet["!cols"] = [
    { wch: 18 }, { wch: 24 }, { wch: 62 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 14 }, { wch: 48 }, { wch: 14 }, { wch: 28 }, { wch: 48 },
  ];
  const guide = XLSX.utils.aoa_to_sheet([
    ["MyGuru SPM 题库供题说明"],
    ["填写方式", "每题一行；请勿删除第一行栏目标题。"],
    ["必填字段", "科目、题干、A、B、C、D、正确答案。"],
    ["正确答案", "只能填写 A、B、C 或 D。"],
    ["可选字段", "章节／主题（可选）、解析（可选）、难度（可选）；难度只能是 基础、中等 或 进阶。"],
    ["题目图片", "如题目需要图表，在「图片文件名」填写完整文件名（例如 triangle-q1.png），上传表格时同时选择该图片。支持 JPG、PNG、WebP，每张最多 5MB。"],
    ["图片说明", "简要写出图片呈现的内容，帮助图片无法显示或使用读屏软件的学生理解。"],
    ["发布流程", "上传后全部进入待审核；你确认题干、答案与解析后才发布给学生。"],
  ]);
  guide["!cols"] = [{ wch: 18 }, { wch: 86 }];
  XLSX.utils.book_append_sheet(workbook, sheet, "题目");
  XLSX.utils.book_append_sheet(workbook, guide, "填写说明");
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  return new Response(bytes, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="MyGuru-SPM-question-template.xlsx"',
    },
  });
}
