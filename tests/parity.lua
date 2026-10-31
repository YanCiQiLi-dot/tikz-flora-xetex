-- Writes the painted page for a fixed spec to arg[1], so the output under
-- texlua (Lua 5.3, as in LuaLaTeX) can be compared byte for byte with Lua
-- 5.4 (the browser mixer's wasmoon). `just test-lua54` runs it.
local H = dofile("tests/helper.lua")
local Compose = require("flora.compose")
local Paint = require("flora.paint")
local f = assert(io.open(arg[1], "wb"))
for _, case in ipairs({ { 3, nil, nil }, { 4, "surround", { bee = 1, bird = 1, butterfly = 1, snail = 1 } } }) do
  Paint.reset_resources()
  local s = H.page(case[1], 420)
  s.layout, s.mix, s.page = case[2], case[3], 1
  f:write(Compose.page(s):code(), "\n")
  s.grow = 0.5
  Paint.reset_resources()
  f:write(Compose.page(s):code(), "\n")
end
f:close()
