import { PHYSICS } from "../shared/main";

export class Schwarzschild {
     private mass: number
     constructor(m: number) {
          if (!Number.isFinite(m) || m <= 0) {
               throw new Error("Mass must be a positive finite number");
          }
          this.mass = m * PHYSICS.Sun
     }

     public radius(): number {
          return (2 * PHYSICS.G * this.mass) / PHYSICS.C ** 2;
     }
     public GTD(r: number): number {
          return 1 - this.radius() / r
     }
     calculateLocalTime(radius: number, distantTime: number) {
          if (!Number.isFinite(distantTime) || distantTime < 0) {
               throw new Error("Time must be a non-negative finite number");
          }

          return distantTime * this.GTD(radius);
     }

}
