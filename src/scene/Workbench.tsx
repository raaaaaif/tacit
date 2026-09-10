import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import tubeURL from "../assets/tube.glb?url";
import tipURL from "../assets/tip.glb?url";
import workcellURL from "../assets/workcell.glb?url";
const holderURLs = import.meta.glob("../assets/holder-*.glb", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  D,
  innerRadius,
  liquidHeight,
  pelletPosition,
  toWorld,
  displacedTipVolume,
} from "../model/geometry";
import type { WorldState, Vec3 } from "../model/types";
interface Props {
  world: WorldState;
  overview: boolean;
  tip: Vec3;
  aspirated: number;
  cutaway: boolean;
  showBelief: boolean;
  reset: number;
  active: boolean;
}
const point = (p: Vec3) => new THREE.Vector3(p[0], p[2], -p[1]);
function fluidMesh(height: number, tilt: number) {
  const positions: number[] = [],
    indices: number[] = [],
    n = 72,
    m = 40,
    angle = (tilt * Math.PI) / 180,
    c = Math.cos(angle),
    s = Math.sin(angle);
  for (let j = 0; j <= m; j++) {
    for (let i = 0; i <= n; i++) {
      const a = (2 * Math.PI * i) / n;
      let surface = (height + s * D.tube.innerRadius * Math.cos(a)) / c;
      if (surface < D.tube.coneHeight)
        surface =
          (height + s * D.tube.innerBaseRadius * Math.cos(a)) /
          (c -
            ((s * (D.tube.innerRadius - D.tube.innerBaseRadius)) /
              D.tube.coneHeight) *
              Math.cos(a));
      const z = (surface * j) / m,
        r = Math.max(0, innerRadius(z) - 0.0125);
      positions.push(r * Math.cos(a), z, -r * Math.sin(a));
    }
  }
  for (let j = 0; j < m; j++)
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i;
      indices.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2);
    }
  const center = positions.length / 3;
  positions.push(0, height / c, 0);
  for (let i = 0; i < n; i++)
    indices.push(center, m * (n + 1) + i, m * (n + 1) + i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
export function Workbench(props: Props) {
  const mount = useRef<HTMLDivElement>(null),
    api = useRef<{ update: (p: Props) => void; reset: () => void } | null>(
      null,
    ),
    [error, setError] = useState(false);
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    const el = mount.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch {
      setError(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.86;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    el.appendChild(renderer.domElement);
    const contextLost = (event: Event) => {
      event.preventDefault();
      setError(true);
    };
    const contextRestored = () => {
      setError(false);
      request();
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    renderer.domElement.addEventListener(
      "webglcontextrestored",
      contextRestored,
    );
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 600);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.minDistance = 60;
    controls.maxDistance = 420;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, 15, 0);
    const reset = () => {
      if (latest.current.overview) {
        camera.position.set(190, 200, 290);
        controls.target.set(0, 75, 0);
      } else {
        camera.position.set(67, 64, 95);
        controls.target.set(0, 15, 0);
      }
      controls.update();
      request();
    };
    const pmrem = new THREE.PMREMGenerator(renderer),
      environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = environment.texture;
    scene.add(new THREE.HemisphereLight(0xf7f7ed, 0x67796d, 0.8));
    const light = new THREE.DirectionalLight(0xfff7e5, 2.5);
    light.position.set(-30, 75, 50);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    Object.assign(light.shadow.camera, {
      left: -65,
      right: 65,
      top: 70,
      bottom: -60,
      near: 1,
      far: 240,
    });
    light.shadow.bias = -0.0005;
    light.shadow.normalBias = 0.035;
    scene.add(light);
    const fill = new THREE.DirectionalLight(0xd5e5ef, 1.2);
    fill.position.set(50, 30, -40);
    scene.add(fill);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 700),
      new THREE.ShadowMaterial({ opacity: 0.16 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -12.8;
    ground.receiveShadow = true;
    scene.add(ground);
    const stage = new THREE.Group(),
      assembly = new THREE.Group(),
      tubeGroup = new THREE.Group(),
      tipGroup = new THREE.Group();
    assembly.add(tubeGroup);
    scene.add(stage, assembly, tipGroup);
    const fluid = new THREE.Mesh(
      fluidMesh(20, 0),
      new THREE.MeshPhysicalMaterial({
        color: 0x8aab99,
        roughness: 0.16,
        metalness: 0.02,
        transparent: true,
        opacity: 0.68,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    tubeGroup.add(fluid);
    const meniscus = new THREE.Mesh(
      new THREE.CircleGeometry(4.3, 80),
      new THREE.MeshPhysicalMaterial({
        color: 0x96b09e,
        roughness: 0.12,
        metalness: 0.08,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      }),
    );
    meniscus.rotation.x = -Math.PI / 2;
    tubeGroup.add(meniscus);
    const pellet = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 24, 16),
      new THREE.MeshStandardMaterial({ color: 0xe0d7bc, roughness: 0.95 }),
    );
    pellet.scale.set(1, 0.55, 1);
    scene.add(pellet);
    const protectedRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.45, 0.045, 8, 80),
      new THREE.MeshBasicMaterial({
        color: 0xc18b43,
        transparent: true,
        opacity: 0.85,
        depthTest: false,
      }),
    );
    protectedRing.rotation.x = -Math.PI / 2;
    scene.add(protectedRing);
    const uncertainty = new THREE.Mesh(
      new THREE.SphereGeometry(2.45, 32, 20),
      new THREE.MeshBasicMaterial({
        color: 0xd19b50,
        transparent: true,
        opacity: 0.06,
        depthWrite: false,
      }),
    );
    scene.add(uncertainty);
    // Mechanically connected X/Y carriages on a vertical Z rail.
    const metal = new THREE.MeshStandardMaterial({
      color: 0x89978e,
      metalness: 0.72,
      roughness: 0.3,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x29392f,
      metalness: 0.4,
      roughness: 0.38,
    });
    const railMesh = (size: number[], material: THREE.Material) => {
      const mesh = new THREE.Mesh(
        new RoundedBoxGeometry(size[0], size[1], size[2], 2, 0.3),
        material,
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };
    const carriage = railMesh([12, 8, 6], metal);
    const xRail = railMesh([72, 4, 5], metal);
    const xRunner = railMesh([7, 6, 7], dark);
    const yRail = railMesh([4, 4, 76], metal);
    const yRunner = railMesh([8, 6, 7], dark);
    const tipLiquid = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshPhysicalMaterial({
        color: 0x7f9985,
        roughness: 0.15,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      }),
    );
    tipGroup.add(tipLiquid);
    const loader = new GLTFLoader();
    let front: THREE.Object3D | undefined,
      disposed = false;
    const loaded: THREE.Object3D[] = [];
    async function load(name: string, parent: THREE.Group, url: string) {
      try {
        const gltf = await loader.loadAsync(url);
        if (disposed) return;
        gltf.scene.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const mat of mats) {
              if (mat instanceof THREE.MeshStandardMaterial) {
                mat.envMapIntensity = 0.55;
                if (mat.name.startsWith("Polypropylene")) {
                  const p = mat as THREE.MeshPhysicalMaterial;
                  p.transmission = 0.18;
                  p.roughness = 0.3;
                  p.color.set(0xc4cec3);
                  if (name === "tip") {
                    p.transmission = 0.1;
                    p.transparent = true;
                    p.opacity = 0.48;
                    p.depthWrite = false;
                    p.roughness = 0.2;
                  }
                }
              }
            }
          }
          if (o.name === "tube_front") front = o;
        });
        parent.add(gltf.scene);
        if (name.startsWith("holder-")) gltf.scene.name = name;
        loaded.push(gltf.scene);
        update(latest.current);
        request();
      } catch (e) {
        console.error("Asset load failed", e);
        setError(true);
      }
    }
    void load("workcell", stage, workcellURL);
    for (const [path, url] of Object.entries(holderURLs))
      void load(path.split("/").at(-1)!.replace(".glb", ""), stage, url);
    void load("tube", tubeGroup, tubeURL);
    void load("tip", tipGroup, tipURL);
    let lastFluidKey = "",
      lastHeld = -1,
      raf = 0;
    let previousFrame = 0,
      measuredFrames = 0;
    const intervals: number[] = [];
    function request() {
      if (!raf && !document.hidden)
        raf = requestAnimationFrame(() => {
          raf = 0;
          renderer.render(scene, camera);
          const now = performance.now();
          if (latest.current.active && previousFrame) {
            const dt = now - previousFrame;
            if (dt < 150) intervals.push(dt);
            if (intervals.length > 600) intervals.shift();
            if (++measuredFrames % 60 === 0) {
              const sorted = [...intervals].sort((a, b) => a - b);
              el.dataset.renderStats = JSON.stringify({
                frames: measuredFrames,
                medianFrameMs: sorted[Math.floor(sorted.length * 0.5)],
                p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
                geometries: renderer.info.memory.geometries,
                drawCalls: renderer.info.render.calls,
                pixelRatio: renderer.getPixelRatio(),
              });
            }
          }
          previousFrame = latest.current.active ? now : 0;
        });
    }
    function update(p: Props) {
      assembly.rotation.z = (-p.world.tilt * Math.PI) / 180;
      assembly.position.copy(point(p.world.pose));
      stage.children.forEach((o) => {
        if (o.name.startsWith("holder-")) {
          o.position.copy(point(p.world.fixturePose ?? [0, 0, 0]));
          o.visible =
            o.name === `holder-${p.world.tilt}-${p.world.fixture.indexed}`;
        }
      });
      tipGroup.position.copy(point(p.tip));
      const headZ = p.tip[2] + 77;
      carriage.position.set(22, headZ, -18);
      xRail.position.set(0, headZ, -13);
      xRunner.position.set(p.tip[0], headZ, -13);
      yRail.position.set(p.tip[0], headZ, -1);
      yRunner.position.set(p.tip[0], headZ, -p.tip[1]);
      if (front) front.visible = !p.cutaway;
      const h =
        liquidHeight(p.world.volume, p.world.tilt, p.tip, p.world.pose[2]) -
        p.world.pose[2];
      const fluidKey = `${h.toFixed(3)}-${p.world.tilt}`;
      if (fluidKey !== lastFluidKey) {
        lastFluidKey = fluidKey;
        fluid.geometry.dispose();
        fluid.geometry = fluidMesh(h, p.world.tilt);
        meniscus.visible = p.world.tilt === 0;
        meniscus.position.y = h + 0.015;
        meniscus.scale.setScalar(innerRadius(h) / 4.3);
      }
      if (Math.abs(lastHeld - p.aspirated) > 0.1) {
        lastHeld = p.aspirated;
        const r0 = 0.12,
          r1 = 2.87,
          taper = D.tip.taperLength;
        const coneVolume =
          (Math.PI * taper * (r0 * r0 + r0 * r1 + r1 * r1)) / 3;
        let height = taper;
        if (p.aspirated < coneVolume) {
          let lo = 0,
            hi = taper;
          for (let j = 0; j < 24; j++) {
            const m = (lo + hi) / 2,
              r = r0 + ((r1 - r0) * m) / taper,
              v = (Math.PI * m * (r0 * r0 + r0 * r + r * r)) / 3;
            if (v < p.aspirated) lo = m;
            else hi = m;
          }
          height = (lo + hi) / 2;
        } else height += (p.aspirated - coneVolume) / (Math.PI * 3.45 ** 2);
        const profile = [new THREE.Vector2(0, 0), new THREE.Vector2(r0, 0)];
        if (height > taper)
          profile.push(
            new THREE.Vector2(r1, taper),
            new THREE.Vector2(3.45, taper + 0.25),
          );
        profile.push(
          new THREE.Vector2(
            height > taper ? 3.45 : r0 + ((r1 - r0) * height) / taper,
            height,
          ),
          new THREE.Vector2(0, height),
        );
        tipLiquid.geometry.dispose();
        tipLiquid.geometry = new THREE.LatheGeometry(profile, 48);
      }
      tipLiquid.visible = p.aspirated > 0.1;
      const pp = point(pelletPosition(p.world));
      pellet.position.copy(pp);
      protectedRing.position.copy(pp);
      uncertainty.position.copy(pp);
      protectedRing.visible = p.showBelief;
      uncertainty.visible = p.showBelief;

      request();
    }
    const resize = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      request();
    });
    resize.observe(el);
    controls.addEventListener("change", request);
    document.addEventListener("visibilitychange", request);
    api.current = { update, reset };
    reset();
    return () => {
      disposed = true;
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      renderer.domElement.removeEventListener(
        "webglcontextrestored",
        contextRestored,
      );
      resize.disconnect();
      controls.dispose();
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", request);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        }
      });
      environment.texture.dispose();
      pmrem.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      api.current = null;
    };
  }, []);
  useEffect(() => {
    api.current?.update(props);
  }, [props.world, props.tip, props.cutaway, props.showBelief, props.active]);
  useEffect(() => {
    api.current?.reset();
  }, [props.reset, props.overview]);
  return (
    <div
      className="scene-canvas"
      ref={mount}
      aria-label="Interactive 3D workcell. Drag to orbit, scroll to zoom."
    >
      {error && (
        <div className="scene-error">
          The 3D view could not load. You can still inspect the run and export
          its evidence.
        </div>
      )}
    </div>
  );
}
