// src/components/battlefield/ShooterCanvas.tsx
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky, Text } from "@react-three/drei";
import { Physics, RigidBody } from "@react-three/rapier";
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import * as THREE from "three";
import {
  ARENA_SIZE,
  PLAYER_SPEED,
  PLAYER_HEIGHT,
  MAX_HEALTH,
  ENEMY_COUNT,
  ENEMY_HEALTH,
  ENEMY_SPEED,
  ENEMY_DAMAGE,
  ENEMY_FIRE_RATE,
  ENEMY_RANGE,
  RECOIL_AMOUNT,
  RECOIL_RECOVERY,
  HEADSHOT_MULT,
  MATCH_SECONDS,
  MAX_SPREAD,
  MOVE_SPREAD,
  LOADOUT,
} from "./constants";
import type { BattleMode, Faction, PlayerStats, Enemy } from "./types";
import { useBattleSounds } from "./useBattleSounds";

interface Props {
  playerFaction: Faction;
  onMatchEnd: (stats: PlayerStats) => void;
  rankBonus?: number;
  mode?: BattleMode;
  onExit: () => void;
}

const MOVE_DEADZONE = 0.14;
const LOOK_SENS = 0.0028;
const CENTER_FIRE_SIZE = 64;

type Tracer = {
  id: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  born: number;
};

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
          e.preventDefault();
          e.stopPropagation();
          handle(e.clientX, e.clientY, e.currentTarget);
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          e.stopPropagation();
          active.current = false;
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
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

function Ground() {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ARENA_SIZE * 2.6, ARENA_SIZE * 2.6]} />
        <meshStandardMaterial color="#141210" roughness={0.94} />
      </mesh>
    </RigidBody>
  );
}

