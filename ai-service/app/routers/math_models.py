from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd
from scipy.optimize import minimize
from sklearn.ensemble import RandomForestRegressor
import json

router = APIRouter()

# ─── Types ────────────────────────────────────────────────────────────────────
class Holding(BaseModel):
    id: str
    assetClass: str
    symbol: Optional[str] = None
    name: str
    currentValue: float
    totalInvested: float
    pnlPercent: float

class PortfolioPayload(BaseModel):
    holdings: List[Holding]
    currentValue: float

class GoalPayload(BaseModel):
    id: str
    targetAmount: float
    currentAmount: float
    targetDate: str # ISO string

class MonteCarloPayload(BaseModel):
    portfolio: PortfolioPayload
    goal: GoalPayload

# ─── Mock Market Data Generation ──────────────────────────────────────────────
# We generate realistic synthetic data mimicking Indian market performance
# Returns are annualized. Volatility is annualized standard deviation.
ASSET_PROFILES = {
    'STOCK':       {'mu': 0.14, 'sigma': 0.20}, # Nifty 50 average
    'MUTUAL_FUND': {'mu': 0.12, 'sigma': 0.15},
    'GOLD':        {'mu': 0.08, 'sigma': 0.12},
    'FD':          {'mu': 0.07, 'sigma': 0.01},
    'CRYPTO':      {'mu': 0.40, 'sigma': 0.60},
    'REAL_ESTATE': {'mu': 0.10, 'sigma': 0.05},
    'DEFAULT':     {'mu': 0.08, 'sigma': 0.10}
}

def generate_covariance_matrix(asset_classes: List[str]) -> np.ndarray:
    n = len(asset_classes)
    cov_matrix = np.zeros((n, n))
    for i in range(n):
        for j in range(n):
            prof_i = ASSET_PROFILES.get(asset_classes[i], ASSET_PROFILES['DEFAULT'])
            prof_j = ASSET_PROFILES.get(asset_classes[j], ASSET_PROFILES['DEFAULT'])
            # Assume base correlation of 0.3 for everything, except self=1.0
            corr = 1.0 if i == j else 0.3
            # Some specific correlations
            if asset_classes[i] == 'STOCK' and asset_classes[j] == 'GOLD': corr = -0.1
            if asset_classes[i] == 'GOLD' and asset_classes[j] == 'STOCK': corr = -0.1
            if asset_classes[i] == 'CRYPTO' and asset_classes[j] == 'FD': corr = 0.0
            
            cov_matrix[i, j] = corr * prof_i['sigma'] * prof_j['sigma']
    return cov_matrix

# ─── 1. Portfolio Optimization (MPT) ──────────────────────────────────────────

