import { expect, test } from "bun:test";
import { pdfPageCount } from "./pdf.ts";

// The shape of kicad-cli 10.0.6's PDF: page objects and one page tree, each a plain dictionary.
const pdf = (pages: number, count = pages, extra = "") => {
  const objs = Array.from({ length: pages }, (_, i) => `${10 + i} 0 obj\n<<\n/Type /Page\n/Parent 1 0 R\n/Contents ${20 + i} 0 R\n>>\nendobj\n`);
  const tree = `1 0 obj\n<<\n/Type /Pages\n/Kids [\n${objs.map((_, i) => `${10 + i} 0 R`).join("\n")}\n]\n/Count ${count}\n>>\nendobj\n`;
  return new TextEncoder().encode(`%PDF-1.5\n${objs.join("")}${tree}${extra}2 0 obj\n<< /Type /Outlines /Count 19 >>\nendobj\n%%EOF\n`);
};

test("counts the page objects and checks them against the page tree", () => {
  expect(pdfPageCount(pdf(1))).toBe(1);
  expect(pdfPageCount(pdf(11))).toBe(11);
});

test("refuses what it cannot count reliably", () => {
  expect(() => pdfPageCount(new TextEncoder().encode("hello"))).toThrow("not a PDF file");
  expect(() => pdfPageCount(pdf(3, 4))).toThrow("counts 4 pages, but it holds 3 page objects");
  expect(() => pdfPageCount(pdf(2, 2, "5 0 obj\n<< /Type /ObjStm /N 3 >>\nendobj\n"))).toThrow("object streams");
});
