import pytest
import curses
from unittest.mock import patch, MagicMock, call
import sample2

class TestSnakeGame:
    """Test suite for the snake game implementation in sample2.py"""

    # --- Tests for game initialization ---

    def test_game_initialization(self):
        """Test that the game initializes with correct default values"""
        # Mock curses setup
        with patch('curses.initscr') as mock_initscr, \
             patch('curses.noecho'), \
             patch('curses.cbreak'), \
             patch('curses.curs_set'), \
             patch('curses.start_color'):
            
            mock_stdscr = MagicMock()
            mock_initscr.return_value = mock_stdscr
            
            # Initialize game
            game = sample2.SnakeGame(mock_stdscr)
            
            # Check initial state
            assert game.score == 0
            assert game.delay == 100  # Initial speed
            assert game.direction == curses.KEY_RIGHT
            assert len(game.snake) > 0  # Snake should have initial segments
            assert hasattr(game, 'food')  # Food should be initialized
            assert hasattr(game, 'height') and hasattr(game, 'width')

    # --- Tests for snake movement ---

    def test_snake_movement_right(self):
        """Test snake movement to the right"""
        with patch('curses.initscr') as mock_initscr, \
             patch('curses.noecho'), \
             patch('curses.cbreak'), \
             patch('curses.curs_set'), \
             patch('curses.start_color'):
            
            mock_stdscr = MagicMock()
            mock_initscr.return_value = mock_stdscr
            
            game = sample2.SnakeGame(mock_stdscr)
            game.direction = curses.KEY_RIGHT
            
            # Get initial head position
            initial_head = game.snake[0]
            
            # Move snake
            game.move_snake()
            
            # Head should move right (x + 1)
            new_head = game.snake[0]
            assert new_head[0] == initial_head[0]  # y should stay same
            assert new_head[1] == initial_head[1] + 1  # x should increase

    def test_snake_movement_down(self):
        """Test snake movement downward"""
        with patch('curses.initscr') as mock_initscr, \
             patch('curses.noecho'), \
             patch('curses.cbreak'), \
             patch('curses.curs_set'), \
             patch('curses.start_color'):
            
            mock_stdscr = MagicMock()
            mock_initscr.return_value = mock_stdscr
            
            game = sample2.SnakeGame(mock_stdscr)
            game.direction = curses.KEY_DOWN
            
            initial_head = game.snake[0]
            game.move_snake()
            
            new_head = game.snake[0]
            assert new_head[0] == initial_head[0] + 1  # y should increase
            assert new_head[1] == initial_head[1]  # x should stay same

    # --- Tests for collision detection ---

    def test_wall_collision(self):
        """Test detection of wall collisions"""
        with patch('curses.initscr') as mock_initscr, \
             patch('curses.noecho'), \
             patch('curses.cbreak'), \
             patch('curses.curs_set'), \
             patch('curses.start_color'):
            
            mock_stdscr = MagicMock()
            mock_initscr.return_value = mock_stdscr
            
            game = sample2.SnakeGame(mock_stdscr)
            
            # Move snake head to wall position
            game.snake[0] = (0, 0)  # Top-left corner
            
            # Should detect collision with top wall
            assert game.check_collision() == True

    def test_self_collision(self):
        """Test detection of snake colliding with itself"""
        with patch('curses.initscr') as mock_initscr, \
             patch('curses.noecho'), \
             patch('curses.cbreak'), \
             patch('curses.curs_set'), \
             patch('curses.start_color'):
            
            mock_stdscr = MagicMock()
            mock_initscr.return_value = mock_stdscr
            
            game = sample2.SnakeGame(mock_stdscr)
            
            # Create a snake that loops back on itself
            game.snake = [(5, 5), (5, 4), (5, 3), (5, 4)]  # Head at (5,5), body at (5,4) appears twice
            
            # Should detect self-collision
            assert game.check_collision() == True

    # --- Tests for food consumption ---

    def test_food_consumption(self):
        """Test that snake grows when eating food"""
        with patch('curses.initscr') as mock_initscr, \
             patch('curses.noecho'), \
             patch('curses.cbreak'), \
             patch('curses.curs_set'), \
             patch('curses.start_color'), \
             patch('random.randint') as mock_randint:
            
            mock_stdscr = MagicMock()
            mock_initscr.return_value = mock_stdscr
            
            game = sample2.SnakeGame(mock_stdscr)
            
            # Place food at snake's head position
            initial_length = len(game.snake)
            game.food = game.snake[0]
            
            # Consume food
            game.check_food()
            
            # Snake should grow
            assert len(game.snake) == initial_length + 1
            assert game.score > 0  # Score should increase
            assert game.delay < 100  # Speed should increase (delay decreases)

    # --- Tests for game over logic ---

    def test_game_over_screen(self):
        """Test game over screen display"""
        with patch('curses.initscr') as mock_initscr, \
             patch('curses.noecho'), \
             patch('curses.cbreak'), \
             patch('curses.curs_set'), \
             patch('curses.start_color'):
            
            mock_stdscr = MagicMock()
            mock_initscr.return_value = mock_stdscr
            
            game = sample2.SnakeGame(mock_stdscr)
            game.score = 150
            
            # Mock the addstr calls
            with patch.object(mock_stdscr, 'addstr') as mock_addstr:
                game.game_over()
                
                # Should display game over message with score
                mock_addstr.assert_any_call(call(game.height//2, game.width//2 - 5, "GAME OVER"))
                mock_addstr.assert_any_call(call(game.height//2 + 1, game.width//2 - 10, f"Final Score: {game.score}"))

    # --- Tests for main game loop ---

    @patch('curses.initscr')
    @patch('curses.noecho')
    @patch('curses.cbreak')
    @patch('curses.curs_set')
    @patch('curses.start_color')
    @patch('curses.endwin')
    def test_main_game_loop_exit(self, mock_endwin, mock_start_color, mock_curs_set, 
                                 mock_cbreak, mock_noecho, mock_initscr):
        """Test that main game loop can exit cleanly"""
        mock_stdscr = MagicMock()
        mock_initscr.return_value = mock_stdscr
        
        # Simulate user pressing 'q' to quit immediately
        mock_stdscr.getch.side_effect = [ord('q')]
        
        # Run the game
        sample2.main()
        
        # Should clean up curses
        mock_endwin.assert_called_once()

    # --- Tests for keyboard input handling ---

    def test_direction_change_valid(self):
        """Test valid direction changes"""
        with patch('curses.initscr') as mock_initscr, \
             patch('curses.noecho'), \
             patch('curses.cbreak'), \
             patch('curses.curs_set'), \
             patch('curses.start_color'):
            
            mock_stdscr = MagicMock()
            mock_initscr.return_value = mock_stdscr
            
            game = sample2.SnakeGame(mock_stdscr)
            game.direction = curses.KEY_RIGHT
            
            # Should be able to change to up or down when moving right
            game.change_direction(curses.KEY_UP)
            assert game.direction == curses.KEY_UP
            
            game.direction = curses.KEY_RIGHT
            game.change_direction(curses.KEY_DOWN)
            assert game.direction == curses.KEY_DOWN

    def test_direction_change_invalid(self):
        """Test that snake can't reverse direction"""
        with patch('curses.initscr') as mock_initscr, \
             patch('curses.noecho'), \
             patch('curses.cbreak'), \
             patch('curses.curs_set'), \
             patch('curses.start_color'):
            
            mock_stdscr = MagicMock()
            mock_initscr.return_value = mock_stdscr
            
            game = sample2.SnakeGame(mock_stdscr)
            game.direction = curses.KEY_RIGHT
            
            # Should NOT be able to reverse to left when moving right
            game.change_direction(curses.KEY_LEFT)
            assert game.direction == curses.KEY_RIGHT  # Direction should not change

    # --- Integration test ---

    @patch('curses.initscr')
    @patch('curses.noecho')
    @patch('curses.cbreak')
    @patch('curses.curs_set')
    @patch('curses.start_color')
    @patch('curses.endwin')
    def test_complete_game_session(self, mock_endwin, mock_start_color, mock_curs_set,
                                   mock_cbreak, mock_noecho, mock_initscr):
        """Test a complete game session with food collection and game over"""
        mock_stdscr = MagicMock()
        mock_initscr.return_value = mock_stdscr
        
        # Simulate: move right 3 times, collect food, then quit
        getch_calls = [
            curses.KEY_RIGHT,  # Start moving
            curses.KEY_RIGHT,  # Continue
            curses.KEY_RIGHT,  # Continue
            ord('q')           # Quit
        ]
        mock_stdscr.getch.side_effect = getch_calls
        
        # Mock random food placement to ensure we don't immediately collide
        with patch('random.randint') as mock_randint:
            mock_randint.return_value = 10  # Place food away from starting position
            
            # Run game
            try:
                sample2.main()
            except StopIteration:  # getch will run out of values
                pass
            
            # Verify cleanup happened
            mock_endwin.assert_called_once()