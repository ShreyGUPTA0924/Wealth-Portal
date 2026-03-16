import os
import json
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter
from pydantic import BaseModel
import google.generativeai as genai

router = APIRouter()

genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))
model = genai.GenerativeModel("gemini-flash-latest")


class NudgeAnalyseRequest(BaseModel):
    portfolio: dict
    goals: List[dict]
    risk_profile: str


class NudgeResult(BaseModel):
    nudgeType: str
    title: str
    message: str
    severity: str
    relatedHoldingId: Optional[str] = None
    relatedGoalId: Optional[str] = None


def _generate_nudge_message(issue_type: str, context: dict) -> str:
    prompt = f"""You are a friendly Indian financial advisor. Write a brief, actionable nudge message (2-3 sentences max) for this issue:

Issue: {issue_type}
Context: {json.dumps(context)}

Be specific, use INR amounts where relevant, and suggest a clear next action. Use a warm, encouraging tone."""
    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception:
        return context.get("default_message", "Please review this financial concern.")


@router.post("/nudges/analyse")
async def analyse_nudges(request: NudgeAnalyseRequest):
    nudges: List[dict] = []
    portfolio = request.portfolio
    goals = request.goals
    risk_profile = request.risk_profile

    holdings = portfolio.get("holdings", [])
    allocation = portfolio.get("allocation", [])
    total_value = portfolio.get("currentValue", 0)

    # a) High expense ratio: MF holding with expense_ratio > 1%
    for h in holdings:
        if h.get("assetClass") == "MUTUAL_FUND":
            expense_ratio = h.get("expenseRatio", 0) or 0
            if float(expense_ratio) > 1.0:
                message = _generate_nudge_message(
                    "High expense ratio mutual fund",
                    {
                        "fund_name": h.get("name"),
                        "expense_ratio": expense_ratio,
                        "default_message": f"Your mutual fund '{h.get('name')}' has an expense ratio of {expense_ratio}% which is above 1%. Consider switching to a lower-cost direct plan to save on fees.",
                    },
                )
                nudges.append(
                    {
                        "nudgeType": "EXPENSE_RATIO",
                        "title": f"High Expense Ratio: {h.get('name', 'Fund')}",
                        "message": message,
                        "severity": "WARNING",
                        "relatedHoldingId": h.get("id"),
                        "relatedGoalId": None,
                    }
                )

    # b) Concentration risk: single stock > 20% of portfolio
    if total_value and float(total_value) > 0:
        for h in holdings:
            if h.get("assetClass") == "STOCK":
                holding_value = float(h.get("currentValue") or 0)
                weight = (holding_value / float(total_value)) * 100
                if weight > 20:
                    message = _generate_nudge_message(
                        "Stock concentration risk",
                        {
                            "stock_name": h.get("name"),
                            "weight_percent": round(weight, 1),
                            "default_message": f"'{h.get('name')}' makes up {round(weight,1)}% of your portfolio. Heavy concentration in a single stock increases risk significantly. Consider diversifying.",
                        },
                    )
                    nudges.append(
                        {
                            "nudgeType": "CONCENTRATION",
                            "title": f"Concentration Risk: {h.get('name', 'Stock')}",
                            "message": message,
                            "severity": "URGENT",
                            "relatedHoldingId": h.get("id"),
                            "relatedGoalId": None,
                        }
                    )

    # c) SIP underperformance: pnlPercent < -10%
    for h in holdings:
        pnl_pct = float(h.get("pnlPercent") or 0)
        if pnl_pct < -10:
            message = _generate_nudge_message(
                "SIP underperformance",
                {
                    "holding_name": h.get("name"),
                    "pnl_percent": round(pnl_pct, 1),
                    "default_message": f"'{h.get('name')}' is down {abs(round(pnl_pct,1))}%. Review if this investment still aligns with your goals.",
                },
            )
            nudges.append(
                {
                    "nudgeType": "SIP_UNDERPERFORM",
                    "title": f"Underperforming: {h.get('name', 'Holding')}",
                    "message": message,
                    "severity": "WARNING",
                    "relatedHoldingId": h.get("id"),
                    "relatedGoalId": None,
                }
            )

    # d) Rebalancing needed: equity > 80% or < 40%
    equity_classes = {"STOCK", "MUTUAL_FUND"}
    equity_value = sum(
        float(a.get("currentValue") or 0)
        for a in allocation
        if a.get("assetClass") in equity_classes
    )
    if total_value and float(total_value) > 0:
        equity_pct = (equity_value / float(total_value)) * 100
        if equity_pct > 80 or equity_pct < 40:
            direction = "heavy" if equity_pct > 80 else "light"
            message = _generate_nudge_message(
                "Portfolio rebalancing needed",
                {
                    "equity_percent": round(equity_pct, 1),
                    "risk_profile": risk_profile,
                    "default_message": f"Your equity allocation is {round(equity_pct,1)}% which is {direction} for a {risk_profile} investor. Consider rebalancing towards your target allocation.",
                },
            )
            nudges.append(
                {
                    "nudgeType": "REBALANCE",
                    "title": "Portfolio Rebalancing Needed",
                    "message": message,
                    "severity": "WARNING",
                    "relatedHoldingId": None,
                    "relatedGoalId": None,
                }
            )

    # e) Goal at risk: any goal with healthStatus AT_RISK or OFF_TRACK
    for g in goals:
        status = g.get("healthStatus", "")
        if status in ("AT_RISK", "OFF_TRACK"):
            severity = "URGENT" if status == "OFF_TRACK" else "WARNING"
            message = _generate_nudge_message(
                f"Financial goal {status.lower().replace('_', ' ')}",
                {
                    "goal_name": g.get("name"),
                    "progress_percent": g.get("progressPercent", 0),
                    "target_date": g.get("targetDate", ""),
                    "default_message": f"Your goal '{g.get('name')}' is {status.lower().replace('_', ' ')} at {g.get('progressPercent', 0):.0f}% progress. Increase your monthly SIP to get back on track.",
                },
            )
            nudges.append(
                {
                    "nudgeType": "HEALTH_REPORT",
                    "title": f"Goal {status.replace('_', ' ').title()}: {g.get('name', 'Goal')}",
                    "message": message,
                    "severity": severity,
                    "relatedHoldingId": None,
                    "relatedGoalId": g.get("id"),
                }
            )

    # f) FD maturity within 30 days
    now = datetime.now(timezone.utc)
    for h in holdings:
        if h.get("assetClass") == "FD" and h.get("maturityDate"):
            try:
                maturity = datetime.fromisoformat(
                    str(h["maturityDate"]).replace("Z", "+00:00")
                )
                days_left = (maturity - now).days
                if 0 <= days_left <= 30:
                    message = _generate_nudge_message(
                        "FD maturing soon",
                        {
                            "fd_name": h.get("name"),
                            "days_left": days_left,
                            "amount": h.get("currentValue"),
                            "default_message": f"Your FD '{h.get('name')}' matures in {days_left} days. Plan your reinvestment strategy now to avoid idle funds.",
                        },
                    )
                    nudges.append(
                        {
                            "nudgeType": "HEALTH_REPORT",
                            "title": f"FD Maturing Soon: {h.get('name', 'FD')}",
                            "message": message,
                            "severity": "INFO",
                            "relatedHoldingId": h.get("id"),
                            "relatedGoalId": None,
                        }
                    )
            except Exception:
                pass

    return {"nudges": nudges, "count": len(nudges)}

