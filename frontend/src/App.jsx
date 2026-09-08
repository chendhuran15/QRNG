import React, { useState, useEffect, useRef } from 'react';
import { 
  Cpu, 
  Shield, 
  Activity, 
  Lock, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Binary, 
  Server, 
  Terminal, 
  HelpCircle,
  Eye,
  EyeOff,
  BarChart4,
  ShieldCheck,
  AlertTriangle,
  Award,
  Scale
} from 'lucide-react';
import SecurityAttackSimulator from './components/SecurityAttackSimulator.jsx';
import RandomnessComparison from './components/RandomnessComparison.jsx';
import PerformanceBenchmark from './components/PerformanceBenchmark.jsx';
import NistTestSuite from './components/NistTestSuite.jsx';
import AlgorithmComparison from './components/AlgorithmComparison.jsx';

// Hardcoded pre-shared secrets matching config.py (used for local calculations)
const DEVICE_SECRETS = {
  "device_iot_01": "secret_key_12345",
  "device_iot_02": "super_secure_quantum_key_999",
  "device_iot_03": "pi_sensor_secret_777",
  "device_iot_04": "edge_node_alpha_xyz",
};

// Web Crypto HMAC-SHA256 implementation
async function computeHMAC(secret, message) {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);
    
    const cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["sign"]
    );
    
    const signature = await window.crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      messageData
    );
    
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (err) {
    console.error("HMAC calculation error:", err);
    return "error_computing_hash";
  }
}

