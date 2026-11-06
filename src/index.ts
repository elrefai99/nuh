import { Schwarzschild } from "./Physics/Schwarzschild"

const schwarzschildClass = new Schwarzschild(1)
const distantTime = 10;

for (const multiplier of [2, 1.5, 1.1]) {
     const radius = schwarzschildClass.radius() * multiplier;

     const localTime = schwarzschildClass.calculateLocalTime(
          radius,
          distantTime
     );

     console.log({
          distanceFromCenterKm: radius / 1000,
          timeDilationFactor: schwarzschildClass.GTD(radius),
          distantTime,
          localTime
     });
     console.log({
          distanceFromCenterKm: radius / 1000,
          timeDilationFactor: schwarzschildClass.GTD(radius),
          distantTime,
          localTime
     });
}
