// Pure phase machine for the M01 "捡到式" diegetic intro (spec §5.2 交互流程 step 1).
//
// The intro must NOT auto-run end-to-end: it pauses for two player taps —
// tap the basket (observing → reaching) and tap the fallen flashlight (waitingPickup → pickingUp).
// Everything else is animation/physics-driven. Keeping the transition table pure lets the
// "no auto-skip" guarantee be tested without cc. The cc glue (M01IntroSequence) drives the
// animations/tweens and feeds events in; it owns no transition logic of its own.

export type M01IntroPhase =
  | "approaching" // Lemmy auto-walks toward the big nut
  | "observing" // stopped, looking at the basket — WAITS for the player to tap the basket
  | "reaching" // tiptoes / reaches up to the basket
  | "tipping" // basket wobbles and tips
  | "spillingFragments" // 9 fragments fall and settle
  | "bonking" // flashlight falls out and bonks Lemmy (startle)
  | "waitingPickup" // flashlight on the ground — WAITS for the player to tap it
  | "pickingUp" // Lemmy crouches and picks the flashlight up
  | "acquired"; // flashlight in hand → puzzle phase begins

export type M01IntroEvent =
  | "walkArrived"
  | "basketTapped"
  | "reachContact"
  | "tipped"
  | "fragmentsSettled"
  | "flashlightBonked"
  | "flashlightTapped"
  | "crouchDone";

// Exactly one outgoing edge per phase. observing/waitingPickup edges are player-tap events,
// which is what enforces the two mandatory pauses.
const TRANSITIONS: Record<M01IntroPhase, Partial<Record<M01IntroEvent, M01IntroPhase>>> = {
  approaching: { walkArrived: "observing" },
  observing: { basketTapped: "reaching" },
  reaching: { reachContact: "tipping" },
  tipping: { tipped: "spillingFragments" },
  spillingFragments: { fragmentsSettled: "bonking" },
  bonking: { flashlightBonked: "waitingPickup" },
  waitingPickup: { flashlightTapped: "pickingUp" },
  pickingUp: { crouchDone: "acquired" },
  acquired: {}
};

/** Pure reducer: returns the next phase, or the same phase if the event doesn't apply. */
export function nextIntroPhase(phase: M01IntroPhase, event: M01IntroEvent): M01IntroPhase {
  return TRANSITIONS[phase][event] ?? phase;
}
