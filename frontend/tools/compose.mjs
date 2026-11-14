// Compose realistic body: MakeHuman CC0 skin + Z-Anatomy (CC BY-SA 4.0) skeleton & organs, aligned to the skin.
import fs from 'node:fs'
import { NodeIO, Document } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dequantize, clearNodeTransform, weld } from '@gltf-transform/functions'
import { MeshoptDecoder } from 'meshoptimizer'
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
const ZA = '/home/claude/models/za/', OUT = process.argv[2]

async function load(file) {
  const d = await io.read(file)
  await d.transform(dequantize())
  for (const n of d.getRoot().listNodes()) if (n.getMesh()) clearNodeTransform(n)
  const out = []
  for (const m of d.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    const pos = Array.from(p.getAttribute('POSITION').getArray())
    const idx = p.getIndices() ? Array.from(p.getIndices().getArray()) : [...Array(pos.length / 3).keys()]
    out.push({ pos, idx })
  }
  // merge primitives
  const pos = [], idx = []
  for (const o of out) { const base = pos.length / 3; pos.push(...o.pos); idx.push(...o.idx.map((i) => i + base)) }
  return { pos, idx }
}
const each = (g, f) => { for (let i = 0; i < g.pos.length; i += 3) { const r = f(g.pos[i], g.pos[i + 1], g.pos[i + 2]); g.pos[i] = r[0]; g.pos[i + 1] = r[1]; g.pos[i + 2] = r[2] } }
const verts = (g, pred = () => true) => { const v = []; for (let i = 0; i < g.pos.length; i += 3) if (pred(g.pos[i], g.pos[i + 1], g.pos[i + 2])) v.push([g.pos[i], g.pos[i + 1], g.pos[i + 2]]); return v }
const mean = (v) => v.reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], [0, 0, 0]).map((x) => x / Math.max(1, v.length))

// ---- skin (MakeHuman, decimetres → metres, floor at 0)
const skin = await load('/home/claude/models/mh_base.glb')
const MH_FLOOR = Math.min(...verts(skin).map((v) => v[1]))
each(skin, (x, y, z) => [x * 0.1, (y - MH_FLOOR) * 0.1, z * 0.1])
const J = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync('/home/claude/models/mh_joints.json'))).map(([k, [x, y, z]]) => [k, [x * 0.1, (y - MH_FLOOR) * 0.1, z * 0.1]]))
const H = Math.max(...verts(skin).map((v) => v[1]))
console.log('skin height', H.toFixed(3))

// ---- anatomy: uniform scale to skin height, then z-align at chest
const S = H / 1.706
const parts = {
  cranium: await load(ZA + 'cranium--extracranial_bones_of_head.glb'),
  spine: await load(ZA + 'vertebral_column.glb'),
  ribs: await load(ZA + 'thoracic_skeleton.glb'),
  legs: await load(ZA + 'auditory_ossicles--bones_of_lower_limb.glb'),
  arms: await load(ZA + 'bones_of_upper_limb.glb'),
  brain: await load(ZA + 'brain.glb'),
  heart: await load(ZA + 'arterial_system.glb'),
  lungs: await load(ZA + 'thoracic_cavity.glb'),
  airway: await load(ZA + 'endocrine_glands--respiratory_system.glb'),
}
// keep only trachea/bronchi/thyroid from the airway file (drop pelvic endocrine organs)
{
  const g = parts.airway, keep = []
  for (let t = 0; t < g.idx.length; t += 3) { const c = [0, 1, 2].map((k) => g.pos[g.idx[t + k] * 3 + 1]); if (Math.min(...c) > 1.2) keep.push(g.idx[t], g.idx[t + 1], g.idx[t + 2]) }
  g.idx = keep
}
for (const g of Object.values(parts)) each(g, (x, y, z) => [x * S, y * S, z * S])

