import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky, Text, Html, Cloud } from "@react-three/drei";
import { Physics, RigidBody } from "@react-three/rapier";
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import * as THREE from "three";
import {
  ARENA_SIZE,
  PLAYER_SPEED,
  PLAYER_HEIGHT,
  MAX_HEALTH,
  MAX_AMMO,
  FIRE_RATE,
  DAMAGE,
  ENEMY_COUNT,
  ENEMY_HEALTH,
  ENEMY_SPEED,
  ENEMY_DAMAGE,
  ENEMY_FIRE_RATE,
  ENEMY_RANGE,
  LOOK_SENSITIVITY,
  RECOIL_AMOUNT,
  RECOIL_RECOVERY,
} from "./constants";
import type { Faction, PlayerStats, Enemy } from "./types";

interface Props {
  playerFaction: Faction;
  onMatchEnd: (stats: PlayerStats) => void;
  rankBonus?: number;
  onExit: () => void;
}

/* -------------------- MAP -------------------- */
function Ground() {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[ARENA_SIZE * 2.6, ARENA_SIZE * 2.6]} />
        <meshStandardMaterial color="#111111" roughness={0.92} metalness={0.05} />
      </mesh>
      {/* subtle grid */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[ARENA_SIZE * 2.6, ARENA_SIZE * 2.6]} />
        <meshBasicMaterial color="#1a1a1a" wireframe transparent opacity={0.15} />
      </mesh>
    </RigidBody>
  );
}

function Walls() {
  const h = 7;
  const s = ARENA_SIZE;
  const mat = <meshStandardMaterial color="#161616" roughness={0.85} />;
  return (
    <group>
      <RigidBody type="fixed"><mesh position={[0, h / 2, -s]} castShadow receiveShadow><boxGeometry args={[s * 2.6, h, 1.6]} />{mat}</mesh></RigidBody>
      <RigidBody type="fixed"><mesh position={[0, h / 2, s]} castShadow receiveShadow><boxGeometry args={[s * 2.6, h, 1.6]} />{mat}</mesh></RigidBody>
      <RigidBody type="fixed"><mesh position={[-s, h / 2, 0]} castShadow receiveShadow><boxGeometry args={[1.6, h, s * 2.6]} />{mat}</mesh></RigidBody>
      <RigidBody type="fixed"><mesh position={[s, h / 2, 0]} castShadow receiveShadow><boxGeometry args={[1.6, h, s * 2.6]} />{mat}</mesh></RigidBody>
    </group>
  );
}

