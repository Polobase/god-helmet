# KiCad-side helper for tools/pcb (run with KiCad's bundled Python, which has pcbnew; the rest of
# the PCB flow is TypeScript). kicad-cli has no Specctra export/import and no board construction,
# so these few steps use KiCad's own API:
#   info  <in.json> <out.json>   pads and courtyard (grown to cover the silkscreen) of footprints
#                                (rotation 0, top side)
#   build <job.json>             placed, unrouted board with nets, outline and no tracks; 2 or 4 copper layers
#                                ("copperLayers"), and the inner planes of a 4-layer board ("planes"), unfilled
#   fanout <board> <job.json>    a locked via and track beside every SMD pad on a plane's net (4-layer boards)
#   dsn   <board> <out.dsn>      Specctra DSN for Freerouting
#   ses   <board> <in.ses> <job.json>  import the routed session, add the pours (GND on both outer layers, or
#                                the job's "pours"), fill, save
#   copper <board> <job.json>    scripted copper instead of the autorouter: the job's zones (any net, any copper
#                                layer), tracks, vias, zone keep-outs, silkscreen text and drawings; fill, save
# Units in the JSON files are mm; board coordinates are KiCad's (y down).
import json
import os
import sys

import pcbnew

MM = pcbnew.FromMM


def mm(v):
    return round(pcbnew.ToMM(v), 6)


def load_fp(lib_dir, lib, name):
    fp = pcbnew.FootprintLoad(os.path.join(lib_dir, lib + ".pretty"), name)
    if fp is None:
        raise SystemExit(f"footprint {lib}:{name} not found in {lib_dir}")
    fp.SetFPID(pcbnew.LIB_ID(lib, name))
    return fp


def cmd_info(src, out):
    req = json.load(open(src))
    res = {}
    for item in req["footprints"]:
        fp = load_fp(req["libDir"], item["lib"], item["name"])
        court = fp.GetCourtyard(pcbnew.F_CrtYd)
        cy = court.BBox()
        # The courtyard's own outlines too: a part that hangs over the board edge (a module's antenna) blocks only
        # what lies on the board.
        outlines = []
        for i in range(court.OutlineCount()):
            o = court.Outline(i)
            outlines.append([{"x": mm(o.CPoint(j).x), "y": mm(o.CPoint(j).y)} for j in range(o.PointCount())])
        # Silkscreen graphics can reach past the courtyard (pin-1 marks): report their extent too.
        for g in fp.GraphicalItems():
            if g.GetLayer() == pcbnew.F_SilkS:
                cy.Merge(g.GetBoundingBox())
        pads = []
        for p in fp.Pads():
            pos = p.GetPosition()
            size = p.GetSize(pcbnew.F_Cu)
            pads.append({
                "number": p.GetNumber(),
                "x": mm(pos.x), "y": mm(pos.y),
                "w": mm(size.x), "h": mm(size.y),
                "drill": mm(p.GetDrillSize().x),
                "smd": p.GetAttribute() == pcbnew.PAD_ATTRIB_SMD,
            })
        res[f'{item["lib"]}:{item["name"]}'] = {
            "pads": pads,
            "courtyard": {"x0": mm(cy.GetX()), "y0": mm(cy.GetY()), "x1": mm(cy.GetRight()), "y1": mm(cy.GetBottom())},
            "outlines": outlines,
        }
    json.dump(res, open(out, "w"), indent=1)


def set_copper_layers(board, count, signal_inner=()):
    """2 copper layers (KiCad's default for a new board) or 4: F.Cu, In1.Cu, In2.Cu, B.Cu. On a 4-layer
    board the inner layers are typed "power" (planes): KiCad's Specctra export then marks them so, and
    Freerouting routes on the outer layers only (docs/pcb.md "4-layer boards"). An inner layer named in
    `signal_inner` is typed "signal" instead, and Freerouting routes on it too."""
    if count == 2:
        return
    if count != 4:
        raise SystemExit(f"copper layers: {count} (2 or 4)")
    board.SetCopperLayerCount(4)
    for layer in (pcbnew.In1_Cu, pcbnew.In2_Cu):
        signal = pcbnew.BOARD.GetStandardLayerName(layer) in signal_inner
        board.SetLayerType(layer, pcbnew.LT_SIGNAL if signal else pcbnew.LT_POWER)


