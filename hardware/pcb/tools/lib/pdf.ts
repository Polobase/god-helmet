// Page count of a PDF as KiCad's PDF plotter writes it (kicad-cli 10.0.6: plain object dictionaries, a single
// page tree, only content streams compressed, no object streams). Counted twice, from the page objects and from the
// page tree's /Count, and refused when the two disagree or the file is not of that kind, rather than guessed.

export function pdfPageCount(bytes: Uint8Array): number {
  const text = Buffer.from(bytes).toString("latin1");
  if (!text.startsWith("%PDF-")) throw new Error("not a PDF file");
  if (/\/Type\s*\/ObjStm\b/.test(text)) throw new Error("the PDF uses object streams; its pages cannot be counted without a PDF library");
  const objects = text.match(/\/Type\s*\/Page(?![A-Za-z])/g)?.length ?? 0;
  // The root page tree is the /Pages dictionary that has no /Parent.
  const trees = [...text.matchAll(/<<((?:(?!<<|>>)[\s\S])*?\/Type\s*\/Pages\b[\s\S]*?)>>/g)].map((m) => m[1]!).filter((d) => !/\/Parent\b/.test(d));
  if (trees.length !== 1) throw new Error(`the PDF has ${trees.length} root page trees, expected 1`);
  const count = /\/Count\s+(\d+)/.exec(trees[0]!);
  if (!count) throw new Error("the PDF's page tree has no /Count");
  if (Number(count[1]) !== objects) throw new Error(`the PDF's page tree counts ${count[1]} pages, but it holds ${objects} page objects`);
  return objects;
}
