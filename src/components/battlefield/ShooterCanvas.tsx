import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky, Text, Html } from "@react-three/drei";
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
  LOOK_SENSITIVITY,
} from "./constants";
import type { Faction, PlayerStats, Enemy } from "./types";

interface Props {
  playerFaction: Faction;
  onMatchEnd: (stats: PlayerStats) => void;
  rankBonus?: number;
  onExit: () => void;
}

function Ground() {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ARENA_SIZE * 2.4, ARENA_SIZE * 2.4]} />
        <meshStandardMaterial color="#0f0f0f" roughness={0.95} />
      </mesh>
    </RigidBody>
  );
}

function Walls() {
  const h = 6;
  const s = ARENA_SIZE;
  const mat = <meshStandardMaterial color="#1a1a1a" roughness={0.8} />;
  return (
    <group>
      <RigidBody type="fixed"><mesh position={[0, h / 2, -s]}><boxGeometry args={[s * 2.4, h, 1.4]} />{mat}</mesh></RigidBody>
      <RigidBody type="fixed"><mesh position={[0, h / 2, s]}><boxGeometry args={[s * 2.4, h, 1.4]} />{mat}</mesh></RigidBody>
      <RigidBody type="fixed"><mesh position={[-s, h / 2, 0]}><boxGeometry args={[1.4, h, s * 2.4]} />{mat}</mesh></RigidBody>
      <RigidBody type="fixed"><mesh position={[s, h / 2, 0]}><boxGeometry args={[1.4, h, s * 2.4]} />{mat}</mesh></RigidBody>
    </group>
  );
}