@router.post("/optimize-portfolio")
async def optimize_portfolio(payload: PortfolioPayload):
    if not payload.holdings or payload.currentValue <= 0:
        return {"success": False, "message": "Invalid portfolio"}

    # Group by asset class for optimization simplicity
    asset_sums = {}
    for h in payload.holdings:
        ac = h.assetClass
        asset_sums[ac] = asset_sums.get(ac, 0) + h.currentValue

    asset_classes = list(asset_sums.keys())
    n_assets = len(asset_classes)
    
    if n_assets < 2:
        return {
            "optimal_weights": [{"assetClass": asset_classes[0], "weight": 100.0}],
            "efficient_frontier": []
        }

    current_weights = np.array([asset_sums[ac] / payload.currentValue for ac in asset_classes])
    
    expected_returns = np.array([ASSET_PROFILES.get(ac, ASSET_PROFILES['DEFAULT'])['mu'] for ac in asset_classes])
    cov_matrix = generate_covariance_matrix(asset_classes)

    def portfolio_return(weights):
        return np.sum(expected_returns * weights)
    
    def portfolio_volatility(weights):
        return np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))

    # Minimize volatility for a target return
    def minimize_volatility(weights):
        return portfolio_volatility(weights)

    # Constraints: sum of weights = 1, bounds: 0 <= w <= 1
    constraints = ({'type': 'eq', 'fun': lambda x: np.sum(x) - 1})
    bounds = tuple((0.0, 1.0) for _ in range(n_assets))

    # Find the maximum Sharpe ratio portfolio (Optimal)
    def negative_sharpe(weights):
        rf_rate = 0.06 # Risk free rate
        p_ret = portfolio_return(weights)
        p_vol = portfolio_volatility(weights)
        return -(p_ret - rf_rate) / p_vol

    initial_guess = current_weights
    opt_result = minimize(negative_sharpe, initial_guess, method='SLSQP', bounds=bounds, constraints=constraints)
    optimal_weights_array = opt_result.x

    # Generate Efficient Frontier points
    target_returns = np.linspace(expected_returns.min(), expected_returns.max(), 20)
    efficient_frontier = []
    
    for tr in target_returns:
        cons = ({'type': 'eq', 'fun': lambda x: np.sum(x) - 1},
                {'type': 'eq', 'fun': lambda x: portfolio_return(x) - tr})
        res = minimize(minimize_volatility, initial_guess, method='SLSQP', bounds=bounds, constraints=cons)
        if res.success:
            efficient_frontier.append({
                "return": float(tr * 100), # in %
                "risk": float(res.fun * 100) # in %
            })

    optimal_weights_mapped = [
        {"assetClass": asset_classes[i], "weight": float(optimal_weights_array[i] * 100)}
        for i in range(n_assets)
    ]

    # Current risk and return
    current_return = portfolio_return(current_weights) * 100
    current_risk = portfolio_volatility(current_weights) * 100
    optimal_return = portfolio_return(optimal_weights_array) * 100
    optimal_risk = portfolio_volatility(optimal_weights_array) * 100

    return {
        "current_metrics": {"return": current_return, "risk": current_risk},
        "optimal_metrics": {"return": optimal_return, "risk": optimal_risk},
        "optimal_weights": optimal_weights_mapped,
        "efficient_frontier": efficient_frontier
    }

# ─── 2. Risk Metrics (VaR + CVaR) ─────────────────────────────────────────────

@router.post("/risk-metrics")
async def risk_metrics(payload: PortfolioPayload):
    if not payload.holdings or payload.currentValue <= 0:
         return {"var_95": 0, "cvar_95": 0, "var_amount": 0, "cvar_amount": 0}

    # Synthesize 1 year of daily returns (252 trading days)
    asset_sums = {}
    for h in payload.holdings:
        ac = h.assetClass
        asset_sums[ac] = asset_sums.get(ac, 0) + h.currentValue

    asset_classes = list(asset_sums.keys())
    weights = np.array([asset_sums[ac] / payload.currentValue for ac in asset_classes])
    
    expected_returns = np.array([ASSET_PROFILES.get(ac, ASSET_PROFILES['DEFAULT'])['mu'] for ac in asset_classes])
    cov_matrix = generate_covariance_matrix(asset_classes)
    
    port_mu = np.sum(expected_returns * weights)
    port_sigma = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
    
    # Parametric VaR assuming normal distribution
    from scipy.stats import norm
    confidence_level = 0.95
    z_score = norm.ppf(1 - confidence_level)
    
    # Convert annual to daily
    daily_mu = port_mu / 252
    daily_sigma = port_sigma / np.sqrt(252)
    
    var_95_pct = -(daily_mu + z_score * daily_sigma) * 100 # percentage loss
    # CVaR
    cvar_95_pct = (daily_sigma / (1 - confidence_level)) * norm.pdf(z_score) * 100 - (daily_mu * 100)

    # 1 Month VaR/CVaR might be more meaningful for retail users
    monthly_mu = port_mu / 12
    monthly_sigma = port_sigma / np.sqrt(12)
    var_95_monthly_pct = -(monthly_mu + z_score * monthly_sigma) * 100
    cvar_95_monthly_pct = (monthly_sigma / (1 - confidence_level)) * norm.pdf(z_score) * 100 - (monthly_mu * 100)

    var_amount = (var_95_monthly_pct / 100) * payload.currentValue
    cvar_amount = (cvar_95_monthly_pct / 100) * payload.currentValue

    return {
        "var_95_pct": float(max(0, var_95_monthly_pct)),
        "cvar_95_pct": float(max(0, cvar_95_monthly_pct)),
        "var_amount": float(max(0, var_amount)),
        "cvar_amount": float(max(0, cvar_amount)),
        "message": f"95% chance you won't lose more than ₹{int(max(0, var_amount)):,} in a month."
    }

