import random
import logging
from typing import List, Optional, Union

logger = logging.getLogger(__name__)

class RandomNumberGenerator:
    """
    A flexible random number generator with various utilities.
    
    This class provides methods to generate random numbers in different formats
    and ranges, with optional seeding for reproducibility.
    """
    
    def __init__(self, seed: Optional[int] = None):
        """
        Initialize the RNG with an optional seed.
        
        Args:
            seed: If provided, seeds the random generator for reproducible results.
                  If None, uses system time for true randomness.
        """
        self._seed = seed
        if seed is not None:
            random.seed(seed)
            logger.info(f"RNG initialized with seed: {seed}")
        else:
            logger.info("RNG initialized with system time")
    
    def get_seed(self) -> Optional[int]:
        """Returns the seed used for this RNG instance."""
        return self._seed
    
    def random_int(self, min_val: int = 0, max_val: int = 100) -> int:
        """
        Generate a random integer within the specified range.
        
        Args:
            min_val: Minimum value (inclusive)
            max_val: Maximum value (inclusive)
            
        Returns:
            A random integer between min_val and max_val
            
        Raises:
            ValueError: If min_val > max_val
        """
        if min_val > max_val:
            raise ValueError(f"min_val ({min_val}) cannot be greater than max_val ({max_val})")
        
        result = random.randint(min_val, max_val)
        logger.debug(f"Generated random int: {result} (range: {min_val}-{max_val})")
        return result
    
    def random_float(self, min_val: float = 0.0, max_val: float = 1.0) -> float:
        """
        Generate a random float within the specified range.
        
        Args:
            min_val: Minimum value (inclusive)
            max_val: Maximum value (exclusive for uniform distribution)
            
        Returns:
            A random float between min_val and max_val
            
        Raises:
            ValueError: If min_val >= max_val
        """
        if min_val >= max_val:
            raise ValueError(f"min_val ({min_val}) must be less than max_val ({max_val})")
        
        result = random.uniform(min_val, max_val)
        logger.debug(f"Generated random float: {result:.4f} (range: {min_val}-{max_val})")
        return result
    
    def random_choice(self, items: List[Union[str, int, float]]) -> Union[str, int, float]:
        """
        Randomly select an item from a list.
        
        Args:
            items: List of items to choose from
            
        Returns:
            A randomly selected item from the list
            
        Raises:
            ValueError: If the list is empty
        """
        if not items:
            raise ValueError("Cannot choose from an empty list")
        
        result = random.choice(items)
        logger.debug(f"Randomly chose: {result} from list of {len(items)} items")
        return result
    
    def random_list(self, size: int = 5, min_val: int = 0, max_val: int = 100) -> List[int]:
        """
        Generate a list of random integers.
        
        Args:
            size: Number of random integers to generate
            min_val: Minimum value for each integer
            max_val: Maximum value for each integer
            
        Returns:
            List of random integers
            
        Raises:
            ValueError: If size <= 0 or min_val > max_val
        """
        if size <= 0:
            raise ValueError(f"Size must be positive, got {size}")
        if min_val > max_val:
            raise ValueError(f"min_val ({min_val}) cannot be greater than max_val ({max_val})")
        
        result = [self.random_int(min_val, max_val) for _ in range(size)]
        logger.debug(f"Generated list of {size} random integers")
        return result
    
    def coin_flip(self) -> str:
        """
        Simulate a coin flip.
        
        Returns:
            Either "Heads" or "Tails"
        """
        result = "Heads" if random.random() < 0.5 else "Tails"
        logger.debug(f"Coin flip result: {result}")
        return result
    
    def reset_seed(self, seed: Optional[int] = None):
        """
        Reset the random seed.
        
        Args:
            seed: New seed value. If None, reseeds with original seed or system time.
        """
        if seed is not None:
            self._seed = seed
        random.seed(self._seed)
        logger.info(f"RNG reseeded with: {self._seed if self._seed is not None else 'system time'}")


def demonstrate_rng():
    """Demonstrate the capabilities of the RandomNumberGenerator."""
    print("=== Random Number Generator Demo ===\n")
    
    # Create an RNG with a fixed seed for reproducible demo
    rng = RandomNumberGenerator(seed=42)
    print(f"Created RNG with seed: {rng.get_seed()}\n")
    
    # Generate some random numbers
    print("1. Random integer between 1 and 10:")
    print(f"   Result: {rng.random_int(1, 10)}\n")
    
    print("2. Random float between 0 and 1:")
    print(f"   Result: {rng.random_float():.4f}\n")
    
    print("3. Random choice from a list:")
    fruits = ["apple", "banana", "cherry", "date", "elderberry"]
    print(f"   Fruits: {fruits}")
    print(f"   Random choice: {rng.random_choice(fruits)}\n")
    
    print("4. List of 5 random numbers (1-100):")
    print(f"   Result: {rng.random_list(5, 1, 100)}\n")
    
    print("5. Coin flip:")
    print(f"   Result: {rng.coin_flip()}\n")
    
    # Demonstrate reproducibility with same seed
    print("6. Reproducibility test (creating new RNG with same seed):")
    rng2 = RandomNumberGenerator(seed=42)
    same_int = rng2.random_int(1, 10)
    print(f"   First RNG's first int (1-10): {rng.random_int(1, 10)}")
    print(f"   Second RNG's first int (1-10): {same_int}")
    print(f"   Are they the same? {rng.random_int(1, 10) == same_int}")


if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Run the demonstration
    demonstrate_rng()