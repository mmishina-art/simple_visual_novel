// Service Worker の登録と更新まわり。新版は待機させ、ボタンが押されたときだけ切り替える。
// 更新の検知は「起動時だけ」に頼らない：開いているあいだも定期的に確認し、
// 画面に戻ってきたときや、タイトル画面を開いたときにも確認する
//（起動しっぱなしだと新版に気づけず、更新案内が出ないことがあったため）。
import { registerSW } from 'virtual:pwa-register';

let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
let registration: ServiceWorkerRegistration | undefined;
let updateAvailable = false;
let lastCheckAt = 0;
const listeners = new Set<() => void>();

function notifyUpdateAvailable(): void {
  updateAvailable = true;
  listeners.forEach((cb) => cb());
}

/** 新版が待機中になったら呼ばれる登録をする（既に待機中ならすぐ呼ばれる） */
export function onUpdateAvailable(cb: () => void): void {
  listeners.add(cb);
  if (updateAvailable) cb();
}

/** 待機中の新版へ切り替える（更新ボタン用） */
export function applyUpdate(): void {
  void updateSW?.(true);
}

/** 新版がないか能動的に確認する。短時間の連続呼び出しは1回にまとめる */
export function checkForUpdate(): void {
  const now = Date.now();
  if (now - lastCheckAt < 60_000) return;
  lastCheckAt = now;
  void registration?.update().catch(() => {
    // 確認できなくても続行する
  });
}

export function setupPwa(): void {
  updateSW = registerSW({
    onNeedRefresh() {
      notifyUpdateAvailable();
    },
    onRegisteredSW(_swUrl, reg) {
      registration = reg;
      if (!reg) return;
      // 開いているあいだも定期的に確認する
      setInterval(() => checkForUpdate(), 15 * 60 * 1000);
      // バックグラウンドから戻ってきたときに確認する
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) checkForUpdate();
      });
    },
  });
  // テストや将来の検知経路から、更新案内を出せるようにしておく
  document.addEventListener('app:need-refresh', () => notifyUpdateAvailable());
}
