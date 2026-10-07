import pytest

from bench.money import Money, ceil_div, convert, fmt, parse_rate, round_half_even_div


def test_fmt_uses_explicit_currency_and_two_decimals():
    assert fmt(Money(610000, "GBP")) == "GBP 6,100.00"
    assert fmt(Money(7, "EUR")) == "EUR 0.07"


def test_money_rejects_floats_and_bad_codes():
    with pytest.raises(TypeError):
        Money(1.5, "GBP")
    with pytest.raises(ValueError):
        Money(1, "gbp")


def test_parse_rate():
    assert parse_rate("0.8571") == (8571, 10000)
    assert parse_rate("1") == (1, 1)
    for bad in ("-1", "1e3", "0", "abc", "1.2.3"):
        with pytest.raises(ValueError):
            parse_rate(bad)


@pytest.mark.parametrize("a,b,want", [(5, 2, 2), (7, 2, 4), (9, 4, 2), (10, 4, 2), (11, 4, 3), (0, 3, 0)])
def test_round_half_even(a, b, want):
    assert round_half_even_div(a, b) == want


def test_convert_eur_to_gbp_half_even():
    # EUR 2,940.00 x 0.8571 = GBP 2,519.874 -> GBP 2,519.87
    assert convert(Money(294000, "EUR"), "GBP", "0.8571") == Money(251987, "GBP")
    # exact half rounds to even: 1 x 0.5 = 0.5 -> 0 ; 3 x 0.5 = 1.5 -> 2
    assert convert(Money(1, "EUR"), "GBP", "0.5").minor == 0
    assert convert(Money(3, "EUR"), "GBP", "0.5").minor == 2


def test_ceil_div_rounds_packs_up():
    assert ceil_div(4000, 100) == 40
    assert ceil_div(4001, 100) == 41
    with pytest.raises(ValueError):
        ceil_div(1, 0)
