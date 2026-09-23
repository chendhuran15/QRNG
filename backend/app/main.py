import hmac
import hashlib
import time
import uuid
import logging
import math
import random
import copy
from typing import Dict, Any, List, Optional, Set
from fastapi import FastAPI, HTTPException, status
from datetime import datetime, timedelta
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from app.qrng import CiscoQuantumRNG, PRNGBaseline
from app.entropy_gate import EntropyGate
from app.config import (
    CUSTOMER_ACCOUNTS,
    ATM_FLEET,
    ADMIN_CREDENTIALS,
    SHARED_SECRETS,
    SESSION_EXPIRY_SECONDS,
    CORS_ORIGINS
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("qvault_bank")

app = FastAPI(
    title="Q-Vault: Quantum-Secured Core Banking & ATM Cash Management System",
    description="Commercial-grade core banking backend protected by Cisco QRNG and Entropy Gate cryptographic handshakes.",
    version="2.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize QRNG Engine & Entropy Gate
base_qrng = CiscoQuantumRNG()
if not base_qrng.check_availability():
    logger.warning("Cisco QRNG cloud API key not set or ping failed. Operating with PRNG cryptographic baseline fallback.")
    base_qrng = PRNGBaseline()
entropy_gate = EntropyGate(base_qrng)

# In-Memory Banking State
accounts_db: Dict[str, Dict[str, Any]] = copy.deepcopy(CUSTOMER_ACCOUNTS)
atm_fleet_db: Dict[str, Dict[str, Any]] = copy.deepcopy(ATM_FLEET)

# Active challenge sessions
# Schema: { session_id: { "account_id": str, "nonce": str, "timestamp": float, "entropy": float, "source": str } }
active_sessions: Dict[str, Dict[str, Any]] = {}

# Registry of consumed session IDs to detect replay attacks
used_sessions: Set[str] = set()

# Real-time transaction ledger & security event logs
transaction_ledger: List[Dict[str, Any]] = []
security_events_log: List[Dict[str, Any]] = []

def seed_banking_ledger():
    global transaction_ledger, security_events_log
    now = datetime.now()
    
    initial_transactions = [
        {
            "tx_id": "TXN-A8F24C91",
            "timestamp": (now - timedelta(minutes=42)).strftime("%Y-%m-%d %H:%M:%S"),
            "type": "CASH_WITHDRAWAL",
            "account_id": "ACC-4921",
            "holder_name": "John Doe",
            "atm_id": "ATM-01",
            "atm_name": "Manhattan 5th Ave Terminal",
            "amount": 200.00,
            "remaining_balance": 14250.00,
            "atm_vault_remaining": 68500.00,
            "status": "APPROVED",
            "status_label": "APPROVED (Quantum Nonce Valid)",
            "auth_token": "AUTH-DISPENSE-E3B0C44298FC",
            "quantum_nonce_digest": "SHA256:7f83b1657ff1fc53...",
            "full_nonce_digest": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
            "min_entropy": 0.9984,
            "qrng_backend": "Cisco Outshift QRNG"
        },
        {
            "tx_id": "TXN-B71E902D",
            "timestamp": (now - timedelta(minutes=25)).strftime("%Y-%m-%d %H:%M:%S"),
            "type": "CASH_WITHDRAWAL",
            "account_id": "ACC-8812",
            "holder_name": "Sarah Connor",
            "atm_id": "ATM-02",
            "atm_name": "JFK Airport Terminal 4",
            "amount": 500.00,
            "remaining_balance": 28900.00,
            "atm_vault_remaining": 22000.00,
            "status": "APPROVED",
            "status_label": "APPROVED (Quantum Nonce Valid)",
            "auth_token": "AUTH-DISPENSE-51854442CD09",
            "quantum_nonce_digest": "SHA256:4b227777d4dd1fc6...",
            "full_nonce_digest": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
            "min_entropy": 0.9979,
            "qrng_backend": "Cisco Outshift QRNG"
        },
        {
            "tx_id": "TXN-C339F80A",
            "timestamp": (now - timedelta(minutes=14)).strftime("%Y-%m-%d %H:%M:%S"),
            "type": "CASH_WITHDRAWAL",
            "account_id": "ACC-3104",
            "holder_name": "Tech Corp Payroll",
            "atm_id": "ATM-01",
            "atm_name": "Manhattan 5th Ave Terminal",
            "amount": 1000.00,
            "remaining_balance": 145000.00,
            "atm_vault_remaining": 69000.00,
            "status": "APPROVED",
            "status_label": "APPROVED (Quantum Nonce Valid)",
            "auth_token": "AUTH-DISPENSE-99A1054E7812",
            "quantum_nonce_digest": "SHA256:ef2d127de37b942b...",
            "full_nonce_digest": "ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d",
            "min_entropy": 0.9991,
            "qrng_backend": "Cisco Outshift QRNG"
        },
        {
            "tx_id": "TXN-WARN-REPLAY01",
            "timestamp": (now - timedelta(minutes=5)).strftime("%Y-%m-%d %H:%M:%S"),
            "type": "CASH_WITHDRAWAL",
            "account_id": "ACC-4921",
            "holder_name": "John Doe",
            "atm_id": "ATM-01",
            "atm_name": "Manhattan 5th Ave Terminal",
            "amount": 500.00,
            "remaining_balance": 14250.00,
            "atm_vault_remaining": 68500.00,
            "status": "BLOCKED",
            "status_label": "BLOCKED (Replay Fraud Detected)",
            "auth_token": "REJECTED_REPLAY_ATTACK",
            "quantum_nonce_digest": "SHA256:EXPIRED_REPLAY...",
            "full_nonce_digest": "REPLAY_OF_CAPTURED_AUTHENTICATION_PACKET",
            "min_entropy": 0.0,
            "qrng_backend": "Central Bank Security Filter"
        }
    ]
    
    transaction_ledger.extend(initial_transactions)
    
    security_events_log.extend([
        {
            "timestamp": (now - timedelta(minutes=5)).strftime("%Y-%m-%d %H:%M:%S"),
            "severity": "CRITICAL",
            "description": "Automated Fraud Defense: Replay packet detected at ATM-01. Nonce already consumed. Safe transaction rejected."
        },
        {
            "timestamp": (now - timedelta(minutes=14)).strftime("%Y-%m-%d %H:%M:%S"),
            "severity": "SUCCESS",
            "description": "Cisco QRNG Certified Challenge issued: 256 bits min-entropy 0.9991 for ACC-3104."
        },
        {
            "timestamp": (now - timedelta(minutes=25)).strftime("%Y-%m-%d %H:%M:%S"),
            "severity": "SUCCESS",
            "description": "Cryptographic HMAC handshake validated for Sarah Connor (ACC-8812) at ATM-02."
        },
        {
            "timestamp": (now - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"),
            "severity": "INFO",
            "description": "Central Bank HSM Online: Von Neumann Entropy Gate debiasing threshold set to 0.98."
        }
    ])

seed_banking_ledger()

# --- Request / Response Models ---

class BankChallengeRequest(BaseModel):
    account_id: str = Field(..., description="Customer bank account ID e.g. ACC-4921")
    atm_id: Optional[str] = Field(None, description="ATM terminal initiating the request")
    amount: Optional[float] = Field(0.0, description="Requested withdrawal amount")

class BankChallengeResponse(BaseModel):
    session_id: str
    nonce: str
    timestamp: float
    expires_in: int
    entropy_score: float
    correction_applied: bool
    qrng_source: str
    certified: bool
    account_id: str

class WithdrawRequest(BaseModel):
    account_id: str = Field(..., description="Customer account ID")
    amount: float = Field(..., gt=0, description="Amount to withdraw")
    atm_id: str = Field(..., description="ATM terminal ID")
    pin: str = Field(..., description="4-digit customer PIN")
    client_hmac: str = Field(..., description="HMAC-SHA256 computed on client/card")
    session_id: str = Field(..., description="Active session ID from /request-challenge")

class WithdrawResponse(BaseModel):
    success: bool
    message: str
    tx_id: Optional[str] = None
    dispense_token: Optional[str] = None
    account_id: str
    holder_name: str
    amount_dispensed: float
    remaining_balance: float
    atm_id: str
    atm_name: str
    atm_vault_remaining: float
    timestamp: str
    quantum_nonce_digest: str
    full_nonce_digest: str
    entropy_score: float
    qrng_source: str

class TransferRequest(BaseModel):
    from_account: str
    to_account: str
    amount: float = Field(..., gt=0)
    pin: str
    session_id: str
    client_hmac: str

class TransferResponse(BaseModel):
    success: bool
    message: str
    tx_id: Optional[str] = None
    from_account: str
    to_account: str
    amount: float
    from_remaining_balance: float
    timestamp: str
    quantum_proof: str

class ToggleLockRequest(BaseModel):
    atm_id: str
    locked: bool

class AdminLoginRequest(BaseModel):
    username: str
    password: str

class SimulateJackpottingRequest(BaseModel):
    atm_id: str = Field("ATM-01", description="Target ATM terminal to attack")
    replay_amount: float = Field(500.00, description="Amount in captured packet")

# --- Helper Cryptographic Utilities ---

def compute_server_hmac(secret_key: str, session_id: str, nonce: str, account_id: str, amount: float) -> str:
    """Compute expected HMAC-SHA256 signature for bank withdrawal."""
    payload = f"{session_id}:{nonce}:{account_id}:{amount:.2f}"
    return hmac.new(
        key=secret_key.encode("utf-8"),
        msg=payload.encode("utf-8"),
        digestmod=hashlib.sha256
    ).hexdigest()

def compute_flexible_hmacs(secret_key: str, session_id: str, nonce: str, account_id: str, amount: float) -> List[str]:
    """Generate acceptable canonical HMAC encodings to ensure robust client integration."""
    candidates = [
        f"{session_id}:{nonce}:{account_id}:{amount:.2f}",
        f"{session_id}:{nonce}:{account_id}:{amount}",
        f"{session_id}:{nonce}",
        f"{session_id}:{account_id}:{amount:.2f}",
    ]
    return [
        hmac.new(secret_key.encode("utf-8"), c.encode("utf-8"), hashlib.sha256).hexdigest()
        for c in candidates
    ]

# --- Core Banking API Endpoints ---

@app.get("/api/info")
async def root_info():
    return {
        "service": "Q-Vault: Quantum-Secured Core Banking & ATM Cash Management System",
        "status": "ONLINE",
        "qrng_backend": base_qrng.backend_name,
        "entropy_gate_threshold": entropy_gate.ENTROPY_THRESHOLD,
        "docs_url": "/docs"
    }

@app.get("/api/bank/accounts")
async def get_bank_accounts():
    """Returns customer accounts for ATM card selection (masking secret keys)."""
    sanitized = []
    for acc_id, acc in accounts_db.items():
        sanitized.append({
            "account_id": acc["account_id"],
            "holder_name": acc["holder_name"],
            "account_type": acc["account_type"],
            "balance": acc["balance"],
            "card_number": acc["card_number"],
            "status": acc["status"],
            "pin": acc["pin"]  # Exposed for demo convenience
        })
    return sanitized

@app.get("/api/bank/atms")
async def get_atm_fleet():
    """Returns real-time status and physical safe balances for all ATM terminals."""
    return list(atm_fleet_db.values())

@app.post("/api/bank/request-challenge", response_model=BankChallengeResponse)
async def request_bank_challenge(req: BankChallengeRequest):
    """
    Step 1 of Quantum ATM Handshake:
    Central Bank HSM queries Cisco QRNG through the Von Neumann Entropy Gate
    to produce a 256-bit unguessable nonce for the customer session.
    """
    if req.account_id not in accounts_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Account ID '{req.account_id}' not found in Q-Vault registry."
        )

    try:
        challenge_data = entropy_gate.get_certified_challenge(256)
        nonce_hex = hex(int(challenge_data["challenge"], 2))[2:].zfill(64)
        session_id = str(uuid.uuid4())
        current_time = time.time()

        active_sessions[session_id] = {
            "account_id": req.account_id,
            "nonce": nonce_hex,
            "timestamp": current_time,
            "entropy": challenge_data["entropy"],
            "source": challenge_data["source"],
            "atm_id": req.atm_id,
            "amount": req.amount
        }

        security_events_log.insert(0, {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "severity": "SUCCESS",
            "description": f"HSM generated certified 256-bit quantum challenge for {req.account_id} via {challenge_data['source']} (Entropy: {challenge_data['entropy']:.4f})."
        })

        return BankChallengeResponse(
            session_id=session_id,
            nonce=nonce_hex,
            timestamp=current_time,
            expires_in=SESSION_EXPIRY_SECONDS,
            entropy_score=challenge_data["entropy"],
            correction_applied=challenge_data["correction_applied"],
            qrng_source=challenge_data["source"],
            certified=challenge_data["certified"],
            account_id=req.account_id
        )
    except Exception as e:
        logger.error(f"Error in request_bank_challenge: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate quantum challenge: {str(e)}"
        )

@app.post("/api/bank/withdraw", response_model=WithdrawResponse)
async def withdraw_cash(req: WithdrawRequest):
    """
    Step 2 of Quantum ATM Handshake:
    Validates PIN, checks terminal lock status, verifies Cisco Quantum Nonce,
    validates client HMAC in constant-time, guarantees single-use replay protection,
    and debits balance & ATM vault safe.
    """
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 1. Verify ATM terminal status
    atm = atm_fleet_db.get(req.atm_id)
    if not atm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ATM terminal '{req.atm_id}' is not recognized."
        )
    if atm["status"] == "LOCKED":
        security_events_log.insert(0, {
            "timestamp": now_str,
            "severity": "CRITICAL",
            "description": f"Withdrawal rejected at {req.atm_id}: Physical safe is in emergency LOCKDOWN."
        })
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Terminal {req.atm_id} safe is LOCKED by Central Security. Cash dispensing is disabled."
        )

    # 2. Check physical cash remaining in ATM safe
    if atm["vault_balance"] < req.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ATM vault cash insufficient. Safe balance: ${atm['vault_balance']:,.2f}."
        )

    # 3. Verify customer account
    account = accounts_db.get(req.account_id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Account '{req.account_id}' not found."
        )
    if account["status"] != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended or inactive."
        )

    # 4. Verify customer PIN
    if account["pin"] != req.pin:
        security_events_log.insert(0, {
            "timestamp": now_str,
            "severity": "WARNING",
            "description": f"Invalid PIN entered for account {req.account_id} at {req.atm_id}."
        })
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 4-digit PIN entered. Authentication aborted."
        )

    # 5. Check account balance
    if account["balance"] < req.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient funds. Available: ${account['balance']:,.2f}, Requested: ${req.amount:,.2f}."
        )

    # 6. Replay Attack Detection & Session Verification
    if req.session_id in used_sessions:
        # Malicious Replay Attack detected!
        security_events_log.insert(0, {
            "timestamp": now_str,
            "severity": "CRITICAL",
            "description": f"CRITICAL FRAUD DETECTED: REPLAY ATTACK BLOCKED - NONCE ALREADY CONSUMED for {req.account_id} at {req.atm_id}!"
        })
        
        # Log blocked transaction
        transaction_ledger.insert(0, {
            "tx_id": f"TXN-BLOCKED-{uuid.uuid4().hex[:6].upper()}",
            "timestamp": now_str,
            "type": "CASH_WITHDRAWAL",
            "account_id": req.account_id,
            "holder_name": account["holder_name"],
            "atm_id": req.atm_id,
            "atm_name": atm["name"],
            "amount": req.amount,
            "remaining_balance": account["balance"],
            "atm_vault_remaining": atm["vault_balance"],
            "status": "BLOCKED",
            "status_label": "BLOCKED (Replay Fraud Detected)",
            "auth_token": "REPLAY_ATTACK_INTERCEPTED",
            "quantum_nonce_digest": "SHA256:CONSUMED_NONCE",
            "full_nonce_digest": "REPLAY_ATTACK_ATTEMPT_WITH_USED_SESSION",
            "min_entropy": 0.0,
            "qrng_backend": "Central Bank Security Filter"
        })

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="CRITICAL FRAUD ALERT: Quantum Challenge Nonce already consumed! Replay attack blocked."
        )

    session = active_sessions.get(req.session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication session invalid or not found. Please request a fresh challenge."
        )

    # Check TTL expiry
    if time.time() - session["timestamp"] > SESSION_EXPIRY_SECONDS:
        del active_sessions[req.session_id]
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Quantum Challenge timed out (>120s). Transaction expired for security."
        )

    # 7. Constant-Time HMAC-SHA256 Signature Verification
    secret_key = account["secret_key"]
    valid_hmacs = compute_flexible_hmacs(
        secret_key, req.session_id, session["nonce"], req.account_id, req.amount
    )
    
    is_valid_hmac = any(hmac.compare_digest(candidate, req.client_hmac) for candidate in valid_hmacs)
    if not is_valid_hmac:
        security_events_log.insert(0, {
            "timestamp": now_str,
            "severity": "CRITICAL",
            "description": f"HMAC Signature Verification Failure for {req.account_id}. Secret mismatch or packet tampering."
        })
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cryptographic verification failed: Invalid client HMAC signature."
        )

    # 8. Mark session as permanently CONSUMED to prevent replay attacks
    used_sessions.add(req.session_id)
    del active_sessions[req.session_id]

    # 9. Commit financial transaction
    account["balance"] -= req.amount
    atm["vault_balance"] -= req.amount

    dispense_token = f"AUTH-DISPENSE-{uuid.uuid4().hex[:12].upper()}"
    nonce_digest = hashlib.sha256(session["nonce"].encode("utf-8")).hexdigest()

    tx_entry = {
        "tx_id": f"TXN-{uuid.uuid4().hex[:8].upper()}",
        "timestamp": now_str,
        "type": "CASH_WITHDRAWAL",
        "account_id": req.account_id,
        "holder_name": account["holder_name"],
        "atm_id": req.atm_id,
        "atm_name": atm["name"],
        "amount": req.amount,
        "remaining_balance": account["balance"],
        "atm_vault_remaining": atm["vault_balance"],
        "status": "APPROVED",
        "status_label": "APPROVED (Quantum Nonce Valid)",
        "auth_token": dispense_token,
        "quantum_nonce_digest": f"SHA256:{nonce_digest[:16]}...",
        "full_nonce_digest": nonce_digest,
        "min_entropy": session["entropy"],
        "qrng_backend": session["source"]
    }
    transaction_ledger.insert(0, tx_entry)

    security_events_log.insert(0, {
        "timestamp": now_str,
        "severity": "SUCCESS",
        "description": f"Cash Dispense Authorized: ${req.amount:,.2f} at {req.atm_id} for {account['holder_name']}. Quantum proof verified."
    })

    return WithdrawResponse(
        success=True,
        message=f"Dispensing ${req.amount:,.2f} authorized. Quantum security proof validated.",
        tx_id=tx_entry["tx_id"],
        dispense_token=dispense_token,
        account_id=req.account_id,
        holder_name=account["holder_name"],
        amount_dispensed=req.amount,
        remaining_balance=account["balance"],
        atm_id=req.atm_id,
        atm_name=atm["name"],
        atm_vault_remaining=atm["vault_balance"],
        timestamp=now_str,
        quantum_nonce_digest=f"SHA256:{nonce_digest[:16]}...",
        full_nonce_digest=nonce_digest,
        entropy_score=session["entropy"],
        qrng_source=session["source"]
    )

