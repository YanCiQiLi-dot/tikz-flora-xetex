local H = dofile("tests/helper.lua")
local Compose = require("flora.compose")
local Paint = require("flora.paint")

local ON = { bee = 2, butterfly = 2, bird = 2, snail = 2 }

local function page(seed, mix, last_y)
  local s = H.page(seed, last_y)
  s.mix = mix
  Paint.reset_resources()
  return Compose.page(s), s
end

-- Visitors at weight 0 leave the page exactly as it was.
do
  local off = { bee = 0, butterfly = 0, bird = 0, snail = 0 }
  H.check(page(5):code() == page(5, off):code(), "visitors at weight 0 changed the page")
end

-- With weight, every kind turns up across a few pages, in its own layer,
-- and none lands on text.
do
  local seen = {}
  for seed = 1, 4 do
    local s = H.page(seed, seed % 2 == 0 and 420 or nil)
    s.mix = ON
    local bad
    s.probe = function(x, y, r, tag)
      if tag ~= "visitors" or bad then return end
      for _, l in ipairs(s.lines) do
        if x + r > l.x0 + 1 and x - r < l.x1 - 1 and y + r > l.y0 + 1 and y - r < l.y1 - 1 then
          bad = string.format("(%.1f, %.1f)", x, y)
        end
      end
    end
    Paint.reset_resources()
    local pt = Compose.page(s)
    H.check(not bad, string.format("seed %d: a visitor lands on text at %s", seed, tostring(bad)))
    local layer = false
    for _, b in ipairs(pt.boxes) do if b.tag == "visitors" then layer = true end end
    H.check(layer, string.format("seed %d: no visitors layer", seed))
    for k in pairs(ON) do seen[k] = (seen[k] or 0) + (pt.counts[k] or 0) end
  end
  for k in pairs(ON) do
    H.check(seen[k] > 0, string.format("no %s on any of 4 pages at weight 2", k))
  end
end

H.done("visitor")
