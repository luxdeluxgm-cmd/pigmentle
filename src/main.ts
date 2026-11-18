import {
  type CMYK,
  type ChannelHint,
  type GuessRow,
  cmykToRgb,
  clampChannel,
  evaluateChannel,
  getNextUtcMidnightCountdown,
} from './cmyk';
import {
  initAuth,
  linkGoogleAccount,
} from './supabase';

const TARGET_CMYK: CMYK = { c: 15, m: 65, y: 45, k: 5 };
const TARGET_NAME = 'TERRACOTTA';
const PUZZLE_NUMBER = 1;

let currentGuess: CMYK = { c: 30, m: 30, y: 30, k: 0 };
let guesses: GuessRow[] = [];
let darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
let burgerOpen = false;

const targetSwatchBox = document.getElementById('target-swatch-box')!;
const targetTitleLabel = document.getElementById('target-title-label')!;
const targetSpecLabel = document.getElementById('target-spec-label')!;
const tryCounterLabel = document.getElementById('try-counter-label')!;
const guessForm = document.getElementById('guess-form') as HTMLFormElement;
const gameoverBanner = document.getElementById('gameover-banner')!;
const gameoverTitle = document.getElementById('gameover-title')!;
const gameoverSubtitle = document.getElementById('gameover-subtitle')!;
const guessSlotsContainer = document.getElementById('guess-slots-container')!;
const shareTextPreview = document.getElementById('share-text-preview')!;
const utcCountdown = document.getElementById('utc-countdown')!;
const accountStatusBox = document.getElementById('account-status-box')!;
const burgerBtn = document.getElementById('btn-burger')!;
const burgerMenu = document.getElementById('burger-menu')!;
const themeLabel = document.getElementById('theme-label')!;
const themeDesktopLabel = document.getElementById('theme-desktop-label')!;

const inputs: Record<keyof CMYK, HTMLInputElement> = {
  c: document.getElementById('input-c') as HTMLInputElement,
  m: document.getElementById('input-m') as HTMLInputElement,
  y: document.getElementById('input-y') as HTMLInputElement,
  k: document.getElementById('input-k') as HTMLInputElement,
};

function setBurgerOpen(next: boolean) {
  burgerOpen = next;
  burgerBtn.classList.toggle('is-open', burgerOpen);
  burgerBtn.setAttribute('aria-expanded', String(burgerOpen));
  burgerMenu.classList.toggle('is-open', burgerOpen);
}

function applyTheme() {
  document.documentElement.classList.toggle('dark', darkMode);
  themeLabel.textContent = darkMode ? 'Light Mode' : 'Dark Mode';
  themeDesktopLabel.textContent = darkMode ? 'Light' : 'Dark';
}

function isWon(): boolean {
  const last = guesses[guesses.length - 1];
  return Boolean(
    last &&
      last.hints.c === 'perfect' &&
      last.hints.m === 'perfect' &&
      last.hints.y === 'perfect' &&
      last.hints.k === 'perfect'
  );
}

function isGameOver(): boolean {
  return isWon() || guesses.length >= 5;
}

function renderHintCell(label: string, hint: ChannelHint, value: number): string {
  if (hint === 'perfect') {
    return `<div class="py-2 px-1.5 md:px-2.5 flex items-center justify-between bg-ink text-paper font-mono-spec text-xs font-bold">
      <span class="opacity-65 text-[10px]">${label}</span>
      <span>${value}</span>
      <span class="text-[10px]">✓</span>
    </div>`;
  }
  const arrow = hint === 'higher' ? '▲' : '▼';
  return `<div class="py-2 px-1.5 md:px-2.5 flex items-center justify-between font-mono-spec text-xs">
    <span class="text-muted text-[10px]">${label}</span>
    <span class="font-bold">${value}</span>
    <span class="text-[10px] font-bold">${arrow}</span>
  </div>`;
}

function buildShareText(): string {
  const won = isWon();
  const over = isGameOver();
  const score = over ? (won ? `${guesses.length}/5` : 'X/5') : `${guesses.length}/5`;
  const grid =
    guesses.length > 0
      ? guesses
          .map((r) =>
            (['c', 'm', 'y', 'k'] as const)
              .map((ch) =>
                r.hints[ch] === 'perfect'
                  ? '🟩'
                  : r.hints[ch] === 'higher'
                  ? '🔼'
                  : '🔽'
              )
              .join('')
          )
          .join('\n')
      : '🟩🔼🔽🟩';
  return `Pigment #${PUZZLE_NUMBER} ${score}\n${grid}`;
}