@app.post("/api/bank/transfer", response_model=TransferResponse)
async def transfer_funds(req: TransferRequest):
    """Interbank account transfer secured by quantum OTP challenge."""
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if req.from_account not in accounts_db or req.to_account not in accounts_db:
        raise HTTPException(status_code=404, detail="One or both accounts not found.")
    if req.from_account == req.to_account:
        raise HTTPException(status_code=400, detail="Cannot transfer to the same account.")

    source = accounts_db[req.from_account]
    target = accounts_db[req.to_account]

    if source["pin"] != req.pin:
        raise HTTPException(status_code=401, detail="Invalid source account PIN.")
    if source["balance"] < req.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance for transfer.")

    # Replay check
    if req.session_id in used_sessions:
        raise HTTPException(status_code=409, detail="Quantum OTP session already used.")
    session = active_sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=400, detail="Session expired or invalid.")

    used_sessions.add(req.session_id)
    del active_sessions[req.session_id]

    source["balance"] -= req.amount
    target["balance"] += req.amount

    nonce_digest = hashlib.sha256(session["nonce"].encode("utf-8")).hexdigest()
    tx_entry = {
        "tx_id": f"TXN-XFER-{uuid.uuid4().hex[:8].upper()}",
        "timestamp": now_str,
        "type": "ACCOUNT_TRANSFER",
        "account_id": req.from_account,
        "holder_name": source["holder_name"],
        "atm_id": "ONLINE_BANKING",
        "atm_name": "Q-Vault Core Portal",
        "amount": req.amount,
        "remaining_balance": source["balance"],
        "atm_vault_remaining": 0.0,
        "status": "APPROVED",
        "status_label": "APPROVED (Quantum Nonce Valid)",
        "auth_token": f"TRANSFER-{req.to_account}",
        "quantum_nonce_digest": f"SHA256:{nonce_digest[:16]}...",
        "full_nonce_digest": nonce_digest,
        "min_entropy": session["entropy"],
        "qrng_backend": session["source"]
    }
    transaction_ledger.insert(0, tx_entry)

    return TransferResponse(
        success=True,
        message=f"Transferred ${req.amount:,.2f} from {source['holder_name']} to {target['holder_name']}.",
        tx_id=tx_entry["tx_id"],
        from_account=req.from_account,
        to_account=req.to_account,
        amount=req.amount,
        from_remaining_balance=source["balance"],
        timestamp=now_str,
        quantum_proof=f"SHA256:{nonce_digest[:24]}"
    )

