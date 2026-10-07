"""Integer minor-unit money. No floats anywhere."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Money:
    minor: int
    currency: str

    def __post_init__(self) -> None:
        if not isinstance(self.minor, int) or isinstance(self.minor, bool):
            raise TypeError("minor must be int")
        if len(self.currency) != 3 or not self.currency.isupper():
            raise ValueError(f"bad currency code: {self.currency!r}")

    def times(self, n: int) -> "Money":
        if not isinstance(n, int) or n < 0:
            raise ValueError("multiplier must be a non-negative int")
        return Money(self.minor * n, self.currency)

    def to_json(self) -> dict:
        return {"minor": self.minor, "currency": self.currency}

    @staticmethod
    def from_json(d: dict) -> "Money":
        return Money(d["minor"], d["currency"])


def parse_rate(rate: str) -> tuple[int, int]:
    """'0.8571' -> (8571, 10000). Rejects anything that is not a plain positive decimal."""
    if rate.count(".") > 1 or not rate.replace(".", "").isdigit():
        raise ValueError(f"bad rate: {rate!r}")
    whole, _, frac = rate.partition(".")
    num, den = int(whole + frac), 10 ** len(frac)
    if num <= 0:
        raise ValueError("rate must be positive")
    return num, den


def round_half_even_div(a: int, b: int) -> int:
    if b <= 0 or a < 0:
        raise ValueError("expects a >= 0, b > 0")
    q, r = divmod(a, b)
    if 2 * r > b or (2 * r == b and q % 2 == 1):
        q += 1
    return q


def convert(m: Money, to: str, rate: str) -> Money:
    num, den = parse_rate(rate)
    return Money(round_half_even_div(m.minor * num, den), to)


def ceil_div(a: int, b: int) -> int:
    if b <= 0:
        raise ValueError("divisor must be positive")
    return -(-a // b)


def fmt(m: Money) -> str:
    whole, frac = divmod(m.minor, 100)
    return f"{m.currency} {whole:,}.{frac:02d}"
