import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { 
  RotateCcw, 
  Moon, 
  Sun, 
  Volume2, 
  VolumeX, 
  BarChart3, 
  Settings,
  Play,
  Pause,
  Grid3X3,
  Sparkles,
  X
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
type TileValue = 0 | 2 | 4 | 8 | 16 | 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096 | 8192;
type GridSize = 4 | 5 | 6;
type Direction = 'up' | 'down' | 'left' | 'right';

interface Tile {
  id: number;
  value: TileValue;
  row: number;
  col: number;
  isNew?: boolean;
  isMerged?: boolean;
}

interface Statistics {
  gamesPlayed: number;
  totalScore: number;
  highestTile: number;
  wins: number;
}

// Sound effects using Web Audio API
class SoundManager {
  private audioContext: AudioContext | null = null;
  private isMuted = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine') {
    if (this.isMuted || !this.audioContext) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  playMerge() {
    this.playTone(440, 0.15, 'sine');
    setTimeout(() => this.playTone(554, 0.1, 'sine'), 50);
  }

  playMove() {
    this.playTone(220, 0.05, 'triangle');
  }

  playWin() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.3, 'sine'), i * 100);
    });
  }

  playGameOver() {
    const notes = [440, 349, 294, 220];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.4, 'sawtooth'), i * 150);
    });
  }

  playSpawn() {
    this.playTone(880, 0.08, 'sine');
  }
}

const soundManager = new SoundManager();

// Haptic feedback
const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    const patterns = {
      light: 10,
      medium: 20,
      heavy: 30
    };
    navigator.vibrate(patterns[type]);
  }
};

// Tile colors with gradients
const getTileStyles = (value: TileValue, isDark: boolean): string => {
  const styles: Record<TileValue, string> = {
    0: 'bg-transparent',
    2: isDark 
      ? 'bg-gradient-to-br from-slate-700 to-slate-600 text-slate-200 shadow-[0_0_20px_rgba(148,163,184,0.2)]'
      : 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 shadow-[0_0_20px_rgba(148,163,184,0.3)]',
    4: isDark
      ? 'bg-gradient-to-br from-slate-600 to-slate-500 text-slate-200 shadow-[0_0_25px_rgba(148,163,184,0.3)]'
      : 'bg-gradient-to-br from-slate-200 to-slate-300 text-slate-700 shadow-[0_0_25px_rgba(148,163,184,0.35)]',
    8: isDark
      ? 'bg-gradient-to-br from-orange-600 to-orange-500 text-white shadow-[0_0_30px_rgba(249,115,22,0.4)]'
      : 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-[0_0_30px_rgba(249,115,22,0.4)]',
    16: isDark
      ? 'bg-gradient-to-br from-orange-500 to-orange-400 text-white shadow-[0_0_35px_rgba(251,146,60,0.45)]'
      : 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-[0_0_35px_rgba(251,146,60,0.45)]',
    32: isDark
      ? 'bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-[0_0_40px_rgba(239,68,68,0.5)]'
      : 'bg-gradient-to-br from-red-500 to-orange-600 text-white shadow-[0_0_40px_rgba(239,68,68,0.5)]',
    64: isDark
      ? 'bg-gradient-to-br from-red-600 to-red-500 text-white shadow-[0_0_45px_rgba(220,38,38,0.55)]'
      : 'bg-gradient-to-br from-red-600 to-red-700 text-white shadow-[0_0_45px_rgba(220,38,38,0.55)]',
    128: isDark
      ? 'bg-gradient-to-br from-yellow-500 to-amber-500 text-white shadow-[0_0_50px_rgba(234,179,8,0.6)]'
      : 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-[0_0_50px_rgba(234,179,8,0.6)]',
    256: isDark
      ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white shadow-[0_0_55px_rgba(250,204,21,0.65)]'
      : 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-slate-900 shadow-[0_0_55px_rgba(250,204,21,0.65)]',
    512: isDark
      ? 'bg-gradient-to-br from-amber-400 to-yellow-400 text-white shadow-[0_0_60px_rgba(251,191,36,0.7)]'
      : 'bg-gradient-to-br from-amber-300 to-amber-500 text-slate-900 shadow-[0_0_60px_rgba(251,191,36,0.7)]',
    1024: isDark
      ? 'bg-gradient-to-br from-amber-300 to-yellow-300 text-slate-900 shadow-[0_0_65px_rgba(252,211,77,0.75)]'
      : 'bg-gradient-to-br from-amber-200 to-amber-400 text-slate-900 shadow-[0_0_65px_rgba(252,211,77,0.75)]',
    2048: isDark
      ? 'bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 text-white shadow-[0_0_70px_rgba(168,85,247,0.8)] animate-pulse'
      : 'bg-gradient-to-br from-violet-400 via-fuchsia-400 to-pink-400 text-white shadow-[0_0_70px_rgba(168,85,247,0.8)] animate-pulse',
    4096: isDark
      ? 'bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-600 text-white shadow-[0_0_75px_rgba(192,38,211,0.85)]'
      : 'bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-500 text-white shadow-[0_0_75px_rgba(192,38,211,0.85)]',
    8192: isDark
      ? 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-[0_0_80px_rgba(16,185,129,0.9)]'
      : 'bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-400 text-white shadow-[0_0_80px_rgba(16,185,129,0.9)]',
  };
  return styles[value] || styles[2];
};

