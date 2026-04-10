/**
 * 預測追蹤主邏輯
 * - recordPredictions：LLM 分析後記錄預測
 * - updateTracking：每日更新追蹤中的預測
 */
import { getDb } from './db.js';
import { resolveStock } from './stock-map.js';
import { getBasePrice, getDailyOHLC } from './stock-price.js';
import type { BaniniAnalysis } from './analyze.js';

interface PostInfo {
  id: string;
  url: string;
  timestamp: string;
}

/**
 * 記錄 LLM 分析出的預測
 */
export async function recordPredictions(
  analysis: BaniniAnalysis,
  posts: PostInfo[],
): Promise<number> {
  if (!analysis.hasInvestmentContent || !analysis.mentionedTargets?.length) {
    return 0;
  }

  const db = getDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO predictions
      (post_id, post_url, symbol_name, symbol_code, symbol_type,
       her_action, reverse_view, confidence, reasoning,
       base_price, created_at, recorded_at, status)
    VALUES
      (@post_id, @post_url, @symbol_name, @symbol_code, @symbol_type,
       @her_action, @reverse_view, @confidence, @reasoning,
       @base_price, @created_at, @recorded_at, @status)
  `);

  // 用最新的貼文作為來源
  const latestPost = posts[0];
  const now = new Date().toISOString();
  let recorded = 0;

  for (const target of analysis.mentionedTargets) {
    // 只追蹤個股和 ETF（有代碼才能查價）
    if (target.type !== '個股' && target.type !== 'ETF') {
      continue;
    }

    const stock = resolveStock(target.name);
    let basePrice: number | null = null;
    let status = 'tracking';

    if (stock) {
      basePrice = await getBasePrice(stock.code, stock.market);
    } else {
      status = 'unmappable';
      console.warn(`[tracker] 無法映射股票名稱: ${target.name}`);
    }

    const result = insert.run({
      post_id: latestPost.id,
      post_url: latestPost.url,
      symbol_name: target.name,
      symbol_code: stock?.code ?? null,
      symbol_type: target.type,
      her_action: target.herAction,
      reverse_view: target.reverseView,
      confidence: target.confidence,
      reasoning: target.reasoning ?? null,
      base_price: basePrice,
      created_at: latestPost.timestamp,
      recorded_at: now,
      status,
    });

    if (result.changes > 0) {
      recorded++;
      const priceStr = basePrice ? `$${basePrice}` : '無報價';
      console.log(`[tracker] 記錄預測: ${target.name}（${stock?.code ?? '?'}）${target.reverseView} [${priceStr}]`);
    }
  }

  return recorded;
}

interface TrackingPrediction {
  id: number;
  symbol_code: string;
  symbol_name: string;
  base_price: number;
  reverse_view: string;
  peak_change_pct: number | null;
}

/**
 * 每日更新追蹤中的預測（建議 15:00 後執行）
 */
export async function updateTracking(): Promise<void> {
  const db = getDb();

  const predictions = db.prepare(`
    SELECT id, symbol_code, symbol_name, base_price, reverse_view, peak_change_pct
    FROM predictions
    WHERE status = 'tracking' AND symbol_code IS NOT NULL AND base_price IS NOT NULL
  `).all() as TrackingPrediction[];

  if (predictions.length === 0) {
    console.log('[tracker] 沒有追蹤中的預測');
    return;
  }

  console.log(`[tracker] 更新 ${predictions.length} 筆追蹤中的預測...`);

  // 去重 symbol_code，避免重複查詢
  const uniqueCodes = [...new Set(predictions.map((p) => p.symbol_code))];
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });

  // 批次查詢今日 OHLC
  const ohlcMap = new Map<string, { open: number; high: number; low: number; close: number }>();
  for (const code of uniqueCodes) {
    const data = await getDailyOHLC(code, today);
    if (data.length > 0) {
      ohlcMap.set(code, data[0]);
    }
  }

  const insertSnapshot = db.prepare(`
    INSERT OR IGNORE INTO price_snapshots
      (prediction_id, date, open_price, high_price, low_price, close_price,
       change_pct_close, change_pct_extreme)
    VALUES (@prediction_id, @date, @open_price, @high_price, @low_price, @close_price,
            @change_pct_close, @change_pct_extreme)
  `);

  const updatePrediction = db.prepare(`
    UPDATE predictions
    SET status = @status, realized_at = @realized_at,
        days_to_realize = @days_to_realize, peak_change_pct = @peak_change_pct
    WHERE id = @id
  `);

  const countSnapshots = db.prepare(`
    SELECT COUNT(*) as cnt FROM price_snapshots WHERE prediction_id = ?
  `);

  const updateInTransaction = db.transaction(() => {
    for (const pred of predictions) {
      const ohlc = ohlcMap.get(pred.symbol_code);
      if (!ohlc) continue;

      const isDownward = pred.reverse_view.includes('跌');

      // 計算漲跌幅
      const changePctClose = ((ohlc.close - pred.base_price) / pred.base_price) * 100;
      const extreme = isDownward ? ohlc.low : ohlc.high;
      const changePctExtreme = ((extreme - pred.base_price) / pred.base_price) * 100;

      // 寫入快照
      insertSnapshot.run({
        prediction_id: pred.id,
        date: today,
        open_price: ohlc.open,
        high_price: ohlc.high,
        low_price: ohlc.low,
        close_price: ohlc.close,
        change_pct_close: Math.round(changePctClose * 100) / 100,
        change_pct_extreme: Math.round(changePctExtreme * 100) / 100,
      });

      // 更新 peak_change_pct
      const currentPeak = pred.peak_change_pct ?? 0;
      const absCurrent = Math.abs(changePctExtreme);
      const absPeak = Math.abs(currentPeak);
      const newPeak = absCurrent > absPeak ? changePctExtreme : currentPeak;

      // 判定狀態
      const snapshotCount = (countSnapshots.get(pred.id) as any).cnt;
      const status = checkRealized(pred.reverse_view, changePctExtreme, snapshotCount);

      if (status === 'realized') {
        updatePrediction.run({
          id: pred.id,
          status: 'realized',
          realized_at: today,
          days_to_realize: snapshotCount,
          peak_change_pct: Math.round(newPeak * 100) / 100,
        });
        console.log(`[tracker] 實現: ${pred.symbol_name}（${pred.symbol_code}）${changePctExtreme.toFixed(2)}%`);
      } else if (status === 'expired') {
        updatePrediction.run({
          id: pred.id,
          status: 'expired',
          realized_at: null,
          days_to_realize: null,
          peak_change_pct: Math.round(newPeak * 100) / 100,
        });
        console.log(`[tracker] 過期: ${pred.symbol_name}（${pred.symbol_code}）peak ${newPeak.toFixed(2)}%`);
      } else {
        updatePrediction.run({
          id: pred.id,
          status: 'tracking',
          realized_at: null,
          days_to_realize: null,
          peak_change_pct: Math.round(newPeak * 100) / 100,
        });
      }
    }
  });

  updateInTransaction();
  console.log('[tracker] 追蹤更新完成');
}

/**
 * 判定是否實現
 * - 看跌 → extreme change ≤ -3%
 * - 看漲 → extreme change ≥ 3%
 * - 超過 5 個交易日 → expired
 */
function checkRealized(
  reverseView: string,
  changePctExtreme: number,
  snapshotCount: number,
): 'realized' | 'expired' | 'tracking' {
  const isDownward = reverseView.includes('跌');

  if (isDownward && changePctExtreme <= -3) return 'realized';
  if (!isDownward && changePctExtreme >= 3) return 'realized';
  if (snapshotCount >= 5) return 'expired';

  return 'tracking';
}

/**
 * 取得追蹤統計
 */
export function getStats(): { total: number; realized: number; expired: number; tracking: number; winRate: number } {
  const db = getDb();
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'realized' THEN 1 ELSE 0 END) as realized,
      SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
      SUM(CASE WHEN status = 'tracking' THEN 1 ELSE 0 END) as tracking
    FROM predictions
    WHERE status != 'unmappable'
  `).get() as any;

  const decided = stats.realized + stats.expired;
  const winRate = decided > 0 ? Math.round((stats.realized / decided) * 100) : 0;

  return {
    total: stats.total,
    realized: stats.realized,
    expired: stats.expired,
    tracking: stats.tracking,
    winRate,
  };
}
