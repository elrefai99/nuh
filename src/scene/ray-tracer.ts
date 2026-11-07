import * as THREE from 'three';
import { DEFAULTS } from '../Physics/constants';
import { diskTemperatureScale } from '../Physics/accretion-disk';
import type { SchwarzschildParameters } from '../Physics/black-hole-parameters';

export type RenderQuality = 'low' | 'medium' | 'high';
const QUALITY = Object.freeze({
  low: { scale: 0.34, steps: 320, dPhi: 0.014 },
  medium: { scale: 0.56, steps: 700, dPhi: 0.012 },
  high: { scale: 0.72, steps: 1500, dPhi: 0.01 },
});

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform vec2 uResolution;
  uniform vec3 uObserver;
  uniform vec3 uForward;
  uniform vec3 uRight;
  uniform vec3 uUp;
  uniform float uTanHalfFov;
  uniform float uAspect;
  uniform float uMass;
  uniform float uHorizon;
  uniform float uDiskInner;
  uniform float uDiskOuter;
  uniform float uAccretion;
  uniform float uTemperatureScale;
  uniform float uStep;
  uniform int uSteps;

  vec2 rhs(vec2 s) { return vec2(s.y, 3.0 * s.x * s.x - s.x); }
  vec2 rk4(vec2 s, float h) {
    vec2 k1 = rhs(s);
    vec2 k2 = rhs(s + 0.5 * h * k1);
    vec2 k3 = rhs(s + 0.5 * h * k2);
    vec2 k4 = rhs(s + h * k3);
    return s + h * (k1 + 2.0 * k2 + 2.0 * k3 + k4) / 6.0;
  }
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  vec3 skyColor(vec3 direction) {
    vec2 uv = vec2(atan(direction.z, direction.x) / 6.2831853 + 0.5,
                   asin(clamp(direction.y, -1.0, 1.0)) / 3.14159265 + 0.5);
    vec2 cell = uv * vec2(620.0, 310.0);
    vec2 id = floor(cell);
    vec2 local = fract(cell) - 0.5;
    float seed = hash21(id);
    float star = (1.0 - smoothstep(0.015, 0.06, length(local - (vec2(hash21(id + 2.1), hash21(id + 7.7)) - 0.5)))) * step(0.991, seed);
    float galacticLatitude = uv.y - (0.49 + 0.11 * sin(uv.x * 6.2) + 0.025 * sin(uv.x * 18.0));
    float nebulaNoise = 0.5 + 0.5 * sin(uv.x * 43.0 + sin(uv.y * 24.0 + uv.x * 8.0)) * cos(uv.y * 37.0 - uv.x * 15.0);
    float dust = exp(-abs(galacticLatitude) * 27.0) * (0.72 + 0.28 * nebulaNoise);
    vec3 deepField = vec3(0.006, 0.009, 0.02) + vec3(0.015, 0.02, 0.04) * dust;
    vec3 starColor = mix(vec3(0.58, 0.72, 1.0), vec3(1.0, 0.74, 0.49), hash21(id + 11.3));
    vec3 sunDirection = normalize(vec3(0.34, 0.23, -0.91));
    float sunAlignment = dot(normalize(direction), sunDirection);
    float solarDisc = smoothstep(0.9995, 0.99995, sunAlignment);
    float solarCorona = exp((sunAlignment - 1.0) * 3000.0) * 0.32;
    vec3 sun = vec3(1.0, 0.72, 0.36) * solarCorona + vec3(1.0, 0.94, 0.78) * solarDisc;
    return deepField + star * starColor + sun;
  }
  vec3 diskColor(float radius, vec3 position, vec3 tangent, float radialDirection) {
    float flux = pow(1.0 / radius, 3.0) * max(0.0, 1.0 - sqrt(uDiskInner / radius));
    float temperature = pow(flux, 0.25) * uTemperatureScale;
    float heat = clamp((log2(max(temperature, 1.0)) - 10.0) / 13.3, 0.0, 1.0);
    vec3 color = mix(vec3(0.8, 0.09, 0.018), vec3(1.0, 0.78, 0.42), heat);
    float orbitalSpeed = inversesqrt(max(radius, uDiskInner));
    float doppler = clamp(dot(tangent, uObserver - position) * orbitalSpeed * radialDirection, -0.4, 0.4);
    color *= 1.0 + doppler;
    float turbulence = 0.92 + 0.08 * sin(position.x * 7.0 + position.z * 11.0);
    return color * turbulence;
  }
  void main() {
    vec2 screen = (gl_FragCoord.xy / uResolution) * 2.0 - 1.0;
    screen.x *= uAspect * uTanHalfFov;
    screen.y *= uTanHalfFov;
    vec3 direction = normalize(uForward + screen.x * uRight + screen.y * uUp);
    float observerRadius = length(uObserver);
    vec3 radialBasis = uObserver / observerRadius;
    float radialCosine = dot(direction, radialBasis);
    vec3 tangentVector = direction - radialCosine * radialBasis;
    float sinAlpha = length(tangentVector);
    float metric = max(1e-6, 1.0 - 2.0 * uMass / observerRadius);
    vec3 color = skyColor(direction);

    if (observerRadius <= uHorizon || radialCosine < -0.99999) {
      gl_FragColor = vec4(vec3(0.001), 1.0);
      return;
    }
    if (sinAlpha > 1e-6) {
      vec3 tangentBasis = tangentVector / sinAlpha;
      float impact = observerRadius * sinAlpha / sqrt(metric);
      float inverseRadius = 1.0 / observerRadius;
      float potential = 1.0 / (impact * impact) - inverseRadius * inverseRadius + 2.0 * uMass * inverseRadius * inverseRadius * inverseRadius;
      if (potential > 0.0) {
        float radialSign = radialCosine < 0.0 ? 1.0 : -1.0;
        vec2 state = vec2(inverseRadius, radialSign * sqrt(potential));
        float phi = 0.0;
        vec3 previous = uObserver;
        bool captured = false;
        bool diskHit = false;
        vec3 hitPosition = vec3(0.0);
        float hitRadius = 0.0;

        for (int i = 0; i < 1800; ++i) {
          if (i >= uSteps) break;
          float radius = 1.0 / state.x;
          if (radius <= uHorizon * 1.001 || state.x >= 0.5) { captured = true; break; }
          if (i > 2 && radius >= observerRadius && state.y < 0.0) break;
          float nextPhi = phi + uStep;
          vec2 nextState = rk4(state, uStep);
          float nextRadius = 1.0 / max(nextState.x, 1e-6);
          vec3 nextPosition = nextRadius * (radialBasis * cos(nextPhi) + tangentBasis * sin(nextPhi));
          if (previous.y * nextPosition.y <= 0.0 && abs(previous.y - nextPosition.y) > 1e-7) {
            float fraction = clamp(previous.y / (previous.y - nextPosition.y), 0.0, 1.0);
            vec3 crossing = mix(previous, nextPosition, fraction);
            float cylinder = length(crossing.xz);
            if (cylinder >= uDiskInner && cylinder <= uDiskOuter) {
              diskHit = true;
              hitPosition = crossing;
              hitRadius = cylinder;
              break;
            }
          }
          previous = nextPosition;
          state = nextState;
          phi = nextPhi;
        }

        if (diskHit) {
          vec3 orbitalTangent = normalize(vec3(-hitPosition.z, 0.0, hitPosition.x));
          color = diskColor(hitRadius, hitPosition, orbitalTangent, sign(radialCosine)) * min(uAccretion, 1.5);
        } else if (captured) {
          color = vec3(0.0005, 0.0008, 0.0012);
        } else {
          float ratio = abs(state.y) / max(state.x, 1e-6);
          float radialOut = ratio * inversesqrt(1.0 + ratio * ratio);
          float tangentialOut = inversesqrt(1.0 + ratio * ratio);
          vec3 outgoingRadial = radialBasis * cos(phi) + tangentBasis * sin(phi);
          vec3 outgoingTangent = -radialBasis * sin(phi) + tangentBasis * cos(phi);
          vec3 outgoing = normalize(radialOut * outgoingRadial + tangentialOut * outgoingTangent);
          color = skyColor(outgoing);
        }
      }
    } else if (radialCosine < 0.0) {
      color = vec3(0.0005, 0.0008, 0.0012);
    }
    gl_FragColor = vec4(color, 1.0);
  }
