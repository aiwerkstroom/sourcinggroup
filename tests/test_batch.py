"""Test voor werkstroom 2: database ranken."""

import pandas as pd

from batch.rank import rank


def test_rank_sorteert_op_score(tmp_path):
    df = pd.DataFrame(
        [
            {"Adres": "Goedkoop & hoge huur", "Koopsom": 150_000, "Huur per maand": 1_400},
            {"Adres": "Duur & lage huur", "Koopsom": 500_000, "Huur per maand": 1_500},
        ]
    )
    bron = tmp_path / "panden.xlsx"
    df.to_excel(bron, index=False)

    ranglijst = rank(bron)
    assert list(ranglijst["rang"]) == [1, 2]
    assert ranglijst.iloc[0]["adres"] == "Goedkoop & hoge huur"
    assert ranglijst.iloc[0]["score"] > ranglijst.iloc[1]["score"]
