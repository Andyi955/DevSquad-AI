import pytest
import asyncio
from services.web_scraper import WebScraper

@pytest.mark.asyncio
async def test_scraper_fetch_real_page():
    scraper = WebScraper()
    # Test with a site that usually requires JS or has good content
    url = "https://www.python.org/about/"
    content = await scraper.fetch_page(url)
    
    assert content is not None
    assert "Python" in content
    assert len(content) > 500

@pytest.mark.asyncio
async def test_scraper_search_and_deep_summarize():
    scraper = WebScraper()
    query = "current state of AI in 2026"
    results = await scraper.search_and_summarize(query, deep=True)
    
    assert results["status"] == "success"
    assert len(results["search_results"]) > 0
    # Deep results should have detailed_content
    assert "detailed_content" in results
    if results["detailed_content"]:
        assert len(results["detailed_content"][0]["content"]) > 1000
