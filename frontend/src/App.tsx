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
    temperature: 28,
    humidity: 65,
    condition: 'Sunny'
  });
  const [plantType, setPlantType] = useState('Tomato');
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isWatering, setIsWatering] = useState(false);
  const [history, setHistory] = useState<number[]>([]);

 useEffect(() => {
    // 1. Define the fetch function
    const fetchSensorData = async () => {
  try {
    // 1. Fetch from ESP32
    // Note: Ensure your ESP32 code handles CORS (Access-Control-Allow-Origin)
    const response = await fetch('http://192.168.0.105/data'); 
    
    // 2. Check for HTTP errors (like 404 Not Found or 500 Server Error)
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    // 3. Parse JSON
    const data = await response.json(); 
    console.log("Received from ESP32:", data);

    // 4. FIX: Validate data before using it
    // If 'raw' or 'moisture' are missing, default to 0 to prevent crashes
    const rawVal = data.raw !== undefined ? data.raw : 0;
    const moistureVal = data.moisture !== undefined ? data.moisture : 0;

    // 5. Update State
    setSensorData({
      raw: rawVal,
      moisture: moistureVal,
      // If moisture is 0 (missing), we might default to 'dry', or handle a specific 'error' status
      status: moistureVal < 30 ? 'dry' : 'wet',
      timestamp: Date.now()
    });

    setHistory(prev => [...prev.slice(-20), moistureVal]);

  } catch (error) {
    console.error("Failed to fetch sensor data:", error);
    // Optional: You could update state here to show an "Offline" badge
    // setSensorData(prev => ({ ...prev, status: 'offline' }));
  }
};

    // 2. Call immediately on mount, then set interval
    fetchSensorData();
    const interval = setInterval(fetchSensorData, 3000);

    return () => clearInterval(interval);
  }, []);
  // Trigger ESP beep when moisture is low
  useEffect(() => {
    if (sensorData.moisture < 30 && sensorData.status === 'dry') {
      // Send beep command to ESP32
      fetch('http://your-esp32-ip/beep', { method: 'POST' })
        .catch(err => console.log('ESP beep error:', err));
    }
  }, [sensorData.moisture, sensorData.status]);

  const handleWatering = async () => {
    setIsWatering(true);
    try {
      // Send watering command to ESP32
      await fetch('http://your-esp32-ip/water', { method: 'POST' });
      setTimeout(() => setIsWatering(false), 3000);
    } catch (error) {
      console.error('Watering error:', error);
      setIsWatering(false);
    }
  };

  const getAISuggestion = async () => {
    setIsLoadingAI(true);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `I'm growing ${plantType}. Current sensor readings:
- Raw sensor value: ${sensorData.raw}
- Moisture level: ${sensorData.moisture}%
- Status: ${sensorData.status}
- Weather: ${weather.temperature}°C, ${weather.humidity}% humidity, ${weather.condition}

Please provide brief, actionable advice on:
1. Should I water the plant now?
2. Any immediate concerns?
3. Quick care tip for today's conditions

Keep it under 100 words.`
          }]
        })
      });

      const data = await response.json();
      const suggestion = data.content.find((item: any) => item.type === 'text')?.text || 'Unable to get suggestion';
      setAiSuggestion(suggestion);
    } catch (error) {
      setAiSuggestion('Error connecting to AI. Check your API setup.');
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

        {/* Alert Banner */}
        {sensorData.moisture < 30 && (
          <div className={`bg-red-100 border-2 border-red-400 rounded-xl p-4 flex items-center gap-3 ${status.pulse ? 'animate-pulse' : ''}`}>
            <AlertCircle className="w-6 h-6 text-red-600" />
            <span className="font-semibold text-red-800">Low moisture detected! ESP32 beeping. Water your plant immediately.</span>
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
                  style={{ width: `${sensorData.moisture}%` }}
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
                <span className="text-2xl font-bold text-gray-800">{weather.temperature}°C</span>
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
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
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
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
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
                  style={{ height: `${value}%` }}
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
          <p>💡 <strong>Setup:</strong> Replace API endpoints with your ESP32 IP address</p>
          <p className="mt-1">Sensor: <code className="bg-white px-2 py-1 rounded">http://your-esp32-ip/sensor</code></p>
          <p className="mt-1">Water: <code className="bg-white px-2 py-1 rounded">http://your-esp32-ip/water</code></p>
          <p className="mt-1">Beep: <code className="bg-white px-2 py-1 rounded">http://your-esp32-ip/beep</code></p>
        </div>
      </div>
    </div>
  );
}
