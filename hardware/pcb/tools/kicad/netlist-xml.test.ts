import { expect, test } from "bun:test";
import { footprintPath, parseNetlistXml } from "./netlist-xml.ts";

// Trimmed from kicad-cli 10.0.6 `sch export netlist --format kicadxml` of a schematic with pages.
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<export version="E">
  <components>
    <comp ref="C1">
      <value>100n</value>
      <footprint>GHP_Capacitor_SMD:C_0603_1608Metric</footprint>
      <property name="Sheetname" value="Power"/>
      <property name="Sheetfile" value="pages-proof-power.kicad_sch"/>
      <sheetpath names="/Power/" tstamps="/ce20a77f-c674-53b8-842e-04e3a534251c/"/>
      <tstamps>588a8730-86fa-503d-9481-7ad1350766e1</tstamps>
    </comp>
    <comp ref="R9">
      <value>1k</value>
      <footprint>GHP_Resistor_SMD:R_0603_1608Metric</footprint>
      <sheetpath names="/" tstamps="/"/>
      <tstamps>8681d458-465e-55ed-a8be-b0a3b7810ca4 2aab1c75-c1ed-5da8-85e7-3a57b2edab74</tstamps>
    </comp>
  </components>
  <nets></nets>
</export>`;

test("the sheet path of each component, and the board footprint path Update PCB gives it", () => {
  const [c1, r9] = parseNetlistXml(XML).components;
  expect(c1!.sheetpath).toEqual({ names: "/Power/", tstamps: "/ce20a77f-c674-53b8-842e-04e3a534251c/" });
  expect(c1!.properties.Sheetfile).toBe("pages-proof-power.kicad_sch");
  expect(footprintPath(c1!)).toBe("/ce20a77f-c674-53b8-842e-04e3a534251c/588a8730-86fa-503d-9481-7ad1350766e1");
  // Root sheet: "/<symbol>", the first UUID listed (as before pages existed).
  expect(footprintPath(r9!)).toBe("/8681d458-465e-55ed-a8be-b0a3b7810ca4");
});
