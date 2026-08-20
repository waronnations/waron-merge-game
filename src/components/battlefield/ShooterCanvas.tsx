// src/components/battlefield/ShooterCanvas.tsx
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
  ENEMY_DAMAGE,
  ENEMY_FIRE_RATE,
  ENEMY_RANGE,
  RECOIL_AMOUNT,
  RECOIL_RECOVERY,
} from "./constants";
import type { Faction, PlayerStats, Enemy } from "./types";
import { useBattleSounds } from "./useBattleSounds";

interface Props {
  playerFaction: Faction;
  onMatchEnd: (stats: PlayerStats) => void;
  rankBonus?: number;
  onExit: () => void;
}

const MOVE_DEADZONE = 0.14;
const LOOK_SENS = 0.0028; // px → radians (touch drag look)
const CENTER_FIRE_SIZE = 64; // small explicit fire button

function Ground() {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ARENA_SIZE * 2.6, ARENA_SIZE * 2.6]} />
        <meshStandardMaterial color="#111" roughness={0.92} />
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
      {[
        [0, h / 2, -s, s * 2.6, h, 1.6],
        [0, h / 2, s, s * 2.6, h, 1.6],
        [-s, h / 2, 0, 1.6, h, s * 2.6],
        [s, h / 2, 0, 1.6, h, s * 2.6],
      ].map((a, i) => (
        <RigidBody key={i} type="fixed">
          <mesh position={[a[0], a[1], a[2]] as any}>
            <boxGeometry args={[a[3], a[4], a[5]] as any} />
            {mat}
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}

function MapCover() {
  const pieces = useMemo(
    () => [
      { pos: [0, 1.3, 0] as [number, number, number], size: [4.5, 2.6, 4.5] as [number, number, number] },
      { pos: [-8, 1.1, -6] as [number, number, number], size: [3.2, 2.2, 3.2] as [number, number, number] },
      { pos: [9, 1.1, 7] as [number, number, number], size: [3.5, 2.3, 3] as [number, number, number] },
      { pos: [-12, 1.2, 10] as [number, number, number], size: [2.8, 2.4, 5] as [number, number, number] },
      { pos: [11, 1.0, -11] as [number, number, number], size: [5, 2.0, 2.8] as [number, number, number] },
      { pos: [-6, 2.8, 14] as [number, number, number], size: [6, 0.6, 4] as [number, number, number] },
      { pos: [7, 2.6, -13] as [number, number, number], size: [5, 0.6, 4.5] as [number, number, number] },
    ],
    []
  );
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
    <group
      position={[0.33, -0.29 - recoil * 0.1, -0.55]}
      rotation={[0.1 + recoil * 0.9, 0.14, recoil * 0.2]}
    >
      <mesh>
        <boxGeometry args={[0.085, 0.14, 0.48]} />
        <meshStandardMaterial color="#0c0c0c" metalness={0.92} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.02, -0.32]}>
        <boxGeometry args={[0.04, 0.04, 0.28]} />
        <meshStandardMaterial color="#050505" metalness={0.95} />
      </mesh>
    </group>
  );
}

function MuzzleFlame({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <group position={[0.33, -0.22, -0.9]}>
      <pointLight intensity={20} distance={8} color="#ffaa33" decay={2} />
      <mesh>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#fff5cc" transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0, -0.05]} scale={[1.3, 1, 1.5]}>
        <sphereGeometry args={[0.08, 6, 6]} />
        <meshBasicMaterial color="#ff6600" transparent opacity={0.65} />
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
      <Text
        position={[0, 1.95, 0]}
        fontSize={0.26}
        color="white"
        anchorX="center"
        outlineWidth={0.02}
        outlineColor="#000"
      >
        {enemy.faction.toUpperCase()}
      </Text>
      <Html position={[0, 2.3, 0]} center distanceFactor={10}>
        <div className="w-16 h-1.5 bg-black/80 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-500 transition-all duration-100"
            style={{
              width: `${Math.max(0, (enemy.health / enemy.maxHealth) * 100)}%`,
            }}
          />
        </div>
      </Html>
    </group>
  );
}

