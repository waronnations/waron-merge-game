// src/components/game/tabs/PlayTab.tsx
// The Play tab is the Memecoin War board (replaces the legacy unit merge board + War Mode).
import { MemeWarBoard } from "@/components/memewar/MemeWarBoard";

export function PlayTab() {
  return <MemeWarBoard embedded />;
}