function MapCover() {
  // Deliberate layout (not pure random)
  const pieces = useMemo(() => [
    // center cluster
    { pos: [0, 1.3, 0] as [number, number, number], size: [4.5, 2.6, 4.5] as [number, number, number] },
    { pos: [-8, 1.1, -6] as [number, number, number], size: [3.2, 2.2, 3.2] as [number, number, number] },
    { pos: [9, 1.1, 7] as [number, number, number], size: [3.5, 2.3, 3] as [number, number, number] },
    { pos: [-12, 1.2, 10] as [number, number, number], size: [2.8, 2.4, 5] as [number, number, number] },
    { pos: [11, 1.0, -11] as [number, number, number], size: [5, 2.0, 2.8] as [number, number, number] },
    // platforms
    { pos: [-6, 2.8, 14] as [number, number, number], size: [6, 0.6, 4] as [number, number, number] },
    { pos: [7, 2.6, -13] as [number, number, number], size: [5, 0.6, 4.5] as [number, number, number] },
    // side walls / cover
    { pos: [-16, 1.4, 0] as [number, number, number], size: [2, 2.8, 8] as [number, number, number] },
    { pos: [16, 1.4, 3] as [number, number, number], size: [2, 2.8, 7] as [number, number, number] },
    { pos: [0, 1.2, -16] as [number, number, number], size: [9, 2.4, 2] as [number, number, number] },
    { pos: [3, 1.2, 17] as [number, number, number], size: [8, 2.4, 2] as [number, number, number] },
    // extra mid cover
    { pos: [-4, 1.0, 5] as [number, number, number], size: [2.2, 2.0, 2.2] as [number, number, number] },
    { pos: [5, 1.0, -4] as [number, number, number], size: [2.4, 2.1, 2.4] as [number, number, number] },
  ], []);

  return (
    <group>
      {pieces.map((p, i) => (
        <RigidBody key={i} type="fixed" colliders="cuboid">
          <mesh position={p.pos} castShadow receiveShadow>
            <boxGeometry args={p.size} />
            <meshStandardMaterial color="#1f1f1f" roughness={0.75} metalness={0.1} />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}

/* -------------------- GUN + EFFECTS -------------------- */
function GunModel({ recoil }: { recoil: number }) {
  return (
    <group
      position={[0.33, -0.29 - recoil * 0.15, -0.55]}
      rotation={[0.14 + recoil * 1.8, 0.16, recoil * 0.4]}
    >
      {/* body */}
      <mesh>
        <boxGeometry args={[0.08, 0.13, 0.46]} />
        <meshStandardMaterial color="#0d0d0d" metalness={0.95} roughness={0.18} />
      </mesh>
      {/* barrel */}
      <mesh position={[0, 0.025, -0.28]}>
        <boxGeometry args={[0.045, 0.045, 0.26]} />
        <meshStandardMaterial color="#050505" metalness={0.9} roughness={0.25} />
      </mesh>
      {/* stock */}
      <mesh position={[0, -0.04, 0.18]}>
        <boxGeometry args={[0.07, 0.09, 0.18]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* sight */}
      <mesh position={[0, 0.09, -0.05]}>
        <boxGeometry args={[0.02, 0.04, 0.08]} />
        <meshStandardMaterial color="#222" />
      </mesh>
    </group>
  );
}

function MuzzleFlash({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <group position={[0.33, -0.22, -0.85]}>
      <pointLight intensity={18} distance={9} color="#ffaa44" decay={2} />
      <mesh>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshBasicMaterial color="#ffcc66" transparent opacity={0.9} />
      </mesh>
      <mesh scale={[1.6, 1.6, 0.4]}>
        <sphereGeometry args={[0.12, 6, 6]} />
        <meshBasicMaterial color="#ff8800" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

/* -------------------- ENEMY -------------------- */
function EnemyBot({
  enemy,
  hitFlash,
}: {
  enemy: Enemy;
  hitFlash: boolean;
}) {
  if (!enemy.alive) return null;
  const baseColor = enemy.faction === "wardog" ? "#ef4444" : "#3b82f6";
  const color = hitFlash ? "#ffffff" : baseColor;

  return (
    <group position={enemy.position}>
      <mesh castShadow userData={{ enemyId: enemy.id }}>
        <capsuleGeometry args={[0.42, 1.35]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.15} />
      </mesh>
      {/* head */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <sphereGeometry args={[0.28, 12, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Text
        position={[0, 1.95, 0]}
        fontSize={0.28}
        color="white"
        anchorX="center"
        outlineWidth={0.02}
        outlineColor="#000"
      >
        {enemy.faction.toUpperCase()}
      </Text>
      <Html position={[0, 2.35, 0]} center distanceFactor={10}>
        <div className="w-20 h-1.5 bg-black/80 rounded-full overflow-hidden border border-zinc-600">
          <div
            className="h-full bg-red-500 transition-all duration-100"
            style={{ width: `${Math.max(0, (enemy.health / enemy.maxHealth) * 100)}%` }}
          />
        </div>
      </Html>
    </group>
  );
}

/* -------------------- CORE LOGIC -------------------- */
function GameLogic({
  stats,
  setStats,
  enemies,
  setEnemies,
  onMatchEnd,
  moveInput,
  lookDelta,
  isFiring,
  setMuzzle,
  setRecoil,
  hitFlashes,
  setHitFlashes,
}: any) {
  const { camera, scene, raycaster } = useThree();
  const lastShot = useRef(0);
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const keys = useRef({ w: false, a: false, s: false, d: false });
  const recoilOffset = useRef(0);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "KeyW") keys.current.w = true;
      if (e.code === "KeyA") keys.current.a = true;
      if (e.code === "KeyS") keys.current.s = true;
      if (e.code === "KeyD") keys.current.d = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "KeyW") keys.current.w = false;
      if (e.code === "KeyA") keys.current.a = false;
      if (e.code === "KeyS") keys.current.s = false;
      if (e.code === "KeyD") keys.current.d = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const doShoot = useCallback(() => {
    const now = performance.now() / 1000;
    if (now - lastShot.current < FIRE_RATE) return;
    if (stats.ammo <= 0) return;

    lastShot.current = now;
    setStats((s: PlayerStats) => ({ ...s, ammo: Math.max(0, s.ammo - 1) }));

    // Recoil + muzzle
    recoilOffset.current += RECOIL_AMOUNT;
    setRecoil(recoilOffset.current);
    setMuzzle(true);
    setTimeout(() => setMuzzle(false), 60);

    // Hitscan
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(scene.children, true);

    for (const hit of hits) {
      const id = hit.object.userData?.enemyId as string | undefined;
      if (id) {
        setEnemies((prev: Enemy[]) =>
          prev.map((e) => {
            if (e.id === id && e.alive) {
              const hp = e.health - DAMAGE;
              // flash
              setHitFlashes((f: Record<string, number>) => ({ ...f, [id]: Date.now() }));
              if (hp <= 0) {
                setStats((s: PlayerStats) => ({ ...s, kills: s.kills + 1 }));
                return { ...e, health: 0, alive: false };
              }
              return { ...e, health: hp };
            }
            return e;
          })
        );
        break;
      }
    }
  }, [camera, scene, raycaster, stats.ammo, setStats, setEnemies, setMuzzle, setRecoil, setHitFlashes]);

  useFrame((_, delta) => {
    // Continuous fire
    if (isFiring) doShoot();

    // Look
    if (lookDelta.current.x !== 0 || lookDelta.current.y !== 0) {
      euler.current.setFromQuaternion(camera.quaternion);
      euler.current.y -= lookDelta.current.x;
      euler.current.x -= lookDelta.current.y;
      euler.current.x = THREE.MathUtils.clamp(euler.current.x, -1.35, 1.35);
      camera.quaternion.setFromEuler(euler.current);
      lookDelta.current.x = 0;
      lookDelta.current.y = 0;
    }

    // Recoil recovery
    if (recoilOffset.current > 0) {
      recoilOffset.current = Math.max(0, recoilOffset.current - delta * RECOIL_RECOVERY);
      setRecoil(recoilOffset.current);
      // camera punch
      euler.current.x -= recoilOffset.current * 0.35 * delta * 60;
      camera.quaternion.setFromEuler(euler.current);
    }

    // Movement
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    let mx = moveInput.current.x;
    let mz = moveInput.current.z;
    if (keys.current.w) mz -= 1;
    if (keys.current.s) mz += 1;
    if (keys.current.a) mx -= 1;
    if (keys.current.d) mx += 1;

    if (mx !== 0 || mz !== 0) {
      const len = Math.hypot(mx, mz) || 1;
      mx /= len;
      mz /= len;
      camera.position.x += (forward.x * -mz + right.x * mx) * PLAYER_SPEED * delta;
      camera.position.z += (forward.z * -mz + right.z * mx) * PLAYER_SPEED * delta;
    }

    camera.position.y = PLAYER_HEIGHT;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -ARENA_SIZE + 2.5, ARENA_SIZE - 2.5);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -ARENA_SIZE + 2.5, ARENA_SIZE - 2.5);

    // Enemy AI + shooting
    const now = performance.now() / 1000;
    setEnemies((prev: Enemy[]) =>
      prev.map((e) => {
        if (!e.alive) return e;

        const dx = camera.position.x - e.position[0];
        const dz = camera.position.z - e.position[2];
        const dist = Math.hypot(dx, dz) || 1;

        // move toward player
        let newPos = e.position;
        if (dist > 3.5) {
          const speed = ENEMY_SPEED * delta;
          newPos = [
            e.position[0] + (dx / dist) * speed,
            e.position[1],
            e.position[2] + (dz / dist) * speed,
          ] as [number, number, number];
        }

        // shoot back
        let last = e.lastShot;
        if (dist < ENEMY_RANGE && now - e.lastShot > ENEMY_FIRE_RATE) {
          last = now;
          setStats((s: PlayerStats) => {
            const hp = Math.max(0, s.health - ENEMY_DAMAGE);
            if (hp <= 0) {
              // player died
              setTimeout(() => onMatchEnd({ ...s, health: 0, deaths: s.deaths + 1 }), 300);
            }
            return { ...s, health: hp };
          });
        }

        return { ...e, position: newPos, lastShot: last };
      })
    );
  });

  // Win check
  useEffect(() => {
    if (enemies.length > 0 && enemies.every((e: Enemy) => !e.alive)) {
      onMatchEnd(stats);
    }
  }, [enemies, stats, onMatchEnd]);

  return (
    <>
      <color attach="background" args={["#0a0a12"]} />
      <fog attach="fog" args={["#0a0a12", 28, 70]} />

      <ambientLight intensity={0.28} />
      <directionalLight
        position={[18, 28, 12]}
        intensity={1.55}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={80}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      <hemisphereLight intensity={0.25} color="#445566" groundColor="#111" />

      <Sky sunPosition={[90, 25, 60]} turbidity={6} rayleigh={1.2} />
      <Cloud opacity={0.25} speed={0.2} position={[0, 18, -30]} />

      <Physics gravity={[0, -32, 0]}>
        <Ground />
        <Walls />
        <MapCover />
        <GunModel recoil={0} />
        {enemies.map((e: Enemy) => (
          <EnemyBot
            key={e.id}
            enemy={e}
            hitFlash={!!hitFlashes[e.id] && Date.now() - hitFlashes[e.id] < 120}
          />
        ))}
      </Physics>
    </>
  );
}

/* -------------------- MAIN COMPONENT -------------------- */
export function ShooterCanvas({ playerFaction, onMatchEnd, rankBonus = 0, onExit }: Props) {
  const [stats, setStats] = useState<PlayerStats>({
    health: MAX_HEALTH + rankBonus * 6,
    maxHealth: MAX_HEALTH + rankBonus * 6,
    ammo: MAX_AMMO,
    maxAmmo: MAX_AMMO,
    kills: 0,
    deaths: 0,
  });

  const [enemies, setEnemies] = useState<Enemy[]>(() => {
    const list: Enemy[] = [];
    for (let i = 0; i < ENEMY_COUNT; i++) {
      const angle = (i / ENEMY_COUNT) * Math.PI * 2;
      const r = 14 + Math.random() * 12;
      list.push({
        id: `e-${i}`,
        position: [Math.cos(angle) * r, 1.1, Math.sin(angle) * r],
        health: ENEMY_HEALTH,
        maxHealth: ENEMY_HEALTH,
        faction: playerFaction === "wardog" ? "warcat" : "wardog",
        alive: true,
        lastShot: 0,
      });
    }
    return list;
  });

  const moveInput = useRef({ x: 0, z: 0 });
  const lookDelta = useRef({ x: 0, y: 0 });
  const [isFiring, setIsFiring] = useState(false);
  const [muzzle, setMuzzle] = useState(false);
  const [recoil, setRecoil] = useState(0);
  const [hitFlashes, setHitFlashes] = useState<Record<string, number>>({});
  const lastTouch = useRef<{ x: number; y: number } | null>(null);

  // Global drag look (no pointer lock)
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.buttons === 0) return;
      if (!lastTouch.current) {
        lastTouch.current = { x: e.clientX, y: e.clientY };
        return;
      }
      const dx = e.clientX - lastTouch.current.x;
      const dy = e.clientY - lastTouch.current.y;
      lookDelta.current.x += dx * LOOK_SENSITIVITY * 1.9;
      lookDelta.current.y += dy * LOOK_SENSITIVITY * 1.9;
      lastTouch.current = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = () => {
      lastTouch.current = null;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] bg-black select-none touch-none overflow-hidden">
      <Canvas
        shadows
        camera={{ position: [0, PLAYER_HEIGHT, 8], fov: 72 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.shadowMap.type = THREE.PCFShadowMap;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
        }}
      >
        <GameLogic
          stats={stats}
          setStats={setStats}
          enemies={enemies}
          setEnemies={setEnemies}
          onMatchEnd={onMatchEnd}
          moveInput={moveInput}
          lookDelta={lookDelta}
          isFiring={isFiring}
          setMuzzle={setMuzzle}
          setRecoil={setRecoil}
          hitFlashes={hitFlashes}
          setHitFlashes={setHitFlashes}
        />
        {/* Muzzle is rendered inside the scene via a portal-like group, but we drive it from outside for simplicity */}
        <group>
          <MuzzleFlash active={muzzle} />
        </group>
      </Canvas>

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.65)_100%)]" />

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="w-8 h-8 border-2 border-white/85 rounded-full" />
        <div className="absolute inset-0 m-auto w-1.5 h-1.5 bg-white rounded-full" />
      </div>

      {/* Top */}
      <div className="absolute top-3 left-0 right-0 flex justify-between items-center px-4 z-10">
        <div className="bg-black/75 backdrop-blur px-3 py-1.5 rounded-full text-xs font-black tracking-widest text-white">
          {playerFaction.toUpperCase()} FORCE
        </div>
        <button
          onClick={onExit}
          className="bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black px-4 py-1.5 rounded-xl text-sm transition"
        >
          EXIT
        </button>
      </div>

      {/* HUD */}
      <div className="absolute bottom-40 left-4 bg-black/85 backdrop-blur-md px-4 py-3 rounded-2xl text-white font-mono text-sm space-y-1 pointer-events-none border border-white/10">
        <div className={`font-bold ${stats.health < 30 ? "text-red-400" : "text-emerald-400"}`}>
          HP {Math.round(stats.health)}/{stats.maxHealth}
        </div>
        <div>AMMO {stats.ammo}/{stats.maxAmmo}</div>
        <div className="text-amber-400">KILLS {stats.kills}</div>
      </div>

      {/* Damage flash overlay */}
      {stats.health < stats.maxHealth && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-200"
          style={{
            background: `radial-gradient(circle, transparent 50%, rgba(180,0,0,${0.25 * (1 - stats.health / stats.maxHealth)}) 100%)`,
          }}
        />
      )}

      {/* Left Joystick */}
      <div
        className="absolute bottom-8 left-5 w-32 h-32 rounded-full border-2 border-white/25 bg-black/55 flex items-center justify-center"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const rect = e.currentTarget.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = (e.clientX - cx) / (rect.width / 2);
          const dy = (e.clientY - cy) / (rect.height / 2);
          moveInput.current = {
            x: Math.max(-1, Math.min(1, dx)),
            z: Math.max(-1, Math.min(1, dy)),
          };
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = (e.clientX - cx) / (rect.width / 2);
          const dy = (e.clientY - cy) / (rect.height / 2);
          moveInput.current = {
            x: Math.max(-1, Math.min(1, dx)),
            z: Math.max(-1, Math.min(1, dy)),
          };
        }}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId);
          moveInput.current = { x: 0, z: 0 };
        }}
      >
        <div className="w-14 h-14 rounded-full bg-white/20 shadow-inner" />
      </div>

      {/* FIRE – hold for continuous */}
      <button
        className="absolute bottom-8 right-6 w-28 h-28 rounded-full bg-gradient-to-b from-red-500 to-red-700 border-4 border-red-300 text-white font-black text-xl shadow-2xl active:scale-90 transition-transform"
        onPointerDown={(e) => {
          e.preventDefault();
          setIsFiring(true);
        }}
        onPointerUp={() => setIsFiring(false)}
        onPointerLeave={() => setIsFiring(false)}
        onPointerCancel={() => setIsFiring(false)}
      >
        FIRE
      </button>

      {/* Hint */}
      <div className="absolute bottom-44 left-1/2 -translate-x-1/2 text-white/50 text-[11px] text-center pointer-events-none">
        Drag to look • Joystick move • Hold FIRE
      </div>
    </div>
  );
}
