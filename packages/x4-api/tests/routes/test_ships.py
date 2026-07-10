from __future__ import annotations

import sqlite3

from fastapi.testclient import TestClient


def test_ship_prices_split_chassis_and_blueprint(
    client: TestClient, static_conn: sqlite3.Connection
) -> None:
    static_conn.execute(
        """
        INSERT INTO ships (ship_id, name, class_id, faction_id, hull)
        VALUES ('ship_arg_test_macro', 'Test Ship', 'ship_s', 'argon', 100)
        """
    )
    static_conn.execute(
        """
        INSERT INTO wares (ware_id, name, volume, price_min, price_avg, price_max)
        VALUES ('ship_arg_test', 'Test Ship', 1, 80, 100, 115)
        """
    )
    static_conn.commit()

    row = client.get("/api/v1/ships/ship_arg_test_macro").json()

    assert row["price_avg"] == 100
    assert row["chassis_price_min"] == 80
    assert row["chassis_price_avg"] == 100
    assert row["chassis_price_max"] == 115
    assert row["blueprint_price_min"] == 800
    assert row["blueprint_price_avg"] == 1000
    assert row["blueprint_price_max"] == 1150
