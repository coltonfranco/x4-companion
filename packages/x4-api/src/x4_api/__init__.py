"""REST API + CLI for the X4: Foundations companion app.

Structure for contributors:
    server.py    — FastAPI app factory, lifespan, CORS, static mounts
    routes/      — one router module per domain entity (wares, ships, stations, ...)
    domain/      — pure business logic; never imports HTTP concepts
    services/    — stateful orchestration (background refresher, init jobs)
    config.py    — Pydantic Settings (env / .env / appdata persistence)
    cli.py       — Typer CLI entry point (doctor, rebuild-*, watch, serve)
"""

__version__ = "0.0.0"
