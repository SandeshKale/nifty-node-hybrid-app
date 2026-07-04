export function getIST(): Date {
  return new Date(Date.now() + 5.5 * 3600000);
}

export function getISTString(): string {
  const ist = getIST();
  const h = ist.getUTCHours();
  const m = ist.getUTCMinutes();
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function getISTTotalMinutes(): number {
  const ist = getIST();
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

export function isWeekday(): boolean {
  const day = getIST().getUTCDay();
  return day >= 1 && day <= 5;
}

export function isMarketHours(): boolean {
  const totalMin = getISTTotalMinutes();
  return isWeekday() && totalMin >= 565 && totalMin <= 920; // 9:25 AM - 3:20 PM
}

export function canTrade(): boolean {
  const totalMin = getISTTotalMinutes();
  return isWeekday() && totalMin >= 565 && totalMin < 825; // 9:25 AM - 1:45 PM
}

export function getISTDate(): string {
  return getIST().toISOString().slice(0, 10);
}
