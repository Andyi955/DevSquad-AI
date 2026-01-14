"""
Web Scraper Service
Searches the web and summarizes results for the Researcher agent
"""

import os
import asyncio
from typing import List, Optional, Dict
from urllib.parse import quote_plus

import httpx
from bs4 import BeautifulSoup


class WebScraper:
    """Web scraping and summarization service"""
    
    # Common documentation sites
    ALLOWED_DOMAINS = [
        "stackoverflow.com",
        "github.com",
        "docs.python.org",
        "developer.mozilla.org",
        "reactjs.org",
        "fastapi.tiangolo.com",
        "numpy.org",
        "pandas.pydata.org",
        "pytorch.org",
        "tensorflow.org"
    ]
    
    def __init__(self):
        self.enabled = os.getenv("ENABLE_BROWSER_AGENT", "true").lower() == "true"
        self.timeout = 10.0
    
    async def fetch_page(self, url: str) -> Optional[str]:
        """Fetch a web page and extract text content"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    url,
                    headers={"User-Agent": "Mozilla/5.0 (compatible; CodeAssistant/1.0)"},
                    follow_redirects=True
                )
                
                if response.status_code != 200:
                    return None
                
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Remove scripts, styles, nav, footer
                for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'aside']):
                    tag.decompose()
                
                # Get main content
                main = soup.find('main') or soup.find('article') or soup.find('body')
                if main:
                    text = main.get_text(separator='\n', strip=True)
                    # Limit length
                    return text[:5000]
                
                return None
        except Exception as e:
            print(f"Error fetching {url}: {e}")
            return None
    
    async def search_duckduckgo(self, query: str, max_results: int = 5) -> List[Dict]:
        """
        Search DuckDuckGo for results
        Note: This is a simple scraping approach. For production, use a proper search API.
        """
        results = []
        
        try:
            # HTML version of DDG is easier to scrape but often blocks non-browser UAs
            search_url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
            
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Referer": "https://duckduckgo.com/",
                "DNT": "1",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1"
            }
            
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                response = await client.get(search_url, headers=headers)
                
                if response.status_code != 200:
                    print(f"Search failed: Status {response.status_code}")
                    return [{"title": f"Search Error: Code {response.status_code}", "snippet": "Could not access search engine.", "url": ""}]

                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Find result links
                found_items = soup.select('.result__body')
                if not found_items:
                     # Fallback check for blocking
                     if "If this error persists" in response.text:
                         return [{"title": "Search Blocked", "snippet": "DuckDuckGo is blocking the valid request. Try again later.", "url": ""}]
                     return [{"title": "No results found", "snippet": f"No results for '{query}'", "url": ""}]

                for i, result in enumerate(found_items[:max_results]):
                    title_elem = result.select_one('.result__title')
                    snippet_elem = result.select_one('.result__snippet')
                    link_elem = result.select_one('.result__url')
                    
                    if title_elem:
                        # Extract real URL from DDG redirect if possible, otherwise use text
                        raw_url = link_elem.get_text(strip=True) if link_elem else ""
                        if not raw_url.startswith("http"):
                             raw_url = f"https://{raw_url}"
                             
                        results.append({
                            "title": title_elem.get_text(separator=' ', strip=True),
                            "snippet": snippet_elem.get_text(separator=' ', strip=True) if snippet_elem else "",
                            "url": raw_url
                        })
        except Exception as e:
            print(f"Search error: {e}")
            return [{"title": "Search System Error", "snippet": str(e), "url": ""}]
        
        return results
    
    async def search_and_summarize(
        self, 
        query: str, 
        sources: Optional[List[str]] = None
    ) -> Dict:
        """
        Search the web and return summarized results
        """
        if not self.enabled:
            return {
                "status": "disabled",
                "message": "Web browsing is disabled"
            }
        
        # Search DuckDuckGo
        search_results = await self.search_duckduckgo(query)
        
        # Fetch content from top results
        content_results = []
        for result in search_results[:3]:
            if result.get("url"):
                # Try to construct full URL
                url = result["url"]
                if not url.startswith("http"):
                    url = "https://" + url
                
                content = await self.fetch_page(url)
                if content:
                    content_results.append({
                        "title": result["title"],
                        "url": url,
                        "content": content[:2000]  # Limit content
                    })
        
        return {
            "status": "success",
            "query": query,
            "results_count": len(search_results),
            "search_results": search_results,
            "detailed_content": content_results
        }
