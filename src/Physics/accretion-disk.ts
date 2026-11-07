import { PHYSICS } from './constants';
import { massKg, schwarzschildRadius } from './Schwarzschild-metrics';

export function diskTemperature(massSolar: number, accretionRateKgPerSecond: number, radiusMeters: number): number {
  if (![massSolar, accretionRateKgPerSecond, radiusMeters].every(Number.isFinite) || massSolar <= 0 || accretionRateKgPerSecond < 0 || radiusMeters <= 0) {
    throw new RangeError('Disk parameters must be finite; mass and radius positive, accretion rate non-negative');
  }

  const mass = massKg(massSolar);
  const innerRadius = 3 * schwarzschildRadius(massSolar);

  if (radiusMeters <= innerRadius || accretionRateKgPerSecond === 0) return 0;

  const flux = (3 * PHYSICS.G * mass * accretionRateKgPerSecond / (8 * Math.PI * radiusMeters ** 3)) * (1 - Math.sqrt(innerRadius / radiusMeters));
  return (flux / PHYSICS.STEFAN_BOLTZMANN) ** 0.25;
}

export function diskTemperatureScale(massSolar: number, accretionRateKgPerSecond: number): number {
  if (!Number.isFinite(massSolar) || massSolar <= 0 || !Number.isFinite(accretionRateKgPerSecond) || accretionRateKgPerSecond < 0) {
    throw new RangeError('Disk temperature scale requires positive mass and non-negative finite accretion rate');
  }
  if (accretionRateKgPerSecond === 0) return 0;
  const mass = massKg(massSolar);

  const coefficient = 3 * accretionRateKgPerSecond * PHYSICS.C ** 6 / (8 * Math.PI * PHYSICS.STEFAN_BOLTZMANN * PHYSICS.G ** 2 * mass ** 2);
  return coefficient ** 0.25;
}

export function orbitalAngularVelocity(massSolar: number, radiusMeters: number): number {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) throw new RangeError('Radius must be positive and finite');
  return Math.sqrt(PHYSICS.G * massKg(massSolar) / radiusMeters ** 3);
}

export function temperatureColorFraction(temperatureKelvin: number): number {
  if (!Number.isFinite(temperatureKelvin) || temperatureKelvin < 0) throw new RangeError('Temperature must be non-negative and finite');
  return Math.min(1, temperatureKelvin / 1e7);
}
