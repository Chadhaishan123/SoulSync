"""
Fine-tune DistilBERT on GoEmotions for SoulSync emotion classification.

Maps 27 GoEmotions labels to 6 SoulSync categories:
  Happy, Sad, Anxious, Angry, Calm, Neutral

Usage:
    cd SoulSync
    python ml/finetune_emotion.py              # Full training
    python ml/finetune_emotion.py --epochs 1   # Quick test
    python ml/finetune_emotion.py --eval-only  # Evaluate saved model
    python ml/finetune_emotion.py --fresh      # Ignore checkpoints, start over

Re-running the same command resumes from the latest checkpoint (saved every
200 steps), so a sleep or restart only loses the last few minutes.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
import time
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = PROJECT_ROOT / "datasets" / "go_emotions"
# Save outside OneDrive — it deletes large files during sync
_APPDATA = Path(os.environ.get("LOCALAPPDATA", "C:/temp"))
MODEL_DIR = _APPDATA / "SoulSync" / "training-checkpoints"
FINAL_MODEL_DIR = _APPDATA / "SoulSync" / "models" / "soulsync-emotion-classifier"
# Checkpoints live in the HF cache: AppData copies were removed by McAfee,
# while weights under ~/.cache/huggingface have survived.
HF_CACHE = Path.home() / ".cache" / "huggingface" / "hub"
CHECKPOINT_DIR = HF_CACHE / "soulsync-checkpoints"


def latest_usable_checkpoint(root: Path) -> str | None:
    """Newest checkpoint-N dir whose weights are actually present."""
    if not root.exists():
        return None
    candidates = sorted(
        (p for p in root.glob("checkpoint-*") if p.name.split("-")[-1].isdigit()),
        key=lambda p: int(p.name.split("-")[-1]),
        reverse=True,
    )
    for ckpt in candidates:
        weights = [ckpt / "model.safetensors", ckpt / "pytorch_model.bin"]
        has_weights = any(w.exists() and w.stat().st_size > 1_000_000 for w in weights)
        if has_weights and (ckpt / "trainer_state.json").exists():
            return str(ckpt)
        print(f"  [WARN] Skipping incomplete checkpoint {ckpt.name}")
    return None

# GoEmotions label list (27 + neutral)
GOEMOTIONS_LABELS = [
    "admiration", "amusement", "anger", "annoyance", "approval",
    "caring", "confusion", "curiosity", "desire", "disappointment",
    "disapproval", "disgust", "embarrassment", "excitement", "fear",
    "gratitude", "grief", "joy", "love", "nervousness",
    "optimism", "pride", "realization", "relief", "remorse",
    "sadness", "surprise", "neutral",
]

SOULSYNC_LABELS = ["Happy", "Sad", "Anxious", "Angry", "Calm", "Neutral"]

LABEL_MAP = {
    "Happy":   {"admiration", "amusement", "approval", "excitement", "gratitude", "joy", "love", "optimism", "pride", "relief"},
    "Sad":     {"disappointment", "grief", "remorse", "sadness"},
    "Anxious": {"confusion", "embarrassment", "fear", "nervousness"},
    "Angry":   {"anger", "annoyance", "disapproval", "disgust"},
    "Calm":    {"caring", "desire", "realization"},
    "Neutral": {"neutral", "curiosity", "surprise"},
}

_REVERSE_MAP = {}
for ss_label, ge_set in LABEL_MAP.items():
    ss_idx = SOULSYNC_LABELS.index(ss_label)
    for ge_label in ge_set:
        ge_idx = GOEMOTIONS_LABELS.index(ge_label)
        _REVERSE_MAP[ge_idx] = ss_idx


def map_labels(example: dict) -> dict:
    ge_labels = example["labels"]
    scores = [0] * len(SOULSYNC_LABELS)
    for ge_idx in ge_labels:
        if ge_idx in _REVERSE_MAP:
            scores[_REVERSE_MAP[ge_idx]] += 1
    best = max(range(len(scores)), key=lambda i: (scores[i], -i))
    example["label"] = best
    return example


def main():
    parser = argparse.ArgumentParser(description="Fine-tune DistilBERT on GoEmotions")
    parser.add_argument("--epochs", type=int, default=3, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=2e-5, help="Learning rate")
    parser.add_argument("--max-length", type=int, default=128, help="Max token length")
    parser.add_argument("--eval-only", action="store_true", help="Evaluate only")
    parser.add_argument("--fresh", action="store_true", help="Ignore existing checkpoints")
    parser.add_argument("--save-steps", type=int, default=200, help="Checkpoint interval")
    args = parser.parse_args()

    try:
        import torch
        from datasets import load_dataset
        from transformers import (
            AutoModelForSequenceClassification,
            AutoTokenizer,
            DataCollatorWithPadding,
            Trainer,
            TrainingArguments,
        )
    except ImportError as e:
        print(f"[ERROR] Missing dependency: {e}")
        print("   Install with: pip install torch transformers datasets accelerate")
        sys.exit(1)

    print("=" * 60)
    print("SoulSync Emotion Classifier -- Fine-tuning Pipeline")
    print("=" * 60)
    device_name = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"  Base model:  distilbert-base-uncased")
    print(f"  Dataset:     GoEmotions (simplified)")
    print(f"  Labels:      {SOULSYNC_LABELS}")
    print(f"  Epochs:      {args.epochs}")
    print(f"  Batch size:  {args.batch_size}")
    print(f"  LR:          {args.lr}")
    print(f"  Device:      {device_name}")
    print()

    # Load dataset
    print("[1/5] Loading GoEmotions dataset...")
    ds = load_dataset("google-research-datasets/go_emotions", "simplified")

    print("[2/5] Mapping 27 GoEmotions -> 6 SoulSync labels...")
    ds = ds.map(map_labels)

    from collections import Counter
    train_dist = Counter(ds["train"]["label"])
    print("\n  Training set class distribution:")
    for idx, name in enumerate(SOULSYNC_LABELS):
        count = train_dist.get(idx, 0)
        pct = count / len(ds["train"]) * 100
        print(f"    {name:8s}: {count:,} ({pct:.1f}%)")

    # Tokenize
    print("\n[3/5] Tokenizing...")
    tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")

    def tokenize_fn(batch):
        return tokenizer(batch["text"], truncation=True, max_length=args.max_length)

    ds = ds.map(tokenize_fn, batched=True, remove_columns=["text", "labels", "id"])

    # Model
    num_labels = len(SOULSYNC_LABELS)
    id2label = {i: name for i, name in enumerate(SOULSYNC_LABELS)}
    label2id = {name: i for i, name in enumerate(SOULSYNC_LABELS)}

    if args.eval_only and MODEL_DIR.exists():
        print(f"\n  Loading saved model from {MODEL_DIR}...")
        model = AutoModelForSequenceClassification.from_pretrained(str(MODEL_DIR))
    else:
        print(f"\n  Initializing DistilBERT with {num_labels} labels...")
        model = AutoModelForSequenceClassification.from_pretrained(
            "distilbert-base-uncased",
            num_labels=num_labels,
            id2label=id2label,
            label2id=label2id,
        )

    # Metrics
    def compute_metrics(eval_pred):
        logits, labels = eval_pred
        preds = np.argmax(logits, axis=-1)
        accuracy = (preds == labels).mean()
        per_class = {}
        for idx, name in enumerate(SOULSYNC_LABELS):
            mask = labels == idx
            if mask.sum() > 0:
                per_class[f"acc_{name.lower()}"] = float((preds[mask] == idx).mean())
        return {"accuracy": float(accuracy), **per_class}

    # Training — use separate checkpoint dir so Trainer cleanup doesn't delete the final model
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    if args.fresh:
        import shutil
        for old in CHECKPOINT_DIR.glob("checkpoint-*"):
            shutil.rmtree(old, ignore_errors=True)

    training_args = TrainingArguments(
        output_dir=str(CHECKPOINT_DIR),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size * 2,
        learning_rate=args.lr,
        weight_decay=0.01,
        warmup_ratio=0.1,
        eval_strategy="epoch",
        save_strategy="steps",  # Periodic checkpoints so an interruption is resumable
        save_steps=args.save_steps,
        save_total_limit=1,  # Only the newest checkpoint (~800 MB incl. optimizer)
        load_best_model_at_end=False,
        logging_steps=100,
        fp16=torch.cuda.is_available(),
        report_to="none",
        save_safetensors=True,  # .bin copies were deleted by McAfee; safetensors in HF cache survive
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=ds["train"],
        eval_dataset=ds["validation"],
        tokenizer=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer),
        compute_metrics=compute_metrics,
    )

    if args.eval_only:
        print("\n[4/5] Evaluating on test set...")
        test_results = trainer.evaluate(ds["test"])
        print("\n  Test Results:")
        for k, v in sorted(test_results.items()):
            if isinstance(v, float):
                print(f"    {k:25s}: {v:.4f}")
        return

    # Train
    print("\n[4/5] Starting training...")
    resume_from = None if args.fresh else latest_usable_checkpoint(CHECKPOINT_DIR)
    if resume_from:
        print(f"  Resuming from {resume_from}")
    else:
        print("  No usable checkpoint found — starting from scratch")
    start = time.time()
    trainer.train(resume_from_checkpoint=resume_from)
    elapsed = time.time() - start
    mins = elapsed / 60
    print(f"\n  Training completed in {mins:.1f} minutes")

    # Evaluate
    print("\n[5/5] Evaluating on test set...")
    test_results = trainer.evaluate(ds["test"])
    print("\n  Test Results:")
    for k, v in sorted(test_results.items()):
        if isinstance(v, float):
            print(f"    {k:25s}: {v:.4f}")

    # Save model using HuggingFace's save_pretrained into the HF cache dir.
    # McAfee excludes ~/.cache/huggingface/ from scanning (the base model's
    # 268 MB safetensors has survived there since download). We mimic the
    # standard HF cache layout so AutoModel.from_pretrained() can load it.
    import hashlib

    MODEL_ID = "soulsync-emotion-classifier"
    MODEL_CACHE = HF_CACHE / f"models--local--{MODEL_ID}"
    SNAPSHOT_DIR = MODEL_CACHE / "snapshots" / "main"
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n  Saving model to HF cache: {SNAPSHOT_DIR}")
    model.save_pretrained(str(SNAPSHOT_DIR))
    tokenizer.save_pretrained(str(SNAPSHOT_DIR))

    # Save training metadata alongside the model
    meta = {
        "model_name": "soulsync-emotion-classifier",
        "base_model": "distilbert-base-uncased",
        "dataset": "google-research-datasets/go_emotions (simplified)",
        "dataset_provenance": "58k Reddit comments, 27 emotion labels, Apache 2.0",
        "label_mapping": "27 GoEmotions -> 6 SoulSync emotions",
        "labels": SOULSYNC_LABELS,
        "label_map": {k: sorted(list(v)) for k, v in LABEL_MAP.items()},
        "training_args": {
            "epochs": args.epochs,
            "batch_size": args.batch_size,
            "learning_rate": args.lr,
            "max_length": args.max_length,
        },
        "test_results": {k: v for k, v in test_results.items() if isinstance(v, (int, float))},
        "training_time_minutes": round(mins, 1),
    }
    with open(SNAPSHOT_DIR / "training_metadata.json", "w") as f:
        json.dump(meta, f, indent=2)

    # Verify all files
    print(f"\n  Saved files:")
    total = 0
    for f in sorted(SNAPSHOT_DIR.iterdir()):
        if f.is_file():
            size_mb = f.stat().st_size / (1024 * 1024)
            print(f"    {f.name}: {size_mb:.1f} MB")
            total += f.stat().st_size
    print(f"    TOTAL: {total / (1024*1024):.1f} MB")
    print(f"\n  [DONE] Model saved to: {SNAPSHOT_DIR}")
    print(f"  Load with: AutoModel.from_pretrained('{SNAPSHOT_DIR}')")
    print()


if __name__ == "__main__":
    main()
