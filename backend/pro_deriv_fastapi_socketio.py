"""
================================================================================
PRO DERIV MULTI-MARKET ANALYZER — FASTAPI & SOCKET.IO BACKEND
================================================================================
Concurrent Multi-Market Scanner for Deriv Volatility Indices (R_10, R_50, R_75, R_100)
Runs multiple ProDerivAnalyzer instances concurrently using asyncio.gather()
Streams real-time ticks, pro indicators (EMA 9/21, RSI 14, ATR 14, Bollinger Bands),
and high-confluence setup alerts via Socket.IO to Tailwind + TradingView Lightweight Charts.

Requirements:
    pip install fastapi uvicorn python-socketio websockets
Run:
    uvicorn backend.pro_deriv_fastapi_socketio:asgi_app --host 0.0.0.0 --port 8000 --reload
"""

import asyncio
import json
import logging
import time
from collections import deque
from typing import Dict, List, Any, Optional

import socketio
import websockets
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Configure professional logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# ------------------------------------------------------------------------------
# Socket.IO Async Server & FastAPI App
# ------------------------------------------------------------------------------
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = FastAPI(title="Pro Deriv Multi-Market Analyzer API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Combine FastAPI and Socket.IO into a single ASGI application
asgi_app = socketio.ASGIApp(sio, app)

# Global in-memory storage of latest market snapshots & alerts
MARKET_SNAPSHOTS: Dict[str, Dict[str, Any]] = {}
HIGH_CONFLUENCE_ALERTS: List[Dict[str, Any]] = []

# Monitored Multi-Market Symbols
SCAN_SYMBOLS = ["R_10", "R_50", "R_75", "R_100"]


class ProDerivAnalyzer:
    """
    Independent asynchronous analyzer instance for a single Deriv market symbol.
    Runs concurrently with other instances via asyncio.gather().
    """

    def __init__(self, symbol: str = "R_75", app_id: int = 1089):
        self.symbol = symbol
        self.app_id = app_id
        self.api_url = f"wss://ws.derivws.com/websockets/v3?app_id={app_id}"
        self.price_history = deque(maxlen=100)
        self.digit_history = deque(maxlen=200)
        self.time_history = deque(maxlen=100)
        self.is_running = False
        self.last_alert_time = 0.0
        self.current_quote = 0.0
        self.last_digit = 0

    async def start(self):
        self.is_running = True
        while self.is_running:
            try:
                logging.info(f"Connecting to Deriv WebSocket API for {self.symbol}...")
                async with websockets.connect(self.api_url) as websocket:
                    # Subscribe to live public tick stream
                    await websocket.send(json.dumps({"ticks": self.symbol}))
                    logging.info(f"✅ Subscribed to live stream for {self.symbol}")

                    async for message in websocket:
                        if not self.is_running:
                            break
                        data = json.loads(message)
                        if data.get("msg_type") == "tick":
                            await self.process_tick(data["tick"])

            except websockets.exceptions.ConnectionClosed:
                logging.warning(f"Connection lost for {self.symbol}. Reconnecting in 3s...")
                await asyncio.sleep(3)
            except Exception as e:
                logging.error(f"Unexpected error in {self.symbol} analyzer: {e}")
                await asyncio.sleep(3)

    async def process_tick(self, tick: Dict[str, Any]):
        price = float(tick["quote"])
        epoch = int(tick.get("epoch", time.time()))
        price_str = f"{price:.4f}"
        last_digit = int(price_str[-1])

        self.current_quote = price
        self.last_digit = last_digit
        self.price_history.append(price)
        self.digit_history.append(last_digit)
        self.time_history.append(epoch)

        # Emit raw tick to connected frontend charts via Socket.IO
        await sio.emit("tick", {
            "symbol": self.symbol,
            "quote": price,
            "epoch": epoch,
            "digit": last_digit,
        })

        if len(self.price_history) >= 30:
            prices = list(self.price_history)
            digits = list(self.digit_history)

            # --- Compute Pro Indicators ---
            ema_9 = self.calculate_ema(prices, 9)
            ema_21 = self.calculate_ema(prices, 21)
            rsi = self.calculate_rsi(prices, 14)
            atr = self.calculate_atr(prices, 14)
            bb_upper, bb_lower, bb_mid = self.calculate_bollinger_bands(prices[-20:], 20, 2.0)

            # --- Digit Streak Stats ---
            even_count = sum(1 for d in digits if d % 2 == 0)
            odd_count = len(digits) - even_count
            current_streak_type = "EVEN" if digits[-1] % 2 == 0 else "ODD"
            current_streak_count = self.get_current_streak(digits, lambda x: (x % 2 == 0) if current_streak_type == "EVEN" else (x % 2 != 0))

            # --- Trend / Momentum Classification ---
            trend = "BULLISH" if ema_9 > ema_21 and rsi > 50 else "BEARISH" if ema_9 < ema_21 and rsi < 50 else "NEUTRAL"

            # --- Bollinger Volatility Status ---
            in_out = "GOES OUT" if (price > bb_upper or price < bb_lower) else "STAYS IN"

            # --- High Confluence Setup Evaluation ---
            confluence = self.evaluate_high_confluence(
                price=price,
                ema_9=ema_9,
                ema_21=ema_21,
                rsi=rsi,
                atr=atr,
                bb_upper=bb_upper,
                bb_lower=bb_lower,
                streak_count=current_streak_count,
                streak_type=current_streak_type,
            )

            snapshot = {
                "symbol": self.symbol,
                "price": price,
                "last_digit": last_digit,
                "epoch": epoch,
                "ema_9": round(ema_9, 4),
                "ema_21": round(ema_21, 4),
                "rsi": round(rsi, 2),
                "atr": round(atr, 4),
                "bb_upper": round(bb_upper, 4),
                "bb_lower": round(bb_lower, 4),
                "bb_mid": round(bb_mid, 4),
                "trend": trend,
                "in_out": in_out,
                "even_count": even_count,
                "odd_count": odd_count,
                "current_streak_count": current_streak_count,
                "current_streak_type": current_streak_type,
                "confluence": confluence,
            }

            MARKET_SNAPSHOTS[self.symbol] = snapshot

            # Broadcast updated indicators to frontend
            await sio.emit("market_update", snapshot)

            # Trigger High Confluence Alert
            now = time.time()
            if confluence.get("is_triggered") and (now - self.last_alert_time > 10.0):
                self.last_alert_time = now
                alert_payload = {
                    "id": f"alert_{self.symbol}_{int(now)}",
                    "timestamp": now,
                    "timeString": time.strftime("%H:%M:%S", time.localtime(now)),
                    "symbol": self.symbol,
                    "price": price,
                    "last_digit": last_digit,
                    "title": confluence["title"],
                    "direction": confluence["direction"],
                    "recommended_contract": confluence["recommended_contract"],
                    "confidence": confluence["confidence"],
                    "reason": confluence["reason"],
                    "indicators": {
                        "ema_9": round(ema_9, 4),
                        "ema_21": round(ema_21, 4),
                        "rsi": round(rsi, 2),
                        "atr": round(atr, 4),
                        "streak": f"{current_streak_count}x {current_streak_type}",
                    },
                }

                HIGH_CONFLUENCE_ALERTS.insert(0, alert_payload)
                if len(HIGH_CONFLUENCE_ALERTS) > 50:
                    HIGH_CONFLUENCE_ALERTS.pop()

                logging.info(
                    f"🔥 [HIGH CONFLUENCE ALERT] {self.symbol} -> {confluence['title']} ({confluence['confidence']}%)"
                )
                await sio.emit("high_confluence_alert", alert_payload)

    def evaluate_high_confluence(
        self,
        price: float,
        ema_9: float,
        ema_21: float,
        rsi: float,
        atr: float,
        bb_upper: float,
        bb_lower: float,
        streak_count: int,
        streak_type: str,
    ) -> Dict[str, Any]:
        """
        Evaluates strict multi-indicator confluence.
        Alerts only when multiple independent factors align:
          1. EMA 9 / EMA 21 Trend alignment
          2. RSI directional confirmation (55+ for Rise, <45 for Fall)
          3. Volatility expansion / ATR confirmation
          4. Digit streak counter-trend exhaustion or momentum
        """
        # Confluence 1: Explosive Bullish Setup
        if ema_9 > ema_21 and rsi >= 56.0 and (price > bb_mid):
            conf = min(96, int(78 + (rsi - 50) * 1.1 + (1 if atr > 0.5 else 0)))
            return {
                "is_triggered": True,
                "title": f"BULLISH CONFLUENCE BREAKOUT ({self.symbol})",
                "direction": "RISE",
                "recommended_contract": "CALL",
                "confidence": conf,
                "reason": f"EMA 9 ({ema_9:.4f}) > EMA 21 with strong RSI ({rsi:.1f}) and price above Bollinger Midline.",
            }

        # Confluence 2: Explosive Bearish Setup
        if ema_9 < ema_21 and rsi <= 44.0 and (price < bb_mid):
            conf = min(96, int(78 + (50 - rsi) * 1.1 + (1 if atr > 0.5 else 0)))
            return {
                "is_triggered": True,
                "title": f"BEARISH CONFLUENCE BREAKOUT ({self.symbol})",
                "direction": "FALL",
                "recommended_contract": "PUT",
                "confidence": conf,
                "reason": f"EMA 9 ({ema_9:.4f}) < EMA 21 with weak RSI ({rsi:.1f}) and price below Bollinger Midline.",
            }

        # Confluence 3: Extreme Digit Streak Exhaustion (>= 4x in a row)
        if streak_count >= 4:
            opp_type = "EVEN" if streak_type == "ODD" else "ODD"
            conf = min(95, 76 + streak_count * 4)
            return {
                "is_triggered": True,
                "title": f"EXTREME DIGIT {streak_type} EXHAUSTION ({streak_count}x)",
                "direction": opp_type,
                "recommended_contract": "DIGITEVEN" if opp_type == "EVEN" else "DIGITODD",
                "confidence": conf,
                "reason": f"{streak_count} consecutive {streak_type} digits observed. High statistical mean reversion to {opp_type}.",
            }

        # Confluence 4: Volatility Band Squeeze Breakout (GOES OUT)
        if price > bb_upper or price < bb_lower:
            is_above = price > bb_upper
            return {
                "is_triggered": True,
                "title": f"BOLLINGER 2-STD VOLATILITY EXPANSION ({self.symbol})",
                "direction": "GOES_OUT",
                "recommended_contract": "CALL" if is_above else "PUT",
                "confidence": 84,
                "reason": f"Price pierced {('Upper Band' if is_above else 'Lower Band')} with rising ATR ({atr:.4f}).",
            }

        return {"is_triggered": False, "confidence": 0}

    # --- Technical Indicator Math Functions ---
    @staticmethod
    def calculate_ema(data: List[float], period: int) -> float:
        if len(data) < period:
            return sum(data) / len(data) if data else 0.0
        multiplier = 2 / (period + 1)
        ema = sum(data[:period]) / period
        for price in data[period:]:
            ema = (price - ema) * multiplier + ema
        return ema

    @staticmethod
    def calculate_rsi(data: List[float], period: int = 14) -> float:
        if len(data) < period + 1:
            return 50.0
        gains, losses = 0.0, 0.0
        for i in range(-period, 0):
            change = data[i] - data[i - 1]
            if change > 0:
                gains += change
            else:
                losses -= change
        avg_gain = gains / period
        avg_loss = losses / period
        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        return 100.0 - (100.0 / (1.0 + rs))

    @staticmethod
    def calculate_atr(data: List[float], period: int = 14) -> float:
        if len(data) < period + 1:
            return 0.0
        ranges = [abs(data[i] - data[i - 1]) for i in range(-period, 0)]
        return sum(ranges) / len(ranges)

    @staticmethod
    def calculate_bollinger_bands(data: List[float], period: int = 20, num_std: float = 2.0):
        if len(data) < 2:
            val = data[0] if data else 0.0
            return val, val, val
        slice_data = data[-period:]
        mean = sum(slice_data) / len(slice_data)
        variance = sum((x - mean) ** 2 for x in slice_data) / len(slice_data)
        std_dev = variance ** 0.5
        upper = mean + (num_std * std_dev)
        lower = mean - (num_std * std_dev)
        return upper, lower, mean

    @staticmethod
    def get_current_streak(digits: List[int], condition_func) -> int:
        if not digits:
            return 0
        streak = 0
        target = condition_func(digits[-1])
        for d in reversed(digits):
            if condition_func(d) == target:
                streak += 1
            else:
                break
        return streak


# ------------------------------------------------------------------------------
# Concurrent Multi-Market Runner using asyncio.gather()
# ------------------------------------------------------------------------------
async def run_multi_market_scanner():
    """
    Runs concurrent ProDerivAnalyzer instances for R_10, R_50, R_75, R_100 simultaneously.
    """
    logging.info(f"🚀 Initializing Concurrent Multi-Market Scanner for: {SCAN_SYMBOLS}")
    analyzers = [ProDerivAnalyzer(symbol=s) for s in SCAN_SYMBOLS]
    await asyncio.gather(*(a.start() for a in analyzers))


@app.on_event("startup")
async def startup_event():
    # Spawn the concurrent background task
    asyncio.create_task(run_multi_market_scanner())


# ------------------------------------------------------------------------------
# REST API Endpoints
# ------------------------------------------------------------------------------
@app.get("/")
def get_info():
    return {
        "status": "online",
        "service": "Pro Deriv Multi-Market Scanner (FastAPI + Socket.IO)",
        "monitored_markets": SCAN_SYMBOLS,
        "socketio_events": ["tick", "market_update", "high_confluence_alert"],
    }


@app.get("/api/markets")
def get_markets():
    return {"markets": MARKET_SNAPSHOTS}


@app.get("/api/alerts")
def get_alerts():
    return {"alerts": HIGH_CONFLUENCE_ALERTS}


# Socket.IO Event Handlers
@sio.event
async def connect(sid, environ):
    logging.info(f"Client connected via Socket.IO: {sid}")
    # Immediately send the latest state of all markets upon connection
    await sio.emit("initial_state", {"markets": MARKET_SNAPSHOTS, "alerts": HIGH_CONFLUENCE_ALERTS}, to=sid)


@sio.event
async def disconnect(sid):
    logging.info(f"Client disconnected: {sid}")
