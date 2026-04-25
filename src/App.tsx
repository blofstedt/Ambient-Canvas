import React, { useState, useEffect, useRef } from 'react';
import { Activity, Eye, EyeOff, Image as ImageIcon, ChevronLeft, ChevronRight, Settings, Clock, Cloud, FolderOpen, Power, MonitorPlay, LayoutTemplate, Sun, CloudRain, CloudFog, CloudSnow, CloudLightning, CheckCircle2, Search } from 'lucide-react';
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
      const saved = localStorage.getItem('ambient_sensors_v2');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [selectedSensorId, setSelectedSensorId] = useState<string>(() => localStorage.getItem('selected_sensor_id_v2') || '');
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
  const [showClock, setShowClock] = useState(true);
  const [showWeather, setShowWeather] = useState(true);
  const [weatherLocation, setWeatherLocation] = useState('Locating...');
  const [weatherTemp, setWeatherTemp] = useState<number | null>(null);
  const [weatherCode, setWeatherCode] = useState<number>(0);
  const [imageSource, setImageSource] = useState<'curated' | 'local'>('curated');
  
  // Custom Media Sources
  const [localFiles, setLocalFiles] = useState<string[]>([]);

  const [time, setTime] = useState(new Date());

  // Weather Fetching Logic (Geolocation & Open-Meteo)
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        if (!("geolocation" in navigator)) {
          setWeatherLocation("Location Unavailable");
          return;
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          
          try {
            const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
            const geoData = await geoRes.json();
            if (geoData.city || geoData.locality) {
              setWeatherLocation(`${geoData.city || geoData.locality}, ${geoData.principalSubdivision || geoData.countryCode}`);
            } else {
              setWeatherLocation('Unknown Location');
            }
          } catch {
            setWeatherLocation('Location Found');
          }

          const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius`);
          const data = await weatherRes.json();
          setWeatherTemp(Math.round(data.current_weather.temperature));
          setWeatherCode(data.current_weather.weathercode);
        }, () => {
          setWeatherLocation("Location Access Denied");
        });
      } catch (e) {
        console.error("Weather fetch error", e);
      }
    };
    if (showWeather) fetchWeather();
    const interval = setInterval(fetchWeather, 15 * 60 * 1000); // refresh every 15 min
    return () => clearInterval(interval);
  }, [showWeather]);

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
  
  // Load user-defined profiles from storage
  const [profiles, setProfiles] = useState<Record<string, RoomProfile>>(() => {
    try {
      const saved = localStorage.getItem('canvas_profiles');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const luxBucket = Math.floor(telemetry.lux / 20) * 20;
  const tempBucket = Math.floor(telemetry.temp / 500) * 500;
  const currentBucketKey = `${luxBucket}_${tempBucket}`;

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

  useEffect(() => {
    if (isScanning) {
      setDiscoveryState('searching');
      const scanNetwork = async () => {
        const subnets = ['192.168.1', '192.168.0', '192.168.50', '192.168.86', '10.0.0'];
        const newSensors = { ...sensors };
        let foundAny = false;

        for (const subnet of subnets) {
          const promises = [];
          for (let i = 1; i < 255; i++) {
            const ip = `${subnet}.${i}`;
            const target = `http://${ip}/`;
            promises.push((async () => {
              try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1500);
                const res = await fetch(target, { signal: controller.signal, mode: 'cors' });
                clearTimeout(timeoutId);
                
                if (res.ok) {
                  const data = await res.json();
                  if (data.id && data.lux !== undefined) {
                    newSensors[data.id] = { name: data.name || 'Unknown Sensor', ip: ip, lastSeen: Date.now() };
                    foundAny = true;
                  }
                }
              } catch (e) {
                // Ignore timeout or network errors
              }
            })());
          }
          await Promise.allSettled(promises);
          if (foundAny) break; // If we found on this subnet, no need to scan the others as aggressively
        }

        if (foundAny) {
          setSensors(newSensors);
          localStorage.setItem('ambient_sensors_v2', JSON.stringify(newSensors));
          if (!selectedSensorId) {
            const firstId = Object.keys(newSensors)[0];
            setSelectedSensorId(firstId);
            localStorage.setItem('selected_sensor_id_v2', firstId);
          }
          setDiscoveryState('connected');
        } else {
          setDiscoveryState('lost');
        }
        setIsScanning(false);
      };

      scanNetwork();
    }
  }, [isScanning]);

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

  useEffect(() => {
    if (isStatic) return;
    
    const rotation = setInterval(() => {
      if (!showSettingsMenu) setArtIndex(prev => (prev + 1) % ARTWORK.length);
    }, rotationInterval * 60000);
    return () => clearInterval(rotation);
  }, [showSettingsMenu, isStatic, rotationInterval]);

  useEffect(() => {
    motionHistoryRef.current = [...motionHistoryRef.current.slice(-(motionSensitivity - 1)), telemetry.motion];
    const hasSustainedMotion = motionHistoryRef.current.length >= motionSensitivity && 
                                motionHistoryRef.current.every(m => m === true);

    if (hasSustainedMotion) {
      setIsScreenBlack(false);
      if (motionTimerRef.current) clearTimeout(motionTimerRef.current);
    } else {
      const hasLostMotion = motionHistoryRef.current.every(m => m === false);
      if (hasLostMotion && !isScreenBlack && !motionTimerRef.current) {
        motionTimerRef.current = setTimeout(() => {
          setIsScreenBlack(true);
          motionTimerRef.current = null;
        }, powerSafeMinutes * 60000); 
      }
    }
  }, [telemetry.motion, isScreenBlack, motionSensitivity, powerSafeMinutes]);

  useEffect(() => {
    const userProfile = profiles[currentBucketKey];
    if (userProfile) {
      setLuminance(userProfile.luminance);
      setWarmth(userProfile.warmth);
    } else {
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
  }

  const overlayOpacity = luminance / 100;
  const warmColor = `rgba(255, ${200 + (warmth/500)*55}, ${150 - (warmth/500)*100}, 0.25)`;

  return (
    <div className="w-full h-screen bg-black overflow-hidden flex flex-col font-sans text-[#EAE6DA] relative select-none">
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
              filter: `brightness(${0.02 + overlayOpacity * 0.98}) contrast(1.1) sepia(0.2)` 
            }}
          >
            <div 
              className="absolute inset-0 mix-blend-multiply transition-colors duration-1000"
              style={{ backgroundColor: warmColor, opacity: Math.abs(warmth) / 500 }}
            />
            <div 
              className="absolute inset-0 mix-blend-overlay opacity-30 pointer-events-none"
              style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/natural-paper.png')" }}
            />
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
      <div className={`absolute inset-0 z-40 bg-black transition-opacity duration-[3000ms] pointer-events-none ${isScreenBlack ? 'opacity-100' : 'opacity-0'}`} />
      <div className="absolute inset-0 z-10 pointer-events-none shadow-[inset_0_0_300px_rgba(0,0,0,0.8)]" />
      <div 
        className={`absolute top-0 left-0 w-full p-[3vw] flex justify-between items-start z-30 transition-all duration-1000 pointer-events-none ${isScreenBlack ? 'opacity-0' : ''}`}
        style={{ opacity: isScreenBlack ? 0 : 0.15 + overlayOpacity * 0.85 }}
      >
        <div className={`transition-opacity duration-700 ${showClock ? 'opacity-100' : 'opacity-0'}`}>
          <div className="text-[5vw] font-serif tracking-tighter text-[#EAE6DA] drop-shadow-2xl leading-none">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div className="text-[0.8vw] font-mono opacity-80 uppercase tracking-[0.3em] mt-[1vw] drop-shadow-md text-[#A3B18A] font-bold">{time.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</div>
        </div>
        <div className={`transition-opacity duration-700 text-right ${showWeather ? 'opacity-100' : 'opacity-0'}`}>
          <div className="text-[4vw] font-serif tracking-tighter text-[#EAE6DA] drop-shadow-2xl flex items-center justify-end gap-[1vw] leading-none">
            {weatherTemp !== null ? `${weatherTemp}°C` : '--°C'}
            <div className="scale-[1.5] origin-right">{getWeatherIcon(weatherCode)}</div>
          </div>
          <div className="text-[0.8vw] font-mono opacity-80 uppercase tracking-[0.3em] mt-[1vw] drop-shadow-md text-[#A3B18A] font-bold">{weatherLocation}</div>
        </div>
      </div>
      <div 
        className={`absolute inset-0 z-50 p-[3vw] flex flex-col justify-center items-center transition-all duration-700 ${
          showSettingsMenu ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="w-[65vw] max-w-5xl bg-[#1A1D14]/40 backdrop-blur-md border border-white/10 p-[3vw] rounded-[2vw] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col gap-[2vw]">
                     {/* Display & Layout Section */}
          <div className="space-y-[1vw]">
            <h3 className="text-[#D4CDA4] text-[0.8vw] uppercase tracking-[0.3em] font-bold border-b border-white/10 pb-[0.5vw]">Display</h3>
            <div className="grid grid-cols-4 gap-[2vw]">
              <div className="space-y-[0.5vw]">
                <div className="flex justify-between items-center text-[0.8vw] uppercase tracking-[0.3em] text-white/50 font-bold">
                  <span>Brightness</span>
                  <span className="text-[#A3B18A] font-mono text-[0.9vw]">{luminance}%</span>
                </div>
                <div className="relative h-[0.6vw] flex items-center">
                  <input 
                    type="range" min={0} max={100} value={luminance} 
                    onChange={(e) => { const v = Number(e.target.value); setLuminance(v); saveProfile(v, warmth); resetMenuTimer(); }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="w-full h-full bg-gradient-to-r from-black/50 to-white/50 rounded-full" />
                  <div className="absolute w-[1.2vw] h-[1.2vw] rounded-full bg-[#D4CDA4] border-[0.2vw] border-[#1A1D14]" style={{ left: `calc(${luminance}% - 0.6vw)` }} />
                </div>
              </div>
              <div className="space-y-[0.5vw]">
                <div className="flex justify-between items-center text-[0.8vw] uppercase tracking-[0.3em] text-white/50 font-bold">
                  <span>Temp</span>
                  <span className="text-[#A3B18A] font-mono text-[0.9vw]">{warmth}K</span>
                </div>
                <div className="relative h-[0.6vw] flex items-center">
                  <input 
                    type="range" min={-500} max={500} value={warmth} 
                    onChange={(e) => { const v = Number(e.target.value); setWarmth(v); saveProfile(luminance, v); resetMenuTimer(); }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="w-full h-full bg-gradient-to-r from-blue-400/20 via-white/10 to-orange-400/20 rounded-full" />
                  <div className="absolute w-[1.2vw] h-[1.2vw] rounded-full bg-[#FFB380] border-[0.2vw] border-[#1A1D14]" style={{ left: `calc(${50 + (warmth / 500) * 50}% - 0.6vw)` }} />
                </div>
              </div>
              <div className="space-y-[0.5vw]">
                <div className="flex justify-between items-center text-[0.8vw] uppercase tracking-[0.3em] text-white/50 font-bold">
                  <span>Grain</span>
                  <span className="text-[#A3B18A] font-mono text-[0.9vw]">{grainIntensity}%</span>
                </div>
                <div className="relative h-[0.6vw] flex items-center">
                  <input 
                    type="range" min={0} max={100} value={grainIntensity} 
                    onChange={(e) => { setGrainIntensity(Number(e.target.value)); resetMenuTimer(); }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="w-full h-full bg-gradient-to-r from-transparent to-white/30 rounded-full" />
                  <div className="absolute w-[1.2vw] h-[1.2vw] rounded-full bg-[#A3B18A] border-[0.2vw] border-[#1A1D14]" style={{ left: `calc(${grainIntensity}% - 0.6vw)` }} />
                </div>
              </div>
              <div className="flex gap-[1vw]">
                <button 
                  onClick={() => { setShowClock(!showClock); resetMenuTimer(); }} 
                  className={`flex-1 aspect-square rounded-[1vw] flex flex-col items-center justify-center gap-[0.2vw] border transition-all ${showClock ? 'bg-[#D4CDA4]/10 border-[#D4CDA4] text-[#D4CDA4]' : 'border-white/10 text-white/40 hover:bg-white/5'}`}
                >
                  <Clock className="w-[1.2vw] h-[1.2vw]" />
                  <span className="text-[0.7vw] uppercase tracking-widest font-bold mt-[0.2vw]">Clock</span>
                </button>
                <button 
                  onClick={() => { setShowWeather(!showWeather); resetMenuTimer(); }} 
                  className={`flex-1 aspect-square rounded-[1vw] flex flex-col items-center justify-center gap-[0.2vw] border transition-all ${showWeather ? 'bg-[#D4CDA4]/10 border-[#D4CDA4] text-[#D4CDA4]' : 'border-white/10 text-white/40 hover:bg-white/5'}`}
                >
                  <Cloud className="w-[1.2vw] h-[1.2vw]" />
                  <span className="text-[0.7vw] uppercase tracking-widest font-bold mt-[0.2vw]">Weather</span>
                </button>
              </div>
            </div>
          </div>

          {/* Media Sources Section */}
          <div className="space-y-[1vw]">
            <h3 className="text-[#D4CDA4] text-[0.8vw] uppercase tracking-[0.3em] font-bold border-b border-white/10 pb-[0.5vw]">Media & Rotation</h3>
            <div className="grid grid-cols-3 gap-[2vw]">
                <button onClick={() => setImageSource('curated')} className={`p-[1.5vw] rounded-[1vw] border flex items-center gap-[1vw] ${imageSource === 'curated' ? 'bg-[#D4CDA4]/10 border-[#D4CDA4]' : 'border-white/10 hover:bg-white/5'}`}>
                    <ImageIcon className={`w-[1.5vw] h-[1.5vw] ${imageSource === 'curated' ? 'text-[#D4CDA4]' : 'text-white/40'}`} />
                    <span className="text-[0.9vw] uppercase font-bold text-white/60 tracking-widest">Curated</span>
                </button>
                <button onClick={() => {setImageSource('local'); fileInputRef.current?.click()}} className={`p-[1.5vw] rounded-[1vw] border flex items-center gap-[1vw] ${imageSource === 'local' ? 'bg-[#D4CDA4]/10 border-[#D4CDA4]' : 'border-white/10 hover:bg-white/5'}`}>
                    <FolderOpen className={`w-[1.5vw] h-[1.5vw] ${imageSource === 'local' ? 'text-[#D4CDA4]' : 'text-white/40'}`} />
                     <span className="text-[0.9vw] uppercase font-bold text-white/60 tracking-widest">Local Albums</span>
                     <input type="file" ref={fileInputRef} onChange={handleLocalFileSelect} accept="image/*" multiple webkitdirectory="true" className="hidden" />
                </button>
                <div className="flex flex-col justify-between">
                  <div className="flex justify-between items-center text-[0.8vw] uppercase tracking-[0.3em] text-white/50 font-bold mb-[0.5vw]">
                    <span>Cycle Time</span>
                    <span className="text-[#A3B18A] font-mono text-[0.9vw]">{rotationInterval}M</span>
                  </div>
                  <div className="flex gap-[0.5vw] h-full">
                    {[5, 10, 30, 60].map(time => (
                      <button 
                        key={time} 
                        onClick={() => { setRotationInterval(time); resetMenuTimer(); }} 
                        className={`flex-1 rounded-[0.5vw] text-[0.8vw] font-mono border transition-all ${rotationInterval === time ? 'bg-[#D4CDA4] text-[#1A1D14] border-[#D4CDA4]' : 'border-white/10 text-white/60 hover:bg-white/5'}`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
            </div>
          </div>

          {/* Power & Sensors Section */}
          <div className="space-y-[1vw]">
            <div className="flex justify-between items-center border-b border-white/10 pb-[0.5vw]">
              <h3 className="text-[#D4CDA4] text-[0.8vw] uppercase tracking-[0.3em] font-bold border-none pb-0">Sensors & Telemetry</h3>
              <button onClick={() => { setIsScanning(true); resetMenuTimer(); }} className="text-[0.6vw] flex items-center gap-[0.5vw] uppercase tracking-widest text-[#D4CDA4] hover:text-white transition-colors">
                <Search className={`w-[1vw] h-[1vw] ${isScanning ? 'animate-spin' : ''}`} />
                {isScanning ? 'Scanning...' : 'Rescan'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-[2vw]">
              <div className="bg-white/5 p-[1.5vw] rounded-[1vw]">
                {Object.keys(sensors).length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-white/60 text-[0.8vw] uppercase text-center h-full gap-[0.5vw]">
                    <p className="font-bold text-[#D4CDA4]">No Sensors Found</p>
                    <p className="text-[0.7vw] text-white/40 leading-relaxed max-w-[80%] mt-[0.5vw]">Please connect your phone to "Ambient Setup" to set up your ambient sensor.</p>
                    
                    <div className="mt-[1vw] flex gap-[0.5vw] items-center w-full max-w-[70%]">
                      <input 
                        type="text" 
                        placeholder="Manual IP (e.g. 192.168.1.50)" 
                        className="bg-black/30 border border-white/10 rounded-[0.5vw] px-[0.8vw] py-[0.5vw] text-[0.7vw] font-mono text-white/80 w-full focus:outline-none focus:border-[#D4CDA4]/50"
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            const val = e.currentTarget.value.trim();
                            if (val) {
                              try {
                                const res = await fetch(`http://${val}/`);
                                const data = await res.json();
                                if (data.id) {
                                  const newSensors = { ...sensors, [data.id]: { name: data.name || 'Manual Sensor', ip: val, lastSeen: Date.now() } };
                                  setSensors(newSensors);
                                  localStorage.setItem('ambient_sensors_v2', JSON.stringify(newSensors));
                                  setSelectedSensorId(data.id);
                                  localStorage.setItem('selected_sensor_id_v2', data.id);
                                }
                              } catch(err) {
                                alert("Could not connect to sensor at " + val);
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                ) : Object.entries(sensors).map(([mac, sensor]: [string, any]) => (
                    <div key={mac} className={`flex justify-between items-center p-[0.8vw] rounded-[0.5vw] mb-[0.5vw] border ${selectedSensorId === mac ? 'bg-[#D4CDA4]/10 border-[#D4CDA4]' : 'border-white/5 hover:bg-white/10'}`}>
                      <span className="text-[0.9vw] text-white font-mono">{sensor.name}</span>
                      <button onClick={() => { setSelectedSensorId(mac); localStorage.setItem('selected_sensor_id_v2', mac); resetMenuTimer(); }} className={`text-[0.7vw] uppercase font-bold px-[1vw] py-[0.5vw] rounded-[0.2vw] transition-all ${selectedSensorId === mac ? 'bg-[#D4CDA4] text-[#1A1D14]' : 'bg-white/10 text-white/50 hover:bg-white/20'}`}>
                        {selectedSensorId === mac ? 'Active' : 'Select'}
                      </button>
                    </div>
                ))}
              </div>
              <div className="bg-white/5 p-[1.5vw] rounded-[1vw] flex flex-col justify-center gap-[1.5vw]">
                <div className="flex justify-between items-end border-b border-white/10 pb-[1vw]">
                    <span className="text-[0.8vw] text-white/50 font-bold uppercase tracking-widest">Luminance</span>
                    <span className="text-[2vw] text-[#D4CDA4] font-mono leading-none">{telemetry.lux} <span className="text-[1vw] text-[#A3B18A]">LUX</span></span>
                </div>
                <div className="flex justify-between items-end">
                    <span className="text-[0.8vw] text-white/50 font-bold uppercase tracking-widest">Temperature</span>
                    <span className="text-[2vw] text-[#D4CDA4] font-mono leading-none">{telemetry.temp} <span className="text-[1vw] text-[#A3B18A]">K</span></span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
      <div className={`absolute bottom-[4vw] left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-[1.5vw] transition-all duration-1000 ${showSettingsMenu || !uiVisible ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100'}`}>
        <button 
          onClick={() => setShowSettingsMenu(true)}
          className="bg-[#1A1D14]/40 backdrop-blur-md border border-white/10 px-[3vw] py-[1.2vw] rounded-full text-[0.8vw] uppercase tracking-[0.4em] text-[#D4CDA4]/70 hover:text-[#D4CDA4] hover:bg-[#1A1D14]/60 hover:scale-105 transition-all flex items-center gap-[1vw] shadow-[0_20px_50px_rgba(0,0,0,0.5)] pointer-events-auto"
        >
          <Settings className="w-[1.2vw] h-[1.2vw] opacity-50" />
          Adjust Settings
        </button>
        {isScreenBlack && (
          <div className="bg-red-900/60 backdrop-blur-xl border border-red-500/20 px-[2.5vw] py-[0.8vw] rounded-full text-[0.7vw] uppercase tracking-[0.3em] text-red-200 animate-pulse font-bold shadow-2xl">
            Screen in Power Save Mode
          </div>
        )}
      </div>
    </div>
  );
}
