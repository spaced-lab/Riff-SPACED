"""Audio analysis pipeline (SPEC section 8): recordings in, riff JSON out.

Each stage is a pure function in its own module with a dataclass in and out:
io -> preprocess -> stft -> onsets -> tempo -> fingering_match -> decode -> quantize -> emit.
Only numpy and scipy are used in this path (DECISIONS 18).
"""
