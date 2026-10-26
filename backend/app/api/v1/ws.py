"""WebSocket Connection Manager and real-time attendance broadcasting endpoint."""

import json
import logging
from typing import Any, Dict, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger("smart_attendance.ws")

router = APIRouter(tags=["WebSocket"])


class WebSocketManager:
    """Manages active WebSocket connections to kiosks and administrative dashboards."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """Accept new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """Remove disconnected WebSocket client."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast_json(self, data: Dict[str, Any]):
        """Broadcast JSON message to all connected clients."""
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except Exception:
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(dead)

    async def broadcast_attendance(self, attendance_data: Dict[str, Any]):
        """Broadcast attendance recognition event."""
        payload = {
            "type": "ATTENDANCE_EVENT",
            "data": attendance_data,
        }
        await self.broadcast_json(payload)


# Global singleton instance
ws_manager = WebSocketManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time live attendance kiosk and dashboard feeds."""
    await ws_manager.connect(websocket)
    try:
        # Send initial connection handshake
        await websocket.send_json({
            "type": "CONNECTION_ESTABLISHED",
            "message": "Connected to Smart Attendance System WebSocket Gateway.",
        })

        while True:
            # Keep connection alive and process incoming messages
            raw_text = await websocket.receive_text()
            try:
                msg = json.loads(raw_text)
                msg_type = msg.get("type", "")
                if msg_type == "PING":
                    await websocket.send_json({"type": "PONG"})
                elif msg_type == "SUBSCRIBE":
                    await websocket.send_json({
                        "type": "SUBSCRIPTION_CONFIRMED",
                        "channel": msg.get("channel", "attendance"),
                    })
            except json.JSONDecodeError:
                if raw_text.strip().upper() == "PING":
                    await websocket.send_text("PONG")

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)
