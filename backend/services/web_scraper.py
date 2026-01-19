import os
import sys
import asyncio

# AT THE ABSOLUTE TOP - BEFORE ANYTHING ELSE
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

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
        self.timeout = 20.0
        self.browser_path = os.getenv("BROWSER_EXECUTABLE_PATH")
        self.user_data_dir = os.getenv("BROWSER_USER_DATA_DIR")
    
    async def fetch_page(self, url: str) -> Optional[str]:
        """Fetch a web page - tries Playwright first, falls back to httpx"""
        print(f"\n{'─'*50}")
        print(f"🌐 [SCRAPER] fetch_page called for: {url}")
        print(f"{'─'*50}")
        
        # Validate URL
        if not url or not url.startswith("http"):
            print(f"⚠️ [SCRAPER] Invalid URL: {url}")
            return None
        
        # Try httpx first (more reliable on Windows with uvicorn)
        content = await self._fetch_with_httpx(url)
        if content:
            return content
        
        # Fallback to Playwright for JS-heavy sites
        print(f"🔄 [SCRAPER] httpx failed, trying Playwright...")
        return await self._fetch_with_playwright(url)
    
    async def _fetch_with_httpx(self, url: str) -> Optional[str]:
        """Simple HTTP fetch with httpx - doesn't execute JavaScript"""
        try:
            print(f"📡 [SCRAPER] Trying httpx for: {url}")
            
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            }
            
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                response = await client.get(url, headers=headers)
                
                if response.status_code != 200:
                    print(f"⚠️ [SCRAPER] httpx got status {response.status_code}")
                    return None
                
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Remove unwanted elements
                for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'noscript', 'svg']):
                    tag.decompose()
                
                # Find main content
                main = soup.find('main') or soup.find('article') or soup.find(id='content') or soup.find(class_='content') or soup.find('body')
                
                if main:
                    import re
                    text = main.get_text(separator='\n', strip=True)
                    text = re.sub(r'\n{3,}', '\n\n', text)
                    final_text = text[:15000]
                    
                    if len(final_text) > 500:  # Only return if we got meaningful content
                        print(f"✅ [SCRAPER/httpx] Extracted {len(final_text)} chars from {url}")
                        print(f"📝 [PREVIEW]: {final_text[:200]}...")
                        return final_text
                    else:
                        print(f"⚠️ [SCRAPER/httpx] Content too short ({len(final_text)} chars), might need JS")
                        return None
                
                print(f"⚠️ [SCRAPER/httpx] No main content element found")
                return None
                
        except Exception as e:
            print(f"⚠️ [SCRAPER/httpx] Failed: {type(e).__name__}: {e}")
            return None

    async def _fetch_with_playwright(self, url: str) -> Optional[str]:
        """Fetch using Playwright - handles JavaScript-heavy sites"""
        # Circuit breaker for Playwright
        if getattr(self, "playwright_disabled", False):
            print(f"⚠️ [SCRAPER] Playwright disabled due to previous error. Skipping.")
            return None

        import sys
        import asyncio
        
        # On Windows, we need ProactorEventLoop for subprocesses
        if sys.platform == 'win32':
            try:
                policy = asyncio.get_event_loop_policy()
                if not isinstance(policy, asyncio.WindowsProactorEventLoopPolicy):
                    print(f"🔧 [SCRAPER] Setting WindowsProactorEventLoopPolicy...")
                    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
            except Exception as e:
                print(f"⚠️ [SCRAPER] Could not set event loop policy: {e}")
                self.playwright_disabled = True
                return None

        try:
            from playwright.async_api import async_playwright
        except ImportError:
            print(f"⚠️ [SCRAPER] Playwright not installed")
            return None
        
        import tempfile
        import shutil
        
        user_dir = self.user_data_dir or tempfile.mkdtemp(prefix="ai_scraper_")
        
        try:
            print(f"🚀 [SCRAPER] Starting Playwright...")
            async with async_playwright() as p:
                launch_kwargs = {
                    "headless": True,
                    "args": ["--disable-dev-shm-usage", "--no-sandbox"]
                }
                if self.browser_path:
                    print(f"🔧 [SCRAPER] Using custom browser: {self.browser_path}")
                    launch_kwargs["executable_path"] = self.browser_path
                else:
                    print(f"🔧 [SCRAPER] Using bundled Chromium")

                browser_context = None
                for attempt in range(3):
                    try:
                        print(f"🎯 [SCRAPER] Launch attempt {attempt + 1}/3...")
                        browser_context = await p.chromium.launch_persistent_context(
                            user_dir,
                            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                            viewport={'width': 1280, 'height': 800},
                            **launch_kwargs
                        )
                        print(f"✅ [SCRAPER] Browser launched successfully!")
                        break
                    except Exception as e:
                        if "is already in use" in str(e) or "lock" in str(e).lower():
                            await asyncio.sleep(2)
                            continue
                        raise e
                
                if not browser_context:
                    return None

                page = await browser_context.new_page()
                
                print(f"🌐 [BROWSER] Navigating to: {url}")
                await page.goto(url, wait_until="domcontentloaded", timeout=25000)
                await asyncio.sleep(1.5) 
                
                content = await page.content()
                await browser_context.close()
                
                if not self.user_data_dir:
                    shutil.rmtree(user_dir, ignore_errors=True)
                
                soup = BeautifulSoup(content, 'html.parser')
                
                for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'noscript', 'svg']):
                    tag.decompose()
                
                main = soup.find('main') or soup.find('article') or soup.find(id='content') or soup.find(class_='content') or soup.find('body')
                
                if main:
                    import re
                    text = main.get_text(separator='\n', strip=True)
                    text = re.sub(r'\n{3,}', '\n\n', text)
                    final_text = text[:15000]
                    
                    print(f"✅ [SCRAPER/Playwright] Extracted {len(final_text)} chars from {url}")
                    print(f"📝 [PREVIEW]: {final_text[:200]}...")
                    return final_text
                
                print(f"❌ [SCRAPER/Playwright] No main content found for {url}")
                return None
        except NotImplementedError:
            print(f"❌ [SCRAPER/Playwright] NotImplementedError - uvicorn event loop conflict on Windows")
            print(f"   This is a known issue. Disabling Playwright for this session.")
            self.playwright_disabled = True
            return None
        except Exception as e:
            print(f"💥 [SCRAPER/Playwright] Exception: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def search_web(self, query: str, max_results: int = 5) -> List[Dict]:
        """
        Search using Serper.dev API (Google results)
        Falls back to DuckDuckGo scraping if no API key
        """
        serper_key = os.getenv("SERPER_API_KEY")
        
        if serper_key:
            return await self._search_serper(query, max_results, serper_key)
        else:
            print("⚠️ [SEARCH] No SERPER_API_KEY found, falling back to DuckDuckGo scraping")
            return await self._search_duckduckgo_fallback(query, max_results)
    
    async def _search_serper(self, query: str, max_results: int, api_key: str) -> List[Dict]:
        """Search using Serper.dev API"""
        print(f"🔍 [SERPER] Searching for: {query}")
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    "https://google.serper.dev/search",
                    headers={
                        "X-API-KEY": api_key,
                        "Content-Type": "application/json"
                    },
                    json={
                        "q": query,
                        "num": max_results
                    }
                )
                
                if response.status_code != 200:
                    print(f"❌ [SERPER] API error: {response.status_code}")
                    print(f"   Response: {response.text[:500]}")
                    return [{"title": "Search Error", "snippet": f"Serper API returned {response.status_code}", "url": ""}]
                
                data = response.json()
                results = []
                
                # Parse organic results
                organic = data.get("organic", [])
                print(f"✅ [SERPER] Got {len(organic)} results")
                
                for item in organic[:max_results]:
                    result = {
                        "title": item.get("title", "No title"),
                        "snippet": item.get("snippet", ""),
                        "url": item.get("link", "")
                    }
                    results.append(result)
                    print(f"   📄 {result['title'][:50]} - {result['url'][:60]}")
                
                if not results:
                    return [{"title": "No results", "snippet": f"No results found for '{query}'", "url": ""}]
                
                return results
                
        except Exception as e:
            print(f"💥 [SERPER] Exception: {type(e).__name__}: {e}")
            return [{"title": "Search Error", "snippet": str(e), "url": ""}]
    
    async def _search_duckduckgo_fallback(self, query: str, max_results: int) -> List[Dict]:
        """Fallback: Search DuckDuckGo by scraping (less reliable)"""
        results = []
        
        try:
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
                
                found_items = soup.select('.result__body')
                if not found_items:
                    if "If this error persists" in response.text:
                        return [{"title": "Search Blocked", "snippet": "DuckDuckGo is blocking requests. Add SERPER_API_KEY to .env for reliable search.", "url": ""}]
                    return [{"title": "No results found", "snippet": f"No results for '{query}'", "url": ""}]

                for i, result in enumerate(found_items[:max_results]):
                    title_elem = result.select_one('.result__title')
                    snippet_elem = result.select_one('.result__snippet')
                    link_elem = result.select_one('.result__url')
                    
                    if title_elem:
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
    
    async def fetch_pages_concurrently(self, urls: List[str]) -> List[Dict]:
        """Fetch multiple pages in parallel"""
        tasks = [self.fetch_page(url) for url in urls]
        contents = await asyncio.gather(*tasks)
        
        results = []
        for url, content in zip(urls, contents):
            if content:
                results.append({"url": url, "content": content})
        return results

    async def search_and_summarize(
        self, 
        query: str, 
        sources: Optional[List[str]] = None,
        deep: bool = False
    ) -> Dict:
        """
        Search the web and return summarized results
        """
        if not self.enabled:
            return {
                "status": "disabled",
                "message": "Web browsing is disabled"
            }
        
        # Search Web (Google/Serper or DuckDuckGo)
        search_results = await self.search_web(query)
        
        # Clean results
        valid_search_results = [r for r in search_results if r.get("url")]
        
        # Fetch content from results
        # If deep=True, we fetch more pages and more content per page
        limit = 5 if deep else 3
        content_limit = 10000 if deep else 2000
        
        top_urls = [r["url"] for r in valid_search_results[:limit]]
        detailed_contents = await self.fetch_pages_concurrently(top_urls)
        
        # Map content back to search results
        content_map = {c["url"]: c["content"] for c in detailed_contents}
        
        content_results = []
        for result in valid_search_results[:limit]:
            url = result["url"]
            if url in content_map:
                content_results.append({
                    "title": result["title"],
                    "url": url,
                    "content": content_map[url][:content_limit]
                })
        
        return {
            "status": "success",
            "query": query,
            "results_count": len(search_results),
            "search_results": search_results,
            "detailed_content": content_results,
            "is_deep": deep
        }
