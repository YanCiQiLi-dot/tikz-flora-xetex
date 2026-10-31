-- Draws the ornament gallery (lua/flora/gallery.lua) as a PDF without TeX.
--
--   texlua tools/gallery.lua OUT.pdf [SEEDS] [SETTINGS]
--
-- SETTINGS is a \florasetup key list; its palette applies (for example
-- "palette={cartouche=momiji}"). Run from the repository root.

package.path = "./lua/?.lua;" .. package.path
local Gallery = require("flora.gallery")
local Pdf = require("flora.pdfout")
local Paint = require("flora.paint")
local Mix = require("flora.mix")
local Settings = require("flora.settings")

local out, seeds, extra = arg[1], tonumber(arg[2]) or 3, arg[3]
assert(out, "usage: gallery.lua OUT.pdf [SEEDS] [SETTINGS]")
local set = extra and Settings.parse(extra) or {}
Paint.reset_resources()
local pt, _, w, h = Mix.with_palette(Mix.resolve(set.palette, 1, set.spin), function() return Gallery.sheet(nil, seeds) end)
Pdf.write(out, pt, w, h)
