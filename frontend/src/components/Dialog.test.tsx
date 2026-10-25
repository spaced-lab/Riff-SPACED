import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapStore, useStore } from '@/store';
import { Dialog } from './Dialog';
import { Toasts } from './Toast';

describe('Dialog kinds and toasts', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
  });

  it('prompt returns the typed text on Enter and nothing on cancel', () => {
    render(<Dialog />);
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    act(() =>
      useStore
        .getState()
        .openDialog({ kind: 'prompt', title: 'name', defaultValue: 'old', onConfirm, onCancel }),
    );
    const input = screen.getByRole('textbox', { name: 'name' });
    expect(input).toHaveValue('old');
    fireEvent.change(input, { target: { value: 'new name' } });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledWith('new name');
    act(() =>
      useStore.getState().openDialog({ kind: 'prompt', title: 'again', onConfirm, onCancel }),
    );
    fireEvent.click(screen.getByText('cancel'));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('form returns the edited values typed per field', () => {
    render(<Dialog />);
    const onConfirm = vi.fn();
    act(() =>
      useStore.getState().openDialog({
        kind: 'form',
        title: 'export',
        fields: [
          { name: 'name', label: 'file name', type: 'text', value: 'riff' },
          { name: 'bars', label: 'bars', type: 'number', value: 4, min: 1, max: 64 },
          { name: 'split', label: 'channel per string', type: 'checkbox', value: false },
          {
            name: 'voice',
            label: 'voice',
            type: 'select',
            value: 'basic',
            options: [
              { value: 'basic', label: 'basic' },
              { value: 'heavy', label: 'heavy' },
            ],
          },
        ],
        onConfirm,
      }),
    );
    fireEvent.change(screen.getByLabelText('bars'), { target: { value: '8' } });
    fireEvent.click(screen.getByLabelText('channel per string'));
    fireEvent.change(screen.getByLabelText('voice'), { target: { value: 'heavy' } });
    fireEvent.click(screen.getByText('ok'));
    expect(onConfirm).toHaveBeenCalledWith({ name: 'riff', bars: 8, split: true, voice: 'heavy' });
  });

  it('info shows a table and only a close button; toasts appear and dismiss', () => {
    vi.useFakeTimers();
    render(
      <>
        <Dialog />
        <Toasts />
      </>,
    );
    act(() =>
      useStore.getState().openDialog({
        kind: 'info',
        title: 'about',
        table: { headers: ['a', 'b'], rows: [['1', '2']] },
        confirmLabel: 'close',
      }),
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('1');
    expect(screen.queryByText('cancel')).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => useStore.getState().toast('saved riff.json'));
    expect(screen.getByTestId('toasts')).toHaveTextContent('saved riff.json');
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.queryByTestId('toasts')).toBeNull();
    vi.useRealTimers();
  });
});
