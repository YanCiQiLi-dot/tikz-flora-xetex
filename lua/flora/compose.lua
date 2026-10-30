-- Composes one page of flora. See layout.lua for the order of passes.

local G = require("flora.geom")
local Rng = require("flora.rng")
local Paint = require("flora.paint")
local Layout = require("flora.layout")
local Fill = require("flora.fill")
local F = require("flora.flower")
local L = require("flora.leaf")
local S = require("flora.sprig")
local O = require("flora.ornament")
local Tune = require("flora.tune")
local Plant = require("flora.plant")
local Brush = require("flora.brush")
local Dist = require("flora.dist")
local pal = Paint.palette

local C = {}
local pi = math.pi

-- Large features in the order they claim space. `r` scales with the margin
-- width; `y` bounds the height band (fractions of the strand span). As in
-- the reference, most gather toward the hero and the foot, leaving the
-- middle of the margin calmer.
local function quota(mw, rng)
  local kr = Tune.compose.features
  local function r(f, lo, hi)
    local k = rng:range(kr[1], kr[2])
    return G.clamp(mw * f * k, lo * k, hi * k)
  end
  return {
    { kind = "lily",  r = r(0.21, 16, 40), y = { 0.45, 0.85 } },
    { kind = "umbel", r = r(0.19, 14, 34), y = { 0.62, 0.98 } },
    { kind = "ghost", r = r(0.22, 16, 42), y = { 0.02, 0.35 } },
    { kind = "soft",  r = r(0.12, 10, 24), y = { 0.70, 0.98 } },
    { kind = "umbel", r = r(0.15, 12, 28), y = { 0.0, 0.3 } },
    { kind = "blue",  r = r(0.10, 8, 20), y = { 0.0, 0.25 } },
    { kind = "soft",  r = r(0.09, 8, 18), y = { 0.55, 0.95 } },
    { kind = "umbel", r = r(0.13, 10, 24), y = { 0.82, 1.0 } },
    { kind = "blue",  r = r(0.09, 8, 18), y = { 0.85, 1.0 } },
    { kind = "blue",  r = r(0.09, 8, 18), y = { 0.0, 0.2 } },
  }
end

local depart = G.depart

-- A branch stem from a strand node to `to`, arriving along `arrive`.
local function branch(slot, to, arrive)
  local dir0 = depart(slot.p, slot.along, to)
  return G.link(slot.p, dir0, to, arrive or G.angle(slot.p, to) + G.turn(G.angle(slot.p, to), dir0) * 0.6)
end

