# Configuration file for QRNG Authentication Server

# A mock database of registered IoT devices and their pre-shared secret keys.
# In a production environment, these would be stored securely in a hardware security
# module (HSM), secure database, or key vault.
SHARED_SECRETS = {
    "device_iot_01": "secret_key_12345",
    "device_iot_02": "super_secure_quantum_key_999",
    "device_iot_03": "pi_sensor_secret_777",
    "device_iot_04": "edge_node_alpha_xyz",
}

# Session settings
SESSION_EXPIRY_SECONDS = 120  # Challenges expire after 2 minutes to prevent replay attacks

# API Settings
CORS_ORIGINS = [
    "http://localhost:5173",  # Default Vite Dev Server
    "http://127.0.0.1:5173",
    "http://localhost:3000",  # React app fallback port
    "http://127.0.0.1:3000",
    "*",                      # Allow all for local prototype testing convenience
]
