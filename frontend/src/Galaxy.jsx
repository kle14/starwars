import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export const GROUP_COLORS = {
  Jedi: "#6fd0ff", Sith: "#ff4b4b", Rebel: "#ffb347",
  Imperial: "#c9ced6", Smuggler: "#7dffb2", Droid: "#d9a8ff",
};
const GOLDEN = 2.399963;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function layoutGalaxy(convs) {
  const groups = Object.keys(GROUP_COLORS);
  const buckets = Object.fromEntries(groups.map((g) => [g, []]));
  convs.forEach((c) => (buckets[c.group] || buckets.Droid).push(c));
  const times = convs.map((c) => Date.parse(c.last_ts) || 0);
  const minT = times.reduce((a, b) => Math.min(a, b), Infinity);
  const maxT = times.reduce((a, b) => Math.max(a, b), -Infinity);
  const span = maxT - minT || 1;

  const nodes = [], links = [], centers = {};
  const spacing = 34, R = 820;

  groups.forEach((g, gi) => {
    const a = (gi / groups.length) * Math.PI * 2 - Math.PI / 2;
    const cx = Math.cos(a) * R * 1.15, cy = Math.sin(a) * R * 0.8;
    const list = buckets[g].sort((p, q) => q.n - p.n);
    const start = nodes.length;
    list.forEach((c, j) => {
      const r = spacing * Math.sqrt(j + 0.6), th = j * GOLDEN + gi;
      const jit = Math.sin(c.id * 12.9898) * 5;
      nodes.push({
        ...c, group: g, color: GROUP_COLORS[g],
        x: cx + Math.cos(th) * r + jit, y: cy + Math.sin(th) * r - jit,
        rec: ((Date.parse(c.last_ts) || minT) - minT) / span,
      });
    });
    for (let i = start + 1; i < nodes.length; i++) {
      let best = -1, bd = Infinity;
      for (let j = start; j < i; j++) {
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = j; }
      }
      if (best >= 0 && bd < (spacing * 2.4) ** 2) links.push([i, best]);
    }
    centers[g] = { x: cx, y: cy, r: spacing * Math.sqrt(list.length + 1) + 50, count: list.length };
  });

  [...nodes].sort((a, b) => b.n - a.n).forEach((n, i) => (n.rank = i));
  return { nodes, links, centers, byId: new Map(nodes.map((n) => [n.id, n])) };
}

function sprite(S, color) {
  if (S.sprites[color]) return S.sprites[color];
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(48, 48, 0, 48, 48, 48);
  g.addColorStop(0, "#fff"); g.addColorStop(0.12, color);
  g.addColorStop(0.4, color + "55"); g.addColorStop(1, color + "00");
  x.fillStyle = g; x.fillRect(0, 0, 96, 96);
  return (S.sprites[color] = c);
}

