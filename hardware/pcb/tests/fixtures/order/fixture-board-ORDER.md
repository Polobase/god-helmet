# fixture-board rev A: one JLCPCB cart

Drag and drop these files at https://cart.jlcpcb.com/quote. One board goes into this cart.
**The tools never upload or order anything.**

## 1. PCB with PCB Assembly — `pcb-with-assembly/`

1. Drop `fixture-board-revA-gerbers.zip` on the quote page.
2. Settings: FR-4, 2 layers, 300 × 40 mm, 1.6 mm, 1 oz outer copper, qty 5, green mask, lead-free HASL, Mark on PCB:
   Remove Mark.
3. Switch on **PCB Assembly**: Economic, assembly side **Top**, qty 2 (Economic allows 2 as the minimum); the other
   three PCBs arrive bare.
4. Upload `fixture-board-revA-bom.csv` (BOM) and `fixture-board-revA-cpl.csv` (CPL).
5. Before this order: **pre-order the TS-1187A parts** (C318884), at least 7 for 2 boards: JLCPCB refunds a shortfall
   of fewer than 3 instead of buying it. They go into your JLCPCB parts stock; JLCPCB confirms the price within 48 h,
   and the PCBA order can use them once they arrived (docs/jlcpcb.md §10).
6. In the parts step, note whether the Extended-part fee is charged on the through-hole lines (docs/jlcpcb.md §14).
7. In the placement preview, check pin 1 of U1 (TL074H) and pin 1 and the side of the header's opening of J1
   (B2B-XH-A).

## 2. Before you pay

- Merchandise at or below about USD 60 ships by Global Standard Direct Line (it takes carts up to USD 65) and stays
  under the CHF 5 Swiss import-tax threshold; above that, import VAT and a clearance fee are due (docs/jlcpcb.md §11).
