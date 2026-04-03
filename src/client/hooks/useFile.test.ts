import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFile } from './useFile';

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const mockFileData = {
  content: '# Hello World\nSome content here.',
  sizeBytes: 34,
  modified: '2026-04-01T12:00:00Z',
  tokens: 12,
};

describe('useFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'read_file') return Promise.resolve(mockFileData);
      return Promise.resolve(null);
    });
  });

  it('calls read_file on mount with the given path', async () => {
    const { result } = renderHook(() => useFile('/path/to/file.md'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockInvoke).toHaveBeenCalledWith('read_file', { path: '/path/to/file.md' });
    expect(result.current.data).toEqual(mockFileData);
    expect(result.current.error).toBeNull();
  });

  it('does not call read_file when path is null', async () => {
    const { result } = renderHook(() => useFile(null));

    // Give it a tick to ensure no call is made
    await new Promise(r => setTimeout(r, 50));

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it('calls write_file with updated content on save', async () => {
    const { result } = renderHook(() => useFile('/path/to/file.md'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockInvoke.mockClear();
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'read_file') return Promise.resolve({ ...mockFileData, content: 'Updated' });
      return Promise.resolve(null);
    });

    await act(async () => {
      await result.current.save('Updated content');
    });

    expect(mockInvoke).toHaveBeenCalledWith('write_file', {
      path: '/path/to/file.md',
      content: 'Updated content',
    });

    // Verify it re-reads the file after saving
    expect(mockInvoke).toHaveBeenCalledWith('read_file', { path: '/path/to/file.md' });
  });

  it('sets error state when read_file fails', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('File not found'));

    const { result } = renderHook(() => useFile('/path/to/missing.md'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('File not found');
    expect(result.current.data).toBeNull();
  });

  it('sets error state when write_file fails', async () => {
    const { result } = renderHook(() => useFile('/path/to/file.md'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockInvoke.mockClear();
    mockInvoke.mockRejectedValueOnce(new Error('Permission denied'));

    await act(async () => {
      await result.current.save('New content');
    });

    expect(result.current.error).toBe('Permission denied');
  });
});
