from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.config import CACHE_DIR, SERVE_FRONTEND, STATIC_DIR
from app.services.store import DataStore

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("windgate")


def create_app(store: DataStore | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if store is not None:
            app.state.store = store
        else:
            data = DataStore(CACHE_DIR)
            try:
                await asyncio.to_thread(data.load)
            except Exception as exc:
                logger.exception("Wind dataset failed to load")
                data.load_error = str(exc)
            app.state.store = data
        yield

    app = FastAPI(
        title="Windgate",
        summary="GB day-ahead wind forecast desk for January 2026.",
        version="1.0.0",
        lifespan=lifespan,
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "OPTIONS"],
        allow_headers=["*"],
    )
    app.include_router(router, prefix="/api")
    if store is not None:
        app.state.store = store
    _mount_frontend(app)
    return app


def _mount_frontend(app: FastAPI) -> None:
    if not SERVE_FRONTEND:
        return
    static_dir = Path(STATIC_DIR)
    index = static_dir / "index.html"
    if not index.is_file():
        logger.warning("SERVE_FRONTEND is set but %s is missing", index)
        return
    assets = static_dir / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/", include_in_schema=False)
    def root() -> FileResponse:
        return FileResponse(index)

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str) -> FileResponse:
        candidate = (static_dir / full_path).resolve()
        if candidate.is_file() and static_dir.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(index)


app = create_app()
