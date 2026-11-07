import { PHYSICS } from './constants';

function positive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be positive and finite`);
}

export function massKg(massSolar: number): number {
  positive(massSolar, 'Mass in solar masses');
  return massSolar * PHYSICS.SOLAR_MASS;
}

export function schwarzschildRadius(massSolar: number): number {
  return (2 * PHYSICS.G * massKg(massSolar)) / PHYSICS.C ** 2;
}

export function photonSphereRadius(massSolar: number): number {
  return 1.5 * schwarzschildRadius(massSolar);
}
export function iscoRadius(massSolar: number): number {
  return 3 * schwarzschildRadius(massSolar);
}
export function criticalImpactParameter(massSolar: number): number {
  return (3 * Math.sqrt(3) * PHYSICS.G * massKg(massSolar)) / PHYSICS.C ** 2;
}
export function metersToSceneUnits(meters: number, massSolar: number): number {
  positive(meters, 'Distance');
  return meters / schwarzschildRadius(massSolar);
}
export function sceneUnitsToMeters(units: number, massSolar: number): number {
  if (!Number.isFinite(units) || units < 0) throw new RangeError('Scene units must be non-negative and finite');
  return units * schwarzschildRadius(massSolar);
}
