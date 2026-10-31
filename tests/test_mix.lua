local H = dofile("tests/helper.lua")
local Compose = require("flora.compose")
local Paint = require("flora.paint")
local Settings = require("flora.settings")
local Tune = require("flora.tune")

local function page(seed, mix, palette)
  local s = H.page(seed)
  s.mix, s.palette = mix, palette
  Paint.reset_resources()
  return Compose.page(s)
end

-- Neutral weights are the unmixed page exactly.
do
  local neutral = {}
  for k, v in pairs(Tune.mix) do neutral[k] = v end
  H.check(page(3):code() == page(3, neutral):code(), "a neutral mix changed the page")
end

-- Weight 0 removes a kind; a large weight brings more of it.
do
  local base, none, many = { umbel = 0, lily = 0, leaves = 0 }, { umbel = 0, lily = 0, leaves = 0 }, { umbel = 0 }
  for seed = 1, 4 do
    local d = page(seed).counts
    local z = page(seed, { umbel = 0, lily = 0, leaves = 0 }).counts
    local m = page(seed, { umbel = 4 }).counts
    base.umbel, base.lily, base.leaves = base.umbel + (d.umbel or 0), base.lily + (d.lily or 0), base.leaves + d.leaves
    none.umbel, none.lily, none.leaves = none.umbel + (z.umbel or 0), none.lily + (z.lily or 0), none.leaves + z.leaves
    many.umbel = many.umbel + (m.umbel or 0)
  end
  H.check(base.umbel > 0 and base.lily > 0 and base.leaves > 0,
    string.format("default pages lack umbels, lilies or leaves (%d, %d, %d)", base.umbel, base.lily, base.leaves))
  H.check(none.umbel == 0 and none.lily == 0 and none.leaves == 0,
    string.format("weight 0 still grew %d umbels, %d lilies, %d leaves", none.umbel, none.lily, none.leaves))
  H.check(many.umbel > base.umbel * 1.5,
    string.format("umbel=4 grew %d umbels against %d by default", many.umbel, base.umbel))
end

-- Density thins the whole border.
do
  local full, airy = 0, 0
  for seed = 1, 3 do
    full = full + #page(seed):body()
    airy = airy + #page(seed, { density = 0.4 }):body()
  end
  H.check(airy < full * 0.85, string.format("density=0.4 painted %.0f%% of the default", 100 * airy / full))
end

-- A palette changes the page and is undone afterwards, even on error.
do
  local before = Tune.color.palette.leaves
  H.check(page(2, nil, { leaves = "warm" }):code() ~= page(2):code(), "palette leaves=warm changed nothing")
  H.check(Tune.color.palette.leaves == before, "palette override leaked into tune")
  local Mix = require("flora.mix")
  pcall(Mix.with_palette, { leaves = "warm" }, function() error("boom") end)
  H.check(Tune.color.palette.leaves == before, "palette override leaked after an error")
end

-- Settings fold density and visitors into the mix and reject bad values.
do
  local t = Settings.parse("mix={lily=2, umbel=0}, density=0.7, visitors=1, mix={bee=0}")
  H.check(t.mix.lily == 2 and t.mix.umbel == 0 and t.mix.density == 0.7, "mix settings lost")
  H.check(t.mix.butterfly == 1 and t.mix.bee == 0, "visitors shorthand or a later override lost")
  local p = Settings.parse("palette={leaves=green, hero=kon-peki, stems=look}")
  H.check(p.palette.leaves == "green" and p.palette.hero == "kon-peki", "palette settings lost")
  for _, bad in ipairs({ "mix={rose=1}", "mix={lily=-1}", "mix={lily=many}", "density=11",
      "palette={leaves=plaid}", "palette={petals=green}", "visitors=lots" }) do
    H.check(not pcall(Settings.parse, bad), "accepted bad settings \"" .. bad .. "\"")
  end
end

H.done("mix")
