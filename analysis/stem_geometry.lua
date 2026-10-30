-- Our plant's stem centrelines as JSON, for analysis/stemcompare.py: for
-- each seed, the main stem, long shoots and foot shoots in pt, grown on the
-- test page (tests/helper.lua) exactly as tests/test_plant.lua grows them.
--
--   texlua analysis/stem_geometry.lua [SEEDS]     (default 6; repo root)

package.path = "./lua/?.lua;" .. package.path
local H = dofile("tests/helper.lua")
local Rng = require("flora.rng")
local G = require("flora.geom")
local Layout = require("flora.layout")
local Tune = require("flora.tune")

local seeds = tonumber(arg[1]) or 6
local out = {}
for seed = 1, seeds do
  local spec = H.page(seed)
  local _, m = Layout.region(spec)
  local mw = m.x1 - m.x0
  local R = G.clamp(mw * Tune.compose.hero, 28, 80)
  local hero = { m.x0 + mw * 0.5, spec.header_y - R * 0.55, R }
  local gest = Layout.gesture(Rng.new(seed):fork("gesture"), m, hero)
  local py = gest.quiet[1]
  local pw, ph = Layout.cartouche_size(mw)
  local box = { m.x0, py - ph / 2 - 3, m.x0 + pw + 5, py + ph / 2 + 3 }
  local strands = Layout.strands(Rng.new(seed):fork("strands"), m, hero, spec.width, gest, box)
  local rows = {}
  for _, st in ipairs(strands) do
    local pts = {}
    for i, p in ipairs(st.pts) do pts[i] = string.format("[%.2f,%.2f]", p[1], p[2]) end
    rows[#rows + 1] = string.format('{"kind":"%s","pts":[%s]}', st.main and "main" or (st.kind or "shoot"),
      table.concat(pts, ","))
  end
  out[#out + 1] = "[" .. table.concat(rows, ",") .. "]"
end
io.write("[" .. table.concat(out, ",") .. "]\n")
