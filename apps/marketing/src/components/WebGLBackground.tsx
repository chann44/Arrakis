"use client";

import { useEffect, useRef } from "react";

export default function WebGLBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let animFrame: number;

    (async () => {
      const THREE = await import("three");
      const container = containerRef.current!;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      camera.position.z = 15;
      camera.position.y = 5;
      camera.rotation.x = -0.2;

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      const geometry = new THREE.PlaneGeometry(60, 60, 64, 64);
      geometry.rotateX(-Math.PI / 2);

      const vertexShader = `
        varying vec2 vUv;
        varying float vElevation;
        uniform float uTime;

        void main() {
          vUv = uv;
          vec3 pos = position;

          float elevation = sin(pos.x * 0.2 + uTime * 0.5) *
                            cos(pos.z * 0.2 + uTime * 0.3) * 2.0;

          elevation += sin(pos.x * 0.5 - uTime * 0.2) *
                       cos(pos.z * 0.5 + uTime * 0.4) * 0.5;

          pos.y += elevation;
          vElevation = pos.y;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `;

      const fragmentShader = `
        varying float vElevation;

        void main() {
          float mixStrength = (vElevation + 2.0) / 4.0;
          mixStrength = clamp(mixStrength, 0.0, 1.0);

          vec3 pink = vec3(0.98, 0.85, 0.83);
          vec3 darkGrey = vec3(0.2, 0.18, 0.18);

          vec3 color = mix(darkGrey, pink, mixStrength);
          float alpha = smoothstep(-1.0, 2.0, vElevation) * 0.7;

          gl_FragColor = vec4(color, alpha);
        }
      `;

      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { uTime: { value: 0 } },
        wireframe: true,
        transparent: true,
      });

      const plane = new THREE.Mesh(geometry, material);
      scene.add(plane);

      let mouseX = 0;
      const windowHalfX = window.innerWidth / 2;

      const onMouseMove = (e: MouseEvent) => {
        mouseX = (e.clientX - windowHalfX) * 0.001;
      };
      document.addEventListener("mousemove", onMouseMove);

      const clock = new THREE.Clock();

      const animate = () => {
        animFrame = requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();
        (material.uniforms.uTime as { value: number }).value = elapsedTime;
        plane.rotation.y += 0.0015;
        camera.position.x += (mouseX * 5 - camera.position.x) * 0.05;
        camera.lookAt(scene.position);
        renderer.render(scene, camera);
      };

      animate();

      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener("resize", onResize);

      return () => {
        cancelAnimationFrame(animFrame);
        document.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("resize", onResize);
        renderer.dispose();
      };
    })();

    return () => cancelAnimationFrame(animFrame);
  }, []);

  return (
    <div
      ref={containerRef}
      id="canvas-container"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        opacity: 0.4,
        pointerEvents: "none",
      }}
    />
  );
}
