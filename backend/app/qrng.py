import os
import requests
import secrets
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("qrng")

class CiscoQuantumRNG:
    """
    True quantum random number generator using
    Cisco Outshift QRNG API.
    
    This produces genuine quantum randomness from
    actual physical quantum measurements.
    """
    
    def __init__(self):
        # Load API key from environment variable
        self.api_key = os.getenv("CISCO_QRNG_API_KEY")
        self.url = "https://api.qrng.outshift.com/api/v1/random_numbers"
        self.backend_name = "Cisco Outshift QRNG"
        
        if not self.api_key:
            logger.warning(
                "CISCO_QRNG_API_KEY not set! "
                "Get your free API key at Cisco Outshift and set it to enable true quantum randomness."
            )
            
    def generate(self, num_bits: int = 256) -> str:
        """
        Generate num_bits of true quantum random bits
        from Cisco Outshift QRNG.
        Returns binary string e.g. "10110100..."
        """
        if not self.api_key:
            raise ValueError("CISCO_QRNG_API_KEY is not set.")
            
        headers = {
            "Content-Type": "application/json",
            "x-id-api-key": self.api_key
        }
        
        # We request bits in blocks. The max size depends on the API, 
        # but requesting a few blocks of 256 bits is usually safe.
        blocks_needed = (num_bits + 255) // 256
        data = {
            "encoding": "raw",
            "format": "all",
            "bits_per_block": 256,
            "number_of_blocks": blocks_needed
        }
        
        response = requests.post(self.url, headers=headers, json=data, timeout=10)
        response.raise_for_status()
        result = response.json()
        
        # Cisco API returns a 'data' array.
        # Since 'encoding' is 'raw', it typically returns integers which we convert to bit strings
        # or hex strings. The prompt's Cisco example doesn't show exact structure, 
        # but typically it's {"data": [val1, val2, ...]}
        bits = ""
        if "random_numbers" in result:
            for item in result["random_numbers"]:
                if "binary" in item:
                    bits += item["binary"]
                elif "hexadecimal" in item:
                    bits += bin(int(item["hexadecimal"], 16))[2:].zfill(256)
        elif "data" in result:
            for item in result["data"]:
                if isinstance(item, int):
                    bits += bin(item)[2:].zfill(256)
                elif isinstance(item, str):
                    try:
                        bits += bin(int(item, 16))[2:].zfill(256)
                    except ValueError:
                        bits += ''.join(format(ord(c), '08b') for c in item)
        else:
            raise ValueError(f"Unexpected response structure from Cisco API: {result}")
            
        # Return exactly num_bits
        if len(bits) < num_bits:
            raise ValueError("Cisco API did not return enough bits.")
            
        return bits[:num_bits]
        
    def check_availability(self) -> bool:
        """Check if Cisco QRNG is accessible"""
        if not self.api_key:
            return False
        try:
            # Quick ping by requesting 1 small block
            headers = {
                "Content-Type": "application/json",
                "x-id-api-key": self.api_key
            }
            data = {
                "encoding": "raw",
                "format": "all",
                "bits_per_block": 8,
                "number_of_blocks": 1
            }
            res = requests.post(self.url, headers=headers, json=data, timeout=5)
            return res.status_code == 200
        except Exception:
            return False
            
    def get_backend_info(self) -> dict:
        """Return info about the quantum device being used"""
        return {
            "backend_name": self.backend_name,
            "num_qubits": "N/A (Cloud QRNG)",
            "type": "cisco_outshift_qrng"
        }

class PRNGBaseline:
    """
    Classical PRNG baseline for comparison.
    Uses Python secrets module (OS CSPRNG).
    
    This is what current smart grid systems use.
    We compare this against Cisco QRNG to
    demonstrate quantum advantage.
    """
    
    def __init__(self):
        self.backend_name = "PRNG Fallback (secrets)"
        
    def generate(self, num_bits: int = 256) -> str:
        """Generate bits using classical PRNG"""
        num_bytes = (num_bits + 7) // 8
        random_bytes = secrets.token_bytes(num_bytes)
        bits = bin(int.from_bytes(random_bytes, 'big'))[2:]
        return bits.zfill(num_bytes * 8)[:num_bits]
    
    def check_availability(self) -> bool:
        return True
        
    def get_backend_info(self) -> dict:
        return {
            "backend_name": self.backend_name,
            "num_qubits": "Classical",
            "type": "prng_baseline"
        }
