def add(num1: float, num2: float) -> float:
    """Add two numbers."""
    return num1 + num2

def subtract(num1: float, num2: float) -> float:
    """Subtract num2 from num1."""
    return num1 - num2

def multiply(num1: float, num2: float) -> float:
    """Multiply two numbers."""
    return num1 * num2

def divide(num1: float, num2: float) -> float:
    """Divide num1 by num2."""
    if num2 == 0:
        raise ValueError("Cannot divide by zero")
    return num1 / num2

def power(num1: float, num2: float) -> float:
    """Raise num1 to the power of num2."""
    return num1 ** num2

def happiness_meter(name: str, level: float) -> str:
    """Calculate happiness message based on level."""
    if not name:
        name = "Friend"
    
    if level < 1:
        return f"😢 Oh no! {name} needs a hug!"
    elif level <= 3:
        return f"😔 {name} could use some cheering up!"
    elif level <= 6:
        return f"😊 {name} is doing okay!"
    elif level <= 8:
        return f"😄 {name} is pretty happy!"
    elif level <= 10:
        return f"🎉 {name} is SUPER HAPPY! YAY!"
    else:
        return f"🤯 {name} is off the charts happy! WOW!"

def fun_calculator() -> None:
    """A unique and fun calculator with personality!"""
    
    print("🎉 WELCOME TO THE FUN CALCULATOR! 🎉")
    print("=" * 40)
    print("I'm Calc-Bot 3000, ready to crunch numbers with style! 🤖")
    print()
    
    while True:
        print("\n📊 What would you like to do?")
        print("1. ➕ Add two numbers")
        print("2. ➖ Subtract two numbers")
        print("3. ✖️ Multiply two numbers")
        print("4. ➗ Divide two numbers")
        print("5. ⚡ Power (exponent)")
        print("6. 😄 Happiness Meter (special fun operation!)")
        print("7. 🚪 Exit")
        
        try:
            choice = input("\nEnter your choice (1-7): ").strip()
            
            if choice == "7":
                print("\n👋 Thanks for calculating with me! Have a mathematically awesome day! 🌟")
                break
            
            if choice == "6":
                # Special fun operation!
                name = input("What's your name? ").strip()
                happy_level = input(f"On a scale of 1-10, how happy is {name if name else 'Friend'} today? ")
                try:
                    level = float(happy_level)
                    result = happiness_meter(name, level)
                    print(f"\n📈 Happiness Analysis: {result}")
                except ValueError:
                    print("❌ That doesn't look like a number! Let's try again.")
                continue
            
            if choice not in ["1", "2", "3", "4", "5"]:
                print("❌ Please enter a number between 1 and 7!")
                continue
            
            # Get numbers for regular operations
            print("\nEnter your numbers:")
            try:
                num1 = float(input("First number: "))
                num2 = float(input("Second number: "))
            except ValueError:
                print("❌ Oops! Those should be numbers!")
                continue
            
            # Perform the calculation using the pure functions
            result = None
            operation = ""
            emoji = ""
            
            try:
                if choice == "1":
                    result = add(num1, num2)
                    operation = f"{num1} + {num2}"
                    emoji = "➕"
                elif choice == "2":
                    result = subtract(num1, num2)
                    operation = f"{num1} - {num2}"
                    emoji = "➖"
                elif choice == "3":
                    result = multiply(num1, num2)
                    operation = f"{num1} × {num2}"
                    emoji = "✖️"
                elif choice == "4":
                    result = divide(num1, num2)
                    operation = f"{num1} ÷ {num2}"
                    emoji = "➗"
                elif choice == "5":
                    result = power(num1, num2)
                    operation = f"{num1} to the power of {num2}"
                    emoji = "⚡"
            except ValueError as e:
                print(f"❌ {e}")
                continue
            
            # Display the result with flair!
            print(f"\n{emoji} CALCULATION RESULT {emoji}")
            print(f"Operation: {operation}")
            print(f"Result: {result}")
            
            # Add some fun commentary based on the result
            if result > 1000:
                print("🎯 That's a HUGE number! Are you building a rocket? 🚀")
            elif result < 0:
                print("📉 Negative result! Don't worry, math has ups and downs! 📈")
            elif result == 42:
                print("🤯 The answer to life, the universe, and everything! 🌌")
            elif result == 3.14159 or abs(result - 3.14159) < 0.0001:
                print("🥧 Mmm... pi! Delicious! 🍰")
            
        except KeyboardInterrupt:
            print("\n\n👋 Okay, okay, I get it! Exiting...")
            break
        except Exception as e:
            print(f"❌ Oops! Something went wrong: {e}")
            print("Let's try that again!")

def main() -> None:
    """Entry point for our fun calculator."""
    fun_calculator()

if __name__ == "__main__":
    main()