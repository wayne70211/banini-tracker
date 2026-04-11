import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';

const db = new Database(join(homedir(), '.banini-tracker', 'banini.db'));
const now = new Date().toISOString();

const insert = db.prepare(`
  INSERT OR IGNORE INTO predictions
    (post_id, post_url, symbol_name, symbol_code, symbol_type,
     her_action, reverse_view, confidence, reasoning,
     base_price, created_at, recorded_at, status)
  VALUES
    (?, ?, ?, NULL, ?, ?, ?, '', ?, NULL, ?, ?, 'tracking')
`);

const predictions = [
  ['fb_1014945243323404', 'https://www.facebook.com/DieWithoutBang/posts/pfbid02s6Bz5t8khJzVEDyLn2Fzc4rZU9LenkQvH7Js1tooLgLRd4MFDh17EWgVpNndAowbl', '台積電', '個股', '買入', '空', '先買200股GG', '2024-05-21T00:54:06.000Z'],
  ['fb_1014945243323404', 'https://www.facebook.com/DieWithoutBang/posts/pfbid02s6Bz5t8khJzVEDyLn2Fzc4rZU9LenkQvH7Js1tooLgLRd4MFDh17EWgVpNndAowbl', 'BTC', '原物料', '看空', '多', 'BTC把我甩飛=被套後出場', '2024-05-21T00:54:06.000Z'],
  ['fb_1015433413274587', 'https://www.facebook.com/DieWithoutBang/posts/pfbid0K4rYCLFqMA8hA95r768j7KukYB1QiK8rpdippRcNiieLs4rRHqcqoi5zouhNCdVsl', '營建', '產業', '看多', '空', '房價不可能崩不會泡沫化', '2024-05-21T18:48:15.000Z'],
  ['fb_1015905123227416', 'https://www.facebook.com/DieWithoutBang/posts/pfbid02vpyKWweHfsWfa7EC32g8KGcxBR7ZQgP7ak7RYSmug73SvCSvQv9oJrSpsvmTMv6vl', 'Apple', '個股', '看多', '空', '在Intel跟Apple間選擇會投資Apple', '2024-05-22T13:48:25.000Z'],
  ['fb_1015905123227416', 'https://www.facebook.com/DieWithoutBang/posts/pfbid02vpyKWweHfsWfa7EC32g8KGcxBR7ZQgP7ak7RYSmug73SvCSvQv9oJrSpsvmTMv6vl', 'Intel', '個股', '看空', '多', '覺得Intel這次可能只是白忙一場', '2024-05-22T13:48:25.000Z'],
  ['fb_1015905123227416', 'https://www.facebook.com/DieWithoutBang/posts/pfbid02vpyKWweHfsWfa7EC32g8KGcxBR7ZQgP7ak7RYSmug73SvCSvQv9oJrSpsvmTMv6vl', '台積電', '個股', '看多', '空', '長線投資台積是不錯的選擇半導體10年不敗', '2024-05-22T13:48:25.000Z'],
  ['fb_1015905123227416', 'https://www.facebook.com/DieWithoutBang/posts/pfbid02vpyKWweHfsWfa7EC32g8KGcxBR7ZQgP7ak7RYSmug73SvCSvQv9oJrSpsvmTMv6vl', 'AI伺服器', '產業', '看空', '多', '第一輪AI伺服器建置完成後可能迎來衰退', '2024-05-22T13:48:25.000Z'],
  ['fb_1016767579807837', 'https://www.facebook.com/DieWithoutBang/posts/pfbid09oS1R1Ctqf5D33ZbCrMAdXihXzNx149F9VP2DLUFQfhwzZgC1ZQu25Y4JFVNsuwGl', '大盤', '指數', '看多', '空', '我大台股天下無敵', '2024-05-24T01:20:51.000Z'],
  ['fb_1019075992910329', 'https://www.facebook.com/DieWithoutBang/posts/pfbid0bLybydaawYP2mVa4oV3Fgabwj9fEL1mDNVy2docEzsFR7jbRK9qSapaat8MWAyn6l', '美債', '指數', 'All in被套', '空', '最近All in美債從快30掉到28.9', '2024-05-28T01:29:46.000Z'],
  ['fb_1019075992910329', 'https://www.facebook.com/DieWithoutBang/posts/pfbid0bLybydaawYP2mVa4oV3Fgabwj9fEL1mDNVy2docEzsFR7jbRK9qSapaat8MWAyn6l', '緯創', '個股', '被套', '空', '緯創快解套了=還在套中', '2024-05-28T01:29:46.000Z'],
  ['fb_1019445019540093', 'https://www.facebook.com/DieWithoutBang/posts/pfbid0bqb8qVgSLPX8bUrUxAkgHYANMjnxBiXZriTaDZsfLuJUf3hg59W3J2quU3oWXUTPl', '美債', '指數', '被套', '空', '隔壁輝達好開心我的美債=美債持續被套', '2024-05-28T16:31:24.000Z'],
  ['fb_1019820949502500', 'https://www.facebook.com/DieWithoutBang/posts/pfbid026DbzU73cijr2zBTKV5tArtgZKsSHJfkaHwbdNHV2Cy6cNkizT4Ssrg3AudeX2oe2l', 'NVIDIA', '個股', '計畫買入', '空', '薪水下來後要大買英偉達', '2024-05-29T09:35:40.000Z'],
  ['fb_1019931142824814', 'https://www.facebook.com/DieWithoutBang/posts/pfbid0NzSyxh8A51ARfGmbwHdKhWDAkWQpA1m6WkAEtVu6EW1XrpvHhriMpZnsLVdo8tvRl', 'NVIDIA', '個股', '看多', '空', '喊了NVDA=看多', '2024-05-29T13:50:38.000Z'],
  ['fb_1020237856127476', 'https://www.facebook.com/DieWithoutBang/posts/pfbid0hz3vK18pXtHiUs66EnWWczogCRacTSUFyrQqmt69ZCqbh8ogRCTazkVXRsRLBYy5l', '上緯', '個股', '停損賣出', '多', '上緯轉倉吃了15%損失出場', '2024-05-30T02:35:49.000Z'],
  ['fb_1020237856127476', 'https://www.facebook.com/DieWithoutBang/posts/pfbid0hz3vK18pXtHiUs66EnWWczogCRacTSUFyrQqmt69ZCqbh8ogRCTazkVXRsRLBYy5l', '緯創', '個股', '停損賣出', '多', '緯創幾乎沒賺出場換美債', '2024-05-30T02:35:49.000Z'],
  ['fb_1020237856127476', 'https://www.facebook.com/DieWithoutBang/posts/pfbid0hz3vK18pXtHiUs66EnWWczogCRacTSUFyrQqmt69ZCqbh8ogRCTazkVXRsRLBYy5l', '美債', '指數', '買入', '空', '出場換美債然後美債就掰了', '2024-05-30T02:35:49.000Z'],
  ['fb_1020530346098227', 'https://www.facebook.com/DieWithoutBang/posts/pfbid02d9pLZjaxuSmpeC2zvjYbuLkTGWbxHgg8zs4YgEDkWAxmWpRYa2A617UcwQkhUpAZl', '大盤', '指數', '看多', '空', '酒精占卜明天應該是紅的', '2024-05-30T14:16:26.000Z'],
];

let inserted = 0;
for (const p of predictions) {
  const result = insert.run(...p, now);
  if (result.changes > 0) inserted++;
}
console.log('寫入 ' + inserted + '/' + predictions.length + ' 筆');
const count = db.prepare('SELECT COUNT(*) as c FROM predictions').get();
console.log('predictions 表共 ' + count.c + ' 筆');
