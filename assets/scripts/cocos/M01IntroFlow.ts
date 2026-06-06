// Pure phase machine for the M01 "捡到式" diegetic intro (spec §5.2 交互流程 step 1).
//
// The intro must NOT auto-run end-to-end: it pauses for FOUR player taps —
// tap the right side (atPlatform → walkingToMid), tap the basket once for a gentle nudge
// (observing → reaching), tap the basket AGAIN to actually tip it (nudged → tipping),
// and tap the fallen flashlight (waitingPickup → pickingUp).
// Everything else is animation/physics-driven. Keeping the transition table pure lets the
// "no auto-skip" guarantee be tested without cc. The cc glue (M01IntroSequence) drives the
// animations/tweens and feeds events in; it owns no transition logic of its own.

export type M01IntroPhase =
  | "approaching" // Lemmy auto-walks in and stops in FRONT of the platform (big nut)
  | "atPlatform" // stopped at the platform — WAITS for the player to tap the right side to go on
  | "walkingToMid" // walks right to the platform↔basket midpoint
  | "observing" // stopped at the midpoint, looking at the basket — WAITS for the player to tap the basket
  | "reaching" // walks the last bit to the basket then tiptoes / reaches up (gentle first contact)
  | "nudged" // basket gently swayed once — WAITS for a SECOND basket tap to actually tip it
  | "tipping" // basket wobbles and tips
  | "spillingFragments" // 9 fragments fall and settle
  | "bonking" // flashlight falls out and bonks Lemmy (startle)
  | "waitingPickup" // flashlight on the ground — WAITS for the player to tap it
  | "pickingUp" // Lemmy crouches and picks the flashlight up
  | "acquired"; // flashlight in hand → puzzle phase begins

export type M01IntroEvent =
  | "walkArrived"
  | "advanceTapped"
  | "basketTapped"
  | "reachContact"
  | "tipped"
  | "fragmentsSettled"
  | "flashlightBonked"
  | "flashlightTapped"
  | "crouchDone";

// Exactly one outgoing edge per phase. atPlatform/observing/waitingPickup edges are player-tap
// events, which is what enforces the three mandatory pauses.
const TRANSITIONS: Record<M01IntroPhase, Partial<Record<M01IntroEvent, M01IntroPhase>>> = {
  approaching: { walkArrived: "atPlatform" },
  atPlatform: { advanceTapped: "walkingToMid" },
  walkingToMid: { walkArrived: "observing" },
  observing: { basketTapped: "reaching" },
  reaching: { reachContact: "nudged" },
  nudged: { basketTapped: "tipping" },
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
