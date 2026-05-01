from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import challans, upload, status


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure sheet headers include all current columns (safe: only updates row 1)
    try:
        from app.services.sheets import ensure_headers
        ensure_headers()
    except Exception as e:
        print(f"[startup] ensure_headers failed (non-fatal): {e}")
    yield


app = FastAPI(title="DocFlow Challan API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(challans.router, prefix="/api", tags=["challans"])
app.include_router(status.router, prefix="/api", tags=["status"])


@app.get("/health")
def health():
    return {"status": "ok"}
