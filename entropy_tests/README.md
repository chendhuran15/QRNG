# NIST SP 800-22 Entropy Validation Guide

To validate that the Cisco Quantum Random Number Generator (QRNG) produces high-quality, unpredictable entropy for challenge-response authentication, the generated bit sequences must undergo statistical analysis. 

This directory contains validation utilities:
1. **`nist_tests.py`**: A pure Python script that executes the core NIST SP 800-22 tests.
2. **Standard Pipeline instructions**: Piping output to the official NIST reference command-line suite.

---

## 1. Running the Core Python Script

The python script `nist_tests.py` runs three essential NIST tests on a sequence of 10,000 bits generated from Cisco QRNG:
- **Frequency (Monobit) Test**: Checks if the counts of `0`s and `1`s are balanced.
- **Frequency Test within a Block (M=20)**: Checks if blocks of bits show locally uniform density.
- **Runs Test**: Validates the frequency of state switches (0 -> 1 and 1 -> 0).

### Instructions to Execute:
From the root of the project, run:
```bash
python entropy_tests/nist_tests.py
```

### Interpretation of Results:
- **P-Value**: The probability that a perfect random generator would produce a sequence less random than the one observed.
- **Significance Level ($\alpha$)**: Set to `0.01` by default.
- If $p\text{-value} \ge 0.01$, the sequence **passes** the test, confirming that there is no statistically significant evidence of non-randomness.

---

## 2. Using the Full NIST SP 800-22 C Reference Suite

For publication-grade research, you should run the full 15-test NIST suite. Since the official suite is written in C, you can compile and pipe generated sequences using these steps:

### Step 1: Download & Compile the NIST Suite
1. Download the official source code from the [NIST Random Number Generation Website](https://csrc.nist.gov/projects/random-bit-generation/documentation-and-software).
2. Extract the file and compile the suite:
   ```bash
   cd sts-2.1.2/
   make
   ```
   This compiles the suite and outputs an executable `./assess`.

### Step 2: Generate a Large Binary Bitstream
The official NIST suite requires large files (ideally 1,000,000+ bits per stream). We can generate a binary file by running the following Python script (create inside the `entropy_tests/` or running dynamically):
```python
import os
import sys
sys.path.append("../backend")
from app.qrng import CiscoQuantumRNG

qrng = CiscoQuantumRNG()
print("Generating 1,000,000 bits (this may take a few seconds)...")
bit_str = qrng.generate(1000000)

# Convert character '0' and '1' string into actual packed bytes
packed_bytes = bytearray()
for i in range(0, len(bit_str), 8):
    byte_chunk = bit_str[i:i+8]
    byte_val = int(byte_chunk, 2)
    packed_bytes.append(byte_val)

with open("quantum_entropy.bin", "wb") as f:
    f.write(packed_bytes)
print("Saved packed binary entropy to 'quantum_entropy.bin'.")
```

### Step 3: Run the NIST Assessor
Execute the `./assess` binary and feed it the binary file:
```bash
./assess 1000000
```
- Select option `[0]` (Input File).
- Enter file path: `quantum_entropy.bin`.
- Choose the tests to run (select `[1]` to run all 15 tests).
- Leave block lengths at default values.
- Examine the generated report in `experiments/AlgorithmTesting/finalAnalysisReport.txt`.
- Check that the proportion of sequences passing exceeds the threshold ($\sim 96\%$ for 100 sequences) and the $p$-values of the distribution are uniform ($P\text{-value}_T \ge 0.0001$).
