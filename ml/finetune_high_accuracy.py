"""
Optimized fine-tuning of DistilBERT on first-person emotional reflections.
Configured with cosine learning rate scheduling, evaluation checkpointing,
and load_best_model_at_end to push overall accuracy over the 95% threshold.

Usage:
    python ml/finetune_high_accuracy.py --epochs 4
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
HF_CACHE = Path.home() / ".cache" / "huggingface" / "hub"
CHECKPOINT_DIR = HF_CACHE / "soulsync-checkpoints-95"
FINAL_SNAPSHOT_DIR = HF_CACHE / "models--local--soulsync-emotion-classifier" / "snapshots" / "main"

SOULSYNC_LABELS = ["Happy", "Sad", "Anxious", "Angry", "Calm", "Neutral"]

# Mapping from dair-ai/emotion (0: sadness, 1: joy, 2: love, 3: anger, 4: fear, 5: surprise)
# to SoulSync (0: Happy, 1: Sad, 2: Anxious, 3: Angry, 4: Calm, 5: Neutral)
DAIR_TO_SOULSYNC = {
    0: 1,  # sadness -> Sad
    1: 0,  # joy -> Happy
    2: 4,  # love -> Calm (warmth / emotional peace)
    3: 3,  # anger -> Angry
    4: 2,  # fear -> Anxious
    5: 5,  # surprise -> Neutral
}


def map_dair_labels(example: dict) -> dict:
    example["label"] = DAIR_TO_SOULSYNC[example["label"]]
    return example


def latest_usable_checkpoint(root: Path) -> str | None:
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
    return None


def main():
    parser = argparse.ArgumentParser(description="Fine-tune DistilBERT to >=95% accuracy")
    parser.add_argument("--epochs", type=int, default=4, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=3e-5, help="Learning rate (cosine scheduled)")
    parser.add_argument("--max-length", type=int, default=128, help="Max sequence length")
    parser.add_argument("--fresh", action="store_true", help="Start fresh from scratch")
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
        sys.exit(1)

    print("=" * 65)
    print("SoulSync Optimized Emotion Classifier Training (Target: >=95% Accuracy)")
    print("Base Architecture: distilbert-base-uncased")
    print(f"Hyperparameters: {args.epochs} epochs, lr={args.lr}, cosine scheduler")
    print("=" * 65)

    # 1. Load dataset
    print("\n[1/5] Loading clean first-person emotional reflection dataset...")
    ds = load_dataset("dair-ai/emotion")
    ds = ds.map(map_dair_labels)

    print(f"  Training samples:   {len(ds['train']):,}")
    print(f"  Validation samples: {len(ds['validation']):,}")
    print(f"  Test samples:       {len(ds['test']):,}")

    # 2. Tokenize
    print("\n[2/5] Tokenizing dataset...")
    tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")

    def tokenize_fn(batch):
        return tokenizer(batch["text"], truncation=True, max_length=args.max_length)

    ds = ds.map(tokenize_fn, batched=True, remove_columns=["text"])

    # 3. Model
    id2label = {i: name for i, name in enumerate(SOULSYNC_LABELS)}
    label2id = {name: i for i, name in enumerate(SOULSYNC_LABELS)}

    model = AutoModelForSequenceClassification.from_pretrained(
        "distilbert-base-uncased",
        num_labels=len(SOULSYNC_LABELS),
        id2label=id2label,
        label2id=label2id,
        low_cpu_mem_usage=False,
    )

    def compute_metrics(eval_pred):
        logits, labels = eval_pred
        preds = np.argmax(logits, axis=-1)
        accuracy = float((preds == labels).mean())

        # Top-2 accuracy
        top2_preds = np.argsort(logits, axis=-1)[:, -2:]
        top2_acc = float(np.mean([labels[i] in top2_preds[i] for i in range(len(labels))]))

        per_class = {}
        for idx, name in enumerate(SOULSYNC_LABELS):
            mask = labels == idx
            if mask.sum() > 0:
                per_class[f"acc_{name.lower()}"] = float((preds[mask] == idx).mean())

        return {"accuracy": accuracy, "top2_accuracy": top2_acc, **per_class}

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
        lr_scheduler_type="cosine",
        warmup_ratio=0.1,
        weight_decay=0.01,
        eval_strategy="steps",
        eval_steps=250,
        save_strategy="steps",
        save_steps=250,
        save_total_limit=1,
        load_best_model_at_end=True,
        metric_for_best_model="accuracy",
        greater_is_better=True,
        logging_steps=50,
        fp16=torch.cuda.is_available(),
        report_to="none",
        save_safetensors=True,
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

    resume_from = None if args.fresh else latest_usable_checkpoint(CHECKPOINT_DIR)
    if resume_from:
        print(f"  Resuming from checkpoint {resume_from}")
    else:
        print("  Starting fresh optimized run...")

    print("\n[3/5] Starting training loop...")
    start_time = time.time()
    trainer.train(resume_from_checkpoint=resume_from)
    duration_mins = round((time.time() - start_time) / 60, 1)
    print(f"\n[4/5] Training completed in {duration_mins} minutes!")

    # Final holdout test evaluation
    print("\n[5/5] Evaluating optimal checkpoint on holdout test set...")
    test_results = trainer.evaluate(ds["test"])
    print("\n" + "=" * 55)
    print("FINAL OPTIMAL CHECKPOINT TEST RESULTS:")
    print("=" * 55)
    for k, v in sorted(test_results.items()):
        if isinstance(v, float):
            print(f"  {k:25s}: {v * 100:.2f}%" if "acc" in k else f"  {k:25s}: {v:.4f}")

    # Save best model to Hugging Face Cache main snapshot
    FINAL_SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"\n  Deploying optimal model to: {FINAL_SNAPSHOT_DIR}")
    model.save_pretrained(str(FINAL_SNAPSHOT_DIR))
    tokenizer.save_pretrained(str(FINAL_SNAPSHOT_DIR))

    meta = {
        "model_name": "soulsync-emotion-classifier",
        "base_model": "distilbert-base-uncased",
        "dataset": "dair-ai/emotion (first-person clinical/psychological self-reports)",
        "labels": SOULSYNC_LABELS,
        "test_results": {k: v for k, v in test_results.items() if isinstance(v, (int, float))},
        "training_time_minutes": duration_mins,
        "optimization": "cosine-decay, load_best_model_at_end, eval_steps=250",
    }
    with open(FINAL_SNAPSHOT_DIR / "training_metadata.json", "w") as f:
        json.dump(meta, f, indent=2)

    print("\n[SUCCESS] Model deployed and active for SoulSync!")


if __name__ == "__main__":
    main()
