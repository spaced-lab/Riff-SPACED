/**
 * ASCII tab export (SPEC 7.2). One line per string with string 1 on top, the open-string
 * name at the left, a `|` at every bar line, one character per sixteenth, fret numbers at
 * their sixteenth (two-digit frets right-aligned over the previous column, the usual tab
 * convention), a legend line with `p` under palm-muted columns, four bars per system.
 *
 * Eighth-note riffs therefore read `5-5-4-4-3-3-2-2-`, the way guitarists write them.
 * Durations are not drawn; a held note is its fret followed by dashes.
 */
import type { Riff } from '@/model/types';
import { nameOf } from '@/music/naming';
import { TICKS_PER_BAR } from '@/music/time';
import { pitchOf } from '@/music/tuning';

export const COLUMNS_PER_BAR = 16;
export const TICKS_PER_COLUMN = TICKS_PER_BAR / COLUMNS_PER_BAR;
export const BARS_PER_SYSTEM = 4;

export type TextTabOptions = { barsPerSystem?: number };

function place(row: string[], column: number, text: string): void {
  // Right-align: a two-digit fret ends at its column and spills one column to the left,
  // unless that column already holds a digit, in which case it spills to the right.
  if (text.length === 1) {
    row[column] = text;
    return;
  }
  const left = column - 1;
  if (left >= 0 && row[left] === '-') {
    row[left] = text[0]!;
    row[column] = text[1]!;
  } else {
    row[column] = text[0]!;
    if (column + 1 < row.length) row[column + 1] = text[1]!;
  }
}

/** Render a riff to ASCII tab. Pure: no DOM. */
export function riffToTextTab(riff: Riff, options: TextTabOptions = {}): string {
  const barsPerSystem = options.barsPerSystem ?? BARS_PER_SYSTEM;
  const stringCount = riff.tuning.pitches.length;
  const totalColumns = riff.lengthBars * COLUMNS_PER_BAR;

  // One character row per string (index 0 = string 1), plus the legend.
  const rows: string[][] = Array.from({ length: stringCount }, () =>
    Array<string>(totalColumns).fill('-'),
  );
  const legend = Array<string>(totalColumns).fill('-');
  const sorted = [...riff.notes].sort((a, b) => a.start - b.start || a.string - b.string);
  for (const n of sorted) {
    const column = Math.round(n.start / TICKS_PER_COLUMN);
    if (column < 0 || column >= totalColumns) continue;
    place(rows[n.string - 1]!, column, String(n.fret));
    if (n.techniques?.includes('palmMute')) legend[column] = 'p';
  }

  const labels = Array.from({ length: stringCount }, (_, i) =>
    nameOf(
      pitchOf(riff.tuning, i + 1, 0),
      riff.namingPrefs?.accidentals ?? 'flats',
      false,
    ).padStart(2, ' '),
  );
  const tuningNames = riff.tuning.pitches
    .map((p) => nameOf(p, riff.namingPrefs?.accidentals ?? 'flats', true))
    .join(' ');
  const header = [
    riff.name,
    `${riff.tuning.name} (${tuningNames}), ${riff.tempo.bpm} bpm, ${riff.lengthBars} bars`,
    '',
  ];

  const systems: string[] = [];
  for (let firstBar = 0; firstBar < riff.lengthBars; firstBar += barsPerSystem) {
    const lastBar = Math.min(riff.lengthBars, firstBar + barsPerSystem);
    const slice = (row: string[]) => {
      let line = '|';
      for (let bar = firstBar; bar < lastBar; bar++) {
        line += row.slice(bar * COLUMNS_PER_BAR, (bar + 1) * COLUMNS_PER_BAR).join('') + '|';
      }
      return line;
    };
    const lines = rows.map((row, i) => `${labels[i]}${slice(row)}`);
    lines.push(`  ${slice(legend)}`);
    systems.push(lines.join('\n'));
  }
  return `${header.join('\n')}\n${systems.join('\n\n')}\n`;
}
