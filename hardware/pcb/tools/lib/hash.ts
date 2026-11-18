// sha256 as lowercase hex, of text (UTF-8), bytes, or a file's bytes. The one hash helper every tool uses.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const sha256 = (data: string | Uint8Array): string => createHash("sha256").update(data).digest("hex");

export const sha256File = (file: string): string => sha256(readFileSync(file));
