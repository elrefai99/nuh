import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DEFAULTS } from '../Physics/constants';
import { createBlackHoleParameters, type SchwarzschildParameters } from '../Physics/black-hole-parameters';
import { diskTemperature } from '../Physics/accretion-disk';
import { SchwarzschildRayTracer, type RenderQuality } from './ray-tracer';

export interface WorldOptions {
  mount: HTMLElement;
  onFrame: (elapsed: number, parameters: SchwarzschildParameters) => void;
}

export class BlackHoleWorld {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1000);
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  readonly horizon: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  readonly particles: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  readonly rayTracer: SchwarzschildRayTracer;
  readonly particleAngles: Float32Array;
  readonly particleRadii: Float32Array;
  readonly particleSpeeds: Float32Array;
  private readonly mount: HTMLElement;
  private readonly onFrame: WorldOptions['onFrame'];
  private readonly clock = new THREE.Clock();
  private readonly resizeObserver: ResizeObserver;
  private parameters = createBlackHoleParameters(DEFAULTS.massSolar);
  private animationFrame = 0;
  private speed = 1;
  private paused = false;
  private particlesVisible = true;
  private diskAnimated = true;
  private particlesMaterialTime = 0;

  constructor({ mount, onFrame }: WorldOptions) {
    this.mount = mount;
    this.onFrame = onFrame;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(mount.clientWidth, mount.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.autoClear = true;
    mount.append(this.renderer.domElement);

    this.camera.position.set(0, 1.8, 28);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 4.1;
    this.controls.maxDistance = 90;
    this.scene.background = new THREE.Color(0x050710);
    this.scene.add(new THREE.AmbientLight(0x8290bd, 0.45));

    this.rayTracer = new SchwarzschildRayTracer(this.parameters);
    this.scene.add(this.rayTracer.outputPlane);
    this.horizon = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshBasicMaterial({ color: 0x010104 }));
    this.scene.add(this.horizon);
    this.scene.add(this.createCurvatureGrid());

    const count = DEFAULTS.particles;
    this.particleAngles = new Float32Array(count);
    this.particleRadii = new Float32Array(count);
    this.particleSpeeds = new Float32Array(count);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      this.particleAngles[i] = Math.random() * Math.PI * 2;
      this.particleRadii[i] = 6.25 + Math.random() * 17.5;
      this.particleSpeeds[i] = this.dimensionlessOrbitalFrequency(this.particleRadii[i]);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particles = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xffd9ad, size: 0.028, transparent: true, opacity: 0.78, sizeAttenuation: true }));
    this.scene.add(this.particles);

    this.setBlackHole(this.parameters);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(mount);
    this.animate();
  }

  get currentParameters(): SchwarzschildParameters { return this.parameters; }
  get simulationScaleKm(): number { return this.parameters.lengthUnitMeters / 1000; }
  setBlackHole(parameters: SchwarzschildParameters): void {
    this.parameters = parameters;
    this.horizon.scale.setScalar(parameters.horizonUnits);
    this.rayTracer.setParameters(parameters);
    // Horizon, disk, particles, and the Flamm grid use GM/c² units, so their
    // geometry is invariant under mass changes; only SI conversions change.
    this.controls.minDistance = parameters.horizonUnits * 2.05;
  }

  setAccretionRate(rateKgPerSecond: number): void {
    this.rayTracer.setAccretion(rateKgPerSecond, DEFAULTS.accretionRateKgPerSecond);
  }
  setQuality(quality: RenderQuality): void { this.rayTracer.setQuality(quality); }
  setSpeed(value: number): void { if (Number.isFinite(value) && value > 0) this.speed = value; }
  setPaused(value: boolean): void { this.paused = value; this.clock.getDelta(); }
  setDiskAnimated(value: boolean): void { this.diskAnimated = value; }
  setParticlesVisible(value: boolean): void { this.particlesVisible = value; }

  resetCamera(): void {
    this.camera.position.set(0, 1.8, 28);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  resize(): void {
    const width = this.mount.clientWidth;
    const height = this.mount.clientHeight;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.rayTracer.resize(width, height);
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.rayTracer.dispose();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private dimensionlessOrbitalFrequency(radiusUnits: number): number {
    return 1 / Math.sqrt(radiusUnits ** 3);
  }

  private createCurvatureGrid(): THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> {
    const vertices: number[] = [];
    const radialRings = [2.15, 2.4, 2.8, 3.5, 4.5, 6, 8, 11, 15, 20, 26, 32];
    const segments = 96;
    const heightAt = (radius: number) => 2 * Math.sqrt(2 * Math.max(0, radius - 2));
    const addSegment = (a: THREE.Vector3, b: THREE.Vector3) => vertices.push(a.x, a.y, a.z, b.x, b.y, b.z);
    for (const radius of radialRings) {
      for (let i = 0; i < segments; i += 1) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        for (const sign of [-1, 1]) {
          const y = sign * heightAt(radius);
          addSegment(new THREE.Vector3(radius * Math.cos(a0), y, radius * Math.sin(a0)), new THREE.Vector3(radius * Math.cos(a1), y, radius * Math.sin(a1)));
        }
      }
    }
    for (let i = 0; i < 32; i += 1) {
      const angle = (i / 32) * Math.PI * 2;
      for (const sign of [-1, 1]) {
        for (let j = 0; j < segments; j += 1) {
          const r0 = 2.15 + (32 - 2.15) * (j / segments);
          const r1 = 2.15 + (32 - 2.15) * ((j + 1) / segments);
          addSegment(
            new THREE.Vector3(r0 * Math.cos(angle), sign * heightAt(r0), r0 * Math.sin(angle)),
            new THREE.Vector3(r1 * Math.cos(angle), sign * heightAt(r1), r1 * Math.sin(angle)),
          );
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const material = new THREE.LineBasicMaterial({ color: 0x65849e, transparent: true, opacity: 0.25, depthWrite: false });
    return new THREE.LineSegments(geometry, material);
  }

  private animate = (): void => {
    this.animationFrame = requestAnimationFrame(this.animate);
    const realDelta = this.clock.getDelta();
    const delta = this.paused ? 0 : realDelta * this.speed;
    if (!this.paused) this.particlesMaterialTime += delta;
    this.particles.visible = this.particlesVisible;
    const positions = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < this.particleAngles.length; i += 1) {
      if (this.diskAnimated && !this.paused) this.particleAngles[i] += this.particleSpeeds[i] * delta;
      const angle = this.particleAngles[i];
      const radius = this.particleRadii[i];
      positions.setXYZ(i, Math.cos(angle) * radius, Math.sin(angle * 2.3 + this.particlesMaterialTime) * 0.018, Math.sin(angle) * radius);
    }
    positions.needsUpdate = true;
    this.controls.update();
    const width = this.mount.clientWidth;
    const height = this.mount.clientHeight;
    this.rayTracer.render(this.renderer, this.camera, width, height);
    this.renderer.render(this.scene, this.camera);
    this.onFrame(this.particlesMaterialTime, this.parameters);
  };
}

export function formatMassKg(parameters: SchwarzschildParameters): string {
  return `${parameters.massKg.toExponential(3)} kg`;
}

export function formatKm(meters: number): string {
  return `${(meters / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} km`;
}

