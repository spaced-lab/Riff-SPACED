/**
 * MusicXML 4.0 tablature export (SPEC 7.4, P8.T3). Pure: a riff in, an XML string out.
 *
 * MusicXML is sequential: inside a measure, notes follow one another in time and a chord is
 * written as the first note followed by notes carrying `<chord/>`. Anything that overlaps
 * (the walkdown's Ab2 held under eight moving notes) has to live in another voice, which
 * MusicXML expresses by `<backup>` to the start of the measure. So the writer first turns
 * the riff into events (notes sharing a start and a duration), assigns each event to the
 * first voice that is free at its start, splits events across bar lines with ties, and then
 * writes each measure voice by voice with rests in the gaps.
 *
 * Positions go into `<technical><string>` and `<fret>` so notation apps draw real tab; the
 * open-string tuning goes into `<staff-details>`. Palm mute is `<other-technical>`.
 * Unplayable notes are left out, as in the MIDI export.
 */
import type { Note, Riff } from '@/model/types';
import type { Accidentals } from '@/music/naming';
import { TICKS_PER_BAR } from '@/music/time';
import { pitchOf, stringCount } from '@/music/tuning';

export const DIVISIONS = 480;

const FLAT_STEPS: readonly [string, number][] = [
  ['C', 0],
  ['D', -1],
  ['D', 0],
  ['E', -1],
  ['E', 0],
  ['F', 0],
  ['G', -1],
  ['G', 0],
  ['A', -1],
  ['A', 0],
  ['B', -1],
  ['B', 0],
];
const SHARP_STEPS: readonly [string, number][] = [
  ['C', 0],
  ['C', 1],
  ['D', 0],
  ['D', 1],
  ['E', 0],
  ['F', 0],
  ['F', 1],
  ['G', 0],
  ['G', 1],
  ['A', 0],
  ['A', 1],
  ['B', 0],
];

/** Step, alter and octave for a MIDI number, spelled with flats or sharps. */
export function pitchToXml(
  midi: number,
  accidentals: Accidentals = 'flats',
): { step: string; alter: number; octave: number } {
  const table = accidentals === 'sharps' ? SHARP_STEPS : FLAT_STEPS;
  const [step, alter] = table[((midi % 12) + 12) % 12]!;
  return { step, alter, octave: Math.floor(midi / 12) - 1 };
}

const TYPES: readonly [number, string][] = [
  [1920, 'whole'],
  [960, 'half'],
  [480, 'quarter'],
  [240, 'eighth'],
  [120, '16th'],
  [60, '32nd'],
  [30, '64th'],
];

