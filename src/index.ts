import { GravitationalTimeDilation } from "./Physics/GTD";
import { Schwarzschild } from "./Physics/Schwarzschild"

const schwarzschildClass = new Schwarzschild(10)
const GTD = new GravitationalTimeDilation()
const distantTime = 10;

for (const multiplier of [2, 1.5, 1.1]) {
     const radius = schwarzschildClass.radius() * multiplier;

     const localTime = GTD.calculateLocalTime(
          radius,
          distantTime
     );

     console.log({
          distanceFromCenterKm: radius / 1000,
          timeDilationFactor: GTD.GTD(radius),
          distantTime,
          localTime
     });
}
