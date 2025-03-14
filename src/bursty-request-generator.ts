// "Gamma-modulated Poisson" to generate events at a mean rate, but with random spacing
// and a tunable burstiness
// This is more or less a straight cut-and-paste from ChatGPT. It seems to behave OK.
export class BurstyRequestGenerator {
  meanRPS: number;
  burstiness: number;
  nextEventTime: number;
  currentTime: number;

  constructor(meanRPS: number, burstiness: number) {
    this.meanRPS = meanRPS;
    this.burstiness = burstiness;
    this.nextEventTime = 0;
    this.currentTime = 0;
  }

  reset() {
    this.currentTime = 0;
    this.nextEventTime = 0;
  }

  setMeanRPS(meanRPS: number) {
    this.meanRPS = meanRPS;
    this.reset();
  }

  setBurstiness(burstiness: number) {
    this.burstiness = burstiness;
    this.reset();
  }

  // Compute the next inter-arrival time
  nextInterarrivalTime() {
    if (this.burstiness === 0) {
      // Deterministic spacing (regular intervals)
      return 1 / this.meanRPS;
    }

    // Poisson-like behavior modulated by burstiness
    const baseTime = -Math.log(Math.random()) / this.meanRPS;
    const gammaFactor = this.gammaSample(1 / this.burstiness, this.burstiness);
    return baseTime * gammaFactor;
  }

  // Generate a Gamma-distributed random sample
  gammaSample(shape: number, scale: number): number {
    if (shape < 1) {
      const u = Math.random();
      return this.gammaSample(1 + shape, scale) * Math.pow(u, 1 / shape);
    }

    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    let x, v;

    while (true) {
      do {
        x = this.normalSample();
        v = 1 + c * x;
      } while (v <= 0);

      v = v * v * v;
      const u = Math.random();

      if (u < 1 - 0.0331 * x * x * x * x) return d * v * scale;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v)))
        return d * v * scale;
    }
  }

  // Standard normal distribution sample (Box-Muller method)
  normalSample(): number {
    let u = 0,
      v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // Call this on every simulation tick
  tick(deltaTime: number): boolean {
    this.currentTime += deltaTime;

    if (this.currentTime >= this.nextEventTime) {
      this.nextEventTime += this.nextInterarrivalTime();
      return true; // A request occurs
    }

    return false; // No request this tick
  }
}
