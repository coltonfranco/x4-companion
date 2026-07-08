"""Smoke tests for the factions API endpoints."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient
from x4_api.routes.factions import faction_strength, list_all_faction_relations
from x4_api.routes.player import player_reputation
from x4_extract.db import open_db
from x4_extract.static.extractors import factions

TINY_FACTIONS_XML = b"""<?xml version="1.0" encoding="utf-8"?>
<factions>
  <faction id="argon" name="Argon Federation" primaryrace="argon" shortname="ARG" prefixname="Argon" description="The Argon" tags="economic">
    <color ref="faction_argon" />
    <icon active="faction_argon" />
    <relations>
      <relation faction="xenon" relation="-1" />
    </relations>
  </faction>
  <faction id="xenon" name="Xenon" primaryrace="xenon">
  </faction>
  <faction id="criminal" name="Criminal" tags="hidden">
  </faction>
</factions>
"""

TINY_COLORS_XML = b"""<?xml version="1.0" encoding="utf-8"?>
<colormap>
  <color id="blue_bright" r="0" g="120" b="215" a="255" />
  <mapping id="faction_argon" ref="blue_bright" />
</colormap>
"""


def test_list_factions_returns_all_factions(
    client: TestClient, static_conn: sqlite3.Connection
) -> None:
    result = factions.extract(TINY_FACTIONS_XML, TINY_COLORS_XML)
    factions.write(static_conn, result)
    static_conn.commit()

    resp = client.get("/api/v1/factions")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert {f["faction_id"] for f in data} == {"argon", "xenon"}
    argon = next(f for f in data if f["faction_id"] == "argon")
    assert argon["name"] == "Argon Federation"
    assert argon["color_hex"] == "#0078D7"
    assert argon["is_hidden"] is False
    assert argon["short_name"] == "ARG"
    assert argon["prefix_name"] == "Argon"
    assert argon["icon_active"] == "faction_argon"


def test_list_factions_can_include_hidden(
    client: TestClient, static_conn: sqlite3.Connection
) -> None:
    result = factions.extract(TINY_FACTIONS_XML, TINY_COLORS_XML)
    factions.write(static_conn, result)
    static_conn.commit()

    resp = client.get("/api/v1/factions?include_hidden=true")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3
    criminal = next(f for f in data if f["faction_id"] == "criminal")
    assert criminal["is_hidden"] is True


def test_get_faction_detail_returns_404_on_missing(client: TestClient) -> None:
    resp = client.get("/api/v1/factions/no_such_faction")
    assert resp.status_code == 404
    assert "Unknown faction_id" in resp.json()["detail"]


def test_get_faction_detail_returns_full_record(
    client: TestClient, static_conn: sqlite3.Connection
) -> None:
    result = factions.extract(TINY_FACTIONS_XML, TINY_COLORS_XML)
    factions.write(static_conn, result)
    static_conn.commit()

    resp = client.get("/api/v1/factions/argon")

    assert resp.status_code == 200
    data = resp.json()
    assert data["faction_id"] == "argon"
    assert data["name"] == "Argon Federation"
    assert data["color_hex"] == "#0078D7"
    assert data["is_hidden"] is False
    assert data["primary_race"] == "argon"
    assert data["short_name"] == "ARG"
    assert data["prefix_name"] == "Argon"
    assert data["icon_active"] == "faction_argon"
    assert data["description"] == "The Argon"
    assert data["tags"] == "economic"
    assert "capital_sector" not in data


def test_faction_relations_hide_hidden_factions_by_default(
    data_dir: Path, static_conn: sqlite3.Connection
) -> None:
    static_conn.executemany(
        "INSERT INTO factions (faction_id, name, tags) VALUES (?, ?, ?)",
        [
            ("argon", "Argon Federation", "economic"),
            ("xenon", "Xenon", None),
            ("criminal", "Criminal", "hidden"),
        ],
    )
    static_conn.commit()

    conn = open_db(data_dir)
    try:
        conn.executemany(
            "INSERT INTO faction_relations_current "
            "(faction_id, other_faction_id, relation) VALUES (?, ?, ?)",
            [
                ("argon", "xenon", -1.0),
                ("argon", "criminal", -0.5),
                ("criminal", "argon", -0.5),
            ],
        )
        conn.commit()

        visible = list_all_faction_relations(conn, include_hidden=False)
        assert {(r.faction_id, r.other_faction_id) for r in visible} == {("argon", "xenon")}

        all_relations = list_all_faction_relations(conn, include_hidden=True)
        assert len(all_relations) == 3
    finally:
        conn.close()


def test_player_reputation_hides_hidden_factions_by_default(
    data_dir: Path, static_conn: sqlite3.Connection
) -> None:
    static_conn.executemany(
        "INSERT INTO factions (faction_id, name, tags) VALUES (?, ?, ?)",
        [
            ("argon", "Argon Federation", "economic"),
            ("criminal", "Criminal", "hidden"),
        ],
    )
    static_conn.commit()

    conn = open_db(data_dir)
    try:
        conn.executemany(
            "INSERT INTO faction_relations_current "
            "(faction_id, other_faction_id, relation) VALUES (?, ?, ?)",
            [
                ("player", "argon", 0.5),
                ("player", "criminal", -0.5),
            ],
        )
        conn.commit()

        visible = player_reputation(conn, include_hidden=False)
        assert [r.faction_id for r in visible] == ["argon"]

        all_reputation = player_reputation(conn, include_hidden=True)
        assert {r.faction_id for r in all_reputation} == {"argon", "criminal"}
    finally:
        conn.close()


def test_faction_strength_buckets_diplomatic_relations(
    data_dir: Path, static_conn: sqlite3.Connection
) -> None:
    static_conn.executemany(
        "INSERT INTO factions (faction_id, name) VALUES (?, ?)",
        [
            ("outlaw", "Criminal"),
            ("argon", "Argon Federation"),
            ("player", "Player"),
            ("xenon", "Xenon"),
        ],
    )
    static_conn.commit()

    conn = open_db(data_dir)
    try:
        conn.executemany(
            "INSERT INTO faction_relations_current "
            "(faction_id, other_faction_id, relation) VALUES (?, ?, ?)",
            [
                ("outlaw", "argon", -0.032),
                ("outlaw", "player", -0.32),
                ("outlaw", "xenon", -0.06),
                ("argon", "outlaw", 0.34),
                ("argon", "xenon", -1.0),
            ],
        )
        rows = {r.faction_id: r for r in faction_strength(conn, include_hidden=True)}
    finally:
        conn.close()

    assert rows["outlaw"].avg_relation == -19.0
    assert rows["outlaw"].diplomatic_score == 16.7
    assert rows["argon"].avg_relation == -2.5
    assert rows["argon"].diplomatic_score == 50.0


# Faction relations are now sourced from the live save (faction_relations_current), not
# from static/seed definitions — that endpoint is covered by test_api_dynamic
# (test_faction_relations_from_save) where a save is actually ingested.
