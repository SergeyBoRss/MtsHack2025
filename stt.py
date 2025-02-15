import torch
from faster_whisper import WhisperModel

print("Загрузка Whisper...")
whisper_model = WhisperModel("base", device="cpu")

print("Загрузка Silero VAD...")
vad_model, vad_utils = torch.hub.load(
    repo_or_dir='snakers4/silero-vad',
    model='silero_vad',
    force_reload=True
)
(get_speech_timestamps, _, _, _, _) = vad_utils


def transcribe(audio_data):
    segments, _ = whisper_model.transcribe(audio_data, language="ru", word_timestamps=True)
    result_text = "".join([segment.text for segment in segments])
    return result_text


def detect_speech(audio_data, sample_rate=16000):
    audio_tensor = torch.from_numpy(audio_data).unsqueeze(0)
    timestamps = get_speech_timestamps(audio_tensor, vad_model, sampling_rate=sample_rate)
    return len(timestamps) > 0
