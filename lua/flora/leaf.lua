-- Leaves: a blade grown around a curved midrib, painted as a watercolor wash
-- with one lit half and white veins.

local G = require("flora.geom")
local W = require("flora.wash")
local Brush = require("flora.brush")
local Tune = require("flora.tune")
local Paint = require("flora.paint")
local pal = Paint.palette

local L = {}
local sin, pi, floor = math.sin, math.pi, math.floor

-- Margin multiplier at fraction t. Serrate teeth lean toward the tip
-- because the width rises slowly through each period and drops sharply at
-- its end. Acanthus lobes (`teeth` of them along a side) swell to a
-- rounded shoulder past their middle, so they sweep toward the tip, with
-- curved recesses between.
-- `jit` perturbs tooth spacing and depth so no two teeth match.
local function margin(kind, t, teeth, depth, jit)
  local fade = G.smoothstep(0.12, 0.28, t) * (1 - G.smoothstep(0.86, 1, t))
  if jit then
    depth = depth * (0.7 + 0.5 * (jit.depth(t * teeth) + 1) / 2)
    t = t + 0.3 * jit.phase(t * teeth * 0.7) / math.max(teeth, 1)
  end
  if kind == "serrate" then
    local u = t * teeth
    local f = u - floor(u)
    return 1 - depth * fade * (1 - f ^ 1.7)
  elseif kind == "acanthus" then
    local ul = t * teeth
    local fl = ul - floor(ul)
    -- Each lobe rises from its recess to a broad, rounded shoulder at 62%
    -- of its length, then rolls over and sweeps down toward the tip into
    -- the next recess.
    local c = 0.62
    local crest = fl < c and sin(pi / 2 * fl / c) ^ 0.8 or 1 - ((fl - c) / (1 - c)) ^ 1.6
    return 1 - fade * depth * (1 - crest)
  elseif kind == "feather" then
    -- A feather lobe swells from its recess, narrows to a soft tip at 78%
    -- of its length and drops back; the outline's sweep (L.outline) then
    -- leans each lobe toward the leaf's tip.
    local ul = t * teeth
    local fl = ul - floor(ul)
    local c = 0.78
    local crest = fl < c and sin(pi / 2 * fl / c) ^ 1.3 or 1 - ((fl - c) / (1 - c)) ^ 0.9
    return 1 - fade * depth * (1 - crest)
  end
  return 1
end

-- Blade half-width at fraction t, as a share of the widest: a short stalk
-- (`STALK` of the length), a tapering wedge-shaped base, the widest point
-- about two fifths of the way up, and a narrowing tip.
local STALK = 0.07
local function blade(t, kp, ep)
  local u = math.max(0, (t - STALK) / (1 - STALK))
  return 0.035 + 0.965 * sin(pi * u ^ kp) ^ ep * G.smoothstep(0, 0.32, u) ^ 0.6
end
L.blade = blade
L.margin = margin

-- Half-width at fraction t of a leaf with options o, as a share of o.width,
-- before its margin is cut.
function L.profile(o, t)
  if o.shape == "lance" then return blade(t, 0.55, 1.05) end
  return blade(t, 0.68, 0.85)
end

