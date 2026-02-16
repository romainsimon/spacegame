# --- agentskill.sh ---
# slug: neversight/game-engineering-team
# owner: NeverSight
# contentSha:
# installed: 2026-02-16T12:16:09.140Z
# source: https://agentskill.sh/neversight/game-engineering-team
#
# IMPORTANT: After this skill is used for the first time, assess how
# useful and functional it was, then rate it using:
#   /learn feedback neversight/game-engineering-team <1-5> [optional comment]
# Your feedback helps surface the best skills for everyone.
# ---
---
name: game-engineering-team
description: AAA-caliber engineering council for building production-quality games. Use when implementing game systems, writing game code, designing data architecture, building UI components, creating tutorials, optimizing performance, or any technical game development task. Covers game programming patterns, casino/card game implementation, reward systems, game UI engineering, tutorial design, code architecture, data infrastructure, security, and quality assurance. Triggers on requests for game code, system implementation, refactoring, performance optimization, data design, or technical architecture decisions.
---

# Game Engineering Team

A multidisciplinary council of AAA-caliber engineers dedicated to building production-quality game systems for Farming in Purria.

## The Engineering Council

### Core Game Engineers (6)

| Engineer | Specialization | Technical Lens |
|----------|----------------|----------------|
| **Game Systems Architect** | State machines, ECS, core loops | "How do the pieces fit together?" |
| **Casino Logic Engineer** | Probability, RNG, payout systems | "Is the math provably fair?" |
| **Card Game Specialist** | Hand evaluation, deck management | "How do cards flow through states?" |
| **Board/Grid Engineer** | Spatial algorithms, pathfinding | "How does the hex grid compute?" |
| **Progression Engineer** | XP curves, unlock systems, gating | "How does growth feel right?" |
| **Real-Time Systems Lead** | Timing, animation sync, frame budgets | "Does it feel responsive?" |

### UI/UX Engineers (5)

| Engineer | Specialization | Technical Lens |
|----------|----------------|----------------|
| **Game UI Architect** | Component systems, layout engines | "How is the UI structured?" |
| **Interaction Engineer** | Touch, gestures, accessibility | "How do players physically interact?" |
| **Animation Programmer** | Tweens, particles, juice | "Does it feel alive?" |
| **Typography Specialist** | Font rendering, readability, style | "Is text beautiful and readable?" |
| **Responsive Design Lead** | Mobile-first, cross-platform | "Does it work everywhere?" |

### Data & Infrastructure (5)

| Engineer | Specialization | Technical Lens |
|----------|----------------|----------------|
| **Data Architect** | Schema design, relationships, queries | "How is data organized?" |
| **Telemetry Engineer** | Logging, analytics, events | "What do we need to measure?" |
| **Security Engineer** | Auth, validation, anti-cheat | "Is this exploitable?" |
| **Performance Engineer** | Profiling, optimization, budgets | "Will it run on low-end devices?" |
| **DevOps Specialist** | CI/CD, deployment, monitoring | "How do we ship reliably?" |

### Quality & Craft (4)

| Engineer | Specialization | Technical Lens |
|----------|----------------|----------------|
| **Code Quality Lead** | Patterns, refactoring, reviews | "Is this maintainable?" |
| **Technical Writer** | Documentation, comments, APIs | "Can others understand this?" |
| **Test Architect** | Unit, integration, E2E strategies | "How do we verify correctness?" |
| **Tutorial Systems Engineer** | Onboarding flows, contextual help | "How do players learn this?" |

### Integration Specialists (4)

| Engineer | Specialization | Technical Lens |
|----------|----------------|----------------|
| **API Designer** | tRPC, REST, contract design | "How do client and server talk?" |
| **State Management Lead** | Zustand, persistence, sync | "Where does state live?" |
| **Plugin/Mod Architect** | Extensibility, configuration | "Can this be extended safely?" |
| **Cross-System Integrator** | System coupling, event buses | "How do systems communicate?" |

---

## Part I: Core Engineering Principles

### The Engineering Manifesto

```
1. PLAYER FIRST
   Every technical decision serves the player experience.
   60fps on mobile. Instant feedback. No jank.

2. TYPE SAFETY END-TO-END
   From database to UI, types are the contract.
   If it compiles, it should work.

3. EXPLICIT OVER CLEVER
   Readable code beats clever code.
   The next developer is you in 6 months.

4. SMALL, COMPOSABLE PIECES
   Functions do one thing. Components render one thing.
   Composition over inheritance.

5. FAIL FAST, RECOVER GRACEFULLY
   Validate inputs immediately. Handle errors at boundaries.
   Players should never see stack traces.

6. MEASURE EVERYTHING
   If we can't measure it, we can't improve it.
   Telemetry is not optional.

7. OPTIMIZE LAST
   Make it work. Make it right. Make it fast.
   Profile before optimizing.
```

---

## Part II: Game Programming Patterns

### Pattern 1: Finite State Machines (FSM)

**When to Use:** Phase management, UI states, game mode transitions

```typescript
type GamePhase = 'morning' | 'action' | 'resolution' | 'night';

interface PhaseTransitions {
  morning: 'action';
  action: 'resolution';
  resolution: 'night';
  night: 'morning';
}

class GamePhaseMachine {
  private phase: GamePhase = 'morning';

  transition(): void {
    const transitions: Record<GamePhase, GamePhase> = {
      morning: 'action',
      action: 'resolution',
      resolution: 'night',
      night: 'morning',
    };

    this.phase = transitions[this.phase];
    this.onPhaseEnter(this.phase);
  }

  private onPhaseEnter(phase: GamePhase): void {
    // Phase-specific initialization
  }
}
```

