"""
Find the EICAR test string in the model weights and patch it.
EICAR = X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*
"""
import io
import torch
from transformers import AutoModelForSequenceClassification

EICAR = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"

print(f"EICAR pattern ({len(EICAR)} bytes): {EICAR}")

print("\nLoading model...")
model = AutoModelForSequenceClassification.from_pretrained(
    "distilbert-base-uncased", num_labels=6
)

print("Serializing...")
buf = io.BytesIO()
torch.save(model.state_dict(), buf)
data = buf.getvalue()
print(f"Total bytes: {len(data)}")

# Search for EICAR
pos = data.find(EICAR)
if pos >= 0:
    print(f"\n[FOUND] EICAR at byte offset {pos}")
    print(f"  Context: ...{data[max(0,pos-20):pos+len(EICAR)+20]}...")
else:
    print("\n[NOT FOUND] Full EICAR not in raw bytes")
    # Search for partial matches
    for substr_len in [40, 30, 20, 15, 10]:
        substr = EICAR[:substr_len]
        pos = data.find(substr)
        if pos >= 0:
            print(f"  Partial match ({substr_len} bytes) at offset {pos}: {substr}")
            break

# Also check base64
import base64
b64 = base64.b64encode(data)
pos = b64.find(EICAR)
if pos >= 0:
    print(f"\n[FOUND in BASE64] EICAR at offset {pos}")
else:
    print(f"\n[NOT FOUND in BASE64] Full EICAR not in base64 output")
    for substr_len in [40, 30, 20, 15, 10]:
        substr = EICAR[:substr_len]
        pos = b64.find(substr)
        if pos >= 0:
            print(f"  Partial match ({substr_len} bytes) at offset {pos}: {substr}")
            break

print("\nDone.")
