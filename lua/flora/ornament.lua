-- Gilded marginalia: compass stars, sparkles, pendant chains, knot lozenges
-- and the inset star panel.

local G = require("flora.geom")
local W = require("flora.wash")
local Paint = require("flora.paint")
local pal = Paint.palette

local O = {}
local pi = math.pi

local function tri(a, b, c)
  return { { "m", a[1], a[2] }, { "l", b[1], b[2] }, { "l", c[1], c[2] }, { "z" } }
end

-- An eight-point compass star. Each ray has a lit and a shaded half.
--   o.hair: length factor of the thin crosshair lines (0 for none)
--   o.ring: number of dots circling the star
function O.compass(pt, x, y, R, o)
  o = o or {}
  local C = { x, y }
  local lit, shade = {}, {}
  for k = 0, 7 do
    local a = k * pi / 4 + pi / 2
    local major = k % 2 == 0
    local len = major and R or R * 0.48
    local half = major and 0.11 or 0.13
    local tip = G.polar(C, a, len)
    local l = G.polar(C, a + pi / 4, len * half)
    local r = G.polar(C, a - pi / 4, len * half)
    lit[#lit + 1] = tri(C, tip, l)
    shade[#shade + 1] = tri(C, tip, r)
  end
  if (o.hair or 1.7) > 0 then
    local h = R * (o.hair or 1.7)
    pt:stroke({ G.polyline({ { x, y - h }, { x, y + h } }), G.polyline({ { x - h, y }, { x + h, y } }) },
      pal.gold, 0.22, 0.75, { many = true })
  end
  pt:fill(shade, pal.copper, 0.95, { many = true })
  pt:fill(lit, pal.gold, 0.95, { many = true })
  pt:fill({ { "o", x, y, R * 0.07 } }, pal.cream, 1)
  pt:stroke({ { "o", x, y, R * 0.07 } }, pal.copper, 0.2, 0.9)
  local ring = o.ring or 8
  if ring > 0 then
    local dots = {}
    for k = 0, ring - 1 do
      local a = (k + 0.5) * 2 * pi / ring + pi / 2
      local p = G.polar(C, a, R * 0.62)
      dots[#dots + 1] = { { "o", p[1], p[2], R * 0.035 } }
    end
    pt:fill(dots, pal.gold, 0.9, { many = true })
  end
end

-- Small four-point sparkles, batched. Items: {x, y, r}.
function O.sparkles(pt, items)
  local paths = {}
  for _, s in ipairs(items) do
    local x, y, r = s[1], s[2], s[3]
    local k = r * 0.16
    paths[#paths + 1] = {
      { "m", x, y + r }, { "c", x, y + k, x + k, y, x + r, y }, { "c", x + k, y, x, y - k, x, y - r },
      { "c", x, y - k, x - k, y, x - r, y }, { "c", x - k, y, x, y + k, x, y + r }, { "z" },
    }
  end
  if #paths > 0 then pt:fill(paths, pal.gold, 0.9, { many = true }) end
end

-- A lozenge knot: a rhombus threaded with four loops and a small core.
function O.knot(pt, x, y, w, h)
  local paths = {
    G.polyline({ { x, y + h }, { x + w, y }, { x, y - h }, { x - w, y } }, true),
    G.polyline({ { x, y + h * 0.45 }, { x + w * 0.45, y }, { x, y - h * 0.45 }, { x - w * 0.45, y } }, true),
  }
  for _, d in ipairs({ { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }) do
    paths[#paths + 1] = { { "o", x + d[1] * w * 0.5, y + d[2] * h * 0.5, math.min(w, h) * 0.26 } }
  end
  pt:stroke(paths, pal.gold, 0.3, 0.85, { many = true })
  pt:fill({ { "o", x, y, math.min(w, h) * 0.1 } }, pal.copper, 0.85)
end

-- A hanging chain: dotted thread, a knot lozenge and a drop.
function O.pendant(pt, rng, x, ytop, len)
  local knot_y = ytop - len * rng:range(0.38, 0.55)
  local kw, kh = len * 0.09, len * 0.14
  local thread = {
    G.polyline({ { x, ytop }, { x, knot_y + kh * 1.05 } }),
    G.polyline({ { x, knot_y - kh * 1.05 }, { x, ytop - len } }),
  }
  pt:stroke(thread, pal.gold, 0.22, 0.7, { many = true })
  local dots = {}
  local step = len * 0.055
  local yy = ytop - step
  while yy > ytop - len do
    if math.abs(yy - knot_y) > kh * 1.3 then
      dots[#dots + 1] = { { "o", x, yy, rng:range(0.35, 0.6) } }
    end
    yy = yy - step
  end
  pt:fill(dots, pal.gold, 0.9, { many = true })
  O.knot(pt, x, knot_y, kw, kh)
  local d = ytop - len
  pt:fill({ { "m", x, d - 3.2 }, { "c", x + 1.6, d - 1.2, x + 0.8, d, x, d + 0.4 },
    { "c", x - 0.8, d, x - 1.6, d - 1.2, x, d - 3.2 }, { "z" } }, pal.gold, 0.9)
  pt:fill(tri({ x, ytop + 2.4 }, { x + 1.4, ytop }, { x, ytop - 2.4 }), pal.copper, 0.9)
  pt:fill(tri({ x, ytop + 2.4 }, { x - 1.4, ytop }, { x, ytop - 2.4 }), pal.gold, 0.9)
end

-- The inset panel: a gilt double frame around an ultramarine wash with a
-- compass star.
-- A rectangle (x, y, w, h) with its corners cut back by c, as a closed
-- polygon with n points per side.
local function chamfered(x, y, w, h, c, n)
  local corners = { { x + c, y }, { x + w - c, y }, { x + w, y + c }, { x + w, y + h - c },
    { x + w - c, y + h }, { x + c, y + h }, { x, y + h - c }, { x, y + c } }
  local out = {}
  for i = 1, #corners do
    local a, b = corners[i], corners[i % #corners + 1]
    for k = 0, n - 1 do out[#out + 1] = G.mix(a, b, k / n) end
  end
  return out
end

-- A luminous eight-point star at (cx, cy): long cardinal rays reaching rx
-- across and ry up and down, shorter diagonals, a soft cream-to-peach glow
-- at its heart, all in light rather than gilt.
local GLOW = { 0.99, 0.86, 0.72 }
local function lit_star(pt, cx, cy, rx, ry)
  local c = { cx, cy }
  local r = math.min(rx, ry)
  for k = 1, 4 do
    pt:fill({ { "o", cx, cy, r * (0.55 - 0.1 * k) } }, pal.white, 0.1)
  end
  -- Sixteen rays: the cardinals reach the panel, the diagonals most of the
  -- way, and thin rays between them about half as far.
  local rays, fine = {}, {}
  for k = 0, 15 do
    local a = k * pi / 8
    local len, half, into
    if k % 4 == 0 then
      len, half, into = (k % 8 == 0) and rx or ry, r * 0.075, rays
    elseif k % 2 == 0 then
      len, half, into = r * 0.8, r * 0.06, rays
    else
      len, half, into = r * 0.48, r * 0.035, fine
    end
    into[#into + 1] = G.polyline({ c, G.polar(c, a + pi / 2, half), G.polar(c, a, len),
      G.polar(c, a - pi / 2, half) }, true)
  end
  pt:fill(fine, pal.white, 0.7, { many = true })
  pt:fill(rays, pal.white, 0.92, { many = true })
  pt:fill({ { "o", cx, cy, r * 0.26 } }, GLOW, 0.45)
  pt:fill({ { "o", cx, cy, r * 0.18 } }, GLOW, 0.6)
  pt:fill({ { "o", cx, cy, r * 0.11 } }, GLOW, 0.85)
  pt:fill({ { "o", cx, cy, r * 0.05 } }, pal.white, 0.95)
end

-- The star cartouche: an even ultramarine panel with cut corners, a double
-- frame in pale silver, and a luminous star filling it.
function O.panel(pt, rng, x, y, w, h)
  local c = math.min(w, h) * 0.07
  local body = chamfered(x, y, w, h, c, 6)
  local inset = 2.4
  local outer = chamfered(x - inset, y - inset, w + 2 * inset, h + 2 * inset, c + inset * 0.6, 2)
  pt:fill(G.polyline(outer, true), Paint.mix(pal.blue, pal.paper, 0.78), 1)
  W.wash(pt, body, {
    rng = rng, size = math.min(w, h), pigment = pal.blue, pool = pal.deep, light = { x + w / 2, y + h / 2 },
    strength = 1, rings = 5, lift = 0.07, grain = 0.35, outline = 0, lost = 0, lifts = 0,
  })
  pt:stroke(G.polyline(body, true), Paint.mix(pal.ink, pal.paper, 0.7), 0.6, 0.9)
  pt:stroke(G.polyline(outer, true), Paint.mix(pal.ink, pal.paper, 0.4), 0.55, 0.85)
  lit_star(pt, x + w / 2, y + h / 2, w * 0.46, h * 0.44)
end

return O
