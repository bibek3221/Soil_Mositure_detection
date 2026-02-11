import React, { useState, useEffect } from 'react';
import { Droplets, Thermometer, Cloud, Sprout, AlertCircle, Loader2 } from 'lucide-react';
interface SensorData {
  raw: number;
  moisture: number;
  status: 'wet' | 'dry';
  timestamp: number;
}

interface WeatherData {
  temperature: number;
  humidity: number;
  condition: string;
}

export default function PlantMonitor() {
  const [sensorData, setSensorData] = useState<SensorData>({
    raw: 0,
    moisture: 0,
    status: 'dry',
    timestamp: Date.now()
  });
  const [weather, setWeather] = useState<WeatherData>({
    temperature: 25, // Fixed: default value
    humidity: 65,
    condition: 'Sunny'
  });
  const [plantType, setPlantType] = useState('Tomato');
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isWatering, setIsWatering] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  const [data, setData] = useState({});
  const [buzzerStatus, setBuzzerStatus] = useState('OFF');

  // Fetch sensor data
  useEffect(() => {
    const fetchSensorData = async () => {
      try {
        const response = await fetch('http://192.168.0.105/data'); 
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data1 = await response.json(); 
        setData(data1);
        console.log("Received from ESP32:", data);

        // Extract data from the correct structure
        const soilData = data1.soil || {};
        const weatherData = data1.weather || {};
        const buzzerData = data1.buzzer || {};

        // Update sensor data
        setSensorData({
          raw: soilData.raw !== undefined ? soilData.raw : 0,
          moisture: soilData.moisture !== undefined ? soilData.moisture : 0,
          status: soilData.status === 'LOW' ? 'dry' : 'wet',
          timestamp: Date.now()
        });

        // Update weather data
        setWeather({
          temperature: weatherData.temp_c !== undefined ? weatherData.temp_c : 25,
          humidity: weatherData.humidity !== undefined ? weatherData.humidity : 65,
          condition: getWeatherCondition(weatherData)
        });

        // Update buzzer status
        setBuzzerStatus(buzzerData.state || 'OFF');

        // Update history
        const moistureVal = soilData.moisture !== undefined ? soilData.moisture : 0;
        setHistory(prev => [...prev.slice(-20), moistureVal]);

      } catch (error) {
        console.error("Failed to fetch sensor data:", error);
      }
    };

    fetchSensorData();
    const interval = setInterval(fetchSensorData, 3000);

    return () => clearInterval(interval);
  }, []);

  // Helper function for weather condition
  const getWeatherCondition = (weatherData) => {
    if (!weatherData) return 'Sunny';
    
    if (weatherData.humidity > 80) return 'Humid';
    if (weatherData.temp_c > 30) return 'Hot';
    if (weatherData.temp_c < 15) return 'Cool';
    return 'Sunny';
  };

  // Trigger ESP beep when moisture is low
  useEffect(() => {
    if (sensorData.moisture < 30 && sensorData.status === 'dry') {
      // Use the toggle endpoint to start beeping
      fetch('http://192.168.0.105/buzzer/start', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      .then(() => setBuzzerStatus('ON'))
      .catch(err => console.log('ESP beep error:', err));
    } else if (sensorData.moisture >= 30 && buzzerStatus === 'ON') {
      // Stop beeping when moisture is adequate
      fetch('http://192.168.0.105/buzzer/stop', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      .then(() => setBuzzerStatus('OFF'))
      .catch(err => console.log('ESP stop beep error:', err));
    }
  }, [sensorData.moisture, sensorData.status]);

  const handleWatering = async () => {
    setIsWatering(true);
    try {
      // Note: You don't have a /water endpoint in your list
      // You might need to create one or use /soil endpoint
      console.log('Watering not implemented - add /water endpoint to ESP32');
      // await fetch('http://192.168.0.105/water', { method: 'POST' });
      
      // For now, we'll use soil endpoint as an example
      // Or you can add your own watering logic
      
      setTimeout(() => setIsWatering(false), 3000);
    } catch (error) {
      console.error('Watering error:', error);
      setIsWatering(false);
    }
  };

  // Manual buzzer control functions
  const startBeep = async () => {
    try {
      await fetch('http://192.168.0.105/buzzer/start', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      setBuzzerStatus('ON');
    } catch (error) {
      console.error('Start beep error:', error);
    }
  };

  const stopBeep = async () => {
    try {
      await fetch('http://192.168.0.105/buzzer/stop', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      setBuzzerStatus('OFF');
    } catch (error) {
      console.error('Stop beep error:', error);
    }
  };

  const toggleBeep = async () => {
    try {
      await fetch('http://192.168.0.105/buzzer/toggle', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      setBuzzerStatus(prev => prev === 'ON' ? 'OFF' : 'ON');
    } catch (error) {
      console.error('Toggle beep error:', error);
    }
  };

  const getAISuggestion = async () => {
  setIsLoadingAI(true);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_APIKEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `
You are an agricultural assistant for a smart irrigation system.

Plant type: ${plantType}

📊 Sensor Data:
- Soil moisture percentage: ${soil.moisture}%
- Soil status: ${soil.status}
- Raw soil sensor value: ${soil.raw}

🌦 Weather Conditions:
- Location: ${weather.city}
- Temperature: ${weather.temp_c} °C
- Feels like: ${weather.feelslike_c} °C
- Humidity: ${weather.humidity} %
- Wind speed: ${weather.wind_kph} km/h
- Atmospheric pressure: ${weather.pressure_mb} mb
- Last weather update: ${weather.lastUpdate}

🔔 System Status:
- Buzzer state: ${buzzer.state}

Please answer briefly and clearly:
1. Should the plant be watered **right now**? (Yes/No + reason)
2. Any **immediate risk** to the plant?
3. One **quick actionable tip** for today’s conditions.
4. Should the buzzer alert be turned ON or remain OFF?

Keep the response under **100 words**.
`
                }
              ]
            }
          ]
        }),
      }
    );

    const data = await response.json();
    console.log("AI Response:", data);

    const suggestion =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Unable to get suggestion";

    setAiSuggestion(suggestion);
  } catch (error) {
    setAiSuggestion("Error connecting to AI. Check your API key or network.");
  }

  setIsLoadingAI(false);
};


  const getMoistureColor = (moisture: number) => {
    if (moisture < 30) return 'bg-red-500';
    if (moisture < 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getMoistureStatus = (moisture: number) => {
    if (moisture < 30) return { text: 'Critical - Water Now!', color: 'text-red-600', pulse: true };
    if (moisture < 60) return { text: 'Low - Consider Watering', color: 'text-yellow-600', pulse: false };
    return { text: 'Optimal', color: 'text-green-600', pulse: false };
  };

  const status = getMoistureStatus(sensorData.moisture);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sprout className="w-10 h-10 text-green-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Smart Plant Monitor</h1>
                <p className="text-gray-500">IoT-powered plant care</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`px-3 py-1 rounded-full ${buzzerStatus === 'ON' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                Buzzer: {buzzerStatus}
              </div>
              <select
                value={plantType}
                onChange={(e) => setPlantType(e.target.value)}
                className="px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-500"
              >
                <option>Tomato</option>
                <option>Basil</option>
                <option>Cactus</option>
                <option>Orchid</option>
                <option>Fern</option>
              </select>
            </div>
          </div>
        </div>

        {/* Alert Banner */}
        {sensorData.moisture < 30 && (
          <div className={`bg-red-100 border-2 border-red-400 rounded-xl p-4 flex items-center gap-3 ${status.pulse ? 'animate-pulse' : ''}`}>
            <AlertCircle className="w-6 h-6 text-red-600" />
            <span className="font-semibold text-red-800">Low moisture detected! {buzzerStatus === 'ON' ? 'Buzzer is ON' : 'Starting buzzer...'}</span>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {/* Moisture Card */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Droplets className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-800">Soil Moisture</h2>
            </div>
            
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-5xl font-bold text-gray-800">{sensorData.moisture}%</div>
                <div className={`text-sm font-semibold mt-2 ${status.color}`}>{status.text}</div>
              </div>

              {/* Moisture Bar */}
              <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                <div
                  className={`h-full ${getMoistureColor(sensorData.moisture)} transition-all duration-500`}
                  style={{ width: `${Math.min(sensorData.moisture, 100)}%` }}
                />
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <div>Raw Value: {sensorData.raw}</div>
                <div>Status: {sensorData.status.toUpperCase()}</div>
                <div>Updated: {new Date(sensorData.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>
          </div>

          {/* Weather Card */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Cloud className="w-6 h-6 text-sky-600" />
              <h2 className="text-xl font-bold text-gray-800">Weather</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Thermometer className="w-5 h-5 text-red-500" />
                  <span className="text-gray-600">Temperature</span>
                </div>
                <span className="text-2xl font-bold text-gray-800">{weather.temperature.toFixed(1)}°C</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-blue-500" />
                  <span className="text-gray-600">Humidity</span>
                </div>
                <span className="text-2xl font-bold text-gray-800">{weather.humidity}%</span>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-700">{weather.condition}</div>
                  <div className="text-sm text-gray-500">Current conditions</div>
                </div>
              </div>
            </div>
          </div>

          {/* Control Card */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Sprout className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-bold text-gray-800">Controls</h2>
            </div>
            
            <div className="space-y-4">
              <button
                onClick={handleWatering}
                disabled={isWatering}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                {isWatering ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Watering...
                  </>
                ) : (
                  <>
                    <Droplets className="w-5 h-5" />
                    Water Plant
                  </>
                )}
              </button>

              <button
                onClick={getAISuggestion}
                disabled={isLoadingAI}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                {isLoadingAI ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Thinking...
                  </>
                ) : (
                  <>
                    <span className="text-xl">🤖</span>
                    Get AI Advice
                  </>
                )}
              </button>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <button
                  onClick={startBeep}
                  className="bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Start Beep
                </button>
                <button
                  onClick={stopBeep}
                  className="bg-green-100 hover:bg-green-200 text-green-700 font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Stop Beep
                </button>
                <button
                  onClick={toggleBeep}
                  className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Toggle Beep
                </button>
              </div>

              <div className="text-xs text-gray-500 text-center pt-2">
                Plant Type: <span className="font-semibold">{plantType}</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Suggestion Panel */}
        {aiSuggestion && (
          <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl shadow-lg p-6 border-2 border-purple-300">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🤖</span>
              <h2 className="text-xl font-bold text-gray-800">AI Plant Care Assistant</h2>
            </div>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{aiSuggestion}</p>
          </div>
        )}

        {/* Moisture History Chart */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Moisture History</h2>
          <div className="flex items-end justify-between h-32 gap-1">
            {history.map((value, index) => (
              <div key={index} className="flex-1 flex flex-col justify-end">
                <div
                  className={`${getMoistureColor(value)} rounded-t transition-all duration-300`}
                  style={{ height: `${Math.min(value, 100)}%` }}
                  title={`${value}%`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>Past</span>
            <span>Recent</span>
          </div>
        </div>

        {/* ESP32 Connection Info */}
        <div className="bg-gray-100 rounded-xl p-4 text-center text-sm text-gray-600">
          <p>💡 <strong>Connected to ESP32 at:</strong> 192.168.0.105</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
            <div className="bg-white px-2 py-1 rounded"><code>/data</code> ✓</div>
            <div className="bg-white px-2 py-1 rounded"><code>/buzzer/start</code> ✓</div>
            <div className="bg-white px-2 py-1 rounded"><code>/buzzer/stop</code> ✓</div>
            <div className="bg-white px-2 py-1 rounded"><code>/buzzer/toggle</code> ✓</div>
          </div>
          <p className="mt-2">Buzzer Status: <span className={`font-bold ${buzzerStatus === 'ON' ? 'text-red-600' : 'text-green-600'}`}>{buzzerStatus}</span></p>
        </div>
      </div>
    </div>
  );
}