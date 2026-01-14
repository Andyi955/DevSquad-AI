"""
Usage Tracker Service
Tracks API usage across providers and enforces limits
"""

import os
from datetime import datetime, timedelta
from collections import defaultdict
from dataclasses import dataclass
from typing import Dict


@dataclass
class UsageRecord:
    """Usage record for a time period"""
    count: int = 0
    tokens_in: int = 0
    tokens_out: int = 0
    cost_estimate: float = 0.0


class UsageTracker:
    """Tracks API usage and enforces daily limits"""
    
    # Estimated costs per 1K tokens (very rough estimates)
    COST_PER_1K = {
        "gemini": 0.0001,  # Very cheap
        "deepseek": 0.0002,
        "research": 0.001
    }
    
    def __init__(self):
        self.daily_limit = int(os.getenv("USAGE_LIMIT_PER_DAY", 1000))
        self.usage: Dict[str, Dict[str, UsageRecord]] = defaultdict(lambda: defaultdict(UsageRecord))
        self.today = datetime.now().date()
    
    def _get_today_key(self) -> str:
        """Get today's date as key"""
        today = datetime.now().date()
        if today != self.today:
            # Reset daily counters
            self.today = today
        return today.isoformat()
    
    def track(
        self, 
        provider: str, 
        count: int = 1,
        tokens_in: int = 0,
        tokens_out: int = 0
    ):
        """Track a usage event"""
        today = self._get_today_key()
        record = self.usage[today][provider]
        
        record.count += count
        record.tokens_in += tokens_in
        record.tokens_out += tokens_out
        
        # Estimate cost
        total_tokens = tokens_in + tokens_out
        cost_rate = self.COST_PER_1K.get(provider, 0.0005)
        record.cost_estimate += (total_tokens / 1000) * cost_rate
    
    def check_limit(self, provider: str = None) -> bool:
        """Check if within daily limit"""
        today = self._get_today_key()
        
        if provider:
            return self.usage[today][provider].count < self.daily_limit
        
        # Check total across all providers
        total = sum(r.count for r in self.usage[today].values())
        return total < self.daily_limit
    
    def get_remaining(self) -> int:
        """Get remaining calls for today"""
        today = self._get_today_key()
        total = sum(r.count for r in self.usage[today].values())
        return max(0, self.daily_limit - total)
    
    def get_summary(self) -> dict:
        """Get quick usage summary"""
        today = self._get_today_key()
        total = sum(r.count for r in self.usage[today].values())
        cost = sum(r.cost_estimate for r in self.usage[today].values())
        
        return {
            "today_calls": total,
            "daily_limit": self.daily_limit,
            "remaining": max(0, self.daily_limit - total),
            "estimated_cost": f"${cost:.4f}"
        }
    
    def get_stats(self) -> dict:
        """Get detailed usage statistics"""
        today = self._get_today_key()
        
        # Provider breakdown for today
        providers = {}
        for provider, record in self.usage[today].items():
            providers[provider] = {
                "calls": record.count,
                "tokens_in": record.tokens_in,
                "tokens_out": record.tokens_out,
                "cost_estimate": f"${record.cost_estimate:.4f}"
            }
        
        # Historical summary (last 7 days)
        history = []
        for i in range(7):
            date = (datetime.now() - timedelta(days=i)).date().isoformat()
            if date in self.usage:
                day_total = sum(r.count for r in self.usage[date].values())
                day_cost = sum(r.cost_estimate for r in self.usage[date].values())
                history.append({
                    "date": date,
                    "calls": day_total,
                    "cost": f"${day_cost:.4f}"
                })
        
        return {
            "today": self.get_summary(),
            "by_provider": providers,
            "history": history
        }
