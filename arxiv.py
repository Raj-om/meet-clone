import urllib.request as libreq
import xml.etree.ElementTree as ET
import urllib.parse
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

queries = [
    'all:"Random Forest" AND all:"WebRTC"',
    'all:"Random Forest" AND all:"Deepfake"',
    'all:"machine learning" AND all:"WebRTC" AND all:"bitrate"'
]

for q in queries:
    print(f"--- Query: {q} ---")
    url = f'http://export.arxiv.org/api/query?search_query={urllib.parse.quote(q)}&start=0&max_results=3&sortBy=submittedDate&sortOrder=descending'
    try:
        response = libreq.urlopen(url, context=ctx).read()
        root = ET.fromstring(response)
        entries = root.findall('{http://www.w3.org/2005/Atom}entry')
        if not entries:
            print("No results found.")
            
        for entry in entries:
            title = entry.find('{http://www.w3.org/2005/Atom}title').text
            summary = entry.find('{http://www.w3.org/2005/Atom}summary').text.replace('\n', ' ').strip()
            published = entry.find('{http://www.w3.org/2005/Atom}published').text
            print(f"Title: {title.strip()}")
            print(f"Date: {published}")
            print(f"Summary: {summary[:300]}...\n")
    except Exception as e:
        print(f"Error: {e}")