def cmd_build(job_path):
    job = json.load(open(job_path))
    board = pcbnew.NewBoard(job["board"])
    set_copper_layers(board, job.get("copperLayers", 2), job.get("signalInner", []))
    nets = {}
    for name in job["nets"]:
        n = pcbnew.NETINFO_ITEM(board, name)
        board.Add(n)
        nets[name] = n
    o = job["outline"]
    rect = pcbnew.PCB_SHAPE(board)
    rect.SetShape(pcbnew.SHAPE_T_RECT)
    rect.SetStart(pcbnew.VECTOR2I(MM(o["x0"]), MM(o["y0"])))
    rect.SetEnd(pcbnew.VECTOR2I(MM(o["x1"]), MM(o["y1"])))
    rect.SetLayer(pcbnew.Edge_Cuts)
    rect.SetWidth(MM(0.1))
    board.Add(rect)
    for f in job["footprints"]:
        fp = load_fp(job["libDir"], f["lib"], f["name"])
        fp.SetReference(f["ref"])
        fp.SetValue(f["value"])
        if f.get("path"):
            # A part on a page of a hierarchical schematic: "/<sheet uuid>/<symbol uuid>", the page's sheet name
            # ("/Power/") and file, as Update PCB from Schematic sets them.
            fp.SetPath(pcbnew.KIID_PATH(f["path"]))
            fp.SetSheetfile(f["sheetfile"])
            fp.SetSheetname(f["sheetname"])
        elif f.get("uuid"):
            fp.SetPath(pcbnew.KIID_PATH("/" + f["uuid"]))
            fp.SetSheetfile(job["sheetfile"])
            fp.SetSheetname("")
        # Every symbol field, so schematic parity finds no field mismatch; existing footprint
        # fields (Datasheet, Description) take the symbol's value.
        for k, v in f.get("fields", {}).items():
            field = fp.GetField(k) if fp.HasField(k) else None
            if field is None:
                field = pcbnew.PCB_FIELD(fp, fp.GetNextFieldOrdinal(), k)
                field.SetLayer(pcbnew.F_Fab)
                fp.Add(field)
            field.SetText(v)
            field.SetVisible(False)
        board.Add(fp)
        fp.SetPosition(pcbnew.VECTOR2I(MM(f["x"]), MM(f["y"])))
        if f.get("side") == "bottom":
            fp.Flip(fp.GetPosition(), pcbnew.FLIP_DIRECTION_LEFT_RIGHT)
        fp.SetOrientationDegrees(f.get("rot", 0))
        # Reference designators on the fab layer: JLCPCB places from the CPL, and on a board this
        # dense silkscreen references would overlap pads and each other.
        fp.Reference().SetLayer(pcbnew.B_Fab if f.get("side") == "bottom" else pcbnew.F_Fab)
        for p in fp.Pads():
            net = f.get("pads", {}).get(p.GetNumber())
            if net:
                p.SetNet(nets[net])
    # Inner planes of a 4-layer board go in before routing: the Specctra export hands them to Freerouting,
    # which then reaches a plane's net through a via instead of a track. They are filled after routing.
    for z in job.get("planes", []):
        if z["net"] not in nets:
            raise SystemExit(f"net {z['net']} is not on the board")
        add_zone(board, nets[z["net"]], CU_LAYERS[z["layer"]], z["points"],
                 z.get("clearance", job["pour"]["clearance"]), z.get("minWidth", job["pour"]["minWidth"]),
                 z.get("pads", "tht-thermal"), z.get("priority", 0))
    # Areas no track, via or zone enters (an isolation gap), on the given layers: the Specctra export hands them to
    # Freerouting as keep-outs. Pads and footprints stay allowed (a part that straddles the gap).
    for k in job.get("routeKeepouts", []):
        for name in k["layers"]:
            area = pcbnew.ZONE(board)
            area.SetIsRuleArea(True)
            area.SetLayer(CU_LAYERS[name])
            area.SetDoNotAllowZoneFills(True)
            area.SetDoNotAllowTracks(True)
            area.SetDoNotAllowVias(True)
            area.SetDoNotAllowPads(False)
            area.SetDoNotAllowFootprints(False)
            area.Outline().NewOutline()
            for x, y in k["points"]:
                area.Outline().Append(MM(x), MM(y))
            board.Add(area)
    pcbnew.SaveBoard(job["board"], board)
    # Report where every pad landed (the placer's check).
    placed = {}
    for fp in board.GetFootprints():
        placed[fp.GetReference()] = [{"number": p.GetNumber(), "x": mm(p.GetPosition().x), "y": mm(p.GetPosition().y)} for p in fp.Pads()]
    json.dump(placed, open(job["board"] + ".pads.json", "w"))


