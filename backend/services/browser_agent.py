"""
Browser Agent Service
Uses Playwright for advanced web browsing capabilities
"""

import os
import asyncio
from typing import Optional, Dict, List
from pathlib import Path


class BrowserAgent:
    """
    Playwright-based browser automation for advanced web browsing
    Used by the Researcher agent for documentation and research
    """
    
    def __init__(self):
        self.enabled = os.getenv("ENABLE_BROWSER_AGENT", "true").lower() == "true"
        self.browser = None
        self.playwright = None
        self.screenshots_dir = Path("./screenshots")
        self.screenshots_dir.mkdir(exist_ok=True)
    
    async def initialize(self):
        """Initialize Playwright browser"""
        if not self.enabled:
            return False
        
        try:
            from playwright.async_api import async_playwright
            
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-dev-shm-usage']
            )
            return True
        except Exception as e:
            print(f"Failed to initialize browser: {e}")
            self.enabled = False
            return False
    
    async def close(self):
        """Close browser and cleanup"""
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
    
    async def browse_url(
        self, 
        url: str, 
        screenshot: bool = False,
        extract_links: bool = False
    ) -> Dict:
        """
        Browse a URL and extract content
        """
        if not self.enabled or not self.browser:
            return {"error": "Browser not available"}
        
        try:
            page = await self.browser.new_page()
            await page.goto(url, wait_until='networkidle', timeout=30000)
            
            # Get page title
            title = await page.title()
            
            # Get main content
            content = await page.evaluate('''() => {
                // Remove unwanted elements
                const unwanted = document.querySelectorAll('script, style, nav, footer, header, aside, iframe');
                unwanted.forEach(el => el.remove());
                
                // Get main content
                const main = document.querySelector('main, article, .content, #content, body');
                return main ? main.innerText.substring(0, 5000) : '';
            }''')
            
            result = {
                "url": url,
                "title": title,
                "content": content
            }
            
            # Take screenshot if requested
            if screenshot:
                screenshot_path = self.screenshots_dir / f"{hash(url)}.png"
                await page.screenshot(path=str(screenshot_path), full_page=False)
                result["screenshot"] = str(screenshot_path)
            
            # Extract links if requested
            if extract_links:
                links = await page.evaluate('''() => {
                    return Array.from(document.querySelectorAll('a[href]'))
                        .map(a => ({text: a.innerText.trim(), href: a.href}))
                        .filter(l => l.text && l.href.startsWith('http'))
                        .slice(0, 20);
                }''')
                result["links"] = links
            
            await page.close()
            return result
            
        except Exception as e:
            return {"error": str(e)}
    
    async def search_documentation(
        self,
        query: str,
        site: str = "docs.python.org"
    ) -> Dict:
        """
        Search a documentation site
        """
        search_url = f"https://www.google.com/search?q={query}+site:{site}"
        return await self.browse_url(search_url, extract_links=True)
    
    async def get_github_readme(self, repo: str) -> Dict:
        """
        Get README from a GitHub repository
        """
        url = f"https://github.com/{repo}"
        result = await self.browse_url(url)
        
        # Try to get just the README section
        if self.browser:
            try:
                page = await self.browser.new_page()
                await page.goto(url, wait_until='networkidle')
                
                readme = await page.evaluate('''() => {
                    const readme = document.querySelector('article.markdown-body');
                    return readme ? readme.innerText : '';
                }''')
                
                await page.close()
                result["readme"] = readme[:5000]
            except:
                pass
        
        return result
    
    async def search_stackoverflow(self, query: str) -> List[Dict]:
        """
        Search Stack Overflow for answers
        """
        url = f"https://stackoverflow.com/search?q={query}"
        result = await self.browse_url(url, extract_links=True)
        
        # Filter to just question links
        questions = []
        for link in result.get("links", []):
            if "/questions/" in link.get("href", ""):
                questions.append(link)
        
        return questions[:10]
