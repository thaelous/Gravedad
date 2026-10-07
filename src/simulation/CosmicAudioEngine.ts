// Procedural Web Audio API synthesizer for cosmic ambient drone, launches, mergers, and perihelion chimes

export class CosmicAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isEnabled: boolean = false;

  // Spacetime ambient drone nodes
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private droneGain: GainNode | null = null;
  private droneNoiseGain: GainNode | null = null;

  // Delay / Echo send node for cosmic space
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;

  constructor() {
    // AudioContext will be initialized on user interaction
  }

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Cosmic Delay / Echo Unit
      this.delayNode = this.ctx.createDelay();
      this.delayNode.delayTime.setValueAtTime(0.32, this.ctx.currentTime);
      this.delayFeedback = this.ctx.createGain();
      this.delayFeedback.gain.setValueAtTime(0.38, this.ctx.currentTime);

      this.delayNode.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delayNode);
      this.delayNode.connect(this.masterGain);

      // Initialize Ambient Spacetime Drone
      this.setupDrone();
    } catch (err) {
      console.warn('Web Audio API no soportado o bloqueado:', err);
    }
  }

  private setupDrone() {
    if (!this.ctx || !this.masterGain) return;

    // Dual sub-bass binaural oscillators
    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc2 = this.ctx.createOscillator();
    this.droneFilter = this.ctx.createBiquadFilter();
    this.droneGain = this.ctx.createGain();

    this.droneOsc1.type = 'sine';
    this.droneOsc1.frequency.setValueAtTime(46.0, this.ctx.currentTime); // Sub-bass low F

    this.droneOsc2.type = 'sine';
    this.droneOsc2.frequency.setValueAtTime(49.5, this.ctx.currentTime); // Binaural beat ~3.5 Hz

    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.setValueAtTime(110.0, this.ctx.currentTime);
    this.droneFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

    this.droneGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

    this.droneOsc1.connect(this.droneFilter);
    this.droneOsc2.connect(this.droneFilter);
    this.droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);

    // Subtle background cosmic noise texture
    try {
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02; // Pink-ish noise
        lastOut = output[i];
      }
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(160, this.ctx.currentTime);
      noiseFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

      this.droneNoiseGain = this.ctx.createGain();
      this.droneNoiseGain.gain.setValueAtTime(0.025, this.ctx.currentTime);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(this.droneNoiseGain);
      this.droneNoiseGain.connect(this.masterGain);
      noiseSource.start();
    } catch {
      // Noise buffer optional
    }

    this.droneOsc1.start();
    this.droneOsc2.start();
  }

  public toggle(): boolean {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isEnabled = !this.isEnabled;
    if (this.masterGain && this.ctx) {
      const targetGain = this.isEnabled ? 0.85 : 0.0001;
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.exponentialRampToValueAtTime(Math.max(targetGain, 0.0001), this.ctx.currentTime + 0.15);
    }
    return this.isEnabled;
  }

  public setEnabled(enable: boolean) {
    if (enable && !this.ctx) {
      this.init();
    }
    if (enable && this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.isEnabled = enable;
    if (this.masterGain && this.ctx) {
      const targetGain = this.isEnabled ? 0.85 : 0.0001;
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.exponentialRampToValueAtTime(Math.max(targetGain, 0.0001), this.ctx.currentTime + 0.15);
    }
  }

  public getIsActive(): boolean {
    return this.isEnabled;
  }

  // Update drone based on total mass and maximum spacetime curvature depth
  public updateCurvatureModulation(totalMass: number, maxDepth: number) {
    if (!this.ctx || !this.isEnabled || !this.droneFilter || !this.droneOsc1 || !this.droneOsc2 || !this.droneGain) {
      return;
    }
    const t = this.ctx.currentTime;
    const depthClamped = Math.min(Math.abs(maxDepth), 25);
    const massFactor = Math.min(totalMass / 3500, 1.0);

    // Deepen frequency when massive objects sink spacetime
    const targetBaseFreq = 42 + (1.0 - massFactor * 0.4) * 8 + (depthClamped * 0.4);
    const targetFilterFreq = 95 + depthClamped * 6.5 + massFactor * 45;
    const targetGain = 0.09 + Math.min(depthClamped * 0.006 + massFactor * 0.05, 0.16);

    this.droneOsc1.frequency.setTargetAtTime(targetBaseFreq, t, 0.25);
    this.droneOsc2.frequency.setTargetAtTime(targetBaseFreq + 3.2, t, 0.25);
    this.droneFilter.frequency.setTargetAtTime(Math.min(targetFilterFreq, 280), t, 0.25);
    this.droneGain.gain.setTargetAtTime(targetGain, t, 0.3);
  }

  // 1. Lanzamiento de cuerpo celeste (Cosmic Swoosh / Resonant Sweep)
  public playLaunch(velocityMagnitude: number = 8.0, isHeavy: boolean = false) {
    if (!this.ctx || !this.isEnabled || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    const startFreq = isHeavy ? 90 : 180 + Math.min(velocityMagnitude * 12, 280);
    const endFreq = isHeavy ? 240 : 420 + Math.min(velocityMagnitude * 25, 450);

    osc.type = isHeavy ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.38);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(startFreq * 1.5, t);
    filter.frequency.exponentialRampToValueAtTime(endFreq * 1.8, t + 0.4);
    filter.Q.setValueAtTime(3.5, t);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.24, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    if (this.delayNode) {
      gain.connect(this.delayNode);
    }

    osc.start(t);
    osc.stop(t + 0.5);
  }

  // 2. Colisión y fusión gravitatoria (Deep Impact & Gravitational Ringdown)
  public playMerger(energy: number = 3.0) {
    if (!this.ctx || !this.isEnabled || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const normalizedEnergy = Math.min(Math.max(energy, 1.0), 10.0);

    // Sub-bass thud (singularity merger thump)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(115, t);
    subOsc.frequency.exponentialRampToValueAtTime(28, t + 0.65);

    subGain.gain.setValueAtTime(0.42 * (normalizedEnergy / 4.0), t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(t);
    subOsc.stop(t + 1.2);

    // Harmonic ringdown chord (gravitational wave oscillation chirp)
    const chordFreqs = [196, 294, 440];
    chordFreqs.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const ringOsc = this.ctx.createOscillator();
      const ringGain = this.ctx.createGain();
      const ringFilter = this.ctx.createBiquadFilter();

      ringOsc.type = idx === 0 ? 'triangle' : 'sine';
      ringOsc.frequency.setValueAtTime(freq, t);
      ringOsc.frequency.exponentialRampToValueAtTime(freq * 0.75, t + 0.9);

      ringFilter.type = 'lowpass';
      ringFilter.frequency.setValueAtTime(500, t);

      const amp = 0.14 / (idx + 1);
      ringGain.gain.setValueAtTime(0.001, t);
      ringGain.gain.linearRampToValueAtTime(amp, t + 0.04);
      ringGain.gain.exponentialRampToValueAtTime(0.001, t + 0.95);

      ringOsc.connect(ringFilter);
      ringFilter.connect(ringGain);
      ringGain.connect(this.masterGain);

      if (this.delayNode) {
        ringGain.connect(this.delayNode);
      }

      ringOsc.start(t);
      ringOsc.stop(t + 1.0);
    });
  }

  // 3. Perihelio / Máxima Aproximación (Harmonic orbital chime)
  public playPerihelion(speedRatio: number = 1.0) {
    if (!this.ctx || !this.isEnabled || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Harmonic bell chime
    const baseFreqs = [528, 660, 792, 1056];
    const pickFreq = baseFreqs[Math.floor(Math.random() * baseFreqs.length)];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(pickFreq * (0.9 + Math.min(speedRatio * 0.08, 0.4)), t);
    osc.frequency.exponentialRampToValueAtTime(pickFreq * 0.98, t + 0.35);

    const volume = Math.min(0.09 * speedRatio, 0.16);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.42);

    osc.connect(gain);
    gain.connect(this.masterGain);

    if (this.delayNode) {
      gain.connect(this.delayNode);
    }

    osc.start(t);
    osc.stop(t + 0.45);
  }
}
