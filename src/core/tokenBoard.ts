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

export function createInitialTokenBoardState(): TokenBoardState {
  return {
    goals: [defaultGoal],
    selectedGoalId: defaultGoal.id,
    earnedTokens: 0,
  };
}

export function createTokenBoardView(state: TokenBoardState): TokenBoardView {
  const selectedGoal = state.goals.find((goal) => goal.id === state.selectedGoalId) ?? state.goals[0] ?? defaultGoal;
  const requiredTokens = Math.max(1, selectedGoal.requiredTokens);
  const earnedTokens = Math.min(Math.max(0, state.earnedTokens), requiredTokens);

  return {
    goals: state.goals.length > 0 ? state.goals : [defaultGoal],
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
