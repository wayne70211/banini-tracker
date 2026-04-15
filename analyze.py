import os
import json
import logging
from typing import List, Optional
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

class MentionedTarget(BaseModel):
    name: str = Field(description="股票或市場名稱 (e.g., 台積電, 大盤)")
    type: str = Field(description="類型 (e.g., 個股, ETF, 大盤, 總經)")
    herAction: str = Field(description="她的觀點/操作 (e.g., 看好, 已買入, 放空, 停損)")
    reverseView: str = Field(description="反向指標意義 (e.g., 該跌了, 該漲了)")
    confidence: str = Field(description="反指標信心水準 (e.g., 高, 中, 低)")
    reasoning: str = Field(description="判斷原因簡述")

class AnalysisResponse(BaseModel):
    hasInvestmentContent: bool = Field(description="貼文是否包含投資相關內容")
    summary: str = Field(description="原始貼文摘要")
    mentionedTargets: List[MentionedTarget] = Field(description="提及的投資標的", default=[])
    chainAnalysis: Optional[str] = Field(description="連鎖反應推導 (選填)", default="")
    actionableSuggestion: Optional[str] = Field(description="針對反指標的具體操作建議", default="")
    moodScore: Optional[int] = Field(description="冥燈指數 (1-10分)", default=0)

SYSTEM_INSTRUCTION = """
你是一個專門分析股市反指標的 AI 助手。
你的目標是分析 Facebook 知名粉專「巴逆逆（DieWithoutBang）」的發文。
由於她經常被視為「最強反指標」（冥燈），你需要：
1. 判斷貼文是否與股市、總經、特定個股或 ETF 有關。
2. 提取她提及的標的，並記錄她的實際看法與操作。
3. 提供「反向指標」觀點。例如她看好或買入，反向意義就是「該跌了」或「快逃」；她看壞或停損，反向意義則是「觸底反彈」。
4. 給出一個 1-10 分的「冥燈指數」，她講得越篤定或金額越大，分數越高。
"""

def analyze_posts(posts: List[dict]) -> AnalysisResponse:
    """
    Analyzes post content using Gemini.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY not set. Returning a fallback analysis.")
        return AnalysisResponse(
            hasInvestmentContent=False,
            summary="（無 AI 分析，請設定 GEMINI_API_KEY）"
        )

    # Combine text from all recent posts for context
    combined_text = "\\n\\n---\\n\\n".join([
        f"[{p.get('timestamp')}] {p.get('text')}" for p in posts if p.get('text')
    ])

    if not combined_text.strip():
         return AnalysisResponse(hasInvestmentContent=False, summary="沒有文字內容可以分析。")

    client = genai.Client(api_key=api_key)
    
    # Try multiple models in case of quota issues (429)
    models_to_try = ['gemini-2.0-flash', 'gemini-1.5-flash']
    last_error = None

    for model_id in models_to_try:
        try:
            logger.info(f"Analyzing posts with model: {model_id}")
            response = client.models.generate_content(
                model=model_id,
                contents=combined_text,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=AnalysisResponse,
                    system_instruction=SYSTEM_INSTRUCTION,
                    temperature=0.4
                )
            )
            data = json.loads(response.text)
            return AnalysisResponse(**data)
        except Exception as e:
            last_error = e
            logger.error(f"Error calling {model_id}: {e}")
            # If it's a 429 error, try the next model
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                continue
            else:
                break

    # If all models fail
    return AnalysisResponse(
        hasInvestmentContent=False, 
        summary=f"分析失敗（所有模型皆嘗試過）：{str(last_error)}"
    )

if __name__ == "__main__":
    import dotenv
    dotenv.load_dotenv()
    test_posts = [{"timestamp": "2026-04-14", "text": "今天買了台積電1000股，覺得半導體還有高點！大盤穩了！"}]
    res = analyze_posts(test_posts)
    print(res.model_dump_json(indent=2))