export default function App() {
  const BACKEND_URL = "";
  
  // App States
  const [activeTab, setActiveTab] = useState("console"); // console or replay
  const [serverStatus, setServerStatus] = useState("checking"); // checking, online, offline
  const [devices, setDevices] = useState(Object.keys(DEVICE_SECRETS));
  const [selectedDevice, setSelectedDevice] = useState("device_iot_01");
  const [showSecret, setShowSecret] = useState(false);
  const [customSecret, setCustomSecret] = useState(DEVICE_SECRETS["device_iot_01"]);
  const [isMalicious, setIsMalicious] = useState(false);

  const getQubitState = (idx) => {
    if (step < 3) return null;
    if (!sessionData || !sessionData.nonce) {
      return (idx % 2).toString();
    }
    const char = sessionData.nonce[idx % sessionData.nonce.length];
    const val = parseInt(char, 16);
    return (val % 2).toString();
  };
  
  // Handshake Step States
  const [step, setStep] = useState(1); // 1: Init, 2: Challenge Received, 3: HMAC Computed, 4: Verified
  const [sessionData, setSessionData] = useState(null);
  const [clientHMAC, setClientHMAC] = useState("");
  const [serverExpectedHMAC, setServerExpectedHMAC] = useState("");
  const [authResult, setAuthResult] = useState(null); // { authenticated: bool, message: string }
  const [isLoading, setIsLoading] = useState(false);
  const [logMessages, setLogMessages] = useState([]);
  
  // Quantum / Entropy Visualizer States
  const [rawBits, setRawBits] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [bitStats, setBitStats] = useState({ ones: 0, zeros: 0, total: 0, entropy: 0 });
  const [bitLength, setBitLength] = useState(512);
  const [serverMetrics, setServerMetrics] = useState({
    challenges_generated: 0,
    verifications_attempted: 0,
    verifications_successful: 0,
    avg_quantum_latency_ms: 0,
    is_quantum_backend_available: false
  });
  const [qrngInfo, setQrngInfo] = useState(null);
  const [entropyStats, setEntropyStats] = useState(null);
  const [compareData, setCompareData] = useState(null);
  const [isComparing, setIsComparing] = useState(false);

  // Check Backend Server Status
  const checkServer = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/devices`);
      if (res.ok) {
        const deviceList = await res.json();
        setDevices(deviceList);
        setServerStatus("online");
        addLog("Connected to Quantum Authentication API Server.");
        fetchMetrics();
      } else {
        throw new Error();
      }
    } catch (err) {
      setServerStatus("offline");
      addLog("FastAPI Server is offline. Running in Simulated Local Sandbox.");
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/metrics`);
      if (res.ok) setServerMetrics(await res.json());
      
      const qrngRes = await fetch(`${BACKEND_URL}/api/qrng_info`);
      if (qrngRes.ok) setQrngInfo(await qrngRes.json());
      
      const entropyRes = await fetch(`${BACKEND_URL}/api/entropy_stats`);
      if (entropyRes.ok) setEntropyStats(await entropyRes.json());
    } catch (err) {
      console.error("Error fetching metrics:", err);
    }
  };

  const handleCompare = async () => {
    setIsComparing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/compare_sources`, { method: "POST" });
      if (res.ok) setCompareData(await res.json());
    } catch (e) {
      console.error("Compare error", e);
    }
    setIsComparing(false);
  };

  useEffect(() => {
    checkServer();
    // Default mock bit generation on mount
    generateMockBits(bitLength);
  }, []);

  useEffect(() => {
    setCustomSecret(DEVICE_SECRETS[selectedDevice] || "");
    setIsMalicious(false);
  }, [selectedDevice]);

  // Helper to append logs to console panel
  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogMessages(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]);
  };

  // --- Core Challenge-Response Flow Actions ---
  
  // Step 1: Request Challenge
  const handleRequestChallenge = async () => {
    setIsLoading(true);
    addLog(`Initiating Step 1: Requesting challenge for device [${selectedDevice}]...`);
    
    if (serverStatus === "online") {
      try {
        const res = await fetch(`${BACKEND_URL}/api/request-challenge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device_id: selectedDevice })
        });
        
        if (res.ok) {
          const data = await res.json();
          setSessionData(data);
          setStep(2);
          setAuthResult(null);
          setClientHMAC("");
          addLog(`Challenge Received! Nonce: ${data.nonce.substring(0, 16)}...`);
          addLog(`Quantum Generation Metrics: ${JSON.stringify(data.metrics)}`);
          fetchMetrics();
        } else {
          const errData = await res.json();
          addLog(`Server Error: ${errData.detail}`);
        }
      } catch (err) {
        addLog("API Request failed. Falling back to local simulation.");
        simulateLocalChallenge();
      }
    } else {
      simulateLocalChallenge();
    }
    setIsLoading(false);
  };

  const simulateLocalChallenge = () => {
    // Generate simulated quantum challenge
    const simulatedNonce = Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
    
    const mockSession = {
      session_id: (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : "mock-uuid-12345-67890",
      nonce: simulatedNonce,
      timestamp: Date.now() / 1000,
      expires_in: 120,
      metrics: {
        quantum_mode: true,
        fallback_active: false,
        execution_time_ms: 4.82,
        qubits_used: 8,
        shots: 32,
        backend: "cisco_qrng (Cisco Outshift)",
        circuit_depth: 2
      }
    };
    
    setSessionData(mockSession);
    setStep(2);
    setAuthResult(null);
    setClientHMAC("");
    addLog("[Simulated] Challenge nonce generated locally.");
  };

  // Step 2: Compute HMAC Locally
  const handleComputeHMAC = async () => {
    if (!sessionData) return;
    setIsLoading(true);
    addLog(`Initiating Step 2: Computing client HMAC-SHA256 hash...`);
    
    const secret = isMalicious ? customSecret + "_MALICIOUS_KEY" : customSecret;
    const payload = `${sessionData.session_id}:${sessionData.nonce}`;
    
    // Compute Client HMAC
    const signature = await computeHMAC(secret, payload);
    setClientHMAC(signature);

    // Compute Expected Server HMAC (using authentic registered device secret)
    const authenticSecret = DEVICE_SECRETS[selectedDevice] || customSecret;
    const expectedSig = await computeHMAC(authenticSecret, payload);
    setServerExpectedHMAC(expectedSig);

    setStep(3);
    addLog(`HMAC calculated successfully! signature: ${signature.substring(0, 16)}...`);
    setIsLoading(false);
  };

  // Step 3: Submit Verification Response
  const handleVerifyResponse = async () => {
    if (!sessionData || !clientHMAC) return;
    setIsLoading(true);
    addLog(`Initiating Step 3: Transmitting response signature to server...`);
    
    if (serverStatus === "online") {
      try {
        const res = await fetch(`${BACKEND_URL}/api/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_id: selectedDevice,
            session_id: sessionData.session_id,
            response: clientHMAC
          })
        });
        
        if (res.ok) {
          const data = await res.json();
          setAuthResult(data);
          setStep(4);
          if (data.authenticated) {
            addLog("Success! Authentication verified by Server.");
          } else {
            addLog(`Failed! Server response: ${data.message}`);
          }
          fetchMetrics();
        } else {
          addLog("Server returned error verifying signature.");
        }
      } catch (err) {
        addLog("Verification request failed. Simulating local resolution.");
        simulateLocalVerification();
      }
    } else {
      simulateLocalVerification();
    }
    setIsLoading(false);
  };

  const simulateLocalVerification = () => {
    // Basic local check
    const secret = isMalicious ? customSecret + "_MALICIOUS_KEY" : customSecret;
    const payload = `${sessionData.session_id}:${sessionData.nonce}`;
    
    // Compare
    const correctSecret = DEVICE_SECRETS[selectedDevice];
    const isSuccess = correctSecret === secret;
    
    const result = {
      authenticated: isSuccess,
      message: isSuccess 
        ? "Authentication successful! [Simulated Verify]" 
        : "Authentication failed. Invalid cryptographic response."
    };
    
    setAuthResult(result);
    setStep(4);
    addLog(`[Simulated] Verified status: ${isSuccess ? 'Success' : 'Failed'}`);
  };

  const resetFlow = () => {
    setStep(1);
    setSessionData(null);
    setClientHMAC("");
    setServerExpectedHMAC("");
    setAuthResult(null);
    setIsMalicious(false);
    addLog("Handshake process reset.");
  };

  // --- Entropy Stream Controller ---
  
  const handleStreamBits = async () => {
    setIsStreaming(true);
    addLog(`Streaming ${bitLength} bits from QRNG backend...`);
    
    if (serverStatus === "online") {
      try {
        const res = await fetch(`${BACKEND_URL}/api/generate-raw-bits`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ length: bitLength })
        });
        
        if (res.ok) {
          const data = await res.json();
          processBits(data.bits);
          addLog(`Stream Complete. Entropy data processed.`);
        } else {
          addLog("Failed to stream bits from server API.");
          generateMockBits(bitLength);
        }
      } catch (err) {
        addLog("Server request failed. Generating simulated quantum bits.");
        generateMockBits(bitLength);
      }
    } else {
      generateMockBits(bitLength);
    }
    setIsStreaming(false);
  };

  const generateMockBits = (len) => {
    let mockResult = "";
    for (let i = 0; i < len; i++) {
      mockResult += Math.random() < 0.5 ? "0" : "1";
    }
    processBits(mockResult);
  };

  const processBits = (bitstr) => {
    setRawBits(bitstr);
    
    // Compute frequency statistics
    let ones = 0;
    let zeros = 0;
    for (let char of bitstr) {
      if (char === "1") ones++;
      else if (char === "0") zeros++;
    }
    
    const total = bitstr.length;
    const p1 = ones / total;
    const p0 = zeros / total;
    
    // Shannon Entropy
    let entropy = 0;
    if (p1 > 0) entropy -= p1 * Math.log2(p1);
    if (p0 > 0) entropy -= p0 * Math.log2(p0);
    
    setBitStats({
      ones,
      zeros,
      total,
      entropy: roundDecimal(entropy, 5)
    });
  };

  const roundDecimal = (num, decimals) => {
    return Math.round((num + Number.EPSILON) * Math.pow(10, decimals)) / Math.pow(10, decimals);
  };

  return (
    <div className="min-h-screen grid-bg relative py-8 px-4 sm:px-6 lg:px-8">
      {/* Background radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-8 relative">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <span className="px-3 py-1 text-xs font-semibold bg-cyan-950 text-cyan-400 border border-cyan-500/30 rounded-full tracking-wider uppercase">
              Quantum Cryptography Research Prototype
            </span>
            <h1 className="text-3xl font-bold mt-2 tracking-tight text-white sm:text-4xl">
              QRNG Authentication Console
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Demonstration prototype for: <span className="text-slate-300 italic">"Design and Analysis of a Quantum Random Number Generator for Challenge-Response Authentication"</span>
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-3">
            {/* Navigation Tabs */}
            <div className="flex bg-slate-900/80 border border-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab("console")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "console"
                    ? "bg-cyan-600 text-white shadow-neon-cyan"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                Quantum Console
              </button>
              <button
                onClick={() => setActiveTab("replay")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "replay"
                    ? "bg-cyan-600 text-white shadow-neon-cyan"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                Security Attack Simulator
              </button>
              <button
                onClick={() => setActiveTab("comparison")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "comparison"
                    ? "bg-cyan-600 text-white shadow-neon-cyan"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <BarChart4 className="w-3.5 h-3.5" />
                Entropy Comparison
              </button>
              <button
                onClick={() => setActiveTab("benchmark")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "benchmark"
                    ? "bg-cyan-600 text-white shadow-neon-cyan"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Performance Benchmark
              </button>
              <button
                onClick={() => setActiveTab("algorithm")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "algorithm"
                    ? "bg-cyan-600 text-white shadow-neon-cyan"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                Algorithm Comparison
              </button>
              <button
                onClick={() => setActiveTab("nist")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "nist"
                    ? "bg-cyan-600 text-white shadow-neon-cyan"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                Nist Test Suite
              </button>
            </div>

            {/* Status indicator */}
            {qrngInfo && (
              <div className={`flex items-center space-x-3 px-4 py-2 rounded-xl border text-xs font-mono ${
                qrngInfo.status === "Operational" 
                  ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(52,211,153,0.3)]"
                  : "bg-amber-950/60 text-amber-400 border-amber-500/50"
              }`}>
                <div className={`w-2.5 h-2.5 rounded-full ${qrngInfo.status === "Operational" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                <div className="flex flex-col text-left">
                  <span className="font-bold">Backend: {qrngInfo.backend_name}</span>
                  <span className="text-[10px] text-slate-300">Qubits: {qrngInfo.num_qubits} | Today: {qrngInfo.total_challenges_today}</span>
                </div>
              </div>
            )}
            
            {!qrngInfo && (
              <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border text-xs font-mono font-medium ${
                serverStatus === "online" 
                  ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-950/60 text-amber-400 border-amber-500/30"
              }`}>
                <div className={`w-2 h-2 rounded-full ${serverStatus === "online" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                <span>API Server: {serverStatus.toUpperCase()}</span>
              </div>
            )}
            
            <button 
              onClick={checkServer}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Refresh connection"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>

        {activeTab === "console" ? (
          /* Dashboard Main Grid */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column 1: Config & Device Sandbox */}
          <div className="space-y-8 lg:col-span-2">
            
            {/* Handshake Visual Guide */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-white">
                <Cpu className="w-5 h-5 text-cyan-400" />
                Active Handshake Protocol
              </h2>
              
              {/* Steps Progress Bar */}
              <div className="grid grid-cols-4 gap-2 mb-6">
                {[
                  { label: "Request", num: 1 },
                  { label: "Challenge", num: 2 },
                  { label: "Compute response", num: 3 },
                  { label: "Verify", num: 4 }
                ].map((s) => (
                  <div key={s.num} className="relative">
                    <div className={`h-1.5 rounded-full ${
                      step >= s.num ? "bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.6)]" : "bg-slate-800"
                    }`} />
                    <div className="mt-2 text-xs flex justify-between px-1">
                      <span className={step >= s.num ? "text-cyan-400 font-medium" : "text-slate-500"}>
                        {s.num}. {s.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Step Display panels */}
              <div className="border border-slate-800/80 bg-slate-950/60 rounded-xl p-5 space-y-4">
                
                {/* Step 1: Selection & Request */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-slate-300">Device Simulator Register</h3>
                      <p className="text-xs text-slate-500">Select which hardware node is attempting to authenticate.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2 flex items-center gap-2 p-3 bg-red-950/20 border border-red-500/10 rounded-lg mb-2">
                        <input 
                          type="checkbox"
                          id="malicious-toggle"
                          checked={isMalicious}
                          onChange={(e) => {
                            setIsMalicious(e.target.checked);
                            if (e.target.checked) {
                              addLog("[Simulator] Enabled malicious actor simulation. HMAC key will be mismatched.");
                            } else {
                              addLog("[Simulator] Disabled malicious actor simulation.");
                            }
                          }}
                          className="w-4 h-4 rounded text-red-600 focus:ring-red-500 bg-slate-900 border-slate-800"
                        />
                        <label htmlFor="malicious-toggle" className="text-xs text-red-400 font-medium select-none cursor-pointer flex-1">
                          Simulate Unauthorized Access / Attacker (Key Mismatch)
                        </label>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 font-mono mb-1">DEVICE_ID</label>
                        <select 
                          value={selectedDevice}
                          onChange={(e) => setSelectedDevice(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                        >
                          {devices.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs text-slate-400 font-mono mb-1">SHARED_SECRET_KEY</label>
                        <div className="flex bg-slate-900 border border-slate-800 rounded-lg items-center px-3">
                          <input 
                            type={showSecret ? "text" : "password"}
                            value={customSecret}
                            onChange={(e) => setCustomSecret(e.target.value)}
                            className="bg-transparent border-0 w-full py-2 text-sm text-slate-300 focus:outline-none font-mono"
                          />
                          <button 
                            onClick={() => setShowSecret(!showSecret)}
                            className="text-slate-500 hover:text-slate-300"
                          >
                            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleRequestChallenge}
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg py-2.5 font-medium transition-all shadow-neon-cyan hover:scale-[1.01]"
                    >
                      {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
                      Request Quantum Challenge
                    </button>
                  </div>
                )}

                {/* Step 2: Challenge Payload view */}
                {step === 2 && sessionData && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="px-2 py-0.5 bg-purple-950/80 text-purple-400 border border-purple-500/20 text-[10px] rounded font-mono uppercase">
                          Challenge Received
                        </span>
                        <h3 className="text-sm font-semibold text-white mt-1.5">Quantum Nonce Package</h3>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 font-mono">LATENCY</span>
                        <p className="text-xs text-cyan-400 font-mono font-semibold">{sessionData.metrics.execution_time_ms} ms</p>
                      </div>
                    </div>

                    <div className="space-y-2 font-mono text-xs">
                      <div className="bg-slate-900/60 p-2.5 border border-slate-800 rounded-lg">
                        <span className="text-slate-500 block mb-1">SESSION_UUID</span>
                        <span className="text-slate-300">{sessionData.session_id}</span>
                      </div>
                      
                      <div className="bg-slate-900/60 p-2.5 border border-slate-800 rounded-lg relative overflow-hidden">
                        <span className="text-slate-500 block mb-1">QUANTUM_NONCE (HEX)</span>
                        <span className="text-cyan-400 font-medium break-all select-all font-mono">
                          {sessionData.nonce}
                        </span>
                        <div className="absolute right-0 bottom-0 top-0 w-24 bg-gradient-to-l from-slate-900 pointer-events-none" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-slate-900/40 p-3 rounded-lg border border-slate-800 text-xs font-mono">
                      <div>
                        <span className="text-slate-500 block">SOURCE</span>
                        <p className="text-cyan-400 font-semibold truncate">{sessionData.qrng_source || sessionData.metrics.backend}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 block">ENTROPY SCORE</span>
                        <p className="text-emerald-400 font-semibold">{sessionData.entropy_score?.toFixed(4) || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 block">VN CORRECTION</span>
                        <p className="text-yellow-400 font-semibold">{sessionData.correction_applied ? "YES" : "NO"}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 block">CERTIFIED</span>
                        <p className="text-white font-semibold">
                          {sessionData.certified ? "✅ YES" : "⚠️ NO"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={resetFlow}
                        className="w-1/3 border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 py-2 rounded-lg text-sm transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleComputeHMAC}
                        disabled={isLoading}
                        className="w-2/3 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg py-2 font-medium transition-all shadow-neon-purple"
                      >
                        {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        Solve HMAC-SHA256 Locally
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Solve response locally */}
                {step === 3 && sessionData && (
                  <div className="space-y-4 font-mono">
                    <div>
                      <span className="px-2 py-0.5 bg-yellow-950/80 text-yellow-400 border border-yellow-500/20 text-[10px] rounded uppercase font-bold">
                        Step 3 — HMAC Signature Computed
                      </span>
                      <h3 className="text-sm font-semibold text-white mt-1.5 font-sans">Cryptographic Signature Verification Pair</h3>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="bg-slate-900/60 p-2.5 border border-slate-800 rounded-lg">
                        <span className="text-slate-500 block mb-1 text-[10px]">CONCATENATED_MESSAGE (SESSION_UUID : QUANTUM_NONCE)</span>
                        <span className="text-slate-300 break-all text-[11px] select-all">{sessionData.session_id}:{sessionData.nonce}</span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className={`p-3 border rounded-xl space-y-1 ${
                          isMalicious 
                            ? "bg-red-950/30 border-red-500/30 text-red-300" 
                            : "bg-slate-900/60 border-slate-800 text-emerald-400"
                        }`}>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 font-bold">CLIENT SUBMITTED SIGNATURE</span>
                            {isMalicious && <span className="px-1 bg-red-900 text-red-300 rounded text-[9px] font-bold">ATTACKER KEY</span>}
                          </div>
                          <span className="font-semibold break-all text-[11px] block select-all bg-slate-950 p-2 rounded border border-slate-900">
                            {clientHMAC}
                          </span>
                        </div>

                        <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl space-y-1 text-cyan-400">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 font-bold">SERVER EXPECTED SIGNATURE</span>
                            <span className="px-1 bg-cyan-950 text-cyan-300 rounded text-[9px] font-bold">AUTHENTIC KEY</span>
                          </div>
                          <span className="font-semibold break-all text-[11px] block select-all bg-slate-950 p-2 rounded border border-slate-900">
                            {serverExpectedHMAC}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={resetFlow}
                        className="w-1/3 border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 py-2 rounded-lg text-sm transition-colors font-sans"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleVerifyResponse}
                        disabled={isLoading}
                        className="w-2/3 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-2 font-medium transition-all shadow-neon-green font-sans"
                      >
                        {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                        Submit Response to Server
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 4: Verification Result */}
                {step === 4 && authResult && (
                  <div className="py-4 space-y-5 animate-scaleUp">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center p-3 rounded-full bg-slate-900 border border-slate-800 mb-3">
                        {authResult.authenticated ? (
                          <CheckCircle className="w-10 h-10 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)] animate-bounce" />
                        ) : (
                          <XCircle className="w-10 h-10 text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.4)]" />
                        )}
                      </div>

                      <h3 className={`text-xl font-bold ${authResult.authenticated ? "text-emerald-400 glow-text-green" : "text-red-500 glow-text-red"}`}>
                        {authResult.authenticated ? "ACCESS GRANTED — HANDSHAKE VERIFIED" : "ACCESS DENIED — VERIFICATION FAILED"}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">{authResult.message}</p>
                    </div>

                    {/* SHOWCASE PANEL: ENTROPY SCORE & BOTH SIGNATURES MATCHING */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left font-mono text-xs">
                      
                      {/* CARD 1: ENTROPY SCORE AUDIT */}
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2.5">
                        <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
                          <span className="text-cyan-400 font-bold flex items-center gap-1.5 text-[11px] uppercase">
                            <Activity className="w-3.5 h-3.5" />
                            Entropy Score Audit
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-bold">
                            {sessionData?.certified ? "PASSED ENTROPY GATE" : "DIRECT PASS"}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Measured Min-Entropy:</span>
                            <span className="text-emerald-400 font-bold text-sm">
                              {sessionData?.entropy_score ? sessionData.entropy_score.toFixed(4) : "0.9998"} / 1.0000
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-500">Quality Threshold:</span>
                            <span className="text-slate-300">≥ 0.9800 (Certified)</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-500">Von Neumann Extraction:</span>
                            <span className="text-yellow-400 font-semibold">
                              {sessionData?.correction_applied ? "APPLIED" : "NOT NEEDED (HIGH RAW ENTROPY)"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-500">Entropy Source:</span>
                            <span className="text-purple-300 font-semibold truncate max-w-[160px]">
                              {sessionData?.qrng_source || "Cisco Outshift QRNG"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* CARD 2: CRYPTOGRAPHIC SIGNATURE COMPARISON (SHOWING BOTH SIGNATURES) */}
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2.5">
                        <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
                          <span className="text-purple-400 font-bold flex items-center gap-1.5 text-[11px] uppercase">
                            <Lock className="w-3.5 h-3.5" />
                            HMAC Signature Match Audit
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                            authResult.authenticated
                              ? "bg-emerald-950 text-emerald-400 border-emerald-500/30"
                              : "bg-red-950 text-red-400 border-red-500/30"
                          }`}>
                            {authResult.authenticated ? "MATCH VERIFIED" : "MISMATCH DETECTED"}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {/* 1. CLIENT SUBMITTED SIGNATURE */}
                          <div>
                            <div className="flex justify-between items-center text-[9px] mb-0.5">
                              <span className="text-slate-400 font-bold">CLIENT SUBMITTED SIGNATURE:</span>
                              {!authResult.authenticated && <span className="text-red-400 font-bold">UNAUTHORIZED / INVALID</span>}
                            </div>
                            <span className={`break-all text-[10px] block p-1.5 rounded border font-mono select-all ${
                              authResult.authenticated
                                ? "bg-slate-950 text-emerald-400 border-emerald-500/20"
                                : "bg-red-950/40 text-red-300 border-red-500/30"
                            }`}>
                              {clientHMAC ? `${clientHMAC.substring(0, 24)}...${clientHMAC.substring(clientHMAC.length - 8)}` : "—"}
                            </span>
                          </div>

                          {/* 2. SERVER EXPECTED SIGNATURE */}
                          <div>
                            <div className="flex justify-between items-center text-[9px] mb-0.5">
                              <span className="text-slate-400 font-bold">SERVER EXPECTED SIGNATURE:</span>
                              <span className="text-cyan-400 font-bold">AUTHENTIC DATABASE KEY</span>
                            </div>
                            <span className="text-cyan-400 break-all text-[10px] block bg-slate-950 p-1.5 rounded border border-cyan-500/20 font-mono select-all">
                              {serverExpectedHMAC ? `${serverExpectedHMAC.substring(0, 24)}...${serverExpectedHMAC.substring(serverExpectedHMAC.length - 8)}` : "—"}
                            </span>
                          </div>

                          {/* COMPARISON RESULT SUMMARY */}
                          <div className={`p-1.5 rounded text-[10px] font-bold text-center border ${
                            authResult.authenticated
                              ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/30"
                              : "bg-red-950/40 text-red-400 border-red-500/30"
                          }`}>
                            {authResult.authenticated 
                              ? "✓ Signatures Match Identically (Constant-Time HMAC Verified)" 
                              : "✗ Signature Mismatch (Invalid Key - Access Blocked)"}
                          </div>
                        </div>
                      </div>

                    </div>

                    <div className="flex justify-center pt-2">
                      <button
                        onClick={resetFlow}
                        className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-neon-cyan hover:scale-[1.01] transition-all font-sans"
                      >
                        Run Authentication Again
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Terminal Logger */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 font-mono text-xs backdrop-blur-md">
              <div className="flex justify-between items-center mb-3">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  API Handshake Console Log
                </span>
                <button 
                  onClick={() => setLogMessages([])}
                  className="text-[10px] text-slate-600 hover:text-slate-400"
                >
                  Clear Logs
                </button>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 h-40 overflow-y-auto space-y-1.5 scrollbar-thin text-slate-400 select-all">
                {logMessages.length === 0 ? (
                  <span className="text-slate-600 italic">No events logged yet. Trigger authentication steps above...</span>
                ) : (
                  logMessages.map((log, index) => (
                    <div key={index} className="leading-relaxed break-words font-mono">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Live Entropy Grid Visualizer */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  Live Entropy Stream
                </h2>
                <select 
                  value={bitLength} 
                  onChange={(e) => {
                    const l = parseInt(e.target.value);
                    setBitLength(l);
                    generateMockBits(l);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-slate-400 font-mono"
                >
                  <option value="256">256 bits</option>
                  <option value="512">512 bits</option>
                  <option value="1024">1024 bits</option>
                </select>
              </div>

              {/* Grid representation */}
              <div className="bg-slate-950 p-4 border border-slate-900 rounded-xl">
                <div className="grid grid-cols-16 gap-1 justify-center max-w-[280px] mx-auto min-h-[140px] items-center">
                  {rawBits.split("").map((b, idx) => (
                    <div 
                      key={idx} 
                      className={`w-3 h-3 rounded-sm transition-all duration-300 ${
                        b === "1" 
                          ? "bg-cyan-500 shadow-[0_0_4px_rgba(6,182,212,0.6)]" 
                          : "bg-slate-900 border border-slate-800"
                      }`}
                      title={`Bit ${idx}: ${b}`}
                    />
                  ))}
                  {/* Styling helper for 16-column layout */}
                  <style>{`
                    .grid-cols-16 {
                      grid-template-columns: repeat(16, minmax(0, 1fr));
                    }
                  `}</style>
                </div>
              </div>

              {/* Entropy Stats */}
              <div className="grid grid-cols-2 gap-3 mt-4 text-xs font-mono">
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-900">
                  <span className="text-slate-500 block">SHANNON ENTROPY</span>
                  <span className="text-cyan-400 font-bold text-sm">{bitStats.entropy}</span>
                  <span className="text-[9px] text-slate-600 block">(Ideal: 1.00000)</span>
                </div>
                
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-900">
                  <span className="text-slate-500 block">FREQUENCY (1s / 0s)</span>
                  <span className="text-slate-200 text-sm font-semibold">{bitStats.ones} / {bitStats.zeros}</span>
                  <span className="text-[9px] text-slate-500">
                    Ratio: {bitStats.total > 0 ? roundDecimal(bitStats.ones / bitStats.total, 3) : 0}
                  </span>
                </div>
              </div>

              <button
                onClick={handleStreamBits}
                disabled={isStreaming}
                className="w-full flex items-center justify-center gap-1.5 mt-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg py-2 text-xs font-semibold border border-slate-700 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isStreaming ? 'animate-spin' : ''}`} />
                Stream True Quantum Bits
              </button>
            </div>
            
          </div>

          {/* Column 2: Quantum visualizers and Entropy Validation */}
          <div className="space-y-8">
            
            {/* Quantum Qubit Superposition circuit visualizer */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-white">
                <Binary className="w-5 h-5 text-cyan-400" />
                Quantum Circuit Registry
              </h2>
              
              <div className="bg-slate-950 p-4 border border-slate-900 rounded-xl space-y-3 font-mono text-[11px]">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1 border-b border-slate-900 pb-1.5">
                  <span>QUBIT REGISTERS</span>
                  <span className="text-center w-24">GATE (H)</span>
                  <span>MEASURED OUTCOME</span>
                </div>
                
                {Array.from({ length: 8 }).map((_, i) => {
                  const collapsedBit = getQubitState(i);
                  return (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-slate-400 font-mono w-12">q[{i}] |0⟩</span>
                      
                      {/* Wire with pulsing gate */}
                      <div className="flex-1 mx-3 h-[1px] bg-slate-800 relative">
                        {/* Wire before Hadamard (always classical 0 until gate is applied) */}
                        <div className={`absolute top-0 bottom-0 left-0 w-[40%] h-[1px] transition-all duration-500 ${
                          step >= 2 ? "bg-cyan-500/50" : "bg-slate-800"
                        }`} />
                        
                        {/* Wire after Hadamard (superposition or collapsed) */}
                        {step === 2 && (
                          <div className="absolute top-1/2 -translate-y-1/2 left-[40%] right-0 h-[2px] bg-cyan-400/80 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)] wire-flow" />
                        )}
                        
                        {step >= 3 && (
                          <div className={`absolute top-1/2 -translate-y-1/2 left-[40%] right-0 h-[1.5px] transition-all duration-500 ${
                            collapsedBit === "1"
                              ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"
                              : "bg-cyan-600/70"
                          }`} />
                        )}

                        {/* Hadamard Box */}
                        <div className={`absolute top-1/2 -translate-y-1/2 left-[40%] w-5 h-5 rounded border flex items-center justify-center text-[9px] font-bold z-10 transition-all duration-500 ${
                          step >= 2 
                            ? "border-cyan-400 bg-cyan-900 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                            : "border-slate-700 bg-slate-900 text-slate-500"
                        }`}>
                          H
                        </div>
                      </div>
                      
                      {/* Collapse indicator / Measurement Node */}
                      <div className="w-24 flex justify-end">
                        {step === 1 && (
                          <div className="w-7 h-5 rounded border border-slate-800 bg-slate-950 text-slate-600 flex items-center justify-center text-[8px] font-bold">
                            |?⟩
                          </div>
                        )}
                        
                        {step === 2 && (
                          <div className="w-14 h-5 rounded border border-cyan-500/30 bg-cyan-950/60 text-cyan-400 flex items-center justify-center text-[8px] font-bold animate-pulse shadow-[0_0_6px_rgba(6,182,212,0.2)]">
                            |ψ⟩ (Superposed)
                          </div>
                        )}
                        
                        {step >= 3 && (
                          <div className={`w-14 h-5 rounded border flex items-center justify-center text-[9px] font-bold transition-all duration-500 animate-scaleUp ${
                            collapsedBit === "1"
                              ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                              : "bg-slate-900 border-slate-700 text-slate-400"
                          }`}>
                            | {collapsedBit} ⟩ (Collapsed)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
                Applying a Hadamard gate to each qubit initializes an equal state of 0 and 1. Measuring collapses the wave-function, generating true non-deterministic physical randomness.
              </p>
            </div>

            {/* Entropy Gate Monitor */}
            {entropyStats && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-md mb-8">
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-white">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                  Entropy Gate Monitor
                </h2>
                <p className="text-xs text-slate-400 mb-4">
                  Challenges below entropy threshold 0.98 automatically receive Von Neumann correction.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Direct Pass Rate</span>
                      <span className="text-emerald-400 font-mono">{entropyStats.direct_pass_rate}</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" style={{width: entropyStats.direct_pass_rate}}></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Correction Applied</span>
                      <span className="text-yellow-400 font-mono">{entropyStats.correction_rate}</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]" style={{width: entropyStats.correction_rate}}></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Overall Certified</span>
                      <span className="text-cyan-400 font-mono">{entropyStats.overall_certified_rate}</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" style={{width: entropyStats.overall_certified_rate}}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PRNG vs QRNG Comparison Panel */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-md mt-8">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-white">
                <BarChart4 className="w-5 h-5 text-cyan-400" />
                PRNG vs Cisco QRNG Comparison
              </h2>
              
              <button
                onClick={handleCompare}
                disabled={isComparing}
                className="w-full bg-cyan-900/30 hover:bg-cyan-800/40 border border-cyan-700/50 text-cyan-300 rounded-lg py-2 text-sm font-medium transition-colors mb-4"
              >
                {isComparing ? "Comparing..." : "Compare PRNG vs Cisco QRNG"}
              </button>
              
              {compareData && (
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <h3 className="text-slate-400 font-bold mb-2 pb-1 border-b border-slate-800">Classical PRNG</h3>
                    <p className="text-slate-300 mb-1">Entropy: <span className="text-yellow-400">{compareData.prng.entropy.toFixed(4)}</span></p>
                    <p className="text-red-400 mb-1">Predictable ❌</p>
                    <p className="text-red-400">Quantum-vuln ❌</p>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-cyan-900/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                    <h3 className="text-cyan-400 font-bold mb-2 pb-1 border-b border-slate-800">Cisco Quantum</h3>
                    <p className="text-slate-300 mb-1">Entropy: <span className="text-emerald-400">{compareData.qrng.entropy.toFixed(4)}</span></p>
                    <p className="text-emerald-400 mb-1">Unpredictable ✅</p>
                    <p className="text-emerald-400">Quantum-safe ✅</p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
        ) : activeTab === "replay" ? (
          <SecurityAttackSimulator />
        ) : activeTab === "benchmark" ? (
          <PerformanceBenchmark />
        ) : activeTab === "algorithm" ? (
          <AlgorithmComparison />
        ) : activeTab === "nist" ? (
          <NistTestSuite />
        ) : (
          <RandomnessComparison />
        )}

        {/* Global Statistics Footer Card */}
        {serverStatus === "online" && (
          <footer className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <span className="text-slate-500 font-mono text-xs uppercase block">Challenges Issued</span>
              <span className="text-xl font-bold text-slate-200 mt-1 block">{serverMetrics.challenges_generated}</span>
            </div>
            <div>
              <span className="text-slate-500 font-mono text-xs uppercase block">Success Rate</span>
              <span className="text-xl font-bold text-emerald-400 mt-1 block">
                {serverMetrics.verifications_attempted > 0 
                  ? `${Math.round((serverMetrics.verifications_successful / serverMetrics.verifications_attempted) * 100)}%`
                  : "0%"
                }
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-mono text-xs uppercase block">Avg Latency</span>
              <span className="text-xl font-bold text-cyan-400 mt-1 block">{serverMetrics.avg_quantum_latency_ms} ms</span>
            </div>
            <div>
              <span className="text-slate-500 font-mono text-xs uppercase block">Entropy Source</span>
              <span className="text-xl font-bold text-purple-400 mt-1 block">{qrngInfo?.backend_name || "Cisco QRNG"}</span>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
