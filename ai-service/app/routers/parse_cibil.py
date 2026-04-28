import os
import json
import re
from typing import Optional
from fastapi import APIRouter, File, UploadFile
import google.generativeai as genai

router = APIRouter()

try:
    import pdfplumber
except ImportError:
    pdfplumber = None  # type: ignore

genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))
model = genai.GenerativeModel("gemini-2.5-flash")

CIBIL_PROMPT = """You are parsing an Indian CIBIL credit report. Extract all active loans and credit card accounts.
For each one return:
- label: e.g. "HDFC Home Loan EMI", "SBI Credit Card"
- category: one of EMI_HOME_LOAN, EMI_CAR_LOAN, EMI_PERSONAL_LOAN, CREDIT_CARD
- amount: monthly EMI or minimum payment in INR as a number
- dueDayOfMonth: due date as integer 1-31, use 5 if unknown

Return ONLY a valid JSON array of objects, no explanation, no markdown. Example:
[{"label":"HDFC Home Loan","category":"EMI_HOME_LOAN","amount":45000,"dueDayOfMonth":5},{"label":"SBI Credit Card","category":"CREDIT_CARD","amount":5000,"dueDayOfMonth":15}]"""


def extract_text_from_pdf(file_bytes: bytes) -> str:
    if pdfplumber is None:
        raise ImportError("pdfplumber is required. Install with: pip install pdfplumber")
    import io
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        text_parts = []
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text_parts.append(t)
        return "\n".join(text_parts) if text_parts else ""


def parse_json_array(text: str) -> list:
    """Extract JSON array from model response, handling markdown code blocks."""
    text = text.strip()
    # Remove markdown code blocks if present
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    # Find array
    match = re.search(r'\[[\s\S]*\]', text)
    if match:
        return json.loads(match.group())
    return json.loads(text)


@router.post("/parse-cibil")
async def parse_cibil(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return {"suggestions": [], "error": "Only PDF files are allowed"}

    try:
        contents = await file.read()
    except Exception as e:
        return {"suggestions": [], "error": f"Could not read file: {str(e)}"}

    if len(contents) > 10 * 1024 * 1024:  # 10MB
        return {"suggestions": [], "error": "File too large"}

    try:
        text = extract_text_from_pdf(contents)
    except Exception as e:
        return {"suggestions": [], "error": f"Could not extract text from PDF: {str(e)}"}

    if not text or len(text.strip()) < 100:
        return {"suggestions": [], "error": "Could not parse CIBIL report - PDF may be empty or not a CIBIL report"}

    try:
        response = await model.generate_content_async(
            f"{CIBIL_PROMPT}\n\n---\n\nExtract from this CIBIL report:\n\n{text[:50000]}"
        )
        raw = response.text if hasattr(response, "text") else str(response)
        items = parse_json_array(raw)
    except json.JSONDecodeError as e:
        return {"suggestions": [], "error": "Could not parse CIBIL report"}
    except Exception as e:
        return {"suggestions": [], "error": f"Could not parse CIBIL report: {str(e)[:200]}"}

    suggestions = []
    valid_categories = {"EMI_HOME_LOAN", "EMI_CAR_LOAN", "EMI_PERSONAL_LOAN", "CREDIT_CARD"}
    for item in items:
        if not isinstance(item, dict):
            continue
        label = item.get("label") or item.get("name") or ""
        category = (item.get("category") or "CREDIT_CARD").upper().replace(" ", "_")
        if category not in valid_categories:
            category = "CREDIT_CARD"
        amount = item.get("amount")
        if amount is None:
            amount = item.get("emi") or item.get("monthly_payment") or 0
        try:
            amount = float(amount) if amount else 0
        except (TypeError, ValueError):
            amount = 0
        due_day = item.get("dueDayOfMonth") or item.get("due_day") or 5
        try:
            due_day = int(due_day)
            due_day = max(1, min(31, due_day))
        except (TypeError, ValueError):
            due_day = 5
        if label and amount > 0:
            suggestions.append({
                "label": str(label).strip(),
                "category": category,
                "amount": round(amount, 2),
                "dueDayOfMonth": due_day,
            })

    return {"suggestions": suggestions}
