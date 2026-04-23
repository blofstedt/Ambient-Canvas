import React, { useState, useEffect, useRef } from 'react';
import { Activity, Eye, EyeOff, Image as ImageIcon, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
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
  const [menuVisible, setMenuVisible] = useState(false);
  const motionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const uiTimerRef = useRef<NodeJS.Timeout | null>(null);
  const menuTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Appearance Settings
  const [grainIntensity, setGrainIntensity] = useState(45);
  const [luminance, setLuminance] = useState(60);
  const [warmth, setWarmth] = useState(200);
  
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

  // 2. Automate Rotation (Every 10 mins)
  useEffect(() => {
    const rotation = setInterval(() => {
      if (!showSettingsMenu) setArtIndex(prev => (prev + 1) % ARTWORK.length);
    }, 600000);
    return () => clearInterval(rotation);
  }, [showSettingsMenu]);

  // 3. Occupancy Logic
  useEffect(() => {
    if (telemetry.motion) {
      setIsScreenBlack(false);
      if (motionTimerRef.current) clearTimeout(motionTimerRef.current);
    } else {
      if (!isScreenBlack) {
        motionTimerRef.current = setTimeout(() => setIsScreenBlack(true), 15000); // 15s for demo
      }
    }
  }, [telemetry.motion, isScreenBlack]);

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
    const handleActivity = () => {
      resetUiTimer();
      if (showSettingsMenu) resetMenuTimer();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
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

  // Filter Computation
  const currentArt = ARTWORK[artIndex];
  const overlayOpacity = luminance / 100;
  const warmColor = `rgba(255, ${200 + (warmth/500)*55}, ${150 - (warmth/500)*100}, 0.25)`;

  return (
    <div className="w-full h-screen bg-black overflow-hidden flex flex-col font-sans text-[#EAE6DA] relative select-none">
      
      {/* 
        ART STAGE
      */}
      <AnimatePresence mode="wait">
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
                opacity: grainIntensity / 100 * 0.5
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

      {/* 
        SETTINGS OVERLAY
      */}
      <div 
        className={`absolute inset-0 z-50 p-12 flex flex-col items-center transition-all duration-700 ${
          showSettingsMenu ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex flex-col items-center justify-between w-full mb-auto gap-8">
          <div className="text-center drop-shadow-2xl bg-[#1A1D14]/40 backdrop-blur-md p-8 rounded-[2rem] border border-white/5 w-full max-w-4xl">
            <h1 className="text-6xl font-serif italic text-[#D4CDA4] tracking-tight">Ambient Canvas</h1>
            <p className="text-[#A3B18A] font-mono text-base mt-3 opacity-80 uppercase tracking-[0.2em]">
              {currentArt.title} — {currentArt.artist}
            </p>
            
            <div className="flex flex-col items-center gap-4 mt-8">
              <div className="bg-[#1A1D14]/90 border border-white/5 px-6 py-3 rounded-full flex items-center gap-4 shadow-inner">
                <span className={`w-3 h-3 rounded-full shadow-lg ${
                  discoveryState === 'connected' ? 'bg-green-500 shadow-green-500/50' : 
                  discoveryState === 'searching' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
                }`} />
                <div className="flex flex-col">
                  <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-1">Ambient Sensor Connection</span>
                  <input 
                    className="bg-transparent text-sm font-mono border-none outline-none text-[#A3B18A] w-48"
                    value={arduinoIp}
                    onChange={(e) => { setArduinoIp(e.target.value); setIsScanning(true); resetMenuTimer(); }}
                    placeholder="Enter IP or Name"
                  />
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#A3B18A]/60 font-bold">
                {discoveryState === 'connected' ? 'Link Established' : 
                 discoveryState === 'searching' ? 'Scanning Local Network...' : 'Connection Lost'}
              </div>
            </div>
          </div>

          <div className="bg-[#1A1D14]/95 border border-[#3A402F] p-8 rounded-[2.5rem] w-full max-w-xl shadow-2xl backdrop-blur-md">
            <div className="text-xs text-[#A3B18A]/50 uppercase tracking-[0.3em] mb-6 border-b border-[#3A402F] pb-4 flex items-center justify-center gap-3 font-bold">
              <Activity className="w-4 h-4" /> System Status
            </div>
            <div className="grid grid-cols-3 gap-8 text-center">
              <div>
                <label className="text-[11px] text-white/20 uppercase tracking-[0.2em] block mb-2 font-bold">Lux</label>
                <div className="text-3xl font-mono text-[#D4CDA4]">{telemetry.lux}</div>
              </div>
              <div>
                <label className="text-[11px] text-white/20 uppercase tracking-[0.2em] block mb-2 font-bold">Kelvin</label>
                <div className="text-3xl font-mono text-[#D4CDA4]">{telemetry.temp}</div>
              </div>
              <div>
                <label className="text-[11px] text-white/20 uppercase tracking-[0.2em] block mb-2 font-bold">Motion</label>
                <div className={`text-3xl font-mono ${telemetry.motion ? 'text-[#D4CDA4]' : 'text-white/10'}`}>
                  {telemetry.motion ? 'YES' : 'NO'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Control Cluster */}
        <div className="max-w-xl w-full bg-[#1A1D14]/95 border border-white/10 p-10 rounded-[3rem] shadow-[0_50px_100px_rgba(0,0,0,0.9)] backdrop-blur-sm mt-12">
          <div className="space-y-12">
            
            <div className="space-y-4">
              <div className="flex justify-between items-center text-[12px] uppercase tracking-[0.3em] text-white/40 font-bold">
                <span>Brightness</span>
                <span className="text-[#A3B18A] font-mono">{luminance}%</span>
              </div>
              <div className="relative h-2 flex items-center">
                <input 
                  type="range" min={0} max={100} value={luminance} 
                  onChange={(e) => { 
                    const val = Number(e.target.value);
                    setLuminance(val); 
                    saveProfile(val, warmth); 
                    resetMenuTimer();
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="w-full h-1 bg-white/5 rounded-full" />
                <div className="absolute h-1 bg-[#D4CDA4] shadow-[0_0_15px_rgba(212,205,164,0.4)]" style={{ width: `${luminance}%` }} />
                <div className="absolute w-6 h-6 rounded-full bg-[#D4CDA4] border-[6px] border-[#1A1D14] shadow-2xl" style={{ left: `calc(${luminance}% - 12px)` }} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-[12px] uppercase tracking-[0.3em] text-white/40 font-bold">
                <span>Color Temp</span>
                <span className="text-[#A3B18A] font-mono">{warmth}K</span>
              </div>
              <div className="relative h-2 flex items-center">
                <input 
                  type="range" min={-500} max={500} value={warmth} 
                  onChange={(e) => { 
                    const val = Number(e.target.value);
                    setWarmth(val); 
                    saveProfile(luminance, val); 
                    resetMenuTimer();
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="w-full h-1 bg-gradient-to-r from-blue-400/20 via-white/5 to-orange-400/20 rounded-full" />
                <div className="absolute w-6 h-6 rounded-full bg-[#FFB380] border-[6px] border-[#1A1D14] shadow-2xl" style={{ left: `calc(${50 + (warmth / 500) * 50}% - 12px)` }} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-[12px] uppercase tracking-[0.3em] text-white/40 font-bold">
                <span>Film Grain</span>
                <span className="text-[#A3B18A] font-mono">{grainIntensity}%</span>
              </div>
              <div className="relative h-2 flex items-center">
                <input 
                  type="range" min={0} max={100} value={grainIntensity} 
                  onChange={(e) => { setGrainIntensity(Number(e.target.value)); resetMenuTimer(); }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="w-full h-1 bg-white/5 rounded-full" />
                <div className="absolute h-1 bg-[#A3B18A]" style={{ width: `${grainIntensity}%` }} />
                <div className="absolute w-6 h-6 rounded-full bg-[#A3B18A] border-[6px] border-[#1A1D14] shadow-2xl" style={{ left: `calc(${grainIntensity}% - 12px)` }} />
              </div>
            </div>

          </div>
          
          <div className="mt-12 flex gap-8">
            <button 
              onClick={() => { setArtIndex(prev => (prev - 1 + ARTWORK.length) % ARTWORK.length); resetMenuTimer(); }}
              className="flex-1 py-5 bg-white/5 border border-white/10 rounded-[1.5rem] hover:bg-white/10 transition-all flex justify-center items-center shadow-lg group"
            >
              <ChevronLeft className="w-8 h-8 text-white/30 group-hover:text-white/80 transition-colors" />
            </button>
            <button 
              onClick={() => { setArtIndex(prev => (prev + 1) % ARTWORK.length); resetMenuTimer(); }}
              className="flex-1 py-5 bg-white/5 border border-white/10 rounded-[1.5rem] hover:bg-white/10 transition-all flex justify-center items-center shadow-lg group"
            >
              <ChevronRight className="w-8 h-8 text-white/30 group-hover:text-white/80 transition-colors" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bottom Navigator */}
      <div className={`absolute bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-6 transition-all duration-1000 ${showSettingsMenu || !uiVisible ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100'}`}>
        <button 
          onClick={() => setShowSettingsMenu(true)}
          className="bg-black/60 backdrop-blur-3xl border border-white/10 px-12 py-5 rounded-full text-[13px] uppercase tracking-[0.4em] text-[#D4CDA4]/70 hover:text-[#D4CDA4] hover:bg-black/80 hover:scale-105 transition-all flex items-center gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] pointer-events-auto"
        >
          <Settings className="w-5 h-5 opacity-50" />
          Adjust Settings
        </button>
        
        {isScreenBlack && (
          <div className="bg-red-900/60 backdrop-blur-xl border border-red-500/20 px-10 py-3 rounded-full text-[11px] uppercase tracking-[0.3em] text-red-200 animate-pulse font-bold shadow-2xl">
            Panel Safe Mode Active
          </div>
        )}
      </div>

      {/* Invisible toggle area for remotes (Bottom of screen) */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-32 z-[60] cursor-pointer"
        onClick={() => setShowSettingsMenu(!showSettingsMenu)}
      />

    </div>
  );
}
