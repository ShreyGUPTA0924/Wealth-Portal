import os
import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted

# Try to load fallback keys, fallback to the original if only 1 exists
keys = [
    os.environ.get("GEMINI_API_KEY_1", os.environ.get("GEMINI_API_KEY", "")),
    os.environ.get("GEMINI_API_KEY_2", ""),
    os.environ.get("GEMINI_API_KEY_3", ""),
]

# Keep only non-empty keys
valid_keys = [k for k in keys if k and k.strip()]

class RobustGeminiClient:
    def __init__(self, model_name="gemini-2.5-flash"):
        self.model_name = model_name
        self.current_key_idx = 0

    def _get_configured_model(self):
        if not valid_keys:
            raise ValueError("No valid GEMINI_API_KEY provided. Please set GEMINI_API_KEY_1.")
        key = valid_keys[self.current_key_idx]
        genai.configure(api_key=key)
        return genai.GenerativeModel(self.model_name)

    def rotate_key(self):
        if not valid_keys:
            return
        self.current_key_idx = (self.current_key_idx + 1) % len(valid_keys)
        print(f"[Gemini Fallback] Rate limit reached. Switched to API key index {self.current_key_idx + 1} of {len(valid_keys)}")

    def generate_content(self, prompt, **kwargs):
        attempts = 0
        max_attempts = max(1, len(valid_keys))
        
        while attempts < max_attempts:
            model = self._get_configured_model()
            try:
                return model.generate_content(prompt, **kwargs)
            except ResourceExhausted:
                self.rotate_key()
                attempts += 1
                if attempts >= max_attempts:
                    raise
            except Exception:
                raise

    async def generate_content_async(self, prompt, **kwargs):
        attempts = 0
        max_attempts = max(1, len(valid_keys))
        
        while attempts < max_attempts:
            model = self._get_configured_model()
            try:
                return await model.generate_content_async(prompt, **kwargs)
            except ResourceExhausted:
                self.rotate_key()
                attempts += 1
                if attempts >= max_attempts:
                    raise
            except Exception:
                raise
