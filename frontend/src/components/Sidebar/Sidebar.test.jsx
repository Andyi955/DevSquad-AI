import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from './Sidebar';

// Mock FileTree component to isolate Sidebar tests
vi.mock('../FileTree/FileTree', () => ({
    default: () => <div data-testid="file-tree">Mock FileTree</div>
}));

describe('Sidebar Component', () => {
    const defaultProps = {
        files: [],
        selectedFile: null,
        onSelectFile: vi.fn(),
        onUpload: vi.fn(),
        onAttachFiles: vi.fn(),
        onClearWorkspace: vi.fn(),
        onCreateFile: vi.fn(),
        onCreateFolder: vi.fn(),
        onUploadToPath: vi.fn(),
        onMoveItem: vi.fn(),
        onRenameItem: vi.fn(),
        onOpenFolder: vi.fn(),
        workspacePath: null
    };

    it('renders "No project open" when files are empty and no workspacePath', () => {
        render(<Sidebar {...defaultProps} />);
        expect(screen.getByText('No project open')).toBeInTheDocument();
        expect(screen.getByText('📂 Open Folder')).toBeInTheDocument();
    });

    it('renders the workspace name when workspacePath is provided', () => {
        const props = { ...defaultProps, workspacePath: 'C:\\Users\\Project' };
        render(<Sidebar {...props} />);
        expect(screen.getByText('Project')).toBeInTheDocument();
    });

    it('calls onOpenFolder when the open button is clicked', () => {
        render(<Sidebar {...defaultProps} />);
        // The open folder button in the empty state
        const openBtn = screen.getByRole('button', { name: /📂 Open Folder/i });
        fireEvent.click(openBtn);
        expect(defaultProps.onOpenFolder).toHaveBeenCalled();
    });

    it('calls onClearWorkspace when the clear button is clicked', () => {
        const props = { ...defaultProps, workspacePath: 'C:\\Project', files: [{ name: 'test.py', size: 100 }] };
        render(<Sidebar {...props} />);
        const clearBtn = screen.getByTitle('Close current project');
        fireEvent.click(clearBtn);
        expect(defaultProps.onClearWorkspace).toHaveBeenCalled();
    });

    it('shows the number of files and their total size', () => {
        const props = {
            ...defaultProps,
            files: [
                { name: 'file1.txt', size: 1024 },
                { name: 'file2.txt', size: 2048 }
            ]
        };
        render(<Sidebar {...props} />);
        expect(screen.getByText('2 file(s)')).toBeInTheDocument();
        expect(screen.getByText('3.0 KB')).toBeInTheDocument();
    });
});
