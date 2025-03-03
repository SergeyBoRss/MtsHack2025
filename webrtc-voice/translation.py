from transformers import pipeline

print("Загрузка модели перевода...")
translator = pipeline("translation", model="Helsinki-NLP/opus-mt-tc-bible-big-mul-mul")

def translate(text, lang="eng"):
    result_translate = translator(f">>{lang}<< " + text, max_length=1024)
    return result_translate[0]["translation_text"]