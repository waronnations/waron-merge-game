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
    for (let i = 0; i < 16; i++) {
      arr.push({
        pos: [
          (Math.random() - 0.5) * ARENA_SIZE * 1.6,
          1.15,
          (Math.random() - 0.5) * ARENA_SIZE * 1.6,
        ],
        size: [1.6 + Math.random() * 2.4, 2.4 + Math.random() * 1.2, 1.6 + Math.random() * 2.4],
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
  const color = enemy.faction === "wardog" ? "#ef4444" : "#3b82f6";
  if (!enemy.alive) return null;

  return (
    <group position={enemy.position}>
      <mesh castShadow userData={{ enemyId: enemy.id }}>
        <capsuleGeometry args={[0.4, 1.25]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Text
        position={[0, 1.85, 0]}
        fontSize={0.32}
        color="white"
        anchorX="center"
        outlineWidth={0.025}
        outlineColor="#000"
      >
        {enemy.faction.toUpperCase()}
      </Text>
      <Html position={[0, 2.25, 0]} center distanceFactor={8}>
        <div className="w-20 h-1.5 bg-zinc-900/90 rounded-full overflow-hidden border border-zinc-700">
          <div
            className="h-full bg-red-500 transition-all duration-150"
            style={{ width: `${Math.max(0, (enemy.health / enemy.maxHealth) * 100)}%` }}
          />
        </div>
      </Html>
    </group>
  );
}

function GameWorld({
  playerFaction,
  stats,
  setStats,
  enemies,
  setEnemies,
  onMatchEnd,
  moveInput,
  lookDelta,
  isLocked,
  setIsLocked,
}: any) {
  const { camera, scene, raycaster, gl } = useThree();
  const lastShot = useRef(0);
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const keys = useRef({ w: false, a: false, s: false, d: false });

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

  // Pointer lock (desktop)
  useEffect(() => {
    const onLockChange = () => {
      setIsLocked(!!document.pointerLockElement);
    };
    document.addEventListener("pointerlockchange", onLockChange);
    return () => document.removeEventListener("pointerlockchange", onLockChange);
  }, [setIsLocked]);

  // Mouse look when locked
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;
      euler.current.setFromQuaternion(camera.quaternion);
      euler.current.y -= e.movementX * LOOK_SENSITIVITY;
      euler.current.x -= e.movementY * LOOK_SENSITIVITY;
      euler.current.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.current.x));
      camera.quaternion.setFromEuler(euler.current);
    };
    document.addEventListener("mousemove", onMouseMove);
    return () => document.removeEventListener("mousemove", onMouseMove);
  }, [camera]);

  // Touch / mobile look
  useEffect(() => {
    if (lookDelta.current.x === 0 && lookDelta.current.y === 0) return;
  }, [lookDelta]);

  const shoot = useCallback(() => {
    const now = performance.now() / 1000;
    if (now - lastShot.current < FIRE_RATE) return;
    if (stats.ammo <= 0) return;

    lastShot.current = now;
    setStats((s: PlayerStats) => ({ ...s, ammo: Math.max(0, s.ammo - 1) }));

    // Center-screen raycast
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(scene.children, true);

    for (const hit of hits) {
      const id = hit.object.userData?.enemyId;
      if (id) {
        setEnemies((prev: Enemy[]) => {
          return prev.map((e) => {
            if (e.id === id && e.alive) {
              const newHp = e.health - DAMAGE;
              if (newHp <= 0) {
                setStats((s: PlayerStats) => ({ ...s, kills: s.kills + 1 }));
                return { ...e, health: 0, alive: false };
              }
              return { ...e, health: newHp };
            }
            return e;
          });
        });
        break;
      }
    }
  }, [camera, scene, raycaster, stats.ammo, setStats, setEnemies]);

  // Click / fire on desktop
  useEffect(() => {
    const onClick = () => {
      if (!document.pointerLockElement) {
        gl.domElement.requestPointerLock();
        return;
      }
      shoot();
    };
    gl.domElement.addEventListener("click", onClick);
    return () => gl.domElement.removeEventListener("click", onClick);
  }, [gl, shoot]);

  // Main loop
  useFrame((_, delta) => {
    // Apply mobile look delta
    if (lookDelta.current.x !== 0 || lookDelta.current.y !== 0) {
      euler.current.setFromQuaternion(camera.quaternion);
      euler.current.y -= lookDelta.current.x * LOOK_SENSITIVITY * 18;
      euler.current.x -= lookDelta.current.y * LOOK_SENSITIVITY * 18;
      euler.current.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.current.x));
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

    let mx = 0;
    let mz = 0;

    // Keyboard
    if (keys.current.w) mz -= 1;
    if (keys.current.s) mz += 1;
    if (keys.current.a) mx -= 1;
    if (keys.current.d) mx += 1;

    // Joystick / touch
    mx += moveInput.current.x;
    mz += moveInput.current.z;

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

    // Simple enemy AI – move toward player
    setEnemies((prev: Enemy[]) => {
      return prev.map((e) => {
        if (!e.alive) return e;
        const dx = camera.position.x - e.position[0];
        const dz = camera.position.z - e.position[2];
        const dist = Math.hypot(dx, dz) || 1;
        if (dist > 1.8) {
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
      });
    });
  });

  // Win check
  useEffect(() => {
    if (enemies.length > 0 && enemies.every((e: Enemy) => !e.alive)) {
      onMatchEnd(stats);
    }
  }, [enemies, stats, onMatchEnd]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[15, 25, 10]} intensity={1.4} castShadow />
      <Sky sunPosition={[100, 40, 80]} />
      <Physics gravity={[0, -30, 0]}>
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
          (Math.random() - 0.5) * ARENA_SIZE * 1.7,
          1.05,
          (Math.random() - 0.5) * ARENA_SIZE * 1.7,
        ],
        health: ENEMY_HEALTH,
        maxHealth: ENEMY_HEALTH,
        faction: playerFaction === "wardog" ? "warcat" : "wardog",
        alive: true,
      });
    }
    return list;
  });

  const [isLocked, setIsLocked] = useState(false);
  const moveInput = useRef({ x: 0, z: 0 });
  const lookDelta = useRef({ x: 0, y: 0 });

  // Touch joystick + look + fire
  const joystickRef = useRef<HTMLDivElement>(null);
  const [joystickActive, setJoystickActive] = useState(false);

  const onTouchStart = (e: React.TouchEvent) => {
    // handled per zone
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      {/* Canvas */}
      <div className="relative flex-1 w-full h-full">
        <Canvas
          shadows
          camera={{ position: [0, PLAYER_HEIGHT, 8], fov: 75 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          style={{ width: "100%", height: "100%" }}
        >
          <GameWorld
            playerFaction={playerFaction}
            stats={stats}
            setStats={setStats}
            enemies={enemies}
            setEnemies={setEnemies}
            onMatchEnd={onMatchEnd}
            moveInput={moveInput}
            lookDelta={lookDelta}
            isLocked={isLocked}
            setIsLocked={setIsLocked}
          />
        </Canvas>

        {/* Crosshair */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-7 h-7 border-2 border-white/90 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full" />
        </div>

        {/* HUD */}
        <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
          <div className="bg-black/60 backdrop-blur px-4 py-1.5 rounded-full text-xs font-black tracking-widest text-white/90">
            BATTLEFIELD • {playerFaction.toUpperCase()} FORCE
          </div>
        </div>

        <div className="absolute bottom-28 left-4 bg-black/80 backdrop-blur-md px-4 py-3 rounded-2xl text-white font-mono text-sm space-y-1 pointer-events-none">
          <div className="text-emerald-400 font-bold">HP {Math.round(stats.health)}/{stats.maxHealth}</div>
          <div>AMMO {stats.ammo}/{stats.maxAmmo}</div>
          <div className="text-amber-400">KILLS {stats.kills}</div>
        </div>

        {/* EXIT */}
        <button
          onClick={onExit}
          className="absolute top-4 right-4 z-50 bg-red-600/90 hover:bg-red-500 text-white font-black px-4 py-2 rounded-xl text-sm"
        >
          EXIT
        </button>

        {/* Mobile Controls */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Left Joystick zone */}
          <div
            className="absolute bottom-8 left-6 w-32 h-32 pointer-events-auto"
            onTouchStart={(e) => {
              e.preventDefault();
              setJoystickActive(true);
              const touch = e.touches[0];
              const rect = e.currentTarget.getBoundingClientRect();
              const cx = rect.left + rect.width / 2;
              const cy = rect.top + rect.height / 2;
              const dx = (touch.clientX - cx) / (rect.width / 2);
              const dy = (touch.clientY - cy) / (rect.height / 2);
              moveInput.current = {
                x: Math.max(-1, Math.min(1, dx)),
                z: Math.max(-1, Math.min(1, dy)),
              };
            }}
            onTouchMove={(e) => {
              e.preventDefault();
              const touch = e.touches[0];
              const rect = e.currentTarget.getBoundingClientRect();
              const cx = rect.left + rect.width / 2;
              const cy = rect.top + rect.height / 2;
              const dx = (touch.clientX - cx) / (rect.width / 2);
              const dy = (touch.clientY - cy) / (rect.height / 2);
              moveInput.current = {
                x: Math.max(-1, Math.min(1, dx)),
                z: Math.max(-1, Math.min(1, dy)),
              };
            }}
            onTouchEnd={() => {
              setJoystickActive(false);
              moveInput.current = { x: 0, z: 0 };
            }}
          >
            <div className={`w-full h-full rounded-full border-2 border-white/40 bg-black/40 flex items-center justify-center ${joystickActive ? "scale-110" : ""}`}>
              <div className="w-14 h-14 rounded-full bg-white/30" />
            </div>
          </div>

          {/* Right look zone + Fire */}
          <div
            className="absolute inset-0 right-0 w-1/2 pointer-events-auto"
            onTouchStart={(e) => {
              // start look
            }}
            onTouchMove={(e) => {
              e.preventDefault();
              const touch = e.touches[0];
              // simple delta look
              lookDelta.current.x = (touch.clientX - (window.innerWidth * 0.75)) * 0.08;
              lookDelta.current.y = (touch.clientY - window.innerHeight / 2) * 0.06;
            }}
            onTouchEnd={() => {
              lookDelta.current = { x: 0, y: 0 };
            }}
          />

          {/* FIRE button */}
          <button
            className="absolute bottom-10 right-8 w-24 h-24 rounded-full bg-red-600/90 border-4 border-red-400 text-white font-black text-lg shadow-2xl active:scale-95 pointer-events-auto flex items-center justify-center"
            onTouchStart={(e) => {
              e.preventDefault();
              // continuous fire while held can be added later
              const event = new MouseEvent("click", { bubbles: true });
              // trigger shoot via a ref or direct call – for simplicity we use a global-ish pattern
              // Better: expose shoot via ref, but for now we rely on the canvas click path + manual
            }}
            onClick={() => {
              // Desktop fallback + mobile
              const canvas = document.querySelector("canvas");
              if (canvas) canvas.click();
            }}
          >
            FIRE
          </button>
        </div>

        {/* Desktop hint */}
        {!isLocked && (
          <div className="absolute bottom-36 left-1/2 -translate-x-1/2 text-white/70 text-sm pointer-events-none text-center">
            Click to lock mouse • WASD move • LMB shoot
            <br />
            <span className="text-xs">Mobile: Joystick + drag right side + FIRE</span>
          </div>
        )}
      </div>
    </div>
  );
}
