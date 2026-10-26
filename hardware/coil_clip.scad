// Coil clip for the 19 x 12 mm levitation coils (M3 ferrite core).
// The coil sits face-down in a cup; a nylon M3 screw goes through the base
// into the core. The flat back takes a Velcro (hook) dot for the headband.
// Print in PETG/PLA, 0.2 mm layers, no supports (cup opening facing up).

coil_d      = 19.0;   // coil outer diameter
coil_h      = 12.0;   // coil height
clearance   = 0.6;    // radial clearance
wall        = 1.6;
base        = 2.0;    // base thickness (adds to coil-to-scalp distance)
lip         = 3.0;    // how far the cup wraps the coil side
screw_d     = 3.4;    // M3 clearance
head_d      = 6.2;    // M3 head counterbore
head_h      = 1.2;
lead_slot_w = 2.5;    // slot for the winding leads
pad_d       = 30.0;   // Velcro pad diameter

$fn = 96;

difference() {
  union() {
    // Velcro pad
    cylinder(d = pad_d, h = base);
    // Cup
    cylinder(d = coil_d + 2 * (clearance + wall), h = base + lip);
  }
  // Coil pocket
  translate([0, 0, base]) cylinder(d = coil_d + 2 * clearance, h = coil_h);
  // Screw hole + counterbore on the pad side
  translate([0, 0, -1]) cylinder(d = screw_d, h = base + 2);
  translate([0, 0, -0.01]) cylinder(d = head_d, h = head_h);
  // Lead slot through the cup wall
  translate([coil_d / 2 - 1, -lead_slot_w / 2, base]) cube([wall + clearance + 3, lead_slot_w, lip + 1]);
}
