import asyncio
import edge_tts
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="Edge-TTS Service for XunHui")

class TTSRequest(BaseModel):
    text: str
    voice: str = "zh-CN-XiaoyiNeural"   # 默认甜美女声

@app.post("/synthesize/")
async def synthesize(request: TTSRequest):
    try:
        communicate = edge_tts.Communicate(request.text, request.voice)
        # 收集音频数据
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
        # 返回 MP3 音频流
        return Response(content=audio_data, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)