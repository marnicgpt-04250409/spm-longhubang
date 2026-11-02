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
  const packageRoot = path.dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(packageRoot, "legacy/build/pdf.worker.mjs")).href;
  const document = await pdfjs.getDocument({ data: new Uint8Array(pdf),
    standardFontDataUrl: path.join(packageRoot, "standard_fonts") + path.sep,
    cMapUrl: path.join(packageRoot, "cmaps") + path.sep, cMapPacked: true,
    isEvalSupported: false, useSystemFonts: false,
  }).promise;
  const pages: string[] = [];
  try {
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join(""));
  }
  const source = pages.join("\n").replace(/\r/g, "")
    .replace(/(^|\n)[\t ]*([ABCD])\s*[.)]?[\t ]+(?=\S)/g, "\n$2. ")
    .replace(/\s+([ABCD])\s*[.)](?=\s)/g, "\n$1. ")
    .replace(/(^|\n)[\t ]*(\d+)\s*[.)](?=\s)/g, "\n$2. ");
  const matcher = /(?:^|\n)\d+\.\s*([\s\S]*?)\nA\.\s*([\s\S]*?)\nB\.\s*([\s\S]*?)\nC\.\s*([\s\S]*?)\nD\.\s*([\s\S]*?)(?=\n\d+\.|$)/g;
  const questions: ExtractedQuestion[] = [];
  for (const match of source.matchAll(matcher)) {
    const [prompt, optionA, optionB, optionC, optionD] = match.slice(1).map(clean);
    if ([prompt, optionA, optionB, optionC, optionD].every(Boolean)) questions.push({ prompt, optionA, optionB, optionC, optionD });
  }
  return questions;
  } finally {
    await document.destroy();
  }
}
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

