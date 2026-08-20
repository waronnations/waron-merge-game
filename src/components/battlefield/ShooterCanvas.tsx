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

const MOVE_DEADZONE = 0.12;
const LOOK_DEADZONE = 0.08;
const LOOK_SENS_X = 2.6;
const LOOK_SENS_Y = 2.1;
const FIRE_BTN_SIZE = 92;

// ─── Lightweight smoke particle ─────────────────────────────────────────────
type SmokePuff = {
  id: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  scale: number;
};

type ImpactSpark = {
  id: number;
  pos: THREE.Vector3;
  life: number;
};

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
      position={[0.33, -0.29 - recoil * 0.16, -0.55]}
      rotation={[0.12 + recoil * 2.1, 0.14, recoil * 0.4]}
    >
      <mesh>
        <boxGeometry args={[0.085, 0.14, 0.48]} />
        <meshStandardMaterial color="#0c0c0c" metalness={0.92} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.02, -0.32]}>
        <boxGeometry args={[0.04, 0.04, 0.28]} />
        <meshStandardMaterial color="#050505" metalness={0.95} />
      </mesh>
      <mesh position={[0, 0.09, -0.05]}>
        <boxGeometry args={[0.02, 0.03, 0.08]} />
        <meshStandardMaterial color="#222" />
      </mesh>
    </group>
  );
}

