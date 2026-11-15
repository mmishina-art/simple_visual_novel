#!/usr/bin/env python3
"""Gemini 3.8 TTS helper.

Usage: gemini38_tts.py <text_file> <voice_name> <out_wav> [model] [style]

3.8 系 TTS は本文（トランスクリプト）をそのまま読み上げるため、スタイル指示を
本文に混ぜてはいけない。スタイルは各 part の speechMetadata.style に分離して渡す
（公式の作法。旧来の gemini_tts.py の「本文への前置」とは違う）。
応答は WAV が直接返るのでそのまま保存する（PCM で返った場合だけ 24kHz/16bit/mono
としてラップする）。
API キーの渡し方（どちらか）:
- 環境変数 GEMINI_API_KEY があれば、それを x-goog-api-key ヘッダーで直接使う
  （通常の開発環境はこちら。Google AI Studio の API キーを Paid tier で用意すること）。
- なければ Muse の資格情報プロキシ（dynamic_credentials）経由で差し込む
  （Muse の実行環境専用の経路）。
"""
import base64
import json
import os
import sys
import urllib.request
import wave

API_KEY = os.environ.get("GEMINI_API_KEY", "")
if not API_KEY:
    # Muse の実行環境では資格情報プロキシ経由でキーを差し込む
    sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
    from dynamic_credentials import add_surrogate_to_request, read_json_response
else:
    add_surrogate_to_request = None  # type: ignore

    def read_json_response(response):  # type: ignore
        return json.loads(response.read().decode("utf-8"))

HOST = "generativelanguage.googleapis.com"
DEFAULT_MODEL = "gemini-3.8-flash-tts"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        raise RuntimeError("redirect refused, verify the endpoint")


def synthesize(text: str, voice: str, model: str, style: str) -> tuple[bytes, str]:
    url = f"https://{HOST}/v1beta/models/{model}:generateContent"
    part: dict = {"text": text}
    if style:
        part["speechMetadata"] = {"style": style}
    body = {
        "contents": [{"parts": [part]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {"voiceName": voice}
                }
            },
        },
    }
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["x-goog-api-key"] = API_KEY
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    if not API_KEY:
        add_surrogate_to_request(request, "custom.google-gemini-api", allowed_hosts=[HOST])
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=300) as response:
        payload = read_json_response(response)
    parts = payload["candidates"][0]["content"]["parts"]
    for part in parts:
        inline = part.get("inlineData")
        if inline and inline.get("data"):
            return base64.b64decode(inline["data"]), inline.get("mimeType", "")
    raise RuntimeError(f"no audio in response: {json.dumps(payload)[:500]}")


def main() -> None:
    text_file, voice, out_wav = sys.argv[1], sys.argv[2], sys.argv[3]
    model = sys.argv[4] if len(sys.argv) > 4 else DEFAULT_MODEL
    style = sys.argv[5] if len(sys.argv) > 5 else ""
    text = open(text_file, encoding="utf-8").read().strip()
    data, mime = synthesize(text, voice, model, style)
    if "wav" in mime.lower():
        with open(out_wav, "wb") as f:
            f.write(data)
        kind = "wav-passthrough"
    else:
        with wave.open(out_wav, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(24000)
            w.writeframes(data)
        kind = f"pcm-wrapped(mime={mime})"
    print(f"wrote {out_wav} ({len(data)} bytes, {kind})")


if __name__ == "__main__":
    main()
