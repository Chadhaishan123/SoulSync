# GoEmotions Dataset

**Source:** Google Research
**URL:** https://huggingface.co/datasets/google-research-datasets/go_emotions
**Paper:** Demszky et al. (2020), "GoEmotions: A Dataset of Fine-Grained Emotions"
**License:** Apache 2.0

## Description

58,000 Reddit comments labeled with 27 fine-grained emotions + neutral.
Multi-label annotations from 3 raters each.

## Labels

- 0: admiration
- 1: amusement
- 2: anger
- 3: annoyance
- 4: approval
- 5: caring
- 6: confusion
- 7: curiosity
- 8: desire
- 9: disappointment
- 10: disapproval
- 11: disgust
- 12: embarrassment
- 13: excitement
- 14: fear
- 15: gratitude
- 16: grief
- 17: joy
- 18: love
- 19: nervousness
- 20: optimism
- 21: pride
- 22: realization
- 23: relief
- 24: remorse
- 25: sadness
- 26: surprise
- 27: neutral

## Usage in SoulSync

Used to fine-tune the DistilBERT emotion classifier for richer
emotion granularity in journal analysis. The 27 emotions are mapped
to SoulSync's 6 core emotions (Happy, Sad, Anxious, Angry, Calm, Neutral)
plus additional fine-grained categories.
