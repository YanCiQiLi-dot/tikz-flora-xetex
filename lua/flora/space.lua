-- Occupancy grid over the page. Cells are blocked by text, outside the
-- allowed region, or by elements already placed; queries answer how much
-- free room surrounds a point.

local S = {}
S.__index = S

local floor, ceil, sqrt = math.floor, math.ceil, math.sqrt

-- `cell` is the grid pitch in pt. Every cell starts blocked; call `open`
-- to mark the regions flora may grow in.
function S.new(width, height, cell)
  cell = cell or 3
  local nx, ny = ceil(width / cell), ceil(height / cell)
  local g = setmetatable({ w = width, h = height, c = cell, nx = nx, ny = ny, v = {} }, S)
  for i = 0, nx * ny - 1 do g.v[i] = 1 end
  return g
end

function S:_idx(i, j)
  return j * self.nx + i
end

function S:_set_rect(x0, y0, x1, y1, val)
  local c = self.c
  local i0, i1 = math.max(0, floor(x0 / c)), math.min(self.nx - 1, ceil(x1 / c) - 1)
  local j0, j1 = math.max(0, floor(y0 / c)), math.min(self.ny - 1, ceil(y1 / c) - 1)
  for j = j0, j1 do
    for i = i0, i1 do self.v[self:_idx(i, j)] = val end
  end
end

-- 0 = free, 1 = outside the growing region, 2 = text, 3 = placed element,
-- 4 = a stem's corridor (a placed element that leaves may grow over).
function S:open(x0, y0, x1, y1) self:_set_rect(x0, y0, x1, y1, 0) end
function S:block_text(x0, y0, x1, y1) self:_set_rect(x0, y0, x1, y1, 2) end

-- Is the cell at (x, y) free? With `over_stems`, stem corridors count as
-- free too.
function S:free(x, y, over_stems)
  local i, j = floor(x / self.c), floor(y / self.c)
  if i < 0 or j < 0 or i >= self.nx or j >= self.ny then return false end
  local v = self.v[self:_idx(i, j)]
  return v == 0 or (over_stems and v == 4)
end

-- Is the point inside the growing region and clear of text? Placed elements
-- do not count, so stems may pass under leaves.
function S:open_at(x, y)
  local i, j = floor(x / self.c), floor(y / self.c)
  if i < 0 or j < 0 or i >= self.nx or j >= self.ny then return false end
  local v = self.v[self:_idx(i, j)]
  return v == 0 or v == 3 or v == 4
end

-- Radius of the largest free disk centred at (x, y), up to `maxr`. With
-- `over_stems`, stem corridors count as free (for leaves, which are painted
-- over the stems).
function S:clearance(x, y, maxr, over_stems)
  if not self:free(x, y, over_stems) then return 0 end
  local c = self.c
  local ci, cj = floor(x / c), floor(y / c)
  local rings = ceil(maxr / c)
  -- Square rings are scanned outward; a blocked cell in ring r lies at least
  -- r cells away, so once r cells exceed the best distance found, stop.
  local best = maxr + c
  local nx, ny, v = self.nx, self.ny, self.v
  -- Cell (ci + di, cj + dj) is blocked or off the grid; if it is nearer
  -- than the best so far, it becomes the best.
  local function test(di, dj)
    local d = sqrt(di * di + dj * dj) * c
    if d < best then
      local i, j = ci + di, cj + dj
      local cv = (i >= 0 and j >= 0 and i < nx and j < ny) and v[self:_idx(i, j)]
      if not cv or (cv ~= 0 and not (over_stems and cv == 4)) then
        best = d
      end
    end
  end
  for r = 1, rings do
    if (r - 1) * c >= best then break end
    -- Only the ring's edge: its top and bottom rows, then the sides.
    for di = -r, r do
      test(di, -r)
      test(di, r)
    end
    for dj = -r + 1, r - 1 do
      test(-r, dj)
      test(r, dj)
    end
  end
  return math.min(maxr, math.max(0, best - c))
end

-- Mark a disk as taken by a placed element (`val` 3, the default) or a
-- stem's corridor (4).
function S:reserve(x, y, r, val)
  local c = self.c
  local i0, i1 = math.max(0, floor((x - r) / c)), math.min(self.nx - 1, floor((x + r) / c))
  local j0, j1 = math.max(0, floor((y - r) / c)), math.min(self.ny - 1, floor((y + r) / c))
  for j = j0, j1 do
    for i = i0, i1 do
      local cx, cy = (i + 0.5) * c, (j + 0.5) * c
      if (cx - x) ^ 2 + (cy - y) ^ 2 <= r * r then
        local k = self:_idx(i, j)
        if self.v[k] == 0 then self.v[k] = val or 3 end
      end
    end
  end
end

-- Reserve along a polyline with the given radius.
function S:reserve_line(pts, r, val)
  if type(r) == "table" then
    for i = 1, #pts do self:reserve(pts[i][1], pts[i][2], r[i], val) end
    return
  end
  for i = 1, #pts, 2 do self:reserve(pts[i][1], pts[i][2], r, val) end
end

-- Free cells, as centre points, in a deterministic order.
function S:free_cells(step)
  local out = {}
  step = step or 1
  for j = 0, self.ny - 1, step do
    for i = 0, self.nx - 1, step do
      if self.v[self:_idx(i, j)] == 0 then
        out[#out + 1] = { (i + 0.5) * self.c, (j + 0.5) * self.c }
      end
    end
  end
  return out
end

-- Fraction of the open region (free or placed) that is placed.
function S:coverage()
  local free, placed = 0, 0
  for k = 0, self.nx * self.ny - 1 do
    local v = self.v[k]
    if v == 0 then free = free + 1 elseif v == 3 or v == 4 then placed = placed + 1 end
  end
  if free + placed == 0 then return 1 end
  return placed / (free + placed)
end

return S
