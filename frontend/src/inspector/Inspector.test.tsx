import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { bootstrapStore, useStore } from '@/store';
import { Inspector } from './Inspector';

describe('Inspector', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
  });

  it('names the demo walkdown chord P5 with root Db and the and-of-4 chord P4 inverted', () => {
    render(<Inspector />);
    expect(screen.getByTestId('note-panel')).toHaveTextContent('no note selected');
    const riff = useStore.getState().riff;
    const c01 = riff.notes.filter((n) => n.chordId === 'wd-c01').map((n) => n.id);
    act(() => useStore.getState().select(c01));
    expect(screen.getByTestId('dyad-info')).toHaveTextContent('P5');
    expect(screen.getByTestId('dyad-info')).toHaveTextContent('root Db');
    expect(screen.getByTestId('dyad-info')).not.toHaveTextContent('inverted');
    const c07 = riff.notes.filter((n) => n.chordId === 'wd-c07').map((n) => n.id);
    act(() => useStore.getState().select(c07));
    expect(screen.getByTestId('dyad-info')).toHaveTextContent('P4');
    expect(screen.getByTestId('dyad-info')).toHaveTextContent('root Db, inverted (root on top)');
    act(() => useStore.getState().setAccidentals('sharps'));
    expect(screen.getByTestId('dyad-info')).toHaveTextContent('root C#');
  });

  it('shows note fields and edits velocity and techniques through commit', () => {
    render(<Inspector />);
    const note = useStore.getState().riff.notes[0]!;
    act(() => useStore.getState().select([note.id]));
    const fields = screen.getByTestId(`note-fields-${note.id}`);
    expect(fields).toHaveTextContent('string 6 fret 0 = Bb1');
    expect(fields).toHaveTextContent('01.1.000');
    expect(fields).toHaveTextContent('240 ticks');
    fireEvent.change(screen.getByLabelText(`velocity of ${note.id}`), { target: { value: '64' } });
    expect(useStore.getState().riff.notes[0]!.velocity).toBe(64);
    fireEvent.click(screen.getByLabelText('letRing'));
    expect(useStore.getState().riff.notes[0]!.techniques).toEqual(['palmMute', 'letRing']);
    fireEvent.click(screen.getByLabelText('palmMute'));
    expect(useStore.getState().riff.notes[0]!.techniques).toEqual(['letRing']);
    expect(useStore.getState().history.past.map((h) => h.label)).toEqual([
      'edit note',
      'edit note',
      'edit note',
    ]);
  });

  it('lists sections with split and merge and jumps the cursor', () => {
    render(<Inspector />);
    fireEvent.click(screen.getByText('split'));
    expect(useStore.getState().riff.sections).toHaveLength(2);
    fireEvent.click(screen.getAllByTitle('go to section')[1]!);
    expect(useStore.getState().editCursorTick).toBe(2 * 1920);
    fireEvent.change(screen.getByLabelText('section 2 kind'), { target: { value: 'turnaround' } });
    expect(useStore.getState().riff.sections[1]!.kind).toBe('turnaround');
    fireEvent.click(screen.getAllByText('merge')[0]!);
    expect(useStore.getState().riff.sections).toHaveLength(1);
  });
});
