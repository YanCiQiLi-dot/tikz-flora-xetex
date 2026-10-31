// Runs the tikz-flora generator (lua/flora/*.lua) under wasmoon, Lua 5.4
// in WebAssembly. `just test-lua54` checks it paints exactly what LuaLaTeX
// paints. Messages:
//   { id, kind: "meta" }            -> { id, meta }  settings to offer, with
//                                      each ink's ramp and each group's inks
//   { id, kind: "render", spec, seed, page, mix, ornaments, palette, spin }
//                                   -> { id, pdf: Uint8Array, ms }
//   { id, kind: "gallery", palette, spin, base }
//                                   -> { id, pdf, cells, w, h }  every
//                                      ornament kind (gallery.lua), with
//                                      where to label each
import { LuaFactory } from "wasmoon";
import wasmUrl from "wasmoon/dist/glue.wasm?url";

const sources = import.meta.glob("../../../lua/flora/*.lua", { query: "?raw", import: "default", eager: true });

let engine;
async function lua() {
  engine ||= (async () => {
    const factory = new LuaFactory(wasmUrl);
    for (const [path, src] of Object.entries(sources)) {
      await factory.mountFile(`/lua/flora/${path.split("/").pop()}`, src);
    }
    const l = await factory.createEngine();
    await l.doString('package.path = "/lua/?.lua;" .. package.path');
    return l;
  })();
  return engine;
}

// A Lua table literal for {name: value}, names checked to be identifiers.
function table(obj) {
  const parts = [];
  for (const [k, v] of Object.entries(obj || {})) {
    if (!/^[a-z_][a-z0-9_]*$/.test(k)) throw new Error(`bad key ${k}`);
    if (typeof v === "number" && Number.isFinite(v)) parts.push(`${k}=${v}`);
    else if (typeof v === "string") parts.push(`${k}=${JSON.stringify(v)}`);
  }
  return `{${parts.join(",")}}`;
}

const META = `
local Tune = require("flora.tune")
local Inks = require("flora.inks")
local Mix = require("flora.mix")
local Orn = require("flora.ornaments")
local function q(s) return '"' .. tostring(s):gsub('[\\\\"]', '\\\\%0') .. '"' end
local function doc(path)
  local d = Tune._doc[path] or {}
  return q(d[1] or path) .. "," .. q(d[2] or "")
end
local kinds = {}
local order = {}
for _, k in ipairs(Mix.motifs) do order[#order + 1] = k end
for _, k in ipairs({ "leaves", "leaflets", "sprays", "curls", "density" }) do order[#order + 1] = k end
for _, k in ipairs(Mix.visitors) do order[#order + 1] = k end
for _, k in ipairs(order) do
  kinds[#kinds + 1] = "[" .. q(k) .. "," .. doc("mix." .. k) .. "," .. Tune.mix[k] .. "]"
end
local parts = {}
for _, p in ipairs({ "hero", "blooms", "leaves", "leaflets", "stems", "sprays", "ghost", "cartouche" }) do
  parts[#parts + 1] = "[" .. q(p) .. "," .. q(Tune.color.palette[p]) .. "]"
end
local groups, inks, ramps, members = {}, {}, {}, {}
for _, g in ipairs(Inks.group_order) do
  groups[#groups + 1] = q(g)
  local ns = {}
  for _, n in ipairs(Inks.groups[g]) do ns[#ns + 1] = q(n) end
  members[#members + 1] = q(g) .. ":[" .. table.concat(ns, ",") .. "]"
end
for _, n in ipairs(Inks.order) do
  inks[#inks + 1] = q(n)
  local stops = {}
  for _, st in ipairs(Inks.ramps[n]) do
    stops[#stops + 1] = string.format("[%.4f,%.4f,%.4f]", st[1], st[2], st[3])
  end
  ramps[#ramps + 1] = q(n) .. ":[" .. table.concat(stops, ",") .. "]"
end
local slots = {}
for _, slot in ipairs(Orn.slot_order) do
  local ks = {}
  for _, k in ipairs(Orn.of(slot)) do ks[#ks + 1] = "[" .. q(k.name) .. "," .. q(k.label) .. "," .. Orn.weight(nil, k.name) .. "]" end
  local s = Orn.slots[slot]
  slots[#slots + 1] = "{\\"slot\\":" .. q(slot) .. ",\\"label\\":" .. q(s.label) .. ",\\"desc\\":" .. q(s.desc)
    .. ",\\"kinds\\":[" .. table.concat(ks, ",") .. "]}"
end
return "{\\"kinds\\":[" .. table.concat(kinds, ",") .. "],\\"ornaments\\":[" .. table.concat(slots, ",") .. "],\\"parts\\":[" .. table.concat(parts, ",")
  .. "],\\"groups\\":[" .. table.concat(groups, ",") .. "],\\"inks\\":[" .. table.concat(inks, ",")
  .. "],\\"ramps\\":{" .. table.concat(ramps, ",") .. "},\\"groupInks\\":{" .. table.concat(members, ",") .. "}}"
`;

onmessage = async (e) => {
  const { id, kind } = e.data;
  try {
    const l = await lua();
    if (kind === "meta") {
      postMessage({ id, meta: JSON.parse(await l.doString(META)) });
      return;
    }
    if (kind === "gallery") {
      const { palette, spin, base } = e.data;
      const pdf = await l.doString(`
        local Gallery = require("flora.gallery")
        local Mix = require("flora.mix")
        local Paint = require("flora.paint")
        local Pdf = require("flora.pdfout")
        Paint.reset_resources()
        local pal = Mix.resolve(${table(palette)}, 1, ${Number(spin) | 0})
        local pt, cells, w, h = Mix.with_palette(pal, function() return Gallery.sheet(nil, 3, 560, ${Number(base) | 0}) end)
        local rows = {}
        for _, c in ipairs(cells) do
          if c.seed == 1 then
            rows[#rows + 1] = string.format('{"name":"%s","label":"%s","slot":"%s","x":%.1f,"y":%.1f}',
              c.name, c.label, c.slot, c.box[1], h - c.box[4] - c.lift)
          end
        end
        GALLERY = string.format('{"w":%.1f,"h":%.1f,"cells":[%s]}', w, h, table.concat(rows, ","))
        return Pdf.encode(pt, w, h)`);
      const { w, h, cells } = JSON.parse(await l.doString("return GALLERY"));
      const bytes = new TextEncoder().encode(pdf);
      postMessage({ id, pdf: bytes, cells, w, h }, [bytes.buffer]);
      return;
    }
    const { spec, seed, page, mix, ornaments, palette, spin } = e.data;
    const t0 = performance.now();
    l.global.set("SPEC", spec);
    l.global.set("SEED", String(seed));
    const pdf = await l.doString(`
      local Serial = require("flora.serial")
      local Paint = require("flora.paint")
      local Compose = require("flora.compose")
      local Pdf = require("flora.pdfout")
      local Init = require("flora.init")
      local spec = Serial.decode(SPEC)
      spec.seed = Init.seed(SEED, ${Number(page) | 0})
      spec.mix = ${table(mix)}
      spec.ornaments = ${table(ornaments)}
      spec.palette = ${table(palette)}
      spec.spin = ${Number(spin) | 0}
      Paint.reset_resources()
      return Pdf.encode(Compose.page(spec), spec.width, spec.height)`);
    const bytes = new TextEncoder().encode(pdf);
    postMessage({ id, pdf: bytes, ms: Math.round(performance.now() - t0) }, [bytes.buffer]);
  } catch (err) {
    postMessage({ id, error: String(err && err.message || err) });
  }
};
