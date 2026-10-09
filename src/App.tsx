import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Volume2,
  VolumeX,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sun,
  Disc,
  Globe,
  Sparkles,
  Info,
  Layers,
  Crosshair,
  Activity,
  Compass,
  Radio,
  Lock,
  Unlock,
  Sliders,
  Video,
  Flame,
  Menu,
  X,
  Target,
  Zap,
} from 'lucide-react';
import { SpacetimeEngine } from './simulation/SpacetimeEngine';
import { SIMULATION_PRESETS } from './simulation/presets';
import { BodyType } from './simulation/types';

export default function App() {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SpacetimeEngine | null>(null);

  // Simulation State
  const [isAudioActive, setIsAudioActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [G, setG] = useState(1.0);
  const [deformationScale, setDeformationScale] = useState(1.0);
  const [timeScale, setTimeScale] = useState(1.0);
  const [softening, setSoftening] = useState(1.5);
  const [showTrails, setShowTrails] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [bodyOnWell, setBodyOnWell] = useState(true);
  const [showGravitationalWaves, setShowGravitationalWaves] = useState(true);
  const [waveIntensity, setWaveIntensity] = useState(1.0);
  const [bloomEnabled, setBloomEnabled] = useState(false);
  const [bloomStrength, setBloomStrength] = useState(1.35);
  const [relativisticEnabled, setRelativisticEnabled] = useState(true);
  const [speedOfLight, setSpeedOfLight] = useState(42);
  const [satelliteAssist, setSatelliteAssist] = useState(true);

  // Placement Mode & Mobile Touch Launcher Mode
  const [selectedType, setSelectedType] = useState<BodyType>('planet');
  const [isFixedNew, setIsFixedNew] = useState(false);
  const [isLauncherMode, setIsLauncherMode] = useState(false);
  const [launchFeedbackMsg, setLaunchFeedbackMsg] = useState<string | null>(null);

  // Device & Responsive State
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<'launcher' | 'physics' | 'presets' | 'telemetry' | 'bodies'>('launcher');

  // Accordion open/close states (for collapsible sections - minimized by default)
  const [accordionState, setAccordionState] = useState<{ [key: string]: boolean }>({
    launcher: false,
    physics: false,
    presets: false,
    telemetry: false,
    bodies: false,
  });

  // UI Panels (Desktop - minimized by default)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHudOpen, setIsHudOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'launcher' | 'physics' | 'presets' | 'bodies'>('launcher');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('kepler-orbit');
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Telemetry
  const [telemetry, setTelemetry] = useState({
    activeBodies: 0,
    fps: 60,
    kineticEnergy: 0,
    potentialEnergy: 0,
    totalEnergy: 0,
    waveStrain: 0,
    activeBursts: 0,
  });
  const [activeBodyList, setActiveBodyList] = useState<
    Array<{ id: string; name: string; type: BodyType; mass: number; speed: number; isFixed: boolean }>
  >([]);
  const [selectedBodyId, setSelectedBodyId] = useState<string | null>(null);
  const [editingMassInput, setEditingMassInput] = useState<{ [id: string]: string }>({});
  const [isCinematicCamera, setIsCinematicCamera] = useState(false);
  const [cameraView, setCameraView] = useState<'free' | 'top' | 'side' | 'isometric' | 'cinematic'>('free');

  // Track window resize & orientation changes
  useEffect(() => {
    const checkViewport = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (engineRef.current) {
        engineRef.current.onWindowResize();
      }
    };
    window.addEventListener('resize', checkViewport);
    window.addEventListener('orientationchange', checkViewport);
    return () => {
      window.removeEventListener('resize', checkViewport);
      window.removeEventListener('orientationchange', checkViewport);
    };
  }, []);

  // Initialize Spacetime Engine
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const engine = new SpacetimeEngine(canvasContainerRef.current);
    engineRef.current = engine;

    const mobileDevice = window.innerWidth < 768;
    // On mobile: start in Camera Navigation mode so user can freely rotate scene with 1 finger and zoom with 2
    // On desktop: enable launcher mode by default
    const initialLauncher = !mobileDevice;
    setIsLauncherMode(initialLauncher);
    engine.placementMode = initialLauncher;
    engine.placementType = 'planet';

    // Body selection from 3D scene
    engine.onBodySelected = (id) => {
      setSelectedBodyId(id);
      if (id) {
        setActiveTab('bodies');
        setMobileActiveTab('bodies');
      }
    };

    // Callback when body is launched
    engine.onBodySpawned = () => {
      setLaunchFeedbackMsg('¡Cuerpo lanzado a la órbita!');
      setTimeout(() => setLaunchFeedbackMsg(null), 2500);
    };

    // Cinematic camera callback
    engine.onCinematicCameraChange = (active) => {
      setIsCinematicCamera(active);
      if (active) setCameraView('cinematic');
    };

    // Telemetry callback
    engine.onStatsUpdate = (stats) => {
      setTelemetry({
        activeBodies: stats.activeBodies,
        fps: stats.fps,
        kineticEnergy: stats.kineticEnergy,
        potentialEnergy: stats.potentialEnergy,
        totalEnergy: stats.totalEnergy,
        waveStrain: stats.waveStrain,
        activeBursts: stats.activeBursts,
      });

      // Update body list for inspector
      setActiveBodyList(
        engine.bodies.map((b) => ({
          id: b.id,
          name: b.name,
          type: b.type,
          mass: Number(b.mass.toFixed(1)),
          speed: Number(b.velocity.length().toFixed(2)),
          isFixed: b.isFixed,
        }))
      );
    };

    // Load initial preset (Kepler Orbit)
    const initialPreset = SIMULATION_PRESETS[0];
    engine.loadPreset(initialPreset.bodies, initialPreset.defaultConfig);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (engineRef.current) {
          const next = !engineRef.current.config.isPaused;
          engineRef.current.config.isPaused = next;
          setIsPaused(next);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Sync state changes with engine
  const handleTogglePause = () => {
    if (!engineRef.current) return;
    const next = !isPaused;
    setIsPaused(next);
    engineRef.current.config.isPaused = next;
  };

  const handleStepOnce = () => {
    if (!engineRef.current) return;
    engineRef.current.config.isPaused = false;
    setTimeout(() => {
      if (engineRef.current) engineRef.current.config.isPaused = true;
    }, 45);
  };

  const handleClear = () => {
    if (!engineRef.current) return;
    engineRef.current.clearAllBodies();
    setActiveBodyList([]);
    setTelemetry((prev) => ({
      ...prev,
      bodyCount: 0,
      totalEnergy: 0,
      gravitationalWaveDetected: false,
    }));
  };

  const handleGChange = (val: number) => {
    setG(val);
    if (engineRef.current) engineRef.current.config.G = val;
  };

  const handleDeformationChange = (val: number) => {
    setDeformationScale(val);
    if (engineRef.current) engineRef.current.config.deformationScale = val;
  };

  const handleTimeScaleChange = (val: number) => {
    setTimeScale(val);
    if (engineRef.current) engineRef.current.config.timeScale = val;
  };

  const handleSofteningChange = (val: number) => {
    setSoftening(val);
    if (engineRef.current) engineRef.current.config.softening = val;
  };

  const handleToggleTrails = () => {
    const next = !showTrails;
    setShowTrails(next);
    if (engineRef.current) engineRef.current.config.showTrails = next;
  };

  const handleToggleGrid = () => {
    const next = !showGrid;
    setShowGrid(next);
    if (engineRef.current) {
      engineRef.current.setGridVisible(next);
    }
  };

  const handleToggleWellDepth = () => {
    const next = !bodyOnWell;
    setBodyOnWell(next);
    if (engineRef.current) engineRef.current.config.bodyOnWell = next;
  };

  const handleToggleWaves = () => {
    const next = !showGravitationalWaves;
    setShowGravitationalWaves(next);
    if (engineRef.current) engineRef.current.config.showGravitationalWaves = next;
  };

  const handleWaveIntensityChange = (val: number) => {
    setWaveIntensity(val);
    if (engineRef.current) engineRef.current.config.waveIntensity = val;
  };

  const handleTriggerPulse = () => {
    if (engineRef.current) {
      engineRef.current.triggerGravitationalBurst(0, 0, 4.2 * waveIntensity);
    }
  };

  const handleToggleBloom = () => {
    const next = !bloomEnabled;
    setBloomEnabled(next);
    if (engineRef.current) {
      engineRef.current.setBloom(next);
    }
  };

  const handleBloomStrengthChange = (val: number) => {
    setBloomStrength(val);
    if (engineRef.current) {
      engineRef.current.setBloom(bloomEnabled, val);
    }
  };

  const handleToggleRelativistic = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setRelativisticEnabled(val);
    if (engineRef.current) {
      engineRef.current.config.relativisticEnabled = val;
    }
  };

  const handleSpeedOfLightChange = (val: number) => {
    setSpeedOfLight(val);
    if (engineRef.current) {
      engineRef.current.config.speedOfLight = val;
    }
  };

  const handleToggleSatelliteAssist = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setSatelliteAssist(val);
    if (engineRef.current) {
      engineRef.current.config.satelliteAssist = val;
    }
  };

  const handleTypeSelect = (type: BodyType) => {
    setSelectedType(type);
    if (engineRef.current) {
      engineRef.current.placementType = type;
      // Auto-activate launcher mode when a user explicitly taps a celestial body to launch
      engineRef.current.setPlacementMode(true);
      setIsLauncherMode(true);
    }
  };

  const handleToggleLauncherMode = (forceState?: boolean) => {
    const next = typeof forceState === 'boolean' ? forceState : !isLauncherMode;
    setIsLauncherMode(next);
    if (engineRef.current) {
      engineRef.current.setPlacementMode(next);
    }
  };

  const handleFixedToggle = (fixed: boolean) => {
    setIsFixedNew(fixed);
    if (engineRef.current) engineRef.current.placementFixed = fixed;
  };

  const handleLoadPreset = (presetId: string) => {
    const preset = SIMULATION_PRESETS.find((p) => p.id === presetId);
    if (!preset || !engineRef.current) return;

    setSelectedPresetId(presetId);
    engineRef.current.loadPreset(preset.bodies, preset.defaultConfig);

    if (preset.defaultConfig?.G !== undefined) setG(preset.defaultConfig.G);
    if (preset.defaultConfig?.deformationScale !== undefined) setDeformationScale(preset.defaultConfig.deformationScale);
    if (preset.defaultConfig?.timeScale !== undefined) setTimeScale(preset.defaultConfig.timeScale);
    if (preset.defaultConfig?.softening !== undefined) setSoftening(preset.defaultConfig.softening);
    if (preset.defaultConfig?.relativisticEnabled !== undefined) setRelativisticEnabled(preset.defaultConfig.relativisticEnabled);
    if (preset.defaultConfig?.speedOfLight !== undefined) setSpeedOfLight(preset.defaultConfig.speedOfLight);
    if (preset.defaultConfig?.satelliteAssist !== undefined) setSatelliteAssist(preset.defaultConfig.satelliteAssist);
    setIsPaused(false);
  };

  const handleToggleCinematic = () => {
    const next = !isCinematicCamera;
    setIsCinematicCamera(next);
    setCameraView(next ? 'cinematic' : 'free');
    if (engineRef.current) engineRef.current.setCameraView(next ? 'cinematic' : 'free');
  };

  const handleTrackBody = (id: string) => {
    if (engineRef.current) {
      engineRef.current.trackedBodyId = engineRef.current.trackedBodyId === id ? null : id;
    }
  };

  const handleSelectBody = (id: string) => {
    const nextId = selectedBodyId === id ? null : id;
    setSelectedBodyId(nextId);
    if (engineRef.current) {
      engineRef.current.selectBody(nextId);
    }
  };

  const handleBodyMassChange = (id: string, newMass: number) => {
    if (isNaN(newMass) || newMass <= 0) return;
    if (engineRef.current) {
      engineRef.current.setBodyMass(id, newMass);
      setActiveBodyList(
        engineRef.current.bodies.map((b) => ({
          id: b.id,
          name: b.name,
          type: b.type,
          mass: Number(b.mass.toFixed(1)),
          speed: Number(b.velocity.length().toFixed(2)),
          isFixed: b.isFixed,
        }))
      );
    }
  };

  const handleToggleBodyFixed = (id: string) => {
    if (engineRef.current) {
      const b = engineRef.current.bodies.find((item) => item.id === id);
      if (b) {
        const nextFixed = !b.isFixed;
        engineRef.current.setBodyFixed(id, nextFixed);
        setActiveBodyList(
          engineRef.current.bodies.map((item) => ({
            id: item.id,
            name: item.name,
            type: item.type,
            mass: Number(item.mass.toFixed(1)),
            speed: Number(item.velocity.length().toFixed(2)),
            isFixed: item.isFixed,
          }))
        );
      }
    }
  };

  const handleDeleteBody = (id: string) => {
    if (engineRef.current) {
      engineRef.current.removeBody(id);
      if (selectedBodyId === id) setSelectedBodyId(null);
    }
  };

  const handleToggleAudio = () => {
    if (engineRef.current) {
      const active = engineRef.current.audio.toggle();
      setIsAudioActive(active);
    }
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const toggleAccordion = (sectionKey: string) => {
    setAccordionState((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  // Celestial Body Name helper
  const getBodyLabel = (type: BodyType) => {
    switch (type) {
      case 'star':
        return 'Sol';
      case 'planet':
        return 'Tierra';
      case 'giant':
        return 'Júpiter';
      case 'blackhole':
        return 'Agujero Negro';
      case 'asteroid':
        return 'Asteroide';
      case 'moon':
        return 'Luna';
    }
  };

  // ==========================================
  // MODULAR SECTION RENDERERS (REUSED DESKTOP & MOBILE)
  // ==========================================

  // 1. LANZADOR & OBJETOS
  const renderLauncherSection = () => (
    <div className="space-y-4">
      {/* Botón de alternar modo Lanzador vs Cámara */}
      <div className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-xs text-cyan-200">Modo de Interacción</span>
          </div>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
              isLauncherMode
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/40'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {isLauncherMode ? 'LANZADOR ACTIVO' : 'CÁMARA / NAVEGACIÓN'}
          </span>
        </div>

        <button
          onClick={() => handleToggleLauncherMode()}
          className={`w-full min-h-[44px] py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
            isLauncherMode
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_14px_rgba(6,182,212,0.3)]'
              : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
          }`}
        >
          {isLauncherMode ? (
            <>
              <Crosshair className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>🎯 Lanzador Activo: Toca y arrastra para lanzar</span>
            </>
          ) : (
            <>
              <Compass className="w-4 h-4 text-slate-400" />
              <span>🖐️ Navegación Cámara (Toca para activar Lanzador)</span>
            </>
          )}
        </button>

        <p className="text-[11px] text-slate-300 leading-relaxed">
          {isLauncherMode
            ? 'Arrastra con un dedo/ratón para dibujar la velocidad tangencial y suelta para lanzar el objeto en órbita.'
            : 'Un dedo rota la vista en 3D, dos dedos pellizcan para hacer zoom.'}
        </p>
      </div>

      {/* Selector de Cuerpos Celestes */}
      <div>
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
          Selección del Cuerpo Celeste a Lanzar
        </label>
        <div className="grid grid-cols-2 gap-2">
          {/* Sol */}
          <button
            onClick={() => handleTypeSelect('star')}
            className={`min-h-[48px] p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
              selectedType === 'star'
                ? 'bg-amber-950/60 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/30'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-amber-500/30 hover:text-amber-300'
            }`}
          >
            <Sun className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="font-semibold text-xs">☀️ Sol / Estrella</div>
              <div className="text-[10px] text-slate-400 font-mono">M: 1000u (Masiva)</div>
            </div>
          </button>

          {/* Tierra */}
          <button
            onClick={() => handleTypeSelect('planet')}
            className={`min-h-[48px] p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
              selectedType === 'planet'
                ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/30'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-cyan-500/30 hover:text-cyan-300'
            }`}
          >
            <Globe className="w-5 h-5 text-cyan-400 shrink-0" />
            <div>
              <div className="font-semibold text-xs">🌍 Tierra</div>
              <div className="text-[10px] text-slate-400 font-mono">M: 20u (Rocoso)</div>
            </div>
          </button>

          {/* Júpiter */}
          <button
            onClick={() => handleTypeSelect('giant')}
            className={`min-h-[48px] p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
              selectedType === 'giant'
                ? 'bg-indigo-950/60 border-indigo-400 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.25)] ring-1 ring-indigo-400/30'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-indigo-500/30 hover:text-indigo-300'
            }`}
          >
            <Disc className="w-5 h-5 text-indigo-400 shrink-0" />
            <div>
              <div className="font-semibold text-xs">🪐 Júpiter</div>
              <div className="text-[10px] text-slate-400 font-mono">M: 80u (Gigante)</div>
            </div>
          </button>

          {/* Agujero Negro */}
          <button
            onClick={() => handleTypeSelect('blackhole')}
            className={`min-h-[48px] p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
              selectedType === 'blackhole'
                ? 'bg-purple-950/60 border-purple-400 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.25)] ring-1 ring-purple-400/30'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-purple-500/30 hover:text-purple-300'
            }`}
          >
            <Disc className="w-5 h-5 text-purple-400 shrink-0" />
            <div>
              <div className="font-semibold text-xs">🕳️ Agujero Negro</div>
              <div className="text-[10px] text-slate-400 font-mono">M: 2800u (Singularidad)</div>
            </div>
          </button>

          {/* Asteroide */}
          <button
            onClick={() => handleTypeSelect('asteroid')}
            className={`min-h-[48px] p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
              selectedType === 'asteroid'
                ? 'bg-slate-800 border-slate-400 text-slate-100 shadow-[0_0_12px_rgba(148,163,184,0.25)] ring-1 ring-slate-400/30'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-300'
            }`}
          >
            <Sparkles className="w-5 h-5 text-slate-400 shrink-0" />
            <div>
              <div className="font-semibold text-xs">☄️ Asteroide</div>
              <div className="text-[10px] text-slate-400 font-mono">M: 0.2u (Ligero)</div>
            </div>
          </button>

          {/* Luna */}
          <button
            onClick={() => handleTypeSelect('moon')}
            className={`min-h-[48px] p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
              selectedType === 'moon'
                ? 'bg-slate-800 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/30'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-300'
            }`}
          >
            <Disc className="w-5 h-5 text-slate-300 shrink-0" />
            <div>
              <div className="font-semibold text-xs">🛰️ Luna</div>
              <div className="text-[10px] text-slate-400 font-mono">M: 4u (Satélite)</div>
            </div>
          </button>
        </div>
      </div>

      {/* Modo de anclaje (Cuerpo fijo) */}
      <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
        <label className="flex items-center justify-between cursor-pointer min-h-[36px]">
          <div className="flex items-center gap-2">
            {isFixedNew ? <Lock className="w-4 h-4 text-amber-400" /> : <Unlock className="w-4 h-4 text-slate-400" />}
            <div>
              <div className="text-xs font-semibold text-slate-200">Anclar en Posición Fija</div>
              <div className="text-[10px] text-slate-400">
                {isFixedNew ? 'La masa permanecerá estática en el espacio' : 'La masa acelerará libremente bajo la gravedad'}
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={isFixedNew}
            onChange={(e) => handleFixedToggle(e.target.checked)}
            className="w-5 h-5 rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
          />
        </label>
      </div>

      {/* Asistente de Lanzamiento Relativo (Lunas / Satélites) */}
      <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
        <label className="flex items-center justify-between cursor-pointer min-h-[36px]">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-xs font-semibold text-slate-200">Asistente Lunar / Orbital</div>
              <div className="text-[10px] text-slate-400">
                Hereda la velocidad del planeta anfitrión para colocar satélites en órbita estable
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={satelliteAssist}
            onChange={handleToggleSatelliteAssist}
            className="w-5 h-5 rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
          />
        </label>
      </div>
    </div>
  );

  // 2. FÍSICA & MALLA ESPACIOTEMPORAL
  const renderPhysicsSection = () => (
    <div className="space-y-4">
      {/* Botón Principal Destacado: Mostrar / Ocultar Malla Espaciotemporal */}
      <button
        onClick={handleToggleGrid}
        className={`w-full min-h-[48px] py-2.5 px-3.5 rounded-2xl border flex items-center justify-between transition-all ${
          showGrid
            ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200 shadow-[0_0_16px_rgba(6,182,212,0.3)]'
            : 'bg-slate-900/90 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
        }`}
        title="Alternar visibilidad del grid espaciotemporal"
      >
        <div className="flex items-center gap-3 text-left">
          <span className="text-xl">🌐</span>
          <div>
            <div className="font-semibold text-xs flex items-center gap-2">
              <span>Grid Espaciotemporal</span>
              <span
                className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold ${
                  showGrid
                    ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {showGrid ? 'VISIBLE' : 'OCULTO'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              {showGrid ? 'Hacer clic para ocultar cuadrícula' : 'Hacer clic para mostrar cuadrícula'}
            </div>
          </div>
        </div>

        {/* Toggle Switch Visual */}
        <div
          className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${
            showGrid ? 'bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.6)]' : 'bg-slate-700'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
              showGrid ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </div>
      </button>

      {/* Sliders Principales */}
      <div className="space-y-3.5">
        {/* Constante G */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-medium">Constante Gravitacional (G)</span>
            <span className="font-mono text-cyan-300 font-bold">{G.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="3.0"
            step="0.05"
            value={G}
            onChange={(e) => handleGChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Deformación de Malla */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-medium">Deformación Malla Espaciotiempo</span>
            <span className="font-mono text-cyan-300 font-bold">{deformationScale.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="2.5"
            step="0.05"
            value={deformationScale}
            onChange={(e) => handleDeformationChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Velocidad Temporal */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-medium">Velocidad Temporal (Time Scale)</span>
            <span className="font-mono text-cyan-300 font-bold">{timeScale.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="2.5"
            step="0.05"
            value={timeScale}
            onChange={(e) => handleTimeScaleChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Amortiguador Softening */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-medium">Amortiguador Singularidad (ε)</span>
            <span className="font-mono text-cyan-300 font-bold">{softening.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="4.0"
            step="0.1"
            value={softening}
            onChange={(e) => handleSofteningChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </div>

      {/* ⚡ Dinámica Relativista 1PN (Geodésicas & Corrección Post-Newtoniana) */}
      <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
        <label className="flex items-center justify-between cursor-pointer py-1 min-h-[36px]">
          <span className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-violet-400" />
            Efectos Relativistas (1PN / Covariante)
          </span>
          <input
            type="checkbox"
            checked={relativisticEnabled}
            onChange={handleToggleRelativistic}
            className="w-5 h-5 rounded bg-slate-800 border-slate-700 text-violet-500 focus:ring-0 cursor-pointer"
          />
        </label>

        {relativisticEnabled && (
          <div className="space-y-1.5 pl-0.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium">Velocidad de la Luz (c)</span>
              <span className="font-mono text-violet-300 font-bold">{speedOfLight} u/s</span>
            </div>
            <input
              type="range"
              min="15"
              max="120"
              step="1"
              value={speedOfLight}
              onChange={(e) => handleSpeedOfLightChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-400"
            />
            <div className="text-[10px] text-slate-400 bg-violet-950/20 border border-violet-500/20 rounded-lg p-2 leading-relaxed">
              Geodésicas Schwarzschild: produce la <strong>precesión del perihelio</strong> (avance orbital tipo roseta). Disminuye <em>c</em> para acentuar el efecto de forma didáctica.
            </div>
          </div>
        )}
      </div>

      {/* Switches de Visualización */}
      <div className="pt-3 border-t border-slate-800/80 space-y-2">
        <label className="flex items-center justify-between cursor-pointer py-1.5 min-h-[36px]">
          <span className="text-slate-300 text-xs font-medium">Estelas Orbitales (Trayectorias)</span>
          <input
            type="checkbox"
            checked={showTrails}
            onChange={handleToggleTrails}
            className="w-5 h-5 rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer py-1.5 min-h-[36px]">
          <span className="text-slate-300 text-xs font-medium">Hundir Cuerpos en el Pozo</span>
          <input
            type="checkbox"
            checked={bodyOnWell}
            onChange={handleToggleWellDepth}
            className="w-5 h-5 rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
          />
        </label>
      </div>

      {/* Ondas Gravitacionales */}
      <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between min-h-[36px]">
          <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-cyan-400" />
            Ondas Gravitacionales
          </span>
          <input
            type="checkbox"
            checked={showGravitationalWaves}
            onChange={handleToggleWaves}
            className="w-5 h-5 rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Intensidad de Ondas</span>
            <span className="font-mono text-cyan-300">{waveIntensity.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="2.5"
            step="0.1"
            value={waveIntensity}
            disabled={!showGravitationalWaves}
            onChange={(e) => handleWaveIntensityChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 disabled:opacity-40"
          />
        </div>

        <button
          onClick={handleTriggerPulse}
          disabled={!showGravitationalWaves}
          className="w-full min-h-[44px] py-2 px-3 rounded-xl bg-cyan-950/60 border border-cyan-500/40 hover:bg-cyan-900/60 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-40"
          title="Emitir un pulso de onda gravitacional que viaja por la malla"
        >
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>Emitir Pulso Gravitacional</span>
        </button>
      </div>

      {/* Brillo Bloom */}
      <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between min-h-[36px]">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-400" />
            Brillo Bloom (Post-Procesado)
          </span>
          <input
            type="checkbox"
            checked={bloomEnabled}
            onChange={handleToggleBloom}
            className="w-5 h-5 rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Intensidad de Resplandor</span>
            <span className="font-mono text-amber-300">{bloomStrength.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="3.0"
            step="0.05"
            value={bloomStrength}
            disabled={!bloomEnabled}
            onChange={(e) => handleBloomStrengthChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400 disabled:opacity-40"
          />
        </div>
      </div>
    </div>
  );

  // 3. PRESETS GRAVITATORIOS
  const renderPresetsSection = () => (
    <div className="space-y-2.5">
      <div className="text-[11px] text-slate-400 mb-2">
        Selecciona un escenario preconfigurado para observar dinámicas gravitatorias avanzadas:
      </div>

      {SIMULATION_PRESETS.map((preset) => {
        const isSelected = selectedPresetId === preset.id;
        return (
          <button
            key={preset.id}
            onClick={() => handleLoadPreset(preset.id)}
            className={`w-full min-h-[52px] p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
              isSelected
                ? 'bg-cyan-950/60 border-cyan-400 text-cyan-100 shadow-[0_0_14px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/40'
                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/90'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-bold text-xs flex items-center gap-2">
                <span>{preset.name}</span>
                {isSelected && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">ACTIVO</span>}
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">{preset.bodies.length} cuerpos</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">{preset.subtitle}</p>
          </button>
        );
      })}
    </div>
  );

  // 4. TELEMETRÍA ORBITAL
  const renderTelemetrySection = () => (
    <div className="space-y-3">
      {/* Botón para alternar HUD flotante en pantalla */}
      <button
        onClick={() => setIsHudOpen(!isHudOpen)}
        className={`w-full min-h-[44px] py-2 px-3 rounded-xl border flex items-center justify-between text-xs font-semibold transition-all ${
          isHudOpen
            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
        }`}
      >
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${isHudOpen ? 'text-cyan-400' : 'text-slate-500'}`} />
          <span>Ventana Flotante de Telemetría</span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
          {isHudOpen ? 'MOSTRAR EN CANVAS' : 'OCULTAR EN CANVAS'}
        </span>
      </button>

      {/* Grid de métricas en tiempo real */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-slate-400 text-[10px]">FPS Rendimiento</div>
          <div className="font-mono text-emerald-400 font-bold text-sm">{telemetry.fps} FPS</div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-slate-400 text-[10px]">Cuerpos Activos</div>
          <div className="font-mono text-cyan-300 font-bold text-sm">{telemetry.activeBodies}</div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-slate-400 text-[10px]">Energía Cinética (K)</div>
          <div className="font-mono text-cyan-300 font-bold text-xs truncate">
            {Math.round(telemetry.kineticEnergy).toLocaleString()} J
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-slate-400 text-[10px]">Energía Potencial (U)</div>
          <div className="font-mono text-amber-300 font-bold text-xs truncate">
            {Math.round(telemetry.potentialEnergy).toLocaleString()} J
          </div>
        </div>
      </div>

      {/* Energía Mecánica Total */}
      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-300 font-semibold">Energía Mecánica Total (E):</span>
          <span className={`font-mono font-bold ${telemetry.totalEnergy < 0 ? 'text-cyan-400' : 'text-amber-400'}`}>
            {Math.round(telemetry.totalEnergy).toLocaleString()} J
          </span>
        </div>
        <p className="text-[10px] text-slate-400 leading-tight">
          {telemetry.totalEnergy < 0 ? 'Sistema ligado orbitalmente (E < 0)' : 'Sistema no ligado o hiperbólico (E > 0)'}
        </p>
      </div>

      {/* Detector LIGO */}
      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5 text-xs">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            Detector LIGO (Ondas GW)
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            {telemetry.waveStrain > 0.08 ? (
              <span className="text-cyan-400 animate-pulse font-bold">Ondulación Detectada</span>
            ) : (
              'Reposo'
            )}
          </span>
        </div>

        <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-amber-400 transition-all duration-150 rounded-full"
            style={{ width: `${Math.min(Math.max(telemetry.waveStrain * 100, 3), 100)}%` }}
          />
        </div>

        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>Deformación h: {(telemetry.waveStrain * 1e-1).toFixed(2)}</span>
          <span>Pulsos activos: {telemetry.activeBursts}</span>
        </div>
      </div>
    </div>
  );

  // 5. LISTA DE CUERPOS & EDITOR DE MASAS
  const renderBodiesSection = () => (
    <div className="space-y-3">
      <div className="flex justify-between items-center text-slate-400 text-xs mb-1">
        <span className="font-medium text-slate-300">
          Total: <strong className="text-cyan-400 font-mono">{activeBodyList.length}</strong> cuerpos
        </span>
        {activeBodyList.length > 0 && (
          <button
            onClick={handleClear}
            className="min-h-[36px] px-2 py-1 text-red-400 hover:text-red-300 font-medium text-xs rounded-lg hover:bg-red-500/10 transition-colors"
          >
            Eliminar todos
          </button>
        )}
      </div>

      {activeBodyList.length === 0 ? (
        <div className="p-6 text-center text-slate-400 text-xs bg-slate-900/50 rounded-2xl border border-slate-800">
          No hay cuerpos celestes en la simulación. Usa el <strong className="text-cyan-400 font-semibold">Lanzador</strong> o carga un preset.
        </div>
      ) : (
        activeBodyList.map((b) => {
          const isSelected = selectedBodyId === b.id;
          const isTracked = engineRef.current?.trackedBodyId === b.id;

          return (
            <div
              key={b.id}
              className={`p-3 rounded-2xl border transition-all ${
                isSelected
                  ? 'bg-slate-900/90 border-cyan-400 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500/30'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div
                  className="min-w-0 flex-1 cursor-pointer"
                  onClick={() => handleSelectBody(b.id)}
                  title="Toca para seleccionar este cuerpo"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-200 truncate">{b.name}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold uppercase">
                      {getBodyLabel(b.type)}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Masa: <span className="text-cyan-300">{b.mass}u</span> · Vel:{' '}
                    <span className="text-amber-300">{b.speed}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleTrackBody(b.id)}
                    className={`min-h-[36px] px-2 py-1 rounded-lg text-xs font-semibold transition-all border ${
                      isTracked
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                    title="Seguir cuerpo con la cámara"
                  >
                    Seguir
                  </button>

                  <button
                    onClick={() => handleToggleBodyFixed(b.id)}
                    className={`min-h-[36px] p-2 rounded-lg text-xs border ${
                      b.isFixed
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                    title={b.isFixed ? 'Desanclar cuerpo' : 'Anclar cuerpo en posición fija'}
                  >
                    {b.isFixed ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => handleDeleteBody(b.id)}
                    className="min-h-[36px] p-2 rounded-lg text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-colors"
                    title="Eliminar cuerpo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Botones rápidos de ajuste de masa */}
              <div className="flex items-center justify-between gap-1 pt-2 mt-2 border-t border-slate-800/60">
                <button
                  onClick={() => handleBodyMassChange(b.id, Math.max(0.1, +(b.mass / 2).toFixed(1)))}
                  className="flex-1 min-h-[36px] py-1 px-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-[11px] font-mono text-slate-300 border border-slate-700/50 hover:text-cyan-300 transition-colors"
                  title="Dividir masa por 2"
                >
                  ÷2
                </button>
                <button
                  onClick={() => handleBodyMassChange(b.id, Math.min(5000, +(b.mass * 2).toFixed(1)))}
                  className="flex-1 min-h-[36px] py-1 px-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-[11px] font-mono text-slate-300 border border-slate-700/50 hover:text-cyan-300 transition-colors"
                  title="Multiplicar masa por 2"
                >
                  ×2
                </button>
                <button
                  onClick={() => handleBodyMassChange(b.id, Math.max(0.1, +(b.mass - 25).toFixed(1)))}
                  className="flex-1 min-h-[36px] py-1 px-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-[11px] font-mono text-slate-300 border border-slate-700/50 hover:text-cyan-300 transition-colors"
                  title="Restar 25 unidades"
                >
                  -25
                </button>
                <button
                  onClick={() => handleBodyMassChange(b.id, Math.min(5000, +(b.mass + 25).toFixed(1)))}
                  className="flex-1 min-h-[36px] py-1 px-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-[11px] font-mono text-slate-300 border border-slate-700/50 hover:text-cyan-300 transition-colors"
                  title="Sumar 25 unidades"
                >
                  +25
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="relative w-screen h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#020611] text-slate-100 font-sans select-none touch-none">
      {/* 3D WebGL Canvas Viewport (100% de fondo, interactivo) */}
      <div
        ref={canvasContainerRef}
        className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
        style={{ touchAction: 'none' }}
      />

      {/* Floating Launch Feedback Toast */}
      {launchFeedbackMsg && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-cyan-950/90 border border-cyan-400 text-cyan-200 text-xs font-semibold shadow-2xl shadow-cyan-950/50 animate-bounce">
          {launchFeedbackMsg}
        </div>
      )}

      {/* ========================================================= */}
      {/* BARRA SUPERIOR RESPONSIVA */}
      {/* ========================================================= */}
      <header className="absolute top-0 left-0 right-0 w-full max-w-[100vw] box-border p-[max(8px,env(safe-area-inset-top,8px))] px-2.5 pb-1.5 md:p-4 z-30 pointer-events-none flex flex-wrap items-center justify-between gap-1.5 overflow-x-hidden rounded-b-xl">
        {/* Brand Title Badge */}
        <div className="pointer-events-auto flex items-center gap-1.5 md:gap-2 px-2.5 py-1.5 md:px-4 md:py-2.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-cyan-500/20 shadow-xl shadow-cyan-950/20">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#38bdf8]" />
          <h1 className="text-[11px] md:text-sm font-bold tracking-wider uppercase text-cyan-400 font-mono">
            <span className="md:hidden">✦ Espaciotiempo</span>
            <span className="hidden md:inline">Curvatura del Espaciotiempo & N-Cuerpos</span>
          </h1>
        </div>

        {/* Global Action Buttons */}
        <div className="pointer-events-auto flex items-center flex-wrap gap-1 md:gap-2 justify-end">
          {/* Selector Superior de Vistas de Cámara: 🎥 Vista */}
          <div className="flex items-center bg-slate-950/85 backdrop-blur-md border border-cyan-500/30 rounded-xl px-1.5 py-0.5 md:px-2 md:py-1 gap-1 shadow-lg shadow-cyan-950/20">
            <span className="text-cyan-400 font-bold text-[11px] md:text-xs flex items-center gap-1 select-none whitespace-nowrap">
              <span>🎥</span>
              <span className="hidden sm:inline">Vista:</span>
            </span>
            <select
              value={cameraView}
              onChange={(e) => {
                const v = e.target.value as 'free' | 'top' | 'side' | 'cinematic';
                setCameraView(v);
                if (engineRef.current) {
                  engineRef.current.setCameraView(v);
                }
              }}
              className="bg-slate-900 text-cyan-200 text-[11px] md:text-xs font-semibold rounded-lg px-1.5 py-1 border border-cyan-500/40 focus:outline-none focus:border-cyan-400 cursor-pointer min-h-[32px] md:min-h-[36px]"
              title="Seleccionar perspectiva de cámara con interpolación suave"
            >
              <option value="free">3D Libre</option>
              <option value="top">Cenital (Superior)</option>
              <option value="side">Lateral (Perfil)</option>
              <option value="cinematic">Cinemática</option>
            </select>
          </div>

          {/* Pausa */}
          <button
            onClick={handleTogglePause}
            className={`min-h-[34px] md:min-h-[44px] px-2.5 py-1.5 md:px-3 md:py-2 flex items-center justify-center gap-1 text-[11px] md:text-xs font-semibold rounded-xl transition-all border ${
              isPaused
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                : 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
            }`}
            title="Pausar / Reanudar simulación"
          >
            {isPaused ? <Play className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Pause className="w-3.5 h-3.5 md:w-4 md:h-4" />}
            <span className="hidden sm:inline">{isPaused ? 'Reanudar' : 'Pausar'}</span>
          </button>

          {/* Botón Principal: Mostrar / Ocultar Malla */}
          <button
            onClick={handleToggleGrid}
            className={`min-h-[34px] md:min-h-[44px] px-2.5 py-1.5 md:px-3 md:py-2 flex items-center justify-center gap-1 text-[11px] md:text-xs font-semibold rounded-xl transition-all border z-[2000] ${
              showGrid
                ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-[0_0_16px_rgba(6,182,212,0.4)] hover:bg-cyan-500/35 ring-1 ring-cyan-400/30'
                : 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
            title="Alternar visibilidad del grid espaciotemporal (Grid On / Grid Off)"
          >
            <Globe className={`w-3.5 h-3.5 md:w-4 md:h-4 ${showGrid ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}`} />
            <span>{showGrid ? '🌐 Grid On' : '🌐 Grid Off'}</span>
          </button>

          {/* Audio Espacial */}
          <button
            onClick={handleToggleAudio}
            className={`min-h-[34px] md:min-h-[44px] px-2 py-1.5 md:px-3 md:py-2 flex items-center justify-center gap-1 text-[11px] md:text-xs font-semibold rounded-xl transition-all border ${
              isAudioActive
                ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.35)] hover:bg-cyan-500/35'
                : 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
            title={isAudioActive ? 'Silenciar sonidos cósmicos' : 'Activar audio espacial y drone cósmico'}
          >
            {isAudioActive ? <Volume2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-cyan-400 animate-pulse" /> : <VolumeX className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-500" />}
            <span className="hidden lg:inline">{isAudioActive ? '🔊 Silenciar' : '🔇 Audio'}</span>
          </button>

          {/* 🗑️ Botón Limpiar Escenario (Vaciar Grid) */}
          <button
            onClick={handleClear}
            className="min-h-[34px] md:min-h-[44px] px-2.5 py-1.5 md:px-3 md:py-2 flex items-center justify-center gap-1 text-[11px] md:text-xs font-semibold rounded-xl transition-all border border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 hover:border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.2)] active:scale-95"
            title="Eliminar de inmediato todos los cuerpos celestes y aplanar la malla"
          >
            <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-rose-400" />
            <span>🗑️ Limpiar</span>
          </button>

          {/* Botón de Menú Móvil (Abre Bottom Sheet en Celulares) */}
          <button
            onClick={() => setMobileSheetOpen(!mobileSheetOpen)}
            className={`md:hidden min-h-[44px] px-3 py-2 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-xl transition-all border ${
              mobileSheetOpen
                ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                : 'bg-slate-900/90 border-cyan-500/30 text-cyan-300 hover:border-cyan-400'
            }`}
            title="Abrir Centro de Control y Ajustes"
          >
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Menú</span>
          </button>

          {/* Info Modal */}
          <button
            onClick={() => setShowHelpModal(true)}
            className="min-h-[44px] min-w-[44px] p-2 flex items-center justify-center rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 transition-colors"
            title="Guía y Fundamentos Físicos"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={handleToggleFullscreen}
            className="hidden sm:flex min-h-[44px] min-w-[44px] p-2 items-center justify-center rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 transition-colors"
            title="Pantalla Completa"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* DESKTOP SIDEBAR (GLASSMORPHISM HUB - PANTALLAS GRANDES) */}
      {/* ========================================================= */}
      <aside
        className={`hidden md:flex absolute top-20 left-4 bottom-20 z-20 w-84 transition-transform duration-300 ease-out flex-col rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-cyan-500/20 shadow-2xl shadow-cyan-950/30 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-[calc(100%+1.5rem)]'
        }`}
      >
        {/* Sidebar Toggle Handle */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-10 top-4 p-2 rounded-r-xl bg-slate-950/90 border-y border-r border-cyan-500/20 text-cyan-400 hover:text-cyan-200 transition-colors shadow-lg"
          title={isSidebarOpen ? 'Colapsar barra lateral' : 'Expandir barra lateral'}
        >
          {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800/80 p-2 gap-1 bg-slate-900/40 rounded-t-2xl">
          <button
            onClick={() => setActiveTab('launcher')}
            className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'launcher'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Lanzador</span>
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'presets'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Presets</span>
          </button>
          <button
            onClick={() => setActiveTab('physics')}
            className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'physics'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Física</span>
          </button>
          <button
            onClick={() => setActiveTab('bodies')}
            className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'bodies'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Cuerpos ({activeBodyList.length})</span>
          </button>
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs scrollbar-thin scrollbar-thumb-cyan-500/20">
          {activeTab === 'launcher' && renderLauncherSection()}
          {activeTab === 'presets' && renderPresetsSection()}
          {activeTab === 'physics' && renderPhysicsSection()}
          {activeTab === 'bodies' && renderBodiesSection()}
        </div>
      </aside>

      {/* ========================================================= */}
      {/* MOBILE CONTROLS & BOTTOM SHEET (CELULARES / PANTALLAS PEQUEÑAS) */}
      {/* z-index: 2000 garantizado por encima del canvas 3D y elementos */}
      {/* ========================================================= */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 w-full max-w-[100vw] box-border z-[2000] pointer-events-none flex flex-col items-center">
        {/* Dock de Accesos Rápidos Móvil (Siempre Visible encima del panel inferior) */}
        <div className="w-full max-w-[100vw] box-border px-2.5 pb-1 pointer-events-auto flex flex-col items-center gap-1">
          {isLauncherMode && (
            <div className="px-3 py-1 rounded-full bg-slate-950/90 border border-cyan-400/80 text-cyan-200 text-[11px] font-medium shadow-xl shadow-cyan-950/50 flex items-center gap-1.5 animate-pulse">
              <span>🎯 Toca y arrastra en la pantalla para apuntar</span>
            </div>
          )}
          {/* Fila de accesos rápidos responsive */}
          <div className="w-full max-w-[100vw] box-border grid grid-cols-[repeat(auto-fit,minmax(90px,1fr))] gap-1.5 mb-1.5">
            {/* 1. Botón Permanente de Visibilidad del Grid en Móvil */}
            <button
              onClick={handleToggleGrid}
              className={`min-h-[44px] w-full px-2 py-2 rounded-full flex items-center justify-center gap-1 text-[11px] font-bold transition-all border shadow-lg backdrop-blur-md active:scale-95 ${
                showGrid
                  ? 'bg-cyan-500/30 border-cyan-400 text-cyan-100 shadow-[0_0_18px_rgba(6,182,212,0.55)] ring-1 ring-cyan-400/50'
                  : 'bg-slate-950/90 border-slate-700/80 text-slate-400 hover:text-slate-200'
              }`}
              title="Alternar visibilidad del grid espaciotemporal (Grid On / Grid Off)"
            >
              <Globe className={`w-3.5 h-3.5 ${showGrid ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}`} />
              <span>{showGrid ? 'Grid On' : 'Grid Off'}</span>
            </button>

            {/* 2. Botón Rápido Limpiar Escenario */}
            <button
              onClick={handleClear}
              className="min-h-[44px] w-full px-2 py-2 rounded-full flex items-center justify-center gap-1 text-[11px] font-bold transition-all border border-rose-500/40 bg-slate-950/90 text-rose-300 hover:bg-rose-500/20 shadow-lg backdrop-blur-md active:scale-95"
              title="Vaciar espacio, aplanar la malla y resetear telemetría"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Limpiar</span>
            </button>

            {/* 3. Botón de Lanzar Cuerpo */}
            <button
              onClick={() => handleToggleLauncherMode()}
              className={`min-h-[44px] w-full px-2 py-2 rounded-full flex items-center justify-center gap-1 text-[11px] font-bold transition-all shadow-xl backdrop-blur-md border active:scale-95 ${
                isLauncherMode
                  ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100 shadow-[0_0_16px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400/30'
                  : 'bg-slate-950/90 border-slate-700 text-slate-300 hover:border-cyan-400'
              }`}
              title="Toca para apuntar y arrastrar en la pantalla 3D"
            >
              <Crosshair
                className={`w-3.5 h-3.5 ${isLauncherMode ? 'text-cyan-400 animate-spin' : 'text-cyan-400'}`}
                style={isLauncherMode ? { animationDuration: '6s' } : undefined}
              />
              <span className="truncate">🎯 {getBodyLabel(selectedType)}</span>
            </button>
          </div>
        </div>

        {/* 1. Barra / Pestaña visible permanente cuando el panel está cerrado */}
        {!mobileSheetOpen && (
          <button
            onClick={() => setMobileSheetOpen(true)}
            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 14px))' }}
            className="w-full max-w-[100vw] box-border pointer-events-auto min-h-[48px] bg-slate-950/95 backdrop-blur-2xl border-t border-cyan-500/40 px-3.5 pt-2.5 flex items-center justify-between text-cyan-300 font-bold text-xs shadow-[0_-8px_30px_rgba(0,0,0,0.8)] active:bg-cyan-950/80 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">⚙️</span>
              <span className="tracking-wide">Ajustes y Presets ▲</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-400 font-bold">
                {telemetry.fps} FPS
              </span>
              <span className="text-cyan-400 font-bold">Tocar para abrir</span>
            </div>
          </button>
        )}

        {/* 2. Panel Desplegable (Glassmorphism Oscuro, cubre máximo el 55% de pantalla) */}
        {mobileSheetOpen && (
          <div
            style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))' }}
            className="w-full max-w-[100vw] box-border pointer-events-auto h-[52dvh] max-h-[55dvh] bg-slate-950/95 backdrop-blur-2xl border-t border-cyan-500/50 rounded-t-3xl shadow-[0_-15px_40px_rgba(0,0,0,0.9)] flex flex-col transition-all duration-300 ease-out"
          >
            {/* Encabezado del Panel Desplegable con barra y botón ▼ Cerrar / Minimizar */}
            <div
              onClick={() => setMobileSheetOpen(false)}
              className="px-4 py-2.5 border-b border-slate-800/80 flex items-center justify-between cursor-pointer bg-slate-900/60 rounded-t-3xl shrink-0"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 rounded-full bg-cyan-400/60" />
                <span className="font-bold text-xs text-cyan-300 flex items-center gap-1.5">
                  <span>⚙️</span>
                  <span>Ajustes y Presets</span>
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMobileSheetOpen(false);
                }}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-cyan-950/70 border border-cyan-500/40 text-cyan-200 hover:text-white font-bold text-xs flex items-center gap-1 shadow-sm active:scale-95 transition-all"
              >
                <span>▼ Cerrar / Minimizar</span>
              </button>
            </div>

            {/* Contenido Desplegable (Organizado con Scroll táctil, max-height: 50vh) */}
            <div
              className="flex-1 overflow-y-auto overscroll-contain p-3.5 space-y-3 text-xs"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {/* 🪐 1. Presets */}
              <details className="group rounded-2xl bg-slate-900/70 border border-slate-800 p-2.5">
                <summary className="flex items-center justify-between font-bold text-xs text-cyan-300 cursor-pointer list-none py-1">
                  <span className="flex items-center gap-1.5">🪐 Presets</span>
                  <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="pt-2.5 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleLoadPreset('kepler-orbit')}
                    className={`min-h-[44px] p-2 rounded-xl border text-left text-xs font-semibold flex flex-col justify-center transition-all ${
                      selectedPresetId === 'kepler-orbit'
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100 shadow-sm ring-1 ring-cyan-400/30'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span>🌟 Órbita Elíptica</span>
                    <span className="text-[10px] text-slate-400 font-normal">Sol y planeta Kepler</span>
                  </button>
                  <button
                    onClick={() => handleLoadPreset('earth-moon-system')}
                    className={`min-h-[44px] p-2 rounded-xl border text-left text-xs font-semibold flex flex-col justify-center transition-all ${
                      selectedPresetId === 'earth-moon-system'
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100 shadow-sm ring-1 ring-cyan-400/30'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span>🌍 Tierra y Luna</span>
                    <span className="text-[10px] text-slate-400 font-normal">Gravedad jerárquica</span>
                  </button>
                  <button
                    onClick={() => handleLoadPreset('binary-stars')}
                    className={`min-h-[44px] p-2 rounded-xl border text-left text-xs font-semibold flex flex-col justify-center transition-all ${
                      selectedPresetId === 'binary-stars'
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100 shadow-sm ring-1 ring-cyan-400/30'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span>🌀 Sistema Binario</span>
                    <span className="text-[10px] text-slate-400 font-normal">Ondas espirales LIGO</span>
                  </button>
                  <button
                    onClick={() => handleLoadPreset('gravitational-collapse')}
                    className={`min-h-[44px] p-2 rounded-xl border text-left text-xs font-semibold flex flex-col justify-center transition-all ${
                      selectedPresetId === 'gravitational-collapse'
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100 shadow-sm ring-1 ring-cyan-400/30'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span>🌌 Nebulosa</span>
                    <span className="text-[10px] text-slate-400 font-normal">Nube y colapso caótico</span>
                  </button>
                  <button
                    onClick={() => handleLoadPreset('figure-eight-three-body')}
                    className={`min-h-[44px] p-2 rounded-xl border text-left text-xs font-semibold flex flex-col justify-center transition-all ${
                      selectedPresetId === 'figure-eight-three-body'
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100 shadow-sm ring-1 ring-cyan-400/30'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span>♾️ 3 Cuerpos</span>
                    <span className="text-[10px] text-slate-400 font-normal">Solución periódica en 8</span>
                  </button>
                  <button
                    onClick={handleClear}
                    className="col-span-2 min-h-[44px] p-2 rounded-xl border border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all mt-0.5"
                    title="Eliminar de inmediato todos los cuerpos celestes y aplanar la malla"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    <span>🗑️ Limpiar Escenario (Vaciar Grid)</span>
                  </button>
                </div>
              </details>

              {/* 🔧 2. Física & Gravedad */}
              <details className="group rounded-2xl bg-slate-900/70 border border-slate-800 p-2.5">
                <summary className="flex items-center justify-between font-bold text-xs text-cyan-300 cursor-pointer list-none py-1">
                  <span className="flex items-center gap-1.5">🔧 Física & Gravedad</span>
                  <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="pt-2.5 space-y-3">
                  {/* Constante G */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300">Constante G</span>
                      <span className="font-mono text-cyan-300 font-bold">{G.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="3.0"
                      step="0.05"
                      value={G}
                      onChange={(e) => handleGChange(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>

                  {/* Escala Profundidad Deformación */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300">Escala de Profundidad de la Malla</span>
                      <span className="font-mono text-cyan-300 font-bold">{deformationScale.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="2.5"
                      step="0.05"
                      value={deformationScale}
                      onChange={(e) => handleDeformationChange(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>

                  {/* Velocidad Temporal */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300">Velocidad Temporal</span>
                      <span className="font-mono text-cyan-300 font-bold">{timeScale.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="2.5"
                      step="0.05"
                      value={timeScale}
                      onChange={(e) => handleTimeScaleChange(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>

                  {/* Malla espaciotemporal Toggle */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-300">Grid Espaciotemporal</span>
                    <button
                      onClick={handleToggleGrid}
                      className={`min-h-[44px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
                        showGrid
                          ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      <span>🌐 {showGrid ? 'Malla Visible' : 'Malla Oculta'}</span>
                    </button>
                  </div>

                  {/* Dinámica Relativista 1PN */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-2">
                    <label className="flex items-center justify-between cursor-pointer py-1 min-h-[36px]">
                      <span className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-violet-400" />
                        Efectos Relativistas (1PN)
                      </span>
                      <input
                        type="checkbox"
                        checked={relativisticEnabled}
                        onChange={handleToggleRelativistic}
                        className="w-5 h-5 rounded bg-slate-800 border-slate-700 text-violet-500 focus:ring-0 cursor-pointer"
                      />
                    </label>

                    {relativisticEnabled && (
                      <div className="space-y-1 pl-0.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-300">Velocidad de la luz (c)</span>
                          <span className="font-mono text-violet-300 font-bold">{speedOfLight} u/s</span>
                        </div>
                        <input
                          type="range"
                          min="15"
                          max="120"
                          step="1"
                          value={speedOfLight}
                          onChange={(e) => handleSpeedOfLightChange(parseFloat(e.target.value))}
                          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-400"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </details>

              {/* 🎯 3. Selector de Masa a Lanzar */}
              <details className="group rounded-2xl bg-slate-900/70 border border-slate-800 p-2.5">
                <summary className="flex items-center justify-between font-bold text-xs text-cyan-300 cursor-pointer list-none py-1">
                  <span className="flex items-center gap-1.5">🎯 Selector de Masa a Lanzar</span>
                  <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="pt-2.5 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleTypeSelect('star')}
                      className={`min-h-[48px] p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                        selectedType === 'star'
                          ? 'bg-amber-950/60 border-amber-400 text-amber-200 ring-1 ring-amber-400/40 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <Sun className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-xs">☀️ Sol</div>
                        <div className="text-[10px] text-slate-400 font-mono">1000u (Masivo)</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleTypeSelect('planet')}
                      className={`min-h-[48px] p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                        selectedType === 'planet'
                          ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200 ring-1 ring-cyan-400/40 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <Globe className="w-5 h-5 text-cyan-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-xs">🌍 Tierra</div>
                        <div className="text-[10px] text-slate-400 font-mono">20u (Rocoso)</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleTypeSelect('giant')}
                      className={`min-h-[48px] p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                        selectedType === 'giant'
                          ? 'bg-indigo-950/60 border-indigo-400 text-indigo-200 ring-1 ring-indigo-400/40 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <Disc className="w-5 h-5 text-indigo-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-xs">🪐 Júpiter</div>
                        <div className="text-[10px] text-slate-400 font-mono">80u (Gigante)</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleTypeSelect('blackhole')}
                      className={`min-h-[48px] p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                        selectedType === 'blackhole'
                          ? 'bg-purple-950/60 border-purple-400 text-purple-200 ring-1 ring-purple-400/40 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <Disc className="w-5 h-5 text-purple-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-xs">🕳️ Agujero N.</div>
                        <div className="text-[10px] text-slate-400 font-mono">2800u (Singular)</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleTypeSelect('asteroid')}
                      className={`min-h-[48px] p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all col-span-2 ${
                        selectedType === 'asteroid'
                          ? 'bg-slate-800 border-slate-400 text-slate-100 ring-1 ring-slate-400/40 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <Sparkles className="w-5 h-5 text-slate-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-xs">☄️ Asteroide / Luna</div>
                        <div className="text-[10px] text-slate-400 font-mono">0.2u - 4u (Ligero)</div>
                      </div>
                    </button>
                  </div>

                  {/* Asistente Lunar / Satélites */}
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer min-h-[44px]">
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs text-slate-300 font-medium">Asistente Lunar (Heredar vel.)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={satelliteAssist}
                      onChange={handleToggleSatelliteAssist}
                      className="w-5 h-5 rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                    />
                  </label>

                  {/* Selector fijo vs móvil */}
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer min-h-[44px]">
                    <div className="flex items-center gap-2">
                      {isFixedNew ? <Lock className="w-4 h-4 text-amber-400" /> : <Unlock className="w-4 h-4 text-cyan-400" />}
                      <span className="text-xs text-slate-300 font-medium">Anclar cuerpo (posición fija)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isFixedNew}
                      onChange={(e) => handleFixedToggle(e.target.checked)}
                      className="w-5 h-5 rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                    />
                  </label>

                  {/* Botón de lanzar / activar interacción */}
                  <button
                    onClick={() => {
                      handleToggleLauncherMode(true);
                      setMobileSheetOpen(false);
                    }}
                    className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-cyan-500/25 border border-cyan-400 text-cyan-200 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 active:scale-98 transition-all"
                  >
                    <Crosshair className="w-4 h-4 text-cyan-300" />
                    <span>🎯 Lanzar {getBodyLabel(selectedType)} (Arrastrar en 3D)</span>
                  </button>
                </div>
              </details>

              {/* 📊 4. Telemetría */}
              <details className="group rounded-2xl bg-slate-900/70 border border-slate-800 p-2.5">
                <summary className="flex items-center justify-between font-bold text-xs text-cyan-300 cursor-pointer list-none py-1">
                  <span className="flex items-center gap-1.5">📊 Telemetría</span>
                  <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="pt-2.5 space-y-2.5">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 min-h-[44px]">
                    <span className="text-xs text-slate-300 font-medium">Ventana superior de datos</span>
                    <button
                      onClick={() => setIsHudOpen(!isHudOpen)}
                      className={`min-h-[40px] px-3 py-1 rounded-lg border text-xs font-semibold transition-all ${
                        isHudOpen
                          ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {isHudOpen ? 'Ocultar Ventana' : 'Mostrar Ventana'}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">FPS</div>
                      <div className="font-mono font-bold text-cyan-300 text-sm">{telemetry.fps}</div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Cuerpos</div>
                      <div className="font-mono font-bold text-cyan-300 text-sm">{telemetry.activeBodies}</div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Ondas GW</div>
                      <div className="font-mono font-bold text-amber-300 text-sm">
                        {telemetry.waveStrain > 0.05 ? 'ACTIVA' : 'REPOSO'}
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>
        )}
      </div>


      {/* ========================================================= */}
      {/* RIGHT TELEMETRY HUD (VENTANA FLOTANTE DE DATOS) */}
      {/* ========================================================= */}
      <div
        className={`absolute top-16 md:top-20 right-2 md:right-4 z-20 w-64 max-w-[85vw] rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-cyan-500/20 shadow-2xl shadow-cyan-950/30 p-3.5 md:p-4 transition-all duration-300 ${
          isHudOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
            <Activity className="w-4 h-4" />
            <span>Telemetría Orbital</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-emerald-400 font-semibold">{telemetry.fps} FPS</span>
            <button
              onClick={() => setIsHudOpen(false)}
              className="min-h-[28px] min-w-[28px] flex items-center justify-center rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors text-xs"
              title="Ocultar Telemetría"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Cuerpos Activos:</span>
            <span className="font-mono font-semibold text-slate-200">{telemetry.activeBodies}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400">Energía Cinética (K):</span>
            <span className="font-mono text-cyan-300">{Math.round(telemetry.kineticEnergy).toLocaleString()} J</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400">Energía Potencial (U):</span>
            <span className="font-mono text-amber-300">{Math.round(telemetry.potentialEnergy).toLocaleString()} J</span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-800/60 font-semibold">
            <span className="text-slate-300">Energía Mecánica (E):</span>
            <span className={`font-mono ${telemetry.totalEnergy < 0 ? 'text-cyan-400' : 'text-amber-400'}`}>
              {Math.round(telemetry.totalEnergy).toLocaleString()} J
            </span>
          </div>
        </div>

        {/* Gravitational Wave Strain HUD Meter */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-cyan-300 flex items-center gap-1">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              Detector LIGO (GW)
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              {telemetry.waveStrain > 0.08 ? (
                <span className="text-cyan-400 animate-pulse font-bold">Activo</span>
              ) : (
                'En reposo'
              )}
            </span>
          </div>

          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-amber-400 transition-all duration-150 rounded-full"
              style={{ width: `${Math.min(Math.max(telemetry.waveStrain * 100, 3), 100)}%` }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>Deformación h: {(telemetry.waveStrain * 1e-1).toFixed(2)}</span>
            <span>Pulsos: {telemetry.activeBursts}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 text-[10px] space-y-1.5">
          <div className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">
            Gradiente Gravitacional
          </div>
          <div className="h-2 rounded-full w-full bg-gradient-to-r from-cyan-500 via-amber-500 to-yellow-200 shadow-sm" />
          <div className="flex justify-between text-slate-400 font-mono text-[9px]">
            <span>Plano (0)</span>
            <span>Curvatura Media</span>
            <span>Singularidad</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* DESKTOP BOTTOM FOOTER BAR */}
      {/* ========================================================= */}
      <footer className="hidden md:flex absolute bottom-4 left-4 right-4 z-20 pointer-events-none items-center justify-between">
        <div className="pointer-events-auto px-4 py-2 rounded-xl bg-slate-950/80 backdrop-blur-md border border-cyan-500/20 text-xs text-slate-300 shadow-xl flex items-center gap-3">
          <span className="text-cyan-400 font-semibold flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            Controles 3D:
          </span>
          <span className="text-slate-400">
            <strong className="text-slate-200">Clic Izq + Arrastre:</strong> Lanzar objeto en órbita ·{' '}
            <strong className="text-slate-200">Clic Der / Rueda:</strong> Rotar & Zoom en 3D
          </span>
        </div>

        <div className="pointer-events-auto px-3 py-2 rounded-xl bg-slate-950/80 backdrop-blur-md border border-cyan-500/20 text-[11px] font-mono text-cyan-300 flex items-center gap-2">
          <span>Tensor de Einstein: G_μν = (8πG/c⁴) T_μν</span>
        </div>
      </footer>

      {/* Physical Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="max-w-xl w-full rounded-2xl bg-slate-950 border border-cyan-500/30 shadow-2xl p-6 text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-cyan-400 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                Fundamentos de la Simulación
              </h2>
              <button
                onClick={() => setShowHelpModal(false)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-100 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-slate-300">
              <div>
                <h3 className="font-semibold text-cyan-300 text-sm mb-1">1. Curvatura de la Malla Espaciotemporal</h3>
                <p>
                  En la Relatividad General de Albert Einstein, la gravedad no es una fuerza invisible a distancia, sino la manifestación geométrica de la curvatura del espaciotiempo provocada por la masa y la energía. La malla representa el plano orbital $XZ$, deformándose hacia abajo en el eje $Y$ proporcionalmente al potencial gravitatorio acumulado:
                </p>
                <div className="p-2.5 my-1.5 rounded-lg bg-slate-900 font-mono text-cyan-300 text-center">
                  y(x, z) = -Σ [ G · M_i / √( (x - x_i)² + (z - z_i)² + ε² ) ]
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-cyan-300 text-sm mb-1">2. Dinámica de N-Cuerpos y Colisiones</h3>
                <p>
                  Todos los cuerpos no anclados aceleran mutuamente según la ley de gravitación universal newtoniana con amortiguador de singularidad (parámetro ε). Si dos cuerpos colisionan físicamente, se fusionan conservando la masa total y el momento lineal (p = m · v).
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-cyan-300 text-sm mb-1">3. Modo Lanzador y Pantallas Táctiles</h3>
                <p>
                  En dispositivos móviles puedes alternar entre el <strong>Modo Navegación</strong> (1 dedo para rotar la cámara y 2 dedos pellizcando para hacer zoom) y el <strong>Modo Lanzador</strong> (arrastrar sobre la cuadrícula para impartir velocidad tangencial orbital).
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
