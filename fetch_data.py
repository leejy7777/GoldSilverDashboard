import yfinance as yf
import json
import datetime
import os
import numpy as np
import pandas as pd

def fetch_market_data():
    # Define the tickers for Gold and Silver
    tickers = {
        "metals": {
            "Gold (선물)": "GC=F",
            "Gold (현물 ETF)": "GLD",
            "Silver (선물)": "SI=F",
            "Silver (현물 ETF)": "SLV"
        }
    }
    
    result = {
        "last_updated": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).strftime("%Y-%m-%d %H:%M:%S"),
        "usd_krw": 1300.0, # Default placeholder
        "metals": []
    }

    print("Fetching Gold & Silver data...")
    
    try:
        krw_ticker = yf.Ticker("USDKRW=X")
        krw_hist = krw_ticker.history(period="5d")
        if len(krw_hist) > 0:
            result["usd_krw"] = krw_hist['Close'].tolist()[-1]
            print(f"[OK] Loaded USD/KRW: {result['usd_krw']}")
    except Exception as e:
        print(f"[ERROR] Error loading USD/KRW: {e}")

    # Fetch Metals
    for name, symbol in tickers["metals"].items():
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="5y")
            
            labels = hist.index.strftime('%Y-%m-%d').tolist()
            data = hist['Close'].tolist()
            
            # Format data for chart
            if len(data) > 0:
                current_price = data[-1]
                prev_price = data[-2] if len(data) > 1 else current_price
                change_percent = ((current_price - prev_price) / prev_price) * 100
                
                precision = 2
                
                result["metals"].append({
                    "name": name,
                    "symbol": symbol,
                    "current": round(current_price, precision),
                    "change_percent": round(change_percent, 2),
                    "stats": {
                        "mean": round(float(np.mean(data)), precision),
                        "median": round(float(np.median(data)), precision),
                        "high": round(float(np.max(data)), precision),
                        "low": round(float(np.min(data)), precision)
                    },
                    "history": {
                        "labels": labels,
                        "data": [round(val, precision) for val in data]
                    }
                })
                print(f"[OK] Loaded {name}")
            else:
                print(f"[FAIL] No data for {name}")
        except Exception as e:
            print(f"[ERROR] Error loading {name}: {e}")

    # Save to JSON
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(script_dir, 'market_data.json')
    
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=4)
        
    print(f"Data successfully saved to {json_path}")

if __name__ == "__main__":
    fetch_market_data()
