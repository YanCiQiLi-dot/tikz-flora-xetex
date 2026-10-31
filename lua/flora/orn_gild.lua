-- Burnished gilt for filled shapes. A flat ochre reads as paint, not
-- metal; printed gold has always been faked the way chromolithographs did
-- it: a ramp of light and dark bands across the metal, a pale bevel along
-- the edges that face the light, a dark one along the edges that turn
-- away, and a fine brown keyline that holds the shape on any paper. Every
-- part is an ordinary colour, so it survives a desktop printer or a
-- grayscale copy. Light falls from the page's upper left whatever frame
-- (a mirrored corner, say) the shape is drawn in.

local G = require("flora.geom")
local Paint = require("flora.paint")

local M = {}
local pal = Paint.palette
local pi, cos, sin = math.pi, math.cos, math.sin

M.pale = { 0.965, 0.905, 0.700 }
M.umber = { 0.330, 0.200, 0.090 }

-- The metal's ramp, lit end first: a bright reflection, the body, a dark
-- band of reflected ground, a second, softer sheen and the shadowed foot.
M.stops = {
  { 0.00, { 0.930, 0.840, 0.600 } },
  { 0.20, { 0.790, 0.640, 0.380 } },
  { 0.40, { 0.610, 0.440, 0.230 } },
  { 0.55, { 0.840, 0.700, 0.440 } },
  { 0.72, { 0.700, 0.540, 0.310 } },
  { 1.00, { 0.540, 0.380, 0.190 } },
}

-- The ramp for shaded faces (the copper half of a ray, a shadowed
-- petal): the same bands, a step darker and redder.
M.shade_stops = {
  { 0.00, { 0.820, 0.640, 0.430 } },
  { 0.25, { 0.660, 0.420, 0.240 } },
  { 0.45, { 0.480, 0.270, 0.140 } },
  { 0.60, { 0.700, 0.470, 0.280 } },
  { 1.00, { 0.450, 0.250, 0.120 } },
}

-- Bounding box {x0, y0, x1, y1} of a list of paths (paint commands).
function M.bbox(paths)
  local x0, y0, x1, y1 = math.huge, math.huge, -math.huge, -math.huge
  local function add(x, y, r)
    r = r or 0
    if x - r < x0 then x0 = x - r end
    if x + r > x1 then x1 = x + r end
    if y - r < y0 then y0 = y - r end
    if y + r > y1 then y1 = y + r end
  end
  for _, cmds in ipairs(paths) do
    for _, c in ipairs(cmds) do
      if c[1] == "m" or c[1] == "l" then add(c[2], c[3])
      elseif c[1] == "c" then add(c[2], c[3]) add(c[4], c[5]) add(c[6], c[7])
      elseif c[1] == "o" then add(c[2], c[3], c[4]) end
    end
  end
  return { x0, y0, x1, y1 }
end

-- Path commands moved by (dx, dy).
function M.shift(cmds, dx, dy)
  local out = {}
  for i, c in ipairs(cmds) do
    if c[1] == "m" or c[1] == "l" then out[i] = { c[1], c[2] + dx, c[3] + dy }
    elseif c[1] == "c" then out[i] = { "c", c[2] + dx, c[3] + dy, c[4] + dx, c[5] + dy, c[6] + dx, c[7] + dy }
    elseif c[1] == "o" then out[i] = { "o", c[2] + dx, c[3] + dy, c[4] }
    else out[i] = c end
  end
  return out
end

-- The unit vector, in pt's own coordinates, that its frame and projection
-- carry onto page direction `ang` near (x, y).
local function local_dir(pt, x, y, ang)
  local pj = pt:_pj()
  local ux, uy = cos(ang), sin(ang)
  if not pj then return ux, uy end
  local h = 1
  local ox, oy = pj(x, y)
  local ax, ay = pj(x + h, y)
  local bx, by = pj(x, y + h)
  -- Columns of the frame's Jacobian; solve J v = u.
  local a, c = (ax - ox) / h, (ay - oy) / h
  local b, d = (bx - ox) / h, (by - oy) / h
  local det = a * d - b * c
  if math.abs(det) < 1e-9 then return ux, uy end
  local vx, vy = (d * ux - b * uy) / det, (-c * ux + a * uy) / det
  local n = math.sqrt(vx * vx + vy * vy)
  return vx / n, vy / n
end

