import { describe, expect, it } from 'vitest';
import demo from '@shared/fixtures/demo-library.json';
import walkdownGolden from '@shared/fixtures/golden/walkdown.musicxml?raw';
import { newNote, newRiff } from '@/model/factories';
import type { LibraryBundle } from '@/model/types';
import { assignVoices, eventsOf, pitchToXml, riffToMusicXml, typeOf } from './musicxml';

const lib = demo as unknown as LibraryBundle;
const walkdown = lib.riffs[0]!;

/** Parse with the DOM and fail on a parser error, which jsdom reports as an element. */
function parse(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const error = doc.getElementsByTagName('parsererror')[0];
  if (error) throw new Error(error.textContent ?? 'parse error');
  return doc;
}

describe('musicxml export', () => {
  // The golden was written by this function and read through by hand (bar 4's two voices,
  // the ties, the tuning lines). To regenerate it after an intended change, log the output
  // from a test run and save it over shared/fixtures/golden/walkdown.musicxml.
  it('matches the golden file for the walkdown', () => {
    expect(riffToMusicXml(walkdown)).toBe(walkdownGolden);
  });

  it('is well-formed and carries a TAB staff, the tuning, every note, and palm mutes', () => {
    const doc = parse(riffToMusicXml(walkdown));
    expect(doc.documentElement.tagName).toBe('score-partwise');
    expect(doc.querySelector('clef > sign')?.textContent).toBe('TAB');
    expect(doc.querySelectorAll('staff-tuning')).toHaveLength(6);
    const low = doc.querySelector('staff-tuning[line="1"]')!;
    expect(low.querySelector('tuning-step')?.textContent).toBe('B');
    expect(low.querySelector('tuning-alter')?.textContent).toBe('-1');
    expect(low.querySelector('tuning-octave')?.textContent).toBe('1');
    expect(doc.querySelectorAll('measure')).toHaveLength(4);
    expect(doc.querySelector('divisions')?.textContent).toBe('480');
    expect(doc.querySelector('sound')?.getAttribute('tempo')).toBe('92');
    const notes = [...doc.querySelectorAll('note')].filter((n) => !n.querySelector('rest'));
    expect(notes).toHaveLength(56);
    expect(doc.querySelectorAll('chord')).toHaveLength(23);
    expect(doc.querySelectorAll('other-technical')).toHaveLength(55);
    expect(doc.querySelectorAll('technical > string')).toHaveLength(56);
    // Bar 4 needs two voices: the held Ab2 (longest event first, voice 1) and the walkdown
    // chugs under it (voice 2, reached through one backup). Nothing else overlaps.
    expect(doc.querySelectorAll('backup')).toHaveLength(1);
    expect(doc.querySelector('measure[number="4"] backup')).not.toBeNull();
    const held = [...notes].find((n) => n.querySelector('duration')?.textContent === '1920')!;
    expect(held.querySelector('type')?.textContent).toBe('whole');
    expect(held.querySelector('voice')?.textContent).toBe('1');
    const bar4 = [...doc.querySelectorAll('measure[number="4"] note')].filter(
      (n) => !n.querySelector('rest'),
    );
    expect(bar4.filter((n) => n.querySelector('voice')?.textContent === '2')).toHaveLength(8);
  });

  it('splits a note across the bar line with ties and fills gaps with rests', () => {
    const riff = newRiff();
    riff.notes = [newNote({ string: 6, fret: 3, start: 1440, duration: 960 })];
    const doc = parse(riffToMusicXml(riff));
    const notes = [...doc.querySelectorAll('note')].filter((n) => !n.querySelector('rest'));
    expect(notes).toHaveLength(2);
    expect(notes[0]!.querySelector('tie')?.getAttribute('type')).toBe('start');
    expect(notes[0]!.querySelector('tied')?.getAttribute('type')).toBe('start');
    expect(notes[1]!.querySelector('tie')?.getAttribute('type')).toBe('stop');
    expect(notes[0]!.querySelector('duration')?.textContent).toBe('480');
    expect(notes[1]!.querySelector('duration')?.textContent).toBe('480');
    const rests = [...doc.querySelectorAll('note > rest')].map(
      (r) => r.parentElement!.querySelector('duration')!.textContent,
    );
    // Bar 1: a dotted-half rest before the note; bar 2: the rest of the bar; bars 3 and 4 whole.
    expect(rests).toEqual(['1440', '1440', '1920', '1920']);
    expect(doc.querySelector('note > rest')?.parentElement?.querySelector('dot')).not.toBeNull();
  });

  it('spells pitches, picks note types, groups events and allocates voices', () => {
    expect(pitchToXml(34)).toEqual({ step: 'B', alter: -1, octave: 1 });
    expect(pitchToXml(34, 'sharps')).toEqual({ step: 'A', alter: 1, octave: 1 });
    expect(pitchToXml(60)).toEqual({ step: 'C', alter: 0, octave: 4 });
    expect(typeOf(1920)).toEqual({ type: 'whole', dots: 0 });
    expect(typeOf(720)).toEqual({ type: 'quarter', dots: 1 });
    expect(typeOf(160)).toEqual({ type: '16th', dots: 0 });
    expect(typeOf(10)).toEqual({ type: '64th', dots: 0 });
    const events = eventsOf([
      newNote({ string: 5, fret: 5, start: 0, duration: 240, chordId: 'c' }),
      newNote({ string: 6, fret: 3, start: 0, duration: 240, chordId: 'c' }),
      newNote({ string: 4, fret: 0, start: 0, duration: 1920 }),
      { ...newNote({ string: 3, fret: 0, start: 240, duration: 240 }), unplayable: true },
    ]);
    expect(events.map((e) => [e.start, e.duration, e.notes.map((n) => n.string)])).toEqual([
      [0, 1920, [4]],
      [0, 240, [6, 5]],
    ]);
    const voices = assignVoices(events);
    expect([...voices.values()]).toEqual([1, 2]);
  });

  it('escapes the riff name and skips unplayable notes', () => {
    const riff = { ...newRiff(), name: 'Riff <A & B>' };
    riff.notes = [
      { ...newNote({ string: 6, fret: 3, start: 0, duration: 240 }), unplayable: true },
    ];
    const xml = riffToMusicXml(riff);
    expect(xml).toContain('<work-title>Riff &lt;A &amp; B&gt;</work-title>');
    const doc = parse(xml);
    expect([...doc.querySelectorAll('note')].filter((n) => !n.querySelector('rest'))).toHaveLength(
      0,
    );
  });
});
