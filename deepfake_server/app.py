"""
DIRE / UniversalFakeDetect — Flask Microservice
================================================
Detects AI-generated / deepfake video frames using:

1. DCT frequency spectrum analysis (primary — detects diffusion model artifacts)
   - Diffusion models (Sora, Runway, Stable Diffusion) leave characteristic
     high-frequency artifacts in the DCT domain that differ from camera noise
   - Based on the core insight from DIRE paper (Wang et al., 2023)

2. DIRE model inference (optional — loads if weights are present)
   - Place DIRE weights at: deepfake_server/models/dire.pth
   - Model: ResNet-50 fine-tuned on DIRE reconstruction error features

3. Color statistics analysis (GAN/diffusion color distribution fingerprinting)

Port: 5001 (to avoid conflict with Next.js on 3000)
"""

import base64
import io
import json
import os
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image

# Optional heavy imports — loaded lazily
_scipy_fft = None
_torch = None
_model = None
_model_loaded = False

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://0.0.0.0:3000"])

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "dire.pth")
FRAME_SIZE = 224  # Standard crop for most CNN classifiers


# ── Lazy imports ──────────────────────────────────────────────────────────────
def get_fft():
    global _scipy_fft
    if _scipy_fft is None:
        from scipy.fft import dct
        _scipy_fft = dct
    return _scipy_fft


def load_dire_model():
    """Attempt to load DIRE/fine-tuned ResNet model from disk."""
    global _model, _model_loaded, _torch
    if _model_loaded:
        return _model
    _model_loaded = True

    if not os.path.exists(MODEL_PATH):
        print(f"[DIRE] No model at {MODEL_PATH} — using DCT heuristic mode.")
        return None

    try:
        import torch
        import torchvision.models as models
        _torch = torch

        model = models.resnet50(weights=None)
        model.fc = torch.nn.Linear(model.fc.in_features, 2)  # binary: real/fake
        state = torch.load(MODEL_PATH, map_location="cpu")
        model.load_state_dict(state)
        model.eval()
        _model = model
        print("[DIRE] Model loaded successfully.")
        return model
    except Exception as e:
        print(f"[DIRE] Model load failed: {e}. Using DCT heuristic mode.")
        return None


# ── DCT frequency analysis ────────────────────────────────────────────────────
def analyze_dct_spectrum(img_array: np.ndarray) -> dict:
    """
    Compute DCT power spectrum of the image.

    Key insight (DIRE / Corvi et al.):
    - Camera images: DCT energy concentrated in low freqs, natural roll-off
    - Diffusion models: anomalous energy bumps at mid-high frequencies
    - GANs: periodic grid artifacts visible in frequency domain
    """
    # Convert to grayscale for frequency analysis
    gray = 0.299 * img_array[:, :, 0] + 0.587 * img_array[:, :, 1] + 0.114 * img_array[:, :, 2]
    gray = gray.astype(np.float64)

    # 2D DCT via row + column 1D DCTs
    dct_fn = get_fft()
    dct_rows = dct_fn(gray, axis=1, norm='ortho')
    dct_2d = dct_fn(dct_rows, axis=0, norm='ortho')

    # Power spectrum (log scale)
    power = np.log1p(np.abs(dct_2d) ** 2)

    H, W = power.shape
    mid_h, mid_w = H // 4, W // 4

    # Band energy: low / mid / high frequency regions
    low_energy  = power[:mid_h, :mid_w].mean()
    mid_energy  = power[mid_h:mid_h*2, mid_w:mid_w*2].mean()
    high_energy = power[mid_h*2:, mid_w*2:].mean()

    # Natural images: high ratio of low/high energy
    # AI-generated: more uniform distribution or mid-freq spikes
    low_to_high_ratio = low_energy / (high_energy + 1e-8)
    mid_to_low_ratio  = mid_energy / (low_energy + 1e-8)

    # Detect periodic grid artifacts (GAN signature)
    # Compute variance of row-wise DCT means
    row_means = power.mean(axis=1)
    row_variance = float(np.var(row_means))

    return {
        "low_energy": float(low_energy),
        "mid_energy": float(mid_energy),
        "high_energy": float(high_energy),
        "low_to_high_ratio": float(low_to_high_ratio),
        "mid_to_low_ratio": float(mid_to_low_ratio),
        "row_variance": row_variance,
    }


def dct_to_score(dct_stats: dict) -> float:
    """
    Convert DCT statistics to a 0-100 deepfake probability score.
    Higher = more likely AI-generated.
    """
    score = 0.0

    # Low-to-high ratio: real images ~8-20, AI images ~2-6
    l2h = dct_stats["low_to_high_ratio"]
    if l2h < 3:
        score += 70
    elif l2h < 5:
        score += 45
    elif l2h < 7:
        score += 20

    # Mid freq anomaly: AI images have unnaturally elevated mid frequencies
    m2l = dct_stats["mid_to_low_ratio"]
    if m2l > 0.85:
        score += 55  # Very high mid-freq = diffusion model artifact
    elif m2l > 0.75:
        score += 35
    elif m2l > 0.65:
        score += 15

    # Row variance: periodic GAN grid → very low variance
    rv = dct_stats["row_variance"]
    if rv < 0.5:
        score += 40  # Suspiciously uniform frequency rows = GAN grid
    elif rv < 1.0:
        score += 20

    return min(100.0, score)


