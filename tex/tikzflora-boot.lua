-- LuaTeX resolves `require` through kpathsea only. Register a searcher for
-- the repository's lua/ directory so the generator needs no installation.

local root = os.getenv("FLORA_LUA") or "./lua"

table.insert(package.searchers, 2, function(name)
  local file = root .. "/" .. name:gsub("%.", "/") .. ".lua"
  local chunk, err = loadfile(file)
  if chunk then
    return chunk, file
  end
  if err and not err:find("No such file") and not err:find("cannot open") then
    error(err)
  end
  return "\n\tno file '" .. file .. "'"
end)

flora = require("flora.init")
