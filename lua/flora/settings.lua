-- Document settings from \florasetup and \florathispage: a key=value list,
-- parsed and checked here so mistakes are reported with the key's name.
--
--   layout   left, right, centered, split, title or surround (frames.lua)
--   seed     a number, or random
--
-- Other keys are registered by the modules they steer (M.define).

local M = {}

local Frames = require("flora.frames")

-- Key name -> function(value string) returning the parsed value, or nil
-- and a message.
local keys = {}

function M.define(name, parse)
  keys[name] = parse
end

M.define("layout", function(v)
  if Frames.layouts[v] then return v end
  return nil, "layout must be one of left, right, centered, split, title, surround"
end)

M.define("seed", function(v)
  if v == "random" or tonumber(v) then return v end
  return nil, "seed must be a number or random"
end)

local function trim(s)
  return (s:gsub("^%s+", ""):gsub("%s+$", ""))
end

-- Split "a=1, b={x=2, y=3}" at top-level commas into {name, value} pairs;
-- braces around a value are removed. A key without "=" has value nil.
function M.parse_list(s)
  local out, depth, start = {}, 0, 1
  local function take(piece)
    piece = trim(piece)
    if piece == "" then return end
    local k, v = piece:match("^([^=]-)%s*=%s*(.*)$")
    if not k then
      out[#out + 1] = { trim(piece), nil }
      return
    end
    v = trim(v)
    local inner = v:match("^{(.*)}$")
    out[#out + 1] = { trim(k), inner and trim(inner) or v }
  end
  for i = 1, #s do
    local ch = s:sub(i, i)
    if ch == "{" then depth = depth + 1
    elseif ch == "}" then depth = depth - 1
      if depth < 0 then error("unbalanced braces in \"" .. s .. "\"") end
    elseif ch == "," and depth == 0 then
      take(s:sub(start, i - 1))
      start = i + 1
    end
  end
  if depth ~= 0 then error("unbalanced braces in \"" .. s .. "\"") end
  take(s:sub(start))
  return out
end

-- Parse a key=value list into a settings table. Errors name the key.
function M.parse(s)
  local t = {}
  for _, kv in ipairs(M.parse_list(s)) do
    local k, v = kv[1], kv[2]
    local parse = keys[k]
    if not parse then
      local known = {}
      for name in pairs(keys) do known[#known + 1] = name end
      table.sort(known)
      error(string.format("unknown key \"%s\" (known keys: %s)", k, table.concat(known, ", ")))
    end
    if v == nil then error(string.format("key \"%s\" needs a value", k)) end
    local val, msg = parse(v)
    if val == nil then error(string.format("%s: %s (got \"%s\")", k, msg, v)) end
    t[k] = val
  end
  return t
end

-- Merge settings table `over` onto `base`, returning a new table. Table
-- values (such as mix) merge key by key.
function M.merge(base, over)
  local t = {}
  for k, v in pairs(base or {}) do t[k] = v end
  for k, v in pairs(over or {}) do
    if type(v) == "table" and type(t[k]) == "table" then
      local m = {}
      for a, b in pairs(t[k]) do m[a] = b end
      for a, b in pairs(v) do m[a] = b end
      t[k] = m
    else
      t[k] = v
    end
  end
  return t
end

return M
