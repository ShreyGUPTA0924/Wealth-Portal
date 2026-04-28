import os
import json
from typing import List
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter
from pydantic import BaseModel
import google.generativeai as genai

router = APIRouter()

genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))
model = genai.GenerativeModel("gemini-2.5-flash")


class HealthScoreRequest(BaseModel):
    portfolio: dict
    goals: List[dict]
    checklist_history: List[dict]


def _clamp(val: float) -> float:
    return max(0.0, min(100.0, val))


def _score_diversification(portfolio: dict) -> float:
    allocation = portfolio.get("allocation", [])
    total_value = float(portfolio.get("currentValue") or 0)
    # No portfolio → 0
    if total_value <= 0:
        return 0.0
    asset_classes = {a.get("assetClass") for a in allocation if float(a.get("value") or a.get("currentValue") or 0) > 0}
    # 1 class = 10, 2 = 25, 3 = 45, 4 = 60, 5 = 75, 6+ = 90 (capped at 90 to leave room for improvement)
    thresholds = [0, 10, 25, 45, 60, 75, 90]
    score = thresholds[min(len(asset_classes), len(thresholds) - 1)]
    return _clamp(float(score))


def _score_goal_progress(goals: List[dict]) -> float:
    # No goals set → 0 (user hasn't engaged with goal planning)
    if not goals:
        return 0.0
    total_pct = sum(float(g.get("progressPercent", 0)) for g in goals)
    return _clamp(total_pct / len(goals))


def _score_portfolio_quality(portfolio: dict) -> float:
    total_value = float(portfolio.get("currentValue") or 0)
    holdings = portfolio.get("holdings", [])
    # Empty portfolio → 0
    if total_value <= 0 or not holdings:
        return 0.0

    score = 70.0

    for h in holdings:
        if h.get("assetClass") == "MUTUAL_FUND":
            er = float(h.get("expenseRatio") or 0)
            if er > 2.0:
                score -= 10
            elif er > 1.0:
                score -= 5

    equity_classes = {"STOCK", "MUTUAL_FUND"}
    equity_value = sum(
        float(a.get("value") or a.get("currentValue") or 0)
        for a in portfolio.get("allocation", [])
        if a.get("assetClass") in equity_classes
    )
    equity_pct = (equity_value / total_value) * 100
    risk_profile = portfolio.get("riskProfile", "MODERATE")
    if risk_profile == "CONSERVATIVE" and equity_pct > 60:
        score -= 15
    elif risk_profile == "AGGRESSIVE" and equity_pct < 60:
        score -= 10
    elif risk_profile == "MODERATE" and (equity_pct < 40 or equity_pct > 75):
        score -= 10

    return _clamp(score)


def _score_financial_discipline(checklist_history: List[dict]) -> float:
    # No checklist set up → 0 (user hasn't set up bill tracking)
    if not checklist_history:
        return 0.0

    three_months_ago = datetime.now(timezone.utc) - timedelta(days=90)
    recent = [
        e for e in checklist_history
        if _parse_date(e.get("monthYear", "")) >= three_months_ago
    ]

    if not recent:
        return 0.0

    total = len(recent)
    paid = sum(1 for e in recent if e.get("isPaid", False))
    return _clamp((paid / total) * 100)


def _parse_date(date_str: str) -> datetime:
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except Exception:
        return datetime.min.replace(tzinfo=timezone.utc)


def _generate_summary(scores: dict) -> str:
    prompt = f"""You are a financial advisor. Write exactly 2 sentences summarising this financial health score for an Indian investor.
Be specific, mention the strongest and weakest areas. Use â‚¹ / Indian context.

Scores:
- Overall: {scores['overall']:.0f}/100
- Diversification: {scores['diversification']:.0f}/100
- Goal Progress: {scores['goals']:.0f}/100
- Portfolio Quality: {scores['quality']:.0f}/100
- Financial Discipline: {scores['discipline']:.0f}/100

Write 2 sentences only, no bullet points."""
    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception:
        overall = scores["overall"]
        if overall >= 70:
            return "Your financial health looks strong with good diversification and consistent discipline. Keep up the momentum and review your goal progress quarterly."
        elif overall >= 40:
            return "Your portfolio shows moderate financial health with room for improvement. Focus on diversification and staying consistent with your financial checklist."
        else:
            return "Your financial health needs attention across multiple areas. Start by diversifying your portfolio and setting up automatic SIPs for your goals."


@router.post("/health-score")
async def health_score(request: HealthScoreRequest):
    diversification = _score_diversification(request.portfolio)
    goals_score = _score_goal_progress(request.goals)
    quality = _score_portfolio_quality(request.portfolio)
    discipline = _score_financial_discipline(request.checklist_history)

    overall = _clamp(
        diversification * 0.25
        + goals_score * 0.30
        + quality * 0.25
        + discipline * 0.20
    )

    scores = {
        "overall": overall,
        "diversification": diversification,
        "goals": goals_score,
        "quality": quality,
        "discipline": discipline,
    }

    summary = _generate_summary(scores)

    return {
        "overall": round(overall, 1),
        "breakdown": {
            "diversification": round(diversification, 1),
            "goals": round(goals_score, 1),
            "quality": round(quality, 1),
            "discipline": round(discipline, 1),
        },
        "summary": summary,
    }

