"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Play, RotateCcw, ArrowLeft, ArrowRight, ArrowDown, RotateCw, Zap } from "lucide-react";

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 24; // Canvas block size in px

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

const COLORS: Record<string, string> = {
  I: "#00f0f0",
  J: "#0000f0",
  L: "#f0a000",
  O: "#f0f000",
  S: "#00f000",
  T: "#a000f0",
  Z: "#f00000",
};

interface Piece {
  type: keyof typeof SHAPES;
  matrix: number[][];
  x: number;
  y: number;
}

interface TetrisGameProps {
  onScoreUpdate?: (score: number, linesCleared: number) => void;
  disabled?: boolean;
}

export default function TetrisGame({ onScoreUpdate, disabled = false }: TetrisGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // References for game loop state
  const boardRef = useRef<string[][]>(Array.from({ length: ROWS }, () => Array(COLS).fill("")));
  const pieceRef = useRef<Piece | null>(null);
  const nextPieceRef = useRef<Piece | null>(null);
  const scoreRef = useRef(0);
  const linesRef = useRef(0);
  const isPlayingRef = useRef(false);
  const gameOverRef = useRef(false);

  const getRandomPiece = useCallback((): Piece => {
    const types = Object.keys(SHAPES) as (keyof typeof SHAPES)[];
    const type = types[Math.floor(Math.random() * types.length)];
    const matrix = SHAPES[type];
    return {
      type,
      matrix,
      x: Math.floor((COLS - matrix[0].length) / 2),
      y: 0,
    };
  }, []);

  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK_SIZE);
      ctx.lineTo(COLS * BLOCK_SIZE, r * BLOCK_SIZE);
      ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK_SIZE, 0);
      ctx.lineTo(c * BLOCK_SIZE, ROWS * BLOCK_SIZE);
      ctx.stroke();
    }

    // Draw placed blocks
    const board = boardRef.current;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]) {
          ctx.fillStyle = COLORS[board[r][c]] || "#ffffff";
          ctx.fillRect(c * BLOCK_SIZE + 1, r * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
          ctx.fillRect(c * BLOCK_SIZE + 1, r * BLOCK_SIZE + 1, BLOCK_SIZE - 2, 4);
        }
      }
    }

    // Draw current active piece
    const piece = pieceRef.current;
    if (piece) {
      ctx.fillStyle = COLORS[piece.type];
      piece.matrix.forEach((row, r) => {
        row.forEach((value, c) => {
          if (value) {
            const px = (piece.x + c) * BLOCK_SIZE;
            const py = (piece.y + r) * BLOCK_SIZE;
            ctx.fillRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
            ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
            ctx.fillRect(px + 1, py + 1, BLOCK_SIZE - 2, 4);
            ctx.fillStyle = COLORS[piece.type];
          }
        });
      });
    }
  }, []);

  const drawNextPiece = useCallback(() => {
    const canvas = nextCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const next = nextPieceRef.current;
    if (!next) return;

    const size = 16;
    const offsetX = (canvas.width - next.matrix[0].length * size) / 2;
    const offsetY = (canvas.height - next.matrix.length * size) / 2;

    ctx.fillStyle = COLORS[next.type];
    next.matrix.forEach((row, r) => {
      row.forEach((value, c) => {
        if (value) {
          ctx.fillRect(offsetX + c * size + 1, offsetY + r * size + 1, size - 2, size - 2);
        }
      });
    });
  }, []);

  const checkCollision = useCallback((p: Piece, offsetX = 0, offsetY = 0, matrix = p.matrix): boolean => {
    const board = boardRef.current;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          const newX = p.x + c + offsetX;
          const newY = p.y + r + offsetY;

          if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
          if (newY >= 0 && board[newY][newX]) return true;
        }
      }
    }
    return false;
  }, []);

  const mergePiece = useCallback(() => {
    const piece = pieceRef.current;
    if (!piece) return;

    const board = boardRef.current;
    piece.matrix.forEach((row, r) => {
      row.forEach((value, c) => {
        if (value) {
          const boardY = piece.y + r;
          const boardX = piece.x + c;
          if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
            board[boardY][boardX] = piece.type;
          }
        }
      });
    });

    // Check cleared lines
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((cell) => cell !== "")) {
        board.splice(r, 1);
        board.unshift(Array(COLS).fill(""));
        cleared++;
        r++; // check same row index again
      }
    }

    if (cleared > 0) {
      const linePoints = [0, 100, 300, 500, 800];
      const points = linePoints[cleared] || cleared * 200;

      scoreRef.current += points;
      linesRef.current += cleared;

      setScore(scoreRef.current);
      setLines(linesRef.current);
      setLevel(Math.floor(linesRef.current / 10) + 1);

      if (onScoreUpdate) {
        onScoreUpdate(scoreRef.current, linesRef.current);
      }
    }

    // Spawn next piece
    pieceRef.current = nextPieceRef.current || getRandomPiece();
    nextPieceRef.current = getRandomPiece();
    drawNextPiece();

    if (checkCollision(pieceRef.current)) {
      gameOverRef.current = true;
      isPlayingRef.current = false;
      setGameOver(true);
      setIsPlaying(false);
    }
  }, [checkCollision, getRandomPiece, drawNextPiece, onScoreUpdate]);

  const moveLeft = useCallback(() => {
    if (!isPlayingRef.current || !pieceRef.current) return;
    if (!checkCollision(pieceRef.current, -1, 0)) {
      pieceRef.current.x -= 1;
      drawBoard();
    }
  }, [checkCollision, drawBoard]);

  const moveRight = useCallback(() => {
    if (!isPlayingRef.current || !pieceRef.current) return;
    if (!checkCollision(pieceRef.current, 1, 0)) {
      pieceRef.current.x += 1;
      drawBoard();
    }
  }, [checkCollision, drawBoard]);

  const rotate = useCallback(() => {
    if (!isPlayingRef.current || !pieceRef.current) return;
    const piece = pieceRef.current;
    const rotated = piece.matrix[0].map((_, index) => piece.matrix.map((row) => row[index]).reverse());

    if (!checkCollision(piece, 0, 0, rotated)) {
      piece.matrix = rotated;
      drawBoard();
    }
  }, [checkCollision, drawBoard]);

  const drop = useCallback(() => {
    if (!isPlayingRef.current || !pieceRef.current) return;
    if (!checkCollision(pieceRef.current, 0, 1)) {
      pieceRef.current.y += 1;
    } else {
      mergePiece();
    }
    drawBoard();
  }, [checkCollision, mergePiece, drawBoard]);

  const hardDrop = useCallback(() => {
    if (!isPlayingRef.current || !pieceRef.current) return;
    while (!checkCollision(pieceRef.current, 0, 1)) {
      pieceRef.current.y += 1;
      scoreRef.current += 2;
    }
    setScore(scoreRef.current);
    mergePiece();
    drawBoard();
  }, [checkCollision, mergePiece, drawBoard]);

  const startGame = useCallback(() => {
    boardRef.current = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
    scoreRef.current = 0;
    linesRef.current = 0;
    setScore(0);
    setLines(0);
    setLevel(1);

    pieceRef.current = getRandomPiece();
    nextPieceRef.current = getRandomPiece();

    gameOverRef.current = false;
    isPlayingRef.current = true;
    setGameOver(false);
    setIsPlaying(true);

    drawNextPiece();
    drawBoard();

    if (onScoreUpdate) {
      onScoreUpdate(0, 0);
    }
  }, [getRandomPiece, drawNextPiece, drawBoard, onScoreUpdate]);

  // Main game loop
  useEffect(() => {
    if (!isPlaying) return;

    const speed = Math.max(100, 800 - (level - 1) * 70);
    const interval = setInterval(() => {
      if (isPlayingRef.current && !gameOverRef.current) {
        drop();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [isPlaying, level, drop]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlayingRef.current || disabled) return;

      switch (e.key) {
        case "ArrowLeft":
        case "a":
          e.preventDefault();
          moveLeft();
          break;
        case "ArrowRight":
        case "d":
          e.preventDefault();
          moveRight();
          break;
        case "ArrowDown":
        case "s":
          e.preventDefault();
          drop();
          break;
        case "ArrowUp":
        case "w":
        case "r":
          e.preventDefault();
          rotate();
          break;
        case " ":
          e.preventDefault();
          hardDrop();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, moveLeft, moveRight, drop, rotate, hardDrop]);

  return (
    <div className="flex flex-col items-center select-none">
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-zinc-950 p-4 rounded-2xl border border-zinc-800 shadow-2xl">
        {/* Canvas Game Screen */}
        <div className="relative border-2 border-zinc-800 rounded-xl overflow-hidden shadow-inner">
          <canvas
            ref={canvasRef}
            width={COLS * BLOCK_SIZE}
            height={ROWS * BLOCK_SIZE}
            className="block bg-zinc-950"
          />

          {!isPlaying && !gameOver && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center">
              <Zap className="w-12 h-12 text-white mb-2 animate-bounce" />
              <h3 className="text-xl font-bold text-white mb-1">Tetris Arena</h3>
              <p className="text-xs text-zinc-400 mb-4 max-w-[200px]">
                Clear lines to climb the real-time event leaderboard!
              </p>
              <button
                onClick={startGame}
                disabled={disabled}
                className="px-6 py-2.5 bg-white text-black font-extrabold text-sm rounded-xl hover:bg-zinc-200 transition-transform active:scale-95 flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-black" />
                PLAY NOW
              </button>
            </div>
          )}

          {gameOver && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-4 text-center animate-scale-in">
              <h3 className="text-2xl font-black text-red-500 mb-1">GAME OVER</h3>
              <p className="text-sm font-semibold text-zinc-300 mb-1">Score: {score}</p>
              <p className="text-xs text-zinc-500 mb-4">Lines Cleared: {lines}</p>
              <button
                onClick={startGame}
                disabled={disabled}
                className="px-5 py-2 bg-white text-black font-bold text-xs rounded-xl hover:bg-zinc-200 transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Play Again
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Info & Controls */}
        <div className="flex flex-col justify-between h-full min-w-[140px] space-y-4">
          <div className="bg-black/60 p-3 rounded-xl border border-zinc-800 text-center">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block">Next Piece</span>
            <canvas
              ref={nextCanvasRef}
              width={70}
              height={70}
              className="mx-auto mt-1 block rounded bg-zinc-900 border border-zinc-800"
            />
          </div>

          <div className="space-y-2 text-center">
            <div className="bg-black/60 p-2.5 rounded-xl border border-zinc-800">
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">Score</span>
              <span className="text-lg font-black text-white">{score}</span>
            </div>
            <div className="bg-black/60 p-2 rounded-xl border border-zinc-800 flex justify-around">
              <div>
                <span className="text-[9px] uppercase font-bold text-zinc-500 block">Lines</span>
                <span className="text-xs font-bold text-zinc-300">{lines}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-zinc-500 block">Level</span>
                <span className="text-xs font-bold text-zinc-300">{level}</span>
              </div>
            </div>
          </div>

          {/* On-Screen Mobile Touch Controls */}
          <div className="pt-2 border-t border-zinc-800">
            <span className="text-[9px] font-bold text-zinc-500 block text-center mb-1">Controls</span>
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={moveLeft}
                disabled={!isPlaying}
                className="p-2.5 bg-zinc-900 hover:bg-zinc-800 active:scale-90 text-white rounded-lg border border-zinc-800 flex items-center justify-center min-h-[40px]"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                onClick={rotate}
                disabled={!isPlaying}
                className="p-2.5 bg-zinc-900 hover:bg-zinc-800 active:scale-90 text-white rounded-lg border border-zinc-800 flex items-center justify-center min-h-[40px]"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                onClick={moveRight}
                disabled={!isPlaying}
                className="p-2.5 bg-zinc-900 hover:bg-zinc-800 active:scale-90 text-white rounded-lg border border-zinc-800 flex items-center justify-center min-h-[40px]"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1 mt-1">
              <button
                onClick={drop}
                disabled={!isPlaying}
                className="p-2 bg-zinc-900 hover:bg-zinc-800 active:scale-90 text-white rounded-lg border border-zinc-800 flex items-center justify-center text-xs font-bold min-h-[36px]"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <button
                onClick={hardDrop}
                disabled={!isPlaying}
                className="p-2 bg-white text-black hover:bg-zinc-200 active:scale-90 rounded-lg text-[10px] font-black uppercase min-h-[36px]"
              >
                DROP
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
