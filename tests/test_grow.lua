-- The clearance field, leaf placement on it, the hero's tilt and the gilt.
package.path = "./lua/?.lua;" .. package.path
local H = dofile("tests/helper.lua")
local Rng = require("flora.rng")
local Space = require("flora.space")
local Grow = require("flora.grow")
local F = require("flora.flower")
local G = require("flora.geom")

-- The field measures distance to the nearest obstacle: beside a blocked
-- band the room grows with distance (within the chamfer error and a cell),
-- and a proxy disc lowers it to the distance from the disc's counted edge.
do
  local g = Space.new(200, 200, 2)
  g:open(0, 0, 200, 200)
  g:block_text(0, 0, 200, 40)
  g:field()
  for _, y in ipairs({ 60, 90, 120 }) do
    local want = math.min(y - 40, 200 - y, 100)
    local got = g:room(100, y)
    H.check(math.abs(got - want) <= want * 0.09 + 2, string.format("room at y=%d is %.1f, want about %.1f", y, got, want))
  end
  g:disc(100, 150, 20, 0.8)
  local got = g:room(100, 110)
  H.check(got <= 40 - 16 + 1, string.format("disc did not lower the field: room %.1f", got))
  H.check(g:room(100, 150) == 0, "room inside a placed disc")
end

-- Leaves never overlap past the allowance: across many leaves placed on
-- one field, any two discs from different leaves stay at least k of their
-- radii apart (less a cell for the grid). A blade checked only along its
-- midrib, as the old corridor did, breaks this.
do
  local overlap = 0.15
  local k = 1 - overlap
  local g = Space.new(300, 300, 2)
  g:open(0, 0, 300, 300)
  g:field()
  local rng = Rng.new(5)
  local leaves = {}
  for i = 1, 160 do
    local p = { rng:range(40, 260), rng:range(40, 260) }
    local _, discs = Grow.leaf(g, rng:fork("leaf" .. i), p, rng:range(0, 2 * math.pi), 80, overlap)
    if discs then leaves[#leaves + 1] = discs end
  end
  H.check(#leaves >= 10, "too few leaves placed to test: " .. #leaves)
  local worst = math.huge
  for a = 1, #leaves do
    for b = a + 1, #leaves do
      for _, d in ipairs(leaves[a]) do
        for _, e in ipairs(leaves[b]) do
          worst = math.min(worst, G.dist(d, e) - k * (d[3] + e[3]))
        end
      end
    end
  end
  H.check(worst >= -2 * g.c, string.format("two leaves overlap %.1f pt past the allowance", -worst))
end

-- The tilted hero: near (lower) petals project larger than far (upper)
-- ones, and its rim projects shorter than wide.
do
  local fn, rh = F.tilt(0, 0, 50, 35)
  local _, ytop = fn(0, 50)
  local _, ybot = fn(0, -50)
  H.check(-ybot > ytop, string.format("near rim %.1f not lower than far rim %.1f reaches", -ybot, ytop))
  local xr = fn(50, 0)
  H.check(rh < xr, string.format("tilted rim %.1f tall, %.1f wide", rh, xr))
  local x0, y0 = F.tilt(0, 0, 50, 0)(30, 20)
  H.check(math.abs(x0 - 30) < 3 and math.abs(y0 - 20) < 3, "tilt 0 moves points")
end

-- The edge chain stays inside the strip compose.lua reserves for it: no
-- motif reaches past either end of its run or more than 5 pt to the side.
do
  local Paint = require("flora.paint")
  local O = require("flora.ornament")
  for seed = 1, 40 do
    local rng = Rng.new(seed)
    local ytop = rng:range(300, 700)
    local ybot = ytop - rng:range(28, 260)
    local pt = Paint.new({ backend = "pdf" })
    local worst = ""
    pt.probe = function(x, y, r)
      if y + r > ytop + 1 or y - r < ybot - 1 or math.abs(x - 50) + r > 5 then
        worst = string.format("(%.1f, %.1f) r %.1f", x, y, r)
      end
    end
    O.chain(pt, rng, 50, ytop, ybot, seed % 2 == 0 and "knot" or nil)
    H.check(worst == "", string.format("seed %d: chain %.0f..%.0f paints outside its strip at %s", seed, ybot, ytop, worst))
  end
end

-- A placed box lowers the field to the distance from its edge, not from a
-- disc around it: just above the box there is about that much room, and
-- none inside. Disc reservations over-reserved by half the box's width.
do
  local g = Space.new(200, 200, 2)
  g:open(0, 0, 200, 200)
  g:field()
  g:box(80, 60, 120, 120)
  H.check(g:room(100, 90) == 0 and not g:free(100, 90), "box interior left free")
  for _, d in ipairs({ 6, 14 }) do
    local got = g:room(100, 120 + d)
    H.check(math.abs(got - d) <= 2, string.format("room %.0f pt above the box is %.1f", d, got))
  end
end

-- The star cartouche paints only inside its box, on every seed (its clouds
-- and stars are clipped to the field; the frame is the box).
do
  local Paint = require("flora.paint")
  local O = require("flora.ornament")
  for seed = 1, 12 do
    local pt = Paint.new({ backend = "pdf" })
    local worst = ""
    pt.probe = function(x, y, r)
      if x - r < 9.5 or x + r > 50.5 or y - r < 19.5 or y + r > 74.5 then
        worst = string.format("(%.1f, %.1f) r %.1f", x, y, r)
      end
    end
    O.panel(pt, Rng.new(seed), 10, 20, 40, 54)
    H.check(worst == "", string.format("seed %d: cartouche paints outside its box at %s", seed, worst))
  end
end

-- The corner pendant stays inside its box and the cord above it, and the
-- seed varies both its outline and its knot.
do
  local Paint = require("flora.paint")
  local O = require("flora.ornament")
  local shapes, knots, ns, nk = {}, {}, 0, 0
  for seed = 1, 40 do
    local pt = Paint.new({ backend = "pdf" })
    local worst = ""
    pt.probe = function(x, y, r)
      local in_box = math.abs(x - 50) + r <= 12.5 and math.abs(y - 40) + r <= 17.5
      local on_cord = math.abs(x - 50) + r <= 1.2 and y - r >= 40 and y + r <= 57.5 + 20
      if not (in_box or on_cord) then worst = string.format("(%.1f, %.1f) r %.1f", x, y, r) end
    end
    local shape, knot = O.pendant(pt, Rng.new(seed), 50, 40, 24, 34, 20)
    H.check(worst == "", string.format("seed %d: %s pendant paints outside its box at %s", seed, shape, worst))
    if not shapes[shape] then shapes[shape], ns = true, ns + 1 end
    if not knots[knot] then knots[knot], nk = true, nk + 1 end
  end
  H.check(ns >= 4 and nk >= 3, string.format("pendants vary little: %d outlines, %d knots", ns, nk))
end

H.done("grow")
