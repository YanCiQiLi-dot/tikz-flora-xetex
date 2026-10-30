-- Gap filling: sprays grown into the remaining free space, then sparkles.

local G = require("flora.geom")
local S = require("flora.sprig")
local F = require("flora.flower")
local Dist = require("flora.dist")
local Tune = require("flora.tune")

local Fill = {}
local pi = math.pi

-- Nearest point on any stem within `maxd`, with that stem's tangent.
local function nearest(stems, p, maxd)
  local best, bd, ba = nil, maxd, nil
  for _, s in ipairs(stems) do
    local pts = s.pts
    for i = 2, #pts, 2 do
      local d = G.dist(p, pts[i])
      if d < bd then
        best, bd, ba = pts[i], d, G.angle(pts[i - 1], pts[i])
      end
    end
  end
  return best, bd, ba
end
Fill.nearest = nearest

-- Grow one spray of `kind` toward (x, y) from stem point s, whose stem
-- runs along `tangent`, into batch `b`. The stalk peels off the stem
-- tangentially and sweeps into the gap; the spray continues its heading.
-- `scale` shrinks the spray; `lean` turns it. Returns the stalk, and for a
-- bloom its centre and radius.
local function grow(b, rng, kind, s, tangent, d, x, y, r, scale, lean)
  local target = { x, y }
  local chord = G.angle(s, target)
  local dir0 = G.depart(s, tangent, target, 0.35)
  local a = chord + G.turn(chord, dir0) * 0.6 + lean
  local base = G.polar(s, chord, math.max(d - r * 0.55, 3))
  local stalk = G.link(s, dir0, base, a)
  b:line(stalk, d > 30 and 2 or 3)
  r = r * scale
  if kind == "bloom" then
    b:line(G.spline_points({ base, { x, y } }, 2), 2)
    return stalk, { x, y, r * 0.6 }
  elseif kind == "gyps" then
    S.gypsophila(b, rng, base, a, r * 0.5, r >= 14 and 5 or (r >= 8 and 4 or 3))
  elseif kind == "cyme" then
    S.cyme(b, rng, base, a, r * 1.25, rng:chance(0.5) and 1 or -1)
  elseif kind == "umbel" then
    S.umbel(b, rng, base, a, r * 0.85)
  elseif kind == "bud" then
    for k = -1, 1 do
      local stem = G.curve(base, a + k * 0.45, r * 0.6, rng:jit(0.4), 0, 4)
      b:line(stem, 3)
      local e = stem[#stem]
      b:bud(e[1], e[2], a + k * 0.45, r * 0.32)
    end
  else
    b:floret(x, y, r * 0.35, rng:range(0, 2 * pi), rng:int(1, 3))
  end
  return stalk
end

-- Does every point of batch `b` lie in open space (with its radius)?
local function fits(g, b)
  local ok = true
  b:each_point(function(x, y, r)
    if ok and not (g:open_at(x, y) and g:open_at(x - r, y) and g:open_at(x + r, y)
        and g:open_at(x, y - r) and g:open_at(x, y + r)) then
      ok = false
    end
  end)
  return ok
end

-- Grow sprays into free space, roomiest gaps first. Each spray hangs from
-- the nearest stem on a hairline stalk; the stalk joins the stem list so
-- later sprays may branch from it. A spray is grown into a scratch batch and
-- kept only if every point lands in open space; otherwise it is retried
-- smaller and on axis, then dropped.
--   opts.cap      maximum sprays
--   opts.keep(x, y, rng) optional predicate thinning sprays by position
--   opts.blooms   list that receives painters for small blooms (optional);
--                 sprays stop adding blooms once it holds opts.max_blooms
function Fill.sprays(rng, g, stems, batch, opts)
  opts = opts or {}
  local cands = {}
  for _, c in ipairs(g:free_cells(2)) do
    local r = g:clearance(c[1], c[2], 30)
    if r >= 5 then cands[#cands + 1] = { c[1], c[2], r, rng:next() } end
  end
  table.sort(cands, function(a, b)
    if a[3] ~= b[3] then return a[3] > b[3] end
    return a[4] < b[4]
  end)
  local count = 0
  for _, c in ipairs(cands) do
    if count >= (opts.cap or 80) then break end
    local x, y = c[1], c[2]
    local r = g:clearance(x, y, 30)
    if r >= 5 and (not opts.keep or opts.keep(x, y, rng)) then
      local s, d, tangent = nearest(stems, { x, y }, 75)
      if s then
        local kind
        if opts.blooms and #opts.blooms < (opts.max_blooms or 5) and r >= 11 and rng:chance(0.14) then
          kind = "bloom"
        elseif r >= 22 then
          kind = rng:weighted({ gyps = 5, cyme = 3, umbel = 1 })
        elseif r >= 16 then
          kind = rng:weighted({ gyps = 5, cyme = 3 })
        elseif r >= 8 then
          kind = rng:weighted({ gyps = 4, cyme = 2, bud = 1 })
        else
          kind = rng:weighted({ gyps = 2, floret = 2 })
        end
        local fr = rng:fork("spray" .. count)
        -- Baby's breath comes in a mix of sizes (tune.sizes.gyps): a spray
        -- fills only part of its gap, and reserves only what it fills.
        local fill = kind == "gyps" and Dist.sample(fr, Tune.sizes.gyps) or 1
        local tries = { { fill, fr:jit(0.3) }, { 0.7 * fill, 0 } }
        for _, t in ipairs(tries) do
          local tmp = S.batch()
          local stalk, bloom = grow(tmp, fr, kind, s, tangent, d, x, y, r, t[1], t[2])
          if fits(g, tmp) then
            batch:merge(tmp)
            stems[#stems + 1] = { pts = stalk }
            if bloom then
              local style = F.pick_style(fr, { "fan", "round", "soft" })
              local br = fr:fork("bloom")
              opts.blooms[#opts.blooms + 1] = function(pt)
                F.bloom(pt, br, bloom[1], bloom[2], bloom[3], { style = style })
              end
            end
            g:reserve(x, y, r * 0.85 * math.max(fill, 0.5))
            g:reserve(s[1], s[2], 2)
            count = count + 1
            break
          end
        end
      end
    end
  end
  return count
end

-- Sparkles in whatever free space is left.
function Fill.sparkles(rng, g, n)
  local cells = g:free_cells(2)
  local items = {}
  local tries = 0
  while #items < n and tries < n * 20 and #cells > 0 do
    tries = tries + 1
    local c = cells[rng:int(1, #cells)]
    local r = g:clearance(c[1], c[2], 8)
    if r >= 3 then
      local size = rng:range(1.4, math.min(3.4, r * 0.8))
      items[#items + 1] = { c[1], c[2], size }
      g:reserve(c[1], c[2], size * 3)
    end
  end
  return items
end

return Fill
