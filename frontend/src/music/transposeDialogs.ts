import { stringCount, isValidTuning, pitchOf } from '@/music/tuning';
import { nameOf } from '@/music/naming';
import { transposeRiff } from '@/music/transpose';
import type { AppState } from '@/store';

/**
 * The Edit > Transpose and Tuning > Custom retune dialogs (SPEC 3.7, P8.T1). Both are
 * themed form dialogs; transpose previews how many notes would be flagged before applying
 * and asks once more when that number is not zero.
 */
export function openTransposeDialog(s: AppState): void {
  s.openDialog({
    kind: 'form',
    title: 'transpose',
    message:
      'shift every pitch and refinger on the same tuning. unreachable notes are flagged amber, never removed.',
    fields: [
      {
        name: 'semitones',
        label: 'semitones (-12 to 12)',
        type: 'number',
        value: 2,
        min: -12,
        max: 12,
      },
    ],
    confirmLabel: 'preview',
    onConfirm: (values) => {
      const semitones = Math.max(-12, Math.min(12, Math.round(Number(values.semitones) || 0)));
      if (semitones === 0) return;
      const preview = transposeRiff(s.riff, semitones);
      const sign = semitones > 0 ? '+' : '';
      const apply = () => {
        const flagged = s.transpose(semitones);
        s.toast(
          flagged
            ? `transposed ${sign}${semitones}: ${flagged} notes flagged unplayable`
            : `transposed ${sign}${semitones}, every note playable`,
          flagged ? 'warn' : 'info',
        );
      };
      if (preview.unplayable === 0) {
        apply();
        return;
      }
      s.openDialog({
        kind: 'confirm',
        title: `transpose ${sign}${semitones}?`,
        message: `${preview.unplayable} of ${s.riff.notes.length} notes have no fingering on ${s.riff.tuning.name} and will be flagged amber (kept, silent). Continue?`,
        confirmLabel: 'transpose',
        danger: true,
        onConfirm: apply,
      });
    },
  });
}

export function openCustomRetuneDialog(s: AppState): void {
  const tuning = s.riff.tuning;
  const n = stringCount(tuning);
  s.openDialog({
    kind: 'form',
    title: 'custom retune',
    message: `semitones per string from the current ${tuning.name} (retune mode: ${
      s.retuneMode === 'keepPitches' ? 'keep pitches' : 'keep shapes'
    }).`,
    fields: Array.from({ length: n }, (_, i) => {
      const string = n - i;
      return {
        name: `s${string}`,
        label: `string ${string} (${nameOf(pitchOf(tuning, string, 0), s.accidentals)})`,
        type: 'number' as const,
        value: 0,
        min: -12,
        max: 12,
      };
    }),
    confirmLabel: 'retune',
    onConfirm: (values) => {
      const pitches = tuning.pitches.map((p, i) => {
        const string = n - i;
        return p + Math.round(Number(values[`s${string}`]) || 0);
      });
      if (pitches.join() === tuning.pitches.join()) return;
      if (!isValidTuning({ pitches })) {
        s.toast(
          'that tuning is not valid: strings must rise from low to high within MIDI 20 to 70',
          'warn',
        );
        return;
      }
      const flagged = s.setTuning({ name: 'Custom', pitches });
      s.toast(flagged ? `retuned: ${flagged} notes flagged unplayable` : 'retuned to Custom');
    },
  });
}
