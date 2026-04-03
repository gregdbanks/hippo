import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MemoryBrowser from './MemoryBrowser';

// Mock @tauri-apps/api/core
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Mock useDiscovery to avoid its own invoke call
vi.mock('../hooks/useDiscovery', () => ({
  useDiscovery: () => ({
    data: { projects: [] },
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

const mockMemories = [
  {
    filename: 'feedback_testing.md',
    path: '/home/user/.claude/projects/my-project/memory/feedback_testing.md',
    name: 'Testing Feedback',
    description: 'Always write tests first',
    type: 'feedback',
    sizeBytes: 256,
    tokens: 80,
    modified: new Date().toISOString(),
    staleness: 'current' as const,
  },
  {
    filename: 'project_overview.md',
    path: '/home/user/.claude/projects/my-project/memory/project_overview.md',
    name: 'Project Overview',
    description: 'Main project description',
    type: 'project',
    sizeBytes: 512,
    tokens: 150,
    modified: new Date(Date.now() - 86400000 * 40).toISOString(),
    staleness: 'stale' as const,
  },
];

function renderMemoryBrowser(slug = 'my-project') {
  return render(
    <MemoryRouter initialEntries={[`/memories/${slug}`]}>
      <Routes>
        <Route path="/memories/:slug" element={<MemoryBrowser />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('MemoryBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_memories') return Promise.resolve(mockMemories);
      return Promise.resolve(null);
    });
  });

  it('renders memories after loading', async () => {
    renderMemoryBrowser();

    await waitFor(() => {
      expect(screen.getByText('Testing Feedback')).toBeInTheDocument();
      expect(screen.getByText('Project Overview')).toBeInTheDocument();
    });

    expect(mockInvoke).toHaveBeenCalledWith('get_memories', { slug: 'my-project' });
  });

  describe('delete flow', () => {
    it('calls delete_file with correct path after confirmation', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderMemoryBrowser();

      await waitFor(() => {
        expect(screen.getByText('Testing Feedback')).toBeInTheDocument();
      });

      // Reset to track calls after initial load
      mockInvoke.mockClear();
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'get_memories') return Promise.resolve([]);
        return Promise.resolve(null);
      });

      const deleteButtons = screen.getAllByText('Delete');
      await user.click(deleteButtons[0]);

      expect(confirmSpy).toHaveBeenCalledWith('Delete "Testing Feedback"? This cannot be undone.');
      expect(mockInvoke).toHaveBeenCalledWith('delete_file', {
        path: '/home/user/.claude/projects/my-project/memory/feedback_testing.md',
      });

      // Verify it refreshes the list after delete
      expect(mockInvoke).toHaveBeenCalledWith('get_memories', { slug: 'my-project' });

      confirmSpy.mockRestore();
    });

    it('does not delete when confirmation is cancelled', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderMemoryBrowser();

      await waitFor(() => {
        expect(screen.getByText('Testing Feedback')).toBeInTheDocument();
      });

      mockInvoke.mockClear();

      const deleteButtons = screen.getAllByText('Delete');
      await user.click(deleteButtons[0]);

      expect(confirmSpy).toHaveBeenCalled();
      expect(mockInvoke).not.toHaveBeenCalledWith('delete_file', expect.anything());

      confirmSpy.mockRestore();
    });
  });

  describe('create memory form', () => {
    it('shows create form when New Memory is clicked and submits', async () => {
      const user = userEvent.setup();

      renderMemoryBrowser();

      await waitFor(() => {
        expect(screen.getByText('Testing Feedback')).toBeInTheDocument();
      });

      // Open the create form
      await user.click(screen.getByText('New Memory'));

      // Fill in the form
      const filenameInput = screen.getByPlaceholderText('feedback_my_rule');
      const nameInput = screen.getByPlaceholderText('Human-readable name');
      const descInput = screen.getByPlaceholderText('Brief description for the index');

      await user.type(filenameInput, 'feedback_new_rule');
      await user.type(nameInput, 'New Rule');
      await user.type(descInput, 'A new feedback rule');

      mockInvoke.mockClear();
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'get_memories') return Promise.resolve(mockMemories);
        return Promise.resolve(null);
      });

      // Submit
      await user.click(screen.getByText('Create Memory'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('create_memory', {
          input: {
            slug: 'my-project',
            filename: 'feedback_new_rule',
            name: 'New Rule',
            description: 'A new feedback rule',
            memoryType: 'feedback',
            body: 'A new feedback rule',
          },
        });
      });

      // Verify it refreshes after create
      expect(mockInvoke).toHaveBeenCalledWith('get_memories', { slug: 'my-project' });
    });

    it('disables Create Memory button when required fields are empty', async () => {
      const user = userEvent.setup();

      renderMemoryBrowser();

      await waitFor(() => {
        expect(screen.getByText('Testing Feedback')).toBeInTheDocument();
      });

      await user.click(screen.getByText('New Memory'));

      const createButton = screen.getByText('Create Memory');
      expect(createButton).toBeDisabled();
    });
  });
});
