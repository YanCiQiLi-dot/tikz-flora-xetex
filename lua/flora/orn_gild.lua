-- Gilt for the ornaments: filled shapes, stroked lines and tooled dots,
-- painted as gold in relief (orn_relief.lua), or flat when the painter
-- has `flat_gilt` set. Every part is an ordinary colour, so it survives a
-- desktop printer or a grayscale copy. Light falls from the page's upper
-- left whatever frame (a mirrored corner, say) the shape is drawn in.

local G = require("flora.geom")
local Paint = require("flora.paint")
local Relief = require("flora.orn_relief")

local M = {}
local pal = Paint.palette

M.pale = { 0.965, 0.905, 0.700 }
M.umber = { 0.330, 0.200, 0.090 }

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

-- Gild `paths` (a list of closed paths). Options:
--   bevel   kept for callers; the relief sizes its own bevel
--   key     keyline width, pt (0 for none)
--   shadow  drop-shadow offset, pt (0 for none)
--   tone    "shade" for the darker gold of shaded faces
function M.fill(pt, paths, o)
  o = o or {}
  if #paths == 0 then return end
  if pt.flat_gilt then
    pt:fill(paths, o.tone == "shade" and pal.copper or pal.gold, 0.95, { many = true })
    return
  end
  local b = M.bbox(paths)
  local size = math.min(b[3] - b[1], b[4] - b[2])
  Relief.paint(pt, paths, {
    tone = o.tone,
    shadow = o.shadow or (o.tone == "shade" and 0 or G.clamp(size * 0.02, 0.15, 0.6)),
    key = o.key or math.min(0.16, size * 0.04),
  })
end

-- Gild lines (open or closed paths) `w` wide: each a round gilt wire.
function M.line(pt, paths, w, o)
  o = o or {}
  if pt.flat_gilt then
    pt:stroke(paths, pal.gold, w, 0.95, { many = true })
    return
  end
  -- Fine wire is nearly all bevel; a shallower tilt and no keyline keep
  -- it reading as gold rather than brown.
  local fine = w < 1
  Relief.paint_polys(pt, Relief.ribbons(pt, paths, math.max(w, 0.35)), { key = fine and 0 or 0.1, tilt = fine and 0.75 or nil })
end

-- Tooled dots (pointillé): each a small gilt dome. `pts` are centres, r
-- the radius.
function M.dots(pt, pts, r, o)
  o = o or {}
  if #pts == 0 then return end
  local paths = {}
  for i, p in ipairs(pts) do paths[i] = { { "o", p[1], p[2], r } } end
  if pt.flat_gilt then
    pt:fill(paths, pal.gold, 0.95, { many = true })
    return
  end
  Relief.paint(pt, paths, { key = math.min(0.1, r * 0.15) })
end

return M
