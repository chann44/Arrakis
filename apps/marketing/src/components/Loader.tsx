"use client";

import { useEffect, useRef } from "react";

interface LoaderProps {
  onComplete: () => void;
}

export default function Loader({ onComplete }: LoaderProps) {
  const counterRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let count = 0;
    let animFrame: number;

    function update() {
      count += Math.floor(Math.random() * 15) + 1;
      if (count > 100) count = 100;
      if (counterRef.current) {
        counterRef.current.innerText = count < 10 ? `0${count}` : String(count);
      }
      if (count < 100) {
        animFrame = requestAnimationFrame(update);
      } else {
        setTimeout(async () => {
          const { gsap } = await import("gsap");
          gsap.to(loaderRef.current, {
            yPercent: -100,
            duration: 1,
            ease: "power4.inOut",
            onComplete,
          });
        }, 200);
      }
    }

    animFrame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animFrame);
  }, [onComplete]);

  return (
    <div
      ref={loaderRef}
      id="loader"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100vh",
        background: "var(--bg)",
        zIndex: 9999,
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "flex-end",
        padding: "var(--container-padding)",
      }}
    >
      <div
        ref={counterRef}
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(4rem, 10vw, 8rem)",
          color: "var(--text-main)",
          lineHeight: 1,
        }}
      >
        00
      </div>
    </div>
  );
}
