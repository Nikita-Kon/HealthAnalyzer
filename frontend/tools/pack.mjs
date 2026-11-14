import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { weld, simplify, quantize, meshopt, prune, dedup } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptSimplifier, MeshoptDecoder } from 'meshoptimizer'
await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready, MeshoptDecoder.ready])
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
const [, , src, out, ratio] = process.argv
const doc = await io.read(src)
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: +ratio, error: 0.0008 }), prune(), dedup(), quantize({ quantizePosition: 14 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }))
for (const m of doc.getRoot().listMeshes()) console.log(m.getName(), m.listPrimitives().map(p => p.getIndices().getCount() / 3))
await io.write(out, doc)