-- A shoot from slot `slot` (on a stem of `stems`) to `to`, steered so it
-- leaves its stem tangentially; the parent narrows by a stalk of full
-- width `w`. Falls back to a Bezier branch if steering cannot reach `to`
-- through open space.
local function stalk(g, stems, slot, to, w, arrive)
  local parent = stems[slot.strand]
  if parent and parent.cum and w then Plant.fork(parent, slot.t, w) end
  local pts = Plant.shoot(slot.p, slot.along, to, 2)
  if pts then
    pts[#pts + 1] = to
    local ok = true
    for i = 1, #pts, 3 do
      if not g:open_at(pts[i][1], pts[i][2]) then ok = false break end
    end
    if ok then return pts end
  end
  return branch(slot, to, arrive)
end

-- Do all points lie in open space?
local function open_path(g, pts)
  for i = 1, #pts, 2 do
    if not g:open_at(pts[i][1], pts[i][2]) then return false end
  end
  return true
end

-- Is a disk of radius R around c clear of text and outside space? Points on
-- its rim and centre are sampled; elements already placed do not count.
local function open_disk(g, c, R)
  if not g:open_at(c[1], c[2]) then return false end
  for k = 0, 15 do
    local q = G.polar(c, k * pi / 8, R)
    if not g:open_at(q[1], q[2]) then return false end
  end
  return true
end

-- Where feature `q` would sit if it took slot `s`.
-- Does spray batch `b` clear the text in grid `g` everywhere? Every
-- vertex, and every floret, bud and star over its whole extent, not just
-- at its centre.
local function fits(g, b)
  local ok = true
  b:each_point(function(x, y, rr)
    if ok and not (g:open_at(x, y) and g:open_at(x - rr, y) and g:open_at(x + rr, y)
        and g:open_at(x, y - rr) and g:open_at(x, y + rr)) then ok = false end
  end)
  return ok
end

local function feature_centre(s, q)
  return G.polar(s.anchor, s.ang, q.r * 0.35)
end

-- Claim the roomiest acceptable slot for feature `q`, or nil. The feature's
-- whole disk must be open, not just its anchor.
local function claim(g, rng, slots, q, ylo, span, placed, dens)
  local best, score
  for _, s in ipairs(slots) do
    local fy = (s.p[2] - ylo) / span
    if not s.used and s.room >= q.r * 0.8 and fy >= q.y[1] and fy <= q.y[2] then
      local far = true
      for _, p in ipairs(placed) do
        if G.dist(s.anchor, p) < 60 + q.r then far = false break end
      end
      local sc = s.room + rng:range(0, 8) + 30 * dens(s.anchor[1], s.anchor[2])
      if far and (not score or sc > score) and open_disk(g, feature_centre(s, q), q.r * 1.1) then
        best, score = s, sc
      end
    end
  end
  return best
end

-- How far a leaf can run from `p` along `ang` before meeting anything.
local function run_length(g, p, ang, maxlen)
  local d = 6
  while d < maxlen do
    local q = G.polar(p, ang, d)
    -- Leaves are painted over the stems, so they may grow across them.
    if g:clearance(q[1], q[2], 6, true) < 3 then break end
    d = d + 4
  end
  return d
end

-- Plan a large leaf of length up to `len` at `p`, heading `ang`, drawn
-- with stream `r`; returns its painter, or nil if even a shrunk blade
-- would reach the text. The leaf keeps a corridor clear of later growth;
-- with `overlap` the corridor narrows and later leaves may cross the blade.
local function place_leaf(g, r, p, ang, len, overlap)
  local o = L.options(r, len, ang)
  -- The blade curls, so check its actual outline (drawn from a clone of
  -- the stream the painter will use), shrinking once if it reaches text.
  for _ = 1, 2 do
    local outline = G.transform((L.outline(r:clone(), o)), p[1], p[2], ang - pi / 2)
    if open_path(g, outline) then
      -- The corridor follows the blade's half-width at overlap 0, so later
      -- leaves stop at its edge instead of crossing it, and may tuck in
      -- beside its narrow stalk and tip.
      local spine = G.curve(p, ang, o.len, o.bend, o.hook, 14)
      local radii = {}
      for i = 1, #spine do
        -- 1.15 covers the blade's per-side jitter (up to 12%) and edge noise.
        radii[i] = 1.15 * o.width * (1 - overlap) * math.max(0.3, L.profile(o, (i - 1) / (#spine - 1)))
      end
      g:reserve_line(spine, radii)
      -- Some lance leaves come in pairs, as the reference's stem leaves do:
      -- a smaller one from the same node, turned aside.
      -- Its choices come from a fork, so the main leaf's stream (already
      -- checked against the text above) is left untouched.
      local mate
      local mr = r:fork("mate")
      if o.margin == "entire" and len < 69 and mr:chance(0.35) then
        local ma = ang + (mr:chance(0.5) and 1 or -1) * mr:range(0.45, 0.7)
        local mo = L.options(mr, len * 0.65, ma)
        local mo_out = G.transform((L.outline(mr:clone(), mo)), p[1], p[2], ma - pi / 2)
        if open_path(g, mo_out) then
          g:reserve_line(G.curve(p, ma, mo.len, mo.bend, mo.hook, 8), mo.width * (1 - overlap) * 0.6)
          mate = { ma, mo, mr }
        end
      end
      return function(pt)
        if mate then L.leaf(pt, mate[3], p[1], p[2], mate[1], mate[2]) end
        L.leaf(pt, r, p[1], p[2], ang, o)
      end
    end
    o.len, o.width = o.len * 0.75, o.width * 0.75
  end
end

-- Plan and paint a page. spec: width, height, text = {x0, y0, x1, y1},
-- optional lines, header_y, seed, edge, and probe(x, y, r), which sees
-- every painted point (tests use it to check nothing lands on text).
function C.page(spec)
  local rng = Rng.new(spec.seed or 1)
  local W = spec.width
  local edge = spec.edge or 16
  local g, m = Layout.region(spec)
  local mw = m.x1 - m.x0
  local top = spec.header_y or spec.text.y1

  local cfg = Tune.compose
  local R = G.clamp(mw * cfg.hero, 28, 80)
  local hero = { G.clamp(m.x0 + mw * 0.5, m.x0 + R * 0.75, m.x1 - R * 0.95), top - R * 0.55, R }
  -- Only the bloom's body is kept clear: foliage may tuck under the rim of
  -- its petals, which paint over it.
  g:reserve(hero[1], hero[2], R * 0.8)

  local gest = Layout.gesture(rng:fork("gesture"), m, hero)
  local dens = gest.density
  -- The cartouche's place, at the reference's size, is kept clear before
  -- the plant grows, so the stems bend around it as the reference's do.
  local ylo, span = m.y0, hero[2] - m.y0
  local py = gest.quiet[1] or ylo + span * 0.5
  local pw, ph = Layout.cartouche_size(mw)
  local strands, root = Layout.strands(rng:fork("strands"), m, hero, W, gest,
    { m.x0, py - ph / 2 - 3, m.x0 + pw + 5, py + ph / 2 + 3 })
  local excursion = Layout.excursion(rng:fork("excursion"), spec, root)
  if excursion then strands[#strands + 1] = excursion end
  local runners = Layout.runners(rng:fork("runners"), m, strands[1].pts[1], W, edge)
  Plant.fork(strands[1], 0.005, 0.8)
  local stems = {}
  local stem_batch, spray_batch = S.batch(), S.batch()
  for _, list in ipairs({ strands, runners }) do
    for _, s in ipairs(list) do
      g:reserve_line(s.pts, 2, 4)
      stems[#stems + 1] = s
    end
  end

  local orn, panel = {}, nil
  do
    -- The star cartouche sits in a quiet stretch, where the stems hug the
    -- outer edge and bend around it.
    -- The panel sits against the outer edge, so its own rectangle (with a
    -- small pad) is tested rather than a disk around its centre. It is
    -- tried at the reference's size first, then smaller.
    for _, k in ipairs({ 1.0, 0.82, 0.66 }) do
      local w, h = Layout.cartouche_size(mw, k)
      local cx = m.x0 + w / 2 + 2
      local fits = true
      for x = cx - w / 2 - 1, cx + w / 2 + 3, 2 do
        for y = py - h / 2 - 3, py + h / 2 + 3, 2 do
          if not g:free(x, y) then fits = false end
        end
      end
      if fits then
        for y = py - h / 2, py + h / 2, w / 2 do g:reserve(cx, y, w * 0.6) end
        local r = rng:fork("panel")
        orn[#orn + 1] = function(pt) O.panel(pt, r, cx - w / 2, py - h / 2, w, h) end
        panel = { cx, py, w, h }
        break
      end
    end
  end
  local slots = Layout.slots(rng:fork("slots"), g, strands, cfg.slot_spacing)
  local back, blooms, leaves = {}, {}, {}
  local placed = { { hero[1], hero[2] } }

  local wanted = quota(mw, rng:fork("feature sizes"))
  if excursion then
    local er = G.clamp(mw * 0.16, 12, 30)
    for _, k in ipairs({ "lily", "blue", "soft", "umbel" }) do
      wanted[#wanted + 1] = { kind = k, r = er, y = { 0.0, 0.6 } }
    end
  end
  for i, q in ipairs(wanted) do
    local s = claim(g, rng, slots, q, ylo, span, placed, dens)
    if s then
      s.used = true
      local r = rng:fork("feature" .. i)
      local c = feature_centre(s, q)
      g:reserve(c[1], c[2], q.r * 1.05)
      placed[#placed + 1] = c
      if q.kind == "lily" then
        local facing = s.ang + s.side * 0.4
        local base = G.polar(c, facing + pi, q.r * 0.42)
        local stem = stalk(g, strands, s, base, 0.8, facing)
        stem_batch:stem(stem, 0.8, 0.45)
        stems[#stems + 1] = { pts = stem }
        blooms[#blooms + 1] = function(pt)
          F.tilted(pt, r, c[1], c[2], q.r, facing, 1.0, { kind = "lance", petals = 6, width = 0.36 })
        end
      elseif q.kind == "umbel" then
        local stem = stalk(g, strands, s, c, nil)
        spray_batch:line(stem, 1)
        stems[#stems + 1] = { pts = stem }
        -- An umbel reaches past its reserved disk, so it shrinks until it
        -- clears the text, and is left off if even the smallest would not.
        local ua = G.angle(stem[#stem - 1], c)
        for try = 0, 3 do
          local tmp = S.batch()
          S.umbel(tmp, r:fork("umbel" .. try), c, ua, q.r * 0.82 ^ try)
          if fits(g, tmp) then spray_batch:merge(tmp) break end
        end
      else
        local stem = stalk(g, strands, s, c, 0.7)
        stem_batch:stem(stem, 0.7, 0.4)
        stems[#stems + 1] = { pts = stem }
        if q.kind == "ghost" then
          back[#back + 1] = function(pt)
            F.bloom(pt, r, c[1], c[2], q.r, { kind = "ghost", look = "ghost", width = 0.55 })
          end
        else
          local style = q.kind == "soft" and "soft" or F.pick_style(r, { "fan", "round" })
          blooms[#blooms + 1] = function(pt) F.bloom(pt, r, c[1], c[2], q.r, { style = style }) end
        end
      end
    end
  end

  -- Leaves on the slots that remain, in a shuffled but seeded order. They
  -- gather where the border is dense and stay small and sparse elsewhere,
  -- so they do not compete with the blooms.
  local order = {}
  for i = 1, #slots do order[i] = i end
  for i = #order, 2, -1 do
    local j = rng:int(1, i)
    order[i], order[j] = order[j], order[i]
  end
  local leaflet_items = {}
  -- Space, not the gate below, is what usually runs out, so quiet stretches
  -- are kept calm by smaller leaves and by a wider gap between leaf bases.
  local bases = {}
  local function crowded(p, dn)
    local gap = 10 + 45 * (1 - dn)
    for _, b in ipairs(bases) do
      if G.dist(p, b) < gap then return true end
    end
  end
  for _, i in ipairs(order) do
    local s = slots[i]
    local dn = dens(s.p[1], s.p[2])
    if not s.used and #leaves < cfg.leaves and rng:next() < dn ^ 1.3 and not crowded(s.p, dn) then
      local len = run_length(g, s.p, s.ang,
        math.min(130, mw * 0.85) * cfg.leaf_size * (0.4 + 0.6 * dn) * Dist.sample(rng, Tune.sizes.leaf))
      if len >= 24 then
        s.used = true
        local paint = place_leaf(g, rng:fork("leaf" .. i), s.p, s.ang, len, cfg.leaf_overlap)
        if paint then
          leaves[#leaves + 1] = paint
          bases[#bases + 1] = s.p
        end
      elseif len >= 14 and rng:chance(0.5) then
        -- A stemlet: a short stalk ending in two or three leaflets.
        local stalk = len * rng:range(0.35, 0.5)
        local curve = G.curve(s.p, s.ang, stalk, s.side * rng:range(0.2, 0.5), 0, 6)
        local tip = curve[#curve]
        local ta = G.angle(curve[#curve - 1], tip)
        local size = math.min((len - stalk) * 0.85, 11)
        s.used = true
        spray_batch:line(curve, 1)
        g:reserve_line(curve, 1.5)
        local spread = rng:range(0.45, 0.7)
        local fan = rng:chance(0.5) and { -spread, spread } or { -spread, 0, spread }
        for _, da in ipairs(fan) do
          leaflet_items[#leaflet_items + 1] = { tip[1], tip[2], ta + da, size * (da == 0 and 1 or 0.8) }
        end
      elseif len >= 10 then
        leaflet_items[#leaflet_items + 1] = { s.p[1], s.p[2], s.ang, math.min(len * 0.8, 12) }
      end
    end
  end

  -- Every shoot ends in something: a leaf where there is room, otherwise
  -- a forget-me-not cyme, otherwise a few buds.
  for k, st in ipairs(strands) do
    if st.tip then
      local p, a = st.tip[1], st.tip[2]
      local r = rng:fork("tip" .. k)
      local len = run_length(g, p, a, math.min(110, mw * 0.7) * cfg.leaf_size * Dist.sample(r, Tune.sizes.leaf))
      local paint = len >= 20 and place_leaf(g, r, p, a, len, cfg.leaf_overlap)
      if paint then
        leaves[#leaves + 1] = paint
      else
        local tmp = S.batch()
        S.cyme(tmp, r, p, a, r:range(14, 22), r:chance(0.5) and 1 or -1)
        if fits(g, tmp) then
          spray_batch:merge(tmp)
        else
          local bud = S.batch()
          bud:bud(p[1], p[2], a, 4)
          if fits(g, bud) then spray_batch:merge(bud) end
        end
      end
    end
  end

  -- Tendrils and loop flourishes from spare nodes: the sweeping hairlines
  -- between features. Each leaves its strand nearly tangentially and is cut
  -- before its tight coil, ending in a leaflet, so no curl ends in nothing.
  for _, s in ipairs(slots) do
    if not s.used and rng:next() < cfg.curls * (0.12 + 0.3 * dens(s.p[1], s.p[2])) then
      local fwd = s.along
      local start = fwd + s.side * rng:range(0.25, 0.45)
      local curve
      if rng:chance(0.45) then
        curve = S.flourish(s.p, start, rng:range(55, 90), s.side)
        curve = { table.unpack(curve, 1, math.floor(#curve * 0.8)) }
      else
        curve = S.tendril(s.p, start, rng:range(30, 55), s.side)
        curve = { table.unpack(curve, 1, math.floor(#curve * 0.7)) }
      end
      local n = #curve
      local tip_a = n >= 2 and G.angle(curve[n - 1], curve[n]) or start
      local size = cfg.leaflet_size * Dist.sample(rng, Tune.sizes.leaflet)
      local leaf_end = n >= 2 and G.polar(curve[n], tip_a, size)
      if n >= 4 and open_path(g, curve) and g:open_at(leaf_end[1], leaf_end[2]) then
        spray_batch:line(curve, 2)
        g:reserve_line(curve, 1.5)
        leaflet_items[#leaflet_items + 1] = { curve[n][1], curve[n][2], tip_a, size }
        s.used = true
      end
    end
  end

  -- Gilt ornaments claim their space before the sprays fill in.
  if spec.header_y then
    local hx, hy = spec.text.x0 - 6, spec.header_y - 3
    orn[#orn + 1] = function(pt)
      pt:stroke(G.polyline({ { hx + 4, hy }, { spec.text.x1, hy } }), pal.ink, 0.4, 0.9)
      O.compass(pt, hx, hy, 13, { hair = 1.5 })
    end
  end
  local px = m.x0 + 2.5
  for k, fy in ipairs({ 0.62, 0.40, 0.14 }) do
    local y = ylo + span * fy + rng:jit(20)
    local len = rng:range(40, 62)
    local clear = true
    for d = 0, len, 6 do
      if not g:free(px, y - d) then clear = false break end
    end
    if clear then
      g:reserve_line({ { px, y }, { px, y - len / 2 }, { px, y - len } }, 4)
      local r = rng:fork("pendant" .. k)
      orn[#orn + 1] = function(pt) O.pendant(pt, r, px, y, len) end
    end
  end

  -- Sprays thin out along the foot toward the outer corner.
  local fade_from, fade_to = W * 0.42, W * 0.82
  Fill.sprays(rng:fork("fill"), g, stems, spray_batch, {
    cap = cfg.sprays,
    blooms = blooms,
    max_blooms = #blooms + cfg.small_blooms,
    keep = function(x, y, r)
      local d = dens(x, y)
      if y > m.foot then return r:next() < d end
      return r:next() < d and r:next() > 0.85 * G.smoothstep(fade_from, fade_to, x)
    end,
  })
  for _, s in ipairs(strands) do
    for _, it in ipairs(S.leaflet_items(rng, s.pts, cfg.leaflet_spacing, cfg.leaflet_size)) do
      if g:open_at(it[1], it[2]) and rng:next() < dens(it[1], it[2]) then leaflet_items[#leaflet_items + 1] = it end
    end
  end
  local sparkles = Fill.sparkles(rng:fork("sparkles"), g, 26)
  local midfoot = { W * 0.66, m.y0 + 10 }

  -- The plant's stems are drawn once every fork is known, so each narrows
  -- where its shoots leave.
  -- The plant's own stems are brushed washes (brush.stem); the corner
  -- sprig and the excursion stay pen work.
  local painted = {}
  for _, s in ipairs(strands) do
    if s.cum then painted[#painted + 1] = s else stem_batch:stem_by(s.pts, s.width) end
  end
  for _, s in ipairs(runners) do stem_batch:stem_by(s.pts, s.width) end

  -- Paint back to front.
  local pt = Paint.new({ backend = os.getenv("FLORA_BACKEND") })
  pt.probe = spec.probe
  local function layer(tag, fn)
    pt:begin_group(tag)
    fn()
    pt:end_group()
  end
  layer("back", function()
    for _, f in ipairs(back) do f(pt) end
  end)
  -- Bottom to top, as in the reference: stems and sprays, then leaflets,
  -- then leaves, then blooms. Each leaf knocks out what lies under it.
  layer("stems", function()
    local sr = rng:fork("stem paint")
    for _, s in ipairs(painted) do Brush.stem(pt, sr, s.pts, s.width, Tune.plant) end
    stem_batch:paint(pt)
  end)
  -- Fine sprays are pen work in a diluted ink, lighter than the stems.
  layer("sprays", function() spray_batch:paint(pt, Paint.mix(pal.ink, pal.sky, 0.4)) end)
  layer("leaflets", function() L.leaflets(pt, rng:fork("leaflets"), leaflet_items) end)
  layer("leaves", function()
    for _, f in ipairs(leaves) do f(pt) end
  end)
  layer("blooms", function()
    for _, f in ipairs(blooms) do f(pt) end
    local hc = Tune.hero
    F.bloom(pt, rng:fork("hero"), hero[1], hero[2], R, {
      style = hc.style, look = "hero", petals = hc.petals, width = hc.petal_width,
      rot = hc.rotation >= 0 and math.rad(hc.rotation) or nil, lost = hc.lost_edges,
    })
  end)
  layer("ornaments", function()
    for _, f in ipairs(orn) do f(pt) end
    O.sparkles(pt, sparkles)
    O.compass(pt, midfoot[1], midfoot[2], 7, { hair = 0.9, ring = 0 })
  end)
  pt.coverage = g:coverage()
  pt.panel = panel
  return pt
end

return C