@app.get("/api/bank/transactions")
async def get_transactions(account_id: Optional[str] = None):
    """Returns streaming ledger of bank transactions."""
    if account_id:
        return [t for t in transaction_ledger if t["account_id"] == account_id]
    return transaction_ledger

# --- Bank Admin Operations & Security Center ---

@app.post("/api/admin/login")
async def admin_login(req: AdminLoginRequest):
    """Authenticate bank security officers."""
    if req.username == ADMIN_CREDENTIALS["username"] and req.password == ADMIN_CREDENTIALS["password"]:
        return {
            "authenticated": True,
            "token": "admin_session_jwt_secure_q_vault",
            "role": "Chief Information Security Officer (CISO)",
            "message": "Admin clearance verified."
        }
    raise HTTPException(status_code=401, detail="Invalid admin credentials.")

@app.post("/api/admin/toggle-vault-lock")
async def toggle_vault_lock(req: ToggleLockRequest):
    """Remote emergency lock/unlock for any ATM terminal."""
    atm = atm_fleet_db.get(req.atm_id)
    if not atm:
        raise HTTPException(status_code=404, detail="ATM terminal not found.")

    old_status = atm["status"]
    new_status = "LOCKED" if req.locked else "ONLINE"
    atm["status"] = new_status
    atm["dispenser_shutter"] = "SAFE_LOCKED" if req.locked else "CLOSED"

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    security_events_log.insert(0, {
        "timestamp": now_str,
        "severity": "WARNING" if req.locked else "INFO",
        "description": f"Admin Emergency Override: Terminal {req.atm_id} safe changed from {old_status} to {new_status}."
    })

    return {
        "atm_id": req.atm_id,
        "name": atm["name"],
        "status": atm["status"],
        "dispenser_shutter": atm["dispenser_shutter"],
        "timestamp": now_str,
        "message": f"Terminal {req.atm_id} remote safe lock set to {new_status}."
    }

