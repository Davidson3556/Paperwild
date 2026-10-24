export interface EntryPolicyInput {
  /** Must be the result of restoring and validating an unfinished saved game. */
  resumed: boolean;
  hasHistory: boolean;
  /** True only for a known study that belongs to the validated saved game. */
  hasStudy: boolean;
  opponentChosen: unknown;
  hasSeenGuide: unknown;
  hasActiveSeat: boolean;
  hasInvitation: boolean;
}

export interface EntryPolicy {
  entry: 'resume-online' | 'invite' | 'choose' | 'local';
  /** Retained while online entry temporarily gates the local board. */
  localConfirmed: boolean;
  localReady: boolean;
  showGuide: boolean;
  requireChoice: boolean;
}

/** Old versions saved an untouched board automatically, so a valid zero-ply
 * save alone is not evidence that a player selected an opponent. Online entry
 * also keeps the local board locked until the server confirms the player's seat.
 */
export function entryPolicy(input: EntryPolicyInput): EntryPolicy {
  const confirmedLocal = input.resumed && (
    input.hasHistory || input.hasStudy || input.opponentChosen === true
  );
  const entry = input.hasActiveSeat ? 'resume-online'
    : input.hasInvitation ? 'invite'
      : confirmedLocal ? 'local' : 'choose';
  return {
    entry,
    localConfirmed: confirmedLocal,
    localReady: entry === 'local',
    showGuide: input.hasSeenGuide !== true && !confirmedLocal && !input.hasActiveSeat,
    requireChoice: entry === 'choose',
  };
}
