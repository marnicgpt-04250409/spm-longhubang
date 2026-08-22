export type ExtractedQuestion = {
  prompt: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
};

const clean = (value: string) => value.replace(/\s+/g, " ").trim();

/** Extracts only clearly structured ABCD questions. Ambiguous PDF text stays in review. */
export async function extractAbcdQuestions(pdf: ArrayBuffer): Promise<ExtractedQuestion[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: new Uint8Array(pdf) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
  }
  const source = pages.join("\n").replace(/\s+([ABCD])\s*[.)]/g, "\n$1. ").replace(/(\d+)\s*[.)]/g, "\n$1. ");
  const matcher = /(?:^|\n)\d+\.\s*([\s\S]*?)\nA\.\s*([\s\S]*?)\nB\.\s*([\s\S]*?)\nC\.\s*([\s\S]*?)\nD\.\s*([\s\S]*?)(?=\n\d+\.|$)/g;
  const questions: ExtractedQuestion[] = [];
  for (const match of source.matchAll(matcher)) {
    const [prompt, optionA, optionB, optionC, optionD] = match.slice(1).map(clean);
    if ([prompt, optionA, optionB, optionC, optionD].every(Boolean)) questions.push({ prompt, optionA, optionB, optionC, optionD });
  }
  return questions;
}