const Galaxy = forwardRef(function Galaxy(props, ref) {
  const cvRef = useRef(null);
  const P = useRef(props);
  P.current = props;
  const S = useRef({
    cam: { x: 0, y: 0, k: 0.5 }, w: 1, h: 1, anim: null, hover: null, drag: null,
    mouse: null, saved: null, fitted: false, sprites: {}, accent: "#4fc3ff",
    dust: Array.from({ length: 260 }, () => ({
      x: (Math.random() - 0.5) * 3000, y: (Math.random() - 0.5) * 2400,
      s: Math.random() * 1.4 + 0.3, p: Math.random() * 6,
    })),
  });

  const fit = () => {
    const { nodes } = P.current.graph, s = S.current;
    if (!nodes.length) return { x: 0, y: 0, k: 0.5 };
    let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
    nodes.forEach((n) => { a = Math.min(a, n.x); b = Math.min(b, n.y); c = Math.max(c, n.x); d = Math.max(d, n.y); });
    return { x: (a + c) / 2, y: (b + d) / 2, k: Math.min(s.w / (c - a + 260), s.h / (d - b + 260)) * 0.92 };
  };
  const animate = (to, dur, cb) => {
    const s = S.current;
    s.anim = { from: { ...s.cam }, to, t0: performance.now(), dur, cb };
  };

  useImperativeHandle(ref, () => ({
    flyTo(id) {
      const n = P.current.graph.byId.get(id), s = S.current;
      if (!n) return;
      if (!s.saved) s.saved = { ...s.cam };
      const k = 11, shift = s.w > 900 ? (0.2 * s.w) / k : 0;
      animate({ x: n.x + shift, y: n.y, k }, 1600, () => P.current.onArrive?.(id));
    },
    flyHome() {
      const s = S.current, to = s.saved || fit();
      s.saved = null;
      animate(to, 1200, () => P.current.onHome?.());
    },
    reset() { animate(fit(), 800); },
    zoomBy(f) {
      const s = S.current;
      animate({ x: s.cam.x, y: s.cam.y, k: clamp(s.cam.k * f, 0.05, 40) }, 350);
    },
  }));

  useEffect(() => {
    const s = S.current;
    if (s.fitted || !props.active || !props.graph.nodes.length) return;
    s.fitted = true;
    const to = fit();
    s.cam = { ...to, k: to.k * 0.12 };
    animate(to, 3200);
  }, [props.graph, props.active]);

  useEffect(() => {
    setTimeout(() => {
      S.current.accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#4fc3ff";
    }, 50);
  }, [props.theme]);

  useEffect(() => {
    const cv = cvRef.current, s = S.current, ctx = cv.getContext("2d");
    s.ctx = ctx;
    const resize = () => {
      const dpr = devicePixelRatio || 1;
      s.w = innerWidth; s.h = innerHeight;
      cv.width = s.w * dpr; cv.height = s.h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    addEventListener("resize", resize);

    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const down = (e) => { s.drag = { x: e.clientX, y: e.clientY, moved: 0 }; cv.setPointerCapture(e.pointerId); };
    const move = (e) => {
      s.mouse = pos(e);
      if (!s.drag) return;
      const dx = e.clientX - s.drag.x, dy = e.clientY - s.drag.y;
      s.drag.x = e.clientX; s.drag.y = e.clientY; s.drag.moved += Math.abs(dx) + Math.abs(dy);
      if (!P.current.locked && s.drag.moved > 4) {
        s.anim = null; s.cam.x -= dx / s.cam.k; s.cam.y -= dy / s.cam.k;
      }
    };
    const up = () => {
      if (s.drag && s.drag.moved <= 4 && !P.current.locked && !s.anim && s.hover) P.current.onPick(s.hover.id);
      s.drag = null;
    };
    const leave = () => { s.mouse = null; };
    const wheel = (e) => {
      e.preventDefault();
      if (P.current.locked) return;
      const m = pos(e), k0 = s.cam.k;
      const k1 = clamp(k0 * Math.exp(-e.deltaY * 0.0015), 0.05, 40);
      const wx = (m.x - s.w / 2) / k0 + s.cam.x, wy = (m.y - s.h / 2) / k0 + s.cam.y;
      s.anim = null; s.cam.k = k1;
      s.cam.x = wx - (m.x - s.w / 2) / k1; s.cam.y = wy - (m.y - s.h / 2) / k1;
    };
    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointerleave", leave);
    cv.addEventListener("wheel", wheel, { passive: false });

    let raf;
    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      const { graph, hits, selectedId, hidden } = P.current;
      const { w, h, cam } = s;

      if (s.anim) {
        const a = s.anim, t = clamp((now - a.t0) / a.dur, 0, 1);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        cam.x = a.from.x + (a.to.x - a.from.x) * e;
        cam.y = a.from.y + (a.to.y - a.from.y) * e;
        cam.k = Math.exp(Math.log(a.from.k) + (Math.log(a.to.k) - Math.log(a.from.k)) * e);
        if (t >= 1) { s.anim = null; a.cb?.(); }
      }

      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      const toX = (x) => (x - cam.x) * cam.k + w / 2;
      const toY = (y) => (y - cam.y) * cam.k + h / 2;

      ctx.fillStyle = "#fff";
      const kk = Math.pow(cam.k, 0.2);
      for (const d of s.dust) {
        let x = (d.x - cam.x * 0.2) * kk + w / 2, y = (d.y - cam.y * 0.2) * kk + h / 2;
        x = ((x % (w + 200)) + w + 200) % (w + 200) - 100;
        y = ((y % (h + 200)) + h + 200) % (h + 200) - 100;
        ctx.globalAlpha = 0.25 + 0.25 * Math.sin(now / 900 + d.p);
        ctx.fillRect(x, y, d.s, d.s);
      }

      for (const [g, c] of Object.entries(graph.centers)) {
        if (hidden.has(g)) continue;
        const x = toX(c.x), y = toY(c.y), r = c.r * cam.k;
        if (x + r < 0 || x - r > w || y + r < 0 || y - r > h) continue;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 1.4);
        grad.addColorStop(0, GROUP_COLORS[g] + "26");
        grad.addColorStop(1, GROUP_COLORS[g] + "00");
        ctx.globalAlpha = hits ? 0.4 : 1;
        ctx.fillStyle = grad;
        ctx.fillRect(x - r * 1.4, y - r * 1.4, r * 2.8, r * 2.8);
        if (cam.k < 1.8) {
          ctx.globalAlpha = clamp(1.8 - cam.k, 0, 0.8) * 0.8;
          ctx.fillStyle = GROUP_COLORS[g];
          ctx.font = `700 ${clamp(18 * cam.k + 8, 12, 26)}px Orbitron, sans-serif`;
          ctx.textAlign = "center";
          try { ctx.letterSpacing = "6px"; } catch { /* older browsers */ }
          ctx.fillText(g.toUpperCase() + ` · ${c.count}`, x, y - r * 0.95);
          try { ctx.letterSpacing = "0px"; } catch { /* ignore */ }
        }
      }

      const nodes = graph.nodes;
      ctx.lineWidth = 1;
      for (const [i, j] of graph.links) {
        const a = nodes[i], b = nodes[j];
        if (hidden.has(a.group)) continue;
        const ax = toX(a.x), ay = toY(a.y), bx = toX(b.x), by = toY(b.y);
        if ((ax < -50 && bx < -50) || (ax > w + 50 && bx > w + 50) ||
            (ay < -50 && by < -50) || (ay > h + 50 && by > h + 50)) continue;
        ctx.globalAlpha = hits ? (hits.has(a.id) && hits.has(b.id) ? 0.6 : 0.03) : 0.18;
        ctx.strokeStyle = a.color;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }

      s.hover = null;
      let best = 1e9, labels = 0;
      const m = s.mouse, pulse = 0.5 + 0.5 * Math.sin(now / 250);
      let sel = null;
      ctx.font = "11px Orbitron, sans-serif";
      ctx.textAlign = "center";

      for (const n of nodes) {
        if (hidden.has(n.group)) continue;
        const x = toX(n.x), y = toY(n.y);
        if (x < -80 || x > w + 80 || y < -80 || y > h + 80) continue;
        const isSel = n.id === selectedId;
        let r = (1.5 + Math.sqrt(n.n) * 0.3) * Math.pow(cam.k, 0.8);
        if (isSel) { r *= 1 + 3 * clamp((cam.k - 3) / 7, 0, 1); sel = { n, x, y, r }; }
        r = Math.max(r, 1.2);
        const hit = hits ? hits.has(n.id) : null;
        let alpha = (0.45 + 0.55 * n.rec) * (0.85 + 0.15 * Math.sin(now / 600 + n.id * 1.7));
        if (hits && !hit) alpha *= 0.07;
        if (selectedId && !isSel) alpha *= 0.35;
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite(s, n.color), x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2);
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(x, y, Math.max(r * 0.42, 0.8), 0, 6.283); ctx.fill();

        if (hit) {
          ctx.globalAlpha = 0.9; ctx.strokeStyle = "#ff4040"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(x, y, r * 2.1 + pulse * 3, 0, 6.283); ctx.stroke();
          if (cam.k > 0.8) {
            ctx.fillStyle = "#ff8080";
            ctx.fillText(String(hits.get(n.id)), x + r * 2.4, y - r * 2.2);
          }
        }

        if (m && !P.current.locked) {
          const d = (x - m.x) ** 2 + (y - m.y) ** 2, thr = Math.max(r * 2, 9) ** 2;
          if (d < thr && d < best && (!hits || hit)) { best = d; s.hover = { ...n, x, y, r }; }
        }

        const want = !selectedId && labels < 120 && alpha > 0.1 &&
          (cam.k > 2.4 || (cam.k > 1.1 && n.rank < 40) || (hit && cam.k > 0.7 && labels < 40));
        if (want) {
          labels++;
          ctx.globalAlpha = Math.min(1, alpha + 0.2);
          ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.75)";
          ctx.strokeText(n.title, x, y + r * 2.6 + 10);
          ctx.fillStyle = "#e8f4ff";
          ctx.fillText(n.title, x, y + r * 2.6 + 10);
        }
      }

      if (sel) {
        const { n, x, y, r } = sel;
        const p = clamp((cam.k - 3) / 7, 0, 1);
        if (p > 0.02) {
          ctx.globalAlpha = 0.35 * p;
          ctx.drawImage(sprite(s, n.color), x - r * 5, y - r * 5, r * 10, r * 10);
          ctx.strokeStyle = n.color; ctx.lineWidth = 2;
          for (let i = 0; i < 18; i++) {
            const ang = (i * Math.PI) / 9 + now / 5000;
            const len = r * (1.5 + 0.7 * Math.sin(now / 350 + i * 2));
            ctx.globalAlpha = 0.45 * p;
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(ang) * r * 1.1, y + Math.sin(ang) * r * 1.1);
            ctx.lineTo(x + Math.cos(ang) * (r * 1.1 + len), y + Math.sin(ang) * (r * 1.1 + len));
            ctx.stroke();
          }
          ctx.fillStyle = "#fff"; ctx.globalAlpha = p;
          ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, 6.283); ctx.fill();
        }
        if (p > 0.4) {
          n.p.forEach((name, i) => {
            const orad = r * (1.9 + 0.55 * i);
            const ang = now / (2600 + i * 900) + (i * 6.283) / n.p.length;
            const ox = x + Math.cos(ang) * orad, oy = y + Math.sin(ang) * orad * 0.42;
            ctx.globalAlpha = 0.25 * p; ctx.strokeStyle = s.accent; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.ellipse(x, y, orad, orad * 0.42, 0, 0, 6.283); ctx.stroke();
            ctx.globalAlpha = p; ctx.fillStyle = s.accent;
            ctx.beginPath(); ctx.arc(ox, oy, 5, 0, 6.283); ctx.fill();
            ctx.fillStyle = "#e8f4ff";
            ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.8)";
            ctx.strokeText(name, ox, oy - 11); ctx.fillText(name, ox, oy - 11);
          });
        }
      }

      if (s.hover) {
        const n = s.hover, line2 = `${n.group} · ${n.n} msgs`;
        const tw = Math.max(ctx.measureText(n.title).width, ctx.measureText(line2).width) + 20;
        const tx = clamp(m.x + 14, 8, w - tw - 8), ty = clamp(m.y + 14, 8, h - 56);
        ctx.globalAlpha = 0.92; ctx.fillStyle = "rgba(2,8,18,.92)";
        ctx.fillRect(tx, ty, tw, 44);
        ctx.strokeStyle = n.color; ctx.lineWidth = 1; ctx.strokeRect(tx, ty, tw, 44);
        ctx.globalAlpha = 1; ctx.textAlign = "left";
        ctx.fillStyle = n.color; ctx.fillText(n.title, tx + 10, ty + 18);
        ctx.fillStyle = "#9fb4c8"; ctx.fillText(line2, tx + 10, ty + 35);
        ctx.textAlign = "center";
      }
      cv.style.cursor = s.hover ? "pointer" : s.drag?.moved > 4 ? "grabbing" : "grab";
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
      cv.removeEventListener("pointerdown", down);
      cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerup", up);
      cv.removeEventListener("pointerleave", leave);
      cv.removeEventListener("wheel", wheel);
    };
  }, []);

  return <canvas ref={cvRef} className="gx-canvas" />;
});

export default Galaxy;
