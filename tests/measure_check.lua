-- Checks run by tests/measure.tex against box register 0, which holds two
-- lines set in a 200pt-wide vbox, the second indented by 50pt.

local boxes = require("flora.measure").boxes(0, 600)
local function fail(msg) error("measure test: " .. msg) end

if #boxes ~= 2 then fail("expected 2 line boxes, got " .. #boxes) end
local origin = (4736286 + tex.hoffset) / 65536
local a, b = boxes[1], boxes[2]
if math.abs(a.x0 - origin) > 0.5 then
  fail("first line starts at " .. a.x0 .. ", expected " .. origin)
end
if math.abs(b.x0 - (origin + 50)) > 0.5 then
  fail("indented line starts at " .. b.x0 .. ", expected " .. origin + 50)
end
if not (a.y0 > b.y1 - 2) then fail("first line is not above the second") end
if not (a.x1 > a.x0 + 30 and a.x1 < origin + 200) then
  fail("first line width " .. (a.x1 - a.x0))
end
local top = 600 - (4736286 + tex.voffset) / 65536
if a.y1 > top + 0.01 or a.y1 < top - 12 then
  fail("first line top " .. a.y1 .. " vs box top " .. top)
end
texio.write_nl("term and log", "measure: ok")
