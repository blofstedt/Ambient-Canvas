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
  // Telemetry & Discovery (Multiple Sensors)
  const [sensors, setSensors] = useState<Record<string, { name: string, ip: string, lastSeen: number }>>(() => {
    try {
      const saved = localStorage.getItem('ambient_sensors');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [selectedSensorId, setSelectedSensorId] = useState<string>(() => localStorage.getItem('selected_sensor_id') || '');
  const [telemetry, setTelemetry] = useState({ lux: 15, temp: 2800, motion: true });
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
  const [gPhotosConnected, setGPhotosConnected] = useState<boolean>(() => !!localStorage.getItem('gphotos_token'));
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

  // GPhotos Data
  const [gPhotosToken, setGPhotosToken] = useState<string | null>(() => localStorage.getItem('gphotos_token'));
  const [gPhotosAlbums, setGPhotosAlbums] = useState<any[]>([]);
  const [gPhotosPics, setGPhotosPics] = useState<string[]>([]);

  // Fetch Albums
  useEffect(() => {
    if (gPhotosToken) {
      fetch('/api/google-photos/albums', {
        headers: { Authorization: `Bearer ${gPhotosToken}` }
      })
      .then(res => {
        if (res.status === 401) {
          setGPhotosConnected(false);
          setGPhotosToken(null);
          localStorage.removeItem('gphotos_token');
          throw new Error('Unauthorized');
        }
        return res.json();
      })
      .then(data => {
        if (data.albums) {
          setGPhotosAlbums(data.albums.map((a: any) => ({
            id: a.id,
            name: a.title,
            count: a.mediaItemsCount,
            cover: a.coverPhotoBaseUrl ? a.coverPhotoBaseUrl + '=w400-h400-c' : null
          })));
        }
      })
      .catch(console.error);
    }
  }, [gPhotosToken]);

  // Fetch Photos for specific album
  useEffect(() => {
    if (gPhotosToken && gPhotosSelectedAlbum) {
      fetch(`/api/google-photos/photos?albumId=${gPhotosSelectedAlbum}`, {
        headers: { Authorization: `Bearer ${gPhotosToken}` }
      })
      .then(res => {
        if (res.status === 401) {
          setGPhotosConnected(false);
          setGPhotosToken(null);
          localStorage.removeItem('gphotos_token');
          throw new Error('Unauthorized');
        }
        return res.json();
      })
      .then(data => {
        if (data.mediaItems) {
          // get baseUrls, optionally append '=w1920-h1080' or similar for size
          setGPhotosPics(data.mediaItems.map((m: any) => m.baseUrl + '=w1920-h1080'));
          setArtIndex(0);
        }
      })
      .catch(console.error);
    }
  }, [gPhotosToken, gPhotosSelectedAlbum]);

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
    const files = Array.from(e.target.files || []) as File[];
    const urls = files.filter(f => f.type.startsWith('image/')).map(f => URL.createObjectURL(f));
    if (urls.length > 0) {
      setLocalFiles(urls);
      setImageSource('local');
      setArtIndex(0);
      resetMenuTimer();
    }
  };

  // Handle OAuth callback via popup message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
         return;
      }
      if (event.data?.type === 'GPHOTOS_AUTH_SUCCESS') {
        const token = event.data.token;
        if (token) {
          localStorage.setItem('gphotos_token', token);
          setGPhotosToken(token);
        }
        setGPhotosConnected(true);
      }
    };
    window.addEventListener('message', handleMessage);
    
    // Fallback if URL redirect was triggered instead
    const params = new URLSearchParams(window.location.search);
    if (params.get('gphotos_connected') === 'true') {
      const token = params.get('token');
      if (token) {
        localStorage.setItem('gphotos_token', token);
        setGPhotosToken(token);
      }
      setGPhotosConnected(true);
      
      // clean up URL
      window.history.replaceState({}, document.title, "/");
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);
  
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

  // 1. Discovery & Heartbeat
  useEffect(() => {
    // In a real Android TV app using Capacitor/Zeroconf, we would scan here.
    // For this preview, we simulate discovery at startup.
    if (isScanning && Object.keys(sensors).length === 0) {
      const mockDiscovery = setTimeout(() => {
        const discovered = {
          'AA:BB:CC:11': { name: 'Basement Gym', ip: '192.168.1.50', lastSeen: Date.now() },
          'AA:BB:CC:22': { name: 'Theatre Room', ip: '192.168.1.51', lastSeen: Date.now() }
        };
        setSensors(discovered);
        localStorage.setItem('ambient_sensors', JSON.stringify(discovered));
        if (!selectedSensorId) setSelectedSensorId('AA:BB:CC:11');
        setIsScanning(false);
        setDiscoveryState('connected');
      }, 2000);
      return () => clearTimeout(mockDiscovery);
    }
  }, [isScanning, sensors, selectedSensorId]);

  useEffect(() => {
    if (!selectedSensorId || !sensors[selectedSensorId]) return;

    const fetchTelemetry = async () => {
      try {
        const target = `http://${sensors[selectedSensorId].ip}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(target, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          setTelemetry(data);
          setDiscoveryState('connected');
        }
      } catch (e) {
        setDiscoveryState('lost');
      }
    };

    const interval = setInterval(fetchTelemetry, 4000);
    return () => clearInterval(interval);
  }, [selectedSensorId, sensors]);

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
  } else if (imageSource === 'gphotos' && gPhotosSelectedAlbum && gPhotosPics.length > 0) {
    currentArt = {
      id: 888,
      title: "Google Photos",
      artist: gPhotosAlbums.find(a => a.id === gPhotosSelectedAlbum)?.name || "Album",
      url: gPhotosPics[artIndex % gPhotosPics.length]
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
                            onClick={async () => {
                              try {
                                const origin = window.location.origin;
                                const res = await fetch(`/api/google-photos/auth-url?origin=${encodeURIComponent(origin)}`);
                                const { url } = await res.json();
                                window.open(url, "gphotos_oauth", "width=500,height=600");
                              } catch (e) {
                                console.error(e);
                              }
                            }} 
                            className="px-10 py-4 bg-blue-500 hover:bg-blue-400 text-white rounded-xl text-[10px] uppercase tracking-[0.3em] font-bold shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all flex items-center gap-3"
                          >
                            <UserCircle2 className="w-4 h-4" /> Authenticate
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col h-full">
                          <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[#D4CDA4] text-[10px] uppercase tracking-[0.3em] font-bold">Select Library Album</h3>
                            <button onClick={() => {
                              setGPhotosConnected(false);
                              setGPhotosToken(null);
                              localStorage.removeItem('gphotos_token');
                              setGPhotosSelectedAlbum(null);
                              setGPhotosAlbums([]);
                              setGPhotosPics([]);
                            }} className="text-[9px] text-white/30 uppercase tracking-widest hover:text-white">Disconnect</button>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4 overflow-y-auto pr-2 pb-4">
                            {gPhotosAlbums.map(album => (
                              <div 
                                key={album.id}
                                onClick={() => { setGPhotosSelectedAlbum(album.id); setImageSource('gphotos'); setArtIndex(0); resetMenuTimer(); }}
                                className={`cursor-pointer relative rounded-2xl overflow-hidden aspect-square border-2 transition-all ${gPhotosSelectedAlbum === album.id ? 'border-[#D4CDA4] shadow-[0_0_20px_rgba(212,205,164,0.3)] scale-105 z-10' : 'border-transparent opacity-60 hover:opacity-100'}`}
                              >
                                {album.cover && <img src={album.cover} className="absolute inset-0 w-full h-full object-cover" alt={album.name} />}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-4">
                                  <div className="text-[10px] font-bold uppercase tracking-widest text-white shadow-black">{album.name}</div>
                                  <div className="text-[8px] font-mono text-[#D4CDA4] mt-1">{album.count || 0} Items</div>
                                </div>
                                {gPhotosSelectedAlbum === album.id && (
                                  <div className="absolute top-3 right-3 bg-[#D4CDA4] text-[#1A1D14] rounded-full p-1 shadow-lg">
                                    <CheckCircle2 className="w-3 h-3" />
                                  </div>
                                )}
                              </div>
                            ))}
                            {gPhotosAlbums.length === 0 && (
                               <div className="col-span-3 text-center py-8 text-white/40 text-[10px] uppercase tracking-widest">
                                Loading albums...
                               </div>
                            )}
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
              <div className="flex flex-col gap-8 animate-in fade-in zoom-in-95 duration-500">
                
                {/* Discovery & Selection */}
                <div className="grid grid-cols-2 gap-8">
                  <div className="bg-[#1A1D14]/80 border border-white/5 p-8 rounded-[2rem]">
                    <div className="text-[10px] text-[#A3B18A] uppercase tracking-[0.3em] font-bold mb-6">Discovered Sensors</div>
                    <div className="flex flex-col gap-3">
                      {Object.entries(sensors).map(([mac, sensor]: [string, any]) => (
                        <div key={mac} className={`flex items-center gap-4 p-4 rounded-xl border ${selectedSensorId === mac ? 'bg-[#D4CDA4]/10 border-[#D4CDA4]' : 'bg-white/5 border-white/5'}`}>
                          <input 
                            className="bg-transparent text-[11px] font-mono outline-none text-white w-full"
                            value={sensor.name}
                            onChange={(e) => {
                              const newSensors = { ...sensors, [mac]: { ...sensor, name: e.target.value } };
                              setSensors(newSensors);
                              localStorage.setItem('ambient_sensors', JSON.stringify(newSensors));
                            }}
                          />
                          <button 
                            onClick={() => { setSelectedSensorId(mac); localStorage.setItem('selected_sensor_id', mac); resetMenuTimer(); }}
                            className={`text-[9px] uppercase tracking-widest font-bold px-4 py-2 rounded-lg ${selectedSensorId === mac ? 'bg-[#D4CDA4] text-[#1A1D14]' : 'bg-white/10 text-white/50'}`}
                          >
                            {selectedSensorId === mac ? 'Active' : 'Select'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#1A1D14]/80 border border-white/5 p-8 rounded-[2rem] text-white/60">
                    <div className="text-[10px] text-[#A3B18A] uppercase tracking-[0.3em] font-bold mb-6">WiFi Setup Help</div>
                    <p className="text-[11px] leading-relaxed mb-4">If a sensor isn't listed, ensure it's powered on and in setup mode.</p>
                    <ol className="text-[11px] leading-relaxed list-decimal pl-4 space-y-2">
                        <li>Connect your phone's WiFi to <span className="text-[#D4CDA4] font-mono">Ambient-Sensor-Setup</span></li>
                        <li>Follow the pop-up instructions to connect to your home WiFi.</li>
                        <li>Return to this screen once the sensor joins your network.</li>
                    </ol>
                  </div>
                </div>

                {/* Telemetry Display */}
                <div className="border-t border-white/5 pt-8 flex items-center justify-between">
                  <div className="text-[10px] text-[#A3B18A]/50 uppercase tracking-[0.3em] font-bold flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Live Telemetry: {selectedSensorId ? sensors[selectedSensorId]?.name : 'None'}
                  </div>
                  <div className="flex gap-12 text-center">
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
