import torch
from transformers import AutoProcessor, AutoModelForImageTextToText

GEMMA_MODEL_ID = "google/gemma-3n-E4B-it"

processor = AutoProcessor.from_pretrained(GEMMA_MODEL_ID, device_map="cpu")
model = AutoModelForImageTextToText.from_pretrained(
            GEMMA_MODEL_ID, torch_dtype="auto", device_map="cpu")

messages = [
    {
        "role": "user",
        "content": [
            {"type": "audio", "audio": "https://ai.google.dev/gemma/docs/audio/roses-are.wav"},
            {"type": "text", "text": "Transcribe this audio and complete the statement"},
        ]
    }
]

input_ids = processor.apply_chat_template(
        messages,
        add_generation_prompt=True,
        tokenize=True, return_dict=True,
        return_tensors="pt",
)
input_ids = input_ids.to(model.device, dtype=model.dtype)

outputs = model.generate(**input_ids, max_new_tokens=512)

text = processor.batch_decode(
    outputs,
    skip_special_tokens=False,
    clean_up_tokenization_spaces=False
)
print(text[0])