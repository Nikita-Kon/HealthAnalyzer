// Realistic x-ray body: MakeHuman skin (CC0) + Z-Anatomy skeleton & organs (CC BY-SA 4.0), aligned offline.
// Everything animates by damping toward targets every frame — status changes never "jump".
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerformanceMonitor, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import bodyUrl from '@/assets/body.glb?url'
import anchors from '@/assets/body.anchors.json'
import type { Organ, OrganState } from '@/lib/body'
import type { Status } from '@/lib/status'

const COL: Record<Status, THREE.Color> = {
  nominal: new THREE.Color('#5ad1e6'),
  watch: new THREE.Color('#ffb21f'),
  alert: new THREE.Color('#ff4b4b'),
  unknown: new THREE.Color('#56627a'),
}
const ORGAN_IDLE: Record<Organ, THREE.Color> = {
  brain: new THREE.Color('#9fb4ff'),
  heart: new THREE.Color('#ff8f9c'),
  lungs: new THREE.Color('#8fc6ff'),
  muscles: new THREE.Color('#5ad1e6'),
}
const J = anchors.joints as unknown as Record<string, [number, number, number]>
const O = anchors.organs as unknown as Record<'brain' | 'heart' | 'lungs', [number, number, number]>
const H = anchors.height
const CY = H * 0.5