function Walls() {
  const h = 7;
  const s = ARENA_SIZE;
  return (
    <group>
      {[
        [0, h / 2, -s, s * 2.6, h, 1.6],
        [0, h / 2, s, s * 2.6, h, 1.6],
        [-s, h / 2, 0, 1.6, h, s * 2.6],
        [s, h / 2, 0, 1.6, h, s * 2.6],
      ].map((a, i) => (
        <RigidBody key={i} type="fixed">
          <mesh position={[a[0], a[1], a[2]]}>
            <boxGeometry args={[a[3], a[4], a[5]]} />
            <meshStandardMaterial color="#1a1714" roughness={0.88} />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}

function MapCover({ playerFaction }: { playerFaction: Faction }) {
  const pieces = useMemo(
    () => [
      { pos: [0, 1.3, 0] as const, size: [4.5, 2.6, 4.5] as const },
      { pos: [-8, 1.1, -6] as const, size: [3.2, 2.2, 3.2] as const },
      { pos: [9, 1.1, 7] as const, size: [3.5, 2.3, 3] as const },
      { pos: [-12, 1.2, 10] as const, size: [2.8, 2.4, 5] as const },
      { pos: [11, 1.0, -11] as const, size: [5, 2.0, 2.8] as const },
      { pos: [-6, 2.8, 14] as const, size: [6, 0.6, 4] as const },
      { pos: [7, 2.6, -13] as const, size: [5, 0.6, 4.5] as const },
      { pos: [16, 1.4, 2] as const, size: [2.2, 2.8, 2.2] as const },
      { pos: [-16, 1.4, -2] as const, size: [2.2, 2.8, 2.2] as const },
    ],
    [],
  );
  const flag = playerFaction === "wardog" ? "#7f1d1d" : "#1e3a8a";
  return (
    <group>
      {pieces.map((p, i) => (
        <RigidBody key={i} type="fixed" colliders="cuboid">
          <mesh position={[...p.pos]} castShadow>
            <boxGeometry args={[...p.size]} />
            <meshStandardMaterial color="#24201c" roughness={0.78} />
          </mesh>
        </RigidBody>
      ))}
      <mesh position={[0, 3.4, 0]}>
        <boxGeometry args={[1.2, 1.6, 0.12]} />
        <meshStandardMaterial color={flag} />
      </mesh>
    </group>
  );
}

function GunModel({ recoil, faction }: { recoil: number; faction: Faction }) {
  const body = faction === "wardog" ? "#1a0505" : "#050816";
  return (
    <group
      position={[0.33, -0.29 - recoil * 0.12, -0.55]}
      rotation={[0.1 + recoil * 1.1, 0.14, recoil * 0.22]}
    >
      <mesh>
        <boxGeometry args={[0.085, 0.14, 0.48]} />
        <meshStandardMaterial color={body} metalness={0.92} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.02, -0.36]}>
        <boxGeometry args={[0.038, 0.038, faction === "warcat" ? 0.42 : 0.26]} />
        <meshStandardMaterial color="#050505" metalness={0.95} />
      </mesh>
    </group>
  );
}

function MuzzleFlame({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <group position={[0.33, -0.22, -0.95]}>
      <pointLight intensity={16} distance={7} color="#ffaa33" decay={2} />
      <mesh>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshBasicMaterial color="#fff5cc" transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

function TracerLines({ tracers }: { tracers: Tracer[] }) {
  const now = performance.now();
  return (
    <group>
      {tracers.map((t) => {
        const age = (now - t.born) / 180;
        if (age >= 1) return null;
        const dir = t.to.clone().sub(t.from);
        const len = Math.max(0.01, dir.length());
        const mid = t.from.clone().add(t.to).multiplyScalar(0.5);
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          dir.clone().normalize(),
        );
        return (
          <mesh key={t.id} position={mid} quaternion={quat}>
            <cylinderGeometry args={[0.012, 0.012, len, 4]} />
            <meshBasicMaterial color="#ffd27a" transparent opacity={1 - age} />
          </mesh>
        );
      })}
    </group>
  );
}

function EnemyBot({ enemy, hitFlash }: { enemy: Enemy; hitFlash: boolean }) {
  if (!enemy.alive) return null;
  const base = enemy.faction === "wardog" ? "#ef4444" : "#3b82f6";
  const color = hitFlash ? "#ffffff" : base;
  const hp = Math.max(0, enemy.health / enemy.maxHealth);
  return (
    <group position={enemy.position}>
      <mesh castShadow>
        <capsuleGeometry args={[0.42, 1.35]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.15, 0]} castShadow>
        <sphereGeometry args={[0.28, 12, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Text
        position={[0, 1.95, 0]}
        fontSize={0.24}
        color="white"
        anchorX="center"
        outlineWidth={0.02}
        outlineColor="#000"
      >
        {enemy.faction.toUpperCase()}
      </Text>
      <mesh position={[0, 2.28, 0]}>
        <planeGeometry args={[Math.max(0.05, 1.1 * hp), 0.07]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
    </group>
  );
}

function spawnWave(n: number, opposite: Faction, wave: number): Enemy[] {
  const out: Enemy[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + wave * 0.4;
    const r = 16 + (i % 3) * 4;
    const fac: Faction =
      i % 3 === 0 ? opposite : opposite === "wardog" ? "warcat" : "wardog";
    out.push({
      id: `w${wave}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      position: [Math.cos(a) * r, 0.9, Math.sin(a) * r],
      health: ENEMY_HEALTH + wave * 12,
      maxHealth: ENEMY_HEALTH + wave * 12,
      faction: fac,
      alive: true,
      lastShot: performance.now() / 1000 + i * 0.28,
    });
  }
  return out;
}

function GameLogic({
  playerFaction,
  rankBonus = 0,
  mode = "hunt",
  onMatchEnd,
  moveInput,
  lookDelta,
  firing,
}: {
  playerFaction: Faction;
  rankBonus?: number;
  mode: BattleMode;
  onMatchEnd: (stats: PlayerStats) => void;
  moveInput: React.MutableRefObject<{ x: number; z: number }>;
  lookDelta: React.MutableRefObject<{ x: number; y: number }>;
  firing: React.MutableRefObject<boolean>;
}) {
  const { camera } = useThree();
  const sounds = useBattleSounds();
  const loadout = LOADOUT[playerFaction];
  const opposite: Faction = playerFaction === "wardog" ? "warcat" : "wardog";

  const maxHp = MAX_HEALTH + rankBonus * 6;
  const [stats, setStats] = useState<PlayerStats>({
    health: maxHp,
    maxHealth: maxHp,
    ammo: loadout.mag,
    maxAmmo: loadout.mag,
    kills: 0,
    deaths: 0,
    damageDealt: 0,
    survived: false,
    durationSec: 0,
    shotsFired: 0,
    hits: 0,
    headshots: 0,
    accuracy: 0,
    mode,
  });
  const [enemies, setEnemies] = useState<Enemy[]>(() =>
    spawnWave(mode === "waves" ? 4 : ENEMY_COUNT, opposite, 0),
  );
  const [muzzle, setMuzzle] = useState(false);
  const [recoil, setRecoil] = useState(0);
  const [hitFlashes, setHitFlashes] = useState<Record<string, number>>({});
  const [tracers, setTracers] = useState<Tracer[]>([]);
  const [wave, setWave] = useState(0);
  const [holdScore, setHoldScore] = useState(0);
  const [hudLeft, setHudLeft] = useState(MATCH_SECONDS);

  const keys = useRef<Record<string, boolean>>({});
  const lastShot = useRef(0);
  const reloading = useRef(false);
  const ended = useRef(false);
  const invuln = useRef(performance.now() / 1000 + 4.2);
  const startedAt = useRef(performance.now());
  const statsRef = useRef(stats);
  const enemiesRef = useRef(enemies);
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const spread = useRef(0);
  const tracerId = useRef(0);
  const holdAcc = useRef(0);
  statsRef.current = stats;
  enemiesRef.current = enemies;

  const finish = useCallback(
    (survived: boolean, deaths: number) => {
      if (ended.current) return;
      ended.current = true;
      const s = statsRef.current;
      const durationSec = Math.max(
        8,
        Math.round((performance.now() - startedAt.current) / 1000),
      );
      const acc =
        s.shotsFired > 0 ? Math.round((s.hits / s.shotsFired) * 100) : 0;
      onMatchEnd({
        ...s,
        survived: survived || (mode === "hold" && holdAcc.current >= 18),
        deaths,
        durationSec,
        accuracy: acc,
        mode,
      });
    },
    [mode, onMatchEnd],
  );

  const doReload = useCallback(() => {
    if (reloading.current || ended.current) return;
    if (statsRef.current.ammo >= loadout.mag) return;
    reloading.current = true;
    sounds.play("reload");
    window.setTimeout(() => {
      setStats((p) => ({ ...p, ammo: loadout.mag }));
      reloading.current = false;
    }, 1400);
  }, [loadout.mag, sounds]);

  const doShoot = useCallback(() => {
    const now = performance.now() / 1000;
    if (ended.current || reloading.current) return;
    if (now - lastShot.current < loadout.fireRate) return;
    if (statsRef.current.ammo <= 0) {
      sounds.play("empty");
      lastShot.current = now;
      doReload();
      return;
    }
    lastShot.current = now;
    sounds.play("shot");
    setMuzzle(true);
    window.setTimeout(() => setMuzzle(false), 45);
    setRecoil((r) => Math.min(0.35, r + RECOIL_AMOUNT));
    spread.current = Math.min(MAX_SPREAD, spread.current + 0.018);

    const origin = camera.position.clone();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const moving =
      Math.abs(moveInput.current.x) + Math.abs(moveInput.current.z) > 0.2;
    dir.x +=
      (Math.random() - 0.5) *
      (loadout.spread + spread.current + (moving ? MOVE_SPREAD : 0));
    dir.y += (Math.random() - 0.5) * (loadout.spread * 0.7 + spread.current * 0.5);
    dir.normalize();

    const hitPoint = origin.clone().add(dir.clone().multiplyScalar(70));
    let best: { id: string; part: string; dist: number; point: THREE.Vector3 } | null =
      null;
    for (const e of enemiesRef.current) {
      if (!e.alive) continue;
      const body = new THREE.Vector3(e.position[0], e.position[1] + 0.2, e.position[2]);
      const head = new THREE.Vector3(e.position[0], e.position[1] + 1.15, e.position[2]);
      const toBody = body.clone().sub(origin);
      const t = toBody.dot(dir);
      if (t < 0.4 || t > 70) continue;
      const closest = origin.clone().add(dir.clone().multiplyScalar(t));
      const bodyDist = closest.distanceTo(body);
      const headDist = closest.distanceTo(head);
      if (headDist < 0.38 && (!best || t < best.dist)) {
        best = { id: e.id, part: "head", dist: t, point: closest };
      } else if (bodyDist < 0.62 && (!best || t < best.dist)) {
        best = { id: e.id, part: "body", dist: t, point: closest };
      }
    }

    const to = best?.point ?? hitPoint;
    const id = ++tracerId.current;
    setTracers((prev) => [
      ...prev.slice(-10),
      { id, from: origin.clone(), to: to.clone(), born: performance.now() },
    ]);

    setStats((p) => ({ ...p, ammo: p.ammo - 1, shotsFired: p.shotsFired + 1 }));
    if (!best) return;

    const target = enemiesRef.current.find((e) => e.id === best!.id);
    if (!target || !target.alive) return;

    const dmg = Math.round(loadout.damage * (best.part === "head" ? HEADSHOT_MULT : 1));
    const counts = mode === "hunt" ? target.faction === opposite : true;
    sounds.play(best.part === "head" ? "headshot" : "hit");
    setHitFlashes((h) => ({ ...h, [target.id]: performance.now() }));
    setEnemies((list) =>
      list.map((e) => {
        if (e.id !== target.id) return e;
        const hp = e.health - dmg;
        return { ...e, health: hp, alive: hp > 0 };
      }),
    );
    setStats((p) => {
      const killed = target.health - dmg <= 0;
      return {
        ...p,
        hits: p.hits + 1,
        headshots: p.headshots + (best!.part === "head" ? 1 : 0),
        damageDealt: p.damageDealt + dmg,
        kills: p.kills + (killed && counts ? 1 : 0),
      };
    });
  }, [camera, doReload, loadout, mode, moveInput, opposite, sounds]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === "KeyR") doReload();
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [doReload]);

  useFrame((_, delta) => {
    if (ended.current) return;
    const now = performance.now() / 1000;
    const elapsed = (performance.now() - startedAt.current) / 1000;
    setHudLeft(Math.max(0, MATCH_SECONDS - Math.floor(elapsed)));

    if (elapsed >= MATCH_SECONDS) {
      finish(mode === "hold" ? holdAcc.current >= 18 : false, statsRef.current.deaths);
      return;
    }

    euler.current.setFromQuaternion(camera.quaternion);
    euler.current.y -= lookDelta.current.x;
    euler.current.x -= lookDelta.current.y;
    euler.current.x = Math.max(-1.2, Math.min(1.2, euler.current.x));
    camera.quaternion.setFromEuler(euler.current);
    lookDelta.current.x = 0;
    lookDelta.current.y = 0;

    let mx = moveInput.current.x;
    let mz = moveInput.current.z;
    if (keys.current["KeyW"] || keys.current["ArrowUp"]) mz -= 1;
    if (keys.current["KeyS"] || keys.current["ArrowDown"]) mz += 1;
    if (keys.current["KeyA"] || keys.current["ArrowLeft"]) mx -= 1;
    if (keys.current["KeyD"] || keys.current["ArrowRight"]) mx += 1;
    const mag = Math.hypot(mx, mz);
    if (mag > 1) {
      mx /= mag;
      mz /= mag;
    }
    if (mag > MOVE_DEADZONE) {
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3()
        .crossVectors(forward, new THREE.Vector3(0, 1, 0))
        .normalize();
      camera.position.addScaledVector(forward, -mz * PLAYER_SPEED * delta);
      camera.position.addScaledVector(right, mx * PLAYER_SPEED * delta);
    }
    camera.position.y = PLAYER_HEIGHT;
    const lim = ARENA_SIZE - 2.5;
    camera.position.x = Math.max(-lim, Math.min(lim, camera.position.x));
    camera.position.z = Math.max(-lim, Math.min(lim, camera.position.z));

    setRecoil((r) => Math.max(0, r - RECOIL_RECOVERY * delta * Math.max(r, 0.05)));
    spread.current = Math.max(0, spread.current - delta * 0.12);

    if (firing.current) doShoot();

    if (mode === "hold") {
      const onPoint = Math.hypot(camera.position.x, camera.position.z) < 6.2;
      if (onPoint) holdAcc.current += delta;
      setHoldScore(holdAcc.current);
    }

    setEnemies((list) =>
      list.map((e, idx) => {
        if (!e.alive) return e;
        const pos = new THREE.Vector3(...e.position);
        const toPlayer = camera.position.clone().sub(pos);
        toPlayer.y = 0;
        const dist = toPlayer.length();
        const dir = dist > 0.001 ? toPlayer.normalize() : new THREE.Vector3();
        let step = ENEMY_SPEED * delta;
        if (dist < 4) step *= 0.55;
        const jitter = Math.sin(now * 1.7 + idx) * 0.4 * delta;
        pos.x += dir.x * step + jitter;
        pos.z += dir.z * step;
        pos.y = 0.9;

        if (
          dist < ENEMY_RANGE * 0.9 &&
          now - e.lastShot > ENEMY_FIRE_RATE * 1.5 + idx * 0.28 &&
          Math.random() < 0.14 &&
          now > invuln.current
        ) {
          e.lastShot = now;
          setStats((p) => {
            const hp = p.health - Math.max(4, Math.floor(ENEMY_DAMAGE * 0.55));
            if (hp <= 0) {
              queueMicrotask(() => finish(false, p.deaths + 1));
              return { ...p, health: 0, deaths: p.deaths + 1 };
            }
            sounds.play("playerHit");
            return { ...p, health: hp };
          });
        }
        return { ...e, position: [pos.x, pos.y, pos.z], lastShot: e.lastShot };
      }),
    );

    const alive = enemiesRef.current.filter((e) => e.alive).length;
    if (mode === "waves" && alive === 0 && !ended.current) {
      if (wave >= 2) finish(true, statsRef.current.deaths);
      else {
        const w = wave + 1;
        setWave(w);
        setEnemies(spawnWave(4 + w * 2, opposite, w));
      }
    }
    if (mode === "hunt" && alive === 0 && statsRef.current.kills > 0) {
      finish(true, statsRef.current.deaths);
    }

    setTracers((t) => t.filter((x) => performance.now() - x.born < 200));
  });

  return (
    <>
      <GunModel recoil={recoil} faction={playerFaction} />
      <MuzzleFlame active={muzzle} />
      <TracerLines tracers={tracers} />
      {enemies.map((e) => (
        <EnemyBot
          key={e.id}
          enemy={e}
          hitFlash={performance.now() - (hitFlashes[e.id] ?? 0) < 90}
        />
      ))}
      <group visible={false} />
      {/* HUD values live on the parent overlay via stats portaled below */}
      <HtmlStats
        stats={stats}
        wave={wave}
        holdScore={holdScore}
        mode={mode}
        left={hudLeft}
      />
    </>
  );
}

function HtmlStats({
  stats,
  wave,
  holdScore,
  mode,
  left,
}: {
  stats: PlayerStats;
  wave: number;
  holdScore: number;
  mode: BattleMode;
  left: number;
}) {
  useEffect(() => {
    const el = document.getElementById("bf-hud-stats");
    const sub = document.getElementById("bf-hud-sub");
    if (el) {
      el.textContent = `HP ${Math.ceil(stats.health)}  •  ${stats.ammo}/${stats.maxAmmo}  •  ${stats.kills} K  •  ${left}s`;
    }
    if (sub) {
      sub.textContent =
        mode === "waves"
          ? `WAVE ${wave + 1}/3`
          : mode === "hold"
            ? `HOLD ${holdScore.toFixed(0)}s / 18s`
            : `${stats.hits} hits • ${stats.headshots} HS`;
    }
  }, [stats, wave, holdScore, mode, left]);
  return null;
}

export function ShooterCanvas({
  playerFaction,
  onMatchEnd,
  rankBonus,
  mode = "hunt",
  onExit,
}: Props) {
  const moveInput = useRef({ x: 0, z: 0 });
  const lookDelta = useRef({ x: 0, y: 0 });
  const firing = useRef(false);
  const lookDragging = useRef(false);
  const lastLook = useRef({ x: 0, y: 0 });
  const sounds = useBattleSounds();

  const onLookDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-fire-btn]") || target.closest("[data-move-stick]")) {
      return;
    }
    e.preventDefault();
    lookDragging.current = true;
    lastLook.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onLookMove = (e: React.PointerEvent) => {
    if (!lookDragging.current) return;
    lookDelta.current.x += (e.clientX - lastLook.current.x) * LOOK_SENS;
    lookDelta.current.y += (e.clientY - lastLook.current.y) * LOOK_SENS;
    lastLook.current = { x: e.clientX, y: e.clientY };
  };

  const onLookUp = (e: React.PointerEvent) => {
    lookDragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <Canvas
        shadows
        camera={{
          fov: 72,
          near: 0.08,
          far: 180,
          position: [0, PLAYER_HEIGHT, 8],
        }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ camera }) => {
          camera.lookAt(0, PLAYER_HEIGHT, 0);
        }}
      >
        <color attach="background" args={["#0b0a09"]} />
        <fog attach="fog" args={["#0b0a09", 18, 70]} />
        <Sky sunPosition={[40, 18, 12]} turbidity={8} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[18, 28, 10]}
          intensity={1.15}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <Physics gravity={[0, -9.81, 0]}>
          <Ground />
          <Walls />
          <MapCover playerFaction={playerFaction} />
        </Physics>
        <GameLogic
          playerFaction={playerFaction}
          rankBonus={rankBonus}
          mode={mode}
          onMatchEnd={onMatchEnd}
          moveInput={moveInput}
          lookDelta={lookDelta}
          firing={firing}
        />
      </Canvas>

      <div
        className="absolute inset-0 z-[5] touch-none"
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
      />

      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2">
          <div className="absolute inset-0 m-auto h-1 w-1 rounded-full bg-white" />
          <div className="absolute left-1/2 top-0 h-2 w-[2px] -translate-x-1/2 bg-white/80" />
          <div className="absolute bottom-0 left-1/2 h-2 w-[2px] -translate-x-1/2 bg-white/80" />
          <div className="absolute left-0 top-1/2 h-[2px] w-2 -translate-y-1/2 bg-white/80" />
          <div className="absolute right-0 top-1/2 h-[2px] w-2 -translate-y-1/2 bg-white/80" />
        </div>
        <div className="absolute left-3 top-3 rounded-lg bg-black/70 px-3 py-1.5 font-mono text-xs text-white">
          <div id="bf-hud-stats">—</div>
          <div id="bf-hud-sub" className="text-[0.65rem] text-amber-300" />
        </div>
      </div>

      <button
        type="button"
        onClick={onExit}
        className="absolute right-3 top-3 z-30 rounded-xl bg-red-600 px-4 py-1.5 text-sm font-black text-white"
      >
        EXIT
      </button>

      <button
        type="button"
        data-fire-btn
        className="absolute left-1/2 top-1/2 z-20 rounded-full bg-red-600/85 text-[11px] font-black text-white touch-none select-none"
        style={{
          width: CENTER_FIRE_SIZE,
          height: CENTER_FIRE_SIZE,
          transform: "translate(-50%, 40px)",
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void sounds.unlock();
          firing.current = true;
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          e.stopPropagation();
          firing.current = false;
        }}
        onPointerCancel={() => {
          firing.current = false;
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        FIRE
      </button>

      <button
        type="button"
        className="absolute bottom-36 right-6 z-30 rounded-full bg-zinc-800/90 px-4 py-2 text-[0.6rem] font-black uppercase tracking-widest text-zinc-200"
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyR" }));
        }}
      >
        Reload
      </button>

      <div className="absolute bottom-6 left-3 z-30" data-move-stick>
        <VirtualStick
          label="Move"
          size={132}
          onChange={(x, y) => {
            moveInput.current = { x, z: y };
          }}
        />
      </div>
    </div>
  );
}