function render() {
  const targetRgb = cmykToRgb(TARGET_CMYK);
  const won = isWon();
  const over = isGameOver();

  targetSwatchBox.style.backgroundColor = targetRgb.css;

  targetTitleLabel.textContent = over ? TARGET_NAME : `SWATCH 00${PUZZLE_NUMBER}`;
  targetSpecLabel.textContent = over
    ? `C${TARGET_CMYK.c}  M${TARGET_CMYK.m}  Y${TARGET_CMYK.y}  K${TARGET_CMYK.k}`
    : 'C —  M —  Y —  K —';

  tryCounterLabel.textContent = `${guesses.length} / 5`;

  guessForm.classList.toggle('hidden', over);
  gameoverBanner.classList.toggle('hidden', !over);
  gameoverBanner.classList.toggle('flex', over);

  if (over) {
    gameoverTitle.textContent = won ? 'SOLVED' : 'GAME OVER';
    gameoverSubtitle.textContent = `${TARGET_NAME} • C${TARGET_CMYK.c} M${TARGET_CMYK.m} Y${TARGET_CMYK.y} K${TARGET_CMYK.k}`;
  }

  const rowsHtml: string[] = [];

  for (let slot = 1; slot <= 5; slot++) {
    const row = guesses[slot - 1];
    if (row) {
      const swatch = cmykToRgb(row.cmyk);
      rowsHtml.push(`<div>
        <div class="w-full h-7 md:h-8 flex items-center justify-between px-2.5" style="background-color: ${swatch.css}">
          <span class="font-mono-spec text-[10px] font-bold px-1 bg-white/90 text-black">0${row.guessNumber}</span>
        </div>
        <div class="grid grid-cols-4 divide-x divide-ink border-t border-ink">
          ${renderHintCell('C', row.hints.c, row.cmyk.c)}
          ${renderHintCell('M', row.hints.m, row.cmyk.m)}
          ${renderHintCell('Y', row.hints.y, row.cmyk.y)}
          ${renderHintCell('K', row.hints.k, row.cmyk.k)}
        </div>
      </div>`);
    } else {
      rowsHtml.push(`<div class="grid grid-cols-4 divide-x divide-ink/15 h-11 md:h-12 text-muted/45 font-mono-spec text-[11px]">
        <div class="px-2.5 flex items-center">0${slot}</div>
        <div></div>
        <div></div>
        <div></div>
      </div>`);
    }
  }

  guessSlotsContainer.innerHTML = rowsHtml.join('');
  shareTextPreview.textContent = buildShareText();

  document.getElementById('stat-played')!.textContent = over ? '1' : '0';
  document.getElementById('stat-winrate')!.textContent = won ? '100%' : '0%';
  document.getElementById('stat-streak')!.textContent = won ? '1' : '0';
  document.getElementById('stat-best')!.textContent = won ? '1' : '0';
}

function openModal(id: string) {
  setBurgerOpen(false);
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('hidden');
  el.classList.add('flex');
}

function closeModal(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('hidden');
  el.classList.remove('flex');
}

burgerBtn.addEventListener('click', () => {
  setBurgerOpen(!burgerOpen);
});

(['c', 'm', 'y', 'k'] as const).forEach((ch) => {
  inputs[ch].addEventListener('input', () => {
    const parsed = parseInt(inputs[ch].value, 10);
    currentGuess[ch] = Number.isNaN(parsed) ? 0 : clampChannel(parsed);
  });
});

document.querySelectorAll<HTMLButtonElement>('[data-channel]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const ch = btn.dataset.channel as keyof CMYK;
    const delta = parseInt(btn.dataset.delta || '0', 10);
    currentGuess[ch] = clampChannel(currentGuess[ch] + delta);
    inputs[ch].value = String(currentGuess[ch]);
  });
});

guessForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (isGameOver()) return;

  guesses.push({
    guessNumber: guesses.length + 1,
    cmyk: { ...currentGuess },
    hints: {
      c: evaluateChannel(currentGuess.c, TARGET_CMYK.c),
      m: evaluateChannel(currentGuess.m, TARGET_CMYK.m),
      y: evaluateChannel(currentGuess.y, TARGET_CMYK.y),
      k: evaluateChannel(currentGuess.k, TARGET_CMYK.k),
    },
  });

  render();
  if (isGameOver()) {
    setTimeout(() => openModal('modal-results'), 350);
  }
});

document.getElementById('btn-reset-demo')!.addEventListener('click', () => {
  guesses = [];
  currentGuess = { c: 30, m: 30, y: 30, k: 0 };
  (['c', 'm', 'y', 'k'] as const).forEach((ch) => {
    inputs[ch].value = String(currentGuess[ch]);
  });
  render();
});

document.querySelectorAll<HTMLButtonElement>('[data-toggle-theme]').forEach((btn) => {
  btn.addEventListener('click', () => {
    darkMode = !darkMode;
    applyTheme();
  });
});

document.querySelectorAll<HTMLButtonElement>('[data-open-modal]').forEach((btn) => {
  btn.addEventListener('click', () => openModal(btn.dataset.openModal!));
});

document.getElementById('btn-gameover-results')!.addEventListener('click', () => openModal('modal-results'));

document.querySelectorAll<HTMLButtonElement>('[data-close-modal]').forEach((btn) => {
  btn.addEventListener('click', () => closeModal(btn.dataset.closeModal!));
});

document.getElementById('btn-copy-share')!.addEventListener('click', async (e) => {
  const btn = e.currentTarget as HTMLButtonElement;
  await navigator.clipboard.writeText(buildShareText());
  btn.textContent = 'Copied';
  setTimeout(() => {
    btn.textContent = 'Copy';
  }, 2000);
});

document.getElementById('btn-link-google')!.addEventListener('click', async () => {
  await linkGoogleAccount();
});

initAuth((user) => {
  if (!user) {
    accountStatusBox.innerHTML = `<p class="font-mono-spec font-bold">GUEST SESSION</p><p class="text-muted">Sign in with Google to sync your streak across devices.</p>`;
    return;
  }
  const isAnon = Boolean(user.is_anonymous ?? true);
  accountStatusBox.innerHTML = `<p class="font-mono-spec font-bold">${
    isAnon ? 'GUEST SESSION' : user.email ?? 'GOOGLE ACCOUNT'
  }</p><p class="text-muted">${
    isAnon ? 'Sign in with Google to keep your streak across devices.' : 'Your stats and streak are synced.'
  }</p>`;
});

setInterval(() => {
  utcCountdown.textContent = getNextUtcMidnightCountdown();
}, 1000);
utcCountdown.textContent = getNextUtcMidnightCountdown();

applyTheme();
render();
