import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AgentChat from './AgentChat';

vi.mock('react-markdown', () => ({
    default: ({ children }) => <div data-testid="markdown">{children}</div>
}));
vi.mock('rehype-highlight', () => ({
    default: () => { }
}));

describe('AgentChat Component', () => {
    const defaultProps = {
        messages: [],
        isTyping: false,
        currentAgent: null,
        onSendMessage: vi.fn(),
        isConnected: true,
        onStop: vi.fn(),
        isStopped: false,
        attachedFiles: [],
        onAttachFiles: vi.fn(),
        onRemoveFile: vi.fn(),
        onShowChanges: vi.fn()
    };

    it('renders the welcome message when there are no messages', () => {
        render(<AgentChat {...defaultProps} />);
        expect(screen.getByText('Welcome to AutoAgents!')).toBeInTheDocument();
        expect(screen.getByText('🔍 Review my code')).toBeInTheDocument();
    });

    it('renders messages correctly', () => {
        const messages = [
            {
                id: 1,
                agent: 'Senior Dev',
                content: 'Hello, I am the Senior Dev.',
                timestamp: new Date().toISOString(),
                complete: true
            }
        ];
        render(<AgentChat {...defaultProps} messages={messages} />);
        expect(screen.getByText('Hello, I am the Senior Dev.')).toBeInTheDocument();
        expect(screen.getByText('Senior Dev')).toBeInTheDocument();
    });

    it('shows typing indicator when agent is typing', () => {
        render(<AgentChat {...defaultProps} isTyping={true} currentAgent={{ name: 'Senior Dev' }} />);
        expect(screen.getByText('Senior Dev')).toBeInTheDocument();
        expect(screen.getByText(/is currently working/i)).toBeInTheDocument();
    });

    it('calls onSendMessage when the form is submitted', () => {
        render(<AgentChat {...defaultProps} />);
        const input = screen.getByPlaceholderText('Ask the agents something...');
        fireEvent.change(input, { target: { value: 'Hello' } });
        fireEvent.submit(screen.getByRole('button', { name: /Send/i }));
        expect(defaultProps.onSendMessage).toHaveBeenCalledWith('Hello');
    });

    it('disables input when not connected', () => {
        render(<AgentChat {...defaultProps} isConnected={false} />);
        const input = screen.getByPlaceholderText('Connecting...');
        expect(input).toBeDisabled();
    });

    it('shows stop button when typing', () => {
        render(<AgentChat {...defaultProps} isTyping={true} currentAgent={{ name: 'Senior Dev' }} />);
        expect(screen.getByRole('button', { name: /Stop/i })).toBeInTheDocument();
    });

    it('renders attached files', () => {
        const attachedFiles = [
            { path: 'test.py', extension: '.py' }
        ];
        render(<AgentChat {...defaultProps} attachedFiles={attachedFiles} />);
        expect(screen.getByText('test.py')).toBeInTheDocument();
    });
});
