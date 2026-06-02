"""
WebSocket connection manager for real-time mention updates.
"""
import asyncio
import json
import logging
from typing import Any, Dict, List, Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class RealtimeManager:
    def __init__(self):
        self._connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)
        logger.info(f"WebSocket connected ({len(self._connections)} clients)")

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            self._connections.discard(websocket)
        logger.info(f"WebSocket disconnected ({len(self._connections)} clients)")

    async def broadcast(self, event: str, payload: Dict[str, Any]):
        message = json.dumps({"event": event, "data": payload}, default=str)
        dead: List[WebSocket] = []
        async with self._lock:
            targets = list(self._connections)
        for ws in targets:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(ws)


realtime_manager = RealtimeManager()