-- Outline and midrib in local coordinates: base at the origin, heading +y.
--   o.len, o.width, o.bend (radians over the length), o.hook (tip curl),
--   o.margin ("entire"|"serrate"|"acanthus"|"feather"), o.teeth, o.depth,
--   o.sides ("both"|"left"|"right"), o.shape ("ovate"|"lance"),
--   o.inner (lobe depth on the side o.sides leaves out, as a share of
--   o.depth; default 0, a smooth edge), o.sweep (radians each lobe leans
--   toward the tip at its crest; default 0)
function L.outline(rng, o)
  -- Swept lobes need finer sampling: each drops back into its recess over
  -- about a fifth of its length.
  local n = math.max(48, (o.teeth or 0) * (o.sweep and 16 or 7))
  local spine = G.curve({ 0, 0 }, pi / 2, o.len, o.bend or 0, o.hook or 0, n)
  local nz = G.fbm(rng, 32)
  local jl = { phase = G.noise(rng, 32), depth = G.noise(rng, 32) }
  local jr = { phase = G.noise(rng, 32), depth = G.noise(rng, 32) }
  local al, ar = 1 + rng:jit(0.12), 1 + rng:jit(0.12)
  local left, right = {}, {}
  for i = 1, #spine do
    local t = (i - 1) / (#spine - 1)
    local a = spine[math.max(i - 1, 1)]
    local b = spine[math.min(i + 1, #spine)]
    local nrm = G.angle(a, b) + pi / 2
    local w = o.width * L.profile(o, t) * (1 + 0.06 * nz(t * 6))
    local side = o.sides or "both"
    local depth = o.depth or 0
    local dl = side ~= "right" and depth or depth * (o.inner or 0)
    local dr = side ~= "left" and depth or depth * (o.inner or 0)
    local ml = margin(o.margin, t, o.teeth or 0, dl, jl)
    -- The right side's teeth or lobes sit half a period up from the left's.
    local mr = margin(o.margin, t + 0.5 / math.max(o.teeth or 1, 1), o.teeth or 0, dr, jr)
    -- Swept lobes: on a lobed side, the further a point stands from the
    -- midrib, the more its direction leans toward the tip. The lean grows
    -- in proportion to that distance, so the side never folds back over
    -- itself while sweep * tan(sweep) < 1 (sweep below about 0.86).
    local rl, rr = al * ml * L.profile(o, t), ar * mr * L.profile(o, t)
    local sl = dl > 0 and (o.sweep or 0) * math.min(rl, 1) or 0
    local sr = dr > 0 and (o.sweep or 0) * math.min(rr, 1) or 0
    left[i] = G.polar(spine[i], nrm - sl, w * al * ml)
    right[i] = G.polar(spine[i], nrm + pi + sr, w * ar * mr)
  end
  local out = {}
  for i = 1, #left do out[#out + 1] = left[i] end
  for i = #right - 1, 2, -1 do out[#out + 1] = right[i] end
  return out, spine, left, right
end

local LOOKS = {
  vivid = { pigment = pal.blue, pool = pal.deep, strength = 1.0 },
  deep  = { pigment = pal.deep, pool = pal.ink, strength = 1.0 },
  soft  = { pigment = pal.sky, pool = pal.deep, strength = 0.95 },
}

-- Veins: a white midrib, lateral veins leaning toward the tip, and optional
-- forked "lightning" veinlets. Points are already in page coordinates.
local function veins(pt, rng, spine, edge, size, o)
  local mid = {}
  local n = #spine
  for i = math.max(2, floor(n * 0.03)), floor(n * 0.93) do mid[#mid + 1] = spine[i] end
  -- Veins are broken and vary in contrast, so they sit in the wash rather
  -- than reading as crisp lines drawn over it.
  local cfg = Tune.wash
  local function broken(lines, w, gap, lo, hi)
    for _, line in ipairs(lines) do
      local pieces = Brush.broken(rng, line, w, gap, cfg.brush_dry * 0.5)
      local cmds = {}
      for i, p in ipairs(pieces) do cmds[i] = Brush.polygon(p) end
      if #cmds > 0 then pt:fill(cmds, pal.white, rng:range(lo, hi), { many = true }) end
    end
  end
  broken({ mid }, size * 0.03, 0.08, 0.5, 0.75)
  W.hairlines(pt, { G.transform(mid, size * 0.012, -size * 0.004, 0) }, pal.ink, size * 0.006, 0.35, { blend = "multiply", head = 0.02 })

  local lats, forks = {}, {}
  if o.striate then
    -- A feather's veins are fine pale lines, about three to a lobe, each
    -- running from the midrib out along a lobe toward its tip.
    local fine = {}
    local count = (o.teeth or 6) * 3
    for _, side in ipairs({ edge.left, edge.right }) do
      for k = 1, count do
        local t = 0.1 + 0.82 * (k - 0.5) / count + rng:jit(0.01)
        local i = G.clamp(floor(t * (n - 1)) + 1, 2, n - 1)
        local p0, tip = spine[i], side[math.min(i + floor(n * 0.05), n)]
        local p1 = G.mix(p0, tip, rng:range(0.6, 0.88))
        local m = G.mix(G.mix(p0, p1, 0.5), spine[math.min(i + floor(n * 0.03), n)], 0.2)
        fine[#fine + 1] = G.spline_points({ p0, m, p1 }, 5)
      end
    end
    broken(fine, size * 0.009, cfg.brush_gap, cfg.vein_contrast[1], cfg.vein_contrast[2])
  end
  local count = o.striate and 0 or (o.veins or 6)
  for k = 1, count do
    local t = 0.10 + 0.78 * (k - 0.5) / count + rng:jit(0.03)
    local i = G.clamp(floor(t * (n - 1)) + 1, 2, n - 1)
    for _, side in ipairs({ edge.left, edge.right }) do
      local p0, tip = spine[i], side[math.min(i + floor(n * 0.08), n)]
      local p1 = G.mix(p0, tip, rng:range(0.72, 0.9))
      local m = G.mix(p0, p1, 0.5)
      m = G.mix(m, spine[math.min(i + floor(n * 0.05), n)], 0.25)
      local line = G.spline_points({ p0, m, p1 }, 5)
      lats[#lats + 1] = line
      if o.lightning and rng:chance(0.8) then
        local q, ang = G.at(line, rng:range(0.4, 0.7))
        local f = G.curve(q, ang + rng:jit(0.7), G.dist(p0, p1) * 0.4, rng:jit(0.5), 0, 6)
        forks[#forks + 1] = f
      end
    end
  end
  broken(lats, size * 0.02, cfg.brush_gap, cfg.vein_contrast[1], cfg.vein_contrast[2])
  if #forks > 0 then broken(forks, size * 0.012, cfg.brush_gap, cfg.vein_contrast[1] * 0.7, cfg.vein_contrast[2] * 0.7) end

  -- Engraved hatching: short dark strokes running in from the margin,
  -- slanted toward the base like the veins they shadow.
  local hatch = {}
  local back = math.max(1, floor(n * 0.06))
  for _, side in ipairs({ edge.left, edge.right }) do
    for i = floor(n * 0.08), floor(n * 0.92), 2 do
      local m = side[i]
      local q = G.mix(m, spine[math.max(1, i - back)], rng:range(0.18, 0.38))
      hatch[#hatch + 1] = { m, q }
    end
  end
  W.hairlines(pt, hatch, pal.ink, size * 0.007, 0.32, { blend = "multiply", head = 0.01 })
end

-- Options for a large leaf of length up to `len` heading `ang`, drawn from
-- stream `r`. Kinds follow the reference: most large leaves are feathers
-- (long, arching, lobes swept toward the tip, mostly on the outer curve),
-- a few are broad acanthus leaves lobed on both sides, and the rest are
-- smooth lance leaves. Small leaves are always lance leaves. Lobed leaves
-- mix deep and light lobing.
function L.options(r, len, ang)
  local up = math.cos(ang) < 0 and -1 or 1
  local kind = r:weighted({ feather = 6, acanthus = 1.5, lance = 2.5 })
  if len < 45 then kind = "lance" end
  -- Half the leaves arch over: the blade bends up and the tip droops.
  local droop = r:chance(0.5)
  local deep = r:chance(0.5)
  local o = {
    len = len * r:range(0.85, 1.0), width = len * r:range(Tune.compose.leaf_width[1], Tune.compose.leaf_width[2]),
    bend = up * r:range(0.6, 1.3), hook = (droop and -up or up) * r:range(0.5, 1.4),
    margin = kind == "lance" and "entire" or kind,
    shape = "lance",
    look = r:weighted({ vivid = 3, soft = 2 }),
    veins = r:int(5, 7), lightning = r:chance(0.25),
  }
  if kind == "acanthus" then
    -- Three to six broad lobes a side, on both sides.
    o.teeth, o.depth, o.sides = r:int(3, 6), deep and r:range(0.5, 0.72) or r:range(0.18, 0.32), "both"
    o.width = o.width * 1.25
  elseif kind == "feather" then
    -- Five to eight narrow lobes a side, swept toward the tip, on the
    -- outer side of the arch; the inner side is lobed lightly or not at
    -- all. A feather arches further than other leaves.
    o.teeth = r:int(5, 8)
    o.depth = deep and r:range(0.6, 0.82) or r:range(0.32, 0.45)
    o.sides = up > 0 and "right" or "left"
    o.inner = r:chance(0.6) and r:range(0.2, 0.45) or 0
    o.sweep = r:range(0.5, 0.75)
    o.bend = o.bend * 1.25
    o.width = o.width * 0.85
    o.striate = true
  else
    -- Lance leaves are narrow and bend gently; some curl their tip over.
    o.width = o.width * 0.75
    o.bend = o.bend * 0.5
    if r:chance(0.3) then o.hook = o.hook * 1.6 else o.hook = o.hook * 0.6 end
  end
  return o
end

-- Paint a leaf whose base sits at (x, y), pointing along `ang`.
-- Returns the midrib in page coordinates.
function L.leaf(pt, rng, x, y, ang, o)
  local local_pts, spine, left, right = L.outline(rng, o)
  local rot = ang - pi / 2
  local poly = G.transform(local_pts, x, y, rot)
  spine = G.transform(spine, x, y, rot)
  left = G.transform(left, x, y, rot)
  right = G.transform(right, x, y, rot)
  local look = LOOKS[o.look or "vivid"]
  local size = o.len

  -- The lit half: the midrib plus the right-hand margin.
  local lit = {}
  for i = 1, #spine do lit[#lit + 1] = spine[i] end
  for i = #right, 1, -1 do lit[#lit + 1] = right[i] end

  W.wash(pt, poly, {
    rng = rng, size = size,
    ramp = o.look == "soft" and "soft" or "leaf", axis = { spine[1], spine[#spine] },
    light = G.at(spine, 0.25),
    pigment = look.pigment, pool = look.pool, strength = look.strength,
    rings = 8, lift = 0.035, bleed = o.width * 0.05,
    dark_streaks = 0, streaks = 0,
    -- A leaf reads as solid colour with pale veins, not a streaked petal.
    pale_scale = 0.2, lifts = 0.5, fade_scale = 0.5,
    -- Brushwork runs along the blade, between the midrib and either edge.
    brush_lines = function(r, n)
      local lines = {}
      for _ = 1, n do
        local edge, s = r:chance(0.5) and left or right, r:range(0.15, 0.85)
        local line = {}
        for i = 1, #spine do line[i] = G.mix(spine[i], edge[math.min(i, #edge)], s) end
        lines[#lines + 1] = line
      end
      return lines
    end,
    grain = 0.45, grain_scale = 0.9,
    outline = 0.85, outline_w = math.max(0.28, size * 0.008),
    inner = function(p)
      p:fill(G.smooth(lit, true), pal.white, 0.08)
      veins(p, rng, spine, { left = left, right = right }, size, o)
    end,
  })
  return spine
end

-- Small leaflets along stems. Items: {x, y, ang, len}. Each has the large
-- leaves' blade (L.blade): a stalk, a tapering base and a pointed tip, with
-- a slight bend and an uneven edge. Leaflets are painted like the leaves
-- (a base-to-tip ramp, granulation, a partly lost edge and a pale midrib),
-- scaled to their size; given `rgb`, they are batched flat fills instead
-- (a flower's sepals).
function L.leaflets(pt, rng, items, rgb, opacity)
  local bodies, ribs = {}, {}
  local painted = rgb == nil
  for _, it in ipairs(items) do
    local x, y, ang, len = it[1], it[2], it[3], it[4]
    local pts = {}
    local bend = rng:jit(0.35)
    local wd = len * rng:range(0.17, 0.23)
    local kp, ep = rng:range(0.62, 0.74), rng:range(0.8, 0.95)
    local al, ar = 1 + rng:jit(0.12), 1 + rng:jit(0.12)
    for i = 0, 16 do
      local t = i / 16
      pts[#pts + 1] = { -wd * al * blade(t, kp, ep) + bend * len * t * t, len * t }
    end
    for i = 15, 1, -1 do
      local t = i / 16
      pts[#pts + 1] = { wd * ar * blade(t, kp, ep) + bend * len * t * t, len * t }
    end
    local poly = G.transform(pts, x, y, ang - pi / 2)
    local rib = G.transform({ { 0, len * 0.12 }, { bend * len * 0.25, len * 0.7 } }, x, y, ang - pi / 2)
    if painted then
      local tip = G.transform({ { bend * len, len } }, x, y, ang - pi / 2)[1]
      W.wash(pt, poly, {
        rng = rng, size = len,
        ramp = "leaf", part = "leaflets", axis = { { x, y }, tip }, light = G.mix({ x, y }, tip, 0.3),
        pigment = pal.blue, pool = pal.deep, strength = 1.1,
        rings = 4, lift = 0.02, bleed = len * 0.03,
        dark_streaks = 0, streaks = 0, fade_scale = 0.5, simple = true, grain = 0.5, grain_scale = 0.5,
        outline = 0.75, outline_w = math.max(0.2, len * 0.012),
        inner = function(p)
          p:stroke({ G.polyline(rib) }, pal.white, math.max(0.18, len * 0.03), 0.55)
        end,
      })
    else
      bodies[#bodies + 1] = G.smooth(poly, true)
      ribs[#ribs + 1] = G.polyline(rib)
    end
  end
  if not painted then
    pt:fill(bodies, rgb, opacity or 0.88, { many = true, blend = "multiply" })
    pt:stroke(ribs, pal.white, 0.18, 0.45, { many = true })
  end
end

return L
