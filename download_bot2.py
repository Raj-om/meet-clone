import urllib.request
import os
import time

model_dir = r"C:\Users\DELL\OneDrive\Desktop\meet-clone\public\models\mobilebert"
os.makedirs(model_dir, exist_ok=True)
base_url = "https://tfhub.dev/tensorflow/tfjs-model/mobilebert/1"

def download_file(filename):
    url = f"{base_url}/{filename}?tfjs-format=file"
    filepath = os.path.join(model_dir, filename)
    if os.path.exists(filepath) and os.path.getsize(filepath) > 100000:
        print(f"Skipping {filename}")
        return True
    
    print(f"Downloading {filename}...")
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=30) as response, open(filepath, 'wb') as out_file:
                out_file.write(response.read())
            print(f"Downloaded {filename}")
            return True
        except Exception as e:
            print(f"Attempt {attempt + 1} failed for {filename}: {e}")
            time.sleep(1)
    return False

if __name__ == "__main__":
    download_file("model.json")
    for i in range(1, 25):
        download_file(f"group1-shard{i}of24.bin")
    print("All downloads finished.")
