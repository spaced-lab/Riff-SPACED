/**
 * The menu tree (SPEC 5.7) as data, built from store state so checkmarks, enabled state and
 * labels (undo <label>) are always current. Items not yet implemented are disabled with a
 * `Phase N` tooltip so the whole tree exists from Phase 5 on and fills in later.
 */
import { SHORTCUTS } from '@/hooks/keyboard';
import { DROP_PRESETS, SEVEN_STRING_PRESETS, STANDARD_PRESETS } from '@/music/tuning';
import type { AppState } from '@/store';
import { selectRedoLabel, selectUndoLabel } from '@/store/riffSlice';
import { FRET_RANGE_PRESETS } from '@/store/viewSlice';

export type MenuItem =
  | { type: 'separator' }
  | {
      type: 'item';
      id: string;
      label: string;
      accelerator?: string;
      checked?: boolean;
      disabled?: boolean;
      /** Why it is disabled, shown as a tooltip (e.g. `Phase 6`). */
      reason?: string;
      action?: () => void;
      submenu?: MenuItem[];
    };

export type Menu = { id: string; label: string; items: MenuItem[] };

const later = (
  id: string,
  label: string,
  phase: number | string,
  accelerator?: string,
): MenuItem => ({
  type: 'item',
  id,
  label,
  accelerator,
  disabled: true,
  reason: typeof phase === 'number' ? `Phase ${phase}` : phase,
});

const sep: MenuItem = { type: 'separator' };

function libraryHas(s: AppState, kind: 'riff' | 'arrangement' | 'song', id: string): boolean {
  if (kind === 'riff') return s.library.riffs.some((r) => r.id === id);
  if (kind === 'arrangement') return s.library.arrangements.some((a) => a.id === id);
  return s.library.songs.some((x) => x.id === id);
}

