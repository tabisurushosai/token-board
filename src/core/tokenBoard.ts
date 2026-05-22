export interface RewardGoal {
  id: string;
  name: string;
  emoji: string;
  requiredTokens: number;
}

export interface RewardGoalDraft {
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
  canExchange: boolean;
  slots: TokenSlot[];
}

const defaultGoal: RewardGoal = {
  id: "default-goal",
  name: "ごほうび",
  emoji: "🎁",
  requiredTokens: 10,
};

export const TOKEN_BOARD_STATE_KEY = "tokenBoardState";
const MAX_REQUIRED_TOKENS = 50;

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
    requiredTokens: clampRequiredTokens(requiredTokens),
  };
}

function clampRequiredTokens(value: number): number {
  return Math.min(MAX_REQUIRED_TOKENS, Math.max(1, value));
}

function normalizeGoalDraft(draft: RewardGoalDraft): RewardGoalDraft | null {
  const name = draft.name.trim();
  const emoji = draft.emoji.trim();
  const requiredTokens = Number.isFinite(draft.requiredTokens) ? Math.floor(draft.requiredTokens) : null;

  if (!name || !emoji || requiredTokens === null) {
    return null;
  }

  return {
    name,
    emoji,
    requiredTokens: clampRequiredTokens(requiredTokens),
  };
}

function createNextGoalId(goals: RewardGoal[]): string {
  const usedIds = new Set(goals.map((goal) => goal.id));
  let index = goals.length + 1;
  let id = `goal-${index}`;

  while (usedIds.has(id)) {
    index += 1;
    id = `goal-${index}`;
  }

  return id;
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

export function addRewardGoal(state: TokenBoardState, draft: RewardGoalDraft): TokenBoardState {
  const normalizedState = normalizeTokenBoardState(state);
  const normalizedDraft = normalizeGoalDraft(draft);

  if (!normalizedDraft) {
    throw new Error("Goal name, emoji, and required tokens are required.");
  }

  const goal: RewardGoal = {
    id: createNextGoalId(normalizedState.goals),
    ...normalizedDraft,
  };

  return {
    goals: [...normalizedState.goals, goal],
    selectedGoalId: goal.id,
    earnedTokens: 0,
  };
}

export function updateRewardGoal(state: TokenBoardState, goalId: string, draft: RewardGoalDraft): TokenBoardState {
  const normalizedState = normalizeTokenBoardState(state);
  const normalizedDraft = normalizeGoalDraft(draft);

  if (!normalizedDraft) {
    throw new Error("Goal name, emoji, and required tokens are required.");
  }

  const goals = normalizedState.goals.map((goal) =>
    goal.id === goalId
      ? {
          ...goal,
          ...normalizedDraft,
        }
      : goal,
  );
  const selectedGoal = goals.find((goal) => goal.id === normalizedState.selectedGoalId) ?? goals[0];

  return normalizeTokenBoardState({
    goals,
    selectedGoalId: normalizedState.selectedGoalId,
    earnedTokens:
      selectedGoal.id === normalizedState.selectedGoalId
        ? Math.min(normalizedState.earnedTokens, selectedGoal.requiredTokens)
        : normalizedState.earnedTokens,
  });
}

export function deleteRewardGoal(state: TokenBoardState, goalId: string): TokenBoardState {
  const normalizedState = normalizeTokenBoardState(state);

  if (normalizedState.goals.length <= 1) {
    return normalizedState;
  }

  const goals = normalizedState.goals.filter((goal) => goal.id !== goalId);
  const selectedGoalId =
    normalizedState.selectedGoalId === goalId ? (goals[0]?.id ?? defaultGoal.id) : normalizedState.selectedGoalId;

  return normalizeTokenBoardState({
    goals,
    selectedGoalId,
    earnedTokens: normalizedState.selectedGoalId === goalId ? 0 : normalizedState.earnedTokens,
  });
}

export function addToken(state: TokenBoardState): TokenBoardState {
  const normalizedState = normalizeTokenBoardState(state);
  const selectedGoal =
    normalizedState.goals.find((goal) => goal.id === normalizedState.selectedGoalId) ?? normalizedState.goals[0];

  return normalizeTokenBoardState({
    ...normalizedState,
    earnedTokens: Math.min(selectedGoal.requiredTokens, normalizedState.earnedTokens + 1),
  });
}

export function removeToken(state: TokenBoardState): TokenBoardState {
  const normalizedState = normalizeTokenBoardState(state);

  return normalizeTokenBoardState({
    ...normalizedState,
    earnedTokens: Math.max(0, normalizedState.earnedTokens - 1),
  });
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
    canExchange: earnedTokens >= requiredTokens,
    slots: Array.from({ length: requiredTokens }, (_, index) => ({
      index,
      filled: index < earnedTokens,
    })),
  };
}
