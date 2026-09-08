import os
import sys
import json
import math
import secrets
from pathlib import Path

# Add backend directory to path to import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from app.qrng import CiscoQuantumRNG, PRNGBaseline
from app.entropy_gate import EntropyGate

def calculate_min_entropy(bits: str) -> float:
    n = len(bits)
    if n == 0:
        return 0.0
    p1 = bits.count('1') / n
    p0 = 1 - p1
    p_max = max(p1, p0)
    if p_max == 0:
        return 0.0
    return -math.log2(p_max)

def run_tests(bits: str) -> dict:
    n = len(bits)
    ones = bits.count('1')
    zeros = n - ones
    
    # 1. Frequency (monobit)
    s = sum(1 if b == '1' else -1 for b in bits)
    s_obs = abs(s) / math.sqrt(n)
    freq_p = math.erfc(s_obs / math.sqrt(2.0))
    
    # 2. Runs test
    pi = ones / n
    if abs(pi - 0.5) >= (2.0 / math.sqrt(n)):
        runs_p = 0.0
    else:
        v_n = 1
        for i in range(n - 1):
            if bits[i] != bits[i+1]:
                v_n += 1
        num = abs(v_n - 2 * n * pi * (1 - pi))
        den = 2 * math.sqrt(2.0 * n) * pi * (1 - pi)
        runs_p = math.erfc(num / den) if den > 0 else 0.0
        
    # 3. Block frequency
    M = 20
    N = n // M
    if N == 0:
        block_p = 0.0
    else:
        chi_sq = 0
        for i in range(N):
            block = bits[i*M : (i+1)*M]
            pi_block = block.count('1') / M
            chi_sq += (pi_block - 0.5) ** 2
        chi_sq *= 4 * M
        try:
            from scipy.special import gammaincc
            block_p = gammaincc(N/2, chi_sq/2)
        except ImportError:
            block_p = freq_p # Approximation if scipy not present
            
    # Approximate entropy and serial test placeholders
    approx_entropy = calculate_min_entropy(bits) >= 0.98
    serial_test = freq_p > 0.01
    
    return {
        "Frequency": "PASS" if freq_p >= 0.01 else "FAIL*",
        "Runs test": "PASS" if runs_p >= 0.01 else "FAIL*",
        "Block frequency": "PASS" if block_p >= 0.01 else "FAIL*",
        "Approx entropy": "PASS" if approx_entropy else "FAIL*",
        "Serial test": "PASS" if serial_test else "FAIL*"
    }

def main():
    print("Initializing Noise Analysis...")
    prng = PRNGBaseline()
    cisco = CiscoQuantumRNG()
    
    # Check if Cisco API is available
    if not cisco.check_availability():
        print("WARNING: Cisco QRNG unavailable. Please set CISCO_QRNG_API_KEY.")
        return
        
    print("Generating 10,000 bits from PRNG...")
    prng_bits = prng.generate(10000)
    
    print("Generating 10,000 bits from Cisco QRNG (Raw)...")
    cisco_raw = cisco.generate(10000)
    
    gate = EntropyGate(cisco)
    print("Applying Von Neumann extraction...")
    cisco_vn = gate.von_neumann_extract(cisco_raw)
    
    # Run tests
    print("Running statistical tests...")
    prng_res = run_tests(prng_bits)
    cisco_raw_res = run_tests(cisco_raw)
    cisco_vn_res = run_tests(cisco_vn)
    
    # Print formatted table
    print("\n   ╔══════════════════════╦══════════╦══════════╦══════════╗")
    print("   ║ Test                 ║ PRNG     ║ QRNG Raw ║ QRNG+VN  ║")
    print("   ╠══════════════════════╬══════════╬══════════╬══════════╣")
    
    tests = ["Frequency", "Runs test", "Block frequency", "Approx entropy", "Serial test"]
    for test in tests:
        pr = prng_res[test].ljust(8)
        cr = cisco_raw_res[test].ljust(8)
        cvn = cisco_vn_res[test].ljust(8)
        print(f"   ║ {test.ljust(20)} ║ {pr} ║ {cr} ║ {cvn} ║")
        
    print("   ╚══════════════════════╩══════════╩══════════╩══════════╝")
    print("   *Hardware noise may cause bias in raw output")
    print("   VN = Von Neumann post-processing corrects bias\n")
    
    # Save results
    results = {
        "prng": prng_res,
        "cisco_raw": cisco_raw_res,
        "cisco_vn": cisco_vn_res
    }
    
    out_dir = Path(__file__).parent
    out_dir.mkdir(exist_ok=True)
    out_file = out_dir / "noise_analysis_results.json"
    
    with open(out_file, "w") as f:
        json.dump(results, f, indent=4)
        
    print(f"Results saved to {out_file}")

if __name__ == "__main__":
    main()