function Cover() {
  const boxes = useMemo(() => {
    const arr: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    for (let i = 0; i < 14; i++) {
      arr.push({
        pos: [
          (Math.random() - 0.5) * ARENA_SIZE * 1.55,
          1.1,
          (Math.random() - 0.5) * ARENA_SIZE * 1.55,
        ],
        size: [1.7 + Math.random() * 2.2, 2.3 + Math.random(), 1.7 + Math.random() * 2.2],
      });
    }
    return arr;
  }, []);
  return (
    <group>
      {boxes.map((b, i) => (
        <RigidBody key={i} type="fixed" colliders="cuboid">
          <mesh position={b.pos} castShadow>
            <boxGeometry args={b.size} />
            <meshStandardMaterial color="#222" roughness={0.7} />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}

function GunModel() {
  return (
    <group position={[0.32, -0.28, -0.52]} rotation={[0.12, 0.15, 0]}>
      <mesh>
        <boxGeometry args={[0.075, 0.12, 0.42]} />
        <meshStandardMaterial color="#111" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.02, -0.24]}>
        <boxGeometry args={[0.04, 0.04, 0.22]} />
        <meshStandardMaterial color="#050505" />
      </mesh>
    </group>
  );
}

function EnemyBot({ enemy }: { enemy: Enemy }) {
  if (!enemy.alive) return null;
  const color = enemy.faction === "wardog" ? "#ef4444" : "#3b82f6";

  return (
    <group position={enemy.position}>
      <mesh castShadow userData={{ enemyId: enemy.id }}>
        <capsuleGeometry args={[0.4, 1.25]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Text
        position={[0, 1.85, 0]}
        fontSize={0.3}
        color="white"
        anchorX="center"
        outlineWidth={0.025}
        outlineColor="#000"
      >
        {enemy.faction.toUpperCase()}
      </Text>
      <Html position={[0, 2.2, 0]} center distanceFactor={9}>
        <div className="w-16 h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-700">
          <div
            className="h-full bg-red-500 transition-all"
            style={{ width: `${Math.max(0, (enemy.health / enemy.maxHealth) * 100)}%` }}
          />
        </div>
      </Html>
    </group>
  );
}

function GameLogic({
  stats,
  setStats,
  enemies,
  setEnemies,
  onMatchEnd,
  moveInput,
  lookDelta,
  shootTrigger,
}: any) {
  const { camera, scene, raycaster } = useThree();
  const lastShot = useRef(0);
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const keys = useRef({ w: false, a: false, s: false, d: false });

  // Keyboard (desktop fallback)
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

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(scene.children, true);

    for (const hit of hits) {
      const id = hit.object.userData?.enemyId;
      if (id) {
        setEnemies((prev: Enemy[]) =>
          prev.map((e) => {
            if (e.id === id && e.alive) {
              const hp = e.health - DAMAGE;
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
  }, [camera, scene, raycaster, stats.ammo, setStats, setEnemies]);

  // React to fire button
  useEffect(() => {
    if (shootTrigger > 0) doShoot();
  }, [shootTrigger, doShoot]);

  useFrame((_, delta) => {
    // Look
    if (lookDelta.current.x !== 0 || lookDelta.current.y !== 0) {
      euler.current.setFromQuaternion(camera.quaternion);
      euler.current.y -= lookDelta.current.x;
      euler.current.x -= lookDelta.current.y;
      euler.current.x = THREE.MathUtils.clamp(euler.current.x, -1.4, 1.4);
      camera.quaternion.setFromEuler(euler.current);
      lookDelta.current.x = 0;
      lookDelta.current.y = 0;
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
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -ARENA_SIZE + 2, ARENA_SIZE - 2);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -ARENA_SIZE + 2, ARENA_SIZE - 2);

    // Enemy AI – walk toward player
    setEnemies((prev: Enemy[]) =>
      prev.map((e) => {
        if (!e.alive) return e;
        const dx = camera.position.x - e.position[0];
        const dz = camera.position.z - e.position[2];
        const dist = Math.hypot(dx, dz) || 1;
        if (dist > 2.2) {
          const speed = ENEMY_SPEED * delta;
          return {
            ...e,
            position: [
              e.position[0] + (dx / dist) * speed,
              e.position[1],
              e.position[2] + (dz / dist) * speed,
            ] as [number, number, number],
          };
        }
        return e;
      })
    );
  });

  // Win condition
  useEffect(() => {
    if (enemies.length > 0 && enemies.every((e: Enemy) => !e.alive)) {
      onMatchEnd(stats);
    }
  }, [enemies, stats, onMatchEnd]);

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[14, 22, 10]}
        intensity={1.35}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <Sky sunPosition={[90, 35, 70]} />
      <Physics gravity={[0, -28, 0]}>
        <Ground />
        <Walls />
        <Cover />
        <GunModel />
        {enemies.map((e: Enemy) => (
          <EnemyBot key={e.id} enemy={e} />
        ))}
      </Physics>
    </>
  );
}

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
      list.push({
        id: `e-${i}`,
        position: [
          (Math.random() - 0.5) * ARENA_SIZE * 1.65,
          1.05,
          (Math.random() - 0.5) * ARENA_SIZE * 1.65,
        ],
        health: ENEMY_HEALTH,
        maxHealth: ENEMY_HEALTH,
        faction: playerFaction === "wardog" ? "warcat" : "wardog",
        alive: true,
      });
    }
    return list;
  });

  const moveInput = useRef({ x: 0, z: 0 });
  const lookDelta = useRef({ x: 0, y: 0 });
  const [shootTrigger, setShootTrigger] = useState(0);
  const lastTouch = useRef<{ x: number; y: number } | null>(null);

  // Global pointer / touch look (no pointer lock)
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.buttons === 0) return;
      if (!lastTouch.current) {
        lastTouch.current = { x: e.clientX, y: e.clientY };
        return;
      }
      const dx = e.clientX - lastTouch.current.x;
      const dy = e.clientY - lastTouch.current.y;
      lookDelta.current.x += dx * LOOK_SENSITIVITY * 1.8;
      lookDelta.current.y += dy * LOOK_SENSITIVITY * 1.8;
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
    <div className="fixed inset-0 z-[200] bg-black select-none touch-none">
      <Canvas
        shadows
        camera={{ position: [0, PLAYER_HEIGHT, 7], fov: 75 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.shadowMap.type = THREE.PCFShadowMap; // silence deprecation
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
          shootTrigger={shootTrigger}
        />
      </Canvas>

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="w-7 h-7 border-2 border-white/90 rounded-full" />
        <div className="absolute inset-0 m-auto w-1.5 h-1.5 bg-white rounded-full" />
      </div>

      {/* Top bar */}
      <div className="absolute top-3 left-0 right-0 flex justify-between items-center px-4 pointer-events-none">
        <div className="bg-black/70 backdrop-blur px-3 py-1 rounded-full text-xs font-black tracking-wider text-white">
          {playerFaction.toUpperCase()} FORCE
        </div>
        <button
          onClick={onExit}
          className="pointer-events-auto bg-red-600 hover:bg-red-500 text-white font-black px-4 py-1.5 rounded-xl text-sm"
        >
          EXIT
        </button>
      </div>

      {/* HUD */}
      <div className="absolute bottom-36 left-4 bg-black/80 backdrop-blur-md px-4 py-3 rounded-2xl text-white font-mono text-sm space-y-1 pointer-events-none">
        <div className="text-emerald-400 font-bold">HP {Math.round(stats.health)}/{stats.maxHealth}</div>
        <div>AMMO {stats.ammo}/{stats.maxAmmo}</div>
        <div className="text-amber-400">KILLS {stats.kills}</div>
      </div>

      {/* Left Joystick */}
      <div
        className="absolute bottom-10 left-6 w-28 h-28 rounded-full border-2 border-white/30 bg-black/50 flex items-center justify-center"
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
        <div className="w-12 h-12 rounded-full bg-white/25" />
      </div>

      {/* FIRE button */}
      <button
        className="absolute bottom-10 right-8 w-24 h-24 rounded-full bg-red-600 border-4 border-red-400 text-white font-black text-lg shadow-xl active:scale-95"
        onPointerDown={(e) => {
          e.preventDefault();
          setShootTrigger((v) => v + 1);
        }}
      >
        FIRE
      </button>

      {/* Hint */}
      <div className="absolute bottom-44 left-1/2 -translate-x-1/2 text-white/60 text-xs text-center pointer-events-none">
        Drag to look • Joystick move • FIRE to shoot
      </div>
    </div>
  );
}