def cmd_dsn(board_path, out):
    board = pcbnew.LoadBoard(board_path)
    if not pcbnew.ExportSpecctraDSN(board, out):
        raise SystemExit("Specctra DSN export failed")


CU_LAYERS = {"F.Cu": pcbnew.F_Cu, "In1.Cu": pcbnew.In1_Cu, "In2.Cu": pcbnew.In2_Cu, "B.Cu": pcbnew.B_Cu}
SILK_LAYERS = {"F.SilkS": pcbnew.F_SilkS, "B.SilkS": pcbnew.B_SilkS}
# "tht-thermal": thermal reliefs for through-hole pads (hand or wave soldered), solid for SMD pads (a
# small SMD pad left with one spoke is a starved thermal). "solid": every pad joins the zone directly
# (heavy current; harder to solder by hand). "thermal": reliefs on every pad.
PAD_CONNECTIONS = {
    "tht-thermal": pcbnew.ZONE_CONNECTION_THT_THERMAL,
    "solid": pcbnew.ZONE_CONNECTION_FULL,
    "thermal": pcbnew.ZONE_CONNECTION_THERMAL,
}


def find_net(board, name):
    net = board.FindNet(name)
    if net is None:
        raise SystemExit(f"net {name} is not on the board")
    return net


def add_zone(board, net, layer, pts, clearance, min_width, pads="tht-thermal", priority=0):
    z = pcbnew.ZONE(board)
    z.SetLayer(layer)
    z.SetNet(net)
    z.Outline().NewOutline()
    for x, y in pts:
        z.Outline().Append(MM(x), MM(y))
    z.SetLocalClearance(MM(clearance))
    z.SetMinThickness(MM(min_width))
    z.SetAssignedPriority(priority)
    z.SetPadConnection(PAD_CONNECTIONS[pads])
    z.SetThermalReliefGap(MM(0.3))
    z.SetThermalReliefSpokeWidth(MM(0.4))
    z.SetIslandRemovalMode(pcbnew.ISLAND_REMOVAL_MODE_ALWAYS)
    board.Add(z)
    return z


def add_pours(board, job):
    pour = job["pour"]
    if "pours" in job:
        # The spec's own pours (a board with more than one ground): each on its net, layer and shape.
        for z in job["pours"]:
            add_zone(board, find_net(board, z["net"]), CU_LAYERS[z["layer"]], z["points"],
                     z.get("clearance", pour["clearance"]), z.get("minWidth", pour["minWidth"]),
                     z.get("pads", "tht-thermal"), z.get("priority", 0))
        return
    gnd = board.FindNet("GND")
    o = job["outline"]
    inset = pour["edgeClearance"]
    pts = [(o["x0"] + inset, o["y0"] + inset), (o["x1"] - inset, o["y0"] + inset), (o["x1"] - inset, o["y1"] - inset), (o["x0"] + inset, o["y1"] - inset)]
    for layer in (pcbnew.F_Cu, pcbnew.B_Cu):
        add_zone(board, gnd, layer, pts, pour["clearance"], pour["minWidth"])


def box_gap(box, x, y):
    """Distance in mm from a point to an axis-aligned box (0 inside it)."""
    dx = max(mm(box.GetLeft()) - x, 0, x - mm(box.GetRight()))
    dy = max(mm(box.GetTop()) - y, 0, y - mm(box.GetBottom()))
    return (dx * dx + dy * dy) ** 0.5


