import test from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS } from './constants';
import { createBlackHoleParameters, geometrizedLengthToMeters } from './black-hole-parameters';
import { diskTemperature, diskTemperatureScale } from './accretion-disk';
import { criticalImpactParameterForMass, impactParameterForMass, initializeLocalPhoton, tracePhoton } from './photon-geodesics';
import { tracePhoton as traceAtStep } from './photon-geodesics';
import { iscoRadius, photonSphereRadius, schwarzschildRadius } from './Schwarzschild-metrics';

test('Schwarzschild scales have the exact expected ratios', () => {
  const rs = schwarzschildRadius(10);
  assert.ok(Math.abs(rs - 29533.39) < 0.02);
  assert.equal(photonSphereRadius(10), 1.5 * rs);
  assert.equal(iscoRadius(10), 3 * rs);
});

test('geometrized parameters scale linearly across stellar and supermassive masses', () => {
  for (const mass of [1, 5, 10, 50, 100, 1_000_000, 4_000_000]) {
    const p = createBlackHoleParameters(mass);
    const unitLength = PHYSICS.G * mass * PHYSICS.SOLAR_MASS / PHYSICS.C ** 2;
    assert.ok(Math.abs(p.lengthUnitMeters / unitLength - 1) < 1e-14);
    assert.equal(p.schwarzschildRadiusMeters, 2 * p.lengthUnitMeters);
    assert.equal(p.photonSphereRadiusMeters, 3 * p.lengthUnitMeters);
    assert.equal(p.iscoRadiusMeters, 6 * p.lengthUnitMeters);
    assert.equal(p.criticalImpactMeters, 3 * Math.sqrt(3) * p.lengthUnitMeters);
    assert.equal(geometrizedLengthToMeters(p.horizonUnits, p), p.schwarzschildRadiusMeters);
  }
  const small = createBlackHoleParameters(1);
  const large = createBlackHoleParameters(4_000_000);
  assert.ok(Math.abs(large.lengthUnitMeters / small.lengthUnitMeters / 4_000_000 - 1) < 1e-14);
});

test('critical impact parameter equals 3 sqrt(3) GM/c^2', () => {
  const expected = 3 * Math.sqrt(3) * PHYSICS.G * 10 * PHYSICS.SOLAR_MASS / PHYSICS.C ** 2;
  assert.ok(Math.abs(criticalImpactParameterForMass(10) * schwarzschildRadius(10) / 2 - expected) < 1e-8);
  assert.equal(impactParameterForMass(4 * schwarzschildRadius(10), 10), 8);
});

test('photon paths classify below and above the critical impact parameter', () => {
  assert.equal(tracePhoton({ massSolar: 10, impactParameterUnits: 5, maxSteps: 100000 }).status, 'captured');
  assert.equal(tracePhoton({ massSolar: 10, impactParameterUnits: 8, maxSteps: 100000 }).status, 'escaped');
});

test('camera photon initial conditions satisfy the Schwarzschild null constraint', () => {
  const ray = initializeLocalPhoton([0, 0, 20], [0.6, 0, -0.8]);
  assert.ok(Math.abs(ray.nullResidual) < 1e-14);
  assert.ok(ray.energy > 0 && ray.angularMomentum > 0 && ray.impactParameterUnits > 0);
});

test('near-critical escaping rays accumulate multiple photon orbits', () => {
  const b = 3 * Math.sqrt(3) * 1.01;
  const trace = tracePhoton({ massSolar: 10, impactParameterUnits: b, maxSteps: 200000, step: 0.001 });
  assert.equal(trace.status, 'escaped');
  assert.ok(trace.points.at(-1)!.azimuth > 2 * Math.PI);
});

test('weak-field deflection converges toward 4M/b as the RK4 step is reduced', () => {
  const impactParameterUnits = 50;
  const expected = 4 / impactParameterUnits;
  const coarse = traceAtStep({ massSolar: 10, impactParameterUnits, observerRadiusUnits: 100_000, step: 0.004, maxSteps: 100000 });
  const fine = traceAtStep({ massSolar: 10, impactParameterUnits, observerRadiusUnits: 100_000, step: 0.001, maxSteps: 100000 });
  assert.equal(coarse.status, 'escaped');
  assert.equal(fine.status, 'escaped');
  assert.ok(Math.abs(fine.deflectionRadians! - expected) < Math.abs(coarse.deflectionRadians! - expected));
  assert.ok(Math.abs(fine.deflectionRadians! - expected) < 0.006);
});

test('Newtonian thin disk temperature respects inner edge, rate, and radius', () => {
  const rs = schwarzschildRadius(10); const inner = 3 * rs;
  assert.equal(diskTemperature(10, 1e11, inner), 0);
  const t = diskTemperature(10, 1e11, 4 * rs);
  assert.ok(Number.isFinite(t) && t > 0);
  assert.ok(diskTemperature(10, 2e11, 4 * rs) > t);
  assert.ok(diskTemperature(10, 1e11, 8 * rs) < t);
});

test('shader temperature scale matches the SI thin-disk temperature profile', () => {
  const mass = 10;
  const rate = 1e11;
  const p = createBlackHoleParameters(mass);
  const radius = 4 * p.iscoUnits * p.lengthUnitMeters;
  const normalizedFlux = (1 / (radius / p.lengthUnitMeters)) ** 3 *
    (1 - Math.sqrt(p.iscoUnits / (radius / p.lengthUnitMeters)));
  const reconstructed = diskTemperatureScale(mass, rate) * normalizedFlux ** 0.25;
  assert.ok(Math.abs(reconstructed / diskTemperature(mass, rate, radius) - 1) < 1e-12);
});

test('inputs reject invalid physical values', () => {
  assert.throws(() => schwarzschildRadius(0), RangeError);
  assert.throws(() => impactParameterForMass(-1, 10), RangeError);
  assert.throws(() => diskTemperature(10, -1, 1e6), RangeError);
  assert.throws(() => createBlackHoleParameters(0), RangeError);
  assert.throws(() => createBlackHoleParameters(Infinity), RangeError);
});
