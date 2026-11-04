local script = (arg[0] or ""):gsub("\\", "/")
local root = script:match("^(.*)/tools/[^/]+$") or "."
package.path = root .. "/lua/?.lua;" .. package.path

local Serial = require("flora.serial")
local Paint = require("flora.paint")
local Compose = require("flora.compose")
local Init = require("flora.init")
local Pdf = require("flora.pdfout")
local Settings = require("flora.settings")

local spec_path, out = arg[1], arg[2]
assert(spec_path and out, "usage: xelatex-flora.lua SPEC OUT.pdf")

local f = assert(io.open(spec_path, "rb"))
local spec_text = f:read("a")
f:close()
local spec = Serial.decode("{" .. spec_text .. "}")

local ok, set = pcall(function()
  return Settings.merge(Settings.parse(spec.settings or ""), Settings.parse(spec.once or ""))
end)
if not ok then
  io.stderr:write("tikzflora: " .. tostring(set) .. "\n")
  os.exit(1)
end

spec.layout = set.layout
spec.mix = set.mix
spec.palette = set.palette
spec.spin = set.spin
spec.gilt = set.gilt
spec.gilt_dpi = set.giltdpi
spec.gilt_env = set.giltenv
spec.gilt_look = set.giltlook
spec.backdrop = set.backdrop
spec.seed = Init.seed(set.seed or spec.doc_seed or "1", spec.page)

local cache_key = require("flora.cache").key(spec, set)
local fingerprint = (cache_key or spec_text) .. "\n"
local key_path = out .. ".key"
local old = io.open(key_path, "rb")
local old_key = old and old:read("a")
if old then old:close() end
local pdf = io.open(out, "rb")
local exists = pdf ~= nil
if pdf then pdf:close() end

if set.cache == false or old_key ~= fingerprint or not exists then
  Paint.reset_resources()
  local pt = Compose.page(spec)
  local tmp = out .. ".tmp.pdf"
  Pdf.write(tmp, pt, spec.width, spec.height)
  os.remove(out)
  assert(os.rename(tmp, out))
  local key_file = assert(io.open(key_path, "wb"))
  key_file:write(fingerprint)
  key_file:close()
  io.write(string.format("tikzflora: page %d grown (%d painted objects)\n", spec.page, pt.count))
else
  io.write(string.format("tikzflora: page %d from cache\n", spec.page))
end
