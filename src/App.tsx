import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion';

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */
const BIGDATACLOUD_REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';
const SENSOR_POLL_INTERVAL = 2000;       // ms between sensor polls
const SCAN_TIMEOUT = 3000;               // ms to wait for mDNS before IP scan
const LOCATION_TIMEOUT = 5000;           // ms for geolocation request
const MAX_SCAN_PARALLEL = 10;            // max concurrent HTTP probes during IP scan

/* ------------------------------------------------------------------ */
/*  Sensor Discovery & Polling Hook                                     */
/* ------------------------------------------------------------------ */
interface SensorInfo {
  id: string;
  name: string;
  hostname: string;      // mDNS hostname (e.g., amb-aabbccddee.local)
  ip: string;            // direct IP fallback
  lastLux: number;
  lastTemp: number;
  lastMotion: boolean;
  online: boolean;
}

function useSensors() {
  const [sensors, setSensors] = useState<SensorInfo[]>([]);
  const scanningRef = useRef(false);

  // --- mDNS discovery (with TXT record reading) ---
  const discoverMdns = useCallback(async () => {
    // @ts-ignore – mDNS API may not be typed
    if (!window.mdns || typeof window.mdns.discover !== 'function') return [];
    try {
      const services: any[] = await new Promise((resolve, reject) => {
        // @ts-ignore
        window.mdns.discover('_http._tcp', { timeout: SCAN_TIMEOUT }, (error: any, services: any) => {
          error ? reject(error) : resolve(services);
        });
      });
      return services
        .filter((s: any) => s.txt?.id) // only our sensors have an 'id' TXT record
        .map((s: any) => ({
          id: s.txt?.id || '',
          name: s.txt?.name || 'New Sensor',
          hostname: s.host?.replace(/\.local$/, '') || '',
          ip: s.addresses?.[0] || '',
          lastLux: 0,
          lastTemp: 0,
          lastMotion: false,
          online: true,
        }));
    } catch (e) {
      console.error('[mDNS] discovery failed', e);
      return [];
    }
  }, []);

  // --- IP subnet scan (only the device's own subnet) ---
  const getLocalSubnet = useCallback(() => {
    // Get the current IP of the device (WebRTC trick)
    return new Promise<string>((resolve) => {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      pc.createOffer().then((offer) => pc.setLocalDescription(offer));
      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate || !ice.candidate.candidate) return;
        const ipRegex = /([0-9]{1,3}\.){3}[0-9]{1,3}/;
        const match = ice.candidate.candidate.match(ipRegex);
        if (match) {
          resolve(match[0]);
          pc.close();
        }
      };
      setTimeout(() => resolve(''), 2000); // fallback if WebRTC fails
    });
  }, []);

  const scanSubnet = useCallback(async (subnetBase: string) => {
    const promises: Promise<SensorInfo | null>[] = [];
    for (let i = 1; i <= 254; i++) {
      const ip = `${subnetBase}.${i}`;
      promises.push(
        (async () => {
          try {
            const resp = await fetch(`http://${ip}/`, { mode: 'cors', signal: AbortSignal.timeout(800) });
            const json = await resp.json();
            return {
              id: json.id,
              name: json.name,
              hostname: json.hostname || '',
              ip,
              lastLux: json.lux || 0,
              lastTemp: json.temp || 0,
              lastMotion: json.motion || false,
              online: true,
            };
          } catch {
            return null;
          }
        })()
      );
      // limit parallelism
      if (i % MAX_SCAN_PARALLEL === 0) await new Promise(r => setTimeout(r, 100));
    }
    const results = await Promise.all(promises);
    return results.filter((s): s is SensorInfo => s !== null);
  }, []);

  const discoverAll = useCallback(async () => {
    if (scanningRef.current) return;
    scanningRef.current = true;

    let found: SensorInfo[] = [];
    // 1. Try mDNS first
    found = await discoverMdns();
    if (found.length === 0) {
      // 2. Fallback to IP scan on local subnet
      const localIP = await getLocalSubnet();
      if (localIP) {
        const subnet = localIP.substring(0, localIP.lastIndexOf('.'));
        found = await scanSubnet(subnet);
      }
    }

    // 3. Merge with previously stored IPs (from localStorage)
    const storedIPs = JSON.parse(localStorage.getItem('sensor_ips') || '[]') as string[];
    const existingIPs = sensors.map(s => s.ip);
    const newIPs = found.map(s => s.ip).filter(ip => !existingIPs.includes(ip));
    const allIPs = [...new Set([...storedIPs, ...newIPs])];
    localStorage.setItem('sensor_ips', JSON.stringify(allIPs));

    setSensors(prev => {
      const map = new Map(prev.map(s => [s.id, s]));
      found.forEach(s => {
        const existing = map.get(s.id);
        if (existing) {
          // update IP/hostname but keep last readings
          existing.ip = s.ip || existing.ip;
          existing.hostname = s.hostname || existing.hostname;
          existing.name = s.name || existing.name;
          existing.online = true;
        } else {
          map.set(s.id, s);
        }
      });
      return Array.from(map.values());
    });
    scanningRef.current = false;
  }, [discoverMdns, getLocalSubnet, scanSubnet, sensors]);

  // --- Polling online sensors for fresh data ---
  const pollSensors = useCallback(async () => {
    const updated = await Promise.all(
      sensors.map(async (sensor) => {
        let url = '';
        if (sensor.hostname) {
          url = `http://${sensor.hostname}.local/`;
        } else if (sensor.ip) {
          url = `http://${sensor.ip}/`;
        } else {
          return { ...sensor, online: false };
        }
        try {
          const resp = await fetch(url, { mode: 'cors', signal: AbortSignal.timeout(1500) });
          const json = await resp.json();
          return {
            ...sensor,
            lastLux: json.lux || 0,
            lastTemp: json.temp || 0,
            lastMotion: json.motion || false,
            online: true,
          };
        } catch {
          return { ...sensor, online: false };
        }
      })
    );
    setSensors(updated);
  }, [sensors]);

  // Start discovery once on mount, then poll at interval
  useEffect(() => {
    discoverAll();
    const interval = setInterval(pollSensors, SENSOR_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { sensors, refresh: discoverAll };
}

/* ------------------------------------------------------------------ */
/*  Weather & Location Hook                                            */
/* ------------------------------------------------------------------ */
function useWeather() {
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [city, setCity] = useState<string>('Unknown location');
  const [temperature, setTemperature] = useState<number | null>(null);
  const [condition, setCondition] = useState<string>('');
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Load saved city from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('weather_city');
    if (saved) setCity(saved);
  }, []);

  const requestLocationPermission = useCallback(async (): Promise<GeolocationPosition | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      // Check permission state
      navigator.permissions.query({ name: 'geolocation' }).then((perm) => {
        if (perm.state === 'denied') {
          setPermissionDenied(true);
          resolve(null);
          return;
        }
        // Trigger the permission prompt by requesting position
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setPermissionDenied(false);
            resolve(pos);
          },
          (err) => {
            console.error('[Location] error:', err);
            if (err.code === err.PERMISSION_DENIED) {
              setPermissionDenied(true);
            }
            resolve(null);
          },
          { timeout: LOCATION_TIMEOUT, enableHighAccuracy: false }
        );
      });
    });
  }, []);

  const fetchWeather = useCallback(async () => {
    if (!weatherEnabled) return;
    const pos = await requestLocationPermission();
    if (!pos) {
      // Use cached city or "Unknown"
      setTemperature(null);
      setCondition('');
      return;
    }
    try {
      // Reverse geocode
      const { latitude, longitude } = pos.coords;
      const geoResp = await fetch(
        `${BIGDATACLOUD_REVERSE_URL}?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
      );
      const geoData = await geoResp.json();
      const newCity = geoData.city || geoData.locality || 'Unknown location';
      setCity(newCity);
      localStorage.setItem('weather_city', newCity);

      // Weather (Open-Meteo, no API key needed)
      const weatherResp = await fetch(
        `${WEATHER_API_URL}?latitude=${latitude}&longitude=${longitude}&current_weather=true`
      );
      const weatherData = await weatherResp.json();
      setTemperature(weatherData.current_weather?.temperature ?? null);
      setCondition(weatherData.current_weather?.weathercode ?? '');
    } catch (e) {
      console.error('[Weather] fetch failed', e);
      setTemperature(null);
    }
  }, [weatherEnabled, requestLocationPermission]);

  // Toggle weather – request permission when enabling
  const toggleWeather = useCallback(() => {
    setWeatherEnabled((prev) => {
      const next = !prev;
      if (next) {
        fetchWeather(); // will trigger permission prompt if needed
      } else {
        setTemperature(null);
        setCondition('');
      }
      return next;
    });
  }, [fetchWeather]);

  // Refresh weather every 15 minutes
  useEffect(() => {
    if (!weatherEnabled) return;
    fetchWeather();
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [weatherEnabled, fetchWeather]);

  return { weatherEnabled, toggleWeather, city, temperature, condition, permissionDenied };
}

/* ------------------------------------------------------------------ */
/*  Google Photos Hook (simplified – auth handled by server)           */
/* ------------------------------------------------------------------ */
function usePhotos() {
  const [photos, setPhotos] = useState<string[]>([]);
  const [authUrl, setAuthUrl] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const fetchPhotos = useCallback(async () => {
    try {
      const resp = await fetch('/api/photos');
      if (resp.status === 401) {
        const data = await resp.json();
        setAuthUrl(data.authUrl);
        setIsAuthenticated(false);
        return;
      }
      const data = await resp.json();
      setPhotos(data.photos || []);
      setIsAuthenticated(true);
    } catch (e) {
      console.error('[Photos] fetch error', e);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const resp = await fetch('/api/check-auth');
      if (resp.ok) {
        setIsAuthenticated(true);
        fetchPhotos();
      } else {
        const data = await resp.json();
        setAuthUrl(data.authUrl);
        setIsAuthenticated(false);
      }
    } catch { /* ignore */ }
  }, [fetchPhotos]);

  useEffect(() => {
    checkAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { photos, authUrl, isAuthenticated };
}

/* ------------------------------------------------------------------ */
/*  Profiles & Ambient Modes Hook                                      */
/* ------------------------------------------------------------------ */
type Profile = 'clock' | 'weather' | 'sensor' | 'photos';

function useProfiles() {
  const [activeProfile, setActiveProfile] = useState<Profile>('clock');

  // Save to localStorage
  useEffect(() => {
    const saved = localStorage.getItem('active_profile') as Profile;
    if (saved) setActiveProfile(saved);
  }, []);

  const switchProfile = (p: Profile) => {
    setActiveProfile(p);
    localStorage.setItem('active_profile', p);
  };

  return { activeProfile, switchProfile };
}

/* ------------------------------------------------------------------ */
/*  Main App Component                                                 */
/* ------------------------------------------------------------------ */
export default function App() {
  const { sensors, refresh: refreshSensors } = useSensors();
  const { weatherEnabled, toggleWeather, city, temperature, condition, permissionDenied } = useWeather();
  const { photos, authUrl, isAuthenticated } = usePhotos();
  const { activeProfile, switchProfile } = useProfiles();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Auto-refresh is handled inside hooks

  // Keyboard / remote navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', fontFamily: 'sans-serif' }}>
      {/* Ambient background */}
      <AnimatePresence mode="wait">
        {activeProfile === 'clock' && (
          <motion.div key="clock" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClockDisplay />
          </motion.div>
        )}
        {activeProfile === 'weather' && (
          <motion.div key="weather" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <WeatherDisplay city={city} temperature={temperature} condition={condition} enabled={weatherEnabled} />
          </motion.div>
        )}
        {activeProfile === 'sensor' && (
          <motion.div key="sensor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0 }}>
            <SensorDashboard sensors={sensors} onRefresh={refreshSensors} />
          </motion.div>
        )}
        {activeProfile === 'photos' && (
          <motion.div key="photos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0 }}>
            <PhotosSlideshow photos={photos} authUrl={authUrl} isAuthenticated={isAuthenticated} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            style={{
              position: 'absolute', top: 0, right: 0, width: 320, height: '100%',
              background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
              padding: 30, display: 'flex', flexDirection: 'column', gap: 20,
              zIndex: 100
            }}>
            <button onClick={() => setSidebarOpen(false)} style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: 'white', fontSize: 24 }}>✕</button>
            <h2 style={{ color: '#D4CDA4', textTransform: 'uppercase', letterSpacing: '0.2em', margin: 0 }}>Settings</h2>
            <button onClick={() => switchProfile('clock')} style={buttonStyle(activeProfile === 'clock')}>🕒 Clock</button>
            <button onClick={() => switchProfile('weather')} style={buttonStyle(activeProfile === 'weather')}>🌤️ Weather</button>
            <button onClick={() => switchProfile('sensor')} style={buttonStyle(activeProfile === 'sensor')}>📊 Sensors</button>
            <button onClick={() => switchProfile('photos')} style={buttonStyle(activeProfile === 'photos')}>📷 Photos</button>
            {activeProfile === 'weather' && (
              <div style={{ color: '#EAE6DA', fontSize: 14 }}>
                <label>
                  <input type="checkbox" checked={weatherEnabled} onChange={toggleWeather} />
                  {' '}Enable weather
                </label>
                {permissionDenied && <div style={{ color: '#e06c75', marginTop: 8 }}>Location permission denied. Weather won't update.</div>}
              </div>
            )}
            {activeProfile === 'sensor' && (
              <button onClick={refreshSensors} style={{ ...buttonStyle(false), marginTop: 10 }}>🔄 Rediscover sensors</button>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Floating settings button (TV remote friendly) */}
      <button
        onClick={() => setSidebarOpen(true)}
        style={{
          position: 'absolute', bottom: 20, right: 20, zIndex: 50,
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)',
          color: 'white', padding: '10px 15px', borderRadius: 8, cursor: 'pointer', fontSize: 18
        }}>⚙️</button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components (pure presentational)                               */
/* ------------------------------------------------------------------ */

function ClockDisplay() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ color: 'white', textAlign: 'center' }}>
      <div style={{ fontSize: 120, fontWeight: 200, letterSpacing: '0.1em' }}>
        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div style={{ fontSize: 30, opacity: 0.7 }}>
        {time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
      </div>
    </div>
  );
}

function WeatherDisplay({ city, temperature, condition, enabled }: { city: string, temperature: number | null, condition: string, enabled: boolean }) {
  if (!enabled) return <div style={{ color: '#aaa' }}>Weather is disabled</div>;
  return (
    <div style={{ color: 'white', textAlign: 'center' }}>
      <div style={{ fontSize: 24, opacity: 0.7, marginBottom: 10 }}>{city}</div>
      {temperature !== null ? (
        <>
          <div style={{ fontSize: 80, fontWeight: 200 }}>{temperature}°C</div>
          <div style={{ fontSize: 20 }}>{condition}</div>
        </>
      ) : (
        <div style={{ fontSize: 30 }}>Loading weather...</div>
      )}
    </div>
  );
}

function SensorDashboard({ sensors, onRefresh }: { sensors: SensorInfo[], onRefresh: () => void }) {
  if (sensors.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'white' }}>
        <p>No sensors found.</p>
        <button onClick={onRefresh} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', padding: 10, borderRadius: 8 }}>Scan again</button>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 30, padding: 40 }}>
      {sensors.map(s => (
        <div key={s.id} style={{
          background: 'rgba(0,0,0,0.6)', padding: 20, borderRadius: 16,
          width: 250, color: 'white', textAlign: 'center', border: s.online ? '1px solid #A3B18A' : '1px solid #555'
        }}>
          <h3 style={{ margin: 0, fontSize: 20 }}>{s.name}</h3>
          <div style={{ fontSize: 14, opacity: 0.6 }}>{s.online ? 'Online' : 'Offline'}</div>
          <div style={{ marginTop: 10, fontSize: 36 }}>{s.lastLux}<span style={{ fontSize: 16, opacity: 0.5 }}> lux</span></div>
          <div>{s.lastTemp} K</div>
          <div>Motion: {s.lastMotion ? 'Detected' : 'None'}</div>
        </div>
      ))}
    </div>
  );
}

function PhotosSlideshow({ photos, authUrl, isAuthenticated }: { photos: string[], authUrl: string, isAuthenticated: boolean }) {
  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'white' }}>
        <p>Connect Google Photos to see your memories</p>
        {authUrl && (
          <a href={authUrl} style={{
            background: '#4285F4', color: 'white', padding: '10px 20px', borderRadius: 8, textDecoration: 'none', marginTop: 10
          }}>Sign in with Google</a>
        )}
      </div>
    );
  }
  if (photos.length === 0) {
    return <div style={{ color: '#aaa', textAlign: 'center', paddingTop: '40vh' }}>No photos loaded</div>;
  }
  // Simple slideshow – just display the first photo for now
  return (
    <div style={{ width: '100%', height: '100%', background: 'black' }}>
      <img src={photos[0]} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Memory" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper styles                                                      */
/* ------------------------------------------------------------------ */
function buttonStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? 'rgba(212, 205, 164, 0.2)' : 'transparent',
    border: active ? '1px solid #D4CDA4' : '1px solid rgba(255,255,255,0.2)',
    color: active ? '#D4CDA4' : '#fff',
    padding: '12px 16px',
    borderRadius: 8,
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: 16,
    transition: 'all 0.2s',
    width: '100%',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  };
}
