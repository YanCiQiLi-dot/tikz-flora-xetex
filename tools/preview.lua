-- Draws one page's flora without TeX, for fast previews.
--
--   texlua tools/preview.lua SPEC SEED PAGE OUT.pdf
--
-- SPEC is a layout written during a real compile with FLORA_SPEC_DIR set
-- (page size, text block and measured lines). The flora is grown exactly as
-- in that compile, for document seed SEED on page PAGE, and written as a
-- one-page PDF holding the flora alone; the text comes from that compile's
-- own pages. FLORA_TUNE applies as usual. Run from the repository root.

package.path = "./lua/?.lua;" .. package.path
local Serial = require("flora.serial")
local Paint = require("flora.paint")
local Compose = require("flora.compose")
local Init = require("flora.init")
local Pdf = require("flora.pdfout")

local spec_path, seed, page, out = arg[1], arg[2], tonumber(arg[3]), arg[4]
assert(spec_path and seed and page and out, "usage: preview.lua SPEC SEED PAGE OUT.pdf")
local f = assert(io.open(spec_path))
local spec = Serial.decode(f:read("a"))
f:close()
spec.seed = Init.seed(seed, page)

Paint.reset_resources()
local pt = Compose.page(spec)
Pdf.write(out, pt, spec.width, spec.height)
