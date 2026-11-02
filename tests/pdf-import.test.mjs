import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const file=new URL("../lib/pdf-question-parser.ts",import.meta.url);
const source=(await readFile(file,"utf8"))
  .replaceAll("import.meta.url",JSON.stringify(file.href))
  .replace('import("pdfjs-dist/legacy/build/pdf.mjs")',`import(${JSON.stringify(import.meta.resolve("pdfjs-dist/legacy/build/pdf.mjs"))})`);
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {extractAbcdQuestions}=await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
function textPdf(lines){
  const escape=text=>text.replaceAll("\\","\\\\").replaceAll("(","\\(").replaceAll(")","\\)");
  const stream="BT /F1 12 Tf 50 790 Td "+lines.map((line,i)=>(i?"0 -22 Td ":"")+`(${escape(line)}) Tj`).join("\n")+" ET";
  const objects=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let pdf="%PDF-1.4\n";const offsets=[0];
  objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${object}\nendobj\n`});
  const xref=Buffer.byteLength(pdf);
  pdf+="xref\n0 6\n0000000000 65535 f \n"+offsets.slice(1).map(offset=>String(offset).padStart(10,"0")+" 00000 n \n").join("")+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf).buffer;
}
test("real text PDF extraction preserves decimals and supports plain ABCD labels",async()=>{
  const questions=await extractAbcdQuestions(textPdf(["Teacher test", "1. What is 2.5 + 1.5?","A. 1.5","B. 2.5","C. 3.5","D. 4.0","2. Which value is largest?","A 0.5","B 1.5","C 2.5","D 3.5"]));
  assert.equal(questions.length,2);
  assert.equal(questions[0].prompt,"What is 2.5 + 1.5?");
  assert.equal(questions[0].optionD,"4.0");
  assert.equal(questions[1].optionA,"0.5");
  assert.equal(questions[1].optionD,"3.5");
});
test("ambiguous text remains unparsed rather than inventing missing options",async()=>{
  assert.deepEqual(await extractAbcdQuestions(textPdf(["1. An incomplete question","A First","B Second","C Third"])),[]);
});