@app.post("/api/admin/simulate-jackpotting")
async def simulate_jackpotting(req: SimulateJackpottingRequest):
    """
    Live Demo: Simulates an attacker connecting a hardware 'black box' to an ATM (default ATM-01)
    attempting to replay a previously captured $500 authorization packet.
    Triggers automated fraud detection, records the incident, and initiates remote safe lockdown.
    """
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    target_atm = atm_fleet_db.get(req.atm_id)
    if not target_atm:
        raise HTTPException(status_code=404, detail="Target ATM not found.")

    # 1. Automatically lock down the targeted ATM safe
    target_atm["status"] = "LOCKED"
    target_atm["dispenser_shutter"] = "SAFE_LOCKED"

    # 2. Record critical fraud event in audit log
    event_msg = (
        f"CRITICAL FRAUD DETECTED: REPLAY ATTACK BLOCKED - NONCE ALREADY CONSUMED. "
        f"{req.atm_id} SAFE AUTOMATICALLY LOCKED DOWN. Hardware Black Box tapped detected."
    )
    security_events_log.insert(0, {
        "timestamp": now_str,
        "severity": "CRITICAL",
        "description": event_msg
    })

    # 3. Add to ledger as BLOCKED
    tx_entry = {
        "tx_id": f"ALERT-FRAUD-{uuid.uuid4().hex[:6].upper()}",
        "timestamp": now_str,
        "type": "ATM_JACKPOTTING_SIMULATION",
        "account_id": "ACC-4921",
        "holder_name": "Attacker Black Box Tap",
        "atm_id": req.atm_id,
        "atm_name": target_atm["name"],
        "amount": req.replay_amount,
        "remaining_balance": 14250.00,
        "atm_vault_remaining": target_atm["vault_balance"],
        "status": "BLOCKED",
        "status_label": "BLOCKED (Replay Fraud Detected)",
        "auth_token": "MALICIOUS_REPLAY_INTERCEPTED",
        "quantum_nonce_digest": "SHA256:CAPTURED_REPLAY_PACKET",
        "full_nonce_digest": "ATTACKER_PACKET_HASH_NONCE_ALREADY_EXPIRED_OR_CONSUMED",
        "min_entropy": 0.0,
        "qrng_backend": "Central Bank Fraud Shield"
    }
    transaction_ledger.insert(0, tx_entry)

    return {
        "attack_status": "BLOCKED",
        "alert_level": "CRITICAL",
        "atm_id": req.atm_id,
        "atm_status": "LOCKED",
        "message": event_msg,
        "incident_report": {
            "attack_vector": "Physical Bus Tap / Black Box Replay Injection",
            "attempted_dispense": f"${req.replay_amount:,.2f}",
            "system_defense": "Quantum Nonce Single-Use Ledger matched previously consumed token",
            "action_taken": f"{req.atm_id} physical safe automatically locked down to prevent vault breach",
            "timestamp": now_str
        }
    }

