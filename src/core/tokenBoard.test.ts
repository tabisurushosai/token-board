import { describe, expect, it } from "vitest";

import {
  addToken,
  createInitialTokenBoardState,
  createTokenBoardView,
  exchangeReward,
  startPremiumTrial,
} from "./tokenBoard";

describe("token board core", () => {
  it("tracks earned tokens up to the selected goal", () => {
    const initialState = createInitialTokenBoardState();
    const afterOneToken = addToken(initialState, 1);
    const view = createTokenBoardView(afterOneToken, 1);

    expect(view.earnedTokens).toBe(1);
    expect(view.remainingTokens).toBe(view.requiredTokens - 1);
    expect(view.canExchange).toBe(false);
  });

  it("records exchange history only while premium access is active", () => {
    const now = 1_000;
    const trialState = startPremiumTrial(createInitialTokenBoardState(), now);
    let filledState = trialState;
    for (let index = 0; index < 10; index += 1) {
      filledState = addToken(filledState, now);
    }
    const exchangedState = exchangeReward(filledState, now + 1);
    const view = createTokenBoardView(exchangedState, now + 1);

    expect(view.earnedTokens).toBe(0);
    expect(view.exchangeHistory).toHaveLength(1);
    expect(view.exchangeHistory[0]?.tokensSpent).toBe(10);
  });
});