// ---------- shared x-ray shader ----------
const MAX_SPOTS = 6
const vert = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(normalMatrix * normal);
    vec4 mv = viewMatrix * w;
    vV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }`
const frag = /* glsl */ `
  uniform vec3 uColor; uniform float uFill; uniform float uRim; uniform float uPow; uniform float uTime; uniform float uScan;
  uniform vec3 uSpot[${MAX_SPOTS}]; uniform vec3 uSpotCol[${MAX_SPOTS}]; uniform float uSpotR[${MAX_SPOTS}];
  varying vec3 vN; varying vec3 vV; varying vec3 vW;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow);
    vec3 c = uColor * (uFill + f * uRim);
    // slow scanner sweep + fine scanlines
    float sweep = smoothstep(0.05, 0.0, abs(mod(uTime * 0.16, 1.6) - 0.3 - vW.y / ${H.toFixed(3)})) * uScan;
    float lines = smoothstep(0.9, 1.0, fract(vW.y * 90.0)) * 0.06 * uScan;
    c += uColor * (sweep * 0.9 + lines);
    for (int i = 0; i < ${MAX_SPOTS}; i++) {
      float d = distance(vW, uSpot[i]);
      float g = smoothstep(uSpotR[i], 0.0, d);
      c += uSpotCol[i] * g * g * (0.45 + f * 0.9);
    }
    c = c / (1.0 + c * 0.25);
    gl_FragColor = vec4(c, clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0));
  }`

function xray(color: THREE.Color, fill: number, rim: number, pow: number, scan: number, spots: { pos: THREE.Vector3[]; col: THREE.Color[]; r: number[] }) {
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    premultipliedAlpha: true,
    uniforms: {
      uColor: { value: color.clone() },
      uFill: { value: fill },
      uRim: { value: rim },
      uPow: { value: pow },
      uTime: { value: 0 },
      uScan: { value: scan },
      uSpot: { value: spots.pos },
      uSpotCol: { value: spots.col },
      uSpotR: { value: spots.r },
    },
  })
}

// skin hot-spots per organ (world positions in metres)
const SPOTS: Record<Organ, { p: [number, number, number]; r: number }[]> = {
  brain: [{ p: [0, O.brain[1], O.brain[2] + 0.02], r: 0.15 }],
  heart: [{ p: [O.heart[0] + 0.02, O.heart[1], O.heart[2] + 0.06], r: 0.14 }],
  lungs: [],
  muscles: [
    { p: lerp3(J['l-upper-leg'], J['l-knee'], 0.5), r: 0.2 },
    { p: lerp3(J['r-upper-leg'], J['r-knee'], 0.5), r: 0.2 },
    { p: lerp3(J['l-knee'], J['l-ankle'], 0.4), r: 0.16 },
    { p: lerp3(J['r-knee'], J['r-ankle'], 0.4), r: 0.16 },
  ],
}
function lerp3(a: number[], b: number[], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}
const SPOT_LIST = (['brain', 'heart', 'muscles'] as Organ[]).flatMap((o) => SPOTS[o].map((s) => ({ organ: o, ...s })))

/** label anchor points */
export const LABEL_AT: Record<Organ, [number, number, number]> = {
  brain: [0, O.brain[1] + 0.03, O.brain[2]],
  heart: [O.heart[0], O.heart[1], O.heart[2] + 0.04],
  lungs: [-0.09, O.lungs[1] + 0.05, O.lungs[2]],
  muscles: lerp3(J['l-upper-leg'], J['l-knee'], 0.45),
}

type Props = { organs: OrganState[]; selected: Organ | null; bpm: number; labels: React.RefObject<Map<Organ, HTMLElement>>; interacting: React.RefObject<boolean> }

function Body({ organs, selected, bpm, labels, interacting }: Props) {
  const gltf = useGLTF(bodyUrl, false, true)
  const group = useRef<THREE.Group>(null!)
  const spots = useMemo(
    () => ({
      pos: Array.from({ length: MAX_SPOTS }, (_, i) => new THREE.Vector3(...(SPOT_LIST[i]?.p ?? [0, -10, 0]))),
      col: Array.from({ length: MAX_SPOTS }, () => new THREE.Color(0, 0, 0)),
      r: Array.from({ length: MAX_SPOTS }, (_, i) => SPOT_LIST[i]?.r ?? 0),
    }),
    [],
  )

  // build meshes once per gltf (cached on the object → safe under StrictMode)
  const parts = useMemo(() => {
    const c = gltf as unknown as { __parts?: Record<string, THREE.Mesh> }
    if (c.__parts) return c.__parts
    const out: Record<string, THREE.Mesh> = {}
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      // de-quantize: bake the node transform (KHR_mesh_quantization) into float positions
      const src = m.geometry.attributes.position
      const arr = new Float32Array(src.count * 3)
      for (let i = 0; i < src.count; i++) {
        arr[i * 3] = src.getX(i)
        arr[i * 3 + 1] = src.getY(i)
        arr[i * 3 + 2] = src.getZ(i)
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
      if (m.geometry.index) g.setIndex(Array.from(m.geometry.index.array))
      g.applyMatrix4(m.matrixWorld)
      g.computeVertexNormals()
      const mesh = new THREE.Mesh(g)
      mesh.name = m.name
      out[m.name] = mesh
    })
    const mat = {
      skin: xray(new THREE.Color('#6fd6f2'), 0.05, 1.35, 2.2, 1, spots),
      skeleton: xray(new THREE.Color('#e9eefc'), 0.05, 0.55, 1.6, 0.35, spots),
      brain: xray(ORGAN_IDLE.brain, 0.12, 0.9, 1.4, 0, spots),
      heart: xray(ORGAN_IDLE.heart, 0.16, 0.9, 1.3, 0, spots),
      lungs: xray(ORGAN_IDLE.lungs, 0.05, 0.6, 1.8, 0, spots),
    }
    for (const [k, m] of Object.entries(out)) {
      m.material = mat[k as keyof typeof mat] ?? mat.skin
      m.renderOrder = k === 'skin' ? 3 : k === 'skeleton' ? 1 : 2
      m.frustumCulled = false
    }
    // pivot organs at their centre so they can pulse in place
    for (const k of ['heart', 'lungs'] as const) {
      const m = out[k]
      if (!m) continue
      m.geometry.computeBoundingBox()
      const c = m.geometry.boundingBox!.getCenter(new THREE.Vector3())
      m.geometry.translate(-c.x, -c.y, -c.z)
      m.position.copy(c)
    }
    c.__parts = out
    return out
  }, [gltf, spots])

  const state = useRef(
    Object.fromEntries((['brain', 'heart', 'lungs', 'muscles'] as Organ[]).map((o) => [o, { k: 0, col: ORGAN_IDLE[o].clone() }])) as Record<Organ, { k: number; col: THREE.Color }>,
  )
  const byOrgan = useMemo(() => new Map(organs.map((o) => [o.organ, o])), [organs])
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), c: new THREE.Color() }), [])
  const sway = useRef(0)

  useFrame(({ clock, camera, size }, dt) => {
    const t = clock.getElapsedTime()
    const ease = 1 - Math.exp(-dt * 2.2) // ~0.5 s smoothing, frame-rate independent

    // gentle idle sway unless the user is dragging
    const target = interacting.current ? sway.current : Math.sin(t * 0.22) * 0.32
    sway.current += (target - sway.current) * (interacting.current ? 0 : ease * 0.6)
    group.current.rotation.y = sway.current

    for (const o of ['brain', 'heart', 'lungs', 'muscles'] as Organ[]) {
      const s = byOrgan.get(o)?.status ?? 'unknown'
      const st = state.current[o]
      const flagged = s === 'watch' || s === 'alert'
      const k = (flagged ? (s === 'alert' ? 1 : 0.7) : 0) * (selected && selected !== o ? 0.55 : 1) + (selected === o ? 0.25 : 0)
      st.k += (k - st.k) * ease
      st.col.lerp(flagged ? COL[s] : s === 'unknown' ? COL.unknown : ORGAN_IDLE[o], ease)
    }
    const pulse = 0.75 + 0.25 * Math.sin(t * 3.2)
    SPOT_LIST.forEach((sp, i) => {
      const st = state.current[sp.organ]
      spots.col[i].copy(st.col).multiplyScalar(st.k * pulse * (sp.organ === 'muscles' ? 0.7 : 1))
    })

    const all = Object.values(parts)
    for (const m of all) (m.material as THREE.ShaderMaterial).uniforms.uTime.value = t
    for (const o of ['brain', 'heart', 'lungs'] as const) {
      const m = parts[o]
      if (!m) continue
      const st = state.current[o]
      const u = (m.material as THREE.ShaderMaterial).uniforms
      u.uColor.value.copy(st.col)
      u.uFill.value = (o === 'lungs' ? 0.02 : o === 'brain' ? 0.03 : 0.05) + st.k * (o === 'brain' ? 0.14 : 0.32)
      u.uRim.value = (o === 'brain' ? 0.45 : 0.7) + st.k * 0.9
    }
    // heart beats at the measured resting HR, lungs breathe
    const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * (bpm / 60))), 10)
    parts.heart?.scale.setScalar(1 + beat * 0.09)
    const br = 1 + Math.sin(t * 1.3) * 0.025
    parts.lungs?.scale.set(br, 1 + (br - 1) * 0.6, br)

    // labels: project anchor points every frame
    labels.current?.forEach((el, o) => {
      tmp.v.set(...LABEL_AT[o]).applyMatrix4(group.current.matrixWorld).project(camera)
      const x = (tmp.v.x * 0.5 + 0.5) * size.width
      const y = (-tmp.v.y * 0.5 + 0.5) * size.height
      const right = tmp.v.x > 0
      el.dataset.side = right ? 'r' : 'l'
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(${right ? 0 : -100}%, -50%)`
    })
  })

  return (
    <group ref={group}>
      {Object.entries(parts).map(([k, m]) => (
        <primitive key={k} object={m} />
      ))}
    </group>
  )
}

