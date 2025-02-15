import json
import numpy as np
import mlx_whisper
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn
from transformers import pipeline
pipe = pipeline("translation", model="Helsinki-NLP/opus-mt-tc-bible-big-mul-mul")

def translate_progrev():
    for i in range(10):
        res = pipe(">>eng<< Привет, как дела?", max_length=1024)
        res = pipe(">>rus<< Hello, how're you?", max_length=1024)

def translate(result, lang):
    result_tranlate = pipe(f">>{lang}<< " + result, max_length=1024)
    return result_tranlate

app = FastAPI()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    audio_buffer = bytearray()
    print("Клиент подключился, жду аудиоданные...")
    print("Начинаю прогрев:")
    translate_progrev()
    print("Прогрев завершен!")
    async def transcription_loop():
        while True:
            await asyncio.sleep(3)  # интервал между транскрипциями (настройте по необходимости)
            if len(audio_buffer) > 0:
                # Скопировать и очистить буфер, чтобы не потерять входящие данные
                current_audio = bytes(audio_buffer)
                audio_buffer.clear()
                # Преобразование байтов в numpy-массив (int16 -> float32 [-1, 1])
                audio_data = np.frombuffer(current_audio, dtype=np.int16).astype(np.float32) / 32768.0
                print("Отправляю буфер в MLX Whisper...")
                result = mlx_whisper.transcribe(
                    audio_data,
                    path_or_hf_repo="mlx-community/whisper-large-v3-turbo"
                )["text"]
                print("Распознанный текст:", result)
                #result_tranlate = pipe(">>eng<< "+ result, max_length=1024)
                result_translate = translate(result, "en")
                print("Переведенный текст:", result_translate[0]['translation_text'])

                # Отправляем результат клиенту в виде JSON
                await websocket.send_text(json.dumps({"result": result}))

    # Запуск фоновой задачи для периодической транскрипции
    transcription_task = asyncio.create_task(transcription_loop())

    try:
        while True:
            message = await websocket.receive()
            if "text" in message:
                try:
                    data_json = json.loads(message["text"])
                    # Если потребуется обрабатывать команды, можно добавить здесь условия
                except json.JSONDecodeError:
                    pass
            elif "bytes" in message:
                audio_buffer.extend(message["bytes"])
    except WebSocketDisconnect:
        transcription_task.cancel()
        print("Клиент отключился.")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)