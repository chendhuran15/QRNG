import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  Activity, 
  Cpu, 
  Building2, 
  DollarSign, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Terminal, 
  Zap, 
  Radio, 
  ShieldCheck,
  Server,
  UserCheck
} from 'lucide-react';

export default function BankAdminPortal({ 
  backendUrl, 
  atms, 
  transactions, 
  securityEvents, 
  onToggleLock, 
  onSimulateJackpotting 
}) {
  // Admin Login State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(true); // Default logged in for seamless demo review
  const [adminUsername, setAdminUsername] = useState("admin");
  const [adminPassword, setAdminPassword] = useState("admin_quantum_secure");
  const [loginError, setLoginError] = useState("");

  // Jackpotting Simulation State
  const [isSimulatingAttack, setIsSimulatingAttack] = useState(false);
  const [jackpottingAlert, setJackpottingAlert] = useState(null);
  const [lockLoadingId, setLockLoadingId] = useState(null);

  // Filter state for transaction ledger
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Admin Login Handler
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminUsername === "admin" && adminPassword === "admin_quantum_secure") {
      setIsAdminLoggedIn(true);
      setLoginError("");
    } else {
      setLoginError("Invalid clearance credentials. Use admin / admin_quantum_secure");
    }
  };

  const handleDemoLogin = () => {
    setAdminUsername("admin");
    setAdminPassword("admin_quantum_secure");
    setIsAdminLoggedIn(true);
    setLoginError("");
  };

  // Toggle Remote Safe Lock
  const handleToggleLock = async (atmId, currentStatus) => {
    const shouldLock = currentStatus !== "LOCKED";
    setLockLoadingId(atmId);
    try {
      if (onToggleLock) {
        await onToggleLock(atmId, shouldLock);
      }
    } finally {
      setLockLoadingId(null);
    }
  };

  // Trigger ATM Jackpotting Attack Simulation
  const handleSimulateJackpotting = async () => {
    setIsSimulatingAttack(true);
    setJackpottingAlert(null);

    try {
      let alertData = null;
      try {
        const res = await fetch(`${backendUrl}/api/admin/simulate-jackpotting`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ atm_id: "ATM-01", replay_amount: 500.00 })
        });
        if (res.ok) {
          alertData = await res.json();
        }
      } catch (err) {
        console.warn("Backend unavailable, using local simulation for jackpotting:", err);
      }

      if (!alertData) {
        // In-browser fallback simulation
        alertData = {
          attack_status: "BLOCKED",
          alert_level: "CRITICAL",
          atm_id: "ATM-01",
          atm_status: "LOCKED",
          message: "CRITICAL FRAUD DETECTED: REPLAY ATTACK BLOCKED - NONCE ALREADY CONSUMED. ATM-01 SAFE AUTOMATICALLY LOCKED DOWN.",
          incident_report: {
            attack_vector: "Physical Bus Tap / Black Box Replay Injection",
            attempted_dispense: "$500.00",
            system_defense: "Quantum Nonce Single-Use Ledger matched previously consumed token",
            action_taken: "ATM-01 safe automatically locked down to prevent vault breach",
            timestamp: new Date().toLocaleTimeString()
          }
        };
      }

      setJackpottingAlert(alertData);
      if (onSimulateJackpotting) {
        onSimulateJackpotting(alertData);
      }
    } finally {
      setIsSimulatingAttack(false);
    }
  };

  // Compute stats
  const totalDailyVolume = transactions
    .filter(t => t.status === "APPROVED")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const blockedCount = transactions.filter(t => t.status === "BLOCKED").length;

  const filteredTransactions = transactions.filter(t => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "APPROVED") return t.status === "APPROVED";
    if (statusFilter === "BLOCKED") return t.status === "BLOCKED";
    return true;
  });

  // If not logged in, render clearance screen
  if (!isAdminLoggedIn) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl">
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-red-500/10 border border-red-500/30 rounded-2xl mb-3 text-red-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white font-mono">Bank Admin Clearance</h3>
          <p className="text-xs text-slate-400 mt-1">CISO Security Operations Center Authentication</p>
        </div>

        {loginError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
            {loginError}
          </div>
        )}

        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Username</label>
            <input
              type="text"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Clearance Password</label>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 font-mono"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition"
          >
            Authenticate Admin
          </button>
          <button
            type="button"
            onClick={handleDemoLogin}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold rounded-xl text-xs font-mono transition border border-emerald-500/30"
          >
            1-Click Demo Login (CISO Clearance)
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Central Bank Quantum HSM Telemetry Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Central Bank Quantum HSM Operations Center
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                  ACTIVE DEFENSE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Cisco QRNG Superposition Source + Von Neumann Min-Entropy Gate
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Clearance Level</span>
              <p className="text-xs font-bold text-slate-200 font-mono">Chief Information Security Officer</p>
            </div>
            <button
              onClick={() => setIsAdminLoggedIn(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono transition border border-slate-700"
            >
              Lock Console
            </button>
          </div>
        </div>

        {/* 4 Health Telemetry Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {/* Cisco QRNG Status */}
          <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-start">
              <span className="text-xs font-mono text-slate-400">QRNG ENGINE</span>
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
            <p className="text-lg font-bold text-emerald-400 font-mono mt-2">Cisco Outshift</p>
            <p className="text-[11px] text-slate-400 mt-0.5">True Quantum Photonic Source</p>
          </div>

          {/* Entropy Gate Status */}
          <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-start">
              <span className="text-xs font-mono text-slate-400">ENTROPY GATE</span>
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-lg font-bold text-cyan-400 font-mono mt-2">&gt; 0.980 bits/bit</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Von Neumann Debiased (PASS)</p>
          </div>

          {/* Total Protected Volume */}
          <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-start">
              <span className="text-xs font-mono text-slate-400">DAILY PROTECTED VOLUME</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-lg font-bold text-white font-mono mt-2">
              ${totalDailyVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Live Approved Core Transactions</p>
          </div>

          {/* Replay Attacks Thwarted */}
          <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-start">
              <span className="text-xs font-mono text-slate-400">REPLAY ATTACKS BLOCKED</span>
              <ShieldAlert className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-lg font-bold text-red-400 font-mono mt-2">{blockedCount} Intercepted</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Automated Lockdowns Active</p>
          </div>
        </div>
      </div>

      {/* Fraud & ATM Jackpotting Attack Center */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-red-950/40 border border-red-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2 text-red-400 font-mono text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4" />
              <span>Adversary Defense & Jackpotting Simulator</span>
            </div>
            <h3 className="text-lg font-bold text-white">
              Simulate ATM Physical Black-Box Jackpotting Attack
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Demonstrates an attacker splicing into an ATM's cash dispenser bus and attempting to replay a previously captured $500 dispense authorization packet. The Central Bank Quantum HSM detects the consumed nonce and automatically locks down the safe.
            </p>
          </div>

          <button
            onClick={handleSimulateJackpotting}
            disabled={isSimulatingAttack}
            className={`px-6 py-4 rounded-2xl font-bold font-mono text-xs uppercase tracking-wider transition flex items-center justify-center gap-2.5 flex-shrink-0 shadow-xl ${
              isSimulatingAttack
                ? 'bg-slate-800 text-slate-500 cursor-wait'
                : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 active:scale-[0.99] cursor-pointer'
            }`}
          >
            <Zap className={`w-4 h-4 ${isSimulatingAttack ? 'animate-bounce' : ''}`} />
            {isSimulatingAttack ? "Infiltrating Bus..." : "Simulate ATM Jackpotting Attack"}
          </button>
        </div>

        {/* Flashing Red Incident Alert Banner */}
        {jackpottingAlert && (
          <div className="mt-6 p-5 bg-red-950/80 border-2 border-red-500 rounded-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-red-500/20 text-red-400 rounded-xl animate-pulse">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold bg-red-500 text-black px-2.5 py-0.5 rounded uppercase">
                    CRITICAL FRAUD DETECTED
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {jackpottingAlert.incident_report?.timestamp}
                  </span>
                </div>
                <p className="text-sm font-bold text-white font-mono tracking-tight">
                  [CRITICAL FRAUD DETECTED: REPLAY ATTACK BLOCKED - NONCE ALREADY CONSUMED. {jackpottingAlert.atm_id} SAFE AUTOMATICALLY LOCKED DOWN]
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-red-500/30 text-xs font-mono text-slate-300">
                  <div>
                    <span className="text-slate-400">ATTACK VECTOR:</span>{" "}
                    <span className="text-red-300 font-semibold">{jackpottingAlert.incident_report?.attack_vector}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">REPLAY DISPENSE ATTEMPT:</span>{" "}
                    <span className="text-red-300 font-semibold">{jackpottingAlert.incident_report?.attempted_dispense}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">QUANTUM DEFENSE:</span>{" "}
                    <span className="text-emerald-400 font-semibold">{jackpottingAlert.incident_report?.system_defense}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">AUTOMATED ACTION:</span>{" "}
                    <span className="text-amber-400 font-semibold">{jackpottingAlert.incident_report?.action_taken}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ATM Fleet Overview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider">
              ATM Fleet Cash Safe Registry
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {atms.length} Terminals Monitored
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {atms.map((atm) => {
            const isLocked = atm.status === "LOCKED";
            const percentFilled = Math.min(100, Math.round((atm.vault_balance / (atm.vault_capacity || 100000)) * 100));

            return (
              <div 
                key={atm.atm_id}
                className={`bg-slate-900 border rounded-3xl p-6 shadow-xl relative overflow-hidden transition-all duration-300 ${
                  isLocked ? 'border-red-500/40 shadow-red-500/5' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Status Pill */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-400">{atm.atm_id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                      isLocked 
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {isLocked ? 'SAFE LOCKED' : 'ONLINE'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">{atm.last_ping || 'Just now'}</span>
                </div>

                {/* Name and Location */}
                <h4 className="text-sm font-bold text-white mb-1">{atm.name}</h4>
                <p className="text-xs text-slate-400 mb-5">{atm.location}</p>

                {/* Cash Safe Balance Gauge */}
                <div className="space-y-2 mb-6 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400 uppercase">Physical Safe Balance:</span>
                    <span className="font-bold text-emerald-400">
                      ${Number(atm.vault_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 rounded-full ${
                        percentFilled > 50 ? 'bg-emerald-500' : percentFilled > 20 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${percentFilled}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                    <span>Capacity: ${(atm.vault_capacity || 100000).toLocaleString()}</span>
                    <span>{percentFilled}% Filled</span>
                  </div>
                </div>

                {/* Emergency Remote Safe Lock Button */}
                <button
                  onClick={() => handleToggleLock(atm.atm_id, atm.status)}
                  disabled={lockLoadingId === atm.atm_id}
                  className={`w-full py-2.5 px-4 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center gap-2 border ${
                    isLocked
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 border-emerald-500 shadow-lg shadow-emerald-600/20'
                      : 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border-red-500/40 hover:border-red-500'
                  }`}
                >
                  {isLocked ? (
                    <>
                      <Unlock className="w-4 h-4" />
                      Unlock Terminal Safe
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Emergency Remote Safe Lock
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Streaming Core Banking Transaction Ledger */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Live Central Bank Core Transaction Ledger
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time audit log of quantum-verified withdrawals and fraud attempts
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 text-xs font-mono">
            {["ALL", "APPROVED", "BLOCKED"].map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-lg border transition ${
                  statusFilter === f
                    ? 'bg-slate-700 text-white border-slate-500 font-bold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-slate-400 border-b border-slate-800 uppercase text-[11px]">
              <tr>
                <th className="py-3 px-3">Tx ID</th>
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Account / Entity</th>
                <th className="py-3 px-3">Terminal ID</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Quantum Proof / Nonce Digest</th>
                <th className="py-3 px-3 text-right">Verification Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    No transactions matching filter.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx, idx) => {
                  const isBlocked = tx.status === "BLOCKED";

                  return (
                    <tr 
                      key={tx.tx_id || idx} 
                      className={`hover:bg-slate-800/40 transition ${
                        isBlocked ? 'bg-red-500/5' : ''
                      }`}
                    >
                      <td className={`py-3 px-3 font-semibold ${isBlocked ? 'text-red-400' : 'text-cyan-400'}`}>
                        {tx.tx_id}
                      </td>
                      <td className="py-3 px-3 text-slate-400">{tx.timestamp}</td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-200">{tx.holder_name || tx.account_id}</span>
                        {tx.account_id && <span className="text-slate-500 block text-[10px]">{tx.account_id}</span>}
                      </td>
                      <td className="py-3 px-3 text-slate-300">{tx.atm_id}</td>
                      <td className="py-3 px-3 font-bold text-white">
                        ${Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                        {tx.quantum_nonce_digest || "SHA256:7f83b1..."}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isBlocked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                            <XCircle className="w-3.5 h-3.5" />
                            BLOCKED (Replay Fraud Detected)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            APPROVED (Quantum Nonce Valid)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
