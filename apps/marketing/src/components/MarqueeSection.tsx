"use client";

import { useEffect, useRef } from "react";

const items = [
  { label: "npm", solid: true },
  { label: "pip", solid: false },
  { label: "Go modules", solid: true },
  { label: "Cargo", solid: false },
  { label: "Maven", solid: true },
  { label: "Composer", solid: false },
];

export default function MarqueeSection() {
  const marqueeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { gsap } = await import("gsap");
      gsap.to(marqueeRef.current, {
        xPercent: -50,
        ease: "none",
        duration: 20,
        repeat: -1,
      });
    })();
  }, []);

  const doubled = [...items, ...items];

  return (
    <div className="marquee-container reveal">
      <div ref={marqueeRef} className="marquee">
        {doubled.map((item, i) => (
          <span key={i} className={`marquee-item ${item.solid ? "solid" : ""}`}>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
