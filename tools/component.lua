-- Draws one component's specimen (lua/flora/components.lua) as a PDF, or
-- lists the components as JSON for the tuner.
--
--   texlua tools/component.lua ID SEED OUT.pdf
--   texlua tools/component.lua --list
--
-- FLORA_TUNE applies as usual. Run from the repository root.

package.path = "./lua/?.lua;" .. package.path
local Rng = require("flora.rng")
local Paint = require("flora.paint")
local Pdf = require("flora.pdfout")
local Components = require("flora.components")

if arg[1] == "--list" then
  local function str(s) return string.format("%q", s) end
  local rows = {}
  for _, c in ipairs(Components.list) do
    local paths = {}
    for i, p in ipairs(c.paths) do paths[i] = str(p) end
    rows[#rows + 1] = string.format('{"id":%s,"label":%s,"desc":%s,"paths":[%s],"specimen":%s,"w":%s,"h":%s}',
      str(c.id), str(c.label), str(c.desc), table.concat(paths, ","), tostring(c.draw ~= nil),
      c.w or "null", c.h or "null")
  end
  io.write("[" .. table.concat(rows, ",") .. "]\n")
  return
end

local id, seed, out = arg[1], tonumber(arg[2]), arg[3]
assert(id and seed and out, "usage: component.lua ID SEED OUT.pdf | --list")
local c = assert(Components.get(id), "no component " .. id)
assert(c.draw, "component " .. id .. " has no specimen")
Paint.reset_resources()
local pt = Paint.new({ backend = "pdf" })
c.draw(pt, Rng.new(seed))
Pdf.write(out, pt, c.w, c.h)
