import './style.css';
import { DEFAULTS } from './Physics/constants';
import { MASS_LIMITS, createBlackHoleParameters } from './Physics/black-hole-parameters';
import { diskTemperature } from './Physics/accretion-disk';
import type { RenderQuality } from './scene/ray-tracer';
import { BlackHoleWorld, formatKm, formatMassKg } from './scene/world';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Application root element #app is missing');

const presets = [1, 5, 10, 50, 100, 1_000_000, 4_000_000];
const sliderMax = 1000;
const sliderPosition = (mass: number) => Math.round(
  (Math.log10(mass) - Math.log10(MASS_LIMITS.minSolar)) /
  (Math.log10(MASS_LIMITS.maxSolar) - Math.log10(MASS_LIMITS.minSolar)) * sliderMax,
);
const sliderMass = (position: number) => 10 ** (
  Math.log10(MASS_LIMITS.minSolar) +
  (position / sliderMax) * (Math.log10(MASS_LIMITS.maxSolar) - Math.log10(MASS_LIMITS.minSolar))
);

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <a class="brand" href="#"><span class="brand-mark">◉</span><span>NUH</span></a>
      <div class="live"><i id="status-light"></i><span id="status-label">LIVE RAY TRACE</span><span id="clock">00:00:00</span></div>
    </header>
    <section class="layout">
      <aside class="panel">
        <h1>Nuh</h1>
        <p class="intro">GPU-integrated null geodesics around a non-rotating, uncharged black hole. Drag to orbit and scroll to zoom.</p>

        <div class="section-title">BLACK HOLE MASS <span>SOLAR MASSES</span></div>
        <div class="mass-entry"><input id="mass-input" type="number" min="0.1" max="1000000000" step="any" value="10" aria-label="Black hole mass in solar masses"><span>M☉</span></div>
        <input id="mass-slider" class="range mass-slider" type="range" min="0" max="1000" step="1" value="364" aria-label="Logarithmic black hole mass slider">
        <div class="slider-ends"><span>0.1 M☉</span><span>1 billion M☉</span></div>
        <div class="preset-list">${presets.map((mass) => `<button class="preset" type="button" data-mass="${mass}">${mass.toLocaleString()} M☉</button>`).join('')}</div>
        <p id="mass-error" class="error" role="status"></p>

        <div class="section-title properties-title">
          LIVE PHYSICAL PROPERTIES 
            <span>SI / GEOMETRIZED</span>
        </div>
        <div class="readout"><span>Mass</span><strong id="mass-solar"></strong></div>
        <div class="readout"><span>Mass equivalent</span><strong id="mass-kg"></strong></div>
        <div class="readout"><span>Schwarzschild radius</span><strong id="rs"></strong></div>
        <div class="readout"><span>Photon sphere</span><strong id="photon"></strong></div>
        <div class="readout"><span>ISCO</span><strong id="isco"></strong></div>
        <div class="readout"><span>Critical impact parameter</span><strong id="critical"></strong></div>
        <div class="readout"><span>Disk temperature <small>@ 4 × ISCO</small></span><strong id="temperature"></strong></div>
        <div class="readout"><span>Current simulation scale</span><strong id="scale-readout"></strong></div>

        <div class="section-title controls-title">SIMULATION</div>
        <label class="toggle"><span>Disk animation</span><input id="disk-toggle" type="checkbox" checked><b></b></label>
        <label class="toggle"><span>Orbiting tracers</span><input id="particles-toggle" type="checkbox" checked><b></b></label>
        <label class="range-label" for="accretion"><span>Accretion rate</span><output id="accretion-value"></output></label>
        <input id="accretion" class="range" type="range" min="0" max="500000000000" step="10000000000" value="100000000000">
        <label class="range-label" for="quality"><span>Ray tracing quality</span><output id="quality-value">MEDIUM</output></label>
        <select id="quality" class="quality"><option value="low">Low · faster preview</option><option value="medium" selected>Medium · balanced</option><option value="high">High · deeper orbits</option></select>
        <div class="button-row"><button id="pause" class="action">Ⅱ <span>Pause</span></button><button id="reset" class="action">↺ <span>Reset camera</span></button></div>
        <p class="disclaimer">Disk emission uses a Newtonian thin-disk profile. Shader colors, particles, and the spatial embedding are visual aids; the lensing and shadow come from integrated null-geodesic paths.</p>
      </aside>

      <section class="viewport">
        <div id="scene"></div>
        <div class="scene-tag"><span>FIG 01</span> SCHWARZSCHILD NULL GEODESICS</div>
        <div class="orientation">N<br><span>↑</span></div>
        <div class="scale"><i></i> 1 GM/c² <small id="scale-km">normalized scene unit</small></div>
        <div class="bottom-label"><span id="mass-tag">10 M☉</span><span>SUN + LENSED DEEP FIELD</span><span>RK4 · WEBGL2 FRAGMENT RAYS</span></div>
        <div class="help">DRAG TO ORBIT <b>·</b> SCROLL TO ZOOM <b>·</b> RIGHT DRAG TO PAN</div>
      </section>
    </section>
  </main>`;

const input = document.querySelector<HTMLInputElement>('#mass-input')!;
const massSlider = document.querySelector<HTMLInputElement>('#mass-slider')!;
const massError = document.querySelector<HTMLElement>('#mass-error')!;
let currentMass: number = DEFAULTS.massSolar;
let currentAccretionFactor: number = 1;
let currentAccretion: number = DEFAULTS.accretionRateKgPerSecond;
let isPaused = false;
let lastClockSecond = -1;

const world = new BlackHoleWorld({
  mount: document.querySelector<HTMLElement>('#scene')!,
  onFrame: (elapsed) => {
    const second = Math.floor(elapsed);
    if (second === lastClockSecond) return;
    lastClockSecond = second;
    document.querySelector('#clock')!.textContent = new Date(second * 1000).toISOString().slice(11, 19);
  },
});

function updateReadouts(): void {
  const parameters = world.currentParameters;
  const massSolar = parameters.massSolar;
  document.querySelector('#mass-solar')!.textContent = `${massSolar.toLocaleString(undefined, { maximumSignificantDigits: 7 })} M☉`;
  document.querySelector('#mass-kg')!.textContent = formatMassKg(parameters);
  document.querySelector('#rs')!.textContent = formatKm(parameters.schwarzschildRadiusMeters);
  document.querySelector('#photon')!.textContent = formatKm(parameters.photonSphereRadiusMeters);
  document.querySelector('#isco')!.textContent = formatKm(parameters.iscoRadiusMeters);
  document.querySelector('#critical')!.textContent = formatKm(parameters.criticalImpactMeters);
  const diskRadius = 4 * parameters.iscoUnits * parameters.lengthUnitMeters;
  document.querySelector('#temperature')!.textContent = `${(diskTemperature(massSolar, currentAccretion, diskRadius) / 1e6).toPrecision(3)} MK`;
  document.querySelector('#scale-readout')!.textContent = `1 unit = ${formatKm(parameters.lengthUnitMeters)}`;
  document.querySelector('#scale-km')!.textContent = `1 unit = ${formatKm(parameters.lengthUnitMeters)}`;
  document.querySelector('#mass-tag')!.textContent = `${massSolar.toLocaleString(undefined, { maximumSignificantDigits: 7 })} M☉`;
}

function updateAccretionForMass(): void {
  currentAccretion = currentAccretionFactor * DEFAULTS.accretionRateKgPerSecond * currentMass / DEFAULTS.massSolar;
  world.setAccretionRate(currentAccretion);
  document.querySelector('#accretion-value')!.textContent = `${currentAccretion.toExponential(3)} kg/s`;
}

function changeMass(value: number): void {
  try {
    const parameters = createBlackHoleParameters(value);
    world.setBlackHole(parameters);
    currentMass = parameters.massSolar;
    updateAccretionForMass();
    input.value = String(currentMass);
    massSlider.value = String(sliderPosition(currentMass));
    massError.textContent = '';
    input.removeAttribute('aria-invalid');
    updateReadouts();
  } catch (error) {
    input.setAttribute('aria-invalid', 'true');
    massError.textContent = error instanceof Error ? error.message : 'Enter a valid mass.';
  }
}

document.querySelectorAll<HTMLButtonElement>('.preset').forEach((button) => {
  button.addEventListener('click', () => changeMass(Number(button.dataset.mass)));
});
input.addEventListener('change', () => changeMass(Number(input.value)));
massSlider.value = String(sliderPosition(currentMass));
massSlider.addEventListener('input', () => changeMass(sliderMass(Number(massSlider.value))));

document.querySelector<HTMLInputElement>('#disk-toggle')!.addEventListener('change', (event) => {
  world.setDiskAnimated((event.currentTarget as HTMLInputElement).checked);
});
document.querySelector<HTMLInputElement>('#particles-toggle')!.addEventListener('change', (event) => {
  world.setParticlesVisible((event.currentTarget as HTMLInputElement).checked);
});
document.querySelector<HTMLInputElement>('#accretion')!.addEventListener('input', (event) => {
  currentAccretionFactor = Number((event.currentTarget as HTMLInputElement).value);
  updateAccretionForMass();
  updateReadouts();
});
document.querySelector<HTMLSelectElement>('#quality')!.addEventListener('change', (event) => {
  const quality = (event.currentTarget as HTMLSelectElement).value as RenderQuality;
  world.setQuality(quality);
  document.querySelector('#quality-value')!.textContent = quality.toUpperCase();
});
document.querySelector('#pause')!.addEventListener('click', (event) => {
  isPaused = !isPaused;
  world.setPaused(isPaused);
  const button = event.currentTarget as HTMLButtonElement;
  button.innerHTML = isPaused ? '▶ <span>Resume</span>' : 'Ⅱ <span>Pause</span>';
  document.querySelector('#status-label')!.textContent = isPaused ? 'SIMULATION PAUSED' : 'LIVE RAY TRACE';
  document.querySelector('#status-light')!.classList.toggle('paused', isPaused);
});
document.querySelector('#reset')!.addEventListener('click', () => world.resetCamera());
window.addEventListener('beforeunload', () => world.dispose(), { once: true });

const accretionSlider = document.querySelector<HTMLInputElement>('#accretion')!;
accretionSlider.max = '5';
accretionSlider.step = '0.05';
accretionSlider.value = '1';
updateAccretionForMass();
updateReadouts();