# ─── 3. Monte Carlo Simulation ────────────────────────────────────────────────

@router.post("/monte-carlo")
async def monte_carlo(payload: MonteCarloPayload):
    from datetime import datetime
    import math

    port = payload.portfolio
    goal = payload.goal

    try:
        target_date = datetime.fromisoformat(goal.targetDate.replace('Z', '+00:00'))
        days_left = (target_date - datetime.now(target_date.tzinfo)).days
        years_left = max(1, days_left / 365.25)
    except Exception:
        years_left = 5 # fallback

    # Calculate portfolio drift (mu) and volatility (sigma)
    asset_sums = {}
    for h in port.holdings:
        ac = h.assetClass
        asset_sums[ac] = asset_sums.get(ac, 0) + h.currentValue

    if not asset_sums:
         # Default to 10% return, 15% vol
         port_mu, port_sigma = 0.10, 0.15
    else:
        asset_classes = list(asset_sums.keys())
        total_val = sum(asset_sums.values())
        weights = np.array([asset_sums[ac] / total_val for ac in asset_classes])
        expected_returns = np.array([ASSET_PROFILES.get(ac, ASSET_PROFILES['DEFAULT'])['mu'] for ac in asset_classes])
        cov_matrix = generate_covariance_matrix(asset_classes)
        
        port_mu = np.sum(expected_returns * weights)
        port_sigma = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))

    # GBM Parameters
    S0 = goal.currentAmount if goal.currentAmount > 0 else 1000 # initial amount
    T = int(years_left)
    num_simulations = 1000
    dt = 1 # annual steps to reduce payload size

    paths = np.zeros((T + 1, num_simulations))
    paths[0] = S0

    for t in range(1, T + 1):
        z = np.random.standard_normal(num_simulations)
        # Assuming they invest monthly SIP, let's say they continue at a rate of 0 (simplified)
        # S_t = S_t-1 * e^((mu - sigma^2 / 2)dt + sigma * sqrt(dt) * Z)
        paths[t] = paths[t - 1] * np.exp((port_mu - 0.5 * port_sigma**2) * dt + port_sigma * math.sqrt(dt) * z)

    # Calculate percentiles
    percentile_10 = np.percentile(paths, 10, axis=1)
    percentile_50 = np.percentile(paths, 50, axis=1)
    percentile_90 = np.percentile(paths, 90, axis=1)

    success_count = np.sum(paths[-1] >= goal.targetAmount)
    probability = (success_count / num_simulations) * 100

    # Format for UI (Recharts)
    chart_data = []
    current_year = datetime.now().year
    for t in range(T + 1):
        chart_data.append({
            "year": str(current_year + t),
            "p10": float(percentile_10[t]),
            "median": float(percentile_50[t]),
            "p90": float(percentile_90[t]),
            "target": float(goal.targetAmount)
        })

    return {
        "probability": float(probability),
        "chart_data": chart_data,
        "final_median": float(percentile_50[-1])
    }

# ─── 4. Custom Risk Scoring Model (AI) ────────────────────────────────────────