// z offset: centre of rib cage depth vs skin depth at the same height band
const band = (g, y0, y1) => { const v = verts(g, (x, y) => y > y0 && y < y1 && Math.abs(x) < 0.12); const zs = v.map((p) => p[2]); return [Math.min(...zs), Math.max(...zs)] }
const yC = J['spine-1'][1]
const [sz0, sz1] = band(skin, yC - 0.03, yC + 0.03), [rz0, rz1] = band(parts.ribs, yC - 0.03, yC + 0.03)
const dz = (sz0 + sz1) / 2 - (rz0 + rz1) / 2 - 0.004
console.log('chest skin z', sz0.toFixed(3), sz1.toFixed(3), 'ribs z', rz0.toFixed(3), rz1.toFixed(3), 'dz', dz.toFixed(3))
for (const g of Object.values(parts)) each(g, (x, y, z) => [x, y, z + dz])
// torso: squeeze depth so ribs/spine/organs sit inside the (slimmer) MakeHuman torso
{
  const cz = (sz0 + sz1) / 2, f = ((sz1 - sz0) / (rz1 - rz0)) * 0.86
  for (const k of ['ribs', 'spine', 'lungs', 'heart', 'airway']) each(parts[k], (x, y, z) => (y > 0.85 ? [x, y, cz + (z - cz) * f] : [x, y, z]))
  console.log('torso z scale', f.toFixed(3))
}
// head: fit cranium + brain into the skin head by bounding box (above the jaw)
{
  const yCut = J['head'][1] + 0.02
  const bb = (v) => [0, 1, 2].map((a) => [Math.min(...v.map((p) => p[a])), Math.max(...v.map((p) => p[a]))])
  const hb = bb(verts(skin, (x, y) => y > yCut)), cb = bb(verts(parts.cranium, (x, y) => y > yCut))
  const sc = Math.min((hb[0][1] - hb[0][0]) / (cb[0][1] - cb[0][0]), (hb[2][1] - hb[2][0]) / (cb[2][1] - cb[2][0])) * 0.9
  const hc = hb.map(([a, b]) => (a + b) / 2), cc = cb.map(([a, b]) => (a + b) / 2)
  // keep the top of the skull just under the scalp
  const topSkin = hb[1][1], topSkull = cc[1] + (cb[1][1] - cc[1]) * sc
  const dy = topSkin - 0.008 - topSkull
  for (const k of ['cranium', 'brain']) each(parts[k], (x, y, z) => [hc[0] + (x - cc[0]) * sc, cc[1] + (y - cc[1]) * sc + dy, hc[2] + (z - cc[2]) * sc])
  console.log('head scale', sc.toFixed(3), 'dy', dy.toFixed(3))
}

// ---- legs: shear each leg outwards so the ankle matches the skin's A-pose stance
{
  const g = parts.legs
  for (const side of [1, -1]) {
    const hip = mean(verts(g, (x, y) => x * side > 0.05 && y > 0.86 && y < 0.9)) // femoral head region
    const zaAnk = mean(verts(g, (x, y) => x * side > 0.03 && y > 0.05 && y < 0.1))
    const mhAnk = J[side > 0 ? 'l-ankle' : 'r-ankle'], mhHip = J[side > 0 ? 'l-upper-leg' : 'r-upper-leg']
    const yHip = mhHip[1]
    const k = (mhAnk[0] - zaAnk[0]) / (yHip - zaAnk[1])
    const kz = (mhAnk[2] - zaAnk[2]) / (yHip - zaAnk[1])
    each(g, (x, y, z) => (x * side > 0.02 && y < yHip ? [x + k * (yHip - y), y, z + kz * (yHip - y) + (y < 0.11 ? 0.025 * (1 - y / 0.11) : 0)] : [x, y, z]))
    console.log('leg', side, 'k', k.toFixed(3), 'hip za', hip.map((v) => v.toFixed(3)).join(','), 'mh', mhHip.map((v) => v.toFixed(3)).join(','))
  }
}

