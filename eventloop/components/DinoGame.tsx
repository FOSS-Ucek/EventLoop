"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";

export interface DinoGameProps {
  onScoreUpdate?: (score: number, distanceRun: number, isGameOver?: boolean) => void;
  disabled?: boolean;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 180;
const GRAVITY = 0.6;
const JUMP_VELOCITY = -12;
const BASE_SPEED = 6;
const MAX_SPEED = 13;
const SPEED_INC = 0.5;
const GROUND_Y = 150;

type GameState = "IDLE" | "PLAYING" | "GAME_OVER";

// --- Sprite Definitions ---
const DINO_IDLE = [
  "             █████████ ",
  "            ███████████",
  "            ████████   ",
  "            ██████████ ",
  "            ███████████",
  "            ████       ",
  "            ██         ",
  "    ██    ██████       ",
  "    ███  ████████      ",
  "    █████████████      ",
  "    ████████████       ",
  "     ██████████        ",
  "      ████████         ",
  "       ██████          ",
  "        ████           ",
  "        ██ ██          ",
  "        ██ ██          ",
  "        ██  ██         ",
];

const DINO_RUN_1 = [
  "             █████████ ",
  "            ███████████",
  "            ████████   ",
  "            ██████████ ",
  "            ███████████",
  "            ████       ",
  "            ██         ",
  "    ██    ██████       ",
  "    ███  ████████      ",
  "    █████████████      ",
  "    ████████████       ",
  "     ██████████        ",
  "      ████████         ",
  "       ██████          ",
  "        ████           ",
  "        ██             ",
  "        ██             ",
  "        ██             ",
];

const DINO_RUN_2 = [
  "             █████████ ",
  "            ███████████",
  "            ████████   ",
  "            ██████████ ",
  "            ███████████",
  "            ████       ",
  "            ██         ",
  "    ██    ██████       ",
  "    ███  ████████      ",
  "    █████████████      ",
  "    ████████████       ",
  "     ██████████        ",
  "      ████████         ",
  "       ██████          ",
  "        ████           ",
  "          ██           ",
  "          ██           ",
  "           ██          ",
];

const DINO_DUCK_1 = [
  "                               ",
  "                               ",
  "                               ",
  "                               ",
  "                               ",
  "                               ",
  "                               ",
  "                               ",
  "             █████████         ",
  "            ███████████        ",
  "    ██      ████████   ██████  ",
  "    ███    ██████████ ████████ ",
  "    ██████████████████████████ ",
  "    ██████████████████████     ",
  "     ████████████████████      ",
  "      ██████████████████       ",
  "       ██████                  ",
  "        ████                   ",
  "        ██                     ",
  "        ██                     ",
  "        ██                     ",
];

const DINO_DUCK_2 = [
  "                               ",
  "                               ",
  "                               ",
  "                               ",
  "                               ",
  "                               ",
  "                               ",
  "                               ",
  "             █████████         ",
  "            ███████████        ",
  "    ██      ████████   ██████  ",
  "    ███    ██████████ ████████ ",
  "    ██████████████████████████ ",
  "    ██████████████████████     ",
  "     ████████████████████      ",
  "      ██████████████████       ",
  "       ██████                  ",
  "        ████                   ",
  "          ██                   ",
  "          ██                   ",
  "           ██                  ",
];

const CACTUS_SMALL = [
  "    ██    ",
  "    ██    ",
  "    ██ ██ ",
  " ██ ██ ██ ",
  " ██ ██ ██ ",
  " ████████ ",
  "  ██████  ",
  "    ██    ",
  "    ██    ",
  "    ██    ",
];

const CACTUS_LARGE = [
  "    ████    ",
  "    ████    ",
  "    ████    ",
  " ██ ████    ",
  " ██ ████ ██ ",
  " ███████ ██ ",
  " ███████ ██ ",
  "  █████████ ",
  "    ██████  ",
  "    ████    ",
  "    ████    ",
  "    ████    ",
];

const BIRD_WING_UP = [
  "       ██     ",
  "     █████    ",
  "   ████████   ",
  " ███████████  ",
  "█████████████ ",
  "  ████        ",
  "    █████     ",
  "      ████    ",
  "       ██     ",
];

const BIRD_WING_DOWN = [
  "              ",
  "              ",
  "       ██     ",
  "     █████    ",
  " ███████████  ",
  "█████████████ ",
  " ███████████  ",
  "   ████████   ",
  "     █████    ",
  "       ██     ",
];

const CLOUD = [
  "        █████         ",
  "     ███████████      ",
  "  ████████████████    ",
  "█████████████████████ ",
  "█████████████████████ ",
];

function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: string[],
  x: number,
  y: number,
  scale: number = 2,
  color: string = "#ffffff"
) {
  ctx.fillStyle = color;
  for (let i = 0; i < sprite.length; i++) {
    for (let j = 0; j < sprite[i].length; j++) {
      if (sprite[i][j] !== " ") {
        ctx.fillRect(Math.floor(x + j * scale), Math.floor(y + i * scale), scale, scale);
      }
    }
  }
}

