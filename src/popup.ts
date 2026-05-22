import {
  addToken,
  addRewardGoal,
  createTokenBoardView,
  deleteRewardGoal,
  loadTokenBoardState,
  removeToken,
  saveTokenBoardState,
  selectRewardGoal,
  setParentPin,
  switchToChildMode,
  unlockParentMode,
  updateRewardGoal,
  type RewardGoal,
  type RewardGoalDraft,
  type TokenBoardState,
  type TokenBoardView,
} from "./core/tokenBoard";
import { store } from "./storage";

const app = document.querySelector<HTMLDivElement>("#app");
let currentState: TokenBoardState | null = null;
let editingGoalId: string | null = null;
let formError = "";
let modeError = "";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char] ?? char;
  });
}

function renderGoalOptions(view: TokenBoardView): string {
  return view.goals
    .map((goal) => {
      const selected = goal.id === view.selectedGoal.id ? " selected" : "";
      return `<option value="${escapeHtml(goal.id)}"${selected}>${escapeHtml(goal.emoji)} ${escapeHtml(goal.name)}</option>`;
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

function renderExchangeEffect(view: TokenBoardView): string {
  if (!view.canExchange) {
    return `<p class="remaining-text">あと ${view.remainingTokens} こ</p>`;
  }

  return `
    <div class="exchange-effect" role="status" aria-live="polite">
      <span class="sparkle sparkle-left" aria-hidden="true">✦</span>
      <span class="exchange-message">こうかんできるよ</span>
      <span class="sparkle sparkle-right" aria-hidden="true">✦</span>
    </div>
  `;
}

function renderModePanel(view: TokenBoardView): string {
  const modeLabel = view.mode === "parent" ? "保護者モード" : "子供モード";
  const panelBody =
    view.mode === "child"
      ? `
      <form id="parent-unlock-form" class="pin-form">
        <label class="field-label" for="parent-unlock-pin">PIN</label>
        <div class="pin-row">
          <input id="parent-unlock-pin" name="pin" class="text-input" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="current-password" required>
          <button class="primary-button" type="submit">保護者になる</button>
        </div>
      </form>
    `
      : `
      <form id="parent-pin-form" class="pin-form">
        <label class="field-label" for="parent-pin">${view.parentPinSet ? "PIN変更" : "PIN設定"}</label>
        <div class="pin-row">
          <input id="parent-pin" name="pin" class="text-input" type="password" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="8" autocomplete="new-password" required>
          <button class="secondary-button" type="submit">${view.parentPinSet ? "変更" : "設定"}</button>
        </div>
      </form>
      <button class="secondary-button" type="button" data-action="child-mode"${view.parentPinSet ? "" : " disabled"}>子供モードにする</button>
    `;

  return `
    <section class="mode-panel" aria-label="モード切替">
      <div class="mode-header">
        <span class="mode-badge">${modeLabel}</span>
      </div>
      ${panelBody}
      ${modeError ? `<p class="form-error">${escapeHtml(modeError)}</p>` : ""}
    </section>
  `;
}

function getEditingGoal(view: TokenBoardView): RewardGoal | null {
  return editingGoalId ? (view.goals.find((goal) => goal.id === editingGoalId) ?? null) : null;
}

function renderGoalForm(view: TokenBoardView): string {
  const editingGoal = getEditingGoal(view);
  const submitLabel = editingGoal ? "更新" : "追加";
  const name = editingGoal?.name ?? "";
  const emoji = editingGoal?.emoji ?? "🎁";
  const requiredTokens = editingGoal?.requiredTokens ?? 10;

  return `
    <form id="goal-form" class="goal-form">
      <div class="form-row">
        <label class="field-label" for="goal-name">名前</label>
        <input id="goal-name" name="name" class="text-input" value="${escapeHtml(name)}" maxlength="40" required>
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label class="field-label" for="goal-emoji">絵文字</label>
          <input id="goal-emoji" name="emoji" class="text-input" value="${escapeHtml(emoji)}" maxlength="8" required>
        </div>
        <div class="form-row">
          <label class="field-label" for="goal-required-tokens">必要数</label>
          <input id="goal-required-tokens" name="requiredTokens" class="text-input" type="number" min="1" max="50" value="${requiredTokens}" required>
        </div>
      </div>
      ${formError ? `<p class="form-error">${escapeHtml(formError)}</p>` : ""}
      <div class="form-actions">
        <button class="primary-button" type="submit">${submitLabel}</button>
        ${editingGoal ? '<button class="secondary-button" type="button" data-action="cancel-edit">キャンセル</button>' : ""}
      </div>
    </form>
  `;
}

function renderGoalList(view: TokenBoardView): string {
  return `
    <ul class="goal-list" aria-label="ゴール一覧">
      ${view.goals
        .map(
          (goal) => `
            <li class="goal-item">
              <div class="goal-item-main">
                <span class="goal-item-emoji" aria-hidden="true">${escapeHtml(goal.emoji)}</span>
                <span class="goal-item-name">${escapeHtml(goal.name)}</span>
                <span class="goal-item-count">${goal.requiredTokens}こ</span>
              </div>
              <div class="goal-item-actions">
                <button class="icon-button" type="button" data-action="edit-goal" data-goal-id="${escapeHtml(goal.id)}">編集</button>
                <button class="icon-button danger-button" type="button" data-action="delete-goal" data-goal-id="${escapeHtml(goal.id)}"${
                  view.goals.length <= 1 ? " disabled" : ""
                }>削除</button>
              </div>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
}

function render(view: TokenBoardView): string {
  const canAddToken = view.earnedTokens < view.requiredTokens;
  const canRemoveToken = view.earnedTokens > 0;
  const canEdit = view.mode === "parent";

  return `
    ${renderModePanel(view)}

    <section class="goal-panel" aria-labelledby="goal-heading">
      <label class="field-label" for="goal-select">ゴール</label>
      <select id="goal-select" class="goal-select" aria-describedby="goal-heading">
        ${renderGoalOptions(view)}
      </select>

      <div class="goal-summary" id="goal-heading">
        <span class="goal-emoji" aria-hidden="true">${escapeHtml(view.selectedGoal.emoji)}</span>
        <div>
          <h2>${escapeHtml(view.selectedGoal.name)}</h2>
          <p>${view.earnedTokens}/${view.requiredTokens} こ</p>
        </div>
      </div>

      <ol class="token-board" aria-label="トークン台紙">
        ${renderTokenSlots(view)}
      </ol>

      ${
        canEdit
          ? `<div class="token-actions" aria-label="トークン操作">
        <button class="primary-button" type="button" data-action="add-token"${canAddToken ? "" : " disabled"}>トークンをあげる</button>
        <button class="secondary-button" type="button" data-action="remove-token"${canRemoveToken ? "" : " disabled"}>取り消す</button>
      </div>`
          : ""
      }

      ${renderExchangeEffect(view)}
    </section>

    ${
      canEdit
        ? `<section class="editor-panel" aria-labelledby="editor-heading">
      <h3 id="editor-heading">ゴール編集</h3>
      ${renderGoalForm(view)}
      ${renderGoalList(view)}
    </section>`
        : ""
    }
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

    .mode-panel {
      display: grid;
      gap: 8px;
      margin-bottom: 14px;
      padding-bottom: 14px;
      border-bottom: 1px solid #e1e7ea;
    }

    .mode-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .mode-badge {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      border-radius: 6px;
      background: #e8f3ff;
      color: #244057;
      font-size: 12px;
      font-weight: 800;
      padding: 2px 8px;
    }

    .editor-panel {
      display: grid;
      gap: 10px;
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid #e1e7ea;
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

    .goal-form {
      display: grid;
      gap: 10px;
    }

    .form-row {
      display: grid;
      gap: 4px;
    }

    .pin-form {
      display: grid;
      gap: 4px;
    }

    .pin-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .text-input {
      min-height: 34px;
      border: 1px solid #c9d3d7;
      border-radius: 6px;
      box-sizing: border-box;
      color: #263238;
      font: inherit;
      padding: 6px 8px;
      width: 100%;
    }

    .form-error {
      margin: 0;
      color: #9b1c1c;
      font-weight: 700;
    }

    .form-actions,
    .token-actions,
    .goal-item-actions {
      display: flex;
      gap: 8px;
    }

    .token-actions {
      display: grid;
      grid-template-columns: 1fr auto;
    }

    button {
      border: 1px solid #9db1b8;
      border-radius: 6px;
      cursor: pointer;
      font: inherit;
      min-height: 32px;
      padding: 6px 10px;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .primary-button {
      background: #2f5f51;
      border-color: #2f5f51;
      color: #ffffff;
      font-weight: 700;
    }

    .secondary-button,
    .icon-button {
      background: #ffffff;
      color: #263238;
    }

    .danger-button {
      border-color: #d9aaaa;
      color: #9b1c1c;
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

    .exchange-effect {
      position: relative;
      display: grid;
      grid-template-columns: 24px 1fr 24px;
      align-items: center;
      gap: 6px;
      min-height: 38px;
      border: 2px solid #f2bf3b;
      border-radius: 8px;
      background: #fff3c4;
      color: #7a4d00;
      font-weight: 800;
      overflow: hidden;
      padding: 6px 8px;
      text-align: center;
    }

    .exchange-effect::before,
    .exchange-effect::after {
      position: absolute;
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #ffffff;
      box-shadow:
        36px 8px 0 #f9d76b,
        76px 20px 0 #ffffff,
        148px 7px 0 #f9d76b,
        212px 19px 0 #ffffff;
      content: "";
      opacity: 0.85;
    }

    .exchange-effect::before {
      left: 10px;
      top: 8px;
      animation: sparkle-drift 1.7s ease-in-out infinite;
    }

    .exchange-effect::after {
      bottom: 10px;
      left: 28px;
      animation: sparkle-drift 1.7s ease-in-out 0.45s infinite reverse;
    }

    .exchange-message {
      position: relative;
      z-index: 1;
      font-size: 16px;
      line-height: 1.2;
    }

    .sparkle {
      position: relative;
      z-index: 1;
      color: #f5a400;
      font-size: 20px;
      line-height: 1;
      animation: sparkle-pop 0.9s ease-in-out infinite alternate;
    }

    .sparkle-right {
      animation-delay: 0.2s;
    }

    @keyframes sparkle-pop {
      from {
        transform: scale(0.82) rotate(-8deg);
      }

      to {
        transform: scale(1.18) rotate(8deg);
      }
    }

    @keyframes sparkle-drift {
      0%,
      100% {
        transform: translateY(0);
      }

      50% {
        transform: translateY(5px);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .exchange-effect::before,
      .exchange-effect::after,
      .sparkle {
        animation: none;
      }
    }

    .goal-list {
      display: grid;
      gap: 8px;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .goal-item {
      display: grid;
      gap: 8px;
      border: 1px solid #e1e7ea;
      border-radius: 8px;
      padding: 8px;
    }

    .goal-item-main {
      display: grid;
      grid-template-columns: 28px 1fr auto;
      align-items: center;
      gap: 6px;
    }

    .goal-item-emoji {
      font-size: 20px;
      text-align: center;
    }

    .goal-item-name {
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .goal-item-count {
      color: #54636b;
      font-size: 12px;
      font-weight: 700;
    }
  `;
  document.head.append(style);
}

installStyles();

function getGoalDraft(form: HTMLFormElement): RewardGoalDraft {
  const formData = new FormData(form);

  return {
    name: String(formData.get("name") ?? ""),
    emoji: String(formData.get("emoji") ?? ""),
    requiredTokens: Number(formData.get("requiredTokens")),
  };
}

function getPin(form: HTMLFormElement): string {
  const formData = new FormData(form);
  return String(formData.get("pin") ?? "");
}

async function saveAndRender(nextState: TokenBoardState): Promise<void> {
  currentState = nextState;
  await saveTokenBoardState(store, nextState);
  renderCurrentState();
}

function renderCurrentState(): void {
  if (!app || !currentState) {
    return;
  }

  app.innerHTML = render(createTokenBoardView(currentState));
}

function handleGoalFormSubmit(event: SubmitEvent): void {
  event.preventDefault();

  if (!currentState || currentState.mode !== "parent" || !(event.currentTarget instanceof HTMLFormElement)) {
    return;
  }

  try {
    const draft = getGoalDraft(event.currentTarget);
    const nextState = editingGoalId
      ? updateRewardGoal(currentState, editingGoalId, draft)
      : addRewardGoal(currentState, draft);

    editingGoalId = null;
    formError = "";
    void saveAndRender(nextState);
  } catch {
    formError = "名前・絵文字・必要数を入力してください";
    renderCurrentState();
  }
}

function handleParentPinFormSubmit(event: SubmitEvent): void {
  event.preventDefault();

  if (!currentState || !(event.currentTarget instanceof HTMLFormElement)) {
    return;
  }

  try {
    modeError = "";
    void saveAndRender(setParentPin(currentState, getPin(event.currentTarget)));
  } catch {
    modeError = "PINは4〜8桁の数字で入力してください";
    renderCurrentState();
  }
}

function handleParentUnlockFormSubmit(event: SubmitEvent): void {
  event.preventDefault();

  if (!currentState || !(event.currentTarget instanceof HTMLFormElement)) {
    return;
  }

  try {
    modeError = "";
    void saveAndRender(unlockParentMode(currentState, getPin(event.currentTarget)));
  } catch {
    modeError = "PINが違います";
    renderCurrentState();
  }
}

function handleAppClick(event: MouseEvent): void {
  const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("button[data-action]");

  if (!button || !currentState) {
    return;
  }

  const action = button.dataset.action;
  const goalId = button.dataset.goalId ?? null;

  if (action === "cancel-edit") {
    editingGoalId = null;
    formError = "";
    renderCurrentState();
    return;
  }

  if (action === "child-mode") {
    try {
      editingGoalId = null;
      formError = "";
      modeError = "";
      void saveAndRender(switchToChildMode(currentState));
    } catch {
      modeError = "先に4〜8桁のPINを設定してください";
      renderCurrentState();
    }
    return;
  }

  if (currentState.mode !== "parent") {
    return;
  }

  if (action === "add-token") {
    formError = "";
    void saveAndRender(addToken(currentState));
    return;
  }

  if (action === "remove-token") {
    formError = "";
    void saveAndRender(removeToken(currentState));
    return;
  }

  if (!goalId) {
    return;
  }

  if (action === "edit-goal") {
    editingGoalId = goalId;
    formError = "";
    renderCurrentState();
    return;
  }

  if (action === "delete-goal") {
    if (editingGoalId === goalId) {
      editingGoalId = null;
    }
    formError = "";
    void saveAndRender(deleteRewardGoal(currentState, goalId));
  }
}

app?.addEventListener("click", handleAppClick);
app?.addEventListener("change", (event) => {
  if (!currentState || (event.target as HTMLElement | null)?.id !== "goal-select") {
    return;
  }

  const select = event.target as HTMLSelectElement;
  editingGoalId = null;
  formError = "";
  modeError = "";
  void saveAndRender(selectRewardGoal(currentState, select.value));
});
app?.addEventListener("submit", (event) => {
  const targetId = (event.target as HTMLElement | null)?.id;

  if (targetId === "goal-form") {
    handleGoalFormSubmit(event);
    return;
  }

  if (targetId === "parent-pin-form") {
    handleParentPinFormSubmit(event);
    return;
  }

  if (targetId === "parent-unlock-form") {
    handleParentUnlockFormSubmit(event);
  }
});

async function mount(): Promise<void> {
  if (!app) {
    return;
  }

  currentState = await loadTokenBoardState(store);
  renderCurrentState();
}

void mount();