/** The note type (and dots) whose length is closest to `ticks` without exceeding it. */
export function typeOf(ticks: number): { type: string; dots: number } {
  for (const [length, type] of TYPES) {
    if (ticks >= length * 1.5) return { type, dots: 1 };
    if (ticks >= length) return { type, dots: 0 };
  }
  return { type: '64th', dots: 0 };
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type Event = { start: number; duration: number; notes: Note[] };

/** Notes sharing a start and a duration become one event (one chord in the XML). */
export function eventsOf(notes: readonly Note[]): Event[] {
  const byKey = new Map<string, Event>();
  for (const note of notes) {
    if (note.unplayable) continue;
    const key = `${note.start}:${note.duration}`;
    let event = byKey.get(key);
    if (!event) {
      event = { start: note.start, duration: note.duration, notes: [] };
      byKey.set(key, event);
    }
    event.notes.push(note);
  }
  return [...byKey.values()]
    .map((e) => ({ ...e, notes: [...e.notes].sort((a, b) => b.string - a.string) }))
    .sort((a, b) => a.start - b.start || b.duration - a.duration);
}

/** Greedy voice allocation: an event joins the first voice that is silent when it starts. */
export function assignVoices(events: readonly Event[]): Map<Event, number> {
  const ends: number[] = [];
  const voices = new Map<Event, number>();
  for (const event of events) {
    let voice = ends.findIndex((end) => end <= event.start);
    if (voice === -1) {
      voice = ends.length;
      ends.push(0);
    }
    ends[voice] = event.start + event.duration;
    voices.set(event, voice + 1);
  }
  return voices;
}

type Slice = {
  start: number;
  duration: number;
  notes: Note[];
  tieStart: boolean;
  tieStop: boolean;
};

/** Split an event at bar lines; the pieces are tied together. */
function slicesOf(event: Event, loopEnd: number): Slice[] {
  const out: Slice[] = [];
  let start = event.start;
  const end = Math.min(event.start + event.duration, loopEnd);
  while (start < end) {
    const barEnd = (Math.floor(start / TICKS_PER_BAR) + 1) * TICKS_PER_BAR;
    const pieceEnd = Math.min(end, barEnd);
    out.push({
      start,
      duration: pieceEnd - start,
      notes: event.notes,
      tieStart: pieceEnd < end,
      tieStop: start > event.start,
    });
    start = pieceEnd;
  }
  return out;
}

function restXml(duration: number, voice: number, indent: string): string {
  const { type, dots } = typeOf(duration);
  return [
    `${indent}<note>`,
    `${indent}  <rest/>`,
    `${indent}  <duration>${duration}</duration>`,
    `${indent}  <voice>${voice}</voice>`,
    `${indent}  <type>${type}</type>`,
    ...Array.from({ length: dots }, () => `${indent}  <dot/>`),
    `${indent}</note>`,
  ].join('\n');
}

function noteXml(
  riff: Riff,
  note: Note,
  slice: Slice,
  voice: number,
  chord: boolean,
  accidentals: Accidentals,
  indent: string,
): string {
  const midi = pitchOf(riff.tuning, note.string, note.fret);
  const { step, alter, octave } = pitchToXml(midi, accidentals);
  const { type, dots } = typeOf(slice.duration);
  const techniques = note.techniques ?? [];
  const lines = [`${indent}<note>`];
  if (chord) lines.push(`${indent}  <chord/>`);
  lines.push(
    `${indent}  <pitch>`,
    `${indent}    <step>${step}</step>`,
    ...(alter ? [`${indent}    <alter>${alter}</alter>`] : []),
    `${indent}    <octave>${octave}</octave>`,
    `${indent}  </pitch>`,
    `${indent}  <duration>${slice.duration}</duration>`,
  );
  if (slice.tieStart) lines.push(`${indent}  <tie type="start"/>`);
  if (slice.tieStop) lines.push(`${indent}  <tie type="stop"/>`);
  lines.push(`${indent}  <voice>${voice}</voice>`, `${indent}  <type>${type}</type>`);
  for (let i = 0; i < dots; i++) lines.push(`${indent}  <dot/>`);
  const technical = [
    `${indent}      <string>${note.string}</string>`,
    `${indent}      <fret>${note.fret}</fret>`,
  ];
  if (techniques.includes('palmMute'))
    technical.push(`${indent}      <other-technical>palm mute</other-technical>`);
  if (techniques.includes('hammerOn'))
    technical.push(`${indent}      <hammer-on type="start">H</hammer-on>`);
  if (techniques.includes('pullOff'))
    technical.push(`${indent}      <pull-off type="start">P</pull-off>`);
  const notations = [`${indent}  <notations>`];
  if (slice.tieStart) notations.push(`${indent}    <tied type="start"/>`);
  if (slice.tieStop) notations.push(`${indent}    <tied type="stop"/>`);
  if (techniques.includes('slideUp') || techniques.includes('slideDown'))
    notations.push(`${indent}    <slide type="start"/>`);
  notations.push(`${indent}    <technical>`, ...technical, `${indent}    </technical>`);
  notations.push(`${indent}  </notations>`);
  lines.push(...notations, `${indent}</note>`);
  return lines.join('\n');
}

function attributesXml(riff: Riff, indent: string): string {
  const n = stringCount(riff.tuning);
  const tunings = riff.tuning.pitches.map((midi, i) => {
    // MusicXML numbers tab lines from the bottom: line 1 is the lowest string.
    const { step, alter, octave } = pitchToXml(midi, riff.namingPrefs?.accidentals ?? 'flats');
    return [
      `${indent}    <staff-tuning line="${i + 1}">`,
      `${indent}      <tuning-step>${step}</tuning-step>`,
      ...(alter ? [`${indent}      <tuning-alter>${alter}</tuning-alter>`] : []),
      `${indent}      <tuning-octave>${octave}</tuning-octave>`,
      `${indent}    </staff-tuning>`,
    ].join('\n');
  });
  return [
    `${indent}<attributes>`,
    `${indent}  <divisions>${DIVISIONS}</divisions>`,
    `${indent}  <key><fifths>0</fifths></key>`,
    `${indent}  <time><beats>${riff.timeSignature.beats}</beats><beat-type>${riff.timeSignature.unit}</beat-type></time>`,
    `${indent}  <clef><sign>TAB</sign><line>5</line></clef>`,
    `${indent}  <staff-details>`,
    `${indent}    <staff-lines>${n}</staff-lines>`,
    ...tunings,
    `${indent}  </staff-details>`,
    `${indent}</attributes>`,
  ].join('\n');
}

/** The whole riff as a part-wise MusicXML 4.0 document with one TAB staff. */
export function riffToMusicXml(riff: Riff): string {
  const accidentals = riff.namingPrefs?.accidentals ?? 'flats';
  const loopEnd = riff.lengthBars * TICKS_PER_BAR;
  const events = eventsOf(riff.notes);
  const voices = assignVoices(events);
  const voiceCount = Math.max(1, ...voices.values());
  // Measure -> voice -> slices, in time order.
  const measures: Map<number, Slice[]>[] = Array.from({ length: riff.lengthBars }, () => new Map());
  for (const event of events) {
    const voice = voices.get(event)!;
    for (const slice of slicesOf(event, loopEnd)) {
      const bar = Math.floor(slice.start / TICKS_PER_BAR);
      const list = measures[bar]!.get(voice) ?? [];
      list.push(slice);
      measures[bar]!.set(voice, list);
    }
  }

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="4.0">',
    `  <work><work-title>${escapeXml(riff.name)}</work-title></work>`,
    '  <identification>',
    '    <encoding><software>RIFF-SPACED</software></encoding>',
    '  </identification>',
    '  <part-list>',
    `    <score-part id="P1"><part-name>Guitar (${escapeXml(riff.tuning.name)})</part-name></score-part>`,
    '  </part-list>',
    '  <part id="P1">',
  ];
  for (let bar = 0; bar < riff.lengthBars; bar++) {
    const barStart = bar * TICKS_PER_BAR;
    lines.push(`    <measure number="${bar + 1}">`);
    if (bar === 0) {
      lines.push(attributesXml(riff, '      '));
      lines.push(
        '      <direction placement="above">',
        '        <direction-type><metronome><beat-unit>quarter</beat-unit>' +
          `<per-minute>${riff.tempo.bpm}</per-minute></metronome></direction-type>`,
        `        <sound tempo="${riff.tempo.bpm}"/>`,
        '      </direction>',
      );
    }
    for (let voice = 1; voice <= voiceCount; voice++) {
      const slices = measures[bar]!.get(voice) ?? [];
      if (voice > 1 && slices.length === 0) continue;
      if (voice > 1) lines.push(`      <backup><duration>${TICKS_PER_BAR}</duration></backup>`);
      let cursor = barStart;
      for (const slice of slices) {
        if (slice.start > cursor) lines.push(restXml(slice.start - cursor, voice, '      '));
        slice.notes.forEach((note, i) => {
          lines.push(noteXml(riff, note, slice, voice, i > 0, accidentals, '      '));
        });
        cursor = slice.start + slice.duration;
      }
      const barEnd = barStart + TICKS_PER_BAR;
      if (cursor < barEnd) lines.push(restXml(barEnd - cursor, voice, '      '));
    }
    lines.push('    </measure>');
  }
  lines.push('  </part>', '</score-partwise>', '');
  return lines.join('\n');
}

export function musicXmlBlob(riff: Riff): Blob {
  return new Blob([riffToMusicXml(riff)], { type: 'application/vnd.recordare.musicxml+xml' });
}