// Helper to generate a ground line with bumps
function createGround() {
  const segments = [];
  let x = 0;
  while (x < 1200) {
    const len = Math.random() * 20 + 5;
    segments.push({ x, y: Math.random() > 0.7 ? 1 : 0, len });
    x += len + Math.random() * 10;
  }
  return segments;
}

export default function DinoGame({ onScoreUpdate, disabled }: DinoGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const [gameState, setGameState] = useState<GameState>("IDLE");
  const [highScore, setHighScore] = useState(0);
  
  // Game state refs (to avoid deps in game loop)
  const gameRef = useRef({
    state: "IDLE" as GameState,
    score: 0,
    distanceRun: 0,
    speed: BASE_SPEED,
    dino: {
      x: 50,
      y: GROUND_Y,
      dy: 0,
      width: 44,
      height: 47,
      duckWidth: 59,
      duckHeight: 30,
      isJumping: false,
      isDucking: false,
      animTimer: 0,
    },
    obstacles: [] as any[],
    clouds: [] as any[],
    ground: createGround(),
    groundOffset: 0,
    flashTimer: 0,
    lastHundred: 0,
  });

  const jump = useCallback(() => {
    if (disabled) return;
    const g = gameRef.current;
    if (g.state === "IDLE" || g.state === "GAME_OVER") {
      startGame();
      return;
    }
    if (!g.dino.isJumping) {
      g.dino.dy = JUMP_VELOCITY;
      g.dino.isJumping = true;
    }
  }, [disabled]);

  const duck = useCallback((isDucking: boolean) => {
    if (disabled) return;
    const g = gameRef.current;
    if (g.state === "PLAYING") {
      g.dino.isDucking = isDucking;
      if (isDucking && g.dino.isJumping) {
        g.dino.dy += 5; // Fast fall
      }
    }
  }, [disabled]);

  const startGame = () => {
    const g = gameRef.current;
    g.state = "PLAYING";
    setGameState("PLAYING");
    g.score = 0;
    g.distanceRun = 0;
    g.speed = BASE_SPEED;
    g.dino = { ...g.dino, y: GROUND_Y, dy: 0, isJumping: false, isDucking: false, animTimer: 0 };
    g.obstacles = [];
    g.clouds = [{ x: 600, y: 30, speed: 1 }];
    g.groundOffset = 0;
    g.flashTimer = 0;
    g.lastHundred = 0;
  };

  const spawnObstacle = () => {
    const g = gameRef.current;
    const type = Math.random();
    let obstacle: any = { x: CANVAS_WIDTH, passed: false };

    if (g.score > 200 && type > 0.8) {
      // Pterodactyl
      obstacle.type = "BIRD";
      obstacle.y = Math.random() > 0.5 ? GROUND_Y - 45 : GROUND_Y - 70; // High or medium
      obstacle.width = 30;
      obstacle.height = 20;
      obstacle.animTimer = 0;
    } else {
      // Cactus
      obstacle.type = "CACTUS";
      obstacle.y = GROUND_Y;
      const isLarge = Math.random() > 0.5;
      const count = Math.floor(Math.random() * 3) + 1; // 1 to 3
      obstacle.isLarge = isLarge;
      obstacle.count = count;
      obstacle.width = (isLarge ? 24 : 16) * count;
      obstacle.height = isLarge ? 48 : 32;
    }
    g.obstacles.push(obstacle);
  };

  const spawnCloud = () => {
    const g = gameRef.current;
    g.clouds.push({
      x: CANVAS_WIDTH,
      y: 20 + Math.random() * 60,
      speed: 0.5 + Math.random() * 1,
    });
  };

  const update = useCallback(() => {
    const g = gameRef.current;
    if (g.state !== "PLAYING") return;

    // Physics
    g.dino.y += g.dino.dy;
    g.dino.dy += GRAVITY;

    if (g.dino.y >= GROUND_Y) {
      g.dino.y = GROUND_Y;
      g.dino.dy = 0;
      g.dino.isJumping = false;
    }

    g.dino.animTimer++;

    // Ground
    g.groundOffset += g.speed;
    if (g.groundOffset >= 1200) {
      g.groundOffset = 0;
      g.ground = createGround();
    }

    // Clouds
    g.clouds.forEach((c) => (c.x -= c.speed));
    g.clouds = g.clouds.filter((c) => c.x + 50 > 0);
    if (Math.random() < 0.005) spawnCloud();

    // Obstacles
    g.obstacles.forEach((o) => {
      o.x -= g.speed;
      if (o.type === "BIRD") o.animTimer++;
    });

    if (g.obstacles.length === 0 || g.obstacles[g.obstacles.length - 1].x < CANVAS_WIDTH - 250 - Math.random() * 200) {
      if (Math.random() < 0.02) spawnObstacle();
    }
    g.obstacles = g.obstacles.filter((o) => o.x + o.width > 0);

    // Collision detection
    const hitBox = {
      x: g.dino.x + 10,
      y: g.dino.isDucking && !g.dino.isJumping ? g.dino.y - g.dino.duckHeight + 10 : g.dino.y - g.dino.height + 10,
      w: (g.dino.isDucking && !g.dino.isJumping ? g.dino.duckWidth : g.dino.width) - 20,
      h: (g.dino.isDucking && !g.dino.isJumping ? g.dino.duckHeight : g.dino.height) - 20,
    };

    for (const o of g.obstacles) {
      const obsHitBox = {
        x: o.x + 5,
        y: o.y - o.height + 5,
        w: o.width - 10,
        h: o.height - 10,
      };

      if (
        hitBox.x < obsHitBox.x + obsHitBox.w &&
        hitBox.x + hitBox.w > obsHitBox.x &&
        hitBox.y < obsHitBox.y + obsHitBox.h &&
        hitBox.y + hitBox.h > obsHitBox.y
      ) {
        g.state = "GAME_OVER";
        setGameState("GAME_OVER");
        if (g.score > highScore) {
          setHighScore(Math.floor(g.score));
        }
        if (onScoreUpdate) onScoreUpdate(g.score, g.distanceRun, true);
        return;
      }
    }

    // Score & Speed
    g.distanceRun += g.speed;
    const newScore = Math.floor(g.distanceRun / 10);
    if (newScore !== Math.floor(g.score)) {
      g.score = newScore;
      if (onScoreUpdate) onScoreUpdate(g.score, g.distanceRun);
      
      const currentHundred = Math.floor(g.score / 100);
      if (currentHundred > g.lastHundred && currentHundred > 0) {
        g.flashTimer = 30; // Frames to flash
        g.lastHundred = currentHundred;
      }
      
      if (g.score % 500 === 0 && g.speed < MAX_SPEED && g.score > 0) {
        g.speed += SPEED_INC;
      }
    }
    if (g.flashTimer > 0) g.flashTimer--;

  }, [highScore, onScoreUpdate]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const g = gameRef.current;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Ground
    ctx.fillStyle = "#3f3f46";
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, 1);
    g.ground.forEach((seg) => {
      let xPos = seg.x - g.groundOffset;
      if (xPos < CANVAS_WIDTH && xPos + seg.len > 0) {
        ctx.fillRect(xPos, GROUND_Y + seg.y * 4, seg.len, 2);
      }
      xPos = seg.x + 1200 - g.groundOffset;
      if (xPos < CANVAS_WIDTH && xPos + seg.len > 0) {
        ctx.fillRect(xPos, GROUND_Y + seg.y * 4, seg.len, 2);
      }
    });

    // Clouds
    g.clouds.forEach((c) => {
      drawSprite(ctx, CLOUD, c.x, c.y, 2, "#52525b");
    });

    // Obstacles
    g.obstacles.forEach((o) => {
      if (o.type === "CACTUS") {
        const sprite = o.isLarge ? CACTUS_LARGE : CACTUS_SMALL;
        const scale = 2;
        const width = (o.isLarge ? 8 : 4) * scale;
        for (let i = 0; i < o.count; i++) {
          drawSprite(ctx, sprite, o.x + i * width * 1.2, o.y - (o.isLarge ? 24 : 20), scale, "#ffffff");
        }
      } else if (o.type === "BIRD") {
        const isWingUp = Math.floor(o.animTimer / 15) % 2 === 0;
        drawSprite(ctx, isWingUp ? BIRD_WING_UP : BIRD_WING_DOWN, o.x, o.y - 18, 2, "#ffffff");
      }
    });

    // Dino
    if (g.state === "IDLE") {
      drawSprite(ctx, DINO_IDLE, g.dino.x, g.dino.y - 36, 2, "#ffffff");
    } else if (g.state === "GAME_OVER") {
      drawSprite(ctx, DINO_IDLE, g.dino.x, g.dino.y - 36, 2, "#ffffff");
      // Could add a dead eye here, but idle sprite is fine
    } else {
      if (g.dino.isJumping) {
        drawSprite(ctx, DINO_IDLE, g.dino.x, g.dino.y - 36, 2, "#ffffff");
      } else if (g.dino.isDucking) {
        const isRun1 = Math.floor(g.dino.animTimer / 10) % 2 === 0;
        drawSprite(ctx, isRun1 ? DINO_DUCK_1 : DINO_DUCK_2, g.dino.x, g.dino.y - 42, 2, "#ffffff");
      } else {
        const isRun1 = Math.floor(g.dino.animTimer / 6) % 2 === 0;
        drawSprite(ctx, isRun1 ? DINO_RUN_1 : DINO_RUN_2, g.dino.x, g.dino.y - 36, 2, "#ffffff");
      }
    }

    // UI Texts
    ctx.font = "20px monospace";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "right";
    
    // Format scores
    const currentScoreStr = Math.floor(g.score).toString().padStart(5, "0");
    const highScoreStr = highScore.toString().padStart(5, "0");

    // Flash effect for milestone
    const shouldDrawScore = g.flashTimer === 0 || Math.floor(g.flashTimer / 5) % 2 === 0;

    if (highScore > 0) {
      ctx.globalAlpha = 0.7;
      ctx.fillText(`HI ${highScoreStr}`, CANVAS_WIDTH - 100, 30);
      ctx.globalAlpha = 1.0;
    }
    
    if (shouldDrawScore) {
      ctx.fillText(currentScoreStr, CANVAS_WIDTH - 20, 30);
    }

    if (g.state === "IDLE") {
      ctx.textAlign = "center";
      ctx.fillText("Tap to Play", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    } else if (g.state === "GAME_OVER") {
      ctx.textAlign = "center";
      ctx.fillText("G A M E   O V E R", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
      ctx.font = "16px monospace";
      ctx.fillText("Tap to Restart", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10);
    }
  }, [highScore]);

  const loop = useCallback(() => {
    update();
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) draw(ctx);
    }
    requestRef.current = requestAnimationFrame(loop);
  }, [update, draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        duck(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowDown") {
        e.preventDefault();
        duck(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp, { passive: false });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [jump, duck]);

  return (
    <div className={`flex flex-col items-center w-full max-w-3xl mx-auto space-y-4 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-auto aspect-[10/3] touch-manipulation block bg-zinc-950"
          onPointerDown={jump}
        />
      </div>

      <div className="flex w-full space-x-4 px-2">
        <button
          className="flex-1 min-h-[56px] bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white font-bold rounded-xl touch-manipulation select-none transition-colors border border-zinc-700"
          onPointerDown={(e) => { e.preventDefault(); jump(); }}
        >
          JUMP
        </button>
        <button
          className="flex-1 min-h-[56px] bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white font-bold rounded-xl touch-manipulation select-none transition-colors border border-zinc-700"
          onPointerDown={(e) => { e.preventDefault(); duck(true); }}
          onPointerUp={(e) => { e.preventDefault(); duck(false); }}
          onPointerLeave={(e) => { e.preventDefault(); duck(false); }}
        >
          DUCK
        </button>
      </div>
    </div>
  );
}
