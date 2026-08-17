import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls, Sky, Text, Html } from "@react-three/drei";
import { Physics, RigidBody } from "@react-three/rapier";
import { useRef, useState, useEffect, useMemo, useCallback } from "react";
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
} from "./constants";
import type { Faction, PlayerStats, Enemy } from "./types";

interface Props {
  playerFaction: Faction;
  onMatchEnd: (stats: PlayerStats) => void;
  rankBonus?: number;
}

function Ground() {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[ARENA_SIZE * 2.2, ARENA_SIZE * 2.2]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
    </RigidBody>
  );
}

function Walls() {
  const h = 5.5;
  const s = ARENA_SIZE;
  const mat = <meshStandardMaterial color="#1f1f1f" roughness={0.85} />;
  return (
    <group>
      <RigidBody type="fixed"><mesh position={[0, h / 2, -s]}><boxGeometry args={[s * 2.2, h, 1.2]} />{mat}</mesh></RigidBody>
      <RigidBody type="fixed"><mesh position={[0, h / 2, s]}><boxGeometry args={[s * 2.2, h, 1.2]} />{mat}</mesh></RigidBody>
      <RigidBody type="fixed"><mesh position={[-s, h / 2, 0]}><boxGeometry args={[1.2, h, s * 2.2]} />{mat}</mesh></RigidBody>
      <RigidBody type="fixed"><mesh position={[s, h / 2, 0]}><boxGeometry args={[1.2, h, s * 2.2]} />{mat}</mesh></RigidBody>
    </group>
  );
}

