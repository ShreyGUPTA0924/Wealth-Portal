import os
import json
from typing import Optional
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import google.generativeai as genai

router = APIRouter()

genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))
model = genai.GenerativeModel("gemini-flash-latest")

SYSTEM_PROMPT = """You are WealthPortal AI, a personal financial advisor for Indian investors.
You have access to the user complete financial data.
Always give advice specific to their portfolio. Use INR currency.
Be concise, friendly, and actionable. Never give generic advice.
Format numbers in Indian format (lakhs, crores).
Keep responses under 300 words unless the user asks for detailed analysis."""


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    user_context: Optional[dict] = None


@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    portfolio = request.user_context.get("portfolio") if request.user_context and isinstance(request.user_context, dict) else None
    goals = request.user_context.get("goals", []) if request.user_context else []
    risk = request.user_context.get("risk_profile", "MODERATE") if request.user_context else "MODERATE"

    context_lines = [f"Risk Profile: {risk}"]
    if portfolio:
        context_lines.append(f"Portfolio Value: INR {portfolio.get('currentValue', 0):,.0f}")
        context_lines.append(f"Total Invested: INR {portfolio.get('totalInvested', 0):,.0f}")
        pnl = portfolio.get("pnlAbsolute", 0) or portfolio.get("currentValue", 0) - portfolio.get("totalInvested", 0)
        context_lines.append(f"Overall P&L: INR {pnl:,.0f}")
        alloc = portfolio.get("allocation", [])
        if alloc:
            top = sorted(alloc, key=lambda x: x.get("weight", 0), reverse=True)[:3]
            context_lines.append("Top allocations: " + ", ".join(f"{a.get('assetClass')} {a.get('weight', 0):.1f}%" for a in top))
    if goals:
        context_lines.append(f"Active goals: {len(goals)}")
        for g in goals[:3]:
            context_lines.append(f"  - {g.get('name')}: {g.get('progressPercent', 0):.0f}% complete ({g.get('healthStatus')})")

    context_summary = "\n".join(context_lines)
    full_prompt = f"{SYSTEM_PROMPT}\n\nUSER FINANCIAL CONTEXT:\n{context_summary}\n\nUSER: {request.message}\n\nASSISTANT:"

    async def generate():
        try:
            response = await model.generate_content_async(
                full_prompt,
                stream=True,
            )
            async for chunk in response:
                try:
                    text = chunk.text
                    if text:
                        yield f"data: {json.dumps({'chunk': text})}\n\n"
                except (ValueError, AttributeError):
                    pass
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            error_msg = str(e)
            print(f"[AI Chat Error] {error_msg}")
            yield f"data: {json.dumps({'chunk': f'Sorry, I ran into an issue: {error_msg[:200]}'})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )