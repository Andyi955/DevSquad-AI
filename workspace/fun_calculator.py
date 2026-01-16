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
                if not name:
                    name = "Friend"
                
                happy_level = input(f"On a scale of 1-10, how happy is {name} today? ")
                try:
                    level = float(happy_level)
                    if level < 1:
                        result = f"😢 Oh no! {name} needs a hug!"
                    elif level <= 3:
                        result = f"😔 {name} could use some cheering up!"
                    elif level <= 6:
                        result = f"😊 {name} is doing okay!"
                    elif level <= 8:
                        result = f"😄 {name} is pretty happy!"
                    elif level <= 10:
                        result = f"🎉 {name} is SUPER HAPPY! YAY!"
                    else:
                        result = f"🤯 {name} is off the charts happy! WOW!"
                    
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
            
            # Perform the calculation
            result = None
            operation = ""
            
            if choice == "1":
                result = num1 + num2
                operation = f"{num1} + {num2}"
                emoji = "➕"
            elif choice == "2":
                result = num1 - num2
                operation = f"{num1} - {num2}"
                emoji = "➖"
            elif choice == "3":
                result = num1 * num2
                operation = f"{num1} × {num2}"
                emoji = "✖️"
            elif choice == "4":
                if num2 == 0:
                    print("❌ Whoa there! Dividing by zero creates a black hole! 🕳️")
                    continue
                result = num1 / num2
                operation = f"{num1} ÷ {num2}"
                emoji = "➗"
            elif choice == "5":
                result = num1 ** num2
                operation = f"{num1} to the power of {num2}"
                emoji = "⚡"
            
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