// Particle component for background effects
const Particle: React.FC<{ delay: number; isDark: boolean }> = ({ delay, isDark }) => {
  const style = useMemo(() => ({
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    animationDelay: `${delay}s`,
    animationDuration: `${15 + Math.random() * 10}s`,
  }), [delay]);

  return (
    <div
      className={cn(
        "absolute w-2 h-2 rounded-full opacity-20 animate-float pointer-events-none",
        isDark ? "bg-white" : "bg-slate-900"
      )}
      style={style}
    />
  );
};

// Tile Component
interface TileComponentProps {
  tile: Tile;
  gridSize: GridSize;
  isDark: boolean;
}

const TileComponent: React.FC<TileComponentProps> = ({ tile, gridSize, isDark }) => {
  const cellSize = gridSize === 4 ? 72 : gridSize === 5 ? 56 : 48;
  const gap = 12;
  
  const position = {
    transform: `translate(${tile.col * (cellSize + gap)}px, ${tile.row * (cellSize + gap)}px)`,
  };

  const fontSize = tile.value >= 1000 
    ? '1.1rem' 
    : tile.value >= 100 
      ? '1.3rem' 
      : '1.6rem';

  return (
    <div
      className={cn(
        "absolute rounded-xl flex items-center justify-center font-bold transition-all duration-150 ease-out",
        getTileStyles(tile.value, isDark),
        tile.isNew && "animate-tile-spawn",
        tile.isMerged && "animate-tile-merge",
        "backdrop-blur-sm"
      )}
      style={{
        ...position,
        width: cellSize,
        height: cellSize,
        fontSize,
        zIndex: tile.isMerged ? 20 : tile.isNew ? 15 : 10,
      }}
    >
      {tile.value !== 0 && tile.value}
    </div>
  );
};

// Game Board Component
interface GameBoardProps {
  tiles: Tile[];
  gridSize: GridSize;
  isDark: boolean;
  onSwipe: (direction: Direction) => void;
  isProcessing: boolean;
}