function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const half = THREE.MathUtils.degToRad(cam.fov / 2)
    const fitH = (H * 0.6) / Math.tan(half)
    const fitW = 0.62 / (Math.tan(half) * (size.width / size.height))
    const d = Math.max(fitH, fitW)
    cam.position.set(0, CY, d)
    cam.lookAt(0, CY, 0)
    cam.updateProjectionMatrix()
  }, [camera, size.width, size.height])
  return null
}

function Floor() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        premultipliedAlpha: true,
        uniforms: { uTime: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `varying vec2 vUv; uniform float uTime;
          void main(){
            float d = distance(vUv, vec2(0.5));
            float ring = smoothstep(0.012, 0.0, abs(fract(d * 5.0 - uTime * 0.12) - 0.5) * 0.1);
            float fade = smoothstep(0.5, 0.08, d);
            float core = smoothstep(0.26, 0.0, d) * 0.22;
            vec3 c = vec3(0.35, 0.82, 0.92) * (ring * 0.45 + core) * fade;
            gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
          }`,
      }),
    [],
  )
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.getElapsedTime()
  })
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0.02]} material={mat}>
      <planeGeometry args={[1.5, 1.5]} />
    </mesh>
  )
}

export default function BodyScene({ organs, selected, bpm, labels }: Omit<Props, 'interacting'>) {
  const wrap = useRef<HTMLDivElement>(null)
  const interacting = useRef(false)
  const [visible, setVisible] = useState(true)
  const [dpr, setDpr] = useState(Math.min(1.75, window.devicePixelRatio || 1))
  // stop rendering when scrolled away or the tab is hidden — keeps the page fast
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting && !document.hidden), { threshold: 0.01 })
    io.observe(el)
    const vis = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', vis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', vis)
    }
  }, [])
  return (
    <div ref={wrap} className="absolute inset-0">
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={dpr}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 24, near: 0.05, far: 30, position: [0, CY, 5] }}
        onPointerDown={() => (interacting.current = true)}
        onPointerUp={() => (interacting.current = false)}
        onPointerLeave={() => (interacting.current = false)}
      >
        {/* adaptive resolution: drops pixel ratio on slow GPUs instead of stuttering */}
        <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(0.75, d - 0.35))} onIncline={() => setDpr((d) => Math.min(Math.min(1.75, window.devicePixelRatio || 1), d + 0.25))} flipflops={4} />
        <Rig />
        <Suspense fallback={null}>
          <Body organs={organs} selected={selected} bpm={bpm} labels={labels} interacting={interacting} />
        </Suspense>
        <Floor />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.55}
          target={[0, CY, 0]}
          minPolarAngle={Math.PI / 2 - 0.3}
          maxPolarAngle={Math.PI / 2 + 0.12}
        />
      </Canvas>
    </div>
  )
}
