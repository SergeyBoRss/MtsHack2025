import torch
import sounddevice as sd
import numpy as np
import time

language_configs = {
    "ru": {
        "language": "ru",
        "version": "v4_ru",
        "speaker": "kseniya",
        "sample_rate": 8000,
        "text_pr": "Привет, как дела?"
    },
    "en": {
        "language": "en",
        "version": "v3_en",
        "speaker": "en_0",
        "sample_rate": 8000,
        "text_pr": "Hello, how are you?"
    },
    "fr": {
        "language": "fr",
        "version": "v3_fr",
        "speaker": "fr_0",
        "sample_rate": 8000,
        "text_pr": "Bonjour, comment ça va?"
    },
    "sp": {
        "language": "es",
        "version": "v3_es",
        "speaker": "es_0",
        "sample_rate": 8000,
        "text_pr": "Hola, ¿cómo estás?"
    }
}

models = {}

# Загрузка моделей
for lang, cfg in language_configs.items():
    print(f"Загружаем модель для языка '{lang}' ({cfg['version']})...")
    start_load_time = time.perf_counter()
    model, _ = torch.hub.load(
        'snakers4/silero-models',
        'silero_tts',
        language=cfg["language"],
        speaker=cfg["version"]
    )
    load_time = time.perf_counter() - start_load_time
    print(f"Модель для языка '{lang}' загружена за {load_time:.2f} сек.")
    models[lang] = model

# Прогрев моделей (генерация простого текста 3 раза)
for lang, cfg in language_configs.items():
    model = models[lang]
    warmup_text = "Прогрев модели" if lang == "ru" else "Warmup model"
    print(f"\nПрогрев модели для языка '{lang}'...")
    for i in range(3):
        start_warmup_time = time.perf_counter()
        _ = model.apply_tts(
            text=warmup_text,
            speaker=cfg["speaker"],
            sample_rate=cfg["sample_rate"]
        )
        warmup_time = time.perf_counter() - start_warmup_time
        print(f"[{i + 1}/3] Прогрев для '{lang}' завершён за {warmup_time:.2f} сек.")


print(models)
print(language_configs)

def tts_langs(language, text):
    model_my = models[language]
    config = language_configs[language]
    print(f"\nГенерация аудио для языка '{language}'...")
    start_gen_time = time.perf_counter()
    audio = model_my.apply_tts(
        text=text,
        speaker=config["speaker"],
        sample_rate=config["sample_rate"]
    )
    gen_time = time.perf_counter() - start_gen_time
    print(f"Аудио для языка '{language}' сгенерировано за {gen_time:.2f} сек.")

    print("Воспроизведение аудио...")
    sd.play(np.array(audio), samplerate=cfg["sample_rate"])
    sd.wait()


tts_langs("ru", "Что-то надо думать")