"""
Download and prepare datasets for SoulSync NLP models.

Downloads two real, publicly available datasets:
  1. GoEmotions (Google Research) — 58k Reddit comments, 27 emotions
  2. dair-ai/emotion — 20k tweets, 6 emotions

Both are saved as CSV files under datasets/ for transparency and citation.

Usage:
    cd SoulSync
    python ml/download_datasets.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = PROJECT_ROOT / "datasets"


def download_goemotions() -> None:
    """
    Download GoEmotions — 58k Reddit comments labeled with 27 fine-grained
    emotions + neutral. Multi-label, 3 annotators each.

    Source: https://huggingface.co/datasets/google-research-datasets/go_emotions
    Paper: Demszky et al. (2020), "GoEmotions: A Dataset of Fine-Grained Emotions"
    """
    from datasets import load_dataset

    print("=" * 60)
    print("Downloading GoEmotions (Google Research)...")
    print("  Source: google-research-datasets/go_emotions")
    print("  Size: ~58,000 Reddit comments")
    print("  Labels: 27 emotions + neutral")
    print("=" * 60)

    outdir = DATASET_DIR / "go_emotions"
    outdir.mkdir(parents=True, exist_ok=True)

    # The "simplified" config maps 27 emotions → 27 binary columns
    ds = load_dataset("google-research-datasets/go_emotions", "simplified")

    for split_name in ds:
        split = ds[split_name]
        csv_path = outdir / f"{split_name}.csv"
        split.to_csv(str(csv_path), index=False)
        print(f"  [OK] {split_name}: {len(split):,} examples -> {csv_path.name}")

    # Save label mapping
    label_names = [
        "admiration", "amusement", "anger", "annoyance", "approval",
        "caring", "confusion", "curiosity", "desire", "disappointment",
        "disapproval", "disgust", "embarrassment", "excitement", "fear",
        "gratitude", "grief", "joy", "love", "nervousness",
        "optimism", "pride", "realization", "relief", "remorse",
        "sadness", "surprise", "neutral",
    ]
    with open(outdir / "label_names.txt", "w") as f:
        for i, name in enumerate(label_names):
            f.write(f"{i}\t{name}\n")

    # Write provenance
    with open(outdir / "PROVENANCE.md", "w") as f:
        f.write("# GoEmotions Dataset\n\n")
        f.write("**Source:** Google Research\n")
        f.write("**URL:** https://huggingface.co/datasets/google-research-datasets/go_emotions\n")
        f.write("**Paper:** Demszky et al. (2020), \"GoEmotions: A Dataset of Fine-Grained Emotions\"\n")
        f.write("**License:** Apache 2.0\n\n")
        f.write("## Description\n\n")
        f.write("58,000 Reddit comments labeled with 27 fine-grained emotions + neutral.\n")
        f.write("Multi-label annotations from 3 raters each.\n\n")
        f.write("## Labels\n\n")
        for i, name in enumerate(label_names):
            f.write(f"- {i}: {name}\n")
        f.write("\n## Usage in SoulSync\n\n")
        f.write("Used to fine-tune the DistilBERT emotion classifier for richer\n")
        f.write("emotion granularity in journal analysis. The 27 emotions are mapped\n")
        f.write("to SoulSync's 6 core emotions (Happy, Sad, Anxious, Angry, Calm, Neutral)\n")
        f.write("plus additional fine-grained categories.\n")

    print(f"\n  📁 Saved to: {outdir}")
    print(f"  📄 Provenance: {outdir / 'PROVENANCE.md'}")


def download_emotion_dataset() -> None:
    """
    Download dair-ai/emotion — 20k tweets labeled with 6 emotions.

    Source: https://huggingface.co/datasets/dair-ai/emotion
    Labels: sadness (0), joy (1), love (2), anger (3), fear (4), surprise (5)
    """
    from datasets import load_dataset

    print("\n" + "=" * 60)
    print("Downloading dair-ai/emotion...")
    print("  Source: dair-ai/emotion")
    print("  Size: ~20,000 tweets")
    print("  Labels: 6 emotions (sadness, joy, love, anger, fear, surprise)")
    print("=" * 60)

    outdir = DATASET_DIR / "emotion"
    outdir.mkdir(parents=True, exist_ok=True)

    ds = load_dataset("dair-ai/emotion", "split")

    for split_name in ds:
        split = ds[split_name]
        csv_path = outdir / f"{split_name}.csv"
        split.to_csv(str(csv_path), index=False)
        print(f"  ✅ {split_name}: {len(split):,} examples → {csv_path.name}")

    label_names = ["sadness", "joy", "love", "anger", "fear", "surprise"]
    with open(outdir / "label_names.txt", "w") as f:
        for i, name in enumerate(label_names):
            f.write(f"{i}\t{name}\n")

    # Write provenance
    with open(outdir / "PROVENANCE.md", "w") as f:
        f.write("# dair-ai/emotion Dataset\n\n")
        f.write("**Source:** dair-ai (DAIR.AI)\n")
        f.write("**URL:** https://huggingface.co/datasets/dair-ai/emotion\n")
        f.write("**License:** Public domain\n\n")
        f.write("## Description\n\n")
        f.write("~20,000 English Twitter messages labeled with 6 basic emotions.\n")
        f.write("This is the dataset used to train the `bhadresh-savani/distilbert-base-uncased-emotion`\n")
        f.write("checkpoint that SoulSync uses as its default emotion classifier.\n\n")
        f.write("## Labels\n\n")
        for i, name in enumerate(label_names):
            f.write(f"- {i}: {name}\n")
        f.write("\n## Emotion Mapping to SoulSync\n\n")
        f.write("| Dataset Label | SoulSync Emotion |\n")
        f.write("|:--------------|:-----------------|\n")
        f.write("| sadness | Sad |\n")
        f.write("| joy | Happy |\n")
        f.write("| love | Calm / Love |\n")
        f.write("| anger | Angry |\n")
        f.write("| fear | Anxious |\n")
        f.write("| surprise | Neutral |\n")

    print(f"\n  📁 Saved to: {outdir}")
    print(f"  📄 Provenance: {outdir / 'PROVENANCE.md'}")


def print_summary() -> None:
    """Print dataset statistics."""
    print("\n" + "=" * 60)
    print("DATASET DOWNLOAD COMPLETE")
    print("=" * 60)

    for ds_name in ["go_emotions", "emotion"]:
        ds_path = DATASET_DIR / ds_name
        if ds_path.exists():
            csvs = list(ds_path.glob("*.csv"))
            total_bytes = sum(f.stat().st_size for f in csvs)
            total_mb = total_bytes / (1024 * 1024)
            print(f"\n  {ds_name}/")
            for csv in sorted(csvs):
                size_mb = csv.stat().st_size / (1024 * 1024)
                print(f"     {csv.name:20s} {size_mb:.1f} MB")
            print(f"     {'TOTAL':20s} {total_mb:.1f} MB")

    print(f"\n  All datasets saved to: {DATASET_DIR}")
    print("  These are REAL, publicly available datasets.")
    print("  They are used ONLY to train base NLP models.")
    print("  User data is NEVER mixed into these datasets.\n")


if __name__ == "__main__":
    download_goemotions()
    download_emotion_dataset()
    print_summary()
