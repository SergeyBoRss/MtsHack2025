import torch
import sounddevice as sd
import numpy as np
import time

language_configs = {
    "ru": {
        "language": "ru",
        "version": "v4_ru",
        "speaker": "kseniya",
        "sample_rate": 8000
    },
    "en": {
        "language": "en",
        "version": "v3_en",
        "speaker": "en_0",
        "sample_rate": 8000
    },
    "fr": {
        "language": "fr",
        "version": "v3_fr",
        "speaker": "fr_0",
        "sample_rate": 8000
    },
    "sp": {
        "language": "es",
        "version": "v3_es",
        "speaker": "es_0",
        "sample_rate": 8000
    }
}

models = {}


def load_and_warmup_models():
    for lang, cfg in language_configs.items():
        model, _ = torch.hub.load(
            'snakers4/silero-models',
            'silero_tts',
            language=cfg["language"],
            speaker=cfg["version"]
        )
        models[lang] = model


def tts_langs(language, text):
    model_my = models[language]
    config = language_configs[language]
    audio = model_my.apply_tts(
        text=text,
        speaker=config["speaker"],
        sample_rate=config["sample_rate"]
    )
    sd.play(np.array(audio), samplerate=config["sample_rate"])
    sd.wait()


load_and_warmup_models()