# We pre-train a simple Random Forest on synthetic high-quality data
def train_risk_model():
    # Features: volatility, concentration (HHI index), stock_allocation, crypto_allocation
    np.random.seed(42)
    n_samples = 1000
    
    volatilities = np.random.uniform(0.05, 0.40, n_samples)
    concentrations = np.random.uniform(0.1, 1.0, n_samples)
    stock_alloc = np.random.uniform(0, 1.0, n_samples)
    crypto_alloc = np.random.uniform(0, 0.5, n_samples)
    
    # Label engineering: Higher volatility -> Higher risk (1-10)
    # Higher concentration -> Higher risk
    # High crypto -> High risk
    risk_scores = 10 * (volatilities * 1.5 + concentrations * 0.3 + crypto_alloc * 2.0)
    risk_scores = np.clip(np.round(risk_scores), 1, 10)
    
    X = np.column_stack((volatilities, concentrations, stock_alloc, crypto_alloc))
    y = risk_scores
    
    model = RandomForestRegressor(n_estimators=50, random_state=42)
    model.fit(X, y)
    return model

# Train it globally once when module loads
RISK_MODEL = train_risk_model()

@router.post("/custom-risk-score")
async def custom_risk_score(payload: PortfolioPayload):
    if not payload.holdings or payload.currentValue <= 0:
        return {"risk_score": 1, "message": "Low Risk"}

    # Calculate features
    asset_sums = {}
    for h in payload.holdings:
        ac = h.assetClass
        asset_sums[ac] = asset_sums.get(ac, 0) + h.currentValue

    total_val = payload.currentValue
    weights = {ac: val/total_val for ac, val in asset_sums.items()}
    
    # 1. Volatility
    asset_classes = list(asset_sums.keys())
    w_arr = np.array([weights[ac] for ac in asset_classes])
    cov_matrix = generate_covariance_matrix(asset_classes)
    volatility = np.sqrt(np.dot(w_arr.T, np.dot(cov_matrix, w_arr)))
    
    # 2. Concentration (Herfindahl-Hirschman Index)
    hhi = sum([w**2 for w in weights.values()])
    
    # 3. Allocations
    stock_alloc = weights.get('STOCK', 0.0) + weights.get('MUTUAL_FUND', 0.0)
    crypto_alloc = weights.get('CRYPTO', 0.0)
    
    features = np.array([[volatility, hhi, stock_alloc, crypto_alloc]])
    pred_score = RISK_MODEL.predict(features)[0]
    final_score = int(np.clip(round(pred_score), 1, 10))
    
    messages = {
        1: "Extremely Conservative", 2: "Conservative", 3: "Moderately Conservative",
        4: "Moderate", 5: "Moderate", 6: "Moderately Aggressive",
        7: "Aggressive", 8: "Aggressive", 9: "Very Aggressive", 10: "Extremely High Risk"
    }

    return {
        "risk_score": final_score,
        "message": messages.get(final_score, "Moderate"),
        "factors": {
            "volatility": float(volatility),
            "concentration": float(hhi)
        }
    }

# ─── 5. Asset Correlation Heatmap ─────────────────────────────────────────────

@router.post("/correlation")
async def correlation(payload: PortfolioPayload):
    if not payload.holdings:
        return {"matrix": []}

    # Get unique asset classes
    asset_classes = list(set([h.assetClass for h in payload.holdings]))
    if len(asset_classes) < 2:
        return {"matrix": []}

    n = len(asset_classes)
    cov_matrix = generate_covariance_matrix(asset_classes)
    
    # Convert covariance to correlation: corr = cov(i,j) / (sigma_i * sigma_j)
    corr_matrix = np.zeros((n, n))
    for i in range(n):
        for j in range(n):
            prof_i = ASSET_PROFILES.get(asset_classes[i], ASSET_PROFILES['DEFAULT'])
            prof_j = ASSET_PROFILES.get(asset_classes[j], ASSET_PROFILES['DEFAULT'])
            corr_matrix[i, j] = cov_matrix[i, j] / (prof_i['sigma'] * prof_j['sigma'])

    # Format for UI (e.g. recharts Heatmap or custom grid)
    matrix_data = []
    for i in range(n):
        for j in range(n):
            matrix_data.append({
                "x": asset_classes[i],
                "y": asset_classes[j],
                "value": float(corr_matrix[i, j])
            })

    return {
        "labels": asset_classes,
        "matrix": matrix_data
    }
