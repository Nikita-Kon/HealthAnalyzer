# Body model pipeline (`src/assets/body.glb`)

The 3D body is built offline once; the app only ships the result (~350 KB).

1. **Skin** — MakeHuman base mesh `hm08` (CC0), `makehuman/data/3dobjs/base.obj` + `macrodetails/universal-male-young-maxmuscle-averageweight.target` at 0.55.
   `python3 mh2glb.py base.obj mh_base.glb mh_joints.json <target>=0.55` → skin mesh + joint centres.
2. **Skeleton & organs** — Z-Anatomy / BodyParts3D (CC BY-SA 4.0) via the `authorOd/3d-anatomy-atlas` data package
   (`releases/1.2.0/economy`): cranium, vertebral column, thoracic skeleton, bones of upper/lower limb, brain,
   arterial system (heart), thoracic cavity (lungs), respiratory system (trachea only).
3. `MODELS_DIR=./models node compose.mjs body_raw.glb` (expects `mh_base.glb`, `mh_joints.json` and `za/*.glb` there) aligns everything to the skin: uniform scale to height, chest-depth fit,
   head bbox fit, legs sheared to the A-pose stance, arms rotated in 3D around the shoulder. Writes `body_raw.anchors.json`.
4. `node pack.mjs body_raw.glb body.glb 0.55` — weld, simplify, quantize, meshopt.

Needs `@gltf-transform/core @gltf-transform/functions @gltf-transform/extensions meshoptimizer` and `trimesh` (Python).
Attribution must stay in the app footer (CC BY-SA 4.0 for the anatomy geometry).
