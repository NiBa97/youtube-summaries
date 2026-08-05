from unittest.mock import patch

import pytest


@pytest.fixture(autouse=True)
def _no_comment_scraping():
    """Stub the comment fetch for the whole suite.

    Nothing reaches it by accident today - only /community and /comments scrape,
    and both are patched explicitly wherever they are tested. This is the backstop
    that keeps that true: a new test that forgets to patch fails safe instead of
    silently hitting YouTube, which matters more than usual here because the
    scraper is the one dependency guaranteed to break eventually.
    """
    with patch("app.main.fetch_top_comments", return_value=[]):
        yield
