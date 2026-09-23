# Configuration file for Q-Vault: Quantum-Secured Core Banking & ATM Cash Management System

# Mock Banking Customer Accounts Database
# Each customer account has an associated cryptographic secret key stored in the Bank HSM
CUSTOMER_ACCOUNTS = {
    "ACC-4921": {
        "account_id": "ACC-4921",
        "holder_name": "John Doe",
        "account_type": "Checking Account",
        "balance": 14250.00,
        "pin": "1234",
        "secret_key": "sec_key_john_4921",
        "card_number": "•••• •••• •••• 4921",
        "status": "ACTIVE"
    },
    "ACC-8812": {
        "account_id": "ACC-8812",
        "holder_name": "Sarah Connor",
        "account_type": "High-Yield Savings",
        "balance": 28900.00,
        "pin": "5678",
        "secret_key": "sec_key_sarah_8812",
        "card_number": "•••• •••• •••• 8812",
        "status": "ACTIVE"
    },
    "ACC-3104": {
        "account_id": "ACC-3104",
        "holder_name": "Tech Corp Payroll",
        "account_type": "Corporate Commercial",
        "balance": 145000.00,
        "pin": "9999",
        "secret_key": "sec_key_corp_3104",
        "card_number": "•••• •••• •••• 3104",
        "status": "ACTIVE"
    }
}

# Backward compatibility lookup for secret keys
SHARED_SECRETS = {acc_id: data["secret_key"] for acc_id, data in CUSTOMER_ACCOUNTS.items()}
# Also keep legacy IoT device keys so any legacy code continues to work
SHARED_SECRETS.update({
    "device_iot_01": "secret_key_12345",
    "device_iot_02": "super_secure_quantum_key_999",
    "device_iot_03": "pi_sensor_secret_777",
    "device_iot_04": "edge_node_alpha_xyz",
})

# ATM Fleet Registry
ATM_FLEET = {
    "ATM-01": {
        "atm_id": "ATM-01",
        "name": "Manhattan 5th Ave Terminal",
        "location": "767 5th Ave, New York, NY",
        "vault_balance": 68500.00,
        "vault_capacity": 100000.00,
        "status": "ONLINE",  # ONLINE or LOCKED
        "ip_address": "10.240.12.101",
        "dispenser_shutter": "CLOSED",
        "last_ping": "Just now"
    },
    "ATM-02": {
        "atm_id": "ATM-02",
        "name": "JFK Airport Terminal 4",
        "location": "JFK Int'l Airport Terminal 4, Queens, NY",
        "vault_balance": 22000.00,
        "vault_capacity": 100000.00,
        "status": "ONLINE",
        "ip_address": "10.240.14.88",
        "dispenser_shutter": "CLOSED",
        "last_ping": "1 min ago"
    },
    "ATM-03": {
        "atm_id": "ATM-03",
        "name": "Wall Street Financial Branch",
        "location": "11 Wall Street, New York, NY",
        "vault_balance": 85000.00,
        "vault_capacity": 100000.00,
        "status": "LOCKED",
        "ip_address": "10.240.10.45",
        "dispenser_shutter": "SAFE_LOCKED",
        "last_ping": "3 mins ago"
    }
}

# Bank Admin Credentials
ADMIN_CREDENTIALS = {
    "username": "admin",
    "password": "admin_quantum_secure"
}

# Session settings
SESSION_EXPIRY_SECONDS = 120  # Challenges expire after 2 minutes to prevent replay attacks

# API Settings
CORS_ORIGINS = [
    "http://localhost:5173",  # Default Vite Dev Server
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*",
]
