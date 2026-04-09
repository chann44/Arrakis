"use client";

import { useEffect } from "react";

export default function ScrollAnimations() {
  useEffect(() => {
    (async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      const reveals = document.querySelectorAll<HTMLElement>(".reveal");
      reveals.forEach((el) => {
        gsap.to(el, {
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "power3.out",
        });
      });

      const monumental = document.querySelector(".monumental-vertical");
      if (monumental) {
        gsap.to(monumental, {
          scrollTrigger: {
            trigger: ".hero",
            start: "top top",
            end: "bottom top",
            scrub: 1,
          },
          y: 200,
          opacity: 0,
        });
      }
    })();
  }, []);

  return null;
}
