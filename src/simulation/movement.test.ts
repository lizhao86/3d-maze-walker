import { describe, expect, it } from "vitest";
import { getMovementDelta, getYawTowardOpenNeighbor } from "./movement";

describe("getMovementDelta", () => {
  it("moves W toward the camera forward direction and S backward", () => {
    const forward = getMovementDelta({
      yaw: Math.PI,
      inputX: 0,
      inputZ: -1,
      speed: 1,
      delta: 1,
    });
    const backward = getMovementDelta({
      yaw: Math.PI,
      inputX: 0,
      inputZ: 1,
      speed: 1,
      delta: 1,
    });

    expect(forward.z).toBeGreaterThan(0.99);
    expect(backward.z).toBeLessThan(-0.99);
  });

  it("chooses a starting yaw that faces an open neighbor", () => {
    const yaw = getYawTowardOpenNeighbor({
      width: 5,
      height: 5,
      start: { x: 1, y: 1 },
      exit: { x: 3, y: 3 },
      cells: [
        [1, 1, 1, 1, 1],
        [1, 0, 0, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 0, 1],
        [1, 1, 1, 1, 1],
      ],
    });

    expect(yaw).toBeCloseTo(-Math.PI / 2);
  });
});
