import { PHYSICS } from './constants';

export interface SchwarzschildParameters {
  readonly massSolar: number;
  readonly massKg: number;
  readonly lengthUnitMeters: number;
  readonly timeUnitSeconds: number;
  readonly horizonUnits: number;
  readonly photonSphereUnits: number;
  readonly iscoUnits: number;
  readonly criticalImpactUnits: number;
  readonly schwarzschildRadiusMeters: number;
  readonly photonSphereRadiusMeters: number;
  readonly iscoRadiusMeters: number;
  readonly criticalImpactMeters: number;
}

export const MASS_LIMITS = Object.freeze({ minSolar: 0.1, maxSolar: 1e9 });

export function createBlackHoleParameters(massSolar: number): SchwarzschildParameters {

  if (!Number.isFinite(massSolar) || massSolar < MASS_LIMITS.minSolar || massSolar > MASS_LIMITS.maxSolar) {
    throw new RangeError(`Mass must be between ${MASS_LIMITS.minSolar} and ${MASS_LIMITS.maxSolar} solar masses`);
  }

  const massKg = massSolar * PHYSICS.SOLAR_MASS;
  const lengthUnitMeters = PHYSICS.G * massKg / PHYSICS.C ** 2;
  const timeUnitSeconds = lengthUnitMeters / PHYSICS.C;
  const horizonUnits = 2;
  const photonSphereUnits = 3;
  const iscoUnits = 6;
  const criticalImpactUnits = 3 * Math.sqrt(3);

  return Object.freeze({
    massSolar, massKg, lengthUnitMeters, timeUnitSeconds,
    horizonUnits, photonSphereUnits, iscoUnits, criticalImpactUnits,
    schwarzschildRadiusMeters: horizonUnits * lengthUnitMeters,
    photonSphereRadiusMeters: photonSphereUnits * lengthUnitMeters,
    iscoRadiusMeters: iscoUnits * lengthUnitMeters,
    criticalImpactMeters: criticalImpactUnits * lengthUnitMeters,
  });
}

export function geometrizedLengthToMeters(lengthUnits: number, parameters: SchwarzschildParameters): number {
  if (!Number.isFinite(lengthUnits)) throw new RangeError('Geometrized length must be finite');
  return lengthUnits * parameters.lengthUnitMeters;
}

export function geometrizedTimeToSeconds(timeUnits: number, parameters: SchwarzschildParameters): number {
  if (!Number.isFinite(timeUnits)) throw new RangeError('Geometrized time must be finite');
  return timeUnits * parameters.timeUnitSeconds;
}
