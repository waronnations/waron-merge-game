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

function Ground() {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ARENA_SIZE * 2.6, ARENA_SIZE * 2.6]} />
        <meshStandardMaterial color="#111111" roughness={0.92} />
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
      <RigidBody type="fixed"><mesh position={[0, h / 2, -s]}><boxGeometry args={[s * 2.6, h, 1.6]} />{mat}</mesh></RigidBody>
      <RigidBody type="fixed"><mesh position={[0, h / 2, s]}><boxGeometry args={[s * 2.6, h, 1.6]} />{mat}</mesh></RigidBody>
      <RigidBody type="fixed"><mesh position={[-s, h / 2, 0]}><boxGeometry args={[1.6, h, s * 2.6]} />{mat}</mesh></RigidBody>
      <RigidBody type="fixed"><mesh position={[s, h / 2, 0]}><boxGeometry args={[1.6, h, s * 2.6]} />{mat}</mesh></RigidBody>
    </group>
  );
}

function MapCover() {
  const pieces = useMemo(() => [
    { pos: [0, 1.3, 0] as [number, number, number], size: [4.5, 2.6, 4.5] as [number, number, number] },
    { pos: [-8, 1.1, -6] as [number, number, number], size: [3.2, 2.2, 3.2] as [number, number, number] },
    { pos: [9, 1.1, 7] as [number, number, number], size: [3.5, 2.3, 3] as [number, number, number] },
    { pos: [-12, 1.2, 10] as [number, number, number], size: [2.8, 2.4, 5] as [number, number, number] },
    { pos: [11, 1.0, -11] as [number, number, number], size: [5, 2.0, 2.8] as [number, number, number] },
    { pos: [-6, 2.8, 14] as [number, number, number], size: [6, 0.6, 4] as [number, number, number] },
    { pos: [7, 2.6, -13] as [number, number, number], size: [5, 0.6, 4.5] as [number, number, number] },
    { pos: [-16, 1.4, 0] as [number, number, number], size: [2, 2.8, 8] as [number, number, number] },
    { pos: [16, 1.4, 3] as [number, number, number], size: [2, 2.8, 7] as [number, number, number] },
    { pos: [0, 1.2, -16] as [number, number, number], size: [9, 2.4, 2] as [number, number, number] },
    { pos: [3, 1.2, 17] as [number, number, number], size: [8, 2.4, 2] as [number, number, number] },
  ], []);

  return (
    <group>
      {pieces.map((p, i) => (
        <RigidBody key={i} type="fixed" colliders="cuboid">
          <mesh position={p.pos} castShadow>
            <boxGeometry args={p.size} />
            <meshStandardMaterial color="#1f1f1f" roughness={0.75} />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}

function GunModel({ recoil }: { recoil: number }) {
  return (
    <group position={[0.33, -0.29 - recoil * 0.12, -0.55]} rotation={[0.14 + recoil * 1.6, 0.16, recoil * 0.35]}>
      <mesh>
        <boxGeometry args={[0.08, 0.13, 0.46]} />
        <meshStandardMaterial color="#0d0d0d" metalness={0.95} roughness={0.18} />
      </mesh>
      <mesh position={[0, 0.025, -0.28]}>
        <boxGeometry args={[0.045, 0.045, 0.26]} />
        <meshStandardMaterial color="#050505" />
      </mesh>
    </group>
  );
}

function MuzzleFlash({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <group position={[0.33, -0.22, -0.85]}>
      <pointLight intensity={16} distance={8} color="#ffaa44" />
      <mesh>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color="#ffcc66" transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

function EnemyBot({ enemy, hitFlash }: { enemy: Enemy; hitFlash: boolean }) {
  if (!enemy.alive) return null;
  const base = enemy.faction === "wardog" ? "#ef4444" : "#3b82f6";
  const color = hitFlash ? "#ffffff" : base;

  return (
    <group position={enemy.position}>
      <mesh castShadow userData={{ enemyId: enemy.id }}>
        <capsuleGeometry args={[0.42, 1.35]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.15, 0]} castShadow>
        <sphereGeometry args={[0.28, 12, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Text position={[0, 1.95, 0]} fontSize={0.26} color="white" anchorX="center" outlineWidth={0.02} outlineColor="#000">
        {enemy.faction.toUpperCase()}
      </Text>
      <Html position={[0, 2.3, 0]} center distanceFactor={10}>
        <div className="w-16 h-1.5 bg-black/80 rounded-full overflow-hidden">
          <div className="h-full bg-red-500" style={{ width: `${Math.max(0, (enemy.health / enemy.maxHealth) * 100)}%` }} />
        </div>
      </Html>
    </group>
  );
}

function GameLogic(props: any) {
  const {
    stats, setStats, enemies, setEnemies, onMatchEnd,
    moveInput, lookDelta, isFiring, setMuzzle, setRecoil,
    hitFlashes, setHitFlashes, invulnerableUntil, enemyPositions
  } = props;

  const { camera, scene, raycaster } = useThree();
  const lastShot = useRef(0);
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const keys = useRef({ w: false, a: false, s: false, d: false });
  const recoilOffset = useRef(0);

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

    recoilOffset.current += RECOIL_AMOUNT;
    setRecoil(recoilOffset.current);
    setMuzzle(true);
    setTimeout(() => setMuzzle(false), 50);

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(scene.children, true);

    for (const hit of hits) {
      const id = hit.object.userData?.enemyId;
      if (id) {
        setEnemies((prev: Enemy[]) =>
          prev.map((e) => {
            if (e.id === id && e.alive) {
              const hp = e.health - DAMAGE;
              setHitFlashes((f: any) => ({ ...f, [id]: Date.now() }));
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
  }, [camera, scene, raycaster, stats.ammo]);

  useFrame((_, delta) => {
    if (isFiring) doShoot();

    // Look (stable)
    if (lookDelta.current.x !== 0 || lookDelta.current.y !== 0) {
      euler.current.setFromQuaternion(camera.quaternion);
      euler.current.y -= lookDelta.current.x;
      euler.current.x -= lookDelta.current.y;
      euler.current.x = THREE.MathUtils.clamp(euler.current.x, -1.3, 1.3);
      camera.quaternion.setFromEuler(euler.current);
      lookDelta.current.x = 0;
      lookDelta.current.y = 0;
    }

    // Recoil recovery
    if (recoilOffset.current > 0) {
      recoilOffset.current = Math.max(0, recoilOffset.current - delta * RECOIL_RECOVERY);
      setRecoil(recoilOffset.current);
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
      mx /= len; mz /= len;
      camera.position.x += (forward.x * -mz + right.x * mx) * PLAYER_SPEED * delta;
      camera.position.z += (forward.z * -mz + right.z * mx) * PLAYER_SPEED * delta;
    }

    camera.position.y = PLAYER_HEIGHT;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -ARENA_SIZE + 2.5, ARENA_SIZE - 2.5);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -ARENA_SIZE + 2.5, ARENA_SIZE - 2.5);

    // Enemy movement (using refs for stability)
    const now = performance.now() / 1000;
    const invuln = now < invulnerableUntil.current;

    enemies.forEach((e: Enemy, i: number) => {
      if (!e.alive) return;

      const pos = enemyPositions.current[e.id] || e.position;
      const dx = camera.position.x - pos[0];
      const dz = camera.position.z - pos[2];
      const dist = Math.hypot(dx, dz) || 1;

      if (dist > 4) {
        const speed = ENEMY_SPEED * delta;
        const newPos: [number, number, number] = [
          pos[0] + (dx / dist) * speed,
          pos[1],
          pos[2] + (dz / dist) * speed,
        ];
        enemyPositions.current[e.id] = newPos;
      }

      // Only closest 2 enemies shoot, and only after delay
      if (!invuln && dist < ENEMY_RANGE && now - e.lastShot > ENEMY_FIRE_RATE) {
        // simple check if this is one of the closest
        // (we keep it simple for stability)
        if (Math.random() < 0.4) { // reduce spam
          e.lastShot = now;
          setStats((s: PlayerStats) => {
            const hp = Math.max(0, s.health - ENEMY_DAMAGE);
            if (hp <= 0) {
              setTimeout(() => onMatchEnd({ ...s, health: 0 }), 300);
            }
            return { ...s, health: hp };
          });
        }
      }
    });
  });

  // Sync positions back to React state less frequently
  useEffect(() => {
    const id = setInterval(() => {
      setEnemies((prev: Enemy[]) =>
        prev.map((e) => ({
          ...e,
          position: enemyPositions.current[e.id] || e.position,
        }))
      );
    }, 200); // only 5 times per second
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (enemies.length > 0 && enemies.every((e: Enemy) => !e.alive)) {
      onMatchEnd(stats);
    }
  }, [enemies]);

  return (
    <>
      <color attach="background" args={["#0a0a12"]} />
      <fog attach="fog" args={["#0a0a12", 32, 78]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[16, 26, 10]} intensity={1.5} castShadow />
      <Sky sunPosition={[80, 30, 50]} />
      <Physics gravity={[0, -30, 0]}>
        <Ground />
        <Walls />
        <MapCover />
        <GunModel recoil={0} />
        {enemies.map((e: Enemy) => (
          <EnemyBot
            key={e.id}
            enemy={{
              ...e,
              position: enemyPositions.current[e.id] || e.position,
            }}
            hitFlash={!!hitFlashes[e.id] && Date.now() - hitFlashes[e.id] < 100}
          />
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
    const now = performance.now() / 1000;
    const list: Enemy[] = [];
    for (let i = 0; i < ENEMY_COUNT; i++) {
      const angle = (i / ENEMY_COUNT) * Math.PI * 2;
      const r = 16 + Math.random() * 10;
      list.push({
        id: `e-${i}`,
        position: [Math.cos(angle) * r, 1.1, Math.sin(angle) * r],
        health: ENEMY_HEALTH,
        maxHealth: ENEMY_HEALTH,
        faction: playerFaction === "wardog" ? "warcat" : "wardog",
        alive: true,
        lastShot: now + 3 + Math.random() * 3,
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
  const invulnerableUntil = useRef(performance.now() / 1000 + 3.8);
  const enemyPositions = useRef<Record<string, [number, number, number]>>({});
  const isUIActive = useRef(false); // critical for stability

  // Initialize positions
  useEffect(() => {
    enemies.forEach((e) => {
      enemyPositions.current[e.id] = e.position;
    });
  }, []);

  // Stable look – ignores UI
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (isUIActive.current) return;
      if (e.pointerType === "mouse" && e.buttons === 0) return;

      if (!lastTouch.current) {
        lastTouch.current = { x: e.clientX, y: e.clientY };
        return;
      }
      const dx = e.clientX - lastTouch.current.x;
      const dy = e.clientY - lastTouch.current.y;
      lookDelta.current.x += dx * LOOK_SENSITIVITY * 1.7;
      lookDelta.current.y += dy * LOOK_SENSITIVITY * 1.7;
      lastTouch.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = () => {
      lastTouch.current = null;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
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
          invulnerableUntil={invulnerableUntil}
          enemyPositions={enemyPositions}
        />
        <MuzzleFlash active={muzzle} />
      </Canvas>

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="w-7 h-7 border-2 border-white/90 rounded-full" />
        <div className="absolute inset-0 m-auto w-1.5 h-1.5 bg-white rounded-full" />
      </div>

      {/* Top bar */}
      <div className="absolute top-3 left-0 right-0 flex justify-between items-center px-4 z-20">
        <div className="bg-black/70 px-3 py-1.5 rounded-full text-xs font-black text-white">
          {playerFaction.toUpperCase()}
        </div>
        <button onClick={onExit} className="bg-red-600 text-white font-black px-4 py-1.5 rounded-xl text-sm">
          EXIT
        </button>
      </div>

      {/* HUD */}
      <div className="absolute bottom-40 left-4 bg-black/80 px-4 py-3 rounded-2xl text-white font-mono text-sm space-y-1 pointer-events-none">
        <div className={stats.health < 30 ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
          HP {Math.round(stats.health)}/{stats.maxHealth}
        </div>
        <div>AMMO {stats.ammo}/{stats.maxAmmo}</div>
        <div className="text-amber-400">KILLS {stats.kills}</div>
      </div>

      {/* Joystick */}
      <div
        className="absolute bottom-8 left-5 w-32 h-32 rounded-full border-2 border-white/30 bg-black/50 flex items-center justify-center z-30"
        onPointerDown={(e) => {
          isUIActive.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const rect = e.currentTarget.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          moveInput.current = {
            x: Math.max(-1, Math.min(1, (e.clientX - cx) / (rect.width / 2))),
            z: Math.max(-1, Math.min(1, (e.clientY - cy) / (rect.height / 2))),
          };
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          moveInput.current = {
            x: Math.max(-1, Math.min(1, (e.clientX - cx) / (rect.width / 2))),
            z: Math.max(-1, Math.min(1, (e.clientY - cy) / (rect.height / 2))),
          };
        }}
        onPointerUp={(e) => {
          isUIActive.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
          moveInput.current = { x: 0, z: 0 };
        }}
      >
        <div className="w-14 h-14 rounded-full bg-white/25" />
      </div>

      {/* FIRE button */}
      <button
        className="absolute bottom-8 right-6 w-28 h-28 rounded-full bg-red-600 border-4 border-red-400 text-white font-black text-xl z-30 active:scale-95"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          isUIActive.current = true;
          setIsFiring(true);
        }}
        onPointerUp={() => {
          isUIActive.current = false;
          setIsFiring(false);
        }}
        onPointerLeave={() => {
          isUIActive.current = false;
          setIsFiring(false);
        }}
        onPointerCancel={() => {
          isUIActive.current = false;
          setIsFiring(false);
        }}
      >
        FIRE
      </button>
    </div>
  );
}