def cmd_fanout(board_path, job_path):
    """A via beside every SMD pad on a plane's net, joined to the pad by a short track: Freerouting does not
    reach a plane from an SMD pad by itself (Freerouting 2.4.1, tried 2026-11-12: it left them unrouted, also with
    its fanout stage on). Through-hole pads join the plane directly. The vias and tracks are locked, so the
    Specctra export marks them fixed and Freerouting routes around them. A pad with no free spot stops the run."""
    job = json.load(open(job_path))
    board = pcbnew.LoadBoard(board_path)
    via = job["planeVia"]
    plane_nets = {z["net"] for z in job.get("planes", [])}
    o = job["outline"]
    edge = job["pour"]["edgeClearance"]
    r = via["diameter"] / 2
    gap = via["clearance"]
    half_track = via["track"] / 2
    # Pads by reference, number and position: SWIG hands out a new Python object for the same pad on every call,
    # and two copies of a library footprint may carry the same pad UUIDs.
    pad_key = lambda fp, p: (fp.GetReference(), p.GetNumber(), p.GetPosition().x, p.GetPosition().y)
    # Only pads with copper: a footprint's paste-only apertures (no number, no net) are no obstacle.
    boxes = [(pad_key(fp, p), p.GetBoundingBox(), p.GetNetname()) for fp in board.GetFootprints() for p in fp.Pads() if p.IsOnCopperLayer()]
    vias = []  # (x, y, net) of the vias placed so far
    failed = []
    # Parts whose plane vias are tried under their body first (a 0.5 mm pitch row of alternating plane and signal
    # pins) or at 45° first (a corner pin between two pins of another net).
    first = job.get("planeViaFirst", {})
    joined = 0  # pads joined by a track alone (to an exposed pad, or to a neighbour's via)
    # Route keep-outs (an isolation gap): no via or track of the fan-out inside them (their bounding boxes).
    keep = []
    for k in job.get("routeKeepouts", []):
        xs = [p[0] for p in k["points"]]
        ys = [p[1] for p in k["points"]]
        keep.append((min(xs), min(ys), max(xs), max(ys)))

    def in_keepout(x, y, margin):
        return any(x0 - margin < x < x1 + margin and y0 - margin < y < y1 + margin for x0, y0, x1, y1 in keep)

    def track_clear(fp, pad, near, x, y, via_end):
        # A track from the pad's centre to (x, y) clears the keep-outs, the other nets' vias and every other pad
        # (the pad itself and the pads of its own footprint on its net may be touched: a stacked twin, an exposed
        # pad). With via_end, (x, y) is a new via, which must also clear those pads by its radius.
        c = pad.GetPosition()
        cx, cy = mm(c.x), mm(c.y)
        steps = max(12, int(((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / 0.1))
        samples = [(cx + (x - cx) * i / steps, cy + (y - cy) * i / steps) for i in range(steps + 1)]
        if any(in_keepout(tx, ty, half_track) for tx, ty in samples[1:]):
            return False
        net = pad.GetNetname()
        for vx, vy, vn in vias:
            if vn != net and any(((tx - vx) ** 2 + (ty - vy) ** 2) ** 0.5 < r + half_track + gap for tx, ty in samples):
                return False
        own = pad_key(fp, pad)
        for q, box, same in near:
            if q == own or (q[0] == own[0] and same == net):
                continue
            if via_end and box_gap(box, x, y) < r + gap:
                return False
            if any(box_gap(box, tx, ty) < half_track + gap for tx, ty in samples):
                return False
        return True

    def free(fp, pad, near, x, y):
        # A new via: inside the board, clear of every via placed so far (any net: drill to drill) and of the
        # keep-outs, and its track and itself clear of the other pads.
        if not (o["x0"] + edge + r <= x <= o["x1"] - edge - r and o["y0"] + edge + r <= y <= o["y1"] - edge - r):
            return False
        if any(((x - vx) ** 2 + (y - vy) ** 2) ** 0.5 < 2 * r + gap for vx, vy, _ in vias):
            return False
        if in_keepout(x, y, r):
            return False
        return track_clear(fp, pad, near, x, y, True)

    def add_track(pad, x, y):
        t = pcbnew.PCB_TRACK(board)
        t.SetStart(pad.GetPosition())
        t.SetEnd(pcbnew.VECTOR2I(MM(x), MM(y)))
        t.SetWidth(MM(via["track"]))
        t.SetLayer(pcbnew.F_Cu if pad.IsOnLayer(pcbnew.F_Cu) else pcbnew.B_Cu)
        t.SetNet(pad.GetNet())
        t.SetLocked(True)
        board.Add(t)

    def to_exposed_pad(fp, pad, near, drilled):
        # A pin beside an exposed pad on its own net that has thermal vias: a short track straight in along the
        # pin's long axis, into the exposed pad. No via is needed, and the space outside the part stays free.
        net = pad.GetNetname()
        c = pad.GetPosition()
        cx, cy = mm(c.x), mm(c.y)
        b = pad.GetBoundingBox()
        horizontal = b.GetWidth() >= b.GetHeight()
        fc = fp.GetPosition()
        for ep in fp.Pads():
            if ep.GetAttribute() != pcbnew.PAD_ATTRIB_SMD or ep.GetNumber() not in drilled or ep.GetNetname() != net:
                continue
            e = ep.GetBoundingBox()
            x0, x1, y0, y1 = mm(e.GetLeft()), mm(e.GetRight()), mm(e.GetTop()), mm(e.GetBottom())
            if horizontal:
                if not (y0 + half_track <= cy <= y1 - half_track) or x0 <= cx <= x1:
                    continue
                x, y = (x0 + half_track if cx < x0 else x1 - half_track), cy
                if (x - cx) * (mm(fc.x) - cx) <= 0:
                    continue
            else:
                if not (x0 + half_track <= cx <= x1 - half_track) or y0 <= cy <= y1:
                    continue
                x, y = cx, (y0 + half_track if cy < y0 else y1 - half_track)
                if (y - cy) * (mm(fc.y) - cy) <= 0:
                    continue
            if track_clear(fp, pad, near, x, y, False):
                return (x, y)
        return None

    def shared_via(fp, pad, near):
        # The last resort: a via of the pad's own net placed for a neighbour, within 1.5 mm.
        c = pad.GetPosition()
        cx, cy = mm(c.x), mm(c.y)
        net = pad.GetNetname()
        for vx, vy, vn in sorted(vias, key=lambda v: (v[0] - cx) ** 2 + (v[1] - cy) ** 2):
            if vn != net:
                continue
            if ((vx - cx) ** 2 + (vy - cy) ** 2) ** 0.5 > 1.5:
                break
            if track_clear(fp, pad, near, vx, vy, False):
                return (vx, vy)
        return None

    fps = {fp.GetReference(): fp for fp in board.GetFootprints()}
    missing = sorted(set(first) - set(fps))
    if missing:
        raise SystemExit(f"plane vias: planeViaFirst names {', '.join(missing)}, not on the board")
    for fp in sorted(fps.values(), key=lambda f: f.GetReference()):
        centre = fp.GetPosition()
        # An exposed pad with thermal vias (plated holes numbered as the pad) reaches the plane through them.
        drilled = {p.GetNumber() for p in fp.Pads() if p.GetAttribute() == pcbnew.PAD_ATTRIB_PTH}
        for pad in sorted(fp.Pads(), key=lambda p: p.GetNumber()):
            if pad.GetAttribute() != pcbnew.PAD_ATTRIB_SMD or pad.GetNetname() not in plane_nets:
                continue
            if pad.GetNumber() in drilled:
                continue
            box = pad.GetBoundingBox()
            c = pad.GetPosition()
            cx, cy = mm(c.x), mm(c.y)
            hx, hy = mm(box.GetWidth()) / 2, mm(box.GetHeight()) / 2
            # Away from the part's centre first (towards it for a part marked "inward"), then the other
            # directions; the diagonals last (first for a part marked "diagonal").
            mode = first.get(fp.GetReference())
            out = (cx - mm(centre.x), cy - mm(centre.y))
            if mode == "inward":
                out = (-out[0], -out[1])
            dirs = sorted([(1, 0), (-1, 0), (0, 1), (0, -1)], key=lambda d: -(d[0] * out[0] + d[1] * out[1]))
            s2 = 0.5 ** 0.5
            diags = sorted([(s2, s2), (s2, -s2), (-s2, s2), (-s2, -s2)], key=lambda d: -(d[0] * out[0] + d[1] * out[1]))
            extras = (0.0, 0.25, 0.5, 0.8, 1.2, 1.8, 2.5)
            # Only pads within reach of the farthest candidate can be in the way.
            reach_max = max(hx, hy) + gap + 2 * r + extras[-1] + gap
            near = [(q, b, n) for q, b, n in boxes if box_gap(b, cx, cy) <= reach_max]
            ep = to_exposed_pad(fp, pad, near, drilled) if drilled else None
            if ep:
                add_track(pad, *ep)
                joined += 1
                continue
            spot = None
            # The four directions at growing distance (the first try of every board), then the diagonals.
            straight = [(e, d) for e in extras for d in dirs]
            diagonal = [(e, d) for e in extras for d in diags]
            tries = diagonal + straight if mode == "diagonal" else straight + diagonal
            for extra, (dx, dy) in tries:
                reach = (hx if dx and not dy else hy if dy and not dx else max(hx, hy)) + gap + r + extra
                x, y = round(cx + dx * reach, 4), round(cy + dy * reach, 4)
                if free(fp, pad, near, x, y):
                    spot = (x, y)
                    break
            if not spot:
                shared = shared_via(fp, pad, near)
                if shared:
                    add_track(pad, *shared)
                    joined += 1
                    continue
                failed.append(f"{fp.GetReference()}.{pad.GetNumber()} ({pad.GetNetname()})")
                continue
            vias.append((spot[0], spot[1], pad.GetNetname()))
            add_track(pad, *spot)
            v = pcbnew.PCB_VIA(board)
            v.SetViaType(pcbnew.VIATYPE_THROUGH)
            v.SetPosition(pcbnew.VECTOR2I(MM(spot[0]), MM(spot[1])))
            v.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu)
            v.SetFrontWidth(MM(via["diameter"]))
            v.SetDrill(MM(via["drill"]))
            v.SetNet(pad.GetNet())
            v.SetLocked(True)
            board.Add(v)
    if failed:
        raise SystemExit(f"plane vias: no free spot beside {', '.join(failed)} (give these parts more room, or a smaller planeVia)")
    pcbnew.SaveBoard(board_path, board)
    json.dump({"vias": len(vias), "joined": joined}, open(board_path + ".fanout.json", "w"))


def cmd_ses(board_path, ses, job_path):
    job = json.load(open(job_path))
    board = pcbnew.LoadBoard(board_path)
    if not pcbnew.ImportSpecctraSES(board, ses):
        raise SystemExit("Specctra SES import failed")
    # Freerouting routes on the signal layers only (the inner layers of a 4-layer board are typed "power", unless
    # the job names them in "signalInner").
    signal = set(job.get("signalInner", []))
    planes = [l for l, name in ((pcbnew.In1_Cu, "In1.Cu"), (pcbnew.In2_Cu, "In2.Cu")) if name not in signal]
    inner = [t for t in board.GetTracks() if t.GetLayer() in planes and t.Type() != pcbnew.PCB_VIA_T]
    if inner:
        raise SystemExit(f"Specctra SES import: {len(inner)} tracks on an inner plane layer")
    apply_solid_pads(board, job)
    add_pours(board, job)
    pcbnew.ZONE_FILLER(board).Fill(board.Zones())
    pcbnew.SaveBoard(board_path, board)


def apply_solid_pads(board, job):
    """Pads of the listed parts join their zones without thermal reliefs (terminals and inductors that carry a
    whole rail, thermal vias). An entry "REF.PAD" names one pad of a part (all its pads of that number)."""
    solid = set(job.get("solidPads", []))
    found = set()
    for fp in board.GetFootprints():
        ref = fp.GetReference()
        for p in fp.Pads():
            one = f"{ref}.{p.GetNumber()}"
            if ref in solid or one in solid:
                p.SetLocalZoneConnection(pcbnew.ZONE_CONNECTION_FULL)
                found.add(ref if ref in solid else one)
    missing = sorted(solid - found)
    if missing:
        raise SystemExit(f"solidPads: not on the board: {', '.join(missing)}")


def cmd_copper(board_path, job_path):
    """Scripted copper (the job's "copper" and "silk"): everything the autorouter and the GND pours
    would otherwise add. The caller's DRC run is the check: an unreached pad is an unconnected item."""
    job = json.load(open(job_path))
    board = pcbnew.LoadBoard(board_path)
    copper = job.get("copper", {})
    pour = job["pour"]
    apply_solid_pads(board, job)
    for z in copper.get("zones", []):
        add_zone(board, find_net(board, z["net"]), CU_LAYERS[z["layer"]], z["points"],
                 z.get("clearance", pour["clearance"]), z.get("minWidth", pour["minWidth"]),
                 z.get("pads", "tht-thermal"), z.get("priority", 0))
    for k in copper.get("keepouts", []):
        # A rule area that only keeps zone fills out; tracks, vias and pads stay allowed.
        for name in k["layers"]:
            area = pcbnew.ZONE(board)
            area.SetIsRuleArea(True)
            area.SetLayer(CU_LAYERS[name])
            area.SetDoNotAllowZoneFills(True)
            area.SetDoNotAllowTracks(False)
            area.SetDoNotAllowVias(False)
            area.SetDoNotAllowPads(False)
            area.SetDoNotAllowFootprints(False)
            area.Outline().NewOutline()
            for x, y in k["points"]:
                area.Outline().Append(MM(x), MM(y))
            board.Add(area)
    for t in copper.get("tracks", []):
        net = find_net(board, t["net"])
        for (x0, y0), (x1, y1) in zip(t["points"], t["points"][1:]):
            seg = pcbnew.PCB_TRACK(board)
            seg.SetStart(pcbnew.VECTOR2I(MM(x0), MM(y0)))
            seg.SetEnd(pcbnew.VECTOR2I(MM(x1), MM(y1)))
            seg.SetWidth(MM(t["width"]))
            seg.SetLayer(CU_LAYERS[t["layer"]])
            seg.SetNet(net)
            board.Add(seg)
    for v in copper.get("vias", []):
        via = pcbnew.PCB_VIA(board)
        via.SetViaType(pcbnew.VIATYPE_THROUGH)
        via.SetPosition(pcbnew.VECTOR2I(MM(v["x"]), MM(v["y"])))
        via.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu)
        via.SetFrontWidth(MM(v["diameter"]))
        via.SetDrill(MM(v["drill"]))
        via.SetNet(find_net(board, v["net"]))
        board.Add(via)
    add_silk(board, job)
    pcbnew.ZONE_FILLER(board).Fill(board.Zones())
    pcbnew.SaveBoard(board_path, board)


