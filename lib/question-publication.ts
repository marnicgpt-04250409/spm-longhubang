type PublicationQuestion = {
  prompt: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  image_path?: string | null;
};

export function questionPublicationIssue(question: PublicationQuestion): string | null {
  const options = [question.option_a, question.option_b, question.option_c, question.option_d];
  if (options.some((option) => !option?.trim() || /^Pilihan\s+[ABCD](?:\s+dalam\s+rajah)?[.\s]*$/i.test(option.trim()))) {
    return "四个选项必须填写完整，不能使用 Pilihan A/B/C/D 占位文字。";
  }
  if (new Set(options.map((option) => option.trim().toLowerCase())).size !== 4) {
    return "四个选项不能重复。";
  }
  const requiresDiagram = /\b(?:rajah|diagram|figure|gambar)\s+(?:\d+|[A-Z]\b|menunjukkan|shows?|di\s+(?:atas|bawah)|berikut|above|below)/i.test(question.prompt);
  const refersToPdf = /rujuk\s+PDF|refer\s+to\s+(?:the\s+)?PDF/i.test(question.prompt);
  if (!question.image_path && (requiresDiagram || refersToPdf)) {
    return "题目引用了图片或 PDF，但尚未附图。请先补上原题图片再发布。";
  }
  return null;
}
