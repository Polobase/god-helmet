// Vendor SPICE models: downloaded on demand into the gitignored models/ folder, never committed.
// TI's terms allow reproduction "solely for non-commercial or personal use" and use of design
// resources "only for development of an application that uses the TI products described"
// (https://www.ti.com/legal/terms-of-use.html; datasheet Important Notice). Fetching at build time
// for designs that use these TI parts stays inside that grant; redistributing them would not.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { unzipSync } from "fflate";
import { sha256 } from "../lib/hash.ts";
import { paths } from "../lib/paths.ts";

export const MODELS_DIR = join(paths.root, "models");

export interface ModelSource {
  id: string;
  url: string;
  /** sha256 of the archive as downloaded on 2026-09-24; a mismatch means TI changed the model. */
  sha256: string;
  /** archive path -> file name in models/ */
  extract: Record<string, string>;
  note: string;
}

export const MODELS: ModelSource[] = [
  {
    id: "SLOM513",
    url: "https://www.ti.com/lit/zip/SLOM513",
    sha256: "6d604a14846ebabd2fdb95bd9d576849d714e07576eb3e007a0fe6d72c88fdb6",
    extract: { "tl07xh_tl08xh.lib": "tl07xh.lib" },
    note: "TL07xH/TL08xH (Rev. B 2021-08-20), subckt TL07XH_TL08XH IN+ IN- VCC VEE OUT",
  },
  {
    id: "SLVM071",
    url: "https://www.ti.com/lit/zip/SLVM071",
    sha256: "4088a3a91d919311cfb1b2096412100ba00a3ce2589c5d5bdb9a8bf475b57003",
    extract: { "TL431_PSPICE_AIO_30NOV2017/TL431_PSPICE/TL431.lib": "tl431.lib" },
    note: "TL431 (AEi, 2017), subckt TL431 cathode ref anode (per the model file)",
  },
  {
    // Downloaded 2026-11-12 for modules/helmet-driver (coil current sources). Model "Final 1.3", 23JUN2022,
    // datasheet SBOS737C (header of OPAx197.LIB).
    id: "SBOMA34",
    url: "https://www.ti.com/lit/zip/SBOMA34",
    sha256: "9e55fcaa23d54cee025dda3fa9872b11c41c531f82e0802c2b93d51e943666e5",
    extract: { "OPAx197.LIB": "opa197.lib" },
    note: "OPAx197 (Final 1.3, 2022-06-23), subckt OPAx197 IN+ IN- VCC VEE OUT",
  },
];

/** Download (if missing or changed) and extract every model; returns the extracted files. */
export async function fetchModels(dir = MODELS_DIR, sources = MODELS): Promise<string[]> {
  mkdirSync(dir, { recursive: true });
  const out: string[] = [];
  for (const m of sources) {
    const targets = Object.values(m.extract).map((f) => join(dir, f));
    if (targets.every((t) => existsSync(t))) {
      out.push(...targets);
      continue;
    }
    const zipPath = join(dir, `${m.id}.zip`);
    let zip: Uint8Array;
    if (existsSync(zipPath) && sha256(readFileSync(zipPath)) === m.sha256) zip = new Uint8Array(readFileSync(zipPath));
    else {
      const res = await fetch(m.url, { redirect: "follow" });
      if (!res.ok) throw new Error(`GET ${m.url}: HTTP ${res.status}`);
      zip = new Uint8Array(await res.arrayBuffer());
      const got = sha256(zip);
      if (got !== m.sha256) throw new Error(`${m.id}: archive sha256 ${got} does not match the pinned ${m.sha256}; TI may have updated the model — review it and update tools/sim/models.ts`);
      writeFileSync(zipPath, zip);
    }
    const files = unzipSync(zip);
    for (const [inner, name] of Object.entries(m.extract)) {
      const key = Object.keys(files).find((k) => k === inner || k.endsWith(`/${inner}`));
      if (!key) throw new Error(`${m.id}: ${inner} not found in the archive`);
      const target = join(dir, name);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, files[key]!);
      out.push(target);
    }
  }
  return out;
}
