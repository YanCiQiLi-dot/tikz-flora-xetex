local H = dofile("tests/helper.lua")
local Compose = require("flora.compose")
local Paint = require("flora.paint")

local function page(T, seed)
  local s = H.page(seed or 2, 420)
  s.mix = { bee = 1, butterfly = 1, bird = 1, snail = 1 }
  s.grow = T
  Paint.reset_resources()
  return Compose.page(s)
end

local static = page(nil)
local full = {}
for _, c in ipairs(static.out) do full[c] = true end

-- The last frame is the finished page.
H.check(page(1):code() == static:code(), "grow=1 differs from the finished page")

-- Growth only adds: the painted count never falls as time runs, starts
-- near nothing and ends at the finished page's.
do
  local prev = -1
  for _, T in ipairs({ 0, 0.05, 0.2, 0.4, 0.6, 0.8, 0.95 }) do
    local n = page(T).count
    H.check(n >= prev, string.format("painted count falls from %d to %d at T=%.2f", prev, n, T))
    prev = n
  end
  H.check(page(0).count < static.count * 0.02, "T=0 already shows the page")
  H.check(prev <= static.count, "a frame paints more than the finished page")
end

-- What has finished growing is painted exactly as on the finished page:
-- every object of every element drawn in full in a mid-growth frame
-- appears there verbatim. (If a frame spent any random stream differently,
-- the elements painted after that point would differ.)
do
  local Clock = require("flora.clock")
  local draw = Clock.draw
  for _, T in ipairs({ 0.3, 0.6 }) do
    local whole, same, elements = 0, 0, 0
    Clock.draw = function(self, pt, fn, at, dur, delay)
      local b = at and self:birth(at[1], at[2]) + (delay or 0) or self.reach
      local n0 = #pt.out
      draw(self, pt, fn, at, dur, delay)
      if self:progress(b, dur or 0.08) >= 1 then
        elements = elements + 1
        for i = n0 + 1, #pt.out do
          whole = whole + 1
          if full[pt.out[i]] then same = same + 1 end
        end
      end
    end
    page(T)
    Clock.draw = draw
    H.check(elements > 10 and same == whole, string.format(
      "T=%.1f: %d of %d objects of %d grown elements differ from the finished page",
      T, whole - same, whole, elements))
  end
end

H.done("clock")
