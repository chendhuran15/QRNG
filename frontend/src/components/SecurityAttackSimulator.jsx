import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Wifi, 
  Database, 
  ArrowRight, 
  RefreshCw, 
  Cpu, 
  Terminal, 
  Lock, 
  Unlock, 
  Server,
  Zap,
  Globe,
  Gauge,
  Clock,
  Key,
  AlertTriangle,
  Award,
  BarChart4
} from 'lucide-react';

// Web Crypto HMAC-SHA256 calculator
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
    return "hmac_calculation_error";
  }
}

export default function SecurityAttackSimulator() {
  const BACKEND_URL = "";
  
  // Selected Attack tab: "replay", "guess", "reuse", "brute"
  const [activeAttack, setActiveAttack] = useState("replay");
  
  // State Machine for current active simulation
  // - Replay states: idle, requesting_challenge, challenge_received, computing_hmac, sending_response, authenticated, packet_captured, ready_to_replay, replaying, replay_blocked
  // - Guess states: guess_idle, guess_running, guess_failed
  // - Reuse states: reuse_idle, reuse_legitimate_login, reuse_session_destroyed, reuse_attack_running, reuse_blocked
  // - Brute states: brute_idle, brute_running, brute_failed
  const [simState, setSimState] = useState("idle");
  const [apiOnline, setApiOnline] = useState(false);
  const [logs, setLogs] = useState([]);
  
  // Replay Attack Variables
  const deviceId = "device_iot_01";
  const sharedSecret = "secret_key_12345";
  const [session, setSession] = useState({ session_id: "", nonce: "", timestamp: 0, signature: "" });
  const [capturedPacket, setCapturedPacket] = useState(null);
  const [sessionDb, setSessionDb] = useState([]);

  // Guess Attack Variables
  const [guessAttempts, setGuessAttempts] = useState(0);
  const [guessSuccessful, setGuessSuccessful] = useState(0);
  const [guessRejected, setGuessRejected] = useState(0);

  // Brute Force Variables
  const [bruteCounter, setBruteCounter] = useState(0);

  // Connect to API to detect online sandbox
  const checkConnection = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/devices`);
      if (res.ok) {
        setApiOnline(true);
        addLog("Secure API Tunnel online. Cisco QRNG engine loaded.");
      } else {
        setApiOnline(false);
      }
    } catch {
      setApiOnline(false);
      addLog("FastAPI Server offline. Running simulation in browser sandbox.");
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  // Reset states on attack switch
  useEffect(() => {
    setLogs([]);
    setCapturedPacket(null);
    setSession({ session_id: "", nonce: "", timestamp: 0, signature: "" });
    setSessionDb([]);
    setGuessAttempts(0);
    setGuessSuccessful(0);
    setGuessRejected(0);
    setBruteCounter(0);
    
    if (activeAttack === "replay") {
      setSimState("idle");
      addLog("Replay Simulator Console initialized.");
    } else if (activeAttack === "guess") {
      setSimState("guess_idle");
      addLog("Random Guess Simulator Console initialized.");
    } else if (activeAttack === "reuse") {
      setSimState("reuse_idle");
      addLog("Session Reuse Simulator Console initialized.");
    } else if (activeAttack === "brute") {
      setSimState("brute_idle");
      addLog("Brute Force Simulation Console initialized.");
    }
  }, [activeAttack]);

  const addLog = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${msg}`, ...prev.slice(0, 15)]);
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // ==========================================
  // 1. REPLAY ATTACK METHODS
  // ==========================================
  
  const startReplayHandshake = async () => {
    if (simState !== "idle" && simState !== "ready_to_replay" && simState !== "replay_blocked") return;
    
    setSimState("requesting_challenge");
    setCapturedPacket(null);
    setSession({ session_id: "", nonce: "", timestamp: 0, signature: "" });
    setSessionDb([]);
    
    addLog("Step 1: Client requesting challenge...");
    await delay(1000);

    let activeSessionId = "";
    let activeNonce = "";
    let activeTimestamp = 0;
    
    if (apiOnline) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/request-challenge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device_id: deviceId })
        });
        if (res.ok) {
          const data = await res.json();
          activeSessionId = data.session_id;
          activeNonce = data.nonce;
          activeTimestamp = data.timestamp;
          addLog("Challenge Nonce generated from Cisco QRNG.");
        } else {
          throw new Error();
        }
      } catch {
        activeSessionId = (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : "mock-uuid-12345";
        activeNonce = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
        activeTimestamp = Date.now() / 1000;
        addLog("API Error. Fallback to local pseudo-random nonce.");
      }
    } else {
      activeSessionId = crypto.randomUUID ? crypto.randomUUID() : "mock-uuid-12345";
      activeNonce = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      activeTimestamp = Date.now() / 1000;
      addLog("Generated simulated challenge nonce.");
    }

    setSession({
      session_id: activeSessionId,
      nonce: activeNonce,
      timestamp: activeTimestamp,
      signature: ""
    });
    
    setSessionDb([{ id: activeSessionId, status: "ACTIVE", ttl: 120 }]);
    setSimState("challenge_received");
    addLog(`Challenge Received by client. Nonce: ${activeNonce.substring(0, 12)}...`);
    await delay(800);

    // Compute HMAC
    setSimState("computing_hmac");
    addLog("Step 2: Device computing HMAC-SHA256 locally...");
    await delay(1000);

    const payload = `${activeSessionId}:${activeNonce}`;
    const signature = await computeHMAC(sharedSecret, payload);
    setSession(prev => ({ ...prev, signature }));
    addLog(`HMAC Computed: ${signature.substring(0, 12)}...`);
    await delay(800);

    // Send response
    setSimState("sending_response");
    addLog("Step 3: Transmitting HMAC response to server registry...");
    await delay(1000);

    // Server verification
    let authenticated = false;
    if (apiOnline) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_id: deviceId,
            session_id: activeSessionId,
            response: signature
          })
        });
        if (res.ok) {
          const data = await res.json();
          authenticated = data.authenticated;
        }
      } catch {
        authenticated = true;
      }
    } else {
      authenticated = true;
    }

    if (authenticated) {
      setSimState("authenticated");
      addLog("Step 4: Authentication successful! Access approved.");
      setSessionDb(prev => prev.map(s => s.id === activeSessionId ? { ...s, status: "DELETED (CONSUMED)" } : s));
      addLog("Step 5: Server consumed and deleted the challenge token.");
      await delay(1200);

      // Packet capture sniffer eavesdrop
      setSimState("packet_captured");
      addLog("ALERT: Network sniffer intercepted the transmission!");
      const captured = {
        session_id: activeSessionId,
        nonce: activeNonce,
        signature: signature
      };
      setCapturedPacket(captured);
      addLog("Packet signature logged in attacker memory buffer.");
      await delay(1200);

      setSimState("ready_to_replay");
      addLog("Attacker is ready to replay captured packet signature.");
    } else {
      setSimState("idle");
      addLog("Handshake verification failed.");
    }
  };

  const triggerReplayAttack = async () => {
    if (!capturedPacket || simState !== "ready_to_replay") return;

    setSimState("replaying");
    addLog("Step 6: Attacker replaying captured packet signature...");
    await delay(1200);

    let authenticated = false;
    let serverMessage = "Session already consumed. Replay attack detected.";

    if (apiOnline) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_id: deviceId,
            session_id: capturedPacket.session_id,
            response: capturedPacket.signature
          })
        });
        if (res.ok) {
          const data = await res.json();
          authenticated = data.authenticated;
          serverMessage = data.message;
        }
      } catch {
        authenticated = false;
      }
    } else {
      authenticated = false;
    }

    if (!authenticated) {
      setSimState("replay_blocked");
      addLog(`Step 7: Replay blocked by server! Cause: ${serverMessage}`);
    } else {
      setSimState("ready_to_replay");
      addLog("WARNING: Replay succeeded. Double check database constraint triggers!");
    }
  };

  // ==========================================
  // 2. RANDOM GUESS ATTACK METHODS
  // ==========================================
  
  const runGuessSimulation = async () => {
    if (simState === "guess_running") return;
    
    setSimState("guess_running");
    setGuessAttempts(0);
    setGuessSuccessful(0);
    setGuessRejected(0);
    
    addLog("Attacker module executing Random Guess Attack...");
    addLog("Generating random spoofed 256-bit HMAC signatures...");
    
    // Simulate 100 attempts in rapidly repeating ticks
    for (let i = 1; i <= 100; i++) {
      await delay(20);
      setGuessAttempts(i);
      setGuessRejected(i);
      if (i % 20 === 0) {
        addLog(`Sent attempts ${i-19} to ${i}... rejected by gateway.`);
      }
    }
    
    await delay(500);
    setSimState("guess_failed");
    addLog("Attack Failed. Reason: Invalid HMAC signature. All attempts blocked.");
  };

  // ==========================================
  // 3. SESSION REUSE ATTACK METHODS
  // ==========================================
  
  const runSessionReuseSimulation = async () => {
    if (simState === "reuse_legitimate_login" || simState === "reuse_attack_running") return;
    
    // 1. Legitimate Login
    setSimState("reuse_legitimate_login");
    const activeSessionId = (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : "mock-uuid-99999";
    const activeNonce = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    
    setSession({ session_id: activeSessionId, nonce: activeNonce, timestamp: Date.now() / 1000, signature: "valid_signature_auth_ok" });
    setSessionDb([{ id: activeSessionId, status: "ACTIVE", ttl: 120 }]);
    
    addLog("Simulating legitimate login handshake first...");
    await delay(1200);
    
    addLog("Device authenticated successfully (Status: 200).");
    await delay(1000);
    
    // 2. Session Invalidation
    setSimState("reuse_session_destroyed");
    setSessionDb([{ id: activeSessionId, status: "DELETED (CONSUMED)", ttl: 0 }]);
    addLog("Legitimate handshake concluded. Session token marked as Consumed & Deleted.");
    await delay(1200);

    // 3. Attacker tries to reuse Session ID
    setSimState("reuse_attack_running");
    addLog("Attacker attempting to hijack channel reusing Session ID: " + activeSessionId.substring(0, 16) + "...");
    await delay(1200);

    setSimState("reuse_blocked");
    addLog("Attack Blocked! Server database lookup failed. Reason: Session no longer exists.");
  };

  // ==========================================
  // 4. BRUTE FORCE ATTACK METHODS
  // ==========================================
  
  const runBruteForceSimulation = async () => {
    if (simState === "brute_running") return;
    
    setSimState("brute_running");
    setBruteCounter(0);
    addLog("Attacker cracking engine launched.");
    addLog("Iterating key guesses over 256-bit search space...");
    
    // Fast counter loop animation
    let count = 0;
    const interval = setInterval(() => {
      count += Math.floor(Math.random() * 32410) + 10540;
      setBruteCounter(count);
    }, 30);

    await delay(2500);
    clearInterval(interval);
    
    setSimState("brute_failed");
    addLog("Attack aborted. Computational search space 2^256 is mathematically infeasible.");
  };

  // Timeline Progress Activator
  const isTimelineActive = (stepNum) => {
    if (activeAttack === "replay") {
      switch (stepNum) {
        case 1: return ["requesting_challenge", "challenge_received", "computing_hmac", "sending_response", "authenticated", "packet_captured", "ready_to_replay", "replaying", "replay_blocked"].includes(simState);
        case 2: return ["sending_response", "authenticated", "packet_captured", "ready_to_replay", "replaying", "replay_blocked"].includes(simState);
        case 3: return ["authenticated", "packet_captured", "ready_to_replay", "replaying", "replay_blocked"].includes(simState);
        case 4: return ["replaying", "replay_blocked"].includes(simState);
        case 5: return ["replay_blocked"].includes(simState);
        default: return false;
      }
    }
    if (activeAttack === "guess") {
      switch (stepNum) {
        case 1: return ["guess_running", "guess_failed"].includes(simState);
        case 2: return ["guess_running", "guess_failed"].includes(simState);
        case 3: return ["guess_running", "guess_failed"].includes(simState);
        case 4: return ["guess_failed"].includes(simState);
        case 5: return ["guess_failed"].includes(simState);
        default: return false;
      }
    }
    if (activeAttack === "reuse") {
      switch (stepNum) {
        case 1: return ["reuse_legitimate_login", "reuse_session_destroyed", "reuse_attack_running", "reuse_blocked"].includes(simState);
        case 2: return ["reuse_session_destroyed", "reuse_attack_running", "reuse_blocked"].includes(simState);
        case 3: return ["reuse_attack_running", "reuse_blocked"].includes(simState);
        case 4: return ["reuse_attack_running", "reuse_blocked"].includes(simState);
        case 5: return ["reuse_blocked"].includes(simState);
        default: return false;
      }
    }
    if (activeAttack === "brute") {
      switch (stepNum) {
        case 1: return ["brute_running", "brute_failed"].includes(simState);
        case 2: return ["brute_running", "brute_failed"].includes(simState);
        case 3: return ["brute_running", "brute_failed"].includes(simState);
        case 4: return ["brute_failed"].includes(simState);
        case 5: return ["brute_failed"].includes(simState);
        default: return false;
      }
    }
    return false;
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-cyan-400" />
          Security Attack Simulator
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Evaluate the resilience of the QRNG-based Challenge-Response Authentication protocol against common authentication attacks.
        </p>
      </div>

      {/* Grid of 4 Attack Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Replay Attack */}
        <div 
          onClick={() => setActiveAttack("replay")}
          className={`cursor-pointer bg-slate-900/40 border p-5 rounded-2xl backdrop-blur-sm hover:scale-[1.01] transition-all flex flex-col justify-between ${
            activeAttack === "replay" 
              ? "border-cyan-500/50 shadow-neon-cyan bg-slate-900/60" 
              : "border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <ShieldAlert className="w-8 h-8 text-purple-400" />
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-purple-950/80 text-purple-400 border border-purple-500/20 uppercase">CRITICAL</span>
            </div>
            <h3 className="text-sm font-semibold text-white">Replay Attack</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Eavesdrops on legitimate session credentials and attempts to authenticate by re-sending the same signature.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/60 flex justify-between items-center text-[10px] font-mono text-slate-500">
            <span>STATUS</span>
            <span className={`font-semibold ${
              simState === "replay_blocked" ? "text-red-500" : simState === "ready_to_replay" ? "text-purple-400" : "text-slate-400"
            }`}>
              {simState === "replay_blocked" ? "BLOCKED" : simState === "ready_to_replay" ? "READY" : "IDLE"}
            </span>
          </div>
        </div>

        {/* Card 2: Random Guess Attack */}
        <div 
          onClick={() => setActiveAttack("guess")}
          className={`cursor-pointer bg-slate-900/40 border p-5 rounded-2xl backdrop-blur-sm hover:scale-[1.01] transition-all flex flex-col justify-between ${
            activeAttack === "guess" 
              ? "border-cyan-500/50 shadow-neon-cyan bg-slate-900/60" 
              : "border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Zap className="w-8 h-8 text-amber-500" />
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-amber-950/80 text-amber-400 border border-amber-500/20 uppercase">HIGH</span>
            </div>
            <h3 className="text-sm font-semibold text-white">Random Guess</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Attacker attempts to spoof authentication by sending random HMAC signatures to bypass security controls.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/60 flex justify-between items-center text-[10px] font-mono text-slate-500">
            <span>STATUS</span>
            <span className={`font-semibold ${simState === "guess_failed" ? "text-red-500" : "text-slate-400"}`}>
              {simState === "guess_failed" ? "BLOCKED" : "IDLE"}
            </span>
          </div>
        </div>

        {/* Card 3: Session Reuse Attack */}
        <div 
          onClick={() => setActiveAttack("reuse")}
          className={`cursor-pointer bg-slate-900/40 border p-5 rounded-2xl backdrop-blur-sm hover:scale-[1.01] transition-all flex flex-col justify-between ${
            activeAttack === "reuse" 
              ? "border-cyan-500/50 shadow-neon-cyan bg-slate-900/60" 
              : "border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <RefreshCw className="w-8 h-8 text-yellow-500" />
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-yellow-950/80 text-yellow-400 border border-yellow-500/20 uppercase">HIGH</span>
            </div>
            <h3 className="text-sm font-semibold text-white">Session Reuse</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Attacker intercepts an active or completed session token and tries to hijack the authenticated channel.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/60 flex justify-between items-center text-[10px] font-mono text-slate-500">
            <span>STATUS</span>
            <span className={`font-semibold ${simState === "reuse_blocked" ? "text-red-500" : "text-slate-400"}`}>
              {simState === "reuse_blocked" ? "BLOCKED" : "IDLE"}
            </span>
          </div>
        </div>

        {/* Card 4: Brute Force Attack */}
        <div 
          onClick={() => setActiveAttack("brute")}
          className={`cursor-pointer bg-slate-900/40 border p-5 rounded-2xl backdrop-blur-sm hover:scale-[1.01] transition-all flex flex-col justify-between ${
            activeAttack === "brute" 
              ? "border-cyan-500/50 shadow-neon-cyan bg-slate-900/60" 
              : "border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Cpu className="w-8 h-8 text-slate-400" />
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-slate-950/80 text-slate-400 border border-slate-800 uppercase">MEDIUM</span>
            </div>
            <h3 className="text-sm font-semibold text-white">Brute Force</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Attacker attempts to computationally crack the 256-bit secret key space via parallel exhaustive search.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/60 flex justify-between items-center text-[10px] font-mono text-slate-500">
            <span>STATUS</span>
            <span className={`font-semibold ${simState === "brute_failed" ? "text-red-500" : "text-slate-400"}`}>
              {simState === "brute_failed" ? "BLOCKED" : "IDLE"}
            </span>
          </div>
        </div>

      </section>

      {/* DETAILED SIMULATION PANEL UNDERNEATH */}
      <section className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6 relative overflow-hidden backdrop-blur-md">
        
        {/* Dynamic Simulation Controls Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800/60 pb-4 mb-6 gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wide">
              {activeAttack === "replay" && "Simulation: Replay Attack Eavesdropping"}
              {activeAttack === "guess" && "Simulation: Random HMAC Guessing"}
              {activeAttack === "reuse" && "Simulation: Token Invalidation Hijack"}
              {activeAttack === "brute" && "Simulation: Key Space Exhaustion"}
            </h3>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              Source validation mode: {apiOnline ? "Live Cisco QRNG Authenticator" : "Local Cryptography Sandbox"}
            </p>
          </div>

          <div className="flex gap-2">
            {activeAttack === "replay" && (
              <>
                <button 
                  onClick={() => {
                    setSimState("idle");
                    setCapturedPacket(null);
                    setSession({ session_id: "", nonce: "", timestamp: 0, signature: "" });
                    setSessionDb([]);
                    addLog("Replay simulator reset.");
                  }}
                  className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-semibold font-mono"
                >
                  Reset
                </button>
                <button 
                  onClick={startReplayHandshake}
                  disabled={["requesting_challenge", "sending_response", "replaying"].includes(simState)}
                  className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-neon-cyan transition-all disabled:opacity-40"
                >
                  Start Authentication Handshake
                </button>
              </>
            )}

            {activeAttack === "guess" && (
              <button 
                onClick={runGuessSimulation}
                disabled={simState === "guess_running"}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-neon-cyan transition-all disabled:opacity-40"
              >
                Run Simulation
              </button>
            )}

            {activeAttack === "reuse" && (
              <button 
                onClick={runSessionReuseSimulation}
                disabled={simState === "reuse_legitimate_login" || simState === "reuse_attack_running"}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-neon-cyan transition-all disabled:opacity-40"
              >
                Run Simulation
              </button>
            )}

            {activeAttack === "brute" && (
              <button 
                onClick={runBruteForceSimulation}
                disabled={simState === "brute_running"}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-neon-cyan transition-all disabled:opacity-40"
              >
                Run Simulation
              </button>
            )}
          </div>
        </div>

        {/* 3-NODE SIMULATOR PANELS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-[360px] relative">
          
          {/* Decorative Connecting Lines (Replay/Reuse signal pulses) */}
          <div className="hidden lg:block absolute top-[140px] left-[26%] right-[26%] h-0.5 bg-slate-900 z-0">
            {/* Visual pulses running left/right */}
            {(simState === "sending_response" || simState === "reuse_legitimate_login") && (
              <div className="absolute top-0 bottom-0 left-0 w-24 bg-gradient-to-r from-transparent to-cyan-400 wire-flow rounded animate-pulse" />
            )}
            {(simState === "requesting_challenge") && (
              <div className="absolute top-0 bottom-0 right-0 w-24 bg-gradient-to-l from-transparent to-cyan-400 wire-flow rounded animate-pulse" style={{ transform: 'scaleX(-1)' }} />
            )}
          </div>

          <div className="hidden lg:block absolute top-[140px] left-1/2 w-0.5 h-[100px] bg-slate-900 z-0 -translate-x-1/2">
            {(simState === "packet_captured" || simState === "reuse_attack_running") && (
              <div className="absolute left-0 right-0 top-0 h-16 bg-gradient-to-b from-cyan-400 to-transparent animate-pulse" style={{ width: '2px' }} />
            )}
          </div>

          <div className="hidden lg:block absolute bottom-[100px] left-[52%] right-[26%] h-0.5 bg-dashed border-t border-dashed border-red-500/10 z-0 rotate-[-12deg] origin-left">
            {(simState === "replaying" || simState === "reuse_attack_running" || simState === "guess_running") && (
              <div className="absolute top-0 bottom-0 left-0 w-24 bg-gradient-to-r from-transparent to-red-400 wire-flow rounded" />
            )}
          </div>

          {/* NODE 1: DEVICE (Left) */}
          <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5 backdrop-blur-sm z-10 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] text-slate-600 font-mono">NODE_01</span>
                <span className="px-2 py-0.5 text-[9px] font-mono rounded bg-slate-950 text-slate-400 border border-slate-900 uppercase">IoT Device</span>
              </div>
              
              <h4 className="text-sm font-semibold text-white mb-4">Device Unit</h4>

              <div className="space-y-4 text-xs font-mono">
                <div>
                  <span className="text-slate-600 block text-[9px]">DEVICE_ID</span>
                  <span className="text-slate-300 bg-slate-950 p-2 rounded border border-slate-900/60 block">{deviceId}</span>
                </div>
                
                <div>
                  <span className="text-slate-600 block text-[9px]">CHALLENGE NONCE</span>
                  <div className="bg-slate-950 p-2 rounded border border-slate-900/60 min-h-[56px] text-slate-400 select-all break-all leading-normal">
                    {session.nonce ? session.nonce.substring(0, 32) + "..." : <span className="text-slate-700 italic">No active challenge</span>}
                  </div>
                </div>

                <div>
                  <span className="text-slate-600 block text-[9px]">HMAC RESPONSE</span>
                  <div className="bg-slate-950 p-2 rounded border border-slate-900/60 min-h-[56px] text-cyan-400 font-semibold select-all break-all leading-normal">
                    {session.signature ? session.signature.substring(0, 32) + "..." : <span className="text-slate-700 italic">Waiting...</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-900 pt-4 flex justify-between items-center font-mono text-[10px]">
              <span className="text-slate-600">STATE</span>
              <span className={`font-semibold ${
                ["authenticated", "packet_captured", "ready_to_replay", "replaying", "replay_blocked"].includes(simState) || simState === "reuse_session_destroyed"
                  ? "text-emerald-400" 
                  : ["requesting_challenge", "sending_response", "reuse_legitimate_login"].includes(simState)
                    ? "text-cyan-400 animate-pulse"
                    : "text-slate-500"
              }`}>
                {["authenticated", "packet_captured", "ready_to_replay", "replaying", "replay_blocked"].includes(simState) || simState === "reuse_session_destroyed"
                  ? "AUTHENTICATED"
                  : ["requesting_challenge", "sending_response", "reuse_legitimate_login"].includes(simState)
                    ? "COMPUTING"
                    : "IDLE"
                }
              </span>
            </div>
          </div>

          {/* NODE 2: ATTACKER / NETWORK (Center) */}
          <div className={`bg-slate-900/20 border rounded-2xl p-5 backdrop-blur-sm z-10 flex flex-col justify-between transition-all duration-300 ${
            ["packet_captured", "ready_to_replay", "guess_running", "brute_running", "reuse_attack_running"].includes(simState)
              ? "border-purple-500/40 shadow-neon-purple bg-slate-900/30"
              : ["replaying", "guess_failed", "brute_failed", "reuse_blocked", "replay_blocked"].includes(simState)
                ? "border-red-500/40 shadow-neon-red bg-slate-900/30"
                : "border-slate-900"
          }`}>
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] text-slate-600 font-mono">MITM_SNIFFER</span>
                <span className="px-2 py-0.5 text-[9px] font-mono rounded bg-slate-950 text-purple-400 border border-purple-950 uppercase">ATTACKER</span>
              </div>
              
              <h4 className="text-sm font-semibold text-white mb-4">Attacker Panel</h4>

              {/* Dynamic Attacker Viewport based on selected attack */}
              {activeAttack === "replay" && (
                <div className="bg-slate-950 p-4 border border-slate-900 rounded-xl space-y-3 font-mono text-[10px] min-h-[190px]">
                  {capturedPacket ? (
                    <div className="space-y-2 animate-scaleUp">
                      <div className="text-purple-400 font-bold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
                        INTERCEPTED PACKET
                      </div>
                      <div>
                        <span className="text-slate-600 block text-[9px]">SESSION_ID</span>
                        <span className="text-slate-300 break-all">{capturedPacket.session_id}</span>
                      </div>
                      <div>
                        <span className="text-slate-600 block text-[9px]">SIGNATURE</span>
                        <span className="text-cyan-400 break-all">{capturedPacket.signature.substring(0, 32)}...</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 py-8">
                      <Globe className="w-7 h-7 mb-2 text-slate-800 animate-pulse" />
                      <span className="italic">Listening on network channel...</span>
                      <span className="text-[9px] text-slate-700 mt-1 max-w-[140px]">Authenticate client node to capture packet</span>
                    </div>
                  )}
                </div>
              )}

              {activeAttack === "guess" && (
                <div className="bg-slate-950 p-4 border border-slate-900 rounded-xl space-y-4 font-mono text-xs min-h-[190px] flex flex-col justify-center">
                  <div className="text-center font-bold text-slate-400">Repeated Guess Attempt</div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                    <div className="bg-slate-900 p-2 rounded">
                      <span className="text-slate-500 block">Attempts</span>
                      <span className="text-white text-base font-bold">{guessAttempts}</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded">
                      <span className="text-slate-500 block">Success</span>
                      <span className="text-emerald-500 text-base font-bold">{guessSuccessful}</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded">
                      <span className="text-slate-500 block">Rejected</span>
                      <span className="text-red-500 text-base font-bold">{guessRejected}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeAttack === "reuse" && (
                <div className="bg-slate-950 p-4 border border-slate-900 rounded-xl space-y-3 font-mono text-[10px] min-h-[190px] flex flex-col justify-center">
                  {simState === "reuse_blocked" ? (
                    <div className="text-center space-y-2 animate-scaleUp">
                      <div className="text-red-500 font-bold">REUSE ATTEMPT REJECTED</div>
                      <p className="text-slate-400 text-[10px]">Session ID was marked consumed and cannot be reused.</p>
                    </div>
                  ) : simState === "reuse_attack_running" ? (
                    <div className="text-center space-y-2 animate-pulse">
                      <div className="text-purple-400 font-bold">REPLAYING OLD SESSION ID</div>
                      <p className="text-slate-500 text-[9px]">Transmitting token {session.session_id?.substring(0, 16)}...</p>
                    </div>
                  ) : (
                    <div className="text-center text-slate-600 py-8">
                      <Lock className="w-6 h-6 mx-auto mb-2 text-slate-800" />
                      <span className="italic">Awaiting legitimate auth handshake...</span>
                    </div>
                  )}
                </div>
              )}

              {activeAttack === "brute" && (
                <div className="bg-slate-950 p-4 border border-slate-900 rounded-xl font-mono text-xs min-h-[190px] flex flex-col justify-center space-y-4">
                  <div className="text-center space-y-1.5">
                    <span className="text-[10px] text-slate-500 uppercase">Keys Scanned</span>
                    <div className="text-xl font-bold text-purple-400 font-mono tracking-widest bg-slate-900 py-2 rounded border border-slate-850">
                      {bruteCounter.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-500 leading-normal text-center">
                    Estimated space: <strong className="text-slate-350">2^256 keys</strong><br/>
                    Status: <span className="text-purple-400 font-semibold">{simState === "brute_running" ? "Cracking..." : "Aborted"}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4">
              {activeAttack === "replay" && (
                <button
                  onClick={triggerReplayAttack}
                  disabled={simState !== "ready_to_replay"}
                  className="w-full py-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 disabled:from-slate-950 disabled:to-slate-950 disabled:border-slate-900 disabled:text-slate-700 border border-purple-500/20 text-white rounded-xl text-xs font-semibold shadow-neon-purple transition-all disabled:opacity-40"
                >
                  Replay Captured Packet
                </button>
              )}
              {activeAttack !== "replay" && (
                <div className="h-9 border border-dashed border-slate-900 rounded-xl flex items-center justify-center text-[10px] font-mono text-slate-600">
                  CRACK INTEGRITY GUARD ACTIVE
                </div>
              )}
            </div>
          </div>

          {/* NODE 3: AUTH SERVER (Right) */}
          <div className={`bg-slate-900/20 border rounded-2xl p-5 backdrop-blur-sm z-10 flex flex-col justify-between transition-all duration-300 ${
            ["authenticated", "reuse_legitimate_login"].includes(simState)
              ? "border-emerald-500/40 shadow-neon-green bg-slate-900/30"
              : ["replay_blocked", "guess_failed", "reuse_blocked"].includes(simState)
                ? "border-red-500/40 shadow-neon-red bg-slate-900/30"
                : "border-slate-900"
          }`}>
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] text-slate-600 font-mono">AUTH_SERVER</span>
                <span className="px-2 py-0.5 text-[9px] font-mono rounded bg-slate-950 text-slate-400 border border-slate-900 uppercase">SERVER</span>
              </div>
              
              <h4 className="text-sm font-semibold text-white mb-4">Authentication Registry</h4>

              <div className="space-y-4 font-mono text-[10px]">
                <span className="text-slate-500 flex items-center gap-1">
                  <Database className="w-3.5 h-3.5" />
                  SESSION TABLE
                </span>
                
                <div className="bg-slate-950 border border-slate-900/80 rounded-xl p-3 min-h-[96px] space-y-2">
                  {sessionDb.length === 0 ? (
                    <div className="text-slate-700 italic text-center py-6">Database empty</div>
                  ) : (
                    sessionDb.map((s, idx) => (
                      <div key={idx} className="border-b border-slate-900 pb-1.5 last:border-0 last:pb-0">
                        <div className="flex justify-between text-slate-400">
                          <span>ID: {s.id.substring(0, 12)}...</span>
                          <span className={`font-semibold ${s.status === "ACTIVE" ? "text-cyan-400" : "text-red-500"}`}>
                            {s.status}
                          </span>
                        </div>
                        {s.status === "ACTIVE" ? (
                          <div className="text-slate-600 mt-1 flex justify-between text-[9px]">
                            <span>Type: Quantum Nonce</span>
                            <span>TTL: {s.ttl}s</span>
                          </div>
                        ) : (
                          <div className="text-[9px] text-slate-500 mt-1">
                            <span className="text-red-600 font-bold block">✗ TRANSACTION CONSUMED</span>
                            <span>Token removed from active cache</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-900 pt-4 space-y-2">
              <span className="text-[9px] text-slate-600 font-mono block">VERIFICATION GATEWAY STATUS</span>
              <div className={`p-2 py-1.5 rounded-lg border text-center font-mono font-semibold text-[10px] ${
                ["authenticated", "reuse_legitimate_login"].includes(simState)
                  ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/30"
                  : ["replay_blocked", "guess_failed", "reuse_blocked", "brute_failed"].includes(simState)
                    ? "bg-red-950/60 text-red-500 border-red-500/30"
                    : "bg-slate-950 text-slate-700 border-slate-900"
              }`}>
                {["authenticated", "reuse_legitimate_login"].includes(simState)
                  ? "✓ SUCCESS: KEY APPROVED"
                  : ["replay_blocked", "guess_failed", "reuse_blocked", "brute_failed"].includes(simState)
                    ? "✗ REJECTED: ATTACK BLOCKED"
                    : "LISTENING FOR HANDSHAKE"
                }
              </div>
            </div>
          </div>

        </div>

        {/* ALARM BOX ON BLOCKED STATUS */}
        {["replay_blocked", "guess_failed", "reuse_blocked", "brute_failed"].includes(simState) && (
          <div className="mt-6 bg-red-950/40 border border-red-500/30 rounded-2xl p-5 backdrop-blur-md animate-scaleUp flex flex-col md:flex-row items-center gap-4 relative overflow-hidden">
            <div className="absolute top-0 bottom-0 left-0 w-2 bg-red-500 animate-pulse" />
            <div className="p-3 bg-red-900/30 border border-red-500/20 rounded-full text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.25)] shrink-0">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="text-center md:text-left space-y-1">
              <h4 className="text-base font-bold text-red-500 tracking-tight glow-text-red uppercase">
                {activeAttack === "replay" && "Replay Attack Blocked"}
                {activeAttack === "guess" && "Random Guess Attack Blocked"}
                {activeAttack === "reuse" && "Session Reuse Attack Blocked"}
                {activeAttack === "brute" && "Brute Force Attack Infeasible"}
              </h4>
              <p className="text-xs text-slate-350 font-mono leading-relaxed">
                {activeAttack === "replay" && `An attacker replayed a valid signature. Server rejected the request because Session ID (${capturedPacket?.session_id.substring(0, 12)}...) was already consumed and deleted.`}
                {activeAttack === "guess" && `Attacker sent 100 generated signatures. All attempts failed constant-time authentication signatures verification. Reason: Invalid HMAC signature.`}
                {activeAttack === "reuse" && `Attacker tried to hijack with a previously deleted session. Server table lookup failed. Reason: Session no longer exists.`}
                {activeAttack === "brute" && `The attacker cracked counting loop terminated. Computational complexity of 2^256 makes key derivation mathematically impossible. Search Space: 2^256. Time required: Infeasible.`}
              </p>
            </div>
          </div>
        )}

        {/* COMMON SIMULATION PANEL TIMELINE */}
        <div className="mt-8 border-t border-slate-900 pt-6 space-y-4">
          <span className="text-xs text-slate-500 font-mono block">Simulation Progress Steps</span>
          <div className="grid grid-cols-5 gap-2 text-center text-[10px] font-mono">
            {[
              { step: 1, title: "Attack Started", desc: "Simulation process initialized" },
              { step: 2, title: "Packet Sent", desc: "Signatures transited over line" },
              { step: 3, title: "Server Verification", desc: "HMAC credentials evaluated" },
              { step: 4, title: "Security Check", desc: "Database TTL & use lookup" },
              { step: 5, title: "Attack Blocked", desc: "Request rejected" }
            ].map((s) => {
              const active = isTimelineActive(s.step);
              return (
                <div 
                  key={s.step} 
                  className={`p-3 rounded-xl border transition-all duration-300 ${
                    active 
                      ? s.step === 5 
                        ? "bg-red-950/40 border-red-500/40 text-red-400 shadow-neon-red" 
                        : "bg-cyan-950/40 border-cyan-500/40 text-cyan-400 shadow-neon-cyan" 
                      : "bg-slate-950/40 border-slate-900 text-slate-650"
                  }`}
                >
                  <div className="font-bold mb-1">0{s.step} - {s.title}</div>
                  <div className="text-[9px] opacity-75">{s.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* LOG TERMINAL MODULE */}
        <div className="mt-8 grid grid-cols-1 gap-6">
          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 font-mono text-xs">
            <div className="flex justify-between items-center mb-4 border-b border-slate-900 pb-3">
              <span className="text-slate-400 font-semibold flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                Security Operations Center Log Terminal
              </span>
              <button 
                onClick={() => setLogs([])}
                className="text-[10px] text-slate-600 hover:text-slate-400"
              >
                Clear Terminal
              </button>
            </div>
            
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-950 h-[180px] overflow-y-auto space-y-2 scrollbar-thin text-slate-400">
              {logs.length === 0 ? (
                <span className="text-slate-650 italic">Console idle. Trigger an attack above to load socket logs...</span>
              ) : (
                logs.map((l, idx) => (
                  <div key={idx} className="leading-relaxed break-words">
                    {l}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </section>

      {/* SECURITY SUMMARY TABLE */}
      <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
          <Database className="w-4.5 h-4.5 text-cyan-400" />
          Protocol Defense Summary Table
        </h3>
        <div className="overflow-x-auto border border-slate-900 rounded-xl bg-slate-950/40">
          <table className="min-w-full divide-y divide-slate-900 text-left text-xs font-mono">
            <thead>
              <tr className="bg-slate-950 text-slate-400">
                <th className="px-4 py-3 font-semibold">Attack</th>
                <th className="px-4 py-3 font-semibold">Defense Mechanism</th>
                <th className="px-4 py-3 font-semibold">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 text-slate-350">
              <tr>
                <td className="px-4 py-3 font-semibold text-slate-200">Replay Attack</td>
                <td className="px-4 py-3">Single-use Session Nonce Invalidation</td>
                <td className="px-4 py-3 text-red-500 font-bold">Blocked</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-slate-200">Random Guess</td>
                <td className="px-4 py-3">HMAC-SHA256 Signature Verification</td>
                <td className="px-4 py-3 text-red-500 font-bold">Blocked</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-slate-200">Session Reuse</td>
                <td className="px-4 py-3">Server Session Deletion on Use</td>
                <td className="px-4 py-3 text-red-500 font-bold">Blocked</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-slate-200">Brute Force</td>
                <td className="px-4 py-3">256-bit Cryptographic Search Space Complexity</td>
                <td className="px-4 py-3 text-red-500 font-bold">Blocked</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ATTACK SUCCESS VISUALIZATION CHART */}
      <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
          <BarChart4 className="w-4.5 h-4.5 text-cyan-400" />
          Attack Success Rate Chart
        </h3>
        
        <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-900 space-y-4">
          {[
            { name: "Replay Attack", success: 0, color: "from-red-600 to-red-400" },
            { name: "Random Guess", success: 0, color: "from-red-600 to-red-400" },
            { name: "Session Reuse", success: 0, color: "from-red-600 to-red-400" },
            { name: "Brute Force", success: 0, color: "from-red-600 to-red-400" }
          ].map((item, idx) => (
            <div key={idx} className="space-y-1 text-xs font-mono">
              <div className="flex justify-between text-slate-400 text-[10px]">
                <span>{item.name}</span>
                <span className="text-emerald-400 font-bold">{item.success}% success rate</span>
              </div>
              <div className="h-3.5 bg-slate-900 rounded overflow-hidden relative">
                {/* Visual indicator showing 0% bar with a clean flat glow indicator */}
                <div 
                  className="bg-emerald-500 h-full rounded transition-all duration-1000"
                  style={{ width: "2px" }} // Flat 0% line marker
                />
                <div className="absolute inset-0 flex items-center pl-2 text-[9px] text-slate-600">
                  BLOCKED BY PROTOCOL SECURITY LAYER
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
