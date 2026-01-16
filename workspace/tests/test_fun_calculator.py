import pytest
from unittest.mock import patch
import fun_calculator

def test_addition_and_exit(monkeypatch, capsys):
    """Verify addition logic and exit command"""
    inputs = iter(["1", "10", "5", "7"])
    monkeypatch.setattr('builtins.input', lambda _: next(inputs))
    
    fun_calculator.fun_calculator()
    
    captured = capsys.readouterr().out
    assert "Operation: 10.0 + 5.0" in captured
    assert "Result: 15.0" in captured
    assert "Thanks for calculating with me!" in captured

def test_division_by_zero(monkeypatch, capsys):
    """Verify division by zero is handled safely"""
    inputs = iter(["4", "10", "0", "7"])
    monkeypatch.setattr('builtins.input', lambda _: next(inputs))
    
    fun_calculator.fun_calculator()
    
    captured = capsys.readouterr().out
    assert "Cannot divide by zero" in captured

def test_happiness_meter_logic(monkeypatch, capsys):
    """Verify happiness meter with specific input"""
    inputs = iter(["6", "Alice", "10", "7"])
    monkeypatch.setattr('builtins.input', lambda _: next(inputs))
    
    fun_calculator.fun_calculator()
    
    captured = capsys.readouterr().out
    assert "Analysis: 🎉 Alice is SUPER HAPPY! YAY!" in captured

def test_happiness_meter_empty_name(monkeypatch, capsys):
    """Verify happiness meter defaults to 'Friend' when name is empty"""
    inputs = iter(["6", "", "5", "7"])
    monkeypatch.setattr('builtins.input', lambda _: next(inputs))
    
    fun_calculator.fun_calculator()
    
    captured = capsys.readouterr().out
    assert "Analysis: 😊 Friend is doing okay!" in captured

def test_commentary_easter_egg(monkeypatch, capsys):
    """Verify the '42' easter egg commentary"""
    inputs = iter(["1", "40", "2", "7"])
    monkeypatch.setattr('builtins.input', lambda _: next(inputs))
    
    fun_calculator.fun_calculator()
    
    captured = capsys.readouterr().out
    assert "The answer to life, the universe, and everything!" in captured

def test_invalid_menu_choice(monkeypatch, capsys):
    """Verify handling of invalid menu options"""
    inputs = iter(["9", "7"])
    monkeypatch.setattr('builtins.input', lambda _: next(inputs))
    
    fun_calculator.fun_calculator()
    
    captured = capsys.readouterr().out
    assert "Please enter a number between 1 and 7!" in captured

def test_non_numeric_input(monkeypatch, capsys):
    """Verify handling of non-numeric operands"""
    inputs = iter(["1", "not_a_number", "7"])
    monkeypatch.setattr('builtins.input', lambda _: next(inputs))
    
    fun_calculator.fun_calculator()
    
    captured = capsys.readouterr().out
    assert "Oops! Those should be numbers!" in captured