// ---- arms: rotate each arm (in the frontal plane) around the shoulder to the skin's A-pose
{
  const g = parts.arms
  const newPos = g.pos.slice()
  for (const side of [1, -1]) {
    const sideV = verts(g, (x) => x * side > 0.05)
    const top = Math.max(...sideV.map((v) => v[1]))
    const piv = mean(verts(g, (x, y) => x * side > 0.14 && y > top - 0.07))
    const low = sideV.reduce((a, b) => (b[1] < a[1] ? b : a))
    const mhSh = J[side > 0 ? 'l-shoulder' : 'r-shoulder']
    const mhTip = verts(skin, (x) => x * side > 0.3).reduce((a, b) => (Math.abs(b[0]) > Math.abs(a[0]) ? b : a))
    // full 3D rotation from the bone arm direction to the skin arm direction
    const d0 = [low[0] - piv[0], low[1] - piv[1], low[2] - piv[2]], d1 = [mhTip[0] - mhSh[0], mhTip[1] - mhSh[1], mhTip[2] - mhSh[2]]
    const n0 = Math.hypot(...d0), n1 = Math.hypot(...d1), u0 = d0.map((v) => v / n0), u1 = d1.map((v) => v / n1)
    let ax = [u0[1] * u1[2] - u0[2] * u1[1], u0[2] * u1[0] - u0[0] * u1[2], u0[0] * u1[1] - u0[1] * u1[0]]
    const sa = Math.hypot(...ax); ax = ax.map((v) => v / sa)
    const ang = Math.atan2(sa, u0[0] * u1[0] + u0[1] * u1[1] + u0[2] * u1[2]), lenR = n1 / n0
    console.log('arm', side, 'rot deg', ((ang * 180) / Math.PI).toFixed(1), 'len ratio', lenR.toFixed(3))
    const rot = (v, a) => { const c = Math.cos(a), s = Math.sin(a), d = ax[0] * v[0] + ax[1] * v[1] + ax[2] * v[2]
      const cr = [ax[1] * v[2] - ax[2] * v[1], ax[2] * v[0] - ax[0] * v[2], ax[0] * v[1] - ax[1] * v[0]]
      return [0, 1, 2].map((k) => v[k] * c + cr[k] * s + ax[k] * d * (1 - c)) }
    for (let i = 0; i < g.pos.length; i += 3) {
      const x = g.pos[i], y = g.pos[i + 1], z = g.pos[i + 2]
      if (x * side <= 0.05) continue
      const w = Math.min(1, Math.max(0, (piv[1] + 0.015 - y) / 0.06)) * Math.min(1, Math.max(0, (x * side - 0.1) / 0.05))
      const r = rot([x - piv[0], y - piv[1], z - piv[2]], ang * w), L = 1 + (lenR - 1) * w
      for (let k = 0; k < 3; k++) newPos[i + k] = piv[k] + r[k] * L + (mhSh[k] - piv[k]) * w
    }
  }
  g.pos = newPos
}

// ---- write one GLB with named meshes
const doc = new Document(); const buf = doc.createBuffer(); const scene = doc.createScene()
const add = (name, groups) => {
  const pos = [], idx = []
  for (const g of groups) { const b = pos.length / 3; pos.push(...g.pos); idx.push(...g.idx.map((i) => i + b)) }
  const P = doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buf)
  const I = doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buf)
  const prim = doc.createPrimitive().setAttribute('POSITION', P).setIndices(I)
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)))
}
add('skin', [skin])
add('skeleton', [parts.cranium, parts.spine, parts.ribs, parts.legs, parts.arms])
add('brain', [parts.brain]); add('heart', [parts.heart]); add('lungs', [parts.lungs, parts.airway])
await io.write(OUT, doc)
const c = (g) => mean(verts(g)).map((v) => +v.toFixed(4))
fs.writeFileSync(OUT.replace(/\.glb$/, '.anchors.json'), JSON.stringify({ height: +H.toFixed(4), joints: Object.fromEntries(Object.entries(J).map(([k, v]) => [k, v.map((x) => +x.toFixed(4))])), organs: { brain: c(parts.brain), heart: c(parts.heart), lungs: c(parts.lungs) } }, null, 1))
console.log('done')
