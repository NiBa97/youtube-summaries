from unittest.mock import patch

import pytest


@pytest.fixture(autouse=True)
def _no_comment_scraping():
    """Stub the comment fetch for the whole suite.

    It is the only always-on outbound call in /slides, so without this every
    existing /slides test would scrape YouTube for real. Making it autouse means
    "the suite makes no network calls" is a property of the suite rather than
    something each test author has to remember: a new test that forgets to patch
    fails safe instead of silently hitting the network.
    """
    with patch("app.main.fetch_top_comments", return_value=[]):
        yield