/** Real flame + core glow at the muzzle */
function MuzzleFlame({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <group position={[0.33, -0.22, -0.9]}>
      <pointLight intensity={28} distance={10} color="#ffaa33" decay={2} />
      {/* Core */}
      <mesh>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial color="#fff5cc" transparent opacity={0.95} />
      </mesh>
      {/* Outer flame */}
      <mesh position={[0, 0, -0.06]} scale={[1.4, 1.1, 1.8]}>
        <sphereGeometry args={[0.09, 6, 6]} />
        <meshBasicMaterial color="#ff6600" transparent opacity={0.75} />
      </mesh>
      <mesh position={[0, 0, -0.12]} scale={[0.9, 0.7, 1.4]}>
        <sphereGeometry args={[0.08, 6, 6]} />
        <meshBasicMaterial color="#ff3300" transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

function SmokeSystem({ puffs }: { puffs: SmokePuff[] }) {
  return (
    <group>
      {puffs.map((p) => {
        const t = 1 - p.life / p.maxLife;
        const opacity = Math.max(0, 0.45 * (1 - t));
        const s = p.scale * (0.6 + t * 1.4);
        return (
          <mesh key={p.id} position={p.pos} scale={[s, s, s]}>
            <sphereGeometry args={[0.15, 6, 6]} />
            <meshBasicMaterial
              color="#888888"
              transparent
              opacity={opacity}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function ImpactSparks({ sparks }: { sparks: ImpactSpark[] }) {
  return (
    <group>
      {sparks.map((s) => (
        <mesh key={s.id} position={s.pos}>
          <sphereGeometry args={[0.08, 6, 6]} />
          <meshBasicMaterial
            color="#ffcc66"
            transparent
            opacity={Math.max(0, s.life * 4)}
          />
        </mesh>
      ))}
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
    lookInput,
    isFiring,
    setMuzzle,
    setRecoil,
    hitFlashes,
    setHitFlashes,
    invulnerableUntil,
    setHitMarker,
    smokePuffs,
    setSmokePuffs,
    impactSparks,
    setImpactSparks,
    sounds,
    screenPunch,
  } = props;

  const { camera, scene, raycaster } = useThree();
  const lastShot = useRef(0);
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const keys = useRef({ w: false, a: false, s: false, d: false, r: false });
  const recoilOffset = useRef(0);
  const isReloading = useRef(false);
  const smokeId = useRef(0);
  const sparkId = useRef(0);
  const punch = useRef(0);

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

  const spawnSmoke = useCallback(
    (origin: THREE.Vector3) => {
      const puffs: SmokePuff[] = [];
      for (let i = 0; i < 4; i++) {
        smokeId.current += 1;
        puffs.push({
          id: smokeId.current,
          pos: origin
            .clone()
            .add(
              new THREE.Vector3(
                (Math.random() - 0.5) * 0.12,
                (Math.random() - 0.5) * 0.08,
                (Math.random() - 0.5) * 0.12
              )
            ),
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 0.4,
            0.5 + Math.random() * 0.6,
            (Math.random() - 0.5) * 0.4
          ),
          life: 0.55 + Math.random() * 0.35,
          maxLife: 0.55 + Math.random() * 0.35,
          scale: 0.7 + Math.random() * 0.6,
        });
      }
      setSmokePuffs((prev: SmokePuff[]) => [...prev.slice(-18), ...puffs]);
    },
    [setSmokePuffs]
  );

  const doReload = useCallback(() => {
    if (isReloading.current || stats.ammo >= stats.maxAmmo) return;
    isReloading.current = true;
    sounds.reload();
    setTimeout(() => {
      setStats((s: PlayerStats) => ({ ...s, ammo: s.maxAmmo }));
      isReloading.current = false;
    }, 1400);
  }, [stats.ammo, stats.maxAmmo, setStats, sounds]);

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
    punch.current = 0.035;
    screenPunch.current = 0.04;

    setStats((s: PlayerStats) => ({
      ...s,
      ammo: Math.max(0, s.ammo - 1),
      damageDealt: s.damageDealt + DAMAGE,
    }));

    recoilOffset.current += RECOIL_AMOUNT * 1.15;
    setRecoil(recoilOffset.current);
    setMuzzle(true);
    setTimeout(() => setMuzzle(false), 55);

    // Smoke from muzzle (camera-relative approx)
    const muzzleWorld = new THREE.Vector3(0.33, -0.22, -0.9);
    muzzleWorld.applyQuaternion(camera.quaternion);
    muzzleWorld.add(camera.position);
    spawnSmoke(muzzleWorld);

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(scene.children, true);

    for (const hit of hits) {
      const id = hit.object.userData?.enemyId;
      if (id) {
        sounds.hit();
        sparkId.current += 1;
        setImpactSparks((prev: ImpactSpark[]) => [
          ...prev.slice(-10),
          { id: sparkId.current, pos: hit.point.clone(), life: 0.22 },
        ]);

        setEnemies((prev: Enemy[]) =>
          prev.map((e) => {
            if (e.id === id && e.alive) {
              const hp = e.health - DAMAGE;
              setHitFlashes((f: any) => ({ ...f, [id]: Date.now() }));
              setHitMarker(true);
              setTimeout(() => setHitMarker(false), 130);

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
    setImpactSparks,
    spawnSmoke,
    sounds,
    screenPunch,
  ]);

  useFrame((_, delta) => {
    if (isFiring) doShoot();
    if (keys.current.r) doReload();

    // Look
    const lx = lookInput.current.x;
    const ly = lookInput.current.y;
    if (Math.abs(lx) > LOOK_DEADZONE || Math.abs(ly) > LOOK_DEADZONE) {
      euler.current.setFromQuaternion(camera.quaternion);
      euler.current.y -= lx * LOOK_SENS_X * delta;
      euler.current.x -= ly * LOOK_SENS_Y * delta;
      // Screen punch from recoil
      euler.current.x -= punch.current * 0.8;
      punch.current = Math.max(0, punch.current - delta * 0.25);
      euler.current.x = THREE.MathUtils.clamp(euler.current.x, -1.25, 1.25);
      camera.quaternion.setFromEuler(euler.current);
    } else if (punch.current > 0) {
      euler.current.setFromQuaternion(camera.quaternion);
      euler.current.x -= punch.current * 0.8;
      punch.current = Math.max(0, punch.current - delta * 0.25);
      camera.quaternion.setFromEuler(euler.current);
    }

    if (recoilOffset.current > 0) {
      recoilOffset.current = Math.max(
        0,
        recoilOffset.current - delta * RECOIL_RECOVERY
      );
      setRecoil(recoilOffset.current);
    }

    // Smoke update
    setSmokePuffs((prev: SmokePuff[]) =>
      prev
        .map((p) => ({
          ...p,
          pos: p.pos.clone().add(p.vel.clone().multiplyScalar(delta)),
          life: p.life - delta,
          vel: p.vel.clone().add(new THREE.Vector3(0, 0.15 * delta, 0)),
        }))
        .filter((p) => p.life > 0)
    );

    setImpactSparks((prev: ImpactSpark[]) =>
      prev
        .map((s) => ({ ...s, life: s.life - delta }))
        .filter((s) => s.life > 0)
    );

    // Movement
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
      camera.position.x +=
        (forward.x * -mz + right.x * mx) * PLAYER_SPEED * delta;
      camera.position.z +=
        (forward.z * -mz + right.z * mx) * PLAYER_SPEED * delta;
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

    // Enemies
    const now = performance.now() / 1000;
    const invuln = now < invulnerableUntil.current;

    setEnemies((prev: Enemy[]) =>
      prev.map((e) => {
        if (!e.alive) return e;
        const dx = camera.position.x - e.position[0];
        const dz = camera.position.z - e.position[2];
        const dist = Math.hypot(dx, dz) || 1;
        let pos = e.position;

        if (dist > 5.5) {
          const speed = ENEMY_SPEED * delta;
          const angle =
            Math.atan2(dz, dx) + Math.sin(now * 1.4 + e.id.length) * 0.35;
          pos = [
            e.position[0] + Math.cos(angle) * speed,
            e.position[1],
            e.position[2] + Math.sin(angle) * speed,
          ] as [number, number, number];
        } else if (dist < 3.8) {
          const speed = ENEMY_SPEED * 0.7 * delta;
          pos = [
            e.position[0] - (dx / dist) * speed,
            e.position[1],
            e.position[2] - (dz / dist) * speed,
          ] as [number, number, number];
        }

        let last = e.lastShot;
        if (
          !invuln &&
          dist < ENEMY_RANGE &&
          now - e.lastShot > ENEMY_FIRE_RATE &&
          Math.random() < 0.28
        ) {
          last = now;
          sounds.playerHit();
          screenPunch.current = 0.07;
          setStats((s: PlayerStats) => {
            const hp = Math.max(0, s.health - ENEMY_DAMAGE);
            if (hp <= 0) {
              setTimeout(() => {
                onMatchEnd({ ...s, health: 0, survived: false });
              }, 280);
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
      <directionalLight
        position={[16, 26, 10]}
        intensity={1.45}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
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
      <SmokeSystem puffs={smokePuffs} />
      <ImpactSparks sparks={impactSparks} />
    </>
  );
}

function VirtualStick({
  label,
  accent,
  onChange,
  size = 144,
}: {
  label: string;
  accent: string;
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
        className="relative rounded-full border-2 bg-black/55 touch-none select-none"
        style={{ width: size, height: size, borderColor: accent }}
        onPointerDown={(e) => {
          e.preventDefault();
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
            width: size * 0.42,
            height: size * 0.42,
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
      const r = 15 + Math.random() * 10;
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
        lastShot: now + 3.2 + Math.random() * 2.8,
      };
    });
  });

  const moveInput = useRef({ x: 0, z: 0 });
  const lookInput = useRef({ x: 0, y: 0 });
  const screenPunch = useRef(0);
  const [isFiring, setIsFiring] = useState(false);
  const [muzzle, setMuzzle] = useState(false);
  const [recoil, setRecoil] = useState(0);
  const [hitFlashes, setHitFlashes] = useState<Record<string, number>>({});
  const [hitMarker, setHitMarker] = useState(false);
  const [smokePuffs, setSmokePuffs] = useState<SmokePuff[]>([]);
  const [impactSparks, setImpactSparks] = useState<ImpactSpark[]>([]);
  const [damageFlash, setDamageFlash] = useState(false);
  const invulnerableUntil = useRef(performance.now() / 1000 + 3.8);
  const [ready, setReady] = useState(false);
  const prevHealth = useRef(stats.health);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Damage screen flash
  useEffect(() => {
    if (stats.health < prevHealth.current) {
      setDamageFlash(true);
      const t = setTimeout(() => setDamageFlash(false), 180);
      prevHealth.current = stats.health;
      return () => clearTimeout(t);
    }
    prevHealth.current = stats.health;
  }, [stats.health]);

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
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          alpha: false,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor("#0a0a12");
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
          lookInput={lookInput}
          isFiring={isFiring}
          setMuzzle={setMuzzle}
          setRecoil={setRecoil}
          hitFlashes={hitFlashes}
          setHitFlashes={setHitFlashes}
          invulnerableUntil={invulnerableUntil}
          setHitMarker={setHitMarker}
          smokePuffs={smokePuffs}
          setSmokePuffs={setSmokePuffs}
          impactSparks={impactSparks}
          setImpactSparks={setImpactSparks}
          sounds={sounds}
          screenPunch={screenPunch}
        />
        <MuzzleFlame active={muzzle} />
      </Canvas>

      {/* Damage vignette */}
      {damageFlash && (
        <div className="absolute inset-0 pointer-events-none z-[15] bg-red-600/25" />
      )}

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
        <div
          className={`w-7 h-7 border-2 rounded-full transition-all duration-75 ${
            hitMarker ? "border-red-400 scale-125" : "border-white/90"
          }`}
        />
        <div className="absolute inset-0 m-auto w-1.5 h-1.5 bg-white rounded-full" />
      </div>

      {/* Top bar */}
      <div className="absolute top-3 left-0 right-0 flex justify-between items-center px-4 z-20">
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
      <div className="absolute bottom-48 left-4 bg-black/80 px-4 py-3 rounded-2xl text-white font-mono text-sm space-y-1 pointer-events-none z-10">
        <div
          className={
            stats.health < 30
              ? "text-red-400 font-bold"
              : "text-emerald-400 font-bold"
          }
        >
          HP {Math.round(stats.health)}/{stats.maxHealth}
        </div>
        <div>AMMO {stats.ammo}/{stats.maxAmmo}</div>
        <div className="text-amber-400">KILLS {stats.kills}</div>
      </div>

      {/* LEFT — MOVE */}
      <div className="absolute bottom-6 left-3 z-30">
        <VirtualStick
          label="Move"
          accent="rgba(255,255,255,0.35)"
          size={140}
          onChange={(x, y) => {
            moveInput.current = { x, z: y };
          }}
        />
      </div>

      {/* RIGHT — LOOK only */}
      <div className="absolute bottom-6 right-3 z-30">
        <VirtualStick
          label="Look"
          accent="rgba(255,255,255,0.35)"
          size={140}
          onChange={(x, y) => {
            lookInput.current = { x, y };
          }}
        />
      </div>

      {/* FIRE + RELOAD */}
      <div className="absolute bottom-36 right-6 z-30 flex flex-col items-center gap-3">
        <button
          type="button"
          className={`rounded-full font-black text-white text-sm shadow-lg active:scale-95 transition select-none touch-none ${
            isFiring
              ? "bg-red-500 scale-105 ring-4 ring-red-400/50"
              : "bg-red-600/90"
          }`}
          style={{ width: FIRE_BTN_SIZE, height: FIRE_BTN_SIZE }}
          onPointerDown={(e) => {
            e.preventDefault();
            sounds.unlock();
            e.currentTarget.setPointerCapture(e.pointerId);
            setIsFiring(true);
          }}
          onPointerUp={(e) => {
            e.currentTarget.releasePointerCapture(e.pointerId);
            setIsFiring(false);
          }}
          onPointerCancel={() => setIsFiring(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          FIRE
        </button>

        <button
          type="button"
          className="rounded-full bg-zinc-800/90 border border-zinc-600 text-white text-[10px] font-black px-4 py-2 active:scale-95 select-none"
          onPointerDown={() => {
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
    </div>
  );
}
