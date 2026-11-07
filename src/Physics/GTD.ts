import { Schwarzschild } from "./Schwarzschild";

export class GravitationalTimeDilation {
     private schwarzschild: Schwarzschild

     constructor() {
          this.schwarzschild = new Schwarzschild(10)
     }

     public GTD(r: number): number {
          return 1 - this.schwarzschild.radius() / r
     }
     calculateLocalTime(radius: number, distantTime: number) {
          if (!Number.isFinite(distantTime) || distantTime < 0) {
               throw new Error("Time must be a non-negative finite number");
          }

          return distantTime * this.GTD(radius);
     }
}
