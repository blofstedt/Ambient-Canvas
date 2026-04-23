import React, { useState, useEffect, useRef } from 'react';
import { Activity, Eye, EyeOff, Image as ImageIcon, ChevronLeft, ChevronRight, Settings, Clock, Cloud, FolderOpen, Power, MonitorPlay, LayoutTemplate, Sun, CloudRain, CloudFog, CloudSnow, CloudLightning, CheckCircle2, UserCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Art Collection
const ARTWORK = [
  { id: 1, title: "The Starry Night", artist: "Vincent van Gogh", url: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&q=80&w=1920" },
  { id: 2, title: "Impression, Sunrise", artist: "Claude Monet", url: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&q=80&w=1920" },
  { id: 3, title: "The Great Wave", artist: "Hokusai", url: "https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&q=80&w=1920" },
  { id: 4, title: "Wanderer above the Sea of Fog", artist: "Caspar David Friedrich", url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1920" },
  { id: 5, title: "View of Delft", artist: "Johannes Vermeer", url: "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&q=80&w=1920" }
];

interface RoomProfile {
  luminance: number;
  warmth: number;
}

export default function App() {
  // Telemetry & Discovery
  const [telemetry, setTelemetry] = useState({ lux: 15, temp: 2800, motion: true });
  const [arduinoIp, setArduinoIp] = useState(() => localStorage.getItem('arduino_ip') || 'ambient-sensor.local');
  const [isScanning, setIsScanning] = useState(true);
  const [discoveryState, setDiscoveryState] = useState<'searching' | 'connected' | 'lost'>('searching');
  
  // Gallery State
  const [artIndex, setArtIndex] = useState(0);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [isScreenBlack, setIsScreenBlack] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [isStatic, setIsStatic] = useState(false);
  const [rotationInterval, setRotationInterval] = useState(10); // in minutes

  // Power & Motion Settings
  const [powerSafeAction, setPowerSafeAction] = useState<'black' | 'off'>('black');
  const [powerSafeMinutes, setPowerSafeMinutes] = useState(2);
  const [motionSensitivity, setMotionSensitivity] = useState(3); // Consecutive samples needed
  const motionHistoryRef = useRef<boolean[]>([]);

  // UI Overlays & Sources
  const [activeTab, setActiveTab] = useState<'display' | 'source' | 'system'>('display');
  const [showClock, setShowClock] = useState(true);
  const [showWeather, setShowWeather] = useState(true);
  const [weatherLocation, setWeatherLocation] = useState('San Francisco, CA');
  const [weatherTemp, setWeatherTemp] = useState<number | null>(null);
  const [weatherCode, setWeatherCode] = useState<number>(0);
  const [imageSource, setImageSource] = useState<'curated' | 'local' | 'gphotos'>('curated');
  
  // Custom Media Sources
  const [localFiles, setLocalFiles] = useState<string[]>([]);
  const [gPhotosConnected, setGPhotosConnected] = useState(false);
  const [gPhotosSelectedAlbum, setGPhotosSelectedAlbum] = useState<string | null>(null);

  const [time, setTime] = useState(new Date());

  // Weather Fetching Logic (Open-Meteo)
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        if (!weatherLocation) return;
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(weatherLocation)}&count=1`);
        const geoData = await geoRes.json();
        if (geoData.results && geoData.results.length > 0) {
          const { latitude, longitude } = geoData.results[0];
          const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&temperature_unit=celsius`);
          const data = await weatherRes.json();
          setWeatherTemp(Math.round(data.current_weather.temperature));
          setWeatherCode(data.current_weather.weathercode);
        }
      } catch (e) {
        console.error("Weather fetch error", e);
      }
    };
    if (showWeather) fetchWeather();
    const interval = setInterval(fetchWeather, 15 * 60 * 1000); // refresh every 15 min
    return () => clearInterval(interval);
  }, [weatherLocation, showWeather]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const motionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const uiTimerRef = useRef<NodeJS.Timeout | null>(null);
  const menuTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Appearance Settings
  const [grainIntensity, setGrainIntensity] = useState(45);
  const [luminance, setLuminance] = useState(60);
  const [warmth, setWarmth] = useState(200);

  // GPhotos Mock Data
  const MOCK_GPHOTOS_ALBUMS = [
    { id: '1', name: 'Favorites', count: 42, cover: 'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?auto=format&fit=crop&q=80&w=400' },
    { id: '2', name: 'Vacations 2024', count: 18, cover: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&q=80&w=400' },
    { id: '3', name: 'Landscapes', count: 124, cover: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=400' }
  ];

  const MOCK_GPHOTOS_PICS = [
    "https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?auto=format&fit=crop&q=80&w=1920",
    "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&q=80&w=1920"
  ];

  const getWeatherIcon = (code: number) => {
    if (code === 0) return <Sun className="w-10 h-10 opacity-90 text-[#D4CDA4]" />;
    if (code < 4) return <Cloud className="w-10 h-10 opacity-90 text-[#D4CDA4]" />;
    if (code < 50) return <CloudFog className="w-10 h-10 opacity-90 text-[#D4CDA4]" />;
    if (code < 70 || (code >= 80 && code <= 82)) return <CloudRain className="w-10 h-10 opacity-90 text-[#D4CDA4]" />;
    if (code < 80 || code >= 85) return <CloudSnow className="w-10 h-10 opacity-90 text-[#D4CDA4]" />;
    return <CloudLightning className="w-10 h-10 opacity-90 text-[#D4CDA4]" />;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    const urls = files.map(f => URL.createObjectURL(f));
    if (urls.length > 0) {
      setLocalFiles(urls);
      setImageSource('local');
      setArtIndex(0);
      resetMenuTimer();
    }
  };

  // Load user-defined profiles from storage
  const [profiles, setProfiles] = useState<Record<string, RoomProfile>>(() => {
    try {
      const saved = localStorage.getItem('canvas_profiles');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  // Bucketing (±10 Lux, ±250K)
  const luxBucket = Math.floor(telemetry.lux / 20) * 20;
  const tempBucket = Math.floor(telemetry.temp / 500) * 500;
  const currentBucketKey = `${luxBucket}_${tempBucket}`;

  // Innate Default Profiles for unconfigured buckets
  const getInnateProfile = (lux: number, k: number): RoomProfile => {
    let lum = 60;
    let w = 200;

    if (lux < 5) { lum = 25; w = 450; } 
    else if (lux < 20) { lum = 40; w = 350; } 
    else if (lux > 150) { lum = 90; w = 50; } 

    if (k < 2500) w += 100;
    if (k > 4000) w -= 100;

    return { 
      luminance: Math.min(100, Math.max(0, lum)), 
      warmth: Math.min(500, Math.max(-500, w)) 
    };
  };

  // 1. discovery & Heartbeat
  useEffect(() => {
    let retryCount = 0;
    const strategies = [
      `http://${arduinoIp}`,            // User preference / Last known
      'http://ambient-sensor.local',    // Product standard mDNS
      'http://10.0.0.60'                // Specific dev fallback
    ];

    const fetchTelemetry = async () => {
      // Rotate strategy if we are searching and failing
      const target = isScanning ? strategies[retryCount % strategies.length] : `http://${arduinoIp}`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(target, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          setTelemetry(data);
          
          if (isScanning) {
            // First time finding it! Lock it in.
            const successfulIp = new URL(target).hostname;
            setArduinoIp(successfulIp);
            localStorage.setItem('arduino_ip', successfulIp);
            setIsScanning(false);
            setDiscoveryState('connected');
          }
        }
      } catch (e) {
        if (!isScanning) {
          setDiscoveryState('lost');
          setIsScanning(true); // Restart search
        }
        retryCount++;
      }
    };

    const interval = setInterval(fetchTelemetry, isScanning ? 2000 : 4000);
    return () => clearInterval(interval);
  }, [arduinoIp, isScanning]);

  // 2. Automate Rotation based on settings
  useEffect(() => {
    if (isStatic) return;
    
    const rotation = setInterval(() => {
      if (!showSettingsMenu) setArtIndex(prev => (prev + 1) % ARTWORK.length);
    }, rotationInterval * 60000);
    return () => clearInterval(rotation);
  }, [showSettingsMenu, isStatic, rotationInterval]);

  // 3. Occupancy Logic with Sensitivity Threshold
  useEffect(() => {
    // Maintain a history of samples to filter out noise
    motionHistoryRef.current = [...motionHistoryRef.current.slice(-(motionSensitivity - 1)), telemetry.motion];
    
    // Determine the "True" motion state based on consecutive samples
    const hasSustainedMotion = motionHistoryRef.current.length >= motionSensitivity && 
                               motionHistoryRef.current.every(m => m === true);

    if (hasSustainedMotion) {
      setIsScreenBlack(false);
      if (motionTimerRef.current) clearTimeout(motionTimerRef.current);
    } else {
      // Only start timer if movement is definitely lost (all samples false)
      const hasLostMotion = motionHistoryRef.current.every(m => m === false);
      if (hasLostMotion && !isScreenBlack && !motionTimerRef.current) {
        motionTimerRef.current = setTimeout(() => {
          setIsScreenBlack(true);
          motionTimerRef.current = null;
        }, powerSafeMinutes * 60000); 
      }
    }
  }, [telemetry.motion, isScreenBlack, motionSensitivity, powerSafeMinutes]);

  // 4. Persistence / Dynamic Mapping
  useEffect(() => {
    const userProfile = profiles[currentBucketKey];
    if (userProfile) {
      setLuminance(userProfile.luminance);
      setWarmth(userProfile.warmth);
    } else {
      // Automatic mapping from ambient sensors if no user preference set
      const innate = getInnateProfile(telemetry.lux, telemetry.temp);
      setLuminance(innate.luminance);
      setWarmth(innate.warmth);
    }
  }, [currentBucketKey, profiles, telemetry.lux, telemetry.temp]);

  const saveProfile = (newLum: number, newWarmth: number) => {
    const updated = {
      ...profiles,
      [currentBucketKey]: { luminance: newLum, warmth: newWarmth }
    };
    setProfiles(updated);
    localStorage.setItem('canvas_profiles', JSON.stringify(updated));
    resetMenuTimer();
  };

  // UI Auto-Fade Logic
  const resetUiTimer = () => {
    setUiVisible(true);
    if (uiTimerRef.current) clearTimeout(uiTimerRef.current);
    uiTimerRef.current = setTimeout(() => {
      setUiVisible(false);
    }, 5000);
  };

  const resetMenuTimer = () => {
    if (showSettingsMenu) {
      if (menuTimerRef.current) clearTimeout(menuTimerRef.current);
      menuTimerRef.current = setTimeout(() => {
        setShowSettingsMenu(false);
      }, 10000);
    }
  };

  useEffect(() => {
    const handleActivity = (e?: KeyboardEvent) => {
      resetUiTimer();
      if (showSettingsMenu) resetMenuTimer();
      
      // Handle navigation keys
      if (e?.key === 'ArrowLeft') {
        setArtIndex(prev => (prev - 1 + ARTWORK.length) % ARTWORK.length);
      } else if (e?.key === 'ArrowRight') {
        setArtIndex(prev => (prev + 1) % ARTWORK.length);
      }
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity as any);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    resetUiTimer();

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [showSettingsMenu]);

  useEffect(() => {
    if (showSettingsMenu) {
      resetMenuTimer();
    } else {
      if (menuTimerRef.current) clearTimeout(menuTimerRef.current);
    }
  }, [showSettingsMenu]);

  // Filter Computation & Media Source Resolution
  let currentArt = ARTWORK[artIndex % ARTWORK.length];
  
  if (imageSource === 'local' && localFiles.length > 0) {
    currentArt = {
      id: 999,
      title: "Local Media",
      artist: `Folder Item ${artIndex % localFiles.length + 1}`,
      url: localFiles[artIndex % localFiles.length]
    };
  } else if (imageSource === 'gphotos' && gPhotosSelectedAlbum) {
    // Note: MOCK_GPHOTOS_PICS simulates the actual URLs we'd fetch via API
    currentArt = {
      id: 888,
      title: "Google Photos",
      artist: MOCK_GPHOTOS_ALBUMS.find(a => a.id === gPhotosSelectedAlbum)?.name || "Album",
      url: MOCK_GPHOTOS_PICS[artIndex % MOCK_GPHOTOS_PICS.length]
    };
  }

  const overlayOpacity = luminance / 100;
  const warmColor = `rgba(255, ${200 + (warmth/500)*55}, ${150 - (warmth/500)*100}, 0.25)`;

  return (
    <div className="w-full h-screen bg-black overflow-hidden flex flex-col font-sans text-[#EAE6DA] relative select-none">
      
      {/* 
        ART STAGE
      */}
      <AnimatePresence>
        <motion.div
          key={currentArt.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.5, ease: "easeInOut" }}
          className="absolute inset-0 z-0"
        >
          <div 
            className="absolute inset-0 bg-center bg-cover transition-[filter] duration-1000"
            style={{ 
              backgroundImage: `url(${currentArt.url})`,
              filter: `brightness(${0.3 + overlayOpacity * 0.7}) contrast(1.1) sepia(0.2)` 
            }}
          >
            {/* Organic Color Warmth Tint */}
            <div 
              className="absolute inset-0 mix-blend-multiply transition-colors duration-1000"
              style={{ backgroundColor: warmColor, opacity: Math.abs(warmth) / 500 }}
            />

            {/* Canvas Texture Overlay */}
            <div 
              className="absolute inset-0 mix-blend-overlay opacity-30 pointer-events-none"
              style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/natural-paper.png')" }}
            />

            {/* Film Grain */}
            <div 
              className="absolute inset-0 mix-blend-soft-light pointer-events-none transition-opacity duration-500"
              style={{ 
                backgroundImage: "url('https://www.transparenttextures.com/patterns/stardust.png')",
                opacity: grainIntensity / 100 * 0.8
              }}
            />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* OLED Shield / Blackout */}
      <div 
        className={`absolute inset-0 z-40 bg-black transition-opacity duration-[3000ms] pointer-events-none ${isScreenBlack ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Edge Vignette */}
      <div className="absolute inset-0 z-10 pointer-events-none shadow-[inset_0_0_300px_rgba(0,0,0,0.8)]" />

      {/* AMBIENT OVERLAYS (Always visible unless screen is black) */}
      <div className={`absolute top-0 left-0 w-full p-14 flex justify-between items-start z-30 transition-opacity duration-1000 pointer-events-none ${isScreenBlack ? 'opacity-0' : 'opacity-100'}`}>
        {/* Clock */}
        <div className={`transition-opacity duration-700 ${showClock ? 'opacity-100' : 'opacity-0'}`}>
          <div className="text-6xl font-serif tracking-tighter text-[#EAE6DA] drop-shadow-2xl">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div className="text-[10px] font-mono opacity-80 uppercase tracking-[0.3em] mt-3 drop-shadow-md text-[#A3B18A] font-bold">{time.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</div>
        </div>
        {/* Weather */}
        <div className={`transition-opacity duration-700 text-right ${showWeather ? 'opacity-100' : 'opacity-0'}`}>
          <div className="text-5xl font-serif tracking-tighter text-[#EAE6DA] drop-shadow-2xl flex items-center justify-end gap-4">
            {weatherTemp !== null ? `${weatherTemp}°C` : '--°C'}
            {getWeatherIcon(weatherCode)}
          </div>
          <div className="text-[10px] font-mono opacity-80 uppercase tracking-[0.3em] mt-3 drop-shadow-md text-[#A3B18A] font-bold">{weatherLocation}</div>
        </div>
      </div>

      {/* 
        SETTINGS OVERLAY
      */}
      <div 
        className={`absolute inset-0 z-50 p-12 flex flex-col transition-all duration-700 ${
          showSettingsMenu ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Top Header - Dynamic Artwork Title */}
        <div className="w-full flex justify-center">
        </div>

        {/* COMBINED BOTTOM DASHBOARD - Tabbed */}
        <div className="mt-auto w-full flex justify-center">
          <div className="w-full max-w-6xl bg-[#1A1D14]/50 border border-white/10 p-10 rounded-[2.5rem] shadow-2xl backdrop-blur-xl flex flex-col gap-8">
            
            {/* Navigation Tabs */}
            <div className="flex gap-4 border-b border-white/5 pb-6">
              <button onClick={() => { setActiveTab('display'); resetMenuTimer(); }} className={`px-8 py-4 rounded-xl text-[10px] uppercase tracking-[0.2em] font-bold transition-all flex items-center gap-3 ${activeTab === 'display' ? 'bg-[#D4CDA4] text-[#1A1D14] shadow-lg scale-105' : 'text-white/40 hover:bg-white/5'}`}><MonitorPlay className="w-4 h-4" /> Display & Layout</button>
              <button onClick={() => { setActiveTab('source'); resetMenuTimer(); }} className={`px-8 py-4 rounded-xl text-[10px] uppercase tracking-[0.2em] font-bold transition-all flex items-center gap-3 ${activeTab === 'source' ? 'bg-[#D4CDA4] text-[#1A1D14] shadow-lg scale-105' : 'text-white/40 hover:bg-white/5'}`}><FolderOpen className="w-4 h-4" /> Media Sources</button>
              <button onClick={() => { setActiveTab('system'); resetMenuTimer(); }} className={`px-8 py-4 rounded-xl text-[10px] uppercase tracking-[0.2em] font-bold transition-all flex items-center gap-3 ${activeTab === 'system' ? 'bg-[#D4CDA4] text-[#1A1D14] shadow-lg scale-105' : 'text-white/40 hover:bg-white/5'}`}><Power className="w-4 h-4" /> Power & Sensors</button>
            </div>

            {/* TAB 1: DISPLAY */}
            {activeTab === 'display' && (
              <div className="grid grid-cols-2 gap-16 animate-in fade-in zoom-in-95 duration-500">
                {/* Left Column */}
                <div className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.3em] text-white/30 font-bold">
                      <span>Brightness</span>
                      <span className="text-[#A3B18A] font-mono tracking-normal text-xs">{luminance}%</span>
                    </div>
                    <div className="relative h-2 flex items-center">
                      <input 
                        type="range" min={0} max={100} value={luminance} 
                        onChange={(e) => { const v = Number(e.target.value); setLuminance(v); saveProfile(v, warmth); resetMenuTimer(); }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="w-full h-1 bg-white/5 rounded-full" />
                      <div className="absolute h-1 bg-[#D4CDA4] shadow-[0_0_15px_rgba(212,205,164,0.3)]" style={{ width: `${luminance}%` }} />
                      <div className="absolute w-6 h-6 rounded-full bg-[#D4CDA4] border-[5px] border-[#1A1D14] shadow-xl" style={{ left: `calc(${luminance}% - 12px)` }} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.3em] text-white/30 font-bold">
                      <span>Color Temp</span>
                      <span className="text-[#A3B18A] font-mono tracking-normal text-xs">{warmth}K</span>
                    </div>
                    <div className="relative h-2 flex items-center">
                      <input 
                        type="range" min={-500} max={500} value={warmth} 
                        onChange={(e) => { const v = Number(e.target.value); setWarmth(v); saveProfile(luminance, v); resetMenuTimer(); }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="w-full h-1 bg-gradient-to-r from-blue-400/20 via-white/5 to-orange-400/20 rounded-full" />
                      <div className="absolute w-6 h-6 rounded-full bg-[#FFB380] border-[5px] border-[#1A1D14]" style={{ left: `calc(${50 + (warmth / 500) * 50}% - 12px)` }} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.3em] text-white/30 font-bold">
                      <span>Film Grain</span>
                      <span className="text-[#A3B18A] font-mono tracking-normal text-xs">{grainIntensity}%</span>
                    </div>
                    <div className="relative h-2 flex items-center">
                      <input 
                        type="range" min={0} max={100} value={grainIntensity} 
                        onChange={(e) => { setGrainIntensity(Number(e.target.value)); resetMenuTimer(); }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="w-full h-1 bg-white/5 rounded-full" />
                      <div className="absolute h-1 bg-[#A3B18A]" style={{ width: `${grainIntensity}%` }} />
                      <div className="absolute w-6 h-6 rounded-full bg-[#A3B18A] border-[5px] border-[#1A1D14] shadow-xl" style={{ left: `calc(${grainIntensity}% - 12px)` }} />
                    </div>
                  </div>
                </div>

                {/* Right Column: Toggles & Rotation */}
                <div className="space-y-8 flex flex-col justify-end">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Clock Toggle */}
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-5 flex flex-col gap-5">
                      <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.3em] text-white/50 font-bold">
                        <span>Clock Overlay</span>
                        <Clock className="w-4 h-4 text-[#D4CDA4]" />
                      </div>
                      <button onClick={() => { setShowClock(!showClock); resetMenuTimer(); }} className={`py-4 rounded-xl text-[10px] uppercase tracking-widest font-bold transition-all border shadow-lg ${showClock ? 'bg-[#D4CDA4] text-[#1A1D14] border-[#D4CDA4]' : 'border-white/10 text-white/40 hover:bg-white/5'}`}>
                        {showClock ? 'Status: Visible' : 'Status: Hidden'}
                      </button>
                    </div>
                    {/* Weather Toggle & Input */}
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                      <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.3em] text-white/50 font-bold">
                        <span>Weather</span>
                        <Cloud className="w-4 h-4 text-[#D4CDA4]" />
                      </div>
                      <input 
                        type="text"
                        value={weatherLocation}
                        onChange={(e) => { setWeatherLocation(e.target.value); resetMenuTimer(); }}
                        placeholder="City, State"
                        className="w-full bg-[#1A1D14]/80 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-mono outline-none text-white/50 focus:text-[#D4CDA4] focus:border-[#D4CDA4]/50 transition-all placeholder:text-white/20"
                      />
                      <button onClick={() => { setShowWeather(!showWeather); resetMenuTimer(); }} className={`py-3 rounded-xl text-[10px] uppercase tracking-widest font-bold transition-all border shadow-lg ${showWeather ? 'bg-[#D4CDA4] text-[#1A1D14] border-[#D4CDA4]' : 'border-white/10 text-white/40 hover:bg-white/5'}`}>
                        {showWeather ? 'Status: Visible' : 'Status: Hidden'}
                      </button>
                    </div>
                  </div>
                  
                  {/* Rotation settings */}
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-6 flex flex-col gap-6">
                    <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.3em] text-white/50 font-bold">
                      <span>Art Rotation</span>
                      <span className="text-[#A3B18A] font-mono tracking-normal text-xs">{isStatic ? 'STATIC' : `${rotationInterval} MIN`}</span>
                    </div>
                    <div className="flex items-center gap-6">
                      {!isStatic ? (
                        <input 
                          type="range" min={1} max={60} value={rotationInterval} 
                          onChange={(e) => { setRotationInterval(Number(e.target.value)); resetMenuTimer(); }}
                          className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#D4CDA4]"
                        />
                      ) : <div className="flex-1 h-1" />}
                      
                      <div className="flex gap-4">
                        <button 
                          onClick={() => { setIsStatic(!isStatic); resetMenuTimer(); }}
                          className={`px-6 py-3 rounded-xl text-[10px] uppercase tracking-widest font-bold border transition-all ${isStatic ? 'bg-[#D4CDA4] text-[#1A1D14] border-[#D4CDA4]' : 'bg-[#1A1D14] text-white/40 border-white/10'}`}
                        >
                          {isStatic ? 'Hold' : 'Cycle'}
                        </button>
                        <div className="flex gap-2">
                          <button onClick={() => { setArtIndex(prev => (prev - 1 + ARTWORK.length) % ARTWORK.length); resetMenuTimer(); }} className="p-3 bg-[#1A1D14] rounded-xl hover:bg-white/10 border border-white/5"><ChevronLeft className="w-4 h-4 text-[#D4CDA4]" /></button>
                          <button onClick={() => { setArtIndex(prev => (prev + 1) % ARTWORK.length); resetMenuTimer(); }} className="p-3 bg-[#1A1D14] rounded-xl hover:bg-white/10 border border-white/5"><ChevronRight className="w-4 h-4 text-[#D4CDA4]" /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SOURCES */}
            {activeTab === 'source' && (
              <div className="flex gap-8 animate-in fade-in zoom-in-95 duration-500 min-h-[300px]">
                
                {/* Source Selection Sidebar */}
                <div className="w-1/3 flex flex-col gap-4 border-r border-white/5 pr-8">
                  <div onClick={() => setImageSource('curated')} className={`cursor-pointer p-5 rounded-[1.5rem] border transition-all flex items-center gap-5 ${imageSource === 'curated' ? 'bg-[#D4CDA4]/10 border-[#D4CDA4]' : 'border-white/5 hover:bg-white/5'}`}>
                      <ImageIcon className={`w-8 h-8 ${imageSource === 'curated' ? 'text-[#D4CDA4]' : 'text-white/40'}`} />
                      <div>
                        <div className={`text-[10px] uppercase tracking-[0.2em] font-bold ${imageSource === 'curated' ? 'text-[#D4CDA4]' : 'text-white/60'}`}>Curated Gallery</div>
                        <div className="text-[9px] text-white/30 uppercase tracking-widest mt-1">{ARTWORK.length} Items</div>
                      </div>
                      {imageSource === 'curated' && <CheckCircle2 className="w-4 h-4 ml-auto text-[#D4CDA4]" />}
                  </div>

                  <div onClick={() => setImageSource('local')} className={`cursor-pointer p-5 rounded-[1.5rem] border transition-all flex items-center gap-5 ${imageSource === 'local' ? 'bg-[#D4CDA4]/10 border-[#D4CDA4]' : 'border-white/5 hover:bg-white/5'}`}>
                      <FolderOpen className={`w-8 h-8 ${imageSource === 'local' ? 'text-[#D4CDA4]' : 'text-white/40'}`} />
                      <div>
                        <div className={`text-[10px] uppercase tracking-[0.2em] font-bold ${imageSource === 'local' ? 'text-[#D4CDA4]' : 'text-white/60'}`}>Local Storage</div>
                        <div className="text-[9px] text-white/30 uppercase tracking-widest mt-1">{localFiles.length} Selected</div>
                      </div>
                      {imageSource === 'local' && <CheckCircle2 className="w-4 h-4 ml-auto text-[#D4CDA4]" />}
                  </div>

                  <div onClick={() => setImageSource('gphotos')} className={`cursor-pointer p-5 rounded-[1.5rem] border transition-all flex items-center gap-5 ${imageSource === 'gphotos' ? 'bg-[#D4CDA4]/10 border-[#D4CDA4]' : 'border-white/5 hover:bg-white/5'}`}>
                      <Cloud className={`w-8 h-8 ${imageSource === 'gphotos' ? 'text-[#D4CDA4]' : 'text-white/40'}`} />
                      <div>
                        <div className={`text-[10px] uppercase tracking-[0.2em] font-bold ${imageSource === 'gphotos' ? 'text-[#D4CDA4]' : 'text-white/60'}`}>Google Photos</div>
                        <div className="text-[9px] text-white/30 uppercase tracking-widest mt-1">{gPhotosSelectedAlbum ? 'Album Selected' : 'Cloud Library'}</div>
                      </div>
                      {imageSource === 'gphotos' && <CheckCircle2 className="w-4 h-4 ml-auto text-[#D4CDA4]" />}
                  </div>
                </div>

                {/* Source Configuration Area */}
                <div className="flex-1 flex flex-col pl-4">
                  
                  {imageSource === 'curated' && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-60">
                      <ImageIcon className="w-16 h-16 text-[#D4CDA4] mb-6 opacity-50" />
                      <h3 className="text-[#D4CDA4] font-serif text-3xl italic tracking-tight mb-3">Premium Curation</h3>
                      <p className="text-white/50 text-[11px] uppercase tracking-[0.2em] max-w-sm leading-relaxed">
                        Enjoy a hand-picked selection of high-resolution masterpieces dynamically matched to your room's ambient state.
                      </p>
                    </div>
                  )}

                  {imageSource === 'local' && (
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="bg-white/5 border border-white/10 rounded-3xl p-10 flex flex-col items-center text-center">
                        <FolderOpen className="w-12 h-12 text-[#D4CDA4] mb-6" />
                        <h3 className="text-white font-bold text-[12px] uppercase tracking-[0.3em] mb-2">Device Storage (Capacitor)</h3>
                        <p className="text-white/40 text-[10px] uppercase tracking-[0.2em] max-w-sm mb-10 leading-relaxed">
                          Select a folder from your Android TV to display custom images.
                        </p>
                        
                        {/* Hidden input for web fallback / native bridge hook */}
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleLocalFileSelect} 
                          accept="image/*"
                          multiple
                          // @ts-ignore - webkitdirectory allows folder selection in web
                          webkitdirectory="true" 
                          className="hidden" 
                        />
                        
                        <button 
                          onClick={() => fileInputRef.current?.click()} 
                          className="px-10 py-4 bg-[#D4CDA4] text-[#1A1D14] rounded-xl text-[10px] uppercase tracking-[0.3em] font-bold shadow-xl hover:scale-105 transition-all"
                        >
                          Select Image Folder
                        </button>
                        
                        {localFiles.length > 0 && (
                          <div className="mt-8 pt-6 border-t border-white/10 w-full text-center">
                            <span className="text-[10px] font-mono text-[#D4CDA4]">{localFiles.length} IMAGES LOADED</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {imageSource === 'gphotos' && (
                    <div className="flex-1 flex flex-col">
                      {!gPhotosConnected ? (
                        <div className="bg-blue-900/10 border border-blue-500/20 rounded-3xl p-10 flex flex-col items-center text-center h-full justify-center">
                          <Cloud className="w-12 h-12 text-blue-400 mb-6" />
                          <h3 className="text-white font-bold text-[12px] uppercase tracking-[0.3em] mb-2">Connect to Cloud</h3>
                          <p className="text-white/40 text-[10px] uppercase tracking-[0.2em] max-w-sm mb-10 leading-relaxed font-mono">
                            Project ID: gen-lang-client-<br/>0313256568
                          </p>
                          <button 
                            onClick={() => { setGPhotosConnected(true); resetMenuTimer(); }} 
                            className="px-10 py-4 bg-blue-500 hover:bg-blue-400 text-white rounded-xl text-[10px] uppercase tracking-[0.3em] font-bold shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all flex items-center gap-3"
                          >
                            <UserCircle2 className="w-4 h-4" /> Authenticate
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col h-full">
                          <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[#D4CDA4] text-[10px] uppercase tracking-[0.3em] font-bold">Select Library Album</h3>
                            <button onClick={() => setGPhotosConnected(false)} className="text-[9px] text-white/30 uppercase tracking-widest hover:text-white">Disconnect</button>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4 overflow-y-auto pr-2 pb-4">
                            {MOCK_GPHOTOS_ALBUMS.map(album => (
                              <div 
                                key={album.id}
                                onClick={() => { setGPhotosSelectedAlbum(album.id); setArtIndex(0); resetMenuTimer(); }}
                                className={`cursor-pointer relative rounded-2xl overflow-hidden aspect-square border-2 transition-all ${gPhotosSelectedAlbum === album.id ? 'border-[#D4CDA4] shadow-[0_0_20px_rgba(212,205,164,0.3)] scale-105 z-10' : 'border-transparent opacity-60 hover:opacity-100'}`}
                              >
                                <img src={album.cover} className="absolute inset-0 w-full h-full object-cover" alt={album.name} />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-4">
                                  <div className="text-[10px] font-bold uppercase tracking-widest text-white shadow-black">{album.name}</div>
                                  <div className="text-[8px] font-mono text-[#D4CDA4] mt-1">{album.count} Items</div>
                                </div>
                                {gPhotosSelectedAlbum === album.id && (
                                  <div className="absolute top-3 right-3 bg-[#D4CDA4] text-[#1A1D14] rounded-full p-1 shadow-lg">
                                    <CheckCircle2 className="w-3 h-3" />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* TAB 3: SYSTEM */}
            {activeTab === 'system' && (
              <div className="flex flex-col gap-10 animate-in fade-in zoom-in-95 duration-500">
                {/* Top Row: System Status & Connection */}
                <div className="flex items-center gap-12 pb-8 border-b border-white/5">
                  <div className="flex-1 flex flex-col items-center">
                    <div className="text-[10px] text-[#A3B18A]/50 uppercase tracking-[0.3em] mb-4 flex items-center gap-2 font-bold justify-center">
                      <Activity className="w-4 h-4" /> System Core Status
                    </div>
                    <div className="grid grid-cols-3 gap-12 text-center w-full max-w-md">
                      <div>
                        <label className="text-[10px] text-white/20 uppercase tracking-[0.3em] block mb-2 font-bold">Lux</label>
                        <div className="text-3xl font-mono text-[#D4CDA4]">{telemetry.lux}</div>
                      </div>
                      <div>
                        <label className="text-[10px] text-white/20 uppercase tracking-[0.3em] block mb-2 font-bold">Kelvin</label>
                        <div className="text-3xl font-mono text-[#D4CDA4]">{telemetry.temp}</div>
                      </div>
                      <div>
                        <label className="text-[10px] text-white/20 uppercase tracking-[0.3em] block mb-2 font-bold">Motion</label>
                        <div className={`text-3xl font-mono ${telemetry.motion ? 'text-[#A3B18A]' : 'text-white/10'}`}>
                          {telemetry.motion ? 'YES' : 'NO'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-px h-16 bg-white/5 self-center" />

                  <div className="flex-1 max-w-sm">
                    <div className="bg-[#1A1D14]/80 border border-white/5 p-5 rounded-[1.5rem] flex items-center gap-5 shadow-inner">
                      <span className={`w-4 h-4 rounded-full flex-shrink-0 ${
                        discoveryState === 'connected' ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)]' : 
                        discoveryState === 'searching' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
                      }`} />
                      <div className="flex flex-col flex-1 justify-center min-h-[44px]">
                        <span className="text-[10px] text-[#A3B18A] uppercase tracking-[0.3em] font-bold">Ambient Sensor</span>
                        <input 
                          className="bg-transparent text-[11px] font-mono border-none outline-none text-white/40 w-full mt-2"
                          value={arduinoIp}
                          onChange={(e) => { setArduinoIp(e.target.value); setIsScanning(true); resetMenuTimer(); }}
                          placeholder="Configure Device IP"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Automation & Safety */}
                <div className="grid grid-cols-2 gap-16">
                  <div className="space-y-8">
                    <div className="space-y-5">
                      <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.3em] text-white/30 font-bold">
                        <span>Occupancy Action</span>
                      </div>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => { setPowerSafeAction('black'); resetMenuTimer(); }}
                          className={`flex-1 py-4 rounded-2xl text-[10px] uppercase tracking-widest font-bold border transition-all ${powerSafeAction === 'black' ? 'bg-[#D4CDA4] border-[#D4CDA4] text-[#1A1D14] shadow-lg' : 'bg-white/5 border-white/5 text-white/40'}`}
                        >
                          Fade Black
                        </button>
                        <button 
                          onClick={() => { setPowerSafeAction('off'); resetMenuTimer(); }}
                          className={`flex-1 py-4 rounded-2xl text-[10px] uppercase tracking-widest font-bold border transition-all ${powerSafeAction === 'off' ? 'bg-[#D4CDA4] border-[#D4CDA4] text-[#1A1D14] shadow-lg' : 'bg-white/5 border-white/5 text-white/40'}`}
                        >
                          Off (CEC)
                        </button>
                      </div>
                      <div className="text-[9px] text-white/20 uppercase tracking-widest text-center mt-2 italic">What happens when the room is empty</div>
                    </div>
                  </div>

                  <div className="space-y-8 flex flex-col justify-end">
                    <div className="space-y-5">
                      <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.3em] text-white/30 font-bold">
                        <span>Sleep Timer Requirement</span>
                        <span className="text-[#A3B18A] font-mono text-xs">{powerSafeMinutes} MIN</span>
                      </div>
                      <div className="relative h-2 flex items-center">
                        <input 
                          type="range" min={1} max={10} value={powerSafeMinutes} 
                          onChange={(e) => { setPowerSafeMinutes(Number(e.target.value)); resetMenuTimer(); }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="w-full h-1 bg-white/5 rounded-full" />
                        <div className="absolute h-1 bg-[#D4CDA4]" style={{ width: `${(powerSafeMinutes - 1) / 9 * 100}%` }} />
                        <div className="absolute w-6 h-6 rounded-full bg-[#D4CDA4] border-[5px] border-[#1A1D14] shadow-lg" style={{ left: `calc(${(powerSafeMinutes - 1) / 9 * 100}% - 12px)` }} />
                      </div>
                    </div>

                    <div className="space-y-5 pt-4">
                      <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.3em] text-white/30 font-bold">
                        <span>Motion Sensitivity Filter</span>
                        <span className="text-[#A3B18A] font-mono text-xs">{motionSensitivity} SAMPLES</span>
                      </div>
                      <div className="relative h-2 flex items-center">
                        <input 
                          type="range" min={1} max={10} value={motionSensitivity} 
                          onChange={(e) => { setMotionSensitivity(Number(e.target.value)); resetMenuTimer(); }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="w-full h-1 bg-white/5 rounded-full" />
                        <div className="absolute h-1 bg-[#A3B18A]" style={{ width: `${(motionSensitivity - 1) / 9 * 100}%` }} />
                        <div className="absolute w-6 h-6 rounded-full bg-[#A3B18A] border-[5px] border-[#1A1D14] shadow-lg" style={{ left: `calc(${(motionSensitivity - 1) / 9 * 100}% - 12px)` }} />
                      </div>
                      <div className="text-[9px] text-white/20 uppercase tracking-widest text-center mt-2 italic">Higher value prevents false waking from noise</div>
                    </div>
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>
      </div>

      {/* Floating Bottom Navigator */}
      <div className={`absolute bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-6 transition-all duration-1000 ${showSettingsMenu || !uiVisible ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100'}`}>
        <button 
          onClick={() => setShowSettingsMenu(true)}
          className="bg-[#1A1D14]/40 backdrop-blur-md border border-white/10 px-12 py-5 rounded-full text-[13px] uppercase tracking-[0.4em] text-[#D4CDA4]/70 hover:text-[#D4CDA4] hover:bg-[#1A1D14]/60 hover:scale-105 transition-all flex items-center gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] pointer-events-auto"
        >
          <Settings className="w-5 h-5 opacity-50" />
          Adjust Settings
        </button>
        
        {isScreenBlack && (
          <div className="bg-red-900/60 backdrop-blur-xl border border-red-500/20 px-10 py-3 rounded-full text-[11px] uppercase tracking-[0.3em] text-red-200 animate-pulse font-bold shadow-2xl">
            {powerSafeAction === 'black' ? 'Panel Safe Mode Active' : 'System Standby Requested'}
          </div>
        )}
      </div>

      {/* Invisible toggle area for remotes (Bottom of screen) - Layered behind active menu */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-32 z-20 cursor-pointer"
        onClick={() => !showSettingsMenu && setShowSettingsMenu(true)}
      />

    </div>
  );
}
