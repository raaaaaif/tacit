import type { ObservationPacket, RunTrace, Vec3 } from "./types";
import { D, moveTime } from "./geometry";
import { length, sub, clamp } from "./math";

/** The same triangular/trapezoidal velocity law used to time the physical move. */
export function motionFraction(from: Vec3, to: Vec3, elapsed: number) {
  const distance = length(sub(to, from));
  if (distance < 1e-9) return 1;
  const duration = moveTime(from, to);
  const t = clamp(elapsed, 0, duration);
  const acceleration = D.stage.acceleration;
  const ramp = Math.min(D.stage.maxVelocity / acceleration, duration / 2);
  const velocity = acceleration * ramp;
  const position =
    t < ramp
      ? (acceleration * t * t) / 2
      : t > duration - ramp
        ? distance - (acceleration * (duration - t) ** 2) / 2
        : velocity * (t - ramp / 2);
  return clamp(position / distance, 0, 1);
}
export const PARKED_TIP: Vec3 = [0, -1.5, 42];
export function playbackState(trace: RunTrace, time: number) {
  const index = Math.max(
    0,
    trace.events.findLastIndex((e) => e.t <= time),
  );
  const event = trace.events[index],
    previous = trace.events[index - 1];
  const elapsed = Math.max(0, time - event.t);
  const from = previous?.tip ?? PARKED_TIP;
  const fraction =
    event.action.kind === "move" ? motionFraction(from, event.tip, elapsed) : 1;
  const tip = event.tip.map(
    (v, i) => from[i] + (v - from[i]) * fraction,
  ) as Vec3;
  const stroke =
    event.action.kind === "aspirate"
      ? clamp(elapsed / (event.action.volume / event.action.rate), 0, 1)
      : 1;
  const volume =
    (previous?.volume ?? trace.initial.volume) +
    (event.volume - (previous?.volume ?? trace.initial.volume)) * stroke;
  const aspirated =
    (previous?.aspirated ?? 0) +
    (event.aspirated - (previous?.aspirated ?? 0)) * stroke;
  // Evidence and posterior become available at the END of an acquisition.
  const belief =
    event.action.kind === "observe" && elapsed < event.duration
      ? previous?.belief
      : event.action.kind === "aspirate" && previous
        ? {
            ...event.belief,
            volume: event.belief.volume.map(
              (v, i) =>
                previous.belief.volume[i] +
                (v - previous.belief.volume[i]) * stroke,
            ) as [number, number],
          }
        : event.belief;
  return { index, event, previous, tip, volume, aspirated, belief };
}
export function packetAt(
  packets: ObservationPacket[],
  view: "side" | "overhead",
  time: number,
) {
  return packets
    .filter((p) => p.calibration.view === view && p.t <= time + 1e-9)
    .at(-1);
}
