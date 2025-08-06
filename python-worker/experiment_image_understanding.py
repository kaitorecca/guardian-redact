import torch
from transformers import pipeline

GEMMA_MODEL_ID = "google/gemma-3n-E4B-it"

pipeline = pipeline(
    task="image-text-to-text", # required for image input
    model=GEMMA_MODEL_ID,
    device=0,
    torch_dtype=torch.bfloat16
)

messages = [
    {
        "role": "user",
        "content": [
            {"type": "image", "url": "https://ai.google.dev/static/gemma/docs/images/thali-indian-plate.jpg"},
            {"type": "text", "text": "What is shown in this image?"},
        ]
    },
    {
        "role": "assistant",
        "content": [
            {"type": "text", "text": "This image shows"},
        ],
    },
]

pipeline(text=messages, max_new_tokens=250, return_full_text=False)