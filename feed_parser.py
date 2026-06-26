import os
import re
import json
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from bs4 import BeautifulSoup

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_FILE = "releases_cache.json"
CACHE_DURATION_SECS = 900  # 15 minutes

def clean_text(html_content):
    """Generates a clean text representation of HTML content, removing tags and formatting spacing."""
    if not html_content:
        return ""
    soup = BeautifulSoup(html_content, 'html.parser')
    # Replace list items with bullet points for readability
    for li in soup.find_all('li'):
        li.insert_before(' • ')
        li.insert_after('\n')
    text = soup.get_text()
    # Normalize whitespace
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n\s*\n', '\n', text)
    return text.strip()

def process_html_links(html_content):
    """Ensures all links inside the HTML open in a new tab with correct security attributes."""
    if not html_content:
        return ""
    soup = BeautifulSoup(html_content, 'html.parser')
    for a in soup.find_all('a'):
        a['target'] = '_blank'
        a['rel'] = 'noopener noreferrer'
    return str(soup)

def fetch_and_parse_feed():
    """Fetches the Atom feed and parses it into structured release note items."""
    print("Fetching feed from Google...")
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    req = urllib.request.Request(FEED_URL, headers=headers)
    with urllib.request.urlopen(req) as response:
        xml_data = response.read()

    root = ET.fromstring(xml_data)
    ns = "{http://www.w3.org/2005/Atom}"
    entries = root.findall(f"{ns}entry")

    all_items = []
    
    for entry in entries:
        title_date = entry.find(f"{ns}title").text
        iso_date = entry.find(f"{ns}updated").text
        entry_id = entry.find(f"{ns}id").text
        
        # Extract link
        link_elem = entry.find(f"./{ns}link[@rel='alternate']")
        link = link_elem.get('href') if link_elem is not None else ""
        if not link:
            link_elem = entry.find(f"{ns}link")
            link = link_elem.get('href') if link_elem is not None else ""

        content_elem = entry.find(f"{ns}content")
        content_html_raw = content_elem.text if content_elem is not None else ""

        if not content_html_raw:
            continue

        # Parse HTML to split into individual change items
        soup = BeautifulSoup(content_html_raw, 'html.parser')
        
        current_type = "General"
        current_elements = []
        items_in_entry = []

        # Some feeds use direct HTML elements, others wrap in divs. Let's traverse children.
        children = list(soup.children)
        
        # If there are no children, parse as plain text
        if not children:
            items_in_entry.append({
                'type': 'General',
                'html': content_html_raw
            })
        else:
            for child in children:
                if child.name == 'h3':
                    # Save previous item if we accumulated elements
                    if current_elements:
                        items_in_entry.append({
                            'type': current_type,
                            'html': "".join(str(c) for c in current_elements).strip()
                        })
                    current_type = child.get_text().strip()
                    current_elements = []
                elif child.name is not None or (isinstance(child, str) and child.strip()):
                    current_elements.append(child)

            # Save the final item
            if current_elements or current_type != "General":
                items_in_entry.append({
                    'type': current_type,
                    'html': "".join(str(c) for c in current_elements).strip()
                })

        # Add items with meta information
        for idx, item in enumerate(items_in_entry):
            # Clean HTML links
            clean_html = process_html_links(item['html'])
            plain_text = clean_text(item['html'])
            
            # Format unique ID
            item_id = f"{entry_id}_{idx}"
            
            all_items.append({
                'id': item_id,
                'date': title_date,
                'iso_date': iso_date,
                'link': link,
                'type': item['type'],
                'content_html': clean_html,
                'content_text': plain_text
            })

    return all_items

def get_releases(bypass_cache=False):
    """
    Returns the list of structured release items, utilizing caching.
    Returns: (list_of_releases, last_fetched_time, from_cache_flag, has_error_flag)
    """
    now = datetime.now(timezone.utc)
    cache_exists = os.path.exists(CACHE_FILE)
    
    # Check if cache is valid
    if cache_exists and not bypass_cache:
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
                
            last_fetched_str = cache_data.get('last_fetched')
            if last_fetched_str:
                last_fetched = datetime.fromisoformat(last_fetched_str)
                age = (now - last_fetched).total_seconds()
                if age < CACHE_DURATION_SECS:
                    print("Serving from fresh cache.")
                    return cache_data.get('releases', []), last_fetched_str, True, False
        except Exception as e:
            print(f"Error reading cache: {e}. Re-fetching...")

    # Fetch live data
    try:
        releases = fetch_and_parse_feed()
        last_fetched_str = now.isoformat()
        
        # Save cache
        cache_data = {
            'last_fetched': last_fetched_str,
            'releases': releases
        }
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
            
        return releases, last_fetched_str, False, False

    except Exception as e:
        print(f"Error fetching live feed: {e}")
        # Try fallback to cache
        if cache_exists:
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    cache_data = json.load(f)
                print("Serving from stale cache due to fetch error.")
                return cache_data.get('releases', []), cache_data.get('last_fetched'), True, True
            except Exception as cache_err:
                print(f"Error reading cache as fallback: {cache_err}")
                
        # If cache also fails
        return [], None, False, True

if __name__ == "__main__":
    # Test script execution
    items, timestamp, cached, error = get_releases(bypass_cache=True)
    print(f"Parsed {len(items)} items. Cached: {cached}, Error: {error}, Last Fetched: {timestamp}")
    if items:
        print("First item summary:")
        print(json.dumps(items[0], indent=2))
