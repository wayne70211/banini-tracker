import os
import requests
import logging
from analyze import AnalysisResponse

logger = logging.getLogger(__name__)

def send_discord_notification(posts: list, analysis: AnalysisResponse, market_info: str = ""):
    """
    Sends a Discord webhook notification with the analyzed results.
    """
    webhook_url = os.getenv("DISCORD_WEBHOOK_URL")
    if not webhook_url:
        logger.warning("DISCORD_WEBHOOK_URL not set. Skipping notification.")
        return

    # If no investment content, we can either skip or send a simple message.
    # Usually users still want to know there was a post.
    if not analysis.hasInvestmentContent:
        content = f"**巴逆逆發送了新貼文，但未提及投資！**\n摘要：{analysis.summary}"
        payload = {
            "content": content,
            "embeds": [
                {
                    "title": "查看貼文",
                    "url": posts[0].get("url") if posts else "",
                    "description": posts[0].get("text", "")[:200] + "..." if posts else "",
                    "color": 8421504 # Gray
                }
            ]
        }
    else:
        # Construct detailed embed
        embed = {
            "title": f"🚨 巴逆逆反指標出沒！(冥燈指數: {analysis.moodScore}/10)",
            "description": f"**摘要**\n{analysis.summary}\n\n**操作建議**\n{analysis.actionableSuggestion}",
            "color": 15158332, # Red
            "fields": []
        }

        if analysis.mentionedTargets:
            for t in analysis.mentionedTargets:
                arrow = "🔴" if "跌" in t.reverseView else "🟢" if "漲" in t.reverseView else "⚪"
                field_val = f"她操作：{t.herAction}\n反指標：{t.reverseView}\n信心度：{t.confidence}\n原因：{t.reasoning}"
                embed["fields"].append({
                    "name": f"{arrow} {t.name} ({t.type})",
                    "value": field_val,
                    "inline": False
                })
        
        if analysis.chainAnalysis:
            embed["fields"].append({
                "name": "🔗 連鎖推導",
                "value": analysis.chainAnalysis,
                "inline": False
            })

        if market_info:
            embed["fields"].append({
                "name": "📊 當前標的報價與走勢",
                "value": market_info,
                "inline": False
            })

        # Add image from the first post if available
        first_media = next((p.get("mediaUrl") for p in posts if p.get("mediaUrl")), None)
        if first_media:
            embed["image"] = {"url": first_media}

        payload = {
            "content": "@everyone 巴逆逆最新冥燈開示！",
            "embeds": [embed]
        }

        # Add buttons to the post
        if posts and posts[0].get("url"):
             embed["url"] = posts[0]["url"]

    try:
        response = requests.post(webhook_url, json=payload)
        response.raise_for_status()
        logger.info("Discord notification sent successfully.")
    except Exception as e:
        logger.error(f"Failed to send Discord notification: {e}")

if __name__ == "__main__":
    # Test script
    import dotenv
    dotenv.load_dotenv()
    test_analysis = AnalysisResponse(
        hasInvestmentContent=True,
        summary="測試摘要",
        mentionedTargets=[],
        actionableSuggestion="快跑",
        moodScore=9
    )
    send_discord_notification([], test_analysis)