### Pattern 2: Command Pattern (Undo/Redo)

**When to Use:** Bet placement, farm actions, any reversible operation

```typescript
interface Command {
  execute(): void;
  undo(): void;
  description: string;
}

class CommandHistory {
  private history: Command[] = [];
  private pointer = -1;

  execute(command: Command): void {
    this.history = this.history.slice(0, this.pointer + 1);
    command.execute();
    this.history.push(command);
    this.pointer++;
  }

  undo(): void {
    if (this.pointer >= 0) {
      this.history[this.pointer].undo();
      this.pointer--;
    }
  }

  redo(): void {
    if (this.pointer < this.history.length - 1) {
      this.pointer++;
      this.history[this.pointer].execute();
    }
  }
}
```

### Pattern 3: Observer Pattern (Event Bus)

**When to Use:** Cross-system communication, triggers, achievements

```typescript
type GameEvent =
  | { type: 'POT_THRESHOLD_REACHED'; potId: string; threshold: number }
  | { type: 'TROUBLE_SPAWNED'; hexId: string; troubleType: string }
  | { type: 'SIMULIN_LEVELED'; simulinId: string; newLevel: number }
  | { type: 'DAY_COMPLETED'; dayNumber: number };

class GameEventBus {
  private handlers = new Map<string, Set<Function>>();

  on<T extends GameEvent['type']>(type: T, handler: Function): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  emit(event: GameEvent): void {
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }
  }
}
```

### Pattern 4: Object Pool (Performance)

**When to Use:** Particles, projectiles, frequently created/destroyed objects

```typescript
class ObjectPool<T> {
  private pool: T[] = [];
  private activeCount = 0;

  constructor(
    private factory: () => T,
    private reset: (obj: T) => void,
    initialSize = 10
  ) {
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    if (this.activeCount >= this.pool.length) {
      this.pool.push(this.factory());
    }
    return this.pool[this.activeCount++];
  }

  release(obj: T): void {
    const index = this.pool.indexOf(obj);
    if (index !== -1 && index < this.activeCount) {
      this.reset(obj);
      [this.pool[index], this.pool[this.activeCount - 1]] =
        [this.pool[this.activeCount - 1], this.pool[index]];
      this.activeCount--;
    }
  }
}
```

### Pattern 5: Strategy Pattern

**When to Use:** AI behaviors, scoring algorithms, difficulty modes

```typescript
interface ScoringStrategy {
  calculateScore(results: any): number;
  getName(): string;
}

class GameScorer {
  constructor(private strategy: ScoringStrategy) {}

  setStrategy(strategy: ScoringStrategy): void {
    this.strategy = strategy;
  }

  score(results: any): number {
    return this.strategy.calculateScore(results);
  }
}
```

---

## Part III: Casino & Card Game Implementation

### Random Number Generation

```typescript
class SeededRNG {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  // Mulberry32 - fast, good distribution
  next(): number {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
```

### Card Deck Management

```typescript
interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
}

class Deck {
  private cards: Card[] = [];
  private discardPile: Card[] = [];

  constructor(private rng: SeededRNG) {
    this.reset();
  }

  reset(): void {
    this.cards = [];
    this.discardPile = [];
    const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
    for (const suit of suits) {
      for (let rank = 1; rank <= 13; rank++) {
        this.cards.push({ suit, rank: rank as Card['rank'] });
      }
    }
    this.shuffle();
  }

  shuffle(): void {
    this.cards = this.rng.shuffle(this.cards);
  }

  draw(count = 1): Card[] {
    if (this.cards.length < count) {
      this.cards = [...this.cards, ...this.rng.shuffle(this.discardPile)];
      this.discardPile = [];
    }
    return this.cards.splice(0, count);
  }

  discard(cards: Card[]): void {
    this.discardPile.push(...cards);
  }

  get remaining(): number {
    return this.cards.length;
  }
}
```

---

## Part IV: UI Engineering Patterns

### Animation Patterns

```typescript
import { motion, AnimatePresence } from 'framer-motion';

const JUICE_VARIANTS = {
  pop: {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0, opacity: 0 },
    transition: { type: 'spring', stiffness: 500, damping: 30 },
  },
  bounce: {
    animate: {
      y: [0, -10, 0],
      transition: { duration: 0.3, times: [0, 0.5, 1] }
    },
  },
  shake: {
    animate: {
      x: [0, -10, 10, -10, 10, 0],
      transition: { duration: 0.4 }
    },
  },
  pulse: {
    animate: {
      scale: [1, 1.05, 1],
      transition: { duration: 0.3, repeat: 2 }
    },
  },
};
```

---

## Part V: Quality Assurance

### Testing Strategy

```typescript
import { describe, it, expect } from 'vitest';

describe('GameSystem', () => {
  it('handles state transitions correctly', () => {
    const machine = new GamePhaseMachine();
    machine.transition();
    expect(machine.phase).toBe('action');
  });
});
```

### Code Review Checklist

- [ ] Logic is correct and handles edge cases
- [ ] No `any` types without justification
- [ ] No unnecessary re-renders
- [ ] User input is validated
- [ ] Functions are small and focused
- [ ] Unit tests for logic
- [ ] Interactive elements are keyboard accessible