function GameLogic(props: any) {
  const {
    stats,
    setStats,
    enemies,
    setEnemies,
    onMatchEnd,
    moveInput,
    lookDelta,
    fireRequest,
    setFireRequest,
    setMuzzle,
    setRecoil,
    hitFlashes,
    setHitFlashes,
    invulnerableUntil,
    setHitMarker,
    sounds,
  } = props;

  const { camera, scene, raycaster } = useThree();
  const lastShot = useRef(0);
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const keys = useRef({ w: false, a: false, s: false, d: false, r: false });
  const recoilOffset = useRef(0);
  const isReloading = useRef(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "KeyW") keys.current.w = true;
      if (e.code === "KeyA") keys.current.a = true;
      if (e.code === "KeyS") keys.current.s = true;
      if (e.code === "KeyD") keys.current.d = true;
      if (e.code === "KeyR") keys.current.r = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "KeyW") keys.current.w = false;
      if (e.code === "KeyA") keys.current.a = false;
      if (e.code === "KeyS") keys.current.s = false;
      if (e.code === "KeyD") keys.current.d = false;
      if (e.code === "KeyR") keys.current.r = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const doReload = useCallback(() => {
    if (isReloading.current || stats.ammo >= stats.maxAmmo) return;
    isReloading.current = true;
    sounds.reload();
    setTimeout(() => {
      setStats((s: PlayerStats) => ({ ...s, ammo: s.maxAmmo }));
      isReloading.current = false;
    }, 1400);
  }, [stats.ammo, stats.maxAmmo, setStats, sounds]);

  /** Single explicit shot (tap fire) */
  const doShoot = useCallback(() => {
    const now = performance.now() / 1000;
    if (now - lastShot.current < FIRE_RATE) return;

    if (stats.ammo <= 0 || isReloading.current) {
      if (stats.ammo <= 0) {
        sounds.empty();
        doReload();
      }
      return;
    }

    lastShot.current = now;
    sounds.shot();

    setStats((s: PlayerStats) => ({
      ...s,
      ammo: Math.max(0, s.ammo - 1),
      damageDealt: s.damageDealt + DAMAGE,
    }));

    // Mild recoil — mostly visual, almost no aim drop
    recoilOffset.current = Math.min(0.35, recoilOffset.current + RECOIL_AMOUNT * 0.45);
    setRecoil(recoilOffset.current);
    setMuzzle(true);
    setTimeout(() => setMuzzle(false), 50);

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(scene.children, true);

    for (const hit of hits) {
      const id = hit.object.userData?.enemyId;
      if (id) {
        sounds.hit();
        setEnemies((prev: Enemy[]) =>
          prev.map((e) => {
            if (e.id === id && e.alive) {
              const hp = e.health - DAMAGE;
              setHitFlashes((f: any) => ({ ...f, [id]: Date.now() }));
              setHitMarker(true);
              setTimeout(() => setHitMarker(false), 120);

              if (hp <= 0) {
                setStats((s: PlayerStats) => ({
                  ...s,
                  kills: s.kills + 1,
                  damageDealt: s.damageDealt + e.health,
                }));
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
  }, [
    camera,
    scene,
    raycaster,
    stats.ammo,
    doReload,
    setStats,
    setEnemies,
    setMuzzle,
    setRecoil,
    setHitFlashes,
    setHitMarker,
    sounds,
  ]);

  useFrame((_, delta) => {
    // Consume one fire request per frame max
    if (fireRequest.current) {
      fireRequest.current = false;
      doShoot();
    }

    if (keys.current.r) doReload();

    // Look from touch drag (stable, no fire coupling)
    const ldx = lookDelta.current.x;
    const ldy = lookDelta.current.y;
    if (ldx !== 0 || ldy !== 0) {
      euler.current.setFromQuaternion(camera.quaternion);
      euler.current.y -= ldx;
      euler.current.x -= ldy;
      euler.current.x = THREE.MathUtils.clamp(euler.current.x, -1.2, 1.2);
      camera.quaternion.setFromEuler(euler.current);
      lookDelta.current = { x: 0, y: 0 };
    }

    if (recoilOffset.current > 0) {
      recoilOffset.current = Math.max(0, recoilOffset.current - delta * RECOIL_RECOVERY * 1.4);
      setRecoil(recoilOffset.current);
    }

    // Move
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3()
      .crossVectors(forward, new THREE.Vector3(0, 1, 0))
      .normalize();

    let mx = moveInput.current.x;
    let mz = moveInput.current.z;
    if (keys.current.w) mz -= 1;
    if (keys.current.s) mz += 1;
    if (keys.current.a) mx -= 1;
    if (keys.current.d) mx += 1;

    if (Math.abs(mx) > MOVE_DEADZONE || Math.abs(mz) > MOVE_DEADZONE) {
      const len = Math.hypot(mx, mz) || 1;
      mx /= len;
      mz /= len;
      camera.position.x += (forward.x * -mz + right.x * mx) * PLAYER_SPEED * delta;
      camera.position.z += (forward.z * -mz + right.z * mx) * PLAYER_SPEED * delta;
    }

    camera.position.y = PLAYER_HEIGHT;
    camera.position.x = THREE.MathUtils.clamp(
      camera.position.x,
      -ARENA_SIZE + 2.5,
      ARENA_SIZE - 2.5
    );
    camera.position.z = THREE.MathUtils.clamp(
      camera.position.z,
      -ARENA_SIZE + 2.5,
      ARENA_SIZE - 2.5
    );

    // Enemies — staggered, slower, fairer
    const now = performance.now() / 1000;
    const invuln = now < invulnerableUntil.current;

    setEnemies((prev: Enemy[]) =>
      prev.map((e, idx) => {
        if (!e.alive) return e;

        const dx = camera.position.x - e.position[0];
        const dz = camera.position.z - e.position[2];
        const dist = Math.hypot(dx, dz) || 1;
        let pos = e.position;

        if (dist > 6) {
          const speed = ENEMY_SPEED * 0.85 * delta;
          const angle = Math.atan2(dz, dx) + Math.sin(now + idx) * 0.25;
          pos = [
            e.position[0] + Math.cos(angle) * speed,
            e.position[1],
            e.position[2] + Math.sin(angle) * speed,
          ] as [number, number, number];
        } else if (dist < 4) {
          const speed = ENEMY_SPEED * 0.5 * delta;
          pos = [
            e.position[0] - (dx / dist) * speed,
            e.position[1],
            e.position[2] - (dz / dist) * speed,
          ] as [number, number, number];
        }

        let last = e.lastShot;
        // Longer interval + low chance + per-enemy offset → no synchronized death burst
        const personalRate = ENEMY_FIRE_RATE * 1.6 + idx * 0.35;
        if (
          !invuln &&
          dist < ENEMY_RANGE * 0.9 &&
          now - e.lastShot > personalRate &&
          Math.random() < 0.12
        ) {
          last = now;
          sounds.playerHit();
          setStats((s: PlayerStats) => {
            // Softer damage so you can actually fight back
            const dmg = Math.max(4, Math.floor(ENEMY_DAMAGE * 0.55));
            const hp = Math.max(0, s.health - dmg);
            if (hp <= 0) {
              setTimeout(() => {
                onMatchEnd({ ...s, health: 0, survived: false });
              }, 300);
            }
            return { ...s, health: hp };
          });
        }
        return { ...e, position: pos, lastShot: last };
      })
    );
  });

  useEffect(() => {
    if (enemies.length > 0 && enemies.every((e: Enemy) => !e.alive)) {
      onMatchEnd({ ...stats, survived: true });
    }
  }, [enemies]);

  return (
    <>
      <color attach="background" args={["#0a0a12"]} />
      <fog attach="fog" args={["#0a0a12", 28, 68]} />
      <ambientLight intensity={0.34} />
      <directionalLight position={[16, 26, 10]} intensity={1.4} castShadow />
      <Sky sunPosition={[80, 28, 50]} />
      <Physics gravity={[0, -30, 0]}>
        <Ground />
        <Walls />
        <MapCover />
        <GunModel recoil={0} />
        {enemies.map((e: Enemy) => (
          <EnemyBot
            key={e.id}
            enemy={e}
            hitFlash={!!hitFlashes[e.id] && Date.now() - hitFlashes[e.id] < 90}
          />
        ))}
      </Physics>
    </>
  );
}

function VirtualStick({
  label,
  onChange,
  size = 132,
}: {
  label: string;
  onChange: (x: number, y: number) => void;
  size?: number;
}) {
  const active = useRef(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const handle = (clientX: number, clientY: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const max = rect.width / 2 - 8;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    setKnob({ x: dx, y: dy });
    onChange(dx / max, dy / max);
  };

  return (
    <div className="relative flex flex-col items-center gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
        {label}
      </span>
      <div
        className="relative rounded-full border-2 border-white/30 bg-black/55 touch-none select-none"
        style={{ width: size, height: size }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          active.current = true;
          handle(e.clientX, e.clientY, e.currentTarget);
        }}
        onPointerMove={(e) => {
          if (!active.current) return;
          handle(e.clientX, e.clientY, e.currentTarget);
        }}
        onPointerUp={(e) => {
          active.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
          setKnob({ x: 0, y: 0 });
          onChange(0, 0);
        }}
        onPointerCancel={() => {
          active.current = false;
          setKnob({ x: 0, y: 0 });
          onChange(0, 0);
        }}
      >
        <div
          className="absolute left-1/2 top-1/2 rounded-full bg-white/30"
          style={{
            width: size * 0.4,
            height: size * 0.4,
            transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
            transition: active.current ? "none" : "transform 0.12s ease-out",
          }}
        />
      </div>
    </div>
  );
}

export function ShooterCanvas({
  playerFaction,
  onMatchEnd,
  rankBonus = 0,
  onExit,
}: Props) {
  const sounds = useBattleSounds();
  const [stats, setStats] = useState<PlayerStats>({
    health: MAX_HEALTH + rankBonus * 6,
    maxHealth: MAX_HEALTH + rankBonus * 6,
    ammo: MAX_AMMO,
    maxAmmo: MAX_AMMO,
    kills: 0,
    deaths: 0,
    damageDealt: 0,
    survived: false,
  });

  const [enemies, setEnemies] = useState<Enemy[]>(() => {
    const now = performance.now() / 1000;
    return Array.from({ length: ENEMY_COUNT }, (_, i) => {
      const angle = (i / ENEMY_COUNT) * Math.PI * 2;
      const r = 16 + Math.random() * 10;
      return {
        id: `e-${i}`,
        position: [
          Math.cos(angle) * r,
          1.1,
          Math.sin(angle) * r,
        ] as [number, number, number],
        health: ENEMY_HEALTH,
        maxHealth: ENEMY_HEALTH,
        faction: (playerFaction === "wardog" ? "warcat" : "wardog") as Faction,
        alive: true,
        // Stagger first possible shot so they never open fire together
        lastShot: now + 4 + i * 1.1 + Math.random() * 2,
      };
    });
  });

  const moveInput = useRef({ x: 0, z: 0 });
  const lookDelta = useRef({ x: 0, y: 0 });
  const fireRequest = useRef(false);
  const lookDragging = useRef(false);
  const lastLook = useRef({ x: 0, y: 0 });

  const [muzzle, setMuzzle] = useState(false);
  const [recoil, setRecoil] = useState(0);
  const [hitFlashes, setHitFlashes] = useState<Record<string, number>>({});
  const [hitMarker, setHitMarker] = useState(false);
  const [firePulse, setFirePulse] = useState(false);
  const invulnerableUntil = useRef(performance.now() / 1000 + 4.5);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 50);
    return () => clearTimeout(t);
  }, []);

  /** Right-side / free area look — does NOT shoot */
  const onLookDown = (e: React.PointerEvent) => {
    // Ignore if touching the center fire button or left stick area
    const target = e.target as HTMLElement;
    if (target.closest("[data-fire-btn]") || target.closest("[data-move-stick]")) {
      return;
    }
    e.preventDefault();
    lookDragging.current = true;
    lastLook.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onLookMove = (e: React.PointerEvent) => {
    if (!lookDragging.current) return;
    const dx = e.clientX - lastLook.current.x;
    const dy = e.clientY - lastLook.current.y;
    lastLook.current = { x: e.clientX, y: e.clientY };
    lookDelta.current.x += dx * LOOK_SENS;
    lookDelta.current.y += dy * LOOK_SENS;
  };

  const onLookUp = (e: React.PointerEvent) => {
    lookDragging.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  /** Explicit TAP on center button = one shot */
  const onFireTap = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sounds.unlock();
    fireRequest.current = true;
    setFirePulse(true);
    setTimeout(() => setFirePulse(false), 100);
  };

  if (!ready) {
    return (
      <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-lg font-bold mb-2">Loading Battlefield...</div>
          <div className="text-sm text-white/60">Preparing arena</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[200] bg-black select-none touch-none overflow-hidden"
      onPointerDown={() => sounds.unlock()}
    >
      <Canvas
        key="battlefield-canvas"
        shadows
        camera={{ position: [0, PLAYER_HEIGHT, 8], fov: 72 }}
        gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor("#0a0a12");
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
          fireRequest={fireRequest}
          setFireRequest={() => {}}
          setMuzzle={setMuzzle}
          setRecoil={setRecoil}
          hitFlashes={hitFlashes}
          setHitFlashes={setHitFlashes}
          invulnerableUntil={invulnerableUntil}
          setHitMarker={setHitMarker}
          sounds={sounds}
        />
        <MuzzleFlame active={muzzle} />
      </Canvas>

      {/* Full-screen look layer (behind controls) */}
      <div
        className="absolute inset-0 z-[5]"
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
      />

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
        <div
          className={`w-6 h-6 border-2 rounded-full transition-all duration-75 ${
            hitMarker ? "border-red-400 scale-125" : "border-white/90"
          }`}
        />
        <div className="absolute inset-0 m-auto w-1 h-1 bg-white rounded-full" />
      </div>

      {/* Small CENTER fire button — explicit tap only */}
      <button
        type="button"
        data-fire-btn
        className={`absolute top-1/2 left-1/2 z-20 -translate-x-1/2 translate-y-10 rounded-full font-black text-white text-[11px] shadow-lg select-none touch-none transition ${
          firePulse
            ? "bg-red-400 scale-110 ring-4 ring-red-300/40"
            : "bg-red-600/85"
        }`}
        style={{ width: CENTER_FIRE_SIZE, height: CENTER_FIRE_SIZE }}
        onPointerDown={onFireTap}
        onContextMenu={(e) => e.preventDefault()}
      >
        FIRE
      </button>

      {/* Top bar */}
      <div className="absolute top-3 left-0 right-0 flex justify-between items-center px-4 z-30">
        <div className="bg-black/70 px-3 py-1.5 rounded-full text-xs font-black text-white">
          {playerFaction.toUpperCase()}
        </div>
        <button
          onClick={onExit}
          className="bg-red-600 text-white font-black px-4 py-1.5 rounded-xl text-sm active:scale-95"
        >
          EXIT
        </button>
      </div>

      {/* HUD */}
      <div className="absolute bottom-44 left-4 bg-black/80 px-4 py-3 rounded-2xl text-white font-mono text-sm space-y-1 pointer-events-none z-20">
        <div
          className={
            stats.health < 30 ? "text-red-400 font-bold" : "text-emerald-400 font-bold"
          }
        >
          HP {Math.round(stats.health)}/{stats.maxHealth}
        </div>
        <div>
          AMMO {stats.ammo}/{stats.maxAmmo}
        </div>
        <div className="text-amber-400">KILLS {stats.kills}</div>
      </div>

      {/* LEFT — MOVE only */}
      <div className="absolute bottom-6 left-3 z-30" data-move-stick>
        <VirtualStick
          label="Move"
          size={132}
          onChange={(x, y) => {
            moveInput.current = { x, z: y };
          }}
        />
      </div>

      {/* Reload */}
      <button
        type="button"
        className="absolute bottom-8 right-4 z-30 rounded-full bg-zinc-800/90 border border-zinc-600 text-white text-[10px] font-black px-4 py-2 active:scale-95 select-none"
        onPointerDown={(e) => {
          e.stopPropagation();
          sounds.unlock();
          window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyR" }));
          setTimeout(() => {
            window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyR" }));
          }, 40);
        }}
      >
        RELOAD
      </button>
    </div>
  );
}
