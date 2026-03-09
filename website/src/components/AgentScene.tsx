"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const AGENT_NODES = [
  { id: "Agent-01", x: -9.5, y: 2.2 - 0.578 },
  { id: "Agent-02", x: -11.2, y: -0.3 - 0.578 },
  { id: "Agent-03", x: -8.8, y: -2.8 - 0.578 },
  { id: "Agent-04", x: -7.2, y: 1.1 - 0.578 },
  { id: "Agent-05", x: -11.8, y: 3.6 - 0.578 },
];

const ARC_WALL_HIT_Y = [1.4, -0.8, -1.8, 0.6, 2.2];

const SERVER_NODE = { id: "Server", x: 9.2, y: 0.0 };

function makeArcPoints(
  from: THREE.Vector3,
  to: THREE.Vector3,
  lift = 2.5,
  segments = 80,
  wallX: number | null = null,
  wallHitY: number | null = null
) {
  let midX = (from.x + to.x) / 2;
  let midY = (from.y + to.y) / 2 + lift;

  if (wallX !== null && wallHitY !== null) {
    const a = from.x - 2 * midX + to.x;
    const b = 2 * (midX - from.x);
    const c = from.x - wallX;
    const disc = b * b - 4 * a * c;
    if (disc >= 0 && Math.abs(a) > 0.001) {
      const t1 = (-b + Math.sqrt(disc)) / (2 * a);
      const t2 = (-b - Math.sqrt(disc)) / (2 * a);
      const tWall = [t1, t2].find((t) => t > 0.05 && t < 0.95) ?? 0.5;
      const coeff = 2 * (1 - tWall) * tWall;
      if (Math.abs(coeff) > 0.001) {
        midY =
          (wallHitY - (1 - tWall) ** 2 * from.y - tWall ** 2 * to.y) / coeff;
      }
    }
  }

  const mid = new THREE.Vector3(
    midX,
    midY,
    Math.abs(midY - (from.y + to.y) / 2) * 0.3
  );
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x =
      (1 - t) ** 2 * from.x + 2 * (1 - t) * t * mid.x + t ** 2 * to.x;
    const y =
      (1 - t) ** 2 * from.y + 2 * (1 - t) * t * mid.y + t ** 2 * to.y;
    const z =
      (1 - t) ** 2 * from.z + 2 * (1 - t) * t * mid.z + t ** 2 * to.z;
    points.push(new THREE.Vector3(x, y, z));
  }
  return points;
}

