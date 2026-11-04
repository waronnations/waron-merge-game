// src/routes/war.tsx
import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { MemeWarBoard } from "@/components/memewar/MemeWarBoard";

export const Route = createFileRoute("/war")({
  head: () => ({
    meta: [
      { title: "Memecoin War — WARDOG Merge on TON" },
      {
        name: "description",
        content: "Merge your real TON memecoins on the war board. Live DeDust + STON.fi routes, War Tax in any coin, seasonal memecoin rankings.",
      },
      { property: "og:title", content: "Memecoin War — WARDOG Merge on TON" },
      {
        property: "og:description",
        content: "There will only be 1 memecoin that wins this war. Merge your jettons, crown a champion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@waronnations" },
    ],
  }),
  component: WarPage,
});

function WarPage() {
  return (
    <>
      <Toaster theme="dark" position="top-center" />
      <MemeWarBoard />
    </>
  );
}
