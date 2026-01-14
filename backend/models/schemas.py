# Pydantic models for API schemas
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ChatMessage(BaseModel):
    """Chat message from user"""
    message: str
    context: Optional[dict] = None


class FileContent(BaseModel):
    """File content for read/write operations"""
    path: str
    content: str


class ApprovalRequest(BaseModel):
    """Request to approve or reject a file change"""
    change_id: str
    approved: bool


class ResearchQuery(BaseModel):
    """Web research query"""
    query: str
    sources: Optional[List[str]] = None


class AgentInfo(BaseModel):
    """Agent information"""
    name: str
    emoji: str
    color: str
    provider: str
    model: str


class UsageStats(BaseModel):
    """API usage statistics"""
    today_calls: int
    daily_limit: int
    remaining: int
    estimated_cost: str


class FileInfo(BaseModel):
    """File information"""
    path: str
    size: int
    modified: str
    extension: str
