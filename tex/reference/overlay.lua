-- TikZ overlays for tex/reference.tex: the fitted page plane drawn on the
-- original photo, and the traced stem splines drawn on the de-warped photo.
-- Inputs come from `just trace`; coordinates there are image pixels with y
-- pointing down.

local R = {}
local dir = "tex/reference/"
local fmt = string.format

-- The trace files are plain JSON of numbers, arrays and string keys, which
-- map directly onto Lua table constructors.
local function json(name)
  local f = assert(io.open(dir .. name, "r"))
  local s = f:read("a")
  f:close()
  s = s:gsub("%[", "{"):gsub("%]", "}"):gsub('"([%w_]+)"%s*:', "%1=")
  return assert(load("return " .. s, name, "t", {}))()
end

local function inverse(m)
  local a, b, c = m[1][1], m[1][2], m[1][3]
  local d, e, f = m[2][1], m[2][2], m[2][3]
  local g, h, i = m[3][1], m[3][2], m[3][3]
  local det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
  return {
    { (e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det },
    { (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det },
    { (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det },
  }
end

local function apply(m, x, y)
  local w = m[3][1] * x + m[3][2] * y + m[3][3]
  return (m[1][1] * x + m[1][2] * y + m[1][3]) / w, (m[2][1] * x + m[2][2] * y + m[2][3]) / w
end

-- Pixel (x, y) in an image `h` px tall, drawn at `s` pt per px.
local function pt(x, y, h, s)
  return fmt("(%.2fpt,%.2fpt)", x * s, (h - y) * s)
end

local function path(pts)
  return table.concat(pts, " -- ")
end

-- Fill the page with the image: `name` at `w` x `h` px, `s` pt per px.
local function image(file, w, h, s)
  tex.print(fmt("\\useasboundingbox (0,0) rectangle (%.2fpt,%.2fpt);", w * s, h * s))
  tex.print(fmt("\\node[anchor=south west,inner sep=0] at (0,0) {\\includegraphics[width=%.2fpt]{%s}};",
    w * s, file))
end

-- Page 1: the original photo with the four fitted page corners and the
-- rectified pixel grid mapped back through the inverse homography.
function R.photo(file, w, h, s)
  local H = json("homography.json")
  local off = json("viewport.json").offset
  local curves = json("curves.json")
  local inv = inverse(H.H)
  image(file, w, h, s)
  local rw, rh = curves.size[1], curves.size[2]
  -- Rectified pixel (u, v) -> photo point, as a TikZ coordinate.
  local function back(u, v)
    local x, y = apply(inv, u + off[1], v + off[2])
    return pt(x, y, h, s)
  end
  local style = "draw=cyan!70!black,line width=0.35pt,opacity=0.75"
  for u = 0, rw, 100 do
    local pts = {}
    for v = 0, rh, 50 do pts[#pts + 1] = back(u, v) end
    pts[#pts + 1] = back(u, rh)
    tex.print(fmt("\\draw[%s] %s;", style, path(pts)))
  end
  for v = 0, rh, 100 do
    local pts = {}
    for u = 0, rw, 50 do pts[#pts + 1] = back(u, v) end
    pts[#pts + 1] = back(rw, v)
    tex.print(fmt("\\draw[%s] %s;", style, path(pts)))
  end
  local c = H.src
  local quad = { pt(c[1][1], c[1][2], h, s), pt(c[2][1], c[2][2], h, s),
                 pt(c[4][1], c[4][2], h, s), pt(c[3][1], c[3][2], h, s) }
  tex.print(fmt("\\draw[magenta,line width=1pt] %s -- cycle;", path(quad)))
  for _, q in ipairs(c) do
    tex.print(fmt("\\fill[magenta] %s circle (2pt);", pt(q[1], q[2], h, s)))
  end
end

local palette = { "magenta", "green!70!black", "orange", "violet", "cyan!80!black" }

-- Page 2: the de-warped photo with every traced stem spline, numbered at
-- its first point in tracing order (longest first).
function R.rectified(file)
  local d = json("curves.json")
  local w, h, s = d.size[1], d.size[2], d.pt_per_px
  image(file, w, h, s)
  for i, c in ipairs(d.curves) do
    local pts = {}
    for _, p in ipairs(c) do pts[#pts + 1] = pt(p[1], p[2], h, s) end
    local col = palette[(i - 1) % #palette + 1]
    tex.print(fmt("\\draw[%s,line width=0.9pt,opacity=0.85,line cap=round,line join=round] %s;",
      col, path(pts)))
    tex.print(fmt("\\node[font=\\sffamily\\tiny,text=%s,fill=white,fill opacity=0.7,text opacity=1,"
      .. "inner sep=0.6pt] at %s {%d};", col, pts[1], i))
  end
end

-- Width of the rectified photo at page scale, in pt.
function R.width_pt()
  local d = json("curves.json")
  return string.format("%.2f", d.size[1] * d.pt_per_px)
end

return R
