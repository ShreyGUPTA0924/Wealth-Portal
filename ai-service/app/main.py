import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import chat, nudges, health_score, parse_cibil

app = FastAPI(title="WealthPortal AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/ai")
app.include_router(nudges.router, prefix="/ai")
app.include_router(health_score.router, prefix="/ai")
app.include_router(parse_cibil.router)  # /parse-cibil at root


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "wealth-portal-ai", "version": "1.0.0"}
