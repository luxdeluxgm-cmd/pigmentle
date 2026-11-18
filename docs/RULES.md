# Rules

- Puzzle resets daily at 00:00 UTC.
- 5 guesses max per day.
- Target CMYK channels are multiples of 5 from 0 to 100.
- A channel counts as correct if the guess is within 2 points of the target.
- Hints per channel: higher, lower, or hit.
- CMYK to RGB conversion (C, M, Y, K scaled 0 to 1):
  - `R = round(255 * (1 - C) * (1 - K))`
  - `G = round(255 * (1 - M) * (1 - K))`
  - `B = round(255 * (1 - Y) * (1 - K))`
- Streaks increment on consecutive UTC day wins and reset to 0 on a loss or missed day.
- Answers and `service_role` keys never touch the frontend.
