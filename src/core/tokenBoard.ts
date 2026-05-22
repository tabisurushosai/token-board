export interface RewardGoal {
  id: string;
  name: string;
  emoji: string;
  requiredTokens: number;
}

export interface TokenBoardState {
  goals: RewardGoal[];
  selectedGoalId: string;
  earnedTokens: number;
}

export interface TokenBoardStateStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface TokenSlot {
  index: number;
  filled: boolean;
}

export interface TokenBoardView {
  goals: RewardGoal[];
  selectedGoal: RewardGoal;
  earnedTokens: number;
  requiredTokens: number;
  remainingTokens: number;
  slots: TokenSlot[];
}

const defaultGoal: RewardGoal = {
  id: "default-goal",
  name: "ごほうび",
  emoji: "🎁",
  requiredTokens: 10,
};

export const TOKEN_BOARD_STATE_KEY = "tokenBoardState";

export function createInitialTokenBoardState(): TokenBoardState {
  return {
    goals: [defaultGoal],
    selectedGoalId: defaultGoal.id,
    earnedTokens: 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeGoal(value: unknown): RewardGoal | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === "string" && value.id.trim() ? value.id : null;
  const name = typeof value.name === "string" && value.name.trim() ? value.name : null;
  const emoji = typeof value.emoji === "string" && value.emoji.trim() ? value.emoji : null;
  const requiredTokens =
    typeof value.requiredTokens === "number" && Number.isFinite(value.requiredTokens)
      ? Math.floor(value.requiredTokens)
      : null;

  if (!id || !name || !emoji || requiredTokens === null) {
    return null;
  }

  return {
    id,
    name,
    emoji,
    requiredTokens: Math.max(1, requiredTokens),
  };
}

export function normalizeTokenBoardState(value: unknown): TokenBoardState {
  if (!isRecord(value)) {
    return createInitialTokenBoardState();
  }

  const goals = Array.isArray(value.goals) ? value.goals.map(normalizeGoal).filter((goal) => goal !== null) : [];
  if (goals.length === 0) {
    return createInitialTokenBoardState();
  }

  const selectedGoalId =
    typeof value.selectedGoalId === "string" && goals.some((goal) => goal.id === value.selectedGoalId)
      ? value.selectedGoalId
      : goals[0].id;
  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId) ?? goals[0];
  const earnedTokens =
    typeof value.earnedTokens === "number" && Number.isFinite(value.earnedTokens) ? Math.floor(value.earnedTokens) : 0;

  return {
    goals,
    selectedGoalId,
    earnedTokens: Math.min(Math.max(0, earnedTokens), selectedGoal.requiredTokens),
  };
}

export async function loadTokenBoardState(store: TokenBoardStateStore): Promise<TokenBoardState> {
  const savedState = await store.get<unknown>(TOKEN_BOARD_STATE_KEY);
  return normalizeTokenBoardState(savedState);
}

export async function saveTokenBoardState(store: TokenBoardStateStore, state: TokenBoardState): Promise<void> {
  await store.set(TOKEN_BOARD_STATE_KEY, normalizeTokenBoardState(state));
}

export async function removeTokenBoardState(store: TokenBoardStateStore): Promise<void> {
  await store.remove(TOKEN_BOARD_STATE_KEY);
}

export function createTokenBoardView(state: TokenBoardState): TokenBoardView {
  const normalizedState = normalizeTokenBoardState(state);
  const selectedGoal =
    normalizedState.goals.find((goal) => goal.id === normalizedState.selectedGoalId) ??
    normalizedState.goals[0] ??
    defaultGoal;
  const requiredTokens = Math.max(1, selectedGoal.requiredTokens);
  const earnedTokens = Math.min(Math.max(0, normalizedState.earnedTokens), requiredTokens);

  return {
    goals: normalizedState.goals.length > 0 ? normalizedState.goals : [defaultGoal],
    selectedGoal,
    earnedTokens,
    requiredTokens,
    remainingTokens: Math.max(0, requiredTokens - earnedTokens),
    slots: Array.from({ length: requiredTokens }, (_, index) => ({
      index,
      filled: index < earnedTokens,
    })),
  };
}
