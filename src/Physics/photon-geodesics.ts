import { PHYSICS } from './constants';
import { massKg } from './Schwarzschild-metrics';
import { createBlackHoleParameters } from './black-hole-parameters';

type State = [
  inverseRadius: number,
  derivative: number
];

export type Vec3Tuple = readonly [number, number, number];
export interface PhotonPoint { radius: number; azimuth: number }

export interface PhotonTraceOptions {
  massSolar: number;
  impactParameterUnits: number;
  observerRadiusUnits?: number;
  step?: number;
  maxSteps?: number;
}

export interface PhotonTrace {
  points: PhotonPoint[];
  status: 'captured' | 'escaped' | 'near-critical' | 'invalid';
  criticalImpactParameterUnits: number;
  deflectionRadians: number | null;
  steps: number;
}

export interface LocalPhotonInitialState {
  radiusUnits: number;
  impactParameterUnits: number;
  energy: number;
  angularMomentum: number;
  coordinateTimeVelocity: number;
  radialVelocity: number;
  angularVelocity: number;
  nullResidual: number;
}

function positiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive and finite`);
}

function geodesicRhs([u, v]: State): State {
  return [v, 3 * u * u - u];
}

function statePlus(state: State, slope: State, scale: number): State {
  return [state[0] + slope[0] * scale, state[1] + slope[1] * scale];
}

export function rk4Step(state: State, step: number): State {
  const k1 = geodesicRhs(state);
  const k2 = geodesicRhs(statePlus(state, k1, step / 2));
  const k3 = geodesicRhs(statePlus(state, k2, step / 2));
  const k4 = geodesicRhs(statePlus(state, k3, step));

  return [
    state[0] + step * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6,
    state[1] + step * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6,
  ];
}

export function impactParameterForMass(bMeters: number, massSolar: number): number {
  positiveFinite(bMeters, 'Impact parameter');
  const mass = massKg(massSolar);
  return bMeters / (PHYSICS.G * mass / PHYSICS.C ** 2);
}

export function initializeLocalPhoton(positionUnits: Vec3Tuple, direction: Vec3Tuple): LocalPhotonInitialState {

  const radius = Math.hypot(...positionUnits);
  positiveFinite(radius, 'Observer radius');

  const directionMagnitude = Math.hypot(...direction);
  positiveFinite(directionMagnitude, 'Photon direction magnitude');

  if (radius <= 2) throw new RangeError('A static camera ray must start outside the event horizon');

  const d = direction.map((component) => component / directionMagnitude) as [number, number, number];
  const radial = (positionUnits[0] * d[0] + positionUnits[1] * d[1] + positionUnits[2] * d[2]) / radius;
  const tangent = Math.sqrt(Math.max(0, 1 - radial * radial));
  const metric = 1 - 2 / radius;
  const energy = Math.sqrt(metric);
  const angularMomentum = radius * tangent;
  const coordinateTimeVelocity = 1 / Math.sqrt(metric);
  const radialVelocity = Math.sqrt(metric) * radial;
  const angularVelocity = tangent / radius;
  const nullResidual = -metric * coordinateTimeVelocity ** 2 + radialVelocity ** 2 / metric + radius ** 2 * angularVelocity ** 2;

  return {
    radiusUnits: radius,
    impactParameterUnits: angularMomentum / energy,
    energy,
    angularMomentum,
    coordinateTimeVelocity,
    radialVelocity,
    angularVelocity,
    nullResidual,
  };
}

export function tracePhoton({ massSolar, impactParameterUnits, observerRadiusUnits = 200, step = 0.001, maxSteps = 200000 }: PhotonTraceOptions): PhotonTrace {
  positiveFinite(massSolar, 'Mass');
  positiveFinite(impactParameterUnits, 'Impact parameter');
  positiveFinite(observerRadiusUnits, 'Observer radius');
  positiveFinite(step, 'Integration step');

  if (!Number.isInteger(maxSteps) || maxSteps < 1) throw new RangeError('Maximum steps must be a positive integer');

  if (observerRadiusUnits <= 2) throw new RangeError('Observer must be outside the event horizon');

  const parameters = createBlackHoleParameters(massSolar);
  const critical = parameters.criticalImpactUnits;
  const initialU = 1 / observerRadiusUnits;
  const radialPotential = 1 / impactParameterUnits ** 2 - initialU ** 2 + 2 * initialU ** 3;
  if (radialPotential <= 0) throw new RangeError('Impact parameter is not reachable from the observer radius');


  const inbound = impactParameterUnits < observerRadiusUnits * Math.sqrt(1 - 2 / observerRadiusUnits);
  let state: State = [initialU, (inbound ? 1 : -1) * Math.sqrt(radialPotential)];
  const points: PhotonPoint[] = [];
  let azimuth = 0;
  let status: PhotonTrace['status'] = 'near-critical';
  let steps = 0;

  for (; steps < maxSteps; steps += 1) {
    const radius = 1 / state[0];
    if (!Number.isFinite(radius) || state[0] <= 0) {
      status = 'escaped';
      break;
    }
    points.push({ radius, azimuth });
    if (radius <= parameters.horizonUnits * 1.0005) {
      status = 'captured';
      break;
    }
    if (steps > 0 && radius >= observerRadiusUnits && state[1] < 0) {
      status = 'escaped';
      break;
    }
    if (state[0] > 0.5) {
      status = 'captured';
      break;
    }
    state = rk4Step(state, step);
    azimuth += step;
  }

  return {
    points,
    status,
    criticalImpactParameterUnits: critical,
    deflectionRadians: status === 'escaped'
      ? azimuth - (Math.PI - 2 * Math.asin(Math.min(1, impactParameterUnits * Math.sqrt(1 - 2 / observerRadiusUnits) / observerRadiusUnits)))
      : null,
    steps,
  };
}

export function criticalImpactParameterForMass(massSolar: number): number {
  return createBlackHoleParameters(massSolar).criticalImpactUnits;
}

export function criticalImpactParameterMeters(massSolar: number): number {
  return createBlackHoleParameters(massSolar).criticalImpactMeters;
}