-- Gild `paths` (a list of closed paths). Options:
--   light   page angle the light comes from (default upper left)
--   bevel   width of the lit and shaded edges, pt (default from size)
--   key     keyline width, pt (0 for none)
--   shadow  drop-shadow offset, pt (0 for none)
--   each    shade every path on its own ramp, for large separate pieces
--   span    length of the ramp, pt (default the shapes' extent along the
--           light); shorter spans repeat no bands, they clamp
--   tone    "shade" for the darker ramp of shaded faces
function M.fill(pt, paths, o)
  o = o or {}
  if #paths == 0 then return end
  if pt.flat_gilt then
    pt:fill(paths, o.tone == "shade" and pal.copper or pal.gold, 0.95, { many = true })
    return
  end
  local b = M.bbox(paths)
  local cx, cy = (b[1] + b[3]) / 2, (b[2] + b[4]) / 2
  local size = math.min(b[3] - b[1], b[4] - b[2])
  local lx, ly = local_dir(pt, cx, cy, o.light or 3 * pi / 4)
  -- Bevels and keylines scale down with small shapes (a bead, a ray)
  -- rather than swamping them.
  local e = o.bevel or math.min(G.clamp(size * 0.03, 0.18, 0.7), size * 0.1)
  local shadow = o.shadow or (o.tone == "shade" and 0 or e * 0.9)
  if shadow > 0 then
    local sh = {}
    for i, p in ipairs(paths) do sh[i] = M.shift(p, -lx * shadow, -ly * shadow) end
    pt:fill(sh, pal.copper, 0.45, { many = true })
  end
  local ramp_name = o.tone == "shade" and "flgiltshade" or "flgilt"
  pt:shading(ramp_name, o.tone == "shade" and M.shade_stops or M.stops)
  local function ramp(group, bb)
    local mx, my = (bb[1] + bb[3]) / 2, (bb[2] + bb[4]) / 2
    local half = o.span and o.span / 2
      or (math.abs(lx) * (bb[3] - bb[1]) + math.abs(ly) * (bb[4] - bb[2])) / 2 + 0.5
    local w = (bb[3] - bb[1]) + (bb[4] - bb[2]) + 2
    pt:clip_begin(group)
    pt:shade(ramp_name, { mx + lx * half, my + ly * half }, { mx - lx * half, my - ly * half }, w)
    pt:clip_end()
  end
  if o.each then
    for _, p in ipairs(paths) do ramp(p, M.bbox({ p })) end
  else
    -- One clip path holding every shape: the ramp runs across the whole
    -- piece, as light across one gilded object.
    local all = {}
    for _, p in ipairs(paths) do for _, c in ipairs(p) do all[#all + 1] = c end end
    ramp(all, b)
  end
  -- Bevels: each outline moved away from the light, stroked inside the
  -- shape, leaves a pale band on the lit edges; moved toward the light, a
  -- dark band on the far ones.
  local all = {}
  for _, p in ipairs(paths) do for _, c in ipairs(p) do all[#all + 1] = c end end
  pt:clip_begin(all)
  local lit, dark = {}, {}
  for i, p in ipairs(paths) do
    lit[i] = M.shift(p, -lx * e, -ly * e)
    dark[i] = M.shift(p, lx * e, ly * e)
  end
  pt:stroke(lit, M.pale, e * 1.6, 0.85, { many = true })
  pt:stroke(dark, M.umber, e * 1.4, 0.4, { many = true })
  pt:clip_end()
  local key = o.key or math.min(G.clamp(size * 0.012, 0.12, 0.3), size * 0.04)
  if key > 0 then pt:stroke(paths, M.umber, key, 0.65, { many = true }) end
end

-- Gild a stroked line (an open path) `w` wide: a darker line under a
-- lighter, narrower one offset toward the light, as a gilt fillet tooled
-- into leather catches light on one lip.
function M.line(pt, paths, w, o)
  o = o or {}
  if pt.flat_gilt then
    pt:stroke(paths, pal.gold, w, 0.95, { many = true })
    return
  end
  local b = M.bbox(paths)
  local lx, ly = local_dir(pt, (b[1] + b[3]) / 2, (b[2] + b[4]) / 2, o.light or 3 * pi / 4)
  pt:stroke(paths, M.umber, w * 1.35, 0.55, { many = true })
  pt:stroke(paths, pal.gold, w, 0.95, { many = true })
  local hi = {}
  for i, p in ipairs(paths) do hi[i] = M.shift(p, lx * w * 0.2, ly * w * 0.2) end
  pt:stroke(hi, M.pale, w * 0.4, 0.8, { many = true })
end

-- Tooled dots (pointillé): each a gilt bead with a pale glint toward the
-- light. `pts` are centres, r the radius.
function M.dots(pt, pts, r, o)
  o = o or {}
  if #pts == 0 then return end
  if pt.flat_gilt then
    local flat = {}
    for i, p in ipairs(pts) do flat[i] = { { "o", p[1], p[2], r } } end
    pt:fill(flat, pal.gold, 0.95, { many = true })
    return
  end
  local lx, ly = local_dir(pt, pts[1][1], pts[1][2], o.light or 3 * pi / 4)
  local base, glint = {}, {}
  for i, p in ipairs(pts) do
    base[i] = { { "o", p[1], p[2], r } }
    glint[i] = { { "o", p[1] + lx * r * 0.35, p[2] + ly * r * 0.35, r * 0.38 } }
  end
  pt:fill(base, M.umber, 0.55, { many = true })
  local inner = {}
  for i, p in ipairs(pts) do inner[i] = { { "o", p[1], p[2], r * 0.8 } } end
  pt:fill(inner, pal.gold, 0.95, { many = true })
  pt:fill(glint, M.pale, 0.9, { many = true })
end

return M
