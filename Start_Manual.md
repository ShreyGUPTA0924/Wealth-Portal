# Wealth-Portal — Start Manual

## Important
- **Open Docker Desktop first** (make sure Docker is running) before starting the backend.

## 1) Start Database Services (Docker)
Open a terminal in the project root:

```powershell
cd "c:\Users\Shrey Gupts\Desktop\Minor sem 6 II\Wealth-Portal"
docker-compose up -d
```

## 2) Start Backend (Node/Express)
Open a new terminal:

```powershell
cd "c:\Users\Shrey Gupts\Desktop\Minor sem 6 II\Wealth-Portal\server"
npm install
npm run dev
```

## 3) Start AI Service (FastAPI)
Open a new terminal:

```powershell
cd "c:\Users\Shrey Gupts\Desktop\Minor sem 6 II\Wealth-Portal\ai-service"
.\start.bat
```

## 4) Start Frontend (Next.js)
Open a new terminal:

```powershell
cd "c:\Users\Shrey Gupts\Desktop\Minor sem 6 II\Wealth-Portal\web"
npm install
npm run dev
```

## Common URLs (defaults)
- **Frontend**: `http://localhost:3000`
- **AI Service**: `http://localhost:8000`
- **Redis**: `localhost:6379`
- **Postgres**: `localhost:5433` (docker-compose maps 5433 -> 5432)

## Stop Docker Services
From the project root:

```powershell
docker-compose down
```