const GameBoard: React.FC<GameBoardProps> = ({ tiles, gridSize, isDark, onSwipe, isProcessing }) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const touchStartTime = useRef<number>(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
    touchStartTime.current = Date.now();
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current || isProcessing) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    const deltaTime = Date.now() - touchStartTime.current;
    
    // Minimum swipe distance and maximum time for a swipe
    const minSwipeDistance = 30;
    const maxSwipeTime = 300;
    
    if (deltaTime > maxSwipeTime) return;
    
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    if (Math.max(absX, absY) < minSwipeDistance) return;
    
    e.preventDefault();
    
    if (absX > absY) {
      onSwipe(deltaX > 0 ? 'right' : 'left');
    } else {
      onSwipe(deltaY > 0 ? 'down' : 'up');
    }
    
    touchStart.current = null;
  }, [onSwipe, isProcessing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Prevent scrolling while playing
    if (touchStart.current) {
      e.preventDefault();
    }
  }, []);

  const cellSize = gridSize === 4 ? 72 : gridSize === 5 ? 56 : 48;
  const gap = 12;
  const boardSize = cellSize * gridSize + gap * (gridSize - 1);

  // Render empty grid cells
  const renderGrid = () => {
    const cells = [];
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        cells.push(
          <div
            key={`cell-${row}-${col}`}
            className={cn(
              "rounded-xl",
              isDark ? "bg-white/5" : "bg-slate-900/5"
            )}
            style={{
              width: cellSize,
              height: cellSize,
            }}
          />
        );
      }
    }
    return cells;
  };

  return (
    <div
      ref={boardRef}
      className={cn(
        "relative rounded-2xl p-3 touch-none select-none",
        isDark 
          ? "bg-white/10 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50" 
          : "bg-white/70 backdrop-blur-xl border border-white/50 shadow-2xl shadow-slate-300/50"
      )}
      style={{
        width: boardSize + 24,
        height: boardSize + 24,
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      {/* Grid background */}
      <div 
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${gridSize}, ${cellSize}px)`,
        }}
      >
        {renderGrid()}
      </div>
      
      {/* Tiles container */}
      <div className="absolute inset-3">
        {tiles.map((tile) => (
          <TileComponent 
            key={tile.id} 
            tile={tile} 
            gridSize={gridSize}
            isDark={isDark}
          />
        ))}
      </div>
    </div>
  );
};

// Modal Component
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  isDark: boolean;
  showCloseButton?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, isDark, showCloseButton = true }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div 
        className={cn(
          "relative w-full max-w-sm rounded-2xl p-6 animate-modal-enter",
          isDark 
            ? "bg-slate-900/95 border border-white/10 shadow-2xl" 
            : "bg-white/95 border border-slate-200 shadow-2xl"
        )}
      >
        {showCloseButton && (
          <button
            onClick={onClose}
            className={cn(
              "absolute top-4 right-4 p-1 rounded-lg transition-colors",
              isDark ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-100 text-slate-500"
            )}
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <h2 className={cn(
          "text-2xl font-bold mb-4",
          isDark ? "text-white" : "text-slate-900"
        )}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
};

// Main App Component
export default function App() {
  // Game state
  const [gridSize, setGridSize] = useState<GridSize>(4);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [hasWon, setHasWon] = useState(false);
  const [canContinue, setCanContinue] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [history, setHistory] = useState<{ tiles: Tile[]; score: number }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // UI state
  const [isDark, setIsDark] = useState(true);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [showWinModal, setShowWinModal] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  
  // Statistics
  const [statistics, setStatistics] = useState<Statistics>({
    gamesPlayed: 0,
    totalScore: 0,
    highestTile: 0,
    wins: 0,
  });

  // Tile ID counter
  const tileIdCounter = useRef(0);

  // Load saved data
  useEffect(() => {
    const savedBestScore = localStorage.getItem('2048-best-score');
    const savedStats = localStorage.getItem('2048-stats');
    const savedTheme = localStorage.getItem('2048-theme');
    const savedSound = localStorage.getItem('2048-sound');
    
    if (savedBestScore) setBestScore(parseInt(savedBestScore, 10));
    if (savedStats) setStatistics(JSON.parse(savedStats));
    if (savedTheme) setIsDark(savedTheme === 'dark');
    if (savedSound) setIsSoundOn(savedSound === 'on');
  }, []);

  // Save best score
  useEffect(() => {
    localStorage.setItem('2048-best-score', bestScore.toString());
  }, [bestScore]);

  // Save statistics
  useEffect(() => {
    localStorage.setItem('2048-stats', JSON.stringify(statistics));
  }, [statistics]);

  // Save theme preference
  useEffect(() => {
    localStorage.setItem('2048-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Save sound preference
  useEffect(() => {
    localStorage.setItem('2048-sound', isSoundOn ? 'on' : 'off');
    soundManager.setMuted(!isSoundOn);
  }, [isSoundOn]);

  // Initialize game
  const initializeGame = useCallback(() => {
    tileIdCounter.current = 0;
    const initialTiles: Tile[] = [];
    
    // Add two random tiles
    for (let i = 0; i < 2; i++) {
      const emptyCells = [];
      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          if (!initialTiles.find(t => t.row === row && t.col === col)) {
            emptyCells.push({ row, col });
          }
        }
      }
      
      if (emptyCells.length > 0) {
        const { row, col } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        initialTiles.push({
          id: tileIdCounter.current++,
          value: Math.random() < 0.9 ? 2 : 4 as TileValue,
          row,
          col,
          isNew: true,
        });
      }
    }
    
    setTiles(initialTiles);
    setScore(0);
    setHasWon(false);
    setCanContinue(false);
    setIsGameOver(false);
    setShowWinModal(false);
    setShowGameOverModal(false);
    setHistory([]);
  }, [gridSize]);

  // Start new game on mount and when grid size changes
  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  // Check for win
  useEffect(() => {
    const has2048 = tiles.some(tile => tile.value === 2048);
    if (has2048 && !hasWon && !canContinue) {
      setHasWon(true);
      setShowWinModal(true);
      soundManager.playWin();
      triggerHaptic('heavy');
      
      // Confetti celebration
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FFA500', '#FF6347', '#9370DB', '#00CED1'],
      });
      
      setStatistics(prev => ({
        ...prev,
        wins: prev.wins + 1,
      }));
    }
  }, [tiles, hasWon, canContinue]);

  // Check for game over
  useEffect(() => {
    if (tiles.length === 0 || isGameOver) return;
    
    const hasEmptyCell = tiles.length < gridSize * gridSize;
    if (hasEmptyCell) return;
    
    // Check for possible merges
    const hasPossibleMove = tiles.some(tile => {
      const directions = [
        { row: tile.row - 1, col: tile.col },
        { row: tile.row + 1, col: tile.col },
        { row: tile.row, col: tile.col - 1 },
        { row: tile.row, col: tile.col + 1 },
      ];
      
      return directions.some(({ row, col }) => {
        if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) return false;
        const neighbor = tiles.find(t => t.row === row && t.col === col);
        return neighbor && neighbor.value === tile.value;
      });
    });
    
    if (!hasPossibleMove && !hasEmptyCell) {
      setIsGameOver(true);
      setShowGameOverModal(true);
      soundManager.playGameOver();
      triggerHaptic('heavy');
      
      // Update statistics
      const maxTile = Math.max(...tiles.map(t => t.value), 0);
      setStatistics(prev => ({
        ...prev,
        gamesPlayed: prev.gamesPlayed + 1,
        totalScore: prev.totalScore + score,
        highestTile: Math.max(prev.highestTile, maxTile),
      }));
    }
  }, [tiles, gridSize, isGameOver, score]);

  // Update best score
  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
    }
  }, [score, bestScore]);

  // Get empty cells
  const getEmptyCells = useCallback((currentTiles: Tile[]) => {
    const emptyCells = [];
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        if (!currentTiles.find(t => t.row === row && t.col === col)) {
          emptyCells.push({ row, col });
        }
      }
    }
    return emptyCells;
  }, [gridSize]);

  // Spawn new tile
  const spawnTile = useCallback((currentTiles: Tile[]) => {
    const emptyCells = getEmptyCells(currentTiles);
    if (emptyCells.length === 0) return currentTiles;
    
    const { row, col } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const newTile: Tile = {
      id: tileIdCounter.current++,
      value: Math.random() < 0.9 ? 2 : 4 as TileValue,
      row,
      col,
      isNew: true,
    };
    
    soundManager.playSpawn();
    return [...currentTiles, newTile];
  }, [getEmptyCells]);

  // Move and merge tiles
  const moveTiles = useCallback((direction: Direction) => {
    if (isProcessing || isGameOver || (hasWon && !canContinue)) return;
    
    setIsProcessing(true);
    
    // Save state for undo
    setHistory(prev => [...prev.slice(-10), { tiles: [...tiles], score }]);
    
    let newTiles: Tile[] = [];
    let moved = false;
    let newScore = score;
    
    const getRow = (row: number) => tiles.filter(t => t.row === row).sort((a, b) => a.col - b.col);
    const getCol = (col: number) => tiles.filter(t => t.col === col).sort((a, b) => a.row - b.row);
    
    const processLine = (line: Tile[], isReverse: boolean) => {
      const filtered = line.filter(t => t.value !== 0);
      if (isReverse) filtered.reverse();
      
      const result: Tile[] = [];
      let i = 0;
      
      while (i < filtered.length) {
        const current = filtered[i];
        const next = filtered[i + 1];
        
        if (next && current.value === next.value) {
          const mergedValue = (current.value * 2) as TileValue;
          result.push({
            ...current,
            value: mergedValue,
            isMerged: true,
          });
          newScore += mergedValue;
          i += 2;
          
          soundManager.playMerge();
          triggerHaptic('medium');
        } else {
          result.push(current);
          i++;
        }
      }
      
      if (isReverse) result.reverse();
      return result;
    };
    
    const updatePositions = (line: Tile[], index: number, isCol: boolean) => {
      line.forEach((tile, i) => {
        const newTile = { ...tile, isNew: false, isMerged: false };
        if (isCol) {
          newTile.col = index;
          newTile.row = direction === 'up' ? i : gridSize - 1 - i;
        } else {
          newTile.row = index;
          newTile.col = direction === 'left' ? i : gridSize - 1 - i;
        }
        
        const oldTile = tiles.find(t => t.id === tile.id);
        if (oldTile && (oldTile.row !== newTile.row || oldTile.col !== newTile.col)) {
          moved = true;
        }
        
        newTiles.push(newTile);
      });
    };
    
    if (direction === 'left' || direction === 'right') {
      for (let row = 0; row < gridSize; row++) {
        const line = getRow(row);
        const processed = processLine(line, direction === 'right');
        updatePositions(processed, row, false);
      }
    } else {
      for (let col = 0; col < gridSize; col++) {
        const line = getCol(col);
        const processed = processLine(line, direction === 'down');
        updatePositions(processed, col, true);
      }
    }
    
    if (moved) {
      setTiles(spawnTile(newTiles));
      setScore(newScore);
      soundManager.playMove();
      triggerHaptic('light');
    }
    
    // Delay to allow animations
    setTimeout(() => {
      setIsProcessing(false);
      // Clear isNew and isMerged flags
      setTiles(prev => prev.map(t => ({ ...t, isNew: false, isMerged: false })));
    }, 150);
  }, [tiles, score, isProcessing, isGameOver, hasWon, canContinue, gridSize, spawnTile]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          moveTiles('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          moveTiles('down');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          moveTiles('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          moveTiles('right');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveTiles]);

  // Undo last move
  const handleUndo = () => {
    if (history.length === 0 || isProcessing) return;
    
    const previousState = history[history.length - 1];
    setTiles(previousState.tiles);
    setScore(previousState.score);
    setHistory(prev => prev.slice(0, -1));
    triggerHaptic('light');
  };

  // Continue playing after win
  const handleContinue = () => {
    setCanContinue(true);
    setShowWinModal(false);
  };

  // AI Autoplay
  useEffect(() => {
    if (!isAutoPlaying || isGameOver || (hasWon && !canContinue)) return;
    
    const directions: Direction[] = ['up', 'right', 'down', 'left'];
    const interval = setInterval(() => {
      const randomDirection = directions[Math.floor(Math.random() * directions.length)];
      moveTiles(randomDirection);
    }, 200);
    
    return () => clearInterval(interval);
  }, [isAutoPlaying, isGameOver, hasWon, canContinue, moveTiles]);

  // Background particles
  const particles = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => (
      <Particle key={i} delay={i * 0.5} isDark={isDark} />
    ));
  }, [isDark]);

  return (
    <div 
      className={cn(
        "min-h-screen transition-colors duration-500 overflow-x-hidden",
        isDark 
          ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" 
          : "bg-gradient-to-br from-slate-50 via-white to-slate-100"
      )}
    >
      {/* Background particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {particles}
      </div>

      <div className="relative min-h-screen flex flex-col items-center justify-center p-4">
        {/* Header */}
        <div className="w-full max-w-md mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className={cn(
              "text-5xl font-black tracking-tighter",
              isDark 
                ? "text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400"
                : "text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-slate-700 to-slate-600"
            )}>
              2048
            </h1>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSoundOn(!isSoundOn)}
                className={cn(
                  "p-2.5 rounded-xl transition-all duration-200",
                  isDark 
                    ? "bg-white/10 hover:bg-white/20 text-slate-300" 
                    : "bg-white hover:bg-slate-100 text-slate-600 shadow-sm"
                )}
                aria-label={isSoundOn ? 'Mute sound' : 'Unmute sound'}
              >
                {isSoundOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
              
              <button
                onClick={() => setIsDark(!isDark)}
                className={cn(
                  "p-2.5 rounded-xl transition-all duration-200",
                  isDark 
                    ? "bg-white/10 hover:bg-white/20 text-slate-300" 
                    : "bg-white hover:bg-slate-100 text-slate-600 shadow-sm"
                )}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              
              <button
                onClick={() => setShowSettings(true)}
                className={cn(
                  "p-2.5 rounded-xl transition-all duration-200",
                  isDark 
                    ? "bg-white/10 hover:bg-white/20 text-slate-300" 
                    : "bg-white hover:bg-slate-100 text-slate-600 shadow-sm"
                )}
                aria-label="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Score board */}
          <div className="flex gap-3">
            <div className={cn(
              "flex-1 rounded-xl p-3 text-center",
              isDark 
                ? "bg-white/10 backdrop-blur-sm border border-white/10" 
                : "bg-white/70 backdrop-blur-sm border border-white/50 shadow-sm"
            )}>
              <div className={cn("text-xs font-medium uppercase tracking-wider mb-1", isDark ? "text-slate-400" : "text-slate-500")}>
                Score
              </div>
              <div className={cn("text-2xl font-bold", isDark ? "text-white" : "text-slate-900")}>
                {score.toLocaleString()}
              </div>
            </div>
            
            <div className={cn(
              "flex-1 rounded-xl p-3 text-center",
              isDark 
                ? "bg-white/10 backdrop-blur-sm border border-white/10" 
                : "bg-white/70 backdrop-blur-sm border border-white/50 shadow-sm"
            )}>
              <div className={cn("text-xs font-medium uppercase tracking-wider mb-1", isDark ? "text-slate-400" : "text-slate-500")}>
                Best
              </div>
              <div className={cn("text-2xl font-bold", isDark ? "text-white" : "text-slate-900")}>
                {bestScore.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="w-full max-w-md flex gap-3 mb-4">
          <button
            onClick={initializeGame}
            className={cn(
              "flex-1 py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2",
              isDark 
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-900/30"
                : "bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 text-white shadow-lg shadow-violet-500/30"
            )}
          >
            <RotateCcw className="w-4 h-4" />
            New Game
          </button>
          
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className={cn(
              "py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center",
              history.length === 0 && "opacity-50 cursor-not-allowed",
              isDark 
                ? "bg-white/10 hover:bg-white/20 text-white" 
                : "bg-white hover:bg-slate-100 text-slate-700 shadow-sm"
            )}
            aria-label="Undo last move"
          >
            Undo
          </button>
          
          <button
            onClick={() => setShowStats(true)}
            className={cn(
              "py-3 px-4 rounded-xl font-semibold transition-all duration-200",
              isDark 
                ? "bg-white/10 hover:bg-white/20 text-white" 
                : "bg-white hover:bg-slate-100 text-slate-700 shadow-sm"
            )}
            aria-label="View statistics"
          >
            <BarChart3 className="w-5 h-5" />
          </button>
        </div>

        {/* Game Board */}
        <GameBoard
          tiles={tiles}
          gridSize={gridSize}
          isDark={isDark}
          onSwipe={moveTiles}
          isProcessing={isProcessing}
        />

        {/* Instructions */}
        <p className={cn(
          "mt-6 text-sm text-center max-w-xs",
          isDark ? "text-slate-400" : "text-slate-500"
        )}>
          Use arrow keys or WASD on desktop. Swipe to play on mobile.
        </p>

        {/* Auto-play indicator */}
        {isAutoPlaying && (
          <div className={cn(
            "mt-4 px-4 py-2 rounded-full text-sm font-medium animate-pulse",
            isDark 
              ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
              : "bg-violet-100 text-violet-700 border border-violet-200"
          )}>
            <Sparkles className="w-4 h-4 inline mr-2" />
            AI Autoplay Active
          </div>
        )}
      </div>

      {/* Win Modal */}
      <Modal
        isOpen={showWinModal}
        onClose={() => setShowWinModal(false)}
        title="🎉 You Win!"
        isDark={isDark}
        showCloseButton={false}
      >
        <p className={cn("mb-6", isDark ? "text-slate-300" : "text-slate-600")}>
          Congratulations! You reached <span className="font-bold text-amber-500">2048</span>!
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleContinue}
            className={cn(
              "flex-1 py-3 px-4 rounded-xl font-semibold transition-all duration-200",
              isDark 
                ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white"
                : "bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-white"
            )}
          >
            Continue Playing
          </button>
          <button
            onClick={initializeGame}
            className={cn(
              "flex-1 py-3 px-4 rounded-xl font-semibold transition-all duration-200",
              isDark 
                ? "bg-white/10 hover:bg-white/20 text-white" 
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            )}
          >
            New Game
          </button>
        </div>
      </Modal>

      {/* Game Over Modal */}
      <Modal
        isOpen={showGameOverModal}
        onClose={() => setShowGameOverModal(false)}
        title="Game Over"
        isDark={isDark}
        showCloseButton={false}
      >
        <p className={cn("mb-6", isDark ? "text-slate-300" : "text-slate-600")}>
          No more moves available. Final score: <span className="font-bold">{score.toLocaleString()}</span>
        </p>
        <button
          onClick={initializeGame}
          className={cn(
            "w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200",
            isDark 
              ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white"
              : "bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 text-white"
          )}
        >
          Try Again
        </button>
      </Modal>

      {/* Statistics Modal */}
      <Modal
        isOpen={showStats}
        onClose={() => setShowStats(false)}
        title="Statistics"
        isDark={isDark}
      >
        <div className={cn("space-y-4", isDark ? "text-slate-300" : "text-slate-600")}>
          <div className={cn(
            "flex justify-between items-center p-3 rounded-xl",
            isDark ? "bg-white/5" : "bg-slate-50"
          )}>
            <span>Games Played</span>
            <span className={cn("font-bold text-lg", isDark ? "text-white" : "text-slate-900")}>
              {statistics.gamesPlayed}
            </span>
          </div>
          <div className={cn(
            "flex justify-between items-center p-3 rounded-xl",
            isDark ? "bg-white/5" : "bg-slate-50"
          )}>
            <span>Games Won</span>
            <span className={cn("font-bold text-lg", isDark ? "text-white" : "text-slate-900")}>
              {statistics.wins}
            </span>
          </div>
          <div className={cn(
            "flex justify-between items-center p-3 rounded-xl",
            isDark ? "bg-white/5" : "bg-slate-50"
          )}>
            <span>Highest Tile</span>
            <span className={cn("font-bold text-lg", isDark ? "text-white" : "text-slate-900")}>
              {statistics.highestTile || '-'}
            </span>
          </div>
          <div className={cn(
            "flex justify-between items-center p-3 rounded-xl",
            isDark ? "bg-white/5" : "bg-slate-50"
          )}>
            <span>Total Score</span>
            <span className={cn("font-bold text-lg", isDark ? "text-white" : "text-slate-900")}>
              {statistics.totalScore.toLocaleString()}
            </span>
          </div>
        </div>
      </Modal>

      {/* Settings Modal */}
      <Modal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Settings"
        isDark={isDark}
      >
        <div className="space-y-6">
          {/* Grid Size */}
          <div>
            <label className={cn("block text-sm font-medium mb-3", isDark ? "text-slate-300" : "text-slate-600")}>
              Grid Size
            </label>
            <div className="flex gap-2">
              {[4, 5, 6].map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    setGridSize(size as GridSize);
                    setShowSettings(false);
                  }}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2",
                    gridSize === size
                      ? isDark
                        ? "bg-violet-600 text-white"
                        : "bg-violet-500 text-white"
                      : isDark
                        ? "bg-white/10 text-slate-300 hover:bg-white/20"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  <Grid3X3 className="w-4 h-4" />
                  {size}x{size}
                </button>
              ))}
            </div>
          </div>

          {/* AI Autoplay */}
          <div>
            <label className={cn("block text-sm font-medium mb-3", isDark ? "text-slate-300" : "text-slate-600")}>
              AI Autoplay Demo
            </label>
            <button
              onClick={() => {
                setIsAutoPlaying(!isAutoPlaying);
                if (!isAutoPlaying) {
                  initializeGame();
                }
              }}
              className={cn(
                "w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2",
                isAutoPlaying
                  ? isDark
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-red-100 text-red-600 border border-red-200"
                  : isDark
                    ? "bg-white/10 hover:bg-white/20 text-white"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              )}
            >
              {isAutoPlaying ? (
                <><Pause className="w-4 h-4" /> Stop AI</>
              ) : (
                <><Play className="w-4 h-4" /> Start AI Demo</>
              )}
            </button>
          </div>

          {/* Reset Statistics */}
          <button
            onClick={() => {
              setStatistics({ gamesPlayed: 0, totalScore: 0, highestTile: 0, wins: 0 });
              setBestScore(0);
              localStorage.removeItem('2048-best-score');
              localStorage.removeItem('2048-stats');
              setShowSettings(false);
            }}
            className={cn(
              "w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200",
              isDark 
                ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                : "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
            )}
          >
            Reset All Statistics
          </button>
        </div>
      </Modal>

      {/* CSS Animations */}
      <style>{`
        @keyframes tile-spawn {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes tile-merge {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.15);
          }
          100% {
            transform: scale(1);
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
          }
          25% {
            transform: translateY(-20px) translateX(10px);
          }
          50% {
            transform: translateY(-10px) translateX(-10px);
          }
          75% {
            transform: translateY(-30px) translateX(5px);
          }
        }
        
        @keyframes modal-enter {
          0% {
            opacity: 0;
            transform: scale(0.9);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-tile-spawn {
          animation: tile-spawn 0.2s ease-out forwards;
        }
        
        .animate-tile-merge {
          animation: tile-merge 0.15s ease-out;
        }
        
        .animate-float {
          animation: float 20s ease-in-out infinite;
        }
        
        .animate-modal-enter {
          animation: modal-enter 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
