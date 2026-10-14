import { useEffect, useRef } from "react";

export default function Starfield({ warp }) {
  const ref = useRef(null);
  const warpRef = useRef(warp);

  useEffect(() => { warpRef.current = warp; }, [warp]);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv.getContext("2d");
    let w = 0, h = 0, raf, cur = 0.0012;
    const stars = Array.from({ length: 380 }, () => ({
      x: Math.random() * 2 - 1, y: Math.random() * 2 - 1,
      z: Math.random(), pz: 1,
    }));

    const resize = () => { w = cv.width = innerWidth; h = cv.height = innerHeight; };
    resize();
    addEventListener("resize", resize);

    const loop = () => {
      const warping = warpRef.current;
      const target = warping ? 0.06 : 0.0012;
      cur += (target - cur) * (warping ? 0.03 : 0.025);

      const scale = Math.max(w, h) / 2;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.pz = s.z;
        s.z -= cur;
        if (s.z <= 0.01) {
          s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1;
          s.z = 1; s.pz = 1;
        }
        const x = (s.x / s.z) * scale * 0.5 + w / 2;
        const y = (s.y / s.z) * scale * 0.5 + h / 2;
        const px = (s.x / s.pz) * scale * 0.5 + w / 2;
        const py = (s.y / s.pz) * scale * 0.5 + h / 2;
        ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, (1 - s.z) + 0.2)})`;
        ctx.lineWidth = (1 - s.z) * 2 + 0.4;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x + 0.01, y + 0.01);
        ctx.stroke();
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={ref} className="starfield" />;
}