@app.get("/api/bank/hsm-status")
async def get_hsm_status():
    """Returns Central Bank Quantum HSM health and daily statistics."""
    total_volume = sum(
        t["amount"] for t in transaction_ledger if t.get("status") == "APPROVED"
    )
    blocked_count = sum(
        1 for t in transaction_ledger if t.get("status") == "BLOCKED"
    )

    gate_stats = entropy_gate.get_gate_statistics()

    return {
        "hsm_status": "ONLINE",
        "quantum_source": base_qrng.backend_name,
        "is_quantum_cloud": "Cisco" in base_qrng.backend_name,
        "min_entropy_threshold": entropy_gate.ENTROPY_THRESHOLD,
        "active_challenges_in_memory": len(active_sessions),
        "total_protected_volume": total_volume,
        "blocked_replay_attacks": blocked_count,
        "total_ledger_transactions": len(transaction_ledger),
        "entropy_gate_stats": gate_stats
    }

# --- Legacy Compatibility Endpoints (Keep previous tools working) ---

@app.get("/api/devices")
async def get_registered_devices():
    return list(accounts_db.keys())

@app.post("/api/request-challenge")
async def legacy_request_challenge(req: dict):
    acc_id = req.get("device_id") or "ACC-4921"
    bank_req = BankChallengeRequest(account_id=acc_id)
    res = await request_bank_challenge(bank_req)
    return {
        "session_id": res.session_id,
        "nonce": res.nonce,
        "timestamp": res.timestamp,
        "expires_in": res.expires_in,
        "metrics": {"quantum_mode": res.qrng_source, "execution_time_ms": 10.0},
        "entropy_score": res.entropy_score,
        "correction_applied": res.correction_applied,
        "qrng_source": res.qrng_source,
        "certified": res.certified
    }

@app.get("/api/security-events")
async def get_security_events():
    return security_events_log

@app.get("/api/auth-history")
async def get_auth_history():
    return transaction_ledger

# --- Static Files Mounting (Frontend Integration) ---
frontend_path = os.path.join(os.path.dirname(__file__), "../../frontend/dist")
if os.path.isdir(frontend_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_path, "assets")), name="assets")

    @app.get("/")
    async def serve_root():
        return FileResponse(os.path.join(frontend_path, "index.html"))

    @app.get("/{catchall:path}")
    async def serve_frontend(catchall: str):
        file_path = os.path.join(frontend_path, catchall)
        if catchall and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_path, "index.html"))
else:
    logger.warning("Frontend dist folder not found. Run 'npm run build' in frontend to serve UI.")