`;

export class SchwarzschildRayTracer {
  readonly outputPlane: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly passScene = new THREE.Scene();
  private readonly passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: THREE.ShaderMaterial;
  private readonly target: THREE.WebGLRenderTarget;
  private readonly quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private quality: RenderQuality = 'medium';
  private parameters!: SchwarzschildParameters;
  private accretionRate: number = DEFAULTS.accretionRateKgPerSecond;
  private width = 1;
  private height = 1;
  private dirty = true;
  private readonly lastPosition = new THREE.Vector3(Number.POSITIVE_INFINITY, 0, 0);
  private readonly lastQuaternion = new THREE.Quaternion();
  private lastAspect = 0;
  private lastFov = 0;

  constructor(parameters: SchwarzschildParameters) {
    const config = QUALITY[this.quality];
    this.target = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false });
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uResolution: { value: new THREE.Vector2(1, 1) },
        uObserver: { value: new THREE.Vector3() },
        uForward: { value: new THREE.Vector3(0, 0, -1) },
        uRight: { value: new THREE.Vector3(1, 0, 0) },
        uUp: { value: new THREE.Vector3(0, 1, 0) },
        uTanHalfFov: { value: 1 }, uAspect: { value: 1 },
        uMass: { value: 1 }, uHorizon: { value: 2 },
        uDiskInner: { value: parameters.iscoUnits },
        uDiskOuter: { value: parameters.iscoUnits * 2.5 }, uAccretion: { value: 1 },
        uTemperatureScale: { value: diskTemperatureScale(parameters.massSolar, DEFAULTS.accretionRateKgPerSecond) },
        uStep: { value: config.dPhi }, uSteps: { value: config.steps },
      },
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.passScene.add(this.quad);
    this.outputPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: this.target.texture, depthTest: false, depthWrite: false, toneMapped: false }));
    this.outputPlane.renderOrder = -1000;
    this.outputPlane.frustumCulled = false;
    this.setParameters(parameters);
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
    this.dirty = true;
    const config = QUALITY[quality];
    this.material.uniforms.uStep.value = config.dPhi;
    this.material.uniforms.uSteps.value = config.steps;
    this.resize(this.width, this.height);
  }

  setAccretion(rateKgPerSecond: number, referenceRate: number): void {
    if (!Number.isFinite(rateKgPerSecond) || rateKgPerSecond < 0 || !Number.isFinite(referenceRate) || referenceRate <= 0) return;
    this.accretionRate = rateKgPerSecond;
    const referenceForMass = referenceRate * this.parameters.massSolar / DEFAULTS.massSolar;
    this.material.uniforms.uAccretion.value = rateKgPerSecond / referenceForMass;
    this.material.uniforms.uTemperatureScale.value = diskTemperatureScale(this.parameters.massSolar, rateKgPerSecond);
    this.dirty = true;
  }

  setParameters(parameters: SchwarzschildParameters): void {
    this.parameters = parameters;
    this.material.uniforms.uMass.value = 1;
    this.material.uniforms.uHorizon.value = parameters.horizonUnits;
    this.material.uniforms.uDiskInner.value = parameters.iscoUnits;
    this.material.uniforms.uDiskOuter.value = parameters.iscoUnits * 2.5;
    const referenceForMass = DEFAULTS.accretionRateKgPerSecond * parameters.massSolar / DEFAULTS.massSolar;
    this.material.uniforms.uAccretion.value = this.accretionRate / referenceForMass;
    this.material.uniforms.uTemperatureScale.value = diskTemperatureScale(parameters.massSolar, this.accretionRate);
    this.dirty = true;
  }

  render(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, width: number, height: number): void {
    if (width !== this.width || height !== this.height) this.resize(width, height);
    const cameraChanged = camera.position.distanceToSquared(this.lastPosition) > 1e-10 ||
      camera.quaternion.angleTo(this.lastQuaternion) > 1e-6 ||
      camera.aspect !== this.lastAspect || camera.fov !== this.lastFov;
    if (!this.dirty && !cameraChanged) return;
    camera.updateMatrixWorld();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
    this.material.uniforms.uObserver.value.copy(camera.position);
    this.material.uniforms.uForward.value.copy(forward);
    this.material.uniforms.uRight.value.copy(right);
    this.material.uniforms.uUp.value.copy(up);
    this.material.uniforms.uTanHalfFov.value = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    this.material.uniforms.uAspect.value = camera.aspect;
    this.lastPosition.copy(camera.position);
    this.lastQuaternion.copy(camera.quaternion);
    this.lastAspect = camera.aspect;
    this.lastFov = camera.fov;
    const distance = Math.min(camera.far * 0.8, 500);
    this.outputPlane.position.copy(camera.position).addScaledVector(forward, distance);
    this.outputPlane.quaternion.copy(camera.quaternion);
    const halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    this.outputPlane.scale.set(halfHeight * camera.aspect, halfHeight, 1);

    renderer.setRenderTarget(this.target);
    renderer.clear(true, false, false);
    renderer.render(this.passScene, this.passCamera);
    renderer.setRenderTarget(null);
    this.dirty = false;
  }

  resize(width: number, height: number): void {
    if (width !== this.width || height !== this.height) this.dirty = true;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const scale = QUALITY[this.quality].scale;
    const targetWidth = Math.max(1, Math.floor(this.width * scale));
    const targetHeight = Math.max(1, Math.floor(this.height * scale));
    this.target.setSize(targetWidth, targetHeight);
    this.material.uniforms.uResolution.value.set(targetWidth, targetHeight);
  }

  dispose(): void {
    this.target.dispose();
    this.material.dispose();
    this.quad.geometry.dispose();
    this.outputPlane.geometry.dispose();
    this.outputPlane.material.dispose();
  }
}
