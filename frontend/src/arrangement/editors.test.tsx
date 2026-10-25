import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SongEditor } from '@/song/SongEditor';
import { bootstrapStore, useStore } from '@/store';
import { selectDisplayRiff } from '@/store/derived';
import { TabLanes } from '@/tab/TabLanes';
import { ArrangementEditor } from './ArrangementEditor';

describe('ArrangementEditor', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
    useStore.getState().openArrangement('demo-arr-verse');
  });

  it('lists entries, edits repeats and transpose, reorders, removes, adds, and the tab goes read-only', () => {
    const { container } = render(
      <>
        <ArrangementEditor />
        <TabLanes />
      </>,
    );
    expect(screen.getByTestId('arrangement-meta')).toHaveTextContent(
      '2 entries · 16 bars · 92 bpm · Bb Standard',
    );
    expect(container.querySelector('[data-testid="tab-svg"]')!.getAttribute('data-read-only')).toBe(
      'true',
    );
    expect(container.querySelectorAll('[data-entry-marker]')).toHaveLength(4);
    fireEvent.change(screen.getByLabelText('repeats of entry 1'), { target: { value: '1' } });
    expect(screen.getByTestId('arrangement-meta')).toHaveTextContent('8 bars');
    fireEvent.change(screen.getByLabelText('transpose of entry 2'), { target: { value: '2' } });
    expect(useStore.getState().library.arrangements[0]!.entries[1]!.transpose).toBe(2);
    fireEvent.click(screen.getByLabelText('move entry 2 up'));
    expect(useStore.getState().library.arrangements[0]!.entries[0]!.riffId).toBe(
      'demo-riff-tritone',
    );
    fireEvent.click(screen.getByLabelText('remove entry 1'));
    expect(useStore.getState().library.arrangements[0]!.entries).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('add riff to arrangement'), {
      target: { value: 'demo-riff-tritone' },
    });
    expect(useStore.getState().library.arrangements[0]!.entries).toHaveLength(2);
    const display = selectDisplayRiff(useStore.getState());
    expect(display.readOnly).toBe(true);
    expect(display.riff.lengthBars).toBe(8);
  });

  it('refuses a mismatched tuning through the store and offers to retune from the select', () => {
    const s = useStore.getState();
    const eRiff = {
      ...s.library.riffs[0]!,
      id: 'e',
      name: 'E riff',
      tuning: { name: 'E Standard', pitches: [40, 45, 50, 55, 59, 64] },
    };
    act(() => useStore.setState({ library: { ...s.library, riffs: [...s.library.riffs, eRiff] } }));
    const error = useStore.getState().setArrangementEntries('demo-arr-verse', [
      { riffId: 'demo-riff-walkdown', repeats: 1 },
      { riffId: 'e', repeats: 1 },
    ]);
    expect(error).toMatch(/share one tuning/);
    render(<ArrangementEditor />);
    // The riff in E Standard is offered; choosing it asks to retune (keep pitches) first.
    fireEvent.change(screen.getByLabelText('add riff to arrangement'), { target: { value: 'e' } });
    expect(useStore.getState().dialog?.title).toBe('retune to match the arrangement?');
    act(() => useStore.getState().confirmDialog());
    const after = useStore.getState();
    expect(after.library.arrangements[0]!.entries.map((e) => e.riffId)).toEqual([
      'demo-riff-walkdown',
      'demo-riff-tritone',
      'e',
    ]);
    const retuned = after.library.riffs.find((r) => r.id === 'e')!;
    expect(retuned.tuning.name).toBe('Bb Standard');
    expect(retuned.notes.filter((n) => n.unplayable)).toHaveLength(0);
  });
});

describe('SongEditor', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
    useStore.getState().openSong('demo-song');
  });

  it('shows parts with the total length, adds, reorders, removes, and edits notes', () => {
    render(<SongEditor />);
    expect(screen.getByTestId('song-meta')).toHaveTextContent(
      '1 parts · 16 bars · about 0:42 at 92 bpm',
    );
    fireEvent.change(screen.getByLabelText('add arrangement to song'), {
      target: { value: 'demo-arr-verse' },
    });
    expect(screen.getByTestId('song-meta')).toHaveTextContent('2 parts · 32 bars');
    fireEvent.change(screen.getByLabelText('label of part 2'), { target: { value: 'Verse 2' } });
    fireEvent.click(screen.getByLabelText('move part 2 up'));
    expect(useStore.getState().library.songs[0]!.parts[0]!.label).toBe('Verse 2');
    fireEvent.click(screen.getByLabelText('remove part 1'));
    expect(useStore.getState().library.songs[0]!.parts).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('song notes'), {
      target: { value: 'slow it down live' },
    });
    expect(useStore.getState().library.songs[0]!.notes).toBe('slow it down live');
    expect(selectDisplayRiff(useStore.getState()).riff.lengthBars).toBe(16);
  });
});
