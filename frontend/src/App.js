import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import "./App.css";
import { 
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format, addDays, subDays, subMonths } from "date-fns";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Sidebar component
const Sidebar = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: "dashboard", name: "Dashboard" },
    { id: "options-chain", name: "Options Chain" },
    { id: "gex-dex", name: "GEX/DEX Analysis" },
    { id: "strategies", name: "Strategies" },
    { id: "backtesting", name: "Backtesting" },
  ];

  return (
    <div className="w-64 bg-gray-900 text-white h-screen fixed left-0 top-0 overflow-y-auto">
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-6">Options Dashboard</h1>
        <nav>
          <ul>
            {tabs.map((tab) => (
              <li key={tab.id} className="mb-2">
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left py-2 px-4 rounded transition-colors ${
                    activeTab === tab.id
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  {tab.name}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
};

// Symbol Selector Component
const SymbolSelector = ({ symbol, setSymbol, onSubmit }) => {
  const [inputValue, setInputValue] = useState(symbol);
  
  const popularSymbols = ["SPY", "QQQ", "AAPL", "MSFT", "TSLA", "AMZN", "NVDA", "GOOGL"];
  
  const handleSubmit = (e) => {
    e.preventDefault();
    setSymbol(inputValue.toUpperCase());
    onSubmit();
  };
  
  return (
    <div className="mb-6">
      <form onSubmit={handleSubmit} className="flex gap-2 mb-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter Symbol (e.g., SPY)"
          className="border p-2 rounded"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Load
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        {popularSymbols.map((s) => (
          <button
            key={s}
            onClick={() => {
              setInputValue(s);
              setSymbol(s);
              onSubmit();
            }}
            className="bg-gray-200 px-2 py-1 rounded text-sm hover:bg-gray-300"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
};

// Dashboard Component
const Dashboard = () => {
  const [symbol, setSymbol] = useState("SPY");
  const [marketData, setMarketData] = useState(null);
  const [optionsData, setOptionsData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch market data
      const marketResponse = await axios.get(`${API}/market/${symbol}`);
      setMarketData(marketResponse.data);
      
      // Fetch options data for basic info
      const optionsResponse = await axios.get(`${API}/options/${symbol}`);
      setOptionsData(optionsResponse.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Prepare chart data
  const chartData = {
    labels: marketData?.history?.day?.map(day => day.date) || [],
    datasets: [
      {
        label: symbol,
        data: marketData?.history?.day?.map(day => day.close) || [],
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: `${symbol} Price History`,
      },
    },
  };

  // Calculate some basic stats
  const lastPrice = marketData?.history?.day?.slice(-1)[0]?.close || 0;
  const firstPrice = marketData?.history?.day?.[0]?.close || 0;
  const percentChange = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(2);
  
  // Get option expiration dates
  const expirationDates = optionsData?.options?.option
    ? [...new Set(optionsData.options.option.map(option => option.expiration_date))]
    : [];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Market Dashboard</h2>
      
      <SymbolSelector symbol={symbol} setSymbol={setSymbol} onSubmit={fetchData} />
      
      {loading ? (
        <div className="flex justify-center my-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
        </div>
      ) : (
        <>
          {/* Market Overview Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-medium text-gray-900">Last Price</h3>
              <p className="text-3xl font-bold">${lastPrice.toFixed(2)}</p>
            </div>
            
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-medium text-gray-900">Change</h3>
              <p className={`text-3xl font-bold ${parseFloat(percentChange) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {percentChange}%
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-medium text-gray-900">Available Expirations</h3>
              <p className="text-lg">{expirationDates.length ? expirationDates[0] : 'None'}</p>
              {expirationDates.length > 1 && (
                <p className="text-sm text-gray-500">+{expirationDates.length - 1} more</p>
              )}
            </div>
          </div>
          
          {/* Price Chart */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <Line data={chartData} options={chartOptions} />
          </div>
          
          {/* Options Overview */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-xl font-medium mb-4">Options Overview</h3>
            
            {optionsData?.options?.option ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Call Options (5 nearest to ATM)</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Strike</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bid</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ask</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {optionsData.options.option
                          .filter(option => option.option_type === 'call')
                          .sort((a, b) => Math.abs(a.strike - lastPrice) - Math.abs(b.strike - lastPrice))
                          .slice(0, 5)
                          .map((option, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                              <td className="px-3 py-2 text-sm text-gray-900">${option.strike.toFixed(2)}</td>
                              <td className="px-3 py-2 text-sm text-gray-900">${option.bid.toFixed(2)}</td>
                              <td className="px-3 py-2 text-sm text-gray-900">${option.ask.toFixed(2)}</td>
                              <td className="px-3 py-2 text-sm text-gray-900">{option.volume}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Put Options (5 nearest to ATM)</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Strike</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bid</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ask</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {optionsData.options.option
                          .filter(option => option.option_type === 'put')
                          .sort((a, b) => Math.abs(a.strike - lastPrice) - Math.abs(b.strike - lastPrice))
                          .slice(0, 5)
                          .map((option, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                              <td className="px-3 py-2 text-sm text-gray-900">${option.strike.toFixed(2)}</td>
                              <td className="px-3 py-2 text-sm text-gray-900">${option.bid.toFixed(2)}</td>
                              <td className="px-3 py-2 text-sm text-gray-900">${option.ask.toFixed(2)}</td>
                              <td className="px-3 py-2 text-sm text-gray-900">{option.volume}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <p>No options data available</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Options Chain Component
const OptionsChain = () => {
  const [symbol, setSymbol] = useState("SPY");
  const [expirationDates, setExpirationDates] = useState([]);
  const [selectedExpiration, setSelectedExpiration] = useState("");
  const [optionsData, setOptionsData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchOptionsData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/options/${symbol}${selectedExpiration ? `?expiration=${selectedExpiration}` : ''}`);
      setOptionsData(response.data);
      
      // Extract unique expiration dates
      if (response.data?.options?.option) {
        const dates = [...new Set(response.data.options.option.map(option => option.expiration_date))];
        setExpirationDates(dates);
        
        // If we don't have a selected expiration yet, select the first one
        if (!selectedExpiration && dates.length > 0) {
          setSelectedExpiration(dates[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching options data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptionsData();
  }, [symbol, selectedExpiration]);

  const callOptions = optionsData?.options?.option
    ? optionsData.options.option.filter(option => option.option_type === 'call')
    : [];
    
  const putOptions = optionsData?.options?.option
    ? optionsData.options.option.filter(option => option.option_type === 'put')
    : [];

  // Group options by strike price for side-by-side display
  const optionsByStrike = {};
  
  // First, organize all call options by strike
  callOptions.forEach(call => {
    optionsByStrike[call.strike] = { call, put: null };
  });
  
  // Then add put options to the corresponding strike
  putOptions.forEach(put => {
    if (optionsByStrike[put.strike]) {
      optionsByStrike[put.strike].put = put;
    } else {
      optionsByStrike[put.strike] = { call: null, put };
    }
  });
  
  // Sort strikes for display
  const sortedStrikes = Object.keys(optionsByStrike)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Options Chain</h2>
      
      <SymbolSelector symbol={symbol} setSymbol={setSymbol} onSubmit={fetchOptionsData} />
      
      {/* Expiration Date Selector */}
      {expirationDates.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expiration Date
          </label>
          <select
            value={selectedExpiration}
            onChange={(e) => setSelectedExpiration(e.target.value)}
            className="w-full border rounded p-2"
          >
            {expirationDates.map(date => (
              <option key={date} value={date}>{date}</option>
            ))}
          </select>
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center my-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {sortedStrikes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th colSpan="5" className="px-4 py-2 text-center text-sm font-medium text-gray-900 bg-green-100">CALLS</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-900 bg-gray-200">STRIKE</th>
                    <th colSpan="5" className="px-4 py-2 text-center text-sm font-medium text-gray-900 bg-red-100">PUTS</th>
                  </tr>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase bg-green-50">Bid</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase bg-green-50">Ask</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase bg-green-50">Last</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase bg-green-50">Vol</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase bg-green-50">OI</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase bg-gray-100">Price</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase bg-red-50">Bid</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase bg-red-50">Ask</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase bg-red-50">Last</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase bg-red-50">Vol</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase bg-red-50">OI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedStrikes.map((strike, index) => (
                    <tr key={strike} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      {/* Call Data */}
                      {optionsByStrike[strike].call ? (
                        <>
                          <td className="px-3 py-2 text-sm text-gray-900 bg-green-50">${optionsByStrike[strike].call.bid.toFixed(2)}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 bg-green-50">${optionsByStrike[strike].call.ask.toFixed(2)}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 bg-green-50">${optionsByStrike[strike].call.last.toFixed(2)}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 bg-green-50">{optionsByStrike[strike].call.volume}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 bg-green-50">{optionsByStrike[strike].call.open_interest}</td>
                        </>
                      ) : (
                        <td colSpan="5" className="px-3 py-2 text-sm text-gray-500 bg-green-50 text-center">-</td>
                      )}
                      
                      {/* Strike */}
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 bg-gray-100 text-center">${parseFloat(strike).toFixed(2)}</td>
                      
                      {/* Put Data */}
                      {optionsByStrike[strike].put ? (
                        <>
                          <td className="px-3 py-2 text-sm text-gray-900 bg-red-50">${optionsByStrike[strike].put.bid.toFixed(2)}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 bg-red-50">${optionsByStrike[strike].put.ask.toFixed(2)}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 bg-red-50">${optionsByStrike[strike].put.last.toFixed(2)}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 bg-red-50">{optionsByStrike[strike].put.volume}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 bg-red-50">{optionsByStrike[strike].put.open_interest}</td>
                        </>
                      ) : (
                        <td colSpan="5" className="px-3 py-2 text-sm text-gray-500 bg-red-50 text-center">-</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              No options data available for {symbol} {selectedExpiration ? `on ${selectedExpiration}` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// GEX/DEX Analysis Component
const GexDexAnalysis = () => {
  const [symbol, setSymbol] = useState("SPY");
  const [expirationDates, setExpirationDates] = useState([]);
  const [selectedExpiration, setSelectedExpiration] = useState("");
  const [gexData, setGexData] = useState(null);
  const [dexData, setDexData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // First, fetch options data to get available expirations
      const optionsResponse = await axios.get(`${API}/options/${symbol}`);
      
      if (optionsResponse.data?.options?.option) {
        const dates = [...new Set(optionsResponse.data.options.option.map(option => option.expiration_date))];
        setExpirationDates(dates);
        
        // If we don't have a selected expiration yet, select the first one
        if (!selectedExpiration && dates.length > 0) {
          setSelectedExpiration(dates[0]);
        }
      }
      
      // Fetch GEX and DEX data
      const expParam = selectedExpiration ? `?expiration=${selectedExpiration}` : '';
      const [gexResponse, dexResponse] = await Promise.all([
        axios.get(`${API}/analysis/gex/${symbol}${expParam}`),
        axios.get(`${API}/analysis/dex/${symbol}${expParam}`)
      ]);
      
      setGexData(gexResponse.data);
      setDexData(dexResponse.data);
    } catch (error) {
      console.error("Error fetching GEX/DEX data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [symbol, selectedExpiration]);

  // Prepare chart data for GEX
  const gexChartData = {
    labels: gexData?.strikes || [],
    datasets: [
      {
        label: 'Gamma Exposure (GEX)',
        data: gexData?.gex_values || [],
        backgroundColor: (context) => {
          const value = context.dataset.data[context.dataIndex];
          return value >= 0 ? 'rgba(75, 192, 192, 0.6)' : 'rgba(255, 99, 132, 0.6)';
        },
        borderColor: (context) => {
          const value = context.dataset.data[context.dataIndex];
          return value >= 0 ? 'rgb(75, 192, 192)' : 'rgb(255, 99, 132)';
        },
        borderWidth: 1,
      },
    ],
  };
  
  // Prepare chart data for DEX
  const dexChartData = {
    labels: dexData?.strikes || [],
    datasets: [
      {
        label: 'Delta Exposure (DEX)',
        data: dexData?.dex_values || [],
        backgroundColor: (context) => {
          const value = context.dataset.data[context.dataIndex];
          return value >= 0 ? 'rgba(54, 162, 235, 0.6)' : 'rgba(255, 159, 64, 0.6)';
        },
        borderColor: (context) => {
          const value = context.dataset.data[context.dataIndex];
          return value >= 0 ? 'rgb(54, 162, 235)' : 'rgb(255, 159, 64)';
        },
        borderWidth: 1,
      },
    ],
  };
  
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${context.raw.toLocaleString()}`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Strike Price'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Exposure'
        }
      }
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">GEX/DEX Analysis</h2>
      
      <SymbolSelector symbol={symbol} setSymbol={setSymbol} onSubmit={fetchData} />
      
      {/* Expiration Date Selector */}
      {expirationDates.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expiration Date
          </label>
          <select
            value={selectedExpiration}
            onChange={(e) => setSelectedExpiration(e.target.value)}
            className="w-full border rounded p-2"
          >
            {expirationDates.map(date => (
              <option key={date} value={date}>{date}</option>
            ))}
          </select>
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center my-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* GEX Analysis */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-xl font-medium mb-4">Gamma Exposure (GEX) Analysis</h3>
            
            {gexData?.error ? (
              <p className="text-red-500">{gexData.error}</p>
            ) : gexData ? (
              <>
                <div className="mb-4">
                  <p className="text-lg font-semibold">
                    Total GEX: <span className={gexData.total_gex >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {gexData.total_gex.toLocaleString()}
                    </span>
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {gexData.total_gex >= 0 
                      ? "Positive GEX suggests potential resistance to downward price movement."
                      : "Negative GEX suggests potential acceleration of downward price movement."
                    }
                  </p>
                </div>
                
                <div className="h-96">
                  <Bar data={gexChartData} options={chartOptions} />
                </div>
              </>
            ) : (
              <p>No GEX data available</p>
            )}
          </div>
          
          {/* DEX Analysis */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-xl font-medium mb-4">Delta Exposure (DEX) Analysis</h3>
            
            {dexData?.error ? (
              <p className="text-red-500">{dexData.error}</p>
            ) : dexData ? (
              <>
                <div className="mb-4">
                  <p className="text-lg font-semibold">
                    Total DEX: <span className={dexData.total_dex >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {dexData.total_dex.toLocaleString()}
                    </span>
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {dexData.total_dex >= 0 
                      ? "Positive DEX suggests market makers have more long exposure."
                      : "Negative DEX suggests market makers have more short exposure."
                    }
                  </p>
                </div>
                
                <div className="h-96">
                  <Bar data={dexChartData} options={chartOptions} />
                </div>
              </>
            ) : (
              <p>No DEX data available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Trading Strategies Component
const Strategies = () => {
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [symbol, setSymbol] = useState("SPY");

  const fetchStrategies = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/strategies`);
      setStrategies(response.data);
    } catch (error) {
      console.error("Error fetching strategies:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategies();
  }, []);

  const handleCreateStrategy = () => {
    if (selectedStrategy) {
      setShowBuilder(true);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Options Trading Strategies</h2>
      
      {showBuilder ? (
        <StrategyBuilder 
          strategy={selectedStrategy} 
          symbol={symbol}
          onClose={() => setShowBuilder(false)}
          onSymbolChange={setSymbol}
        />
      ) : (
        <>
          <div className="mb-6">
            <div className="flex gap-4 items-center mb-4">
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="Symbol (e.g., SPY)"
                className="border rounded p-2"
              />
              <button
                onClick={handleCreateStrategy}
                disabled={!selectedStrategy}
                className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 ${
                  !selectedStrategy ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                Create Strategy
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center my-10">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {strategies.map(strategy => (
                <div 
                  key={strategy.id} 
                  className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all hover:shadow-lg ${
                    selectedStrategy?.id === strategy.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedStrategy(strategy)}
                >
                  <h3 className="text-lg font-medium">{strategy.name}</h3>
                  <p className="text-gray-600 text-sm mt-2">{strategy.description}</p>
                </div>
              ))}
            </div>
          )}
          
          {selectedStrategy && (
            <div className="mt-8 bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-bold">{selectedStrategy.name}</h3>
                <button 
                  onClick={() => setSelectedStrategy(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  &times;
                </button>
              </div>
              
              <p className="mt-4">{selectedStrategy.description}</p>
              
              <div className="mt-6">
                <h4 className="font-medium mb-2">Strategy Parameters</h4>
                <div className="bg-gray-50 p-4 rounded">
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                    {Object.entries(selectedStrategy.parameters).map(([key, value]) => (
                      <div key={key} className="flex">
                        <dt className="text-gray-600 w-1/2">{key.replace(/_/g, ' ')}:</dt>
                        <dd className="font-medium w-1/2">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
              
              <div className="mt-6 border-t pt-4">
                <h4 className="font-medium mb-2">Ideal Market Conditions</h4>
                {selectedStrategy.name === "Covered Call" && (
                  <p>Best in sideways or slightly bullish markets.</p>
                )}
                {selectedStrategy.name === "Cash-Secured Put" && (
                  <p>Best in sideways or slightly bullish markets.</p>
                )}
                {selectedStrategy.name === "Iron Condor" && (
                  <p>Best in sideways, low-volatility markets.</p>
                )}
                {selectedStrategy.name === "Bull Call Spread" && (
                  <p>Best in moderately bullish markets.</p>
                )}
                {selectedStrategy.name === "Bear Put Spread" && (
                  <p>Best in moderately bearish markets.</p>
                )}
                {selectedStrategy.name === "Calendar Spread" && (
                  <p>Best in sideways markets with increasing volatility.</p>
                )}
                {selectedStrategy.name === "Butterfly Spread" && (
                  <p>Best when you expect the price to be near a specific target at expiration.</p>
                )}
                {selectedStrategy.name === "Straddle" && (
                  <p>Best when expecting significant movement but unsure of direction.</p>
                )}
                {selectedStrategy.name === "Strangle" && (
                  <p>Best when expecting significant movement but unsure of direction, cheaper than straddle.</p>
                )}
                {selectedStrategy.name === "Diagonal Spread" && (
                  <p>Best in sideways to slightly bullish/bearish markets with increasing volatility.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Strategy Builder Component
const StrategyBuilder = ({ strategy, symbol, onClose, onSymbolChange }) => {
  const [optionsChain, setOptionsChain] = useState(null);
  const [expirations, setExpirations] = useState([]);
  const [selectedExpiration, setSelectedExpiration] = useState("");
  const [currentPrice, setCurrentPrice] = useState(0);
  const [legs, setLegs] = useState([]);
  const [pnlData, setPnlData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tradeSubmitted, setTradeSubmitted] = useState(false);
  const [tradeResult, setTradeResult] = useState(null);

  const fetchOptionsData = async () => {
    try {
      setLoading(true);
      
      // Fetch market data to get current price
      const marketResponse = await axios.get(`${API}/market/${symbol}`);
      if (marketResponse.data.history && marketResponse.data.history.day) {
        const lastPrice = marketResponse.data.history.day.slice(-1)[0].close;
        setCurrentPrice(lastPrice);
      }
      
      // Fetch options chain
      const optionsResponse = await axios.get(
        `${API}/options/${symbol}${selectedExpiration ? `?expiration=${selectedExpiration}` : ''}`
      );
      
      if (optionsResponse.data.options && optionsResponse.data.options.option) {
        setOptionsChain(optionsResponse.data);
        
        // Extract expirations
        const dates = [...new Set(optionsResponse.data.options.option.map(o => o.expiration_date))];
        setExpirations(dates);
        
        // Select first expiration if none selected
        if (!selectedExpiration && dates.length > 0) {
          setSelectedExpiration(dates[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching options data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptionsData();
  }, [symbol, selectedExpiration]);

  // Generate pre-filled legs based on selected strategy
  useEffect(() => {
    if (strategy && currentPrice > 0) {
      let newLegs = [];
      
      // Different leg setup based on strategy type
      switch (strategy.id) {
        case "covered-call":
          // Stock leg + Short call
          newLegs = [
            {
              id: "stock",
              type: "stock",
              action: "buy",
              quantity: 100,
              price: currentPrice,
              strike: null,
              option_type: null,
              isStock: true
            },
            {
              id: `call-${Date.now()}`,
              type: "option",
              action: "sell",
              quantity: 1,
              price: 0,
              strike: Math.round(currentPrice * (1 + strategy.parameters.option_strike_pct / 100)),
              option_type: "call",
              isStock: false
            }
          ];
          break;
          
        case "cash-secured-put":
          // Short put
          newLegs = [
            {
              id: `put-${Date.now()}`,
              type: "option",
              action: "sell",
              quantity: 1,
              price: 0,
              strike: Math.round(currentPrice * (1 + strategy.parameters.option_strike_pct / 100)),
              option_type: "put",
              isStock: false
            }
          ];
          break;
          
        case "iron-condor":
          // Bull put spread + bear call spread
          const lowerPutStrike = Math.round(currentPrice * (1 - strategy.parameters.put_wing_otm_pct / 100));
          const upperPutStrike = lowerPutStrike + strategy.parameters.put_spread_width;
          const lowerCallStrike = Math.round(currentPrice * (1 + strategy.parameters.call_wing_otm_pct / 100));
          const upperCallStrike = lowerCallStrike + strategy.parameters.call_spread_width;
          
          newLegs = [
            {
              id: `put-short-${Date.now()}`,
              type: "option",
              action: "sell",
              quantity: 1,
              price: 0,
              strike: upperPutStrike,
              option_type: "put",
              isStock: false
            },
            {
              id: `put-long-${Date.now()}`,
              type: "option",
              action: "buy",
              quantity: 1,
              price: 0,
              strike: lowerPutStrike,
              option_type: "put",
              isStock: false
            },
            {
              id: `call-short-${Date.now()}`,
              type: "option",
              action: "sell",
              quantity: 1,
              price: 0,
              strike: lowerCallStrike,
              option_type: "call",
              isStock: false
            },
            {
              id: `call-long-${Date.now()}`,
              type: "option",
              action: "buy",
              quantity: 1,
              price: 0,
              strike: upperCallStrike,
              option_type: "call",
              isStock: false
            }
          ];
          break;
          
        case "bull-call-spread":
          const lowerStrike = Math.round(currentPrice * (1 + strategy.parameters.lower_strike_pct / 100));
          const upperStrike = lowerStrike + strategy.parameters.width;
          
          newLegs = [
            {
              id: `call-long-${Date.now()}`,
              type: "option",
              action: "buy",
              quantity: 1,
              price: 0,
              strike: lowerStrike,
              option_type: "call",
              isStock: false
            },
            {
              id: `call-short-${Date.now()}`,
              type: "option",
              action: "sell",
              quantity: 1,
              price: 0,
              strike: upperStrike,
              option_type: "call",
              isStock: false
            }
          ];
          break;
          
        case "bear-put-spread":
          const upperPStrike = Math.round(currentPrice * (1 + strategy.parameters.upper_strike_pct / 100));
          const lowerPStrike = upperPStrike - strategy.parameters.width;
          
          newLegs = [
            {
              id: `put-long-${Date.now()}`,
              type: "option",
              action: "buy",
              quantity: 1,
              price: 0,
              strike: upperPStrike,
              option_type: "put",
              isStock: false
            },
            {
              id: `put-short-${Date.now()}`,
              type: "option",
              action: "sell",
              quantity: 1,
              price: 0,
              strike: lowerPStrike,
              option_type: "put",
              isStock: false
            }
          ];
          break;
          
        case "straddle":
          const atmStrike = Math.round(currentPrice);
          
          newLegs = [
            {
              id: `call-long-${Date.now()}`,
              type: "option",
              action: "buy",
              quantity: 1,
              price: 0,
              strike: atmStrike,
              option_type: "call",
              isStock: false
            },
            {
              id: `put-long-${Date.now()}`,
              type: "option",
              action: "buy",
              quantity: 1,
              price: 0,
              strike: atmStrike,
              option_type: "put",
              isStock: false
            }
          ];
          break;
          
        default:
          // Default to empty legs
          newLegs = [];
      }
      
      // Find and set option prices from the chain
      if (optionsChain && optionsChain.options && optionsChain.options.option) {
        newLegs = newLegs.map(leg => {
          if (!leg.isStock && leg.strike) {
            // Find matching option in the chain
            const option = optionsChain.options.option.find(
              o => o.option_type === leg.option_type && o.strike === leg.strike
            );
            
            if (option) {
              return {
                ...leg,
                price: leg.action === "buy" ? option.ask : option.bid
              };
            }
          }
          return leg;
        });
      }
      
      setLegs(newLegs);
    }
  }, [strategy, currentPrice, optionsChain]);

  // Calculate P&L whenever legs change
  useEffect(() => {
    calculatePnL();
  }, [legs]);

  const calculatePnL = async () => {
    if (legs.length === 0 || !currentPrice) return;
    
    try {
      const pnlLegs = legs.map(leg => {
        if (leg.isStock) {
          return {
            type: leg.type,
            quantity: leg.action === "buy" ? leg.quantity : -leg.quantity,
            price: leg.price
          };
        } else {
          return {
            option_type: leg.option_type,
            quantity: leg.action === "buy" ? leg.quantity : -leg.quantity,
            price: leg.price,
            strike: leg.strike
          };
        }
      });
      
      const response = await axios.post(`${API}/calculate-strategy-pnl`, {
        strategy_type: strategy.name,
        underlying_price: currentPrice,
        legs: pnlLegs,
        price_range_pct: 20
      });
      
      setPnlData(response.data);
    } catch (error) {
      console.error("Error calculating P&L:", error);
    }
  };

  const handleAddLeg = (type) => {
    const newLeg = {
      id: `${type}-${Date.now()}`,
      type: type === "stock" ? "stock" : "option",
      action: "buy",
      quantity: type === "stock" ? 100 : 1,
      price: type === "stock" ? currentPrice : 0,
      strike: type === "stock" ? null : Math.round(currentPrice),
      option_type: type === "stock" ? null : "call",
      isStock: type === "stock"
    };
    
    setLegs([...legs, newLeg]);
  };

  const handleRemoveLeg = (id) => {
    setLegs(legs.filter(leg => leg.id !== id));
  };

  const handleLegChange = (id, field, value) => {
    setLegs(prevLegs => prevLegs.map(leg => {
      if (leg.id === id) {
        const updatedLeg = { ...leg, [field]: value };
        
        // If changing the strike or option type, try to update the price from the options chain
        if ((field === 'strike' || field === 'option_type') && optionsChain && optionsChain.options) {
          const option = optionsChain.options.option.find(
            o => o.option_type === updatedLeg.option_type && o.strike === updatedLeg.strike
          );
          
          if (option) {
            updatedLeg.price = updatedLeg.action === "buy" ? option.ask : option.bid;
          }
        }
        
        return updatedLeg;
      }
      return leg;
    }));
  };

  const handleSubmitTrade = async () => {
    try {
      setLoading(true);
      
      const response = await axios.post(`${API}/submit-trade`, {
        strategy_id: strategy.id,
        symbol,
        legs: legs.map(leg => ({
          type: leg.type,
          action: leg.action,
          quantity: leg.quantity,
          price: leg.price,
          strike: leg.strike,
          option_type: leg.option_type
        }))
      });
      
      setTradeResult(response.data);
      setTradeSubmitted(true);
    } catch (error) {
      console.error("Error submitting trade:", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to find option price in chain
  const findOptionPrice = (optionType, strike, action) => {
    if (!optionsChain || !optionsChain.options || !optionsChain.options.option) return null;
    
    const option = optionsChain.options.option.find(
      o => o.option_type === optionType && o.strike === strike
    );
    
    if (option) {
      return action === "buy" ? option.ask : option.bid;
    }
    
    return null;
  };

  // Helper function to format price
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  // Prepare chart data for P&L
  const pnlChartData = pnlData ? {
    labels: pnlData.pnl_curve.map(point => point.price.toFixed(2)),
    datasets: [
      {
        label: 'Profit/Loss at Expiration',
        data: pnlData.pnl_curve.map(point => point.pnl),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        fill: false,
        tension: 0.1
      }
    ]
  } : null;
  
  const pnlChartOptions = {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: `${strategy.name} P&L at Expiration`
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `P&L: ${formatPrice(context.raw)}`;
          },
          title: function(tooltipItems) {
            return `Price: ${formatPrice(parseFloat(tooltipItems[0].label))}`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Underlying Price'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Profit/Loss ($)'
        },
        ticks: {
          callback: function(value) {
            return formatPrice(value);
          }
        }
      }
    }
  };

  if (tradeSubmitted) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold mb-4">Trade Submitted Successfully</h3>
        
        <div className="bg-green-50 border border-green-200 rounded p-4 mb-6">
          <p className="text-green-800">Your {strategy.name} trade for {symbol} has been submitted.</p>
        </div>
        
        <div className="mb-6">
          <h4 className="font-medium mb-2">Trade Details</h4>
          <div className="bg-gray-50 p-4 rounded">
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
              <div className="flex">
                <dt className="text-gray-600 w-1/2">Strategy:</dt>
                <dd className="font-medium w-1/2">{strategy.name}</dd>
              </div>
              <div className="flex">
                <dt className="text-gray-600 w-1/2">Symbol:</dt>
                <dd className="font-medium w-1/2">{symbol}</dd>
              </div>
              <div className="flex">
                <dt className="text-gray-600 w-1/2">Status:</dt>
                <dd className="font-medium w-1/2">{tradeResult.status}</dd>
              </div>
              <div className="flex">
                <dt className="text-gray-600 w-1/2">Date:</dt>
                <dd className="font-medium w-1/2">{new Date(tradeResult.created_at).toLocaleString()}</dd>
              </div>
            </dl>
          </div>
        </div>
        
        <div className="mb-6">
          <h4 className="font-medium mb-2">Legs</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Strike</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Option Type</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tradeResult.legs.map((leg, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 text-sm text-gray-900">{leg.type}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{leg.action}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{leg.quantity}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{leg.strike || 'N/A'}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{leg.option_type || 'N/A'}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatPrice(leg.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded mr-2"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold">{strategy.name} Builder</h3>
        <button 
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          &times;
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Left Column: Symbol & Expiration */}
        <div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Symbol</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={symbol}
                onChange={(e) => {
                  const newSymbol = e.target.value.toUpperCase();
                  if (onSymbolChange) onSymbolChange(newSymbol);
                }}
                className="border rounded p-2 w-full"
              />
              <button
                onClick={fetchOptionsData}
                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                ↻
              </button>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Expiration</label>
            <select
              value={selectedExpiration}
              onChange={(e) => setSelectedExpiration(e.target.value)}
              className="border rounded p-2 w-full"
            >
              {expirations.map(exp => (
                <option key={exp} value={exp}>{exp}</option>
              ))}
            </select>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Price</label>
            <div className="text-xl font-bold">{formatPrice(currentPrice)}</div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Add Leg</label>
            <div className="flex gap-2">
              <button
                onClick={() => handleAddLeg("option")}
                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                Add Option
              </button>
              <button
                onClick={() => handleAddLeg("stock")}
                className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
              >
                Add Stock
              </button>
            </div>
          </div>
        </div>
        
        {/* Middle Column: Legs Configuration */}
        <div className="col-span-2">
          <h4 className="font-medium mb-2">Strategy Legs</h4>
          
          {legs.length === 0 ? (
            <div className="bg-gray-50 p-4 text-center text-gray-500 rounded">
              Add legs to your strategy
            </div>
          ) : (
            <div className="space-y-4">
              {legs.map(leg => (
                <div key={leg.id} className="bg-gray-50 p-4 rounded">
                  <div className="flex justify-between items-center mb-2">
                    <h5 className="font-medium">{leg.isStock ? 'Stock' : 'Option'} Leg</h5>
                    <button
                      onClick={() => handleRemoveLeg(leg.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                      <select
                        value={leg.action}
                        onChange={(e) => handleLegChange(leg.id, 'action', e.target.value)}
                        className="border rounded p-2 w-full"
                      >
                        <option value="buy">Buy</option>
                        <option value="sell">Sell</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={leg.quantity}
                        onChange={(e) => handleLegChange(leg.id, 'quantity', parseInt(e.target.value))}
                        className="border rounded p-2 w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={leg.price}
                        onChange={(e) => handleLegChange(leg.id, 'price', parseFloat(e.target.value))}
                        className="border rounded p-2 w-full"
                      />
                    </div>
                    
                    {!leg.isStock && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Option Type</label>
                          <select
                            value={leg.option_type}
                            onChange={(e) => handleLegChange(leg.id, 'option_type', e.target.value)}
                            className="border rounded p-2 w-full"
                          >
                            <option value="call">Call</option>
                            <option value="put">Put</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Strike</label>
                          <select
                            value={leg.strike || ""}
                            onChange={(e) => handleLegChange(leg.id, 'strike', parseFloat(e.target.value))}
                            className="border rounded p-2 w-full"
                          >
                            <option value="">Select Strike</option>
                            {optionsChain?.options?.option
                              ?.filter(o => o.option_type === leg.option_type)
                              ?.map(o => o.strike)
                              ?.filter((v, i, a) => a.indexOf(v) === i) // Get unique strikes
                              ?.sort((a, b) => a - b)
                              ?.map(strike => (
                                <option key={strike} value={strike}>
                                  {strike} {strike < currentPrice ? '(ITM)' : strike > currentPrice ? '(OTM)' : '(ATM)'}
                                </option>
                              ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Market Price</label>
                          <div className="p-2 bg-gray-100 rounded text-center">
                            {leg.strike ? (
                              formatPrice(findOptionPrice(leg.option_type, leg.strike, leg.action) || 0)
                            ) : (
                              'Select strike'
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* P&L Chart */}
      {pnlData && (
        <div className="mt-8">
          <h4 className="font-medium mb-2">Profit/Loss at Expiration</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-500">Max Profit</p>
              <p className={`text-xl font-bold ${pnlData.max_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPrice(pnlData.max_profit)}
              </p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-500">Max Loss</p>
              <p className={`text-xl font-bold ${pnlData.max_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPrice(pnlData.max_loss)}
              </p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-500">Initial Cost</p>
              <p className="text-xl font-bold">
                {formatPrice(pnlData.initial_cost)}
              </p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-500">Breakeven Points</p>
              <p className="text-xl font-bold">
                {pnlData.breakeven_points.length > 0 
                  ? pnlData.breakeven_points.map(b => formatPrice(b)).join(', ')
                  : 'None'
                }
              </p>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded mb-6 h-80">
            <Line data={pnlChartData} options={pnlChartOptions} />
          </div>
        </div>
      )}
      
      <div className="mt-6 flex justify-end">
        <button
          onClick={onClose}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded mr-2"
        >
          Cancel
        </button>
        
        <button
          onClick={handleSubmitTrade}
          disabled={loading || legs.length === 0}
          className={`bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 ${
            loading || legs.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loading ? 'Processing...' : 'Submit Trade'}
        </button>
      </div>
    </div>
  );
};

// Backtesting Component
const Backtesting = () => {
  const [symbol, setSymbol] = useState("SPY");
  const [strategies, setStrategies] = useState([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState("");
  const [startDate, setStartDate] = useState(subMonths(new Date(), 3));
  const [endDate, setEndDate] = useState(new Date());
  const [initialCapital, setInitialCapital] = useState(10000);
  const [backtestResults, setBacktestResults] = useState(null);
  const [backtestHistory, setBacktestHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchStrategies = async () => {
    try {
      const response = await axios.get(`${API}/strategies`);
      setStrategies(response.data);
      
      // Select the first strategy by default
      if (response.data.length > 0 && !selectedStrategyId) {
        setSelectedStrategyId(response.data[0].id);
      }
    } catch (error) {
      console.error("Error fetching strategies:", error);
    }
  };
  
  const fetchBacktestHistory = async () => {
    try {
      setHistoryLoading(true);
      const response = await axios.get(`${API}/backtest/results`);
      setBacktestHistory(response.data);
    } catch (error) {
      console.error("Error fetching backtest history:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategies();
    fetchBacktestHistory();
  }, []);

  const runBacktest = async () => {
    try {
      setLoading(true);
      
      const formattedStartDate = format(startDate, 'yyyy-MM-dd');
      const formattedEndDate = format(endDate, 'yyyy-MM-dd');
      
      const response = await axios.post(
        `${API}/backtest/${selectedStrategyId}?symbol=${symbol}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&initial_capital=${initialCapital}`
      );
      
      setBacktestResults(response.data);
      
      // Refresh backtest history
      fetchBacktestHistory();
    } catch (error) {
      console.error("Error running backtest:", error);
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data for backtest results
  const chartData = backtestResults ? {
    labels: backtestResults.price_history.map(point => point.date),
    datasets: [
      {
        label: `${symbol} Price`,
        data: backtestResults.price_history.map(point => point.price),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        yAxisID: 'y',
      },
      {
        label: 'Portfolio Value',
        data: backtestResults.trade_history.map(trade => ({
          x: trade.date,
          y: trade.capital
        })),
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        yAxisID: 'y1',
      }
    ],
  } : null;
  
  const chartOptions = {
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    stacked: false,
    plugins: {
      title: {
        display: true,
        text: 'Backtest Results',
      },
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: `${symbol} Price`
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        grid: {
          drawOnChartArea: false,
        },
        title: {
          display: true,
          text: 'Portfolio Value'
        }
      },
    },
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Backtest Trading Strategies</h2>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-medium mb-4">Backtest Configuration</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Symbol
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="w-full border rounded p-2"
              placeholder="e.g., SPY"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Strategy
            </label>
            <select
              value={selectedStrategyId}
              onChange={(e) => setSelectedStrategyId(e.target.value)}
              className="w-full border rounded p-2"
            >
              <option value="">Select a strategy...</option>
              {strategies.map(strategy => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <DatePicker
              selected={startDate}
              onChange={date => setStartDate(date)}
              className="w-full border rounded p-2"
              maxDate={subDays(endDate, 1)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <DatePicker
              selected={endDate}
              onChange={date => setEndDate(date)}
              className="w-full border rounded p-2"
              minDate={addDays(startDate, 1)}
              maxDate={new Date()}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Initial Capital
            </label>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(parseFloat(e.target.value))}
              className="w-full border rounded p-2"
              min="1000"
              step="1000"
            />
          </div>
        </div>
        
        <button
          onClick={runBacktest}
          disabled={loading || !selectedStrategyId}
          className={`w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 ${
            loading || !selectedStrategyId ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loading ? 'Running...' : 'Run Backtest'}
        </button>
      </div>
      
      {backtestResults && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-xl font-bold mb-4">Backtest Results: {backtestResults.strategy_name}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-500">Initial Capital</p>
              <p className="text-xl font-bold">${backtestResults.initial_capital.toLocaleString()}</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-500">Final Capital</p>
              <p className="text-xl font-bold">${backtestResults.final_capital.toLocaleString()}</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-500">Total Return</p>
              <p className={`text-xl font-bold ${backtestResults.metrics.total_return_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {backtestResults.metrics.total_return_pct.toFixed(2)}%
              </p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-500">Sharpe Ratio</p>
              <p className={`text-xl font-bold ${backtestResults.metrics.sharpe_ratio >= 1 ? 'text-green-600' : backtestResults.metrics.sharpe_ratio >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                {backtestResults.metrics.sharpe_ratio.toFixed(2)}
              </p>
            </div>
          </div>
          
          <div className="mb-6">
            <h4 className="font-medium mb-2">Performance Chart</h4>
            <div className="h-96">
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Trade History</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Capital</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {backtestResults.trade_history.map((trade, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2 text-sm text-gray-900">{trade.date}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{trade.action}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {trade.price ? `$${trade.price.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">
                        ${trade.capital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {/* Backtest History */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium mb-4">Backtest History</h3>
        
        {historyLoading ? (
          <div className="flex justify-center my-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-700"></div>
          </div>
        ) : backtestHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Strategy</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {backtestHistory.map((result, index) => (
                  <tr 
                    key={result.id} 
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} cursor-pointer hover:bg-gray-100`}
                    onClick={() => setBacktestResults(result)}
                  >
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {new Date(result.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">{result.symbol}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{result.strategy_name}</td>
                    <td className={`px-4 py-2 text-sm font-medium text-right ${
                      result.metrics.total_return_pct >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {result.metrics.total_return_pct.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No backtest history available</p>
        )}
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const [activeTab, setActiveTab] = useState("dashboard");

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard />;
      case "options-chain":
        return <OptionsChain />;
      case "gex-dex":
        return <GexDexAnalysis />;
      case "strategies":
        return <Strategies />;
      case "backtesting":
        return <Backtesting />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="App bg-gray-100 min-h-screen">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="ml-64 p-6">
        {renderTabContent()}
      </div>
    </div>
  );
}

export default App;