export default function AgentScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    while (el.firstChild) el.removeChild(el.firstChild);

    const W = 1200;
    const H = 550;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.set(0, 0, 16);

    const C_NODE_AGENT = 0x555555;
    const C_NODE_SERVER = 0x555555;
    const C_LINE = 0x888888;

    function makeNode(color: number, radius: number, isServer = false) {
      const group = new THREE.Group();

      const coreGeo = new THREE.SphereGeometry(radius * 0.38, 16, 16);
      const coreMat = new THREE.MeshBasicMaterial({ color });
      const core = new THREE.Mesh(coreGeo, coreMat);
      group.add(core);

      const wireGeo = new THREE.SphereGeometry(
        radius,
        isServer ? 10 : 8,
        isServer ? 10 : 8
      );
      const wireMat = new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity: isServer ? 0.55 : 0.4,
      });
      const wire = new THREE.Mesh(wireGeo, wireMat);
      group.add(wire);

      group.userData = {
        wire,
        wireMat,
        coreMat,
        core,
        rotSpeed: (Math.random() - 0.5) * 0.8,
      };
      return group;
    }

    const agentMeshes = AGENT_NODES.map((a) => {
      const mesh = makeNode(C_NODE_AGENT, 0.48);
      mesh.position.set(a.x, a.y, 0);
      mesh.scale.setScalar(0);
      scene.add(mesh);
      return mesh;
    });

    const serverGroup = new THREE.Group();

    const boxWireGeo = new THREE.BoxGeometry(1.35, 1.35, 1.35);
    const boxWireMat = new THREE.MeshBasicMaterial({
      color: C_NODE_SERVER,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    const boxWire = new THREE.Mesh(boxWireGeo, boxWireMat);
    serverGroup.add(boxWire);

    const boxGeo = new THREE.BoxGeometry(0.878, 0.878, 0.878);
    const boxMat = new THREE.MeshBasicMaterial({ color: C_NODE_SERVER });
    const boxSolid = new THREE.Mesh(boxGeo, boxMat);
    serverGroup.add(boxSolid);

    serverGroup.position.set(SERVER_NODE.x, SERVER_NODE.y, 0);
    serverGroup.scale.setScalar(0);
    serverGroup.userData = { boxWire, boxWireMat, boxSolid };
    scene.add(serverGroup);
    const serverMesh = serverGroup;

    function makeLabel(text: string, isServer = false) {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, 256, 64);
      ctx.font = isServer ? "bold 22px monospace" : "24px monospace";
      ctx.fillStyle = "#555555";
      ctx.textAlign = "center";
      ctx.fillText(text, 128, 40);
      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 0,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(isServer ? 2.2 : 2.7, 0.65, 1);
      return sprite;
    }

    const agentLabels = AGENT_NODES.map((a) => {
      const lbl = makeLabel(a.id);
      lbl.position.set(a.x, a.y + 0.78, 0);
      scene.add(lbl);
      return lbl;
    });

    const serverLabel = makeLabel(SERVER_NODE.id, true);
    serverLabel.position.set(SERVER_NODE.x, SERVER_NODE.y + 1.4, 0);
    scene.add(serverLabel);

    const agentFloats = AGENT_NODES.map((_, i) => ({
      phase: (i / AGENT_NODES.length) * Math.PI * 2,
      ampY: (0.12 + Math.random() * 0.1) * 0.25,
      ampX: (0.04 + Math.random() * 0.05) * 0.25,
      speed: 0.8 + Math.random() * 0.4,
      baseX: AGENT_NODES[i].x,
      baseY: AGENT_NODES[i].y,
      ampScale: 1.0,
    }));

    const WALL_X = 3.0;
    const wallHeight = 5.0;
    const wallThickness = 0.193;
    const wallLeftEdge = WALL_X - wallThickness / 2;
    const wallGeo = new THREE.BoxGeometry(wallThickness, wallHeight, 0.3);
    const wallMat = new THREE.MeshBasicMaterial({
      color: 0x999999,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(WALL_X, 0, 0);
    wall.scale.y = 0;
    scene.add(wall);

    const RIPPLE_CANVAS_SIZE = 256;
    const ripples = AGENT_NODES.map(() => {
      const canvas = document.createElement("canvas");
      canvas.width = RIPPLE_CANVAS_SIZE;
      canvas.height = RIPPLE_CANVAS_SIZE;
      const ctx = canvas.getContext("2d")!;
      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 1,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(2.4, 2.4, 1);
      sprite.visible = false;
      scene.add(sprite);
      return {
        canvas,
        ctx,
        tex,
        mat,
        sprite,
        timer: 0,
        active: false,
        collisionY: 0,
      };
    });

    function drawRippleCanvas(
      ctx: CanvasRenderingContext2D,
      tex: THREE.CanvasTexture,
      _canvas: HTMLCanvasElement,
      t: number
    ) {
      const S = RIPPLE_CANVAS_SIZE;
      const cx = S;
      const cy = S / 2;
      ctx.clearRect(0, 0, S, S);

      [0, 0.15].forEach((delay, ri) => {
        const localT = Math.max(0, Math.min((t - delay) / (1 - delay), 1));
        if (localT <= 0) return;

        const maxR = S * 0.42 + ri * S * 0.08;
        const r = localT * maxR;
        const thickness = S * 0.025;

        const alpha =
          localT < 0.15
            ? (localT / 0.15) * 0.85
            : 0.85 * (1 - (localT - 0.15) / 0.85);

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, S, S);
        ctx.clip();

        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI / 2, (3 * Math.PI) / 2);
        ctx.strokeStyle = `rgba(100, 100, 100, ${alpha})`;
        ctx.lineWidth = thickness;
        ctx.stroke();
        ctx.restore();
      });

      tex.needsUpdate = true;
    }

    const SEGMENTS = 80;
    const arcLines = AGENT_NODES.map((a, idx) => {
      const from = new THREE.Vector3(a.x, a.y, 0);
      const to = new THREE.Vector3(SERVER_NODE.x, SERVER_NODE.y, 0);
      const allPoints = makeArcPoints(
        from,
        to,
        1.5 + Math.random() * 0.8,
        SEGMENTS,
        WALL_X,
        ARC_WALL_HIT_Y[idx]
      );

      let cutIdx = SEGMENTS;
      for (let j = 0; j <= SEGMENTS; j++) {
        if (allPoints[j].x >= wallLeftEdge) {
          cutIdx = j;
          break;
        }
      }

      let wallContactPoint: THREE.Vector3;
      if (cutIdx > 0) {
        const p0 = allPoints[cutIdx - 1];
        const p1 = allPoints[cutIdx];
        const tWall = (wallLeftEdge - p0.x) / (p1.x - p0.x);
        wallContactPoint = new THREE.Vector3(
          wallLeftEdge,
          p0.y + tWall * (p1.y - p0.y),
          p0.z + tWall * (p1.z - p0.z)
        );
      } else {
        wallContactPoint = allPoints[0].clone();
      }

      const positions = new Float32Array((SEGMENTS + 2) * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );
      geo.setDrawRange(0, 0);

      const mat = new THREE.LineBasicMaterial({
        color: C_LINE,
        transparent: true,
        opacity: 0,
        linewidth: 1,
      });
      const line = new THREE.Line(geo, mat);
      scene.add(line);

      for (let j = 0; j < cutIdx; j++) {
        positions[j * 3] = allPoints[j].x;
        positions[j * 3 + 1] = allPoints[j].y;
        positions[j * 3 + 2] = allPoints[j].z;
      }
      positions[cutIdx * 3] = wallContactPoint.x;
      positions[cutIdx * 3 + 1] = wallContactPoint.y;
      positions[cutIdx * 3 + 2] = wallContactPoint.z;
      geo.attributes.position.needsUpdate = true;

      const dotGeo = new THREE.SphereGeometry(0.07, 16, 16);
      const dotMat = new THREE.MeshBasicMaterial({
        color: C_NODE_AGENT,
        transparent: true,
        opacity: 0,
      });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      scene.add(dot);

      return {
        line,
        mat,
        geo,
        dot,
        dotMat,
        allPoints,
        cutIdx,
        collisionPoint: wallContactPoint,
        progress: 0,
        active: false,
        blocked: false,
        fadeOut: false,
        opacity: 0,
      };
    });

    const logoMesh = (() => {
      const CW = 296,
        CH = 301;
      const canvas = document.createElement("canvas");
      canvas.width = CW;
      canvas.height = CH;
      const ctx = canvas.getContext("2d")!;

      const p = new Path2D(
        "M186.183 0.329102L295.183 300.329L295.427 301H229.863L229.743 300.672L214.863 260H160.213V251.271L160.386 251.122L170.979 241.973L159.013 230.007L159.353 229.653L171.013 217.507L159.006 205.5L171.213 193.293V175.029L170.651 175.062C187.297 166.665 198.713 149.416 198.713 129.5C198.713 101.333 175.879 78.5 147.713 78.5C119.546 78.5 96.7129 101.333 96.7129 129.5C96.7129 151.489 110.63 170.228 130.136 177.39L128.713 177.472V260H79.5625L64.6826 300.672L64.5625 301H0L0.243164 300.33L108.743 0.330078L108.862 0H186.063L186.183 0.329102ZM148 109C159.046 109 168 117.954 168 129C168 140.046 159.046 149 148 149C136.954 149 128 140.046 128 129C128 117.954 136.954 109 148 109Z"
      );
      ctx.fillStyle = "#555555";
      ctx.fill(p);

      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 0,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(mat);
      const worldW = 1.5;
      const worldH = worldW * (CH / CW);
      sprite.scale.set(worldW, worldH, 1);
      sprite.position.set(0, 0, 0.1);
      sprite.visible = false;
      scene.add(sprite);

      return {
        mesh: sprite,
        mat,
        sideMat: mat,
        floatPhase: Math.random() * Math.PI * 2,
        floatSpeed: 0.7,
        floatAmp: 0.06,
        worldW,
        worldH,
      };
    })();

    const logoState = { timer: 0, entering: false, visible: false };

    const state = {
      phase: "enter_nodes" as string,
      clock: 0,
      nodeTimer: 0,
      arcTimer: 0,
      wallGrown: false,
      wallTimer: 0,
      fadeTimer: 0,
      shrinkTimer: 0,
      scene1HoldTimer: 0,
      s2Timer: 0,
      s2Agent02StartBaseX: 0,
      s2Agent02StartBaseY: 0,
      s2ServerStartPos: new THREE.Vector3(),
    };

    const camOrbit = {
      theta: 0,
      radius: 16,
      speed: 0.12,
    };

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const easeIn = (t: number) => t * t * t;
    const easeInOut = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    let animId: number;
    let lastTime = performance.now();

    function animate(now: number) {
      animId = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      state.clock += dt;

      const inScene2 =
        state.phase === "scene2_transition" || state.phase === "scene2_hold";
      camOrbit.theta +=
        dt * (inScene2 ? camOrbit.speed * 0.4 : camOrbit.speed);
      const sweepAmp = inScene2 ? 0.12 : 0.32;
      const sweepTheta = Math.sin(camOrbit.theta) * sweepAmp;
      const sweepPhi = Math.sin(camOrbit.theta * 0.5) * 0.1;
      camera.position.x = Math.sin(sweepTheta) * camOrbit.radius;
      camera.position.y = Math.sin(sweepPhi) * camOrbit.radius * 0.4;
      camera.position.z = Math.cos(sweepTheta) * camOrbit.radius;
      camera.lookAt(0, 0, 0);

      agentMeshes.forEach((mesh, i) => {
        if (mesh.scale.x < 0.05) return;
        const f = agentFloats[i];
        const t = state.clock * f.speed + f.phase;
        mesh.position.x = f.baseX + Math.sin(t * 0.7) * f.ampX * f.ampScale;
        mesh.position.y = f.baseY + Math.sin(t) * f.ampY * f.ampScale;
        agentLabels[i].position.x = mesh.position.x;
        agentLabels[i].position.y = mesh.position.y + 0.78;
      });

      agentMeshes.forEach((mesh) => {
        if (mesh.scale.x > 0.05) {
          mesh.userData.wire.rotation.y += dt * mesh.userData.rotSpeed;
          mesh.userData.wire.rotation.x += dt * mesh.userData.rotSpeed * 0.4;
        }
      });

      if (serverMesh.scale.x > 0.05) {
        serverGroup.userData.boxWire.rotation.y += dt * 0.22;
        serverGroup.userData.boxSolid.rotation.y += dt * 0.22;
      }

      ripples.forEach((r) => {
        if (!r.active) return;
        r.timer += dt;
        const dur = 0.65;
        const t = Math.min(r.timer / dur, 1);

        drawRippleCanvas(r.ctx, r.tex, r.canvas, t);

        if (t >= 1) {
          r.active = false;
          r.sprite.visible = false;
          r.ctx.clearRect(0, 0, RIPPLE_CANVAS_SIZE, RIPPLE_CANVAS_SIZE);
          r.tex.needsUpdate = true;
        }
      });

      // PHASE: enter_nodes
      if (state.phase === "enter_nodes") {
        state.nodeTimer += dt;
        const interval = 0.22;
        const total = AGENT_NODES.length + 1;

        AGENT_NODES.forEach((_, i) => {
          const t = Math.min((state.nodeTimer - i * interval) / 0.3, 1);
          if (t > 0) {
            agentMeshes[i].scale.setScalar(easeOut(t));
            agentLabels[i].material.opacity = t;
          }
        });

        const serverT = Math.min(
          (state.nodeTimer - AGENT_NODES.length * interval) / 0.3,
          1
        );
        if (serverT > 0) {
          serverGroup.scale.setScalar(easeOut(serverT));
          serverLabel.material.opacity = serverT;
        }

        if (state.nodeTimer > total * interval + 0.5) {
          state.phase = "draw_arcs";
          arcLines[0].active = true;
          arcLines[0].mat.opacity = 0.7;
          arcLines[0].dotMat.opacity = 0.9;
        }
      }

      // PHASE: draw_arcs
      if (state.phase === "draw_arcs") {
        state.arcTimer += dt;
        const drawSpeed = 0.85;

        if (!state.wallGrown) {
          const firstArc = arcLines[0];
          if (firstArc.progress > 0.4) {
            state.wallTimer += dt;
            const wallT = Math.min(state.wallTimer / 0.5, 1);
            wall.scale.y = easeOut(wallT);
            wallMat.opacity = 0.55 * easeOut(wallT);
            if (wallT >= 1) state.wallGrown = true;
          }
        }

        arcLines.forEach((arc, i) => {
          if (!arc.active || arc.blocked) return;

          arc.progress = Math.min(arc.progress + dt * drawSpeed, 1);

          const tipIdx = Math.min(
            Math.floor(arc.progress * SEGMENTS),
            arc.cutIdx
          );

          if (tipIdx >= arc.cutIdx && !arc.blocked) {
            arc.blocked = true;
            arc.geo.setDrawRange(0, arc.cutIdx + 1);
            arc.dot.visible = false;

            const r = ripples[i];
            r.collisionY = arc.collisionPoint.y;
            r.timer = 0;
            r.active = true;
            r.sprite.visible = true;
            r.sprite.position.set(
              WALL_X - 1.2,
              arc.collisionPoint.y,
              0.05
            );

            const next = i + 1;
            if (next < arcLines.length) {
              setTimeout(() => {
                arcLines[next].active = true;
                arcLines[next].mat.opacity = 0.7;
                arcLines[next].dotMat.opacity = 0.9;
              }, 200);
            } else {
              setTimeout(() => {
                state.phase = "fade_lines";
                state.fadeTimer = 0;
              }, 500);
            }
          } else {
            arc.geo.setDrawRange(0, tipIdx + 1);
            const dotPt =
              tipIdx >= arc.cutIdx
                ? arc.collisionPoint
                : arc.allPoints[tipIdx];
            arc.dot.position.copy(dotPt);
          }
        });
      }

      // PHASE: fade_lines
      if (state.phase === "fade_lines") {
        state.fadeTimer += dt;
        const t = Math.min(state.fadeTimer / 0.6, 1);
        const opacity = 0.7 * (1 - t);

        arcLines.forEach((arc) => {
          arc.mat.opacity = opacity;
          arc.dotMat.opacity = 0;
        });
        wallMat.opacity = 0.55 * (1 - t);

        if (t >= 1) {
          arcLines.forEach((arc) => {
            arc.line.visible = false;
            arc.dot.visible = false;
          });
          wall.visible = false;
          state.phase = "shrink_agents";
          state.shrinkTimer = 0;
        }
      }

      // PHASE: shrink_agents
      if (state.phase === "shrink_agents") {
        state.shrinkTimer += dt;
        const interval = 0.18;
        const shrinkDur = 0.35;

        const shrinkOrder = [0, 2, 3, 4];
        shrinkOrder.forEach((agentIdx, order) => {
          const start = order * interval;
          const t = Math.min((state.shrinkTimer - start) / shrinkDur, 1);
          if (t > 0) {
            const s = easeIn(1 - t);
            agentMeshes[agentIdx].scale.setScalar(Math.max(0, s));
            agentLabels[agentIdx].material.opacity = Math.max(0, 1 - t);
          }
        });

        const lastShrink = shrinkOrder.length * interval + shrinkDur;
        if (state.shrinkTimer > lastShrink) {
          state.phase = "scene1_hold";
          state.scene1HoldTimer = 0;
        }
      }

      // PHASE: scene1_hold
      if (state.phase === "scene1_hold") {
        state.scene1HoldTimer += dt;
        if (state.scene1HoldTimer > 0.6) {
          state.phase = "scene2_transition";
          state.s2Timer = 0;
          state.s2Agent02StartBaseX = agentFloats[1].baseX;
          state.s2Agent02StartBaseY = agentFloats[1].baseY;
          state.s2ServerStartPos = serverGroup.position.clone();
        }
      }

      // PHASE: scene2_transition
      if (state.phase === "scene2_transition") {
        state.s2Timer += dt;
        const dur = 1.4;
        const raw = Math.min(state.s2Timer / dur, 1);
        const t = easeInOut(raw);

        agentFloats[1].ampScale = THREE.MathUtils.lerp(
          1.0,
          0.0,
          Math.min(raw * 3, 1)
        );
        agentLabels[1].material.opacity = 1;
        serverLabel.material.opacity = 1;

        const agentTargetX = -8.6;
        agentFloats[1].baseX = THREE.MathUtils.lerp(
          state.s2Agent02StartBaseX,
          agentTargetX,
          t
        );
        agentFloats[1].baseY = THREE.MathUtils.lerp(
          state.s2Agent02StartBaseY,
          0.0,
          t
        );

        agentLabels[1].position.x = agentMeshes[1].position.x;
        agentLabels[1].position.y = agentMeshes[1].position.y + 1.1;

        const serverTargetX = 6.88;
        serverGroup.position.x = THREE.MathUtils.lerp(
          state.s2ServerStartPos.x,
          serverTargetX,
          t
        );
        serverGroup.position.y = THREE.MathUtils.lerp(
          state.s2ServerStartPos.y,
          0.0,
          t
        );

        serverLabel.position.x = serverGroup.position.x;
        serverLabel.position.y = serverGroup.position.y + 1.4;

        agentMeshes[1].scale.setScalar(
          THREE.MathUtils.lerp(1.0, 1.6, t)
        );
        serverGroup.scale.setScalar(THREE.MathUtils.lerp(1.0, 1.5, t));

        camOrbit.radius = THREE.MathUtils.lerp(16, 12.5, t);
        camera.fov = THREE.MathUtils.lerp(45, 41.5, t);
        camera.updateProjectionMatrix();

        if (raw >= 1) {
          state.phase = "scene2_hold";
          agentFloats[1].baseX = agentTargetX;
          agentFloats[1].baseY = 0.0;
          setTimeout(() => {
            logoState.entering = true;
            logoState.timer = 0;
            logoMesh.mat.opacity = 1;
            logoMesh.sideMat.opacity = 1;
            logoMesh.mesh.scale.set(0.001, 0.001, 1);
            logoMesh.mesh.visible = true;
          }, 500);
        }
      }

      // PHASE: scene2_hold
      if (state.phase === "scene2_hold") {
        agentFloats[1].ampScale = Math.min(
          agentFloats[1].ampScale + dt * 0.5,
          1.0
        );

        agentLabels[1].position.x = agentMeshes[1].position.x;
        agentLabels[1].position.y = agentMeshes[1].position.y + 1.1;
        serverLabel.position.x = serverGroup.position.x;
        serverLabel.position.y = serverGroup.position.y + 1.4;

        if (logoState.entering) {
          logoState.timer += dt;
          const dur = 0.4;
          const lt = Math.min(logoState.timer / dur, 1);
          const pop =
            lt < 0.7
              ? easeOut(lt / 0.7) * 1.15
              : 1.15 - 0.15 * ((lt - 0.7) / 0.3);
          logoMesh.mesh.scale.setScalar(pop);
          if (lt >= 1) {
            logoState.entering = false;
            logoState.visible = true;
            logoMesh.mesh.scale.setScalar(1);
          }
        }

        if (logoState.visible || logoState.entering) {
          const ft =
            state.clock * logoMesh.floatSpeed + logoMesh.floatPhase;
          logoMesh.mesh.position.set(
            0,
            Math.sin(ft) * logoMesh.floatAmp,
            0
          );
        }
      }

      renderer.render(scene, camera);
    }

    animate(performance.now());

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (el.contains(renderer.domElement)) {
        el.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        width: "1200px",
        height: "550px",
        background: "transparent",
        overflow: "hidden",
        position: "relative",
      }}
    />
  );
}
