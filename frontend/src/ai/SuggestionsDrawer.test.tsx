import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Riff } from '@/model/types';
import { bootstrapStore, useStore } from '@/store';
import { AnalysisPanel } from './AnalysisPanel';
import { SuggestionsDrawer } from './SuggestionsDrawer';

function card(id: string, riff: Riff, extra: Partial<Riff> = {}) {
  return {
    id,
    kind: 'variation' as const,
    parentRiffId: riff.id,
    model: 'fake',
    riff: { ...structuredClone(riff), id: `${id}-riff`, name: `card ${id}`, ...extra },
    rationale: `because ${id}`,
    playingNotes: 'mute it',
    repairs: id === 'b' ? ['refingered: x'] : [],
  };
}

describe('SuggestionsDrawer', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
  });

  it('renders cards with previews, disables add-as-variation across tunings, and discards', () => {
    const riff = useStore.getState().riff;
    useStore.setState((s) => ({
      ai: {
        ...s.ai,
        drawerOpen: true,
        suggestions: [
          card('a', riff),
          card('b', riff, { tuning: { name: 'Drop Ab', pitches: [32, 39, 44, 49, 53, 58] } }),
        ],
      },
    }));
    render(<SuggestionsDrawer />);
    const cards = screen.getAllByTestId('suggestion-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('because a');
    expect(cards[1]).toHaveTextContent('Drop Ab');
    expect(cards[1]).toHaveTextContent('refingered: x');
    expect(screen.getByLabelText('preview of card a')).toBeInTheDocument();
    const addButtons = screen.getAllByRole('button', { name: 'add as variation' });
    expect(addButtons[0]).toBeEnabled();
    expect(addButtons[1]).toBeDisabled();
    fireEvent.click(screen.getAllByRole('button', { name: 'discard' })[0]!);
    expect(screen.getAllByTestId('suggestion-card')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'close suggestions' }));
    expect(screen.queryByTestId('suggestions-drawer')).toBeNull();
  });

  it('audition toggles the button label and a transport stop ends the audition', () => {
    const riff = useStore.getState().riff;
    useStore.setState((s) => ({
      ai: { ...s.ai, drawerOpen: true, suggestions: [card('a', riff)] },
    }));
    render(<SuggestionsDrawer />);
    fireEvent.click(screen.getByRole('button', { name: 'audition' }));
    expect(screen.getByRole('button', { name: 'stop' })).toBeInTheDocument();
    expect(useStore.getState().isPlaying).toBe(true);
    act(() => useStore.getState().stop());
    expect(useStore.getState().auditionId).toBeNull();
    expect(screen.getByRole('button', { name: 'audition' })).toBeInTheDocument();
  });
});

describe('AnalysisPanel', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
  });

  it('shows dyad chips for the open riff and selects the chord on click', () => {
    const riff = useStore.getState().riff;
    useStore.setState((s) => ({
      ai: {
        ...s.ai,
        analysis: {
          riffId: riff.id,
          dyads: [
            {
              chordId: 'wd-c01',
              label: 'P5',
              altLabels: [],
              root: 'Db',
              inverted: false,
              source: 'model',
            },
            {
              chordId: 'wd-c07',
              label: 'P4',
              altLabels: ['P5 (inv)'],
              root: 'Db',
              inverted: true,
              source: 'computed',
            },
          ],
          style: {
            keyCenterGuess: 'Db',
            modeGuess: 'chromatic minor',
            chromaticDevices: ['walkdown'],
            turnaroundDetected: true,
            summary: 'A turnaround.',
          },
          warnings: ['one warning'],
          model: 'fake',
          promptVersion: 1,
        },
      },
    }));
    render(<AnalysisPanel />);
    const panel = screen.getByTestId('analysis-panel');
    expect(panel).toHaveTextContent('P5');
    expect(panel).toHaveTextContent('P4 (inv)');
    expect(panel).toHaveTextContent('A turnaround.');
    expect(panel).toHaveTextContent('turnaround yes');
    expect(panel).toHaveTextContent('one warning');
    expect(screen.getByRole('button', { name: 'P4 (inv)' })).toHaveClass(
      'ai-analysis__dyad--computed',
    );
    fireEvent.click(screen.getByRole('button', { name: 'P5' }));
    const ids = riff.notes.filter((n) => n.chordId === 'wd-c01').map((n) => n.id);
    expect(useStore.getState().selectedNoteIds).toEqual(ids);
    // Another riff: the panel disappears rather than showing stale labels.
    act(() => useStore.getState().openRiff('demo-riff-tritone'));
    expect(screen.queryByTestId('analysis-panel')).toBeNull();
  });
});
