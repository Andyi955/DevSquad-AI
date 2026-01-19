import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Header from './Header';

describe('Header Component', () => {
    it('renders the logo text', () => {
        render(<Header isConnected={true} />);
        expect(screen.getByText('AutoAgents')).toBeInTheDocument();
    });

    it('shows "Connected" when isConnected is true', () => {
        render(<Header isConnected={true} />);
        expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('shows "Disconnected" when isConnected is false', () => {
        render(<Header isConnected={false} />);
        expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('displays usage stats when provided', () => {
        const usage = {
            today: {
                today_calls: 10,
                daily_limit: 100
            }
        };
        render(<Header isConnected={true} usage={usage} />);
        expect(screen.getByText('10 / 100')).toBeInTheDocument();
    });

    it('calls onNewChat when "+ New Chat" button is clicked', () => {
        const onNewChat = vi.fn();
        render(<Header isConnected={true} onNewChat={onNewChat} />);

        const button = screen.getByText('+ New Chat');
        fireEvent.click(button);

        expect(onNewChat).toHaveBeenCalledTimes(1);
    });
});