export function buildMenus(s: AppState): Menu[] {
  const undoLabel = selectUndoLabel(s);
  const redoLabel = selectRedoLabel(s);
  const hasSelection = s.selectedNoteIds.length > 0;
  const tuningKey = s.riff.tuning.pitches.join();
  const presetItem = (name: string, pitches: readonly number[]): MenuItem => ({
    type: 'item',
    id: `tuning:${name}`,
    label: name,
    checked: pitches.join() === tuningKey,
    action: () => s.setTuning({ name, pitches: [...pitches] }),
  });

  return [
    {
      id: 'file',
      label: 'File',
      items: [
        { type: 'item', id: 'file.newRiff', label: 'New riff', action: () => s.createRiff() },
        {
          type: 'item',
          id: 'file.newArrangement',
          label: 'New arrangement',
          action: () => s.createArrangement(),
        },
        { type: 'item', id: 'file.newSong', label: 'New song', action: () => s.createSong() },
        {
          type: 'item',
          id: 'file.openLibrary',
          label: 'Open from library',
          submenu: s.library.riffs.map((r) => ({
            type: 'item' as const,
            id: `file.open:${r.id}`,
            label: r.name,
            checked: r.id === s.currentRiffId,
            action: () => s.openRiff(r.id),
          })),
        },
        sep,
        {
          type: 'item',
          id: 'file.open',
          label: 'Open...',
          accelerator: 'Ctrl/Cmd+O',
          action: () => void s.openFromDisk(),
        },
        {
          type: 'item',
          id: 'file.save',
          label: 'Save',
          accelerator: 'Ctrl/Cmd+S',
          action: () => void s.saveCurrent(),
        },
        {
          type: 'item',
          id: 'file.saveAs',
          label: 'Save as...',
          action: () => void s.saveCurrent({ saveAs: true }),
        },
        {
          type: 'item',
          id: 'file.importLibrary',
          label: 'Import library...',
          action: () => void s.importLibrary(),
        },
        {
          type: 'item',
          id: 'file.exportLibrary',
          label: 'Export library',
          action: () => void s.exportLibrary(),
        },
        sep,
        {
          type: 'item',
          id: 'file.export',
          label: 'Export',
          submenu: [
            {
              type: 'item',
              id: 'file.export.midi',
              label: 'MIDI...',
              action: () => s.exportMidi(),
            },
            {
              type: 'item',
              id: 'file.export.tab',
              label: 'Text tab',
              action: () => void s.exportTextTab(),
            },
            later('file.export.musicxml', 'MusicXML', 8),
            later('file.export.wav', 'WAV...', 8),
            later('file.export.pdf', 'PDF', 'backlog'),
          ],
        },
        later('file.importAudio', 'Import from audio...', 6),
        {
          type: 'item',
          id: 'file.recent',
          label: 'Recent',
          disabled: s.recent.length === 0,
          reason: s.recent.length === 0 ? 'nothing opened or saved yet' : undefined,
          submenu: s.recent.map((r) => ({
            type: 'item' as const,
            id: `file.recent:${r.id}`,
            label: `${r.name} (${r.kind})`,
            disabled: r.kind !== 'library' && !libraryHas(s, r.kind, r.id),
            reason:
              r.kind !== 'library' && !libraryHas(s, r.kind, r.id)
                ? 'no longer in the library'
                : undefined,
            action: () => {
              if (r.kind === 'riff') s.openRiff(r.id);
              else if (r.kind === 'arrangement') s.openArrangement(r.id);
              else if (r.kind === 'song') s.openSong(r.id);
            },
          })),
        },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        {
          type: 'item',
          id: 'edit.undo',
          label: undoLabel ? `Undo ${undoLabel}` : 'Undo',
          accelerator: 'Ctrl/Cmd+Z',
          disabled: !undoLabel,
          action: () => s.undo(),
        },
        {
          type: 'item',
          id: 'edit.redo',
          label: redoLabel ? `Redo ${redoLabel}` : 'Redo',
          accelerator: 'Ctrl/Cmd+Shift+Z',
          disabled: !redoLabel,
          action: () => s.redo(),
        },
        sep,
        {
          type: 'item',
          id: 'edit.cut',
          label: 'Cut',
          accelerator: 'Ctrl/Cmd+X',
          disabled: !hasSelection,
          action: () => s.cutSelection(),
        },
        {
          type: 'item',
          id: 'edit.copy',
          label: 'Copy',
          accelerator: 'Ctrl/Cmd+C',
          disabled: !hasSelection,
          action: () => s.copySelection(),
        },
        {
          type: 'item',
          id: 'edit.paste',
          label: 'Paste',
          accelerator: 'Ctrl/Cmd+V',
          disabled: s.clipboard.length === 0,
          action: () => s.pasteAtCursor(),
        },
        {
          type: 'item',
          id: 'edit.duplicate',
          label: 'Duplicate',
          accelerator: 'Ctrl/Cmd+D',
          disabled: !hasSelection,
          action: () => s.duplicateSelection(),
        },
        {
          type: 'item',
          id: 'edit.selectAll',
          label: 'Select all',
          accelerator: 'Ctrl/Cmd+A',
          action: () => s.selectAll(),
        },
        {
          type: 'item',
          id: 'edit.delete',
          label: 'Delete',
          accelerator: 'Delete',
          disabled: !hasSelection,
          action: () => s.removeNotes(s.selectedNoteIds),
        },
        sep,
        later('edit.transpose', 'Transpose...', 8),
        {
          type: 'item',
          id: 'edit.quantize',
          label: 'Quantize selection to grid',
          disabled: !hasSelection,
          action: () => s.quantizeSelection(),
        },
        {
          type: 'item',
          id: 'edit.copyTab',
          label: 'Copy as text tab',
          action: () => void s.copyTextTab(),
        },
      ],
    },
    {
      id: 'view',
      label: 'View',
      items: [
        {
          type: 'item',
          id: 'view.letters',
          label: 'Note letters',
          accelerator: 'Tab',
          checked: s.showLetters,
          action: () => s.setShowLetters(!s.showLetters),
        },
        {
          type: 'item',
          id: 'view.sharps',
          label: 'Sharps',
          checked: s.accidentals === 'sharps',
          action: () => s.setAccidentals(s.accidentals === 'sharps' ? 'flats' : 'sharps'),
        },
        {
          type: 'item',
          id: 'view.range',
          label: 'Fret range',
          submenu: FRET_RANGE_PRESETS.map((p) => ({
            type: 'item' as const,
            id: `view.range:${p.label}`,
            label: p.label,
            checked: s.fretRange.from === p.range.from && s.fretRange.to === p.range.to,
            action: () => s.setFretRange(p.range),
          })),
        },
        {
          type: 'item',
          id: 'view.realistic',
          label: 'Realistic fret spacing',
          checked: s.realisticSpacing,
          action: () => s.setRealisticSpacing(!s.realisticSpacing),
        },
        {
          type: 'item',
          id: 'view.ghost',
          label: 'Ghost notes',
          checked: s.ghostNotes,
          action: () => s.setGhostNotes(!s.ghostNotes),
        },
        {
          type: 'item',
          id: 'view.follow',
          label: 'Follow playhead',
          checked: s.followPlayhead,
          action: () => s.setFollowPlayhead(!s.followPlayhead),
        },
        {
          type: 'item',
          id: 'view.split',
          label: 'Split view',
          checked: s.splitView,
          action: () => s.setSplitView(!s.splitView),
        },
        sep,
        {
          type: 'item',
          id: 'view.library',
          label: 'Library panel',
          checked: s.panels.library,
          action: () => s.togglePanel('library'),
        },
        {
          type: 'item',
          id: 'view.inspector',
          label: 'Inspector panel',
          checked: s.panels.inspector,
          action: () => s.togglePanel('inspector'),
        },
        sep,
        later('view.crt', 'CRT', 8),
      ],
    },
    {
      id: 'tuning',
      label: 'Tuning',
      items: [
        {
          type: 'item',
          id: 'tuning.standard',
          label: 'Standard',
          submenu: STANDARD_PRESETS.map((t) => presetItem(t.name, t.pitches)),
        },
        {
          type: 'item',
          id: 'tuning.drop',
          label: 'Drop',
          submenu: DROP_PRESETS.map((t) => presetItem(t.name, t.pitches)),
        },
        {
          type: 'item',
          id: 'tuning.seven',
          label: 'Seven string',
          submenu: SEVEN_STRING_PRESETS.map((t) => presetItem(t.name, t.pitches)),
        },
        sep,
        later('tuning.custom', 'Custom retune...', 8),
        later('tuning.mode', 'Retune mode: keep shapes', 8),
        later('tuning.easier', 'Find easier tuning...', 8),
      ],
    },
    {
      id: 'playback',
      label: 'Playback',
      items: [
        {
          type: 'item',
          id: 'playback.play',
          label: s.isPlaying ? 'Stop' : 'Play',
          accelerator: 'Space',
          action: () => s.togglePlay(),
        },
        {
          type: 'item',
          id: 'playback.loop',
          label: 'Loop',
          accelerator: 'L',
          checked: s.loopEnabled,
          action: () => s.setLoopEnabled(!s.loopEnabled),
        },
        {
          type: 'item',
          id: 'playback.countIn',
          label: 'Count-in',
          checked: s.countIn,
          action: () => s.setCountIn(!s.countIn),
        },
        {
          type: 'item',
          id: 'playback.metronome',
          label: 'Metronome',
          checked: s.metronome,
          action: () => s.setMetronome(!s.metronome),
        },
        {
          type: 'item',
          id: 'playback.voice',
          label: 'Voice',
          submenu: [
            {
              type: 'item',
              id: 'playback.voice:basic',
              label: 'Basic',
              checked: s.voice === 'basic',
              action: () => s.setVoice('basic'),
            },
            {
              type: 'item',
              id: 'playback.voice:heavy',
              label: 'Heavy',
              checked: s.voice === 'heavy',
              action: () => s.setVoice('heavy'),
            },
          ],
        },
        {
          type: 'item',
          id: 'playback.solo',
          label: 'Solo section',
          submenu: [
            {
              type: 'item',
              id: 'playback.solo:none',
              label: 'Whole riff',
              checked: s.soloSectionId === null,
              action: () => s.setSoloSection(null),
            },
            ...s.riff.sections.map((sec) => ({
              type: 'item' as const,
              id: `playback.solo:${sec.id}`,
              label: `${sec.label} (bars ${sec.startBar + 1}-${sec.startBar + sec.lengthBars})`,
              checked: s.soloSectionId === sec.id,
              action: () => s.setSoloSection(sec.id),
            })),
          ],
        },
      ],
    },
    {
      id: 'ai',
      label: 'AI',
      items: [
        later('ai.analyze', 'Analyze riff', 7),
        later('ai.variations', 'Suggest variations', 7),
        later('ai.counter', 'Suggest counter riff', 7),
        later('ai.simplify', 'Simplify', 7),
        later('ai.embellish', 'Embellish', 7),
        later('ai.fingerings', 'Alternate fingerings', 7),
        later('ai.tunings', 'Alternate tunings', 7),
        sep,
        later('ai.settings', 'Settings...', 7),
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        {
          type: 'item',
          id: 'help.shortcuts',
          label: 'Keyboard shortcuts',
          action: () =>
            s.openDialog({
              kind: 'info',
              title: 'keyboard shortcuts',
              table: {
                headers: ['keys', 'action'],
                rows: SHORTCUTS.map((sc) => [sc.keys, sc.description]),
              },
              confirmLabel: 'close',
            }),
        },
        {
          type: 'item',
          id: 'help.about',
          label: 'About',
          action: () =>
            s.openDialog({
              kind: 'info',
              title: 'RIFF-SPACED',
              message:
                'A browser riff editor for low-tuned, chromatic heavy music. Built in public with Claude Code; every commit is a lesson. MIT licensed, 2026 Ridley DiSiena (SPACED).',
              confirmLabel: 'close',
            }),
        },
        {
          type: 'item',
          id: 'help.docs',
          label: 'Open docs',
          action: () =>
            window.open(
              'https://github.com/spaced-lab/Riff-SPACED/tree/main/docs',
              '_blank',
              'noopener',
            ),
        },
      ],
    },
  ];
}
