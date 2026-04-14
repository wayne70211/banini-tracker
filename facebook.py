from facebook_scraper import get_posts
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fetch_facebook_posts(page_name="DieWithoutBang", pages=1):
    """
    Fetches the latest public posts from a specified Facebook page.
    Using facebook-scraper library.
    """
    posts = []
    try:
        # get_posts returns a generator yielding post dictionaries
        for post in get_posts(page_name, pages=pages):
            posts.append({
                "id": f"fb_{post.get('post_id')}",
                "source": "facebook",
                "text": post.get("text", ""),
                "timestamp": post.get("time").isoformat() if post.get("time") else "",
                "likeCount": post.get("likes", 0),
                "replyCount": post.get("comments", 0),
                "url": post.get("post_url", ""),
                "mediaType": "photo" if post.get("image") else "text",
                "mediaUrl": post.get("image") or post.get("video") or "",
                "ocrText": "",
                "transcriptText": ""
            })
    except Exception as e:
        logger.error(f"Error fetching Facebook posts: {e}")
    return posts

if __name__ == "__main__":
    posts = fetch_facebook_posts(pages=1)
    for p in posts:
        print(f"[{p['timestamp']}] {p['id']}: {p['text'][:50]}")
