import os
import logging
from apify_client import ApifyClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fetch_facebook_posts(page_name="DieWithoutBang", pages=1):
    """
    Fetches the latest public posts from a specified Facebook page.
    Using Apify API (facebook-posts-scraper).
    """
    api_token = os.getenv("APIFY_TOKEN")
    if not api_token:
        logger.error("APIFY_TOKEN not found in environment variables.")
        return []

    client = ApifyClient(api_token)
    posts = []
    
    run_input = {
        "startUrls": [{"url": "https://www.facebook.com/DieWithoutBang/"}],
        "resultsLimit": 5,
        "onlyPostsNewerThan": "1 day",
        "includeVideoTranscript": False,
        "proxyConfiguration": {
            "useApifyProxy": True
        }
    }

    try:
        logger.info(f"Running Apify actor for page: {page_name}")
        # Call the actor and wait for it to finish
        run = client.actor("apify/facebook-posts-scraper").call(
            run_input=run_input,
            timeout_secs=300,
            memory_mbytes=1024,
            max_total_charge_usd=0.1
        )

        # Fetch results from the run's dataset
        for item in client.dataset(run["defaultDatasetId"]).iterate_items():
            # Filter for posts that have some identifiers
            post_id = item.get("postId") or item.get("id")
            if not post_id:
                continue

            posts.append({
                "id": f"fb_{post_id}",
                "source": "facebook",
                "text": item.get("text", ""),
                "timestamp": item.get("date") or item.get("timestamp") or "",
                "likeCount": item.get("likes", 0),
                "replyCount": item.get("commentsCount", 0),
                "url": item.get("url") or f"https://www.facebook.com/{post_id}",
                "mediaType": "photo" if item.get("media", []) and any(m.get("type") == "image" for m in item.get("media", [])) else "text",
                "mediaUrl": item.get("media", [{}])[0].get("url") if item.get("media") else "",
                "ocrText": "",
                "transcriptText": ""
            })
        
        logger.info(f"Successfully fetched {len(posts)} posts from Apify.")
    except Exception as e:
        logger.error(f"Error fetching Facebook posts via Apify: {e}")
        
    return posts

if __name__ == "__main__":
    # For local testing, ensure APIFY_TOKEN is set
    test_posts = fetch_facebook_posts(pages=1)
    for p in test_posts:
        print(f"[{p['timestamp']}] {p['id']}: {p['text'][:50]}...")