function Cover() {
  const boxes = useMemo(() => {
    const arr: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    for (let i = 0; i < 14; i++) {
      arr.push({
        pos: [
          (Math.random() - 0.5) * ARENA_SIZE * 1.5,
          1.1 + Math.random() * 0.4,
          (Math.random() - 0.5) * ARENA_SIZE * 1.5,
        ],
        size: [1.8 + Math.random() * 2.2, 2.2 + Math.random(), 1.8 + Math.random() * 2.2],
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
            <meshStandardMaterial color="#2a2a2a" roughness={0.7} />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}

function GunModel() {
  return (
    <group position={[0.28, -0.22, -0.45]} rotation={[0.08, 0.12, 0]}>
      <mesh>
        <boxGeometry args={[0.07, 0.11, 0.38]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.015, -0.22]}>
        <boxGeometry args={[0.035, 0.035, 0.18]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      <mesh position={[0, -0.06, 0.05]}>
        <boxGeometry args={[0.04, 0.08, 0.12]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </group>
  );
}

function PlayerController({
  stats,
  setStats,
  onShoot,
  enemies,
  setEnemies,
}: {
  stats: PlayerStats;
  setStats: React.Dispatch<React.SetStateAction<PlayerStats>>;
  onShoot: () => void;
  enemies: Enemy[];
  setEnemies: React.Dispatch<React.SetStateAction<Enemy[]>>;
}) {
  const { camera, scene, raycaster } = useThree();
  const controls = useRef<any>(null);
  const keys = useRef({ w: false, a: false, s: false, d: false });
  const lastShot = useRef(0);
  const velocity = useRef(new THREE.Vector3());

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

  useFrame((_, delta) => {
    if (!controls.current?.isLocked) return;

    const dir = new THREE.Vector3();
    if (keys.current.w) dir.z -= 1;
    if (keys.current.s) dir.z += 1;
    if (keys.current.a) dir.x -= 1;
    if (keys.current.d) dir.x += 1;
    dir.normalize();

    const front = new THREE.Vector3();
    camera.getWorldDirection(front);
    front.y = 0;
    front.normalize();
    const right = new THREE.Vector3().crossVectors(front, new THREE.Vector3(0, 1, 0)).normalize();

    velocity.current.x = (front.x * -dir.z + right.x * dir.x) * PLAYER_SPEED;
    velocity.current.z = (front.z * -dir.z + right.z * dir.x) * PLAYER_SPEED;

    camera.position.x += velocity.current.x * delta;
    camera.position.z += velocity.current.z * delta;
    camera.position.y = PLAYER_HEIGHT;

    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -ARENA_SIZE + 1.5, ARENA_SIZE - 1.5);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -ARENA_SIZE + 1.5, ARENA_SIZE - 1.5);
  });

  const doRaycastShoot = useCallback(() => {
    const now = performance.now() / 1000;
    if (now - lastShot.current < FIRE_RATE) return;
    if (stats.ammo <= 0) return;

    lastShot.current = now;
    setStats((s) => ({ ...s, ammo: s.ammo - 1 }));
    onShoot();

    // Real hitscan
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(scene.children, true);

    for (const hit of hits) {
      const obj = hit.object;
      // We tag enemies with userData
      if (obj.userData?.enemyId) {
        const id = obj.userData.enemyId as string;
        setEnemies((prev) => {
          const next = prev.map((e) => {
            if (e.id === id && e.alive) {
              const newHp = e.health - DAMAGE;
              if (newHp <= 0) {
                setStats((s) => ({ ...s, kills: s.kills + 1 }));
                return { ...e, health: 0, alive: false };
              }
              return { ...e, health: newHp };
            }
            return e;
          });
          return next;
        });
        break;
      }
    }
  }, [camera, scene, raycaster, stats.ammo, setStats, onShoot, setEnemies]);

  useEffect(() => {
    const onClick = () => {
      if (controls.current?.isLocked) doRaycastShoot();
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [doRaycastShoot]);

  return (
    <>
      <PointerLockControls ref={controls} />
      <GunModel />
    </>
  );
}

function EnemyBot({ enemy }: { enemy: Enemy }) {
  const color = enemy.faction === "wardog" ? "#ef4444" : "#3b82f6";
  if (!enemy.alive) return null;

  return (
    <group position={enemy.position}>
      <mesh castShadow userData={{ enemyId: enemy.id }}>
        <capsuleGeometry args={[0.38, 1.15]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Text position={[0, 1.7, 0]} fontSize={0.28} color="white" anchorX="center" outlineWidth={0.02} outlineColor="#000">
        {enemy.faction.toUpperCase()}
      </Text>
      {/* Health bar */}
      <Html position={[0, 2.1, 0]} center>
        <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-500 transition-all"
            style={{ width: `${(enemy.health / enemy.maxHealth) * 100}%` }}
          />
        </div>
      </Html>
    </group>
  );
}

export function ShooterCanvas({ playerFaction, onMatchEnd, rankBonus = 0 }: Props) {
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
          (Math.random() - 0.5) * ARENA_SIZE * 1.6,
          1.0,
          (Math.random() - 0.5) * ARENA_SIZE * 1.6,
        ],
        health: ENEMY_HEALTH,
        maxHealth: ENEMY_HEALTH,
        faction: playerFaction === "wardog" ? "warcat" : "wardog",
        alive: true,
      });
    }
    return list;
  });

  const handleShoot = () => {
    // muzzle feedback can be added later
  };

  useEffect(() => {
    if (enemies.length > 0 && enemies.every((e) => !e.alive)) {
      onMatchEnd(stats);
    }
  }, [enemies, stats, onMatchEnd]);

  return (
    <div className="relative w-full h-[68vh] rounded-2xl overflow-hidden border border-zinc-700 bg-black">
      <Canvas shadows camera={{ position: [0, PLAYER_HEIGHT, 6], fov: 75 }} gl={{ antialias: true }}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[12, 22, 8]} intensity={1.3} castShadow shadow-mapSize={[1024, 1024]} />
        <Sky sunPosition={[80, 30, 60]} />
        <Physics gravity={[0, -25, 0]}>
          <Ground />
          <Walls />
          <Cover />
          <PlayerController
            stats={stats}
            setStats={setStats}
            onShoot={handleShoot}
            enemies={enemies}
            setEnemies={setEnemies}
          />
          {enemies.map((e) => (
            <EnemyBot key={e.id} enemy={e} />
          ))}
        </Physics>
      </Canvas>

      {/* HUD */}
      <div className="absolute inset-0 pointer-events-none select-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 border-2 border-white/90 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-white rounded-full" />

        <div className="absolute bottom-5 left-4 bg-black/75 backdrop-blur px-4 py-2.5 rounded-2xl text-white font-mono text-sm space-y-0.5">
          <div className="text-emerald-400">HP {Math.round(stats.health)}/{stats.maxHealth}</div>
          <div>AMMO {stats.ammo}/{stats.maxAmmo}</div>
          <div className="text-amber-400">KILLS {stats.kills}</div>
        </div>

        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/90 text-xs font-black tracking-[0.2em]">
          BATTLEFIELD • {playerFaction.toUpperCase()} FORCE
        </div>

        <div className="absolute bottom-5 right-4 text-white/50 text-[11px] text-right">
          Click to lock mouse<br />
          WASD move • LMB shoot
        </div>
      </div>
    </div>
  );
}
