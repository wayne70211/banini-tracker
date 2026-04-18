import os
import json
import logging
import time
from dotenv import load_dotenv

from facebook import fetch_facebook_posts
from analyze import analyze_posts
from discord_notifier import send_discord_notification
from market_data import get_market_context

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

DATA_DIR = "data"
SEEN_FILE = os.path.join(DATA_DIR, "seen.json")

def load_seen_posts():
    """Load the list of already seen post IDs."""
    if not os.path.exists(SEEN_FILE):
        return []
    try:
        with open(SEEN_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading seen.json: {e}")
        return []

def save_seen_posts(seen_ids: list):
    """Save the list of seen post IDs."""
    os.makedirs(DATA_DIR, exist_ok=True)
    try:
        # Keep only the latest 100 posts to avoid bloat
        seen_ids = seen_ids[-100:]
        with open(SEEN_FILE, "w", encoding="utf-8") as f:
            json.dump(seen_ids, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error saving seen.json: {e}")

def main():
    load_dotenv()
    logger.info("Starting Banini Tracker...")

    # Load previously seen posts
    seen_ids = load_seen_posts()

    # Fetch new posts
    logger.info("Fetching Facebook posts...")
    posts = fetch_facebook_posts(pages=3)
    
    if not posts:
        logger.info("No posts fetched or an error occurred.")
        return

    # Filter out posts we've already seen
    new_posts = [p for p in posts if p["id"] not in seen_ids]

    if not new_posts:
        logger.info("No new posts found.")
        return
    
    logger.info(f"Found {len(new_posts)} new posts.")
    for p in new_posts:
        logger.info(f"New Post -> ID: {p['id']}, Time: {p['timestamp']}")
        logger.info(f"Content Prefix: {p.get('text', '')[:200]}...")

    logger.info("Extracting market context from new posts...")
    combined_new_text = "\n".join([p.get('text', '') for p in new_posts])
    market_info = get_market_context(combined_new_text)

    # We process new posts one by one or altogether?
    # Because they are usually short and close in time, let's analyze them together.
    # Or just analyze the first (latest) if there are multiple, actually all new posts together.
    analysis = analyze_posts(new_posts, market_info)

    logger.info(f"Analysis completed: {analysis.summary}")

    # Send notification
    send_discord_notification(new_posts, analysis, market_info)

    # Re-save the seen IDs
    for p in new_posts:
        seen_ids.append(p["id"])
    save_seen_posts(seen_ids)
    
    logger.info("Banini Tracker execution finished successfully.")

if __name__ == "__main__":
    main()
