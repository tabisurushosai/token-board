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

export type AppMode = "parent" | "child";
export type PremiumStatus = "free" | "trial" | "premium";

export interface PremiumAccess {
  trialStartedAt: number | null;
  premiumPurchasedAt: number | null;
}

export interface ExchangeHistoryEntry {
  id: string;
  goalId: string;
  goalName: string;
  goalEmoji: string;
  tokensSpent: number;
  exchangedAt: number;
}

export interface TokenBoardState {
  goals: RewardGoal[];
  selectedGoalId: string;
  earnedTokens: number;
  mode: AppMode;
  parentPin: string | null;
  premium: PremiumAccess;
  exchangeHistory: ExchangeHistoryEntry[];
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
  mode: AppMode;
  parentPinSet: boolean;
  premiumStatus: PremiumStatus;
  premiumActive: boolean;
  trialDaysRemaining: number;
  canStartTrial: boolean;
  canAddGoal: boolean;
  exchangeHistory: ExchangeHistoryEntry[];
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
export const FREE_GOAL_LIMIT = 1;
export const TRIAL_DAYS = 7;
export const STRIPE_CHECKOUT_URL = "https://buy.stripe.com/test_token_board_premium";
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
const MAX_HISTORY_ENTRIES = 50;

export function createInitialTokenBoardState(): TokenBoardState {
  return {
    goals: [defaultGoal],
    selectedGoalId: defaultGoal.id,
    earnedTokens: 0,
    mode: "parent",
    parentPin: null,
    premium: {
      trialStartedAt: null,
      premiumPurchasedAt: null,
    },
    exchangeHistory: [],
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

function normalizeParentPin(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const pin = value.trim();
  return /^\d{4,8}$/.test(pin) ? pin : null;
}

function normalizeTimestamp(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function normalizePremiumAccess(value: unknown): PremiumAccess {
  if (!isRecord(value)) {
    return {
      trialStartedAt: null,
      premiumPurchasedAt: null,
    };
  }

  return {
    trialStartedAt: normalizeTimestamp(value.trialStartedAt),
    premiumPurchasedAt: normalizeTimestamp(value.premiumPurchasedAt),
  };
}

function normalizeExchangeHistoryEntry(value: unknown): ExchangeHistoryEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === "string" && value.id.trim() ? value.id : null;
  const goalId = typeof value.goalId === "string" && value.goalId.trim() ? value.goalId : null;
  const goalName = typeof value.goalName === "string" && value.goalName.trim() ? value.goalName : null;
  const goalEmoji = typeof value.goalEmoji === "string" && value.goalEmoji.trim() ? value.goalEmoji : null;
  const tokensSpent =
    typeof value.tokensSpent === "number" && Number.isFinite(value.tokensSpent) ? Math.floor(value.tokensSpent) : null;
  const exchangedAt = normalizeTimestamp(value.exchangedAt);

  if (!id || !goalId || !goalName || !goalEmoji || tokensSpent === null || !exchangedAt) {
    return null;
  }

  return {
    id,
    goalId,
    goalName,
    goalEmoji,
    tokensSpent: clampRequiredTokens(tokensSpent),
    exchangedAt,
  };
}

function normalizeExchangeHistory(value: unknown): ExchangeHistoryEntry[] {
  return Array.isArray(value)
    ? value
        .map(normalizeExchangeHistoryEntry)
        .filter((entry) => entry !== null)
        .slice(0, MAX_HISTORY_ENTRIES)
    : [];
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
  const parentPin = normalizeParentPin(value.parentPin);
  const mode = parentPin && value.mode === "child" ? "child" : "parent";

  return {
    goals,
    selectedGoalId,
    earnedTokens: Math.min(Math.max(0, earnedTokens), selectedGoal.requiredTokens),
    mode,
    parentPin,
    premium: normalizePremiumAccess(value.premium),
    exchangeHistory: normalizeExchangeHistory(value.exchangeHistory),
  };
}

export function getPremiumStatus(state: TokenBoardState, nowMs: number): PremiumStatus {
  const normalizedState = normalizeTokenBoardState(state);

  if (normalizedState.premium.premiumPurchasedAt) {
    return "premium";
  }

  if (normalizedState.premium.trialStartedAt && nowMs < normalizedState.premium.trialStartedAt + TRIAL_MS) {
    return "trial";
  }

  return "free";
}

export function hasPremiumAccess(state: TokenBoardState, nowMs: number): boolean {
  return getPremiumStatus(state, nowMs) !== "free";
}

function getTrialDaysRemaining(state: TokenBoardState, nowMs: number): number {
  const normalizedState = normalizeTokenBoardState(state);
  const trialStartedAt = normalizedState.premium.trialStartedAt;

  if (!trialStartedAt || getPremiumStatus(normalizedState, nowMs) !== "trial") {
    return 0;
  }

  return Math.max(1, Math.ceil((trialStartedAt + TRIAL_MS - nowMs) / (24 * 60 * 60 * 1000)));
}

function getAvailableGoals(state: TokenBoardState, nowMs: number): RewardGoal[] {
  const normalizedState = normalizeTokenBoardState(state);
  return hasPremiumAccess(normalizedState, nowMs)
    ? normalizedState.goals
    : normalizedState.goals.slice(0, FREE_GOAL_LIMIT);
}

function getSelectedGoal(state: TokenBoardState, nowMs: number): RewardGoal {
  const availableGoals = getAvailableGoals(state, nowMs);
  return availableGoals.find((goal) => goal.id === state.selectedGoalId) ?? availableGoals[0] ?? defaultGoal;
}

export async function loadTokenBoardState(store: TokenBoardStateStore): Promise<TokenBoardState> {
  const savedState = await store.get<unknown>(TOKEN_BOARD_STATE_KEY);
  return normalizeTokenBoardState(savedState);
}

export async function restoreTokenBoardState(store: TokenBoardStateStore): Promise<TokenBoardState> {
  const state = await loadTokenBoardState(store);
  await saveTokenBoardState(store, state);
  return state;
}

export async function saveTokenBoardState(store: TokenBoardStateStore, state: TokenBoardState): Promise<void> {
  await store.set(TOKEN_BOARD_STATE_KEY, normalizeTokenBoardState(state));
}

export async function removeTokenBoardState(store: TokenBoardStateStore): Promise<void> {
  await store.remove(TOKEN_BOARD_STATE_KEY);
}

export function addRewardGoal(state: TokenBoardState, draft: RewardGoalDraft, nowMs: number): TokenBoardState {
  const normalizedState = normalizeTokenBoardState(state);
  const normalizedDraft = normalizeGoalDraft(draft);

  if (!normalizedDraft) {
    throw new Error("Goal name, emoji, and required tokens are required.");
  }

  if (!hasPremiumAccess(normalizedState, nowMs) && normalizedState.goals.length >= FREE_GOAL_LIMIT) {
    throw new Error("Premium is required to add more goals.");
  }

  const goal: RewardGoal = {
    id: createNextGoalId(normalizedState.goals),
    ...normalizedDraft,
  };

  return {
    goals: [...normalizedState.goals, goal],
    selectedGoalId: goal.id,
    earnedTokens: 0,
    mode: normalizedState.mode,
    parentPin: normalizedState.parentPin,
    premium: normalizedState.premium,
    exchangeHistory: normalizedState.exchangeHistory,
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
    ...normalizedState,
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
    ...normalizedState,
    goals,
    selectedGoalId,
    earnedTokens: normalizedState.selectedGoalId === goalId ? 0 : normalizedState.earnedTokens,
  });
}

export function selectRewardGoal(state: TokenBoardState, goalId: string, nowMs: number): TokenBoardState {
  const normalizedState = normalizeTokenBoardState(state);
  const selectedGoal = getAvailableGoals(normalizedState, nowMs).find((goal) => goal.id === goalId);

  if (!selectedGoal) {
    return normalizedState;
  }

  return normalizeTokenBoardState({
    ...normalizedState,
    selectedGoalId: selectedGoal.id,
    earnedTokens: Math.min(normalizedState.earnedTokens, selectedGoal.requiredTokens),
  });
}

export function addToken(state: TokenBoardState, nowMs: number): TokenBoardState {
  const normalizedState = normalizeTokenBoardState(state);
  const selectedGoal = getSelectedGoal(normalizedState, nowMs);

  return normalizeTokenBoardState({
    ...normalizedState,
    selectedGoalId: selectedGoal.id,
    earnedTokens: Math.min(selectedGoal.requiredTokens, normalizedState.earnedTokens + 1),
  });
}

export function exchangeReward(state: TokenBoardState, nowMs: number): TokenBoardState {
  const normalizedState = normalizeTokenBoardState(state);
  const selectedGoal = getSelectedGoal(normalizedState, nowMs);
  const earnedTokens = Math.min(Math.max(0, normalizedState.earnedTokens), selectedGoal.requiredTokens);

  if (earnedTokens < selectedGoal.requiredTokens) {
    return normalizedState;
  }

  const nextHistory = hasPremiumAccess(normalizedState, nowMs)
    ? [
        {
          id: `exchange-${nowMs}`,
          goalId: selectedGoal.id,
          goalName: selectedGoal.name,
          goalEmoji: selectedGoal.emoji,
          tokensSpent: selectedGoal.requiredTokens,
          exchangedAt: nowMs,
        },
        ...normalizedState.exchangeHistory,
      ].slice(0, MAX_HISTORY_ENTRIES)
    : normalizedState.exchangeHistory;

  return normalizeTokenBoardState({
    ...normalizedState,
    selectedGoalId: selectedGoal.id,
    earnedTokens: 0,
    exchangeHistory: nextHistory,
  });
}

export function startPremiumTrial(state: TokenBoardState, nowMs: number): TokenBoardState {
  const normalizedState = normalizeTokenBoardState(state);

  if (normalizedState.premium.trialStartedAt || normalizedState.premium.premiumPurchasedAt) {
    return normalizedState;
  }

  return normalizeTokenBoardState({
    ...normalizedState,
    premium: {
      ...normalizedState.premium,
      trialStartedAt: nowMs,
    },
  });
}

export function removeToken(state: TokenBoardState): TokenBoardState {
  const normalizedState = normalizeTokenBoardState(state);

  return normalizeTokenBoardState({
    ...normalizedState,
    earnedTokens: Math.max(0, normalizedState.earnedTokens - 1),
  });
}

export function setParentPin(state: TokenBoardState, pin: string): TokenBoardState {
  const normalizedState = normalizeTokenBoardState(state);
  const parentPin = normalizeParentPin(pin);

  if (!parentPin) {
    throw new Error("Parent PIN must be 4 to 8 digits.");
  }

  return normalizeTokenBoardState({
    ...normalizedState,
    mode: "parent",
    parentPin,
  });
}

export function switchToChildMode(state: TokenBoardState): TokenBoardState {
  const normalizedState = normalizeTokenBoardState(state);

  if (!normalizedState.parentPin) {
    throw new Error("Parent PIN is required before child mode.");
  }

  return normalizeTokenBoardState({
    ...normalizedState,
    mode: "child",
  });
}

export function unlockParentMode(state: TokenBoardState, pin: string): TokenBoardState {
  const normalizedState = normalizeTokenBoardState(state);
  const parentPin = normalizeParentPin(pin);

  if (!normalizedState.parentPin || parentPin !== normalizedState.parentPin) {
    throw new Error("Parent PIN does not match.");
  }

  return normalizeTokenBoardState({
    ...normalizedState,
    mode: "parent",
  });
}

export function createTokenBoardView(state: TokenBoardState, nowMs: number): TokenBoardView {
  const normalizedState = normalizeTokenBoardState(state);
  const goals = getAvailableGoals(normalizedState, nowMs);
  const selectedGoal = goals.find((goal) => goal.id === normalizedState.selectedGoalId) ?? goals[0] ?? defaultGoal;
  const requiredTokens = Math.max(1, selectedGoal.requiredTokens);
  const earnedTokens = Math.min(Math.max(0, normalizedState.earnedTokens), requiredTokens);
  const premiumStatus = getPremiumStatus(normalizedState, nowMs);
  const premiumActive = premiumStatus !== "free";

  return {
    goals: goals.length > 0 ? goals : [defaultGoal],
    selectedGoal,
    earnedTokens,
    requiredTokens,
    remainingTokens: Math.max(0, requiredTokens - earnedTokens),
    canExchange: earnedTokens >= requiredTokens,
    mode: normalizedState.mode,
    parentPinSet: normalizedState.parentPin !== null,
    premiumStatus,
    premiumActive,
    trialDaysRemaining: getTrialDaysRemaining(normalizedState, nowMs),
    canStartTrial: !normalizedState.premium.trialStartedAt && !normalizedState.premium.premiumPurchasedAt,
    canAddGoal: premiumActive || normalizedState.goals.length < FREE_GOAL_LIMIT,
    exchangeHistory: premiumActive ? normalizedState.exchangeHistory : [],
    slots: Array.from({ length: requiredTokens }, (_, index) => ({
      index,
      filled: index < earnedTokens,
    })),
  };
}