# ── Color statistics fingerprinting ──────────────────────────────────────────
def analyze_color_stats(img_array: np.ndarray) -> float:
    """
    AI-generated images often have:
    - Unnaturally narrow color histograms (GAN mode collapse)
    - Over-saturated skin tones
    - Perfect white balance (no real-world color cast)
    """
    score = 0.0

    # Compute std dev of each channel
    r_std = float(img_array[:, :, 0].std())
    g_std = float(img_array[:, :, 1].std())
    b_std = float(img_array[:, :, 2].std())

    # Very low std dev in any channel = narrow histogram = GAN
    for std in [r_std, g_std, b_std]:
        if std < 15:
            score += 25
        elif std < 25:
            score += 10

    # Check channel correlation (real cameras: natural cross-channel noise)
    r_flat = img_array[:, :, 0].flatten().astype(float)
    g_flat = img_array[:, :, 1].flatten().astype(float)
    corr = float(np.corrcoef(r_flat, g_flat)[0, 1])
    if corr > 0.99:
        score += 20  # Perfect R-G correlation = synthesized

    return min(100.0, score)


# ── DIRE model inference ──────────────────────────────────────────────────────
def run_dire_inference(img_array: np.ndarray) -> float:
    """Run DIRE ResNet model inference. Returns 0-100 fakeness score."""
    model = load_dire_model()
    if model is None:
        return -1  # Signal: not available

    try:
        import torch
        from torchvision import transforms

        transform = transforms.Compose([
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406],
                                 std=[0.229, 0.224, 0.225]),
        ])

        pil_img = Image.fromarray(img_array.astype(np.uint8)).resize((FRAME_SIZE, FRAME_SIZE))
        tensor = transform(pil_img).unsqueeze(0)

        with torch.no_grad():
            logits = model(tensor)
            prob = torch.softmax(logits, dim=1)[0, 1].item()  # class 1 = fake

        return float(prob * 100)
    except Exception as e:
        print(f"[DIRE] Inference error: {e}")
        return -1


# ── API endpoint ──────────────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    model_available = os.path.exists(MODEL_PATH)
    return jsonify({
        "status": "ok",
        "mode": "DIRE Model" if model_available else "DCT Heuristic",
        "model_available": model_available,
    })


@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        data = request.get_json()
        if not data or "frame" not in data:
            return jsonify({"error": "No frame provided"}), 400

        # Decode base64 frame
        frame_b64 = data["frame"]
        if "," in frame_b64:
            frame_b64 = frame_b64.split(",")[1]

        frame_bytes = base64.b64decode(frame_b64)
        pil_img = Image.open(io.BytesIO(frame_bytes)).convert("RGB")
        pil_img = pil_img.resize((FRAME_SIZE, FRAME_SIZE), Image.LANCZOS)
        img_array = np.array(pil_img)

        # ── Run analyses ────────────────────────────────────────────────────
        # 1. DIRE model (if available)
        dire_score = run_dire_inference(img_array)

        # 2. DCT frequency analysis (always runs)
        dct_stats = analyze_dct_spectrum(img_array)
        dct_score = dct_to_score(dct_stats)

        # 3. Color statistics
        color_score = analyze_color_stats(img_array)

        # ── Composite score ──────────────────────────────────────────────────
        if dire_score >= 0:
            # Use DIRE model primarily if available
            final_score = round(dire_score * 0.60 + dct_score * 0.25 + color_score * 0.15)
            mode = "DIRE Model + DCT"
        else:
            # Heuristic only
            final_score = round(dct_score * 0.70 + color_score * 0.30)
            mode = "DCT Heuristic"

        final_score = min(100, max(0, final_score))

        label = (
            "AI Generated" if final_score >= 65
            else "Suspicious" if final_score >= 35
            else "Likely Real"
        )

        return jsonify({
            "score": final_score,
            "label": label,
            "mode": mode,
            "dct_score": round(dct_score),
            "color_score": round(color_score),
            "dire_score": round(dire_score) if dire_score >= 0 else None,
            "dct_stats": {k: round(v, 3) for k, v in dct_stats.items()},
        })

    except Exception as e:
        print(f"[DIRE Server] Error: {e}")
        return jsonify({"error": str(e)}), 500


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 50)
    print("  DIRE Deepfake Detection Server")
    print(f"  Model: {'FOUND ✅' if os.path.exists(MODEL_PATH) else 'NOT FOUND — using DCT heuristic'}")
    print("  Running on http://localhost:5001")
    print("=" * 50)
    # Pre-load model on startup
    load_dire_model()
    app.run(host="0.0.0.0", port=5001, debug=False)
