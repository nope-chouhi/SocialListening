"""
Flask sentiment analysis microservice (DistilBERT SST-2).
Run: python app.py  (port 5001)
"""
import os
from flask import Flask, request, jsonify

app = Flask(__name__)

_sentiment_pipeline = None


def get_pipeline():
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        from transformers import pipeline
        _sentiment_pipeline = pipeline(
            "sentiment-analysis",
            model="distilbert-base-uncased-finetuned-sst-2-english",
        )
    return _sentiment_pipeline


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "sentiment"})


@app.route("/api/ai/sentiment", methods=["POST"])
def analyze_sentiment():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"sentiment": "neutral", "score": 0, "confidence": 0})

    try:
        pipe = get_pipeline()
        result = pipe(text[:512])[0]
        label = (result.get("label") or "").lower()
        score = float(result.get("score", 0))

        if label in ("neg", "negative"):
            sentiment = "negative"
        elif label in ("pos", "positive"):
            sentiment = "positive"
        else:
            sentiment = "neutral"

        return jsonify({
            "sentiment": sentiment,
            "score": score,
            "confidence": score,
        })
    except Exception as e:
        return jsonify({"sentiment": "neutral", "score": 0, "confidence": 0, "error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.getenv("SENTIMENT_PORT", "5001"))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
