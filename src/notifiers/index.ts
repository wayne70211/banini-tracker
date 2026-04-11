import { createTelegramNotifier } from './telegram.js';
import { createDiscordNotifier } from './discord.js';
import { createLineNotifier } from './line.js';
import type { Notifier } from './types.js';

export type { Notifier, ReportData, PostSummary, AnalysisResult } from './types.js';
export { sendTelegramDirect } from './telegram.js';

/**
 * 讀取環境變數，建立所有已設定的 notifier。
 * 常駐模式用：自動偵測哪些 channel 有設定。
 */
export function createNotifiers(): Notifier[] {
  const notifiers: Notifier[] = [];

  // Telegram
  const tgToken = process.env.TG_BOT_TOKEN;
  const tgChannelId = process.env.TG_CHANNEL_ID;
  if (tgToken && tgChannelId) {
    notifiers.push(createTelegramNotifier({ botToken: tgToken, channelId: tgChannelId }));
  } else if (tgToken || tgChannelId) {
    console.warn(`⚠ Telegram 設定不完整：${tgToken ? '缺少 TG_CHANNEL_ID' : '缺少 TG_BOT_TOKEN'}，通知不會啟用`);
  }

  // Discord
  const dcToken = process.env.DISCORD_BOT_TOKEN;
  const dcChannelId = process.env.DISCORD_CHANNEL_ID;
  if (dcToken && dcChannelId) {
    notifiers.push(createDiscordNotifier({ botToken: dcToken, channelId: dcChannelId }));
  } else if (dcToken || dcChannelId) {
    console.warn(`⚠ Discord 設定不完整：${dcToken ? '缺少 DISCORD_CHANNEL_ID' : '缺少 DISCORD_BOT_TOKEN'}，通知不會啟用`);
  }

  // LINE
  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const lineTo = process.env.LINE_TO;
  if (lineToken && lineTo) {
    notifiers.push(createLineNotifier({ channelAccessToken: lineToken, to: lineTo }));
  } else if (lineToken || lineTo) {
    console.warn(`⚠ LINE 設定不完整：${lineToken ? '缺少 LINE_TO' : '缺少 LINE_CHANNEL_ACCESS_TOKEN'}，通知不會啟用`);
  }

  return notifiers;
}

/**
 * 從 CLI config 建立 notifier（只支援已設定的 channel）。
 */
export function createNotifiersFromConfig(config: {
  telegram?: { botToken: string; channelId: string };
  discord?: { botToken: string; channelId: string };
  line?: { channelAccessToken: string; to: string };
}): Notifier[] {
  const notifiers: Notifier[] = [];

  if (config.telegram?.botToken && config.telegram?.channelId) {
    notifiers.push(createTelegramNotifier(config.telegram));
  }
  if (config.discord?.botToken && config.discord?.channelId) {
    notifiers.push(createDiscordNotifier(config.discord));
  }
  if (config.line?.channelAccessToken && config.line?.to) {
    notifiers.push(createLineNotifier(config.line));
  }

  return notifiers;
}
