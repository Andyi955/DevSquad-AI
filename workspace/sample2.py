import curses
import random
import time
from typing import List, Tuple

class SnakeGame:
    def __init__(self, stdscr):
        self.stdscr = stdscr
        self.height, self.width = stdscr.getmaxyx()
        self.snake = [(self.height // 2, self.width // 4)]
        self.food = self.generate_food()
        self.direction = curses.KEY_RIGHT
        self.score = 0
        self.game_over = False
        
        # Initialize curses settings
        curses.curs_set(0)
        self.stdscr.nodelay(1)
        self.stdscr.timeout(100)
        
        # Define color pairs
        curses.start_color()
        curses.init_pair(1, curses.COLOR_GREEN, curses.COLOR_BLACK)
        curses.init_pair(2, curses.COLOR_RED, curses.COLOR_BLACK)
        curses.init_pair(3, curses.COLOR_YELLOW, curses.COLOR_BLACK)
    
    def generate_food(self) -> Tuple[int, int]:
        """Generate food at a random position not occupied by the snake."""
        while True:
            food = (
                random.randint(1, self.height - 2),
                random.randint(1, self.width - 2)
            )
            if food not in self.snake:
                return food
    
    def draw_border(self):
        """Draw the game border."""
        self.stdscr.attron(curses.color_pair(3))
        self.stdscr.border()
        self.stdscr.attroff(curses.color_pair(3))
    
    def draw_snake(self):
        """Draw the snake on the screen."""
        self.stdscr.attron(curses.color_pair(1))
        for y, x in self.snake:
            if 0 < y < self.height - 1 and 0 < x < self.width - 1:
                self.stdscr.addch(y, x, '█')
        self.stdscr.attroff(curses.color_pair(1))
    
    def draw_food(self):
        """Draw the food on the screen."""
        self.stdscr.attron(curses.color_pair(2))
        y, x = self.food
        if 0 < y < self.height - 1 and 0 < x < self.width - 1:
            self.stdscr.addch(y, x, '●')
        self.stdscr.attroff(curses.color_pair(2))
    
    def draw_score(self):
        """Display the current score."""
        score_text = f"Score: {self.score}"
        self.stdscr.addstr(0, 2, score_text)
    
    def draw_instructions(self):
        """Display game instructions."""
        instructions = "Use arrow keys to move | Q to quit"
        if self.width > len(instructions) + 4:
            self.stdscr.addstr(self.height - 1, 2, instructions)
    
    def draw_game_over(self):
        """Display game over screen."""
        game_over_text = "GAME OVER!"
        restart_text = "Press R to restart or Q to quit"
        
        y = self.height // 2 - 1
        x = self.width // 2 - len(game_over_text) // 2
        
        self.stdscr.attron(curses.A_BOLD)
        self.stdscr.addstr(y, x, game_over_text)
        self.stdscr.addstr(y + 1, self.width // 2 - len(restart_text) // 2, restart_text)
        self.stdscr.attroff(curses.A_BOLD)
    
    def move_snake(self):
        """Move the snake in the current direction."""
        head_y, head_x = self.snake[0]
        
        # Calculate new head position based on direction
        if self.direction == curses.KEY_UP:
            new_head = (head_y - 1, head_x)
        elif self.direction == curses.KEY_DOWN:
            new_head = (head_y + 1, head_x)
        elif self.direction == curses.KEY_LEFT:
            new_head = (head_y, head_x - 1)
        elif self.direction == curses.KEY_RIGHT:
            new_head = (head_y, head_x + 1)
        else:
            return
        
        # Check for collision with border
        if (new_head[0] <= 0 or new_head[0] >= self.height - 1 or
            new_head[1] <= 0 or new_head[1] >= self.width - 1):
            self.game_over = True
            return
        
        # Check for collision with self
        if new_head in self.snake:
            self.game_over = True
            return
        
        # Move snake
        self.snake.insert(0, new_head)
        
        # Check if food is eaten
        if new_head == self.food:
            self.score += 10
            self.food = self.generate_food()
        else:
            # Remove tail if no food eaten
            self.snake.pop()
    
    def handle_input(self):
        """Handle keyboard input."""
        key = self.stdscr.getch()
        
        if key == ord('q') or key == ord('Q'):
            return False  # Signal to quit
        
        if self.game_over and (key == ord('r') or key == ord('R')):
            # Restart game
            self.__init__(self.stdscr)
            return True
        
        # Change direction (prevent 180-degree turns)
        if (key == curses.KEY_UP and self.direction != curses.KEY_DOWN or
            key == curses.KEY_DOWN and self.direction != curses.KEY_UP or
            key == curses.KEY_LEFT and self.direction != curses.KEY_RIGHT or
            key == curses.KEY_RIGHT and self.direction != curses.KEY_LEFT):
            self.direction = key
        
        return True
    
    def run(self):
        """Main game loop."""
        while True:
            self.stdscr.clear()
            
            if not self.game_over:
                self.move_snake()
            
            self.draw_border()
            self.draw_snake()
            self.draw_food()
            self.draw_score()
            self.draw_instructions()
            
            if self.game_over:
                self.draw_game_over()
            
            self.stdscr.refresh()
            
            # Handle input
            if not self.handle_input():
                break
            
            # Control game speed based on score
            if not self.game_over:
                speed = max(50, 150 - (self.score // 10))
                self.stdscr.timeout(speed)

def main(stdscr):
    """Main function for curses application."""
    game = SnakeGame(stdscr)
    game.run()

if __name__ == "__main__":
    curses.wrapper(main)