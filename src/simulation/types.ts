export type BodyType = 'blackhole' | 'star' | 'giant' | 'planet' | 'moon' | 'asteroid';

export interface CelestialBodyData {
  id: string;
  name: string;
  type: BodyType;
  mass: number;
  radius: number;
  color: string;
  glowColor?: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  isFixed?: boolean;
}

export interface SimulationConfig {
  G: number;
  timeScale: number;
  deformationScale: number;
  softening: number;
  trailLength: number;
  showTrails: boolean;
  showGrid: boolean;
  gridResolution: number;
  bodyOnWell: boolean; // whether bodies sink visually to the depth of their well
  isPaused: boolean;
  showVectors: boolean;
  showGravitationalWaves: boolean;
  waveIntensity: number;
  bloomEnabled: boolean;
  bloomStrength: number;
}

export interface BodyPreset {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  icon: string;
  bodies: CelestialBodyData[];
  defaultConfig?: Partial<SimulationConfig>;
}
