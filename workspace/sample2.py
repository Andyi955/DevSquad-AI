import random
from typing import List, Optional

def get_random_integers(
    count: int, 
    start: int, 
    end: int, 
    seed: Optional[int] = None
) -> List[int]:
    """
    Generates a list of random integers within a specified range.
    
    Args:
        count: The number of random integers to generate.
        start: The inclusive lower bound of the range.
        end: The inclusive upper bound of the range.
        seed: Optional seed for reproducible random generation.
        
    Returns:
        A list of random integers.
        
    Raises:
        ValueError: If start > end (invalid range) or count < 0.
    """
    if start > end:
        raise ValueError(f"Invalid range: start ({start}) cannot be greater than end ({end})")
    
    if count < 0:
        raise ValueError(f"Invalid count: {count} must be non-negative")
    
    if seed is not None:
        random.seed(seed)
    
    return [random.randint(start, end) for _ in range(count)]

def get_user_input(prompt: str) -> Optional[int]:
    """Helper function to safely get integer input from user."""
    try:
        value = input(prompt).strip()
        if not value:
            return None
        return int(value)
    except ValueError:
        raise ValueError(f"Invalid input: '{value}' is not a valid integer")

def display_statistics(numbers: List[int]) -> None:
    """Display statistics about the generated numbers."""
    if not numbers:
        return
    
    print(f"\n📊 Statistics:")
    print(f"   Count: {len(numbers)}")
    print(f"   Min: {min(numbers)}")
    print(f"   Max: {max(numbers)}")
    print(f"   Average: {sum(numbers)/len(numbers):.2f}")
    print(f"   Sum: {sum(numbers)}")

def main() -> None:
    """Main entry point for the Random Number Generator utility."""
    print("🎯 Welcome to the Random Number Generator")
    print("=" * 40)
    
    try:
        # Input gathering with better prompts
        low = get_user_input("Enter the lower bound (e.g., 1): ")
        if low is None:
            print("\n⚠️ No lower bound provided. Using default: 1")
            low = 1
        
        high = get_user_input("Enter the upper bound (e.g., 100): ")
        if high is None:
            print(f"\n⚠️ No upper bound provided. Using default: {low + 99}")
            high = low + 99
        
        amount_input = get_user_input("How many numbers would you like to generate? (Press Enter for 10): ")
        amount = amount_input if amount_input is not None else 10
        
        # Safety check for very large counts
        if amount > 10000:
            confirm = input(f"⚠️ You're about to generate {amount:,} numbers. Continue? (y/n): ")
            if confirm.lower() != 'y':
                print("Operation cancelled.")
                return
        
        # Core logic
        results = get_random_integers(amount, low, high)
        
        # Output
        if not results:
            print("\n✅ No numbers were requested (count was 0).")
        else:
            print(f"\n✅ Successfully generated {len(results)} number(s):")
            print(f"👉 {results}")
            display_statistics(results)
        
    except ValueError as e:
        print(f"\n❌ Error: {e}")
    except KeyboardInterrupt:
        print("\n\n👋 Operation cancelled by user.")
    except Exception as e:
        print(f"\n⚠️ An unexpected error occurred: {e}")

if __name__ == "__main__":
    main()