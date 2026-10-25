/**
 * The menu tree (SPEC 5.7) as data, built from store state so checkmarks, enabled state and
 * labels (undo <label>) are always current. Items not yet implemented are disabled with a
 * `Phase N` tooltip so the whole tree exists from Phase 5 on and fills in later.
 */
import { openAiSettings } from '@/ai/aiSettings';
import { openCustomRetuneDialog, openTransposeDialog } from '@/music/transposeDialogs';
import { SHORTCUTS } from '@/hooks/keyboard';
import { DROP_PRESETS, SEVEN_STRING_PRESETS, STANDARD_PRESETS } from '@/music/tuning';
import type { AppState } from '@/store';
import { selectRedoLabel, selectUndoLabel } from '@/store/riffSlice';
import { FRET_RANGE_PRESETS } from '@/store/viewSlice';
import { nameOf } from '@/music/naming';
import { COLOR_GROUPS, COLOR_GROUP_LABELS, ROOTS, SCALES } from '@/music/scales';
import { selectScalePosition, selectScalePositions, selectScaleRoot } from '@/store/scaleSlice';
import type { ScaleMode } from '@/store/scaleSlice';

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
    action: () => {
      const flagged = s.setTuning({ name, pitches: [...pitches] });
      if (flagged) s.toast(`${name}: ${flagged} notes flagged unplayable`, 'warn');
    },
  });

  // AI items need the backend up with a key (or the fake) and an open riff (SPEC 9).
  const aiReason =
    s.backend.status !== 'ok'
      ? `backend unreachable at ${s.backend.url}`
      : !s.backend.aiConfigured
        ? 'ANTHROPIC_API_KEY not set'
        : s.editing !== 'riff'
          ? 'open a riff first'
          : s.ai.busy
            ? `${s.ai.busy}...`
            : undefined;
  const aiItem = (id: string, label: string, action: () => void): MenuItem => ({
    type: 'item',
    id,
    label,
    disabled: Boolean(aiReason),
    reason: aiReason,
    action,
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
            {
              type: 'item',
              id: 'file.export.musicxml',
              label: 'MusicXML',
              action: () => void s.exportMusicXml(),
            },
            {
              type: 'item',
              id: 'file.export.wav',
              label: 'WAV...',
              action: () => s.exportWav(),
            },
            later('file.export.pdf', 'PDF', 'backlog'),
          ],
        },
        {
          type: 'item',
          id: 'file.importAudio',
          label: 'Import from audio...',
          disabled: s.backend.status !== 'ok',
          reason: s.backend.status !== 'ok' ? `backend unreachable at ${s.backend.url}` : undefined,
          action: () => s.setImportDialogOpen(true),
        },
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
        {
          type: 'item',
          id: 'edit.transpose',
          label: 'Transpose...',
          disabled: s.editing !== 'riff',
          reason: s.editing !== 'riff' ? 'open a riff first' : undefined,
          action: () => openTransposeDialog(s),
        },
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
        {
          type: 'item',
          id: 'view.dyadLabels',
          label: 'Dyad labels',
          checked: s.showDyadLabels,
          action: () => s.setShowDyadLabels(!s.showDyadLabels),
        },
        {
          type: 'item',
          id: 'view.suggestions',
          label: 'Suggestions drawer',
          checked: s.ai.drawerOpen,
          action: () => s.setAiDrawerOpen(!s.ai.drawerOpen),
        },
        sep,
        {
          type: 'item',
          id: 'view.crt',
          label: 'CRT',
          checked: s.crt,
          action: () => s.setCrt(!s.crt),
        },
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
        {
          type: 'item',
          id: 'tuning.custom',
          label: 'Custom retune...',
          action: () => openCustomRetuneDialog(s),
        },
        {
          type: 'item',
          id: 'tuning.mode',
          label: `Retune mode: ${s.retuneMode === 'keepPitches' ? 'keep pitches' : 'keep shapes'}`,
          checked: s.retuneMode === 'keepPitches',
          action: () =>
            s.setRetuneMode(s.retuneMode === 'keepPitches' ? 'keepShapes' : 'keepPitches'),
        },
        {
          type: 'item',
          id: 'tuning.easier',
          label: 'Find easier tuning...',
          disabled: s.editing !== 'riff',
          reason: s.editing !== 'riff' ? 'open a riff first' : undefined,
          action: () => s.setEasierTuningOpen(true),
        },
      ],
    },
    {
      id: 'scales',
      label: 'Scales',
      items: [
        ...(
          [
            ['off', 'Off'],
            ['color', 'Full color'],
            ['mono', 'Mono'],
          ] as const
        ).map(([mode, label]): MenuItem => ({
          type: 'item',
          id: `scales.mode:${mode}`,
          label,
          checked: s.scaleMode === mode,
          action: () => s.setScaleMode(mode as ScaleMode),
        })),
        sep,
        {
          type: 'item',
          id: 'scales.scale',
          label: 'Scale',
          submenu: SCALES.map((sc) => ({
            type: 'item' as const,
            id: `scales.scale:${sc.id}`,
            label: sc.name,
            checked: s.scaleId === sc.id,
            action: () => s.setScaleId(sc.id),
          })),
        },
        {
          type: 'item',
          id: 'scales.root',
          label: `Root: ${nameOf(selectScaleRoot(s), s.accidentals, false)}`,
          submenu: [
            {
              type: 'item' as const,
              id: 'scales.root:follow',
              label: `Follow tuning (${nameOf(s.riff.tuning.pitches[0] ?? 0, s.accidentals, false)})`,
              checked: s.scaleRoot === null,
              action: () => s.setScaleRoot(null),
            },
            sep,
            ...ROOTS.map((pc) => ({
              type: 'item' as const,
              id: `scales.root:${pc}`,
              label: nameOf(pc, s.accidentals, false),
              checked: s.scaleRoot === pc,
              action: () => s.setScaleRoot(pc),
            })),
          ],
        },
        sep,
        {
          type: 'item',
          id: 'scales.position',
          label: 'Position',
          submenu: [
            {
              type: 'item' as const,
              id: 'scales.position:all',
              label: 'Whole neck',
              checked: s.scalePosition === null,
              action: () => s.setScalePosition(null),
            },
            sep,
            ...selectScalePositions(s).map((p) => ({
              type: 'item' as const,
              id: `scales.position:${p.index}`,
              label: `${p.name}, frets ${p.fromFret}-${p.toFret}`,
              checked: selectScalePosition(s)?.index === p.index,
              action: () => s.setScalePosition(p.index),
            })),
          ],
        },
        {
          type: 'item',
          id: 'scales.positionDown',
          label: 'Position down',
          accelerator: '<',
          action: () => s.stepScalePosition(-1),
        },
        {
          type: 'item',
          id: 'scales.positionUp',
          label: 'Position up',
          accelerator: '>',
          action: () => s.stepScalePosition(1),
        },
        sep,
        ...COLOR_GROUPS.map((group): MenuItem => ({
          type: 'item',
          id: `scales.color:${group}`,
          label: `Color ${COLOR_GROUP_LABELS[group]}`,
          checked: s.scaleColors[group],
          disabled: s.scaleMode !== 'color',
          reason: s.scaleMode !== 'color' ? 'full color mode only' : undefined,
          action: () => s.toggleScaleColor(group),
        })),
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
        aiItem('ai.analyze', 'Analyze riff', () => void s.analyzeCurrentRiff()),
        sep,
        aiItem(
          'ai.variations',
          'Suggest variations',
          () => void s.suggestForCurrentRiff('variation', 2),
        ),
        aiItem(
          'ai.counter',
          'Suggest counter riff',
          () => void s.suggestForCurrentRiff('counterRiff', 1),
        ),
        aiItem(
          'ai.counterMelody',
          'Suggest counter melody',
          () => void s.suggestForCurrentRiff('counterMelody', 1),
        ),
        aiItem(
          'ai.switchUp',
          'Switch up the rhythm',
          () => void s.suggestForCurrentRiff('switchUp', 2),
        ),
        aiItem('ai.simplify', 'Simplify', () => void s.suggestForCurrentRiff('simplify', 1)),
        aiItem('ai.embellish', 'Embellish', () => void s.suggestForCurrentRiff('embellish', 2)),
        aiItem(
          'ai.newInStyle',
          'New riff in this style',
          () => void s.suggestForCurrentRiff('newInStyle', 2),
        ),
        aiItem(
          'ai.fingerings',
          'Alternate fingerings',
          () => void s.suggestForCurrentRiff('fingerings', 2),
        ),
        aiItem('ai.tunings', 'Alternate tunings', () => void s.suggestForCurrentRiff('tunings', 3)),
        sep,
        {
          type: 'item',
          id: 'ai.settings',
          label: 'Settings...',
          action: () => openAiSettings(s),
        },
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