def add_silk(board, job):
    """Silkscreen of a scripted layout: the job's "silk" (text) and "art" (lines, rings, dots, polygons)."""
    for s in job.get("silk", []):
        text = pcbnew.PCB_TEXT(board)
        text.SetText(s["text"])
        text.SetLayer(SILK_LAYERS[s.get("layer", "F.SilkS")])
        text.SetPosition(pcbnew.VECTOR2I(MM(s["x"]), MM(s["y"])))
        text.SetTextSize(pcbnew.VECTOR2I(MM(s["size"]), MM(s["size"])))
        text.SetTextThickness(MM(s["size"] * 0.15))
        text.SetTextAngleDegrees(s.get("rot", 0))
        text.SetHorizJustify(pcbnew.GR_TEXT_H_ALIGN_CENTER)
        text.SetVertJustify(pcbnew.GR_TEXT_V_ALIGN_CENTER)
        if s.get("layer") == "B.SilkS":
            text.SetMirrored(True)
        board.Add(text)
    pt = lambda p: pcbnew.VECTOR2I(MM(p[0]), MM(p[1]))
    for a in job.get("art", []):
        shape = pcbnew.PCB_SHAPE(board)
        shape.SetLayer(SILK_LAYERS[a.get("layer", "F.SilkS")])
        kind = a["kind"]
        if kind == "line":
            shape.SetShape(pcbnew.SHAPE_T_SEGMENT)
            shape.SetStart(pt(a["a"]))
            shape.SetEnd(pt(a["b"]))
            shape.SetWidth(MM(a["width"]))
        elif kind in ("ring", "dot"):
            # A circle is its centre and a point on it; a dot is the same circle, filled, without a stroke.
            shape.SetShape(pcbnew.SHAPE_T_CIRCLE)
            shape.SetCenter(pt(a["c"]))
            shape.SetEnd(pt([a["c"][0] + a["r"], a["c"][1]]))
            shape.SetWidth(MM(a["width"]) if kind == "ring" else 0)
            shape.SetFilled(kind == "dot")
        elif kind == "poly":
            shape.SetShape(pcbnew.SHAPE_T_POLY)
            shape.SetPolyPoints([pt(p) for p in a["points"]])
            shape.SetWidth(0)
            shape.SetFilled(True)
        else:
            raise SystemExit(f"art: unknown kind {kind}")
        board.Add(shape)


if __name__ == "__main__":
    cmd, *args = sys.argv[1:]
    {"info": cmd_info, "build": cmd_build, "fanout": cmd_fanout, "dsn": cmd_dsn, "ses": cmd_ses, "copper": cmd_copper}[cmd](*args)
