import { createInitialTokenBoardState, createTokenBoardView, type TokenBoardView } from "./core/tokenBoard";

const app = document.querySelector<HTMLDivElement>("#app");

function renderGoalOptions(view: TokenBoardView): string {
  return view.goals
    .map((goal) => {
      const selected = goal.id === view.selectedGoal.id ? " selected" : "";
      return `<option value="${goal.id}"${selected}>${goal.emoji} ${goal.name}</option>`;
    })
    .join("");
}

function renderTokenSlots(view: TokenBoardView): string {
  return view.slots
    .map((slot) => {
      const className = slot.filled ? "token-slot token-slot-filled" : "token-slot";
      const label = slot.filled ? "獲得済み" : "未獲得";
      return `<li class="${className}" aria-label="${slot.index + 1}こ目: ${label}">${slot.filled ? "★" : ""}</li>`;
    })
    .join("");
}

function render(view: TokenBoardView): string {
  return `
    <section class="goal-panel" aria-labelledby="goal-heading">
      <label class="field-label" for="goal-select">ゴール</label>
      <select id="goal-select" class="goal-select" aria-describedby="goal-heading">
        ${renderGoalOptions(view)}
      </select>

      <div class="goal-summary" id="goal-heading">
        <span class="goal-emoji" aria-hidden="true">${view.selectedGoal.emoji}</span>
        <div>
          <h2>${view.selectedGoal.name}</h2>
          <p>${view.earnedTokens}/${view.requiredTokens} こ</p>
        </div>
      </div>

      <ol class="token-board" aria-label="トークン台紙">
        ${renderTokenSlots(view)}
      </ol>

      <p class="remaining-text">あと ${view.remainingTokens} こ</p>
    </section>
  `;
}

function installStyles(): void {
  const style = document.createElement("style");
  style.textContent = `
    :root {
      color: #263238;
      background: #fffdf7;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    body {
      width: 320px;
      margin: 0;
      padding: 14px;
      box-sizing: border-box;
      background: #fffdf7;
    }

    h3 {
      margin: 0 0 12px;
      font-size: 18px;
      line-height: 1.3;
    }

    .goal-panel {
      display: grid;
      gap: 12px;
    }

    .field-label {
      font-size: 12px;
      font-weight: 700;
      color: #54636b;
    }

    .goal-select {
      width: 100%;
      min-height: 36px;
      border: 1px solid #c9d3d7;
      border-radius: 6px;
      background: #ffffff;
      color: #263238;
      font: inherit;
      padding: 6px 8px;
    }

    .goal-summary {
      display: grid;
      grid-template-columns: 48px 1fr;
      align-items: center;
      gap: 10px;
    }

    .goal-emoji {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border-radius: 8px;
      background: #e8f3ff;
      font-size: 28px;
    }

    h2 {
      margin: 0;
      font-size: 18px;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    p {
      margin: 2px 0 0;
      color: #54636b;
      font-size: 13px;
    }

    .token-board {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .token-slot {
      display: grid;
      place-items: center;
      aspect-ratio: 1;
      border: 2px dashed #c9d3d7;
      border-radius: 8px;
      background: #ffffff;
      color: #f5a400;
      font-size: 22px;
      font-weight: 800;
      line-height: 1;
    }

    .token-slot-filled {
      border-style: solid;
      border-color: #f2bf3b;
      background: #fff3c4;
    }

    .remaining-text {
      margin: 0;
      font-weight: 700;
      color: #2f5f51;
    }
  `;
  document.head.append(style);
}

installStyles();

if (app) {
  const state = createInitialTokenBoardState();
  app.innerHTML = render(createTokenBoardView(state));
}
