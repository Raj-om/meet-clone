import urllib.request
import os
import concurrent.futures

model_dir = r"C:\Users\DELL\OneDrive\Desktop\meet-clone\public\models\mobilebert"
os.makedirs(model_dir, exist_ok=True)
base_url = "https://tfhub.dev/tensorflow/tfjs-model/mobilebert/1"

def download_file(filename):
    url = f"{base_url}/{filename}?tfjs-format=file"
    filepath = os.path.join(model_dir, filename)
    if os.path.exists(filepath) and os.path.getsize(filepath) > 100000:  # already downloaded > 100KB
        print(f"Skipping {filename}")
        return
    print(f"Downloading {filename}...")
    try:
        urllib.request.urlretrieve(url, filepath)
        print(f"Downloaded {filename}")
    except Exception as e:
        print(f"Failed {filename}: {e}")

if __name__ == "__main__":
    download_file("model.json")
    files = [f"group1-shard{i}of24.bin" for i in range(1, 25)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        executor.map(download_file, files)
    print("All downloads finished.")
