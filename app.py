import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
import json
import logging
from flask import Flask, jsonify, render_template, request

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# In-memory storage for simulated tweets
simulated_tweets = [
    {
        "id": "tweet_1",
        "text": "🚀 BigQuery update (June 16, 2026): Table Explorer behavior is moving to the Reference panel starting in July 2026. Make sure to check out the new layout! #BigQuery #GoogleCloud",
        "date": "2026-06-16T10:00:00Z",
        "likes": 24,
        "retweets": 8,
        "author_name": "Google Cloud Tracker",
        "author_handle": "GCPReleaseNotes"
    },
    {
        "id": "tweet_2",
        "text": "💡 New in BigQuery: You can now use Gemini Cloud Assist to analyze SQL queries and get recommendations to optimize query performance in BigQuery! (In Preview) #GeminiAI #BigQuery",
        "date": "2026-06-15T14:30:00Z",
        "likes": 42,
        "retweets": 15,
        "author_name": "Google Cloud Tracker",
        "author_handle": "GCPReleaseNotes"
    }
]

# Cache for release notes
cache = {
    "data": None,
    "last_fetched": None
}

FALLBACK_NOTES = [
    {
        "id": "fallback_1",
        "title": "June 16, 2026",
        "updated": "2026-06-16T00:00:00-07:00",
        "formatted_date": "June 16, 2026",
        "link": "https://cloud.google.com/bigquery/docs/release-notes",
        "content": "<h3>Announcement</h3>\n<p>Table Explorer behavior is moving to the <strong>Reference</strong> panel. This transition will occur in July 2026 or later. For more information, see <a href=\"https://docs.cloud.google.com/bigquery/docs/table-explorer\">Table Explorer</a>.</p>"
    },
    {
        "id": "fallback_2",
        "title": "June 15, 2026",
        "updated": "2026-06-15T00:00:00-07:00",
        "formatted_date": "June 15, 2026",
        "link": "https://cloud.google.com/bigquery/docs/release-notes",
        "content": "<h3>Feature</h3>\n<p>Use Gemini Cloud Assist to analyze your SQL queries and receive recommendations to <a href=\"https://docs.cloud.google.com/bigquery/docs/use-cloud-assist#optimize-query\">optimize query performance in BigQuery</a>. This feature is available to customers who use BigQuery editions. This feature is in <a href=\"https://cloud.google.com/products#product-launch-stages\">Preview</a>.</p>\n<h3>Issue</h3>\n<p>Support for configuring daily token quotas for BigQuery generative AI functions has been temporarily disabled. We are working to restore this feature as soon as possible.</p>"
    },
    {
        "id": "fallback_3",
        "title": "June 12, 2026",
        "updated": "2026-06-12T00:00:00-07:00",
        "formatted_date": "June 12, 2026",
        "link": "https://cloud.google.com/bigquery/docs/release-notes",
        "content": "<h3>Feature</h3>\n<p><a href=\"https://docs.cloud.google.com/bigquery/docs/generative-ai-overview\">BigQuery AI functions</a> can use <a href=\"https://docs.cloud.google.com/bigquery/docs/work-with-objectref\"><code>ObjectRef</code> values</a> directly as input, without calling the <code>OBJ.GET_ACCESS_URL</code> function. This feature is <a href=\"https://cloud.google.com/products#product-launch-stages\">generally available</a> (GA).</p>"
    }
]

def fetch_and_parse_feed():
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    logger.info(f"Fetching release notes from {url}")
    
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        entries = []
        for entry in root.findall('atom:entry', ns):
            title_el = entry.find('atom:title', ns)
            id_el = entry.find('atom:id', ns)
            updated_el = entry.find('atom:updated', ns)
            link_el = entry.find('atom:link', ns)
            content_el = entry.find('atom:content', ns)
            
            title = title_el.text if title_el is not None else ""
            entry_id = id_el.text if id_el is not None else ""
            updated = updated_el.text if updated_el is not None else ""
            
            link = ""
            if link_el is not None:
                link = link_el.attrib.get('href', '')
            if not link:
                # Fallback to standard docs if link is missing
                link = "https://cloud.google.com/bigquery/docs/release-notes"
                
            content = content_el.text if content_el is not None else ""
            
            # Format the updated date
            formatted_date = title
            if updated:
                try:
                    # Parse ISO format e.g. 2026-06-16T00:00:00-07:00
                    # Standard datetime.fromisoformat works for most offsets
                    dt = datetime.fromisoformat(updated)
                    formatted_date = dt.strftime("%B %d, %Y")
                except Exception as e:
                    logger.warning(f"Could not parse date {updated}: {e}")
            
            entries.append({
                "id": entry_id,
                "title": title,
                "updated": updated,
                "formatted_date": formatted_date,
                "link": link,
                "content": content
            })
            
        logger.info(f"Successfully parsed {len(entries)} entries from feed.")
        return entries, False
        
    except Exception as e:
        logger.error(f"Error fetching/parsing feed: {e}")
        # Return fallback notes but indicate it's offline fallback
        return FALLBACK_NOTES, True

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/release-notes")
def get_release_notes():
    # Check if we should force refresh
    force_refresh = request.args.get("refresh", "false").lower() == "true"
    
    if force_refresh or not cache["data"]:
        entries, is_fallback = fetch_and_parse_feed()
        cache["data"] = entries
        cache["last_fetched"] = datetime.utcnow().isoformat() + "Z"
        cache["is_fallback"] = is_fallback
        
    return jsonify({
        "notes": cache["data"],
        "lastFetched": cache["last_fetched"],
        "isFallback": cache.get("is_fallback", False)
    })

@app.route("/api/tweets", methods=["GET", "POST"])
def manage_tweets():
    if request.method == "POST":
        data = request.json
        if not data or "text" not in data:
            return jsonify({"error": "Missing tweet text"}), 400
            
        new_tweet = {
            "id": f"tweet_{int(datetime.utcnow().timestamp() * 1000)}",
            "text": data["text"],
            "date": datetime.utcnow().isoformat() + "Z",
            "likes": 0,
            "retweets": 0,
            "author_name": data.get("author_name", "Google Cloud Tracker"),
            "author_handle": data.get("author_handle", "GCPReleaseNotes")
        }
        simulated_tweets.insert(0, new_tweet)
        return jsonify(new_tweet), 201
        
    return jsonify(simulated_tweets)

@app.route("/api/tweets/<tweet_id>/like", methods=["POST"])
def like_tweet(tweet_id):
    for tweet in simulated_tweets:
        if tweet["id"] == tweet_id:
            tweet["likes"] += 1
            return jsonify(tweet)
    return jsonify({"error": "Tweet not found"}), 404

@app.route("/api/tweets/<tweet_id>/retweet", methods=["POST"])
def retweet_tweet(tweet_id):
    for tweet in simulated_tweets:
        if tweet["id"] == tweet_id:
            tweet["retweets"] += 1
            return jsonify(tweet)
    return jsonify({"error": "Tweet not found"}), 404

if __name__ == "__main__":
    app.run(debug=True, port=5000)
