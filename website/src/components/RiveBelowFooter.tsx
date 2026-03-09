"use client";

import { useRive } from "@rive-app/react-canvas";

export default function RiveBelowFooter() {
  const { rive, RiveComponent } = useRive({
    src: "/untitled.riv",
    autoplay: true,
    onStop: () => {
      rive?.play();
    },
  });

  return (
    <section className="w-full bg-surface" aria-hidden>
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-8 md:py-12">
        <div
          className="rounded-card bg-surface overflow-hidden flex items-center justify-center"
          style={{ width: "100%", height: 280 }}
        >
          <RiveComponent
            className="w-full h-full"
            style={{ width: "100%", height: 280 }}
          />
        </div>
      </div>
    </section>
  );
}
