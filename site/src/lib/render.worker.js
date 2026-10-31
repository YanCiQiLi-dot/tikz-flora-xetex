// Runs the tikz-flora generator (lua/flora/*.lua) under wasmoon, Lua 5.4
// in WebAssembly. `just test-lua54` checks it paints exactly what LuaLaTeX
// paints. Messages:
//   { id, kind: "meta" }            -> { id, meta }  settings to offer
//   { id, kind: "render", spec, seed, page, mix, palette }
//                                   -> { id, pdf: Uint8Array, ms }
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
for _, p in ipairs({ "hero", "blooms", "leaves", "leaflets", "stems" }) do
  parts[#parts + 1] = "[" .. q(p) .. "," .. q(Tune.color.palette[p]) .. "]"
end
local groups, inks = {}, {}
for _, g in ipairs(Inks.group_order) do groups[#groups + 1] = q(g) end
for _, n in ipairs(Inks.order) do inks[#inks + 1] = q(n) end
return "{\\"kinds\\":[" .. table.concat(kinds, ",") .. "],\\"parts\\":[" .. table.concat(parts, ",")
  .. "],\\"groups\\":[" .. table.concat(groups, ",") .. "],\\"inks\\":[" .. table.concat(inks, ",") .. "]}"
`;

onmessage = async (e) => {
  const { id, kind } = e.data;
  try {
    const l = await lua();
    if (kind === "meta") {
      postMessage({ id, meta: JSON.parse(await l.doString(META)) });
      return;
    }
    const { spec, seed, page, mix, palette } = e.data;
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
      spec.palette = ${table(palette)}
      Paint.reset_resources()
      return Pdf.encode(Compose.page(spec), spec.width, spec.height)`);
    const bytes = new TextEncoder().encode(pdf);
    postMessage({ id, pdf: bytes, ms: Math.round(performance.now() - t0) }, [bytes.buffer]);
  } catch (err) {
    postMessage({ id, error: String(err && err.message || err) });
  }
};
