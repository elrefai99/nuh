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

}
