import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Dialog } from '@/components/Dialog';
import { bootstrapStore, useStore } from '@/store';
import { LibraryPanel } from './LibraryPanel';

describe('LibraryPanel', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
  });

  it('lists the three tiers, highlights the current riff, and filters by search and tag', () => {
    const { container } = render(<LibraryPanel />);
    expect(screen.getByTestId('library-riffs')).toHaveTextContent('Walkdown Turnaround');
    expect(screen.getByTestId('library-arrangements')).toHaveTextContent('Demo verse');
    expect(screen.getByTestId('library-songs')).toHaveTextContent('Demo song');
    expect(
      container
        .querySelector('[data-library-item="demo-riff-walkdown"]')!
        .classList.contains('library__item--current'),
    ).toBe(true);
    fireEvent.change(screen.getByLabelText('search library'), { target: { value: 'turn' } });
    expect(screen.getByTestId('library-riffs')).not.toHaveTextContent('Tritone Chug');
    expect(screen.getByTestId('library-arrangements')).toHaveTextContent('nothing here matches');
    fireEvent.change(screen.getByLabelText('search library'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'tritone' }));
    expect(screen.getByTestId('library-riffs')).not.toHaveTextContent('Walkdown Turnaround');
    expect(screen.getByTestId('library-riffs')).toHaveTextContent('Tritone Chug');
  });

  it('opens on click, shows the dirty dot after an edit, and the context menu renames and deletes', () => {
    const { container } = render(
      <>
        <LibraryPanel />
        <Dialog />
      </>,
    );
    fireEvent.click(container.querySelector('[data-library-item="demo-riff-tritone"]')!);
    expect(useStore.getState().riff.name).toBe('Tritone Chug');
    expect(screen.queryByTestId('dirty-dot')).toBeNull();
    act(() => useStore.getState().setBpm(81));
    expect(screen.getByTestId('dirty-dot')).toBeInTheDocument();

    fireEvent.contextMenu(container.querySelector('[data-library-item="demo-riff-tritone"]')!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'rename' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'rename' }), {
      target: { value: 'Chug' },
    });
    fireEvent.click(screen.getByText('rename', { selector: 'button.dialog__confirm' }));
    expect(useStore.getState().riff.name).toBe('Chug');

    fireEvent.contextMenu(container.querySelector('[data-library-item="demo-riff-tritone"]')!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'delete' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('delete "Chug"?');
    fireEvent.click(screen.getByText('delete', { selector: 'button.dialog__confirm' }));
    expect(useStore.getState().library.riffs.map((r) => r.id)).toEqual(['demo-riff-walkdown']);
    expect(useStore.getState().riff.name).toBe('Walkdown Turnaround');
  });

  it('collapses a group, creates items with +, and drag-appends a riff onto an arrangement', () => {
    const { container } = render(<LibraryPanel />);
    fireEvent.click(screen.getByRole('button', { name: /songs/ }));
    expect(container.querySelector('[data-library-item="demo-song"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'new arrangement' }));
    expect(useStore.getState().library.arrangements).toHaveLength(2);
    expect(useStore.getState().editing).toBe('arrangement');

    const data: Record<string, string> = {};
    const dataTransfer = {
      setData: (k: string, v: string) => (data[k] = v),
      getData: (k: string) => data[k] ?? '',
      effectAllowed: '',
      dropEffect: '',
    };
    fireEvent.dragStart(container.querySelector('[data-library-item="demo-riff-tritone"]')!, {
      dataTransfer,
    });
    const target = container.querySelector('[data-library-item="demo-arr-verse"]')!;
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(useStore.getState().library.arrangements[0]!.entries).toHaveLength(3);
  });
});
