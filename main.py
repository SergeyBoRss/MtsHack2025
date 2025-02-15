import json
import numpy as np
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn

from tts import tts_langs
from stt import transcribe, detect_speech
from translation import translate

app = FastAPI()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    audio_buffer = bytearray()
    audio_accumulated = []
    collecting_speech = False
    silence_counter = 0
    silence_threshold = 2

    try:
        language_message = await websocket.receive_text()
        language = json.loads(language_message).get("language", "ru")
    except Exception as e:
        print(f"Ошибка получения языка: {e}")
        language = "ru"

    async def transcription_loop():
        nonlocal collecting_speech, silence_counter, audio_accumulated

        while True:
            await asyncio.sleep(0.5)

            if len(audio_buffer) == 0:
                continue

            current_audio = bytes(audio_buffer)
            audio_buffer.clear()

            audio_data = np.frombuffer(current_audio, dtype=np.int16).astype(np.float32) / 32768.0

            if detect_speech(audio_data):
                if not collecting_speech:
                    collecting_speech = True
                    audio_accumulated = []

                silence_counter = 0
                audio_accumulated.append(audio_data)

            elif collecting_speech:
                silence_counter += 1

                if silence_counter >= silence_threshold:
                    collecting_speech = False
                    full_audio = np.concatenate(audio_accumulated)

                    result_text = transcribe(full_audio)
                    print(f"Распознанный текст: {result_text}")
                    await websocket.send_text(json.dumps({"result": result_text}))

                    translated_text = translate(result_text, f'{"eng" if language == "en" else language}')
                    print(f"Перевод: {translated_text}")
                    await websocket.send_text(json.dumps({"translation": translated_text}))

                    if translated_text.strip():
                        try:
                            tts_langs(language, translated_text)
                        except ValueError as e:
                            print(f"Ошибка в TTS: {e}")

                    audio_accumulated = []

    transcription_task = asyncio.create_task(transcription_loop())

    try:
        while True:
            message = await websocket.receive()
            if "bytes" in message:
                audio_buffer.extend(message["bytes"])
    except WebSocketDisconnect:
        transcription_task.cancel()


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
