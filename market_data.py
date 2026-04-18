import os
import json
import logging
import yfinance as yf
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# prompt expecting list of strings
SYSTEM_INSTRUCTION = """
你是一個股市分析助手。從以下使用者提供的貼文內容中，找出提及的所有「投資標的」。
並回傳它們對應的 Yahoo Finance 代號 (Symbol)。
- 台灣股票請加上 .TW (上市) 或 .TWO (上櫃)，例如台積電 -> 2330.TW，元大台灣50 -> 0050.TW。
- 台灣大盤請用 ^TWII。
- 如果是美股請直接輸出代號，例如 AAPL。
- 如果無法判斷或辨識，就不要列出該標的。
- 為了確保可靠性，最多只需列出前 5 個最重要的標的。
回傳格式必須是 JSON 陣列的字串 (List of strings)，例如 ["2330.TW", "^TWII"]。
"""

def extract_symbols(text: str) -> list[str]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY not set for extract_symbols.")
        return []
    
    if not text.strip():
        return []

    client = genai.Client(api_key=api_key)
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=text,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.1
            )
        )
        symbols = json.loads(response.text)
        if isinstance(symbols, list):
            return symbols
        return []
    except Exception as e:
        logger.error(f"Error extracting symbols: {e}")
        return []

def get_market_context(text: str) -> str:
    symbols = extract_symbols(text)
    if not symbols:
        return ""
    
    results = []
    logger.info(f"Extracted symbols: {symbols}")
    
    for sym in symbols:
        try:
            ticker = yf.Ticker(sym)
            hist = ticker.history(period="5d")
            if hist.empty:
                logger.info(f"No history found for {sym}")
                continue
            
            # current price is the last close
            current_price = hist['Close'].iloc[-1]
            first_price = hist['Close'].iloc[0]
            if first_price == 0:
                 continue
            change_pct = ((current_price - first_price) / first_price) * 100
            
            # format strings
            res = f"- **{sym}**: 最新價 {current_price:.2f}, 近五日走勢 {change_pct:+.2f}%"
            results.append(res)
        except Exception as e:
            logger.error(f"Error fetching data for {sym}: {e}")
            continue

    if results:
        return "\n".join(results)
    return ""

if __name__ == "__main__":
    import dotenv
    dotenv.load_dotenv()
    test_text = "今天買了台積電跟0050，大盤要噴了！"
    print("Test context:")
    print(get_market_context(test_text))
