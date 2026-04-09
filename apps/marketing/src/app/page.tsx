"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Nav from "@/components/Nav";
import HeroSection from "@/components/HeroSection";
import ProblemSection from "@/components/ProblemSection";
import MethodologySection from "@/components/MethodologySection";
import StatsSection from "@/components/StatsSection";
import ParadigmSection from "@/components/ParadigmSection";
import MarqueeSection from "@/components/MarqueeSection";
import TiersSection from "@/components/TiersSection";
import CTASection from "@/components/CTASection";

const Loader = dynamic(() => import("@/components/Loader"), { ssr: false });
const WebGLBackground = dynamic(() => import("@/components/WebGLBackground"), {
  ssr: false,
});
const ScrollAnimations = dynamic(
  () => import("@/components/ScrollAnimations"),
  { ssr: false }
);

export default function Home() {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {!loaded && <Loader onComplete={() => setLoaded(true)} />}

      {/* Fixed background layers */}
      <div className="system-grid" />
      <WebGLBackground />

      {/* Site content */}
      <Nav />

      <main style={{ position: "relative", zIndex: 20 }}>
        <HeroSection />
        <ProblemSection />
        <MethodologySection />
        <StatsSection />
        <ParadigmSection />
        <MarqueeSection />
        <TiersSection />
        <CTASection />
      </main>

      {/* Kick off scroll animations after load */}
      {loaded && <ScrollAnimations />}
    </>
  );
}
