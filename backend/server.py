from fastapi import FastAPI, APIRouter, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import logging
import requests
import pandas as pd
import numpy as np
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any, Union
import uuid
from datetime import datetime, date, timedelta
import json
import traceback

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Tradier API settings
TRADIER_API_KEY = os.environ['TRADIER_API_KEY']
TRADIER_API_BASE_URL = os.environ['TRADIER_API_BASE_URL']

# Create the main app without a prefix
app = FastAPI(title="Options Trading Dashboard API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
class OptionContract(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    symbol: str
    expiration_date: str
    strike: float
    option_type: str  # 'call' or 'put'
    bid: float
    ask: float
    last: float
    volume: int
    open_interest: int
    greeks: Dict[str, float] = {}
    iv: float = 0.0
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class TradingStrategy(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    parameters: Dict[str, Any] = {}
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class BacktestResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    strategy_id: str
    start_date: datetime
    end_date: datetime
    initial_capital: float
    final_capital: float
    trade_history: List[Dict[str, Any]] = []
    metrics: Dict[str, float] = {}
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Helper functions for Tradier API
def get_tradier_headers():
    return {
        "Authorization": f"Bearer {TRADIER_API_KEY}",
        "Accept": "application/json"
    }

async def fetch_options_chain(symbol: str, expiration: str = None):
    """Fetch options chain data from Tradier API"""
    try:
        # If no expiration provided, get the next expiration date
        if not expiration:
            expirations_url = f"{TRADIER_API_BASE_URL}/markets/options/expirations"
            params = {"symbol": symbol, "includeAllRoots": "true"}
            expirations_response = requests.get(
                expirations_url, 
                params=params, 
                headers=get_tradier_headers()
            )
            
            if expirations_response.status_code != 200:
                logger.error(f"Error fetching expirations: {expirations_response.text}")
                return {"error": "Failed to fetch expirations"}
            
            expirations_data = expirations_response.json()
            
            if "expirations" not in expirations_data or not expirations_data["expirations"]:
                return {"error": "No expirations found for symbol"}
            
            # Get the closest expiration date
            expiration = expirations_data["expirations"]["date"][0] if isinstance(expirations_data["expirations"]["date"], list) else expirations_data["expirations"]["date"]
        
        # Fetch options chain
        options_url = f"{TRADIER_API_BASE_URL}/markets/options/chains"
        params = {"symbol": symbol, "expiration": expiration, "greeks": "true"}
        response = requests.get(options_url, params=params, headers=get_tradier_headers())
        
        if response.status_code != 200:
            logger.error(f"Error fetching options chain: {response.text}")
            return {"error": "Failed to fetch options chain"}
        
        return response.json()
    except Exception as e:
        logger.error(f"Exception in fetch_options_chain: {str(e)}")
        logger.error(traceback.format_exc())
        return {"error": str(e)}

async def fetch_market_data(symbol: str, interval: str = "daily", start_date: str = None, end_date: str = None):
    """Fetch market data from Tradier API"""
    try:
        if not start_date:
            # Default to 1 month ago
            start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")
            
        url = f"{TRADIER_API_BASE_URL}/markets/history"
        params = {
            "symbol": symbol,
            "interval": interval,
            "start": start_date,
            "end": end_date
        }
        
        response = requests.get(url, params=params, headers=get_tradier_headers())
        
        if response.status_code != 200:
            logger.error(f"Error fetching market data: {response.text}")
            return {"error": "Failed to fetch market data"}
        
        return response.json()
    except Exception as e:
        logger.error(f"Exception in fetch_market_data: {str(e)}")
        return {"error": str(e)}

async def fetch_quotes(symbols: List[str]):
    """Fetch quotes for multiple symbols from Tradier API"""
    try:
        url = f"{TRADIER_API_BASE_URL}/markets/quotes"
        params = {
            "symbols": ",".join(symbols)
        }
        
        response = requests.get(url, params=params, headers=get_tradier_headers())
        
        if response.status_code != 200:
            logger.error(f"Error fetching quotes: {response.text}")
            return {"error": "Failed to fetch quotes"}
        
        return response.json()
    except Exception as e:
        logger.error(f"Exception in fetch_quotes: {str(e)}")
        return {"error": str(e)}

# Helper functions for options analysis
def calculate_gex(options_data):
    """Calculate Gamma Exposure (GEX) from options data"""
    try:
        if "options" not in options_data or not options_data["options"]:
            return {"error": "No options data found"}
        
        # Extract options and convert to DataFrame
        options_list = []
        for option in options_data["options"]["option"]:
            if "greeks" in option and option["greeks"]:
                option_data = {
                    "strike": option["strike"],
                    "option_type": option["option_type"],
                    "gamma": option["greeks"]["gamma"] if "gamma" in option["greeks"] else 0,
                    "open_interest": option["open_interest"] if "open_interest" in option else 0,
                    "volume": option["volume"] if "volume" in option else 0
                }
                options_list.append(option_data)
        
        if not options_list:
            return {"error": "No valid options with Greeks found"}
            
        df = pd.DataFrame(options_list)
        
        # Calculate GEX: gamma * open_interest * 100 (contract multiplier) * (+1 for calls, -1 for puts)
        df["gex_sign"] = df["option_type"].apply(lambda x: 1 if x == "call" else -1)
        df["gex"] = df["gamma"] * df["open_interest"] * 100 * df["gex_sign"]
        
        # Aggregate by strike price
        gex_by_strike = df.groupby("strike")["gex"].sum().reset_index()
        
        # Convert to dictionary for JSON response
        result = {
            "strikes": gex_by_strike["strike"].tolist(),
            "gex_values": gex_by_strike["gex"].tolist(),
            "total_gex": gex_by_strike["gex"].sum()
        }
        
        return result
    except Exception as e:
        logger.error(f"Exception in calculate_gex: {str(e)}")
        logger.error(traceback.format_exc())
        return {"error": str(e)}

def calculate_dex(options_data):
    """Calculate Delta Exposure (DEX) from options data"""
    try:
        if "options" not in options_data or not options_data["options"]:
            return {"error": "No options data found"}
        
        # Extract options and convert to DataFrame
        options_list = []
        for option in options_data["options"]["option"]:
            if "greeks" in option and option["greeks"]:
                option_data = {
                    "strike": option["strike"],
                    "option_type": option["option_type"],
                    "delta": option["greeks"]["delta"] if "delta" in option["greeks"] else 0,
                    "open_interest": option["open_interest"] if "open_interest" in option else 0
                }
                options_list.append(option_data)
        
        if not options_list:
            return {"error": "No valid options with Greeks found"}
            
        df = pd.DataFrame(options_list)
        
        # Calculate DEX: delta * open_interest * 100 (contract multiplier)
        # For puts, delta is already negative, so no sign flip needed
        df["dex"] = df["delta"] * df["open_interest"] * 100
        
        # Aggregate by strike price
        dex_by_strike = df.groupby("strike")["dex"].sum().reset_index()
        
        # Convert to dictionary for JSON response
        result = {
            "strikes": dex_by_strike["strike"].tolist(),
            "dex_values": dex_by_strike["dex"].tolist(),
            "total_dex": dex_by_strike["dex"].sum()
        }
        
        return result
    except Exception as e:
        logger.error(f"Exception in calculate_dex: {str(e)}")
        logger.error(traceback.format_exc())
        return {"error": str(e)}

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Options Trading Dashboard API"}

@api_router.get("/options/{symbol}")
async def get_options_chain(symbol: str, expiration: Optional[str] = None):
    """Get options chain for a given symbol and expiration date"""
    try:
        options_data = await fetch_options_chain(symbol, expiration)
        return options_data
    except Exception as e:
        logger.error(f"Error in get_options_chain: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/market/{symbol}")
async def get_market_data(
    symbol: str, 
    interval: str = "daily", 
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None
):
    """Get market data for a given symbol"""
    try:
        market_data = await fetch_market_data(symbol, interval, start_date, end_date)
        return market_data
    except Exception as e:
        logger.error(f"Error in get_market_data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/quotes")
async def get_quotes(symbols: str = Query(..., description="Comma-separated list of symbols")):
    """Get quotes for given symbols"""
    try:
        symbols_list = [s.strip() for s in symbols.split(",")]
        quotes_data = await fetch_quotes(symbols_list)
        return quotes_data
    except Exception as e:
        logger.error(f"Error in get_quotes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/analysis/gex/{symbol}")
async def get_gex_analysis(symbol: str, expiration: Optional[str] = None):
    """Get Gamma Exposure (GEX) analysis for a given symbol"""
    try:
        options_data = await fetch_options_chain(symbol, expiration)
        gex_analysis = calculate_gex(options_data)
        return gex_analysis
    except Exception as e:
        logger.error(f"Error in get_gex_analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/analysis/dex/{symbol}")
async def get_dex_analysis(symbol: str, expiration: Optional[str] = None):
    """Get Delta Exposure (DEX) analysis for a given symbol"""
    try:
        options_data = await fetch_options_chain(symbol, expiration)
        dex_analysis = calculate_dex(options_data)
        return dex_analysis
    except Exception as e:
        logger.error(f"Error in get_dex_analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/strategies")
async def get_strategies():
    """Get all trading strategies"""
    try:
        # Fixed list of options strategies with descriptions
        strategies = [
            {
                "id": "covered-call",
                "name": "Covered Call",
                "description": "A strategy where you own the underlying stock and sell call options against it to generate income.",
                "parameters": {
                    "stock_allocation": 100,
                    "option_strike_pct": 5, # % OTM
                    "days_to_expiration": 30
                }
            },
            {
                "id": "cash-secured-put",
                "name": "Cash-Secured Put",
                "description": "A strategy where you sell a put option and set aside enough cash to buy the stock if the option is exercised.",
                "parameters": {
                    "cash_allocation": 100,
                    "option_strike_pct": -5, # % OTM
                    "days_to_expiration": 30
                }
            },
            {
                "id": "iron-condor",
                "name": "Iron Condor",
                "description": "A neutral options strategy that profits from low volatility and time decay.",
                "parameters": {
                    "call_spread_width": 10,
                    "put_spread_width": 10,
                    "call_wing_otm_pct": 10,
                    "put_wing_otm_pct": 10,
                    "days_to_expiration": 30
                }
            },
            {
                "id": "bull-call-spread",
                "name": "Bull Call Spread",
                "description": "A bullish, defined risk strategy that profits from a rise in the underlying asset's price.",
                "parameters": {
                    "width": 5,
                    "lower_strike_pct": 0, # ATM
                    "days_to_expiration": 30
                }
            },
            {
                "id": "bear-put-spread",
                "name": "Bear Put Spread",
                "description": "A bearish, defined risk strategy that profits from a fall in the underlying asset's price.",
                "parameters": {
                    "width": 5, 
                    "upper_strike_pct": 0, # ATM
                    "days_to_expiration": 30
                }
            },
            {
                "id": "calendar-spread",
                "name": "Calendar Spread",
                "description": "A strategy that involves selling short-term options and buying longer-term options at the same strike price.",
                "parameters": {
                    "strike_pct": 0, # ATM
                    "short_days_to_expiration": 30,
                    "long_days_to_expiration": 60
                }
            },
            {
                "id": "butterfly-spread",
                "name": "Butterfly Spread",
                "description": "A neutral strategy with limited risk and profit potential, created with three strikes.",
                "parameters": {
                    "width": 5,
                    "center_strike_pct": 0, # ATM
                    "days_to_expiration": 30
                }
            },
            {
                "id": "straddle",
                "name": "Straddle",
                "description": "Buying calls and puts at the same strike price to profit from high volatility.",
                "parameters": {
                    "strike_pct": 0, # ATM
                    "days_to_expiration": 30
                }
            },
            {
                "id": "strangle",
                "name": "Strangle",
                "description": "Buying OTM calls and puts to profit from high volatility at a lower cost than a straddle.",
                "parameters": {
                    "call_strike_pct": 5, # % OTM
                    "put_strike_pct": -5, # % OTM
                    "days_to_expiration": 30
                }
            },
            {
                "id": "diagonal-spread",
                "name": "Diagonal Spread",
                "description": "A strategy similar to a calendar spread but with different strike prices.",
                "parameters": {
                    "strike_diff_pct": 5,
                    "short_days_to_expiration": 30,
                    "long_days_to_expiration": 60
                }
            }
        ]
        return strategies
    except Exception as e:
        logger.error(f"Error in get_strategies: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Simplified backtest function
@api_router.post("/backtest/{strategy_id}")
async def run_backtest(
    strategy_id: str, 
    symbol: str = Query(..., description="Symbol to backtest"),
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    initial_capital: float = Query(10000, description="Initial capital for backtest")
):
    """Run a backtest for a given strategy and parameters"""
    try:
        # Fetch market data for backtest period
        market_data = await fetch_market_data(symbol, "daily", start_date, end_date)
        
        if "error" in market_data:
            return {"error": market_data["error"]}
            
        if "history" not in market_data or not market_data["history"]:
            return {"error": "No historical data available for backtest period"}
            
        # Simplified backtest calculation - just for demonstration
        # In a real implementation, this would involve complex strategy logic
        
        # Convert to dataframe for easier manipulation
        history = market_data["history"]["day"]
        df = pd.DataFrame(history)
        
        # Simulate very basic trading (just for demonstration)
        df["return"] = df["close"].pct_change()
        
        # Get strategy
        strategies = await get_strategies()
        strategy = next((s for s in strategies if s["id"] == strategy_id), None)
        
        if not strategy:
            return {"error": "Strategy not found"}
            
        # Apply a simple trading logic based on strategy type (extremely simplified)
        trade_history = []
        capital = initial_capital
        
        # Simulated trades and PnL based on strategy
        if strategy["name"] == "Covered Call":
            # Simplified covered call simulation
            position_size = 100  # Number of shares
            buy_price = df.iloc[0]["close"]
            investment = buy_price * position_size
            
            if investment > capital:
                position_size = int(capital / buy_price)
                investment = buy_price * position_size
                
            capital -= investment
            
            # Simulate premium collection (very simplified)
            for i in range(1, len(df)):
                if i % 30 == 0:  # Monthly premium collection
                    premium = df.iloc[i]["close"] * 0.02 * position_size  # 2% premium
                    capital += premium
                    trade_history.append({
                        "date": df.iloc[i]["date"],
                        "action": "Sell Call",
                        "price": df.iloc[i]["close"],
                        "premium": premium,
                        "capital": capital + (df.iloc[i]["close"] * position_size)
                    })
            
            # Final position value
            final_stock_value = df.iloc[-1]["close"] * position_size
            final_capital = capital + final_stock_value
            
        elif strategy["name"] == "Iron Condor":
            # Simplified iron condor simulation
            for i in range(0, len(df) - 30, 30):  # 30-day cycles
                if i + 30 >= len(df):
                    break
                    
                entry_price = df.iloc[i]["close"]
                exit_price = df.iloc[i + 30]["close"]
                
                # Simplified P/L calculation for iron condor
                price_change_pct = (exit_price - entry_price) / entry_price * 100
                
                # Iron condor profits when price stays within range
                if abs(price_change_pct) < 5:  # If price movement is small
                    profit = capital * 0.03  # 3% profit
                else:
                    profit = -capital * 0.05  # 5% loss
                
                capital += profit
                
                trade_history.append({
                    "date": df.iloc[i + 30]["date"],
                    "action": "Iron Condor Cycle",
                    "entry_price": entry_price,
                    "exit_price": exit_price,
                    "profit": profit,
                    "capital": capital
                })
                
            final_capital = capital
        else:
            # Default simulation for other strategies
            # Just simulate buying and holding with some random variations
            buy_price = df.iloc[0]["close"]
            sell_price = df.iloc[-1]["close"]
            
            # Simplified return calculation
            returns = (sell_price - buy_price) / buy_price
            pnl = initial_capital * returns
            
            # Add some variation based on strategy
            if "Bull" in strategy["name"]:
                pnl *= 1.2  # Bullish strategies perform better in uptrends
            elif "Bear" in strategy["name"]:
                pnl *= 0.8  # Bearish strategies perform worse in uptrends
                
            final_capital = initial_capital + pnl
            
            trade_history.append({
                "date": df.iloc[0]["date"],
                "action": "Entry",
                "price": buy_price,
                "capital": initial_capital
            })
            
            trade_history.append({
                "date": df.iloc[-1]["date"],
                "action": "Exit",
                "price": sell_price,
                "capital": final_capital
            })
        
        # Calculate metrics
        total_return = (final_capital - initial_capital) / initial_capital * 100
        daily_returns = df["return"].dropna()
        
        # Calculate annualized metrics
        days = len(df)
        annualized_return = total_return * (365 / days)
        
        # Calculate Sharpe ratio (simplified)
        risk_free_rate = 0.02  # 2% risk-free rate
        sharpe_ratio = (annualized_return - risk_free_rate) / (daily_returns.std() * np.sqrt(252))
        
        # Maximum drawdown
        cum_returns = (1 + daily_returns).cumprod()
        running_max = cum_returns.cummax()
        drawdown = (cum_returns / running_max) - 1
        max_drawdown = drawdown.min() * 100
        
        metrics = {
            "total_return_pct": total_return,
            "annualized_return_pct": annualized_return,
            "sharpe_ratio": float(sharpe_ratio),
            "max_drawdown_pct": float(max_drawdown)
        }
        
        result = {
            "id": str(uuid.uuid4()),
            "strategy_id": strategy_id,
            "strategy_name": strategy["name"],
            "symbol": symbol,
            "start_date": start_date,
            "end_date": end_date,
            "initial_capital": initial_capital,
            "final_capital": float(final_capital),
            "trade_history": trade_history,
            "metrics": metrics,
            "price_history": [
                {"date": day["date"], "price": day["close"]} 
                for day in history
            ]
        }
        
        # Save backtest result to database
        await db.backtest_results.insert_one(result)
        
        return result
    except Exception as e:
        logger.error(f"Error in run_backtest: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/backtest/results")
async def get_backtest_results():
    """Get all backtest results"""
    try:
        results = await db.backtest_results.find().to_list(100)
        # Convert ObjectId to string
        for result in results:
            result["_id"] = str(result["_id"])
        return results
    except Exception as e:
        logger.error(f"Error in get_backtest_results: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

# Add P&L calculation endpoints
@api_router.post("/calculate-strategy-pnl")
async def calculate_strategy_pnl(
    request: dict
):
    """Calculate P&L for a given options strategy at different price points"""
    try:
        strategy_type = request.get("strategy_type")
        underlying_price = request.get("underlying_price", 0)
        legs = request.get("legs", [])
        price_range_pct = request.get("price_range_pct", 20)  # Default: ±20%
        
        if not strategy_type or not underlying_price or not legs:
            return {"error": "Missing required parameters"}
        
        # Calculate price range for P&L curve
        min_price = underlying_price * (1 - price_range_pct / 100)
        max_price = underlying_price * (1 + price_range_pct / 100)
        price_points = 50  # Number of points in the P&L curve
        prices = np.linspace(min_price, max_price, price_points)
        
        # Function to calculate option price at expiration (intrinsic value)
        def option_value_at_expiry(option_type, strike, underlying):
            if option_type == "call":
                return max(0, underlying - strike)
            elif option_type == "put":
                return max(0, strike - underlying)
            return 0
        
        # Calculate P&L at each price point
        pnl_curve = []
        initial_cost = 0
        
        # Calculate initial cost/credit of the position
        for leg in legs:
            option_type = leg.get("option_type", "")
            quantity = leg.get("quantity", 0)
            price = leg.get("price", 0)
            initial_cost += price * quantity * 100  # Each contract is for 100 shares
        
        for price in prices:
            total_pnl = -initial_cost  # Start with the initial cost/credit
            
            # Add the value at expiration for each leg
            for leg in legs:
                option_type = leg.get("option_type", "")
                strike = leg.get("strike", 0)
                quantity = leg.get("quantity", 0)
                
                # Calculate the value at this price point
                value = option_value_at_expiry(option_type, strike, price)
                total_pnl += value * quantity * 100  # Each contract is for 100 shares
            
            pnl_curve.append({
                "price": float(price),
                "pnl": float(total_pnl)
            })
        
        # Find max profit, max loss, and breakeven points
        pnl_values = [point["pnl"] for point in pnl_curve]
        max_profit = max(pnl_values)
        max_loss = min(pnl_values)
        
        # Find breakeven points (where P&L crosses zero)
        breakeven_points = []
        for i in range(1, len(pnl_curve)):
            if (pnl_curve[i-1]["pnl"] <= 0 and pnl_curve[i]["pnl"] >= 0) or \
               (pnl_curve[i-1]["pnl"] >= 0 and pnl_curve[i]["pnl"] <= 0):
                # Linear interpolation to find more accurate breakeven point
                p1 = pnl_curve[i-1]["price"]
                p2 = pnl_curve[i]["price"]
                pnl1 = pnl_curve[i-1]["pnl"]
                pnl2 = pnl_curve[i]["pnl"]
                
                # Avoid division by zero
                if pnl2 - pnl1 != 0:
                    breakeven_price = p1 + (p2 - p1) * (-pnl1) / (pnl2 - pnl1)
                    breakeven_points.append(float(breakeven_price))
        
        return {
            "strategy_type": strategy_type,
            "underlying_price": underlying_price,
            "pnl_curve": pnl_curve,
            "max_profit": float(max_profit),
            "max_loss": float(max_loss),
            "breakeven_points": breakeven_points,
            "initial_cost": float(initial_cost)
        }
        
    except Exception as e:
        logger.error(f"Error in calculate_strategy_pnl: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/submit-trade")
async def submit_trade(
    request: dict
):
    """Submit a trade based on a strategy"""
    try:
        strategy_id = request.get("strategy_id")
        symbol = request.get("symbol")
        legs = request.get("legs", [])
        
        if not strategy_id or not symbol or not legs:
            return {"error": "Missing required parameters"}
        
        # Create a trade record in the database
        trade = {
            "id": str(uuid.uuid4()),
            "strategy_id": strategy_id,
            "symbol": symbol,
            "legs": legs,
            "status": "simulated",  # In a real system, this would be 'pending', 'executed', etc.
            "created_at": datetime.utcnow()
        }
        
        # Store the trade in MongoDB
        await db.trades.insert_one(trade)
        
        # Remove the MongoDB _id for response
        trade["_id"] = str(trade["_id"])
        
        return trade
        
    except Exception as e:
        logger.error(f"Error in submit_trade: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/trades")
async def get_trades():
    """Get all trades"""
    try:
        trades = await db.trades.find().to_list(100)
        
        # Convert ObjectId to string
        for trade in trades:
            trade["_id"] = str(trade["_id"])
            
        return trades
    except Exception as e:
        logger.error(f"Error in get_trades: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
