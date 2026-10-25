import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import demo from '@shared/fixtures/demo-library.json';
import { Dialog } from '@/components/Dialog';
import type { LibraryBundle } from '@/model/types';
import { bootstrapStore, useStore } from './index';

const lib = demo as unknown as LibraryBundle;

describe('file slice: importDocument', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
  });

  it('imports a new riff, opens it, and records it as recent and clean', () => {
    const riff = { ...lib.riffs[0]!, id: 'new-one', name: 'New one' };
    useStore.getState().importDocument({ kind: 'riff', value: riff }, 'new-one.riff.json');
    const s = useStore.getState();
    expect(s.library.riffs).toHaveLength(3);
    expect(s.riff.name).toBe('New one');
    expect(s.dirtyRiffIds).not.toContain('new-one');
    expect(s.recent[0]).toMatchObject({ name: 'new-one.riff.json', kind: 'riff', id: 'new-one' });
    expect(s.toasts.at(-1)!.text).toBe('imported 1 item from new-one.riff.json');
  });

  it('asks replace or keep both on a duplicate id', () => {
    render(<Dialog />);
    const edited = { ...lib.riffs[1]!, name: 'Tritone edited' };
    act(() => useStore.getState().importDocument({ kind: 'riff', value: edited }, 'x.riff.json'));
    expect(screen.getByRole('dialog')).toHaveTextContent('already in the library');
    fireEvent.click(screen.getByText('keep both'));
    expect(useStore.getState().library.riffs).toHaveLength(3);
    expect(useStore.getState().riff.name).toBe('Tritone edited (imported)');
    act(() => useStore.getState().importDocument({ kind: 'riff', value: edited }, 'x.riff.json'));
    fireEvent.click(screen.getByText('replace'));
    expect(useStore.getState().library.riffs).toHaveLength(3);
    expect(useStore.getState().library.riffs.find((r) => r.id === 'demo-riff-tritone')!.name).toBe(
      'Tritone edited',
    );
  });

  it('imports a whole bundle and an arrangement', () => {
    useStore.getState().importDocument(
      {
        kind: 'library',
        value: {
          ...lib,
          riffs: lib.riffs.map((r) => ({ ...r, id: `${r.id}-2` })),
          arrangements: [],
          songs: [],
        },
      },
      'lib.json',
    );
    expect(useStore.getState().library.riffs).toHaveLength(4);
    useStore
      .getState()
      .importDocument(
        { kind: 'arrangement', value: { ...lib.arrangements[0]!, id: 'arr-2', name: 'Second' } },
        'a.arr.json',
      );
    expect(useStore.getState().editing).toBe('arrangement');
    expect(useStore.getState().currentArrangementId).toBe('arr-2');
  });
});

describe('file slice: exportWav', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
  });

  it('asks for the voice and the number of passes before rendering', () => {
    useStore.getState().setVoice('heavy');
    useStore.getState().exportWav();
    const dialog = useStore.getState().dialog;
    expect(dialog?.kind).toBe('form');
    expect(dialog?.title).toBe('export WAV');
    if (dialog?.kind !== 'form') throw new Error('expected a form dialog');
    expect(dialog.fields.map((f) => [f.name, f.value])).toEqual([
      ['voice', 'heavy'],
      ['passes', 1],
    ]);
    expect(dialog.fields[1]).toMatchObject({ min: 1, max: 8 });
    useStore.getState().cancelDialog();
    expect(useStore.getState().dialog).toBeNull();
  });
});
