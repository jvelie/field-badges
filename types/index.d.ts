// field-badges keeps these values in $.state for the band, the footer and the book to draw from.
// Only field-badges writes them; the badges themselves persist in its own $.store.

/** One earned badge: when, where (the folder the session ran in) and the story line. */
export type FieldBadgesEarned = { at: number; where: string; detail: string }

/** What the band shows for a few seconds: pins dropping in, and a new title's plaque. */
export type FieldBadgesFlash = { pins: string[]; title: string; until: number }

/** Kindled Days as the book shows them: days in all, and the best run of workdays. */
export type FieldBadgesKindled = { count: number; best: number }

declare module 'claude-code' {
  interface PluginState {
    'field-badges': {
      earned: Record<string, FieldBadgesEarned>
      flash: FieldBadgesFlash | null
      hush: boolean
      kindled: FieldBadgesKindled
    }
  }
}
