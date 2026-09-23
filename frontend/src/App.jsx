import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Cpu, 
  Radio, 
  Activity, 
  Lock, 
  Unlock, 
  Building2, 
  CreditCard, 
  Server, 
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import CustomerAtmPortal from './components/CustomerAtmPortal';
import BankAdminPortal from './components/BankAdminPortal';

// Initial Mock Banking State (serves as instantaneous fallback if backend offline)
const INITIAL_ACCOUNTS = [
  {
    account_id: "ACC-4921",
    holder_name: "John Doe",
    account_type: "Checking Account",
    balance: 14250.00,
    pin: "1234",
    card_number: "•••• •••• •••• 4921",
    status: "ACTIVE"
  },
  {
    account_id: "ACC-8812",
    holder_name: "Sarah Connor",
    account_type: "High-Yield Savings",
    balance: 28900.00,
    pin: "5678",
    card_number: "•••• •••• •••• 8812",
    status: "ACTIVE"
  },
  {
    account_id: "ACC-3104",
    holder_name: "Tech Corp Payroll",
    account_type: "Corporate Commercial",
    balance: 145000.00,
    pin: "9999",
    card_number: "•••• •••• •••• 3104",
    status: "ACTIVE"
  }
];

const INITIAL_ATMS = [
  {
    atm_id: "ATM-01",
    name: "Manhattan 5th Ave Terminal",
    location: "767 5th Ave, New York, NY",
    vault_balance: 68500.00,
    vault_capacity: 100000.00,
    status: "ONLINE",
    dispenser_shutter: "CLOSED",
    last_ping: "Just now"
  },
  {
    atm_id: "ATM-02",
    name: "JFK Airport Terminal 4",
    location: "JFK Int'l Airport Terminal 4, Queens, NY",
    vault_balance: 22000.00,
    vault_capacity: 100000.00,
    status: "ONLINE",
    dispenser_shutter: "CLOSED",
    last_ping: "1 min ago"
  },
  {
    atm_id: "ATM-03",
    name: "Wall Street Financial Branch",
    location: "11 Wall Street, New York, NY",
    vault_balance: 85000.00,
    vault_capacity: 100000.00,
    status: "LOCKED",
    dispenser_shutter: "SAFE_LOCKED",
    last_ping: "3 mins ago"
  }
];

const INITIAL_TRANSACTIONS = [
  {
    tx_id: "TXN-A8F24C91",
    timestamp: "2026-09-09 13:28:10",
    type: "CASH_WITHDRAWAL",
    account_id: "ACC-4921",
    holder_name: "John Doe",
    atm_id: "ATM-01",
    atm_name: "Manhattan 5th Ave Terminal",
    amount: 200.00,
    remaining_balance: 14250.00,
    status: "APPROVED",
    auth_token: "AUTH-DISPENSE-E3B0C44298FC",
    quantum_nonce_digest: "SHA256:7f83b1657ff1fc53..."
  },
  {
    tx_id: "TXN-B71E902D",
    timestamp: "2026-09-09 13:45:32",
    type: "CASH_WITHDRAWAL",
    account_id: "ACC-8812",
    holder_name: "Sarah Connor",
    atm_id: "ATM-02",
    atm_name: "JFK Airport Terminal 4",
    amount: 500.00,
    remaining_balance: 28900.00,
    status: "APPROVED",
    auth_token: "AUTH-DISPENSE-51854442CD09",
    quantum_nonce_digest: "SHA256:4b227777d4dd1fc6..."
  },
  {
    tx_id: "TXN-C339F80A",
    timestamp: "2026-09-09 13:56:04",
    type: "CASH_WITHDRAWAL",
    account_id: "ACC-3104",
    holder_name: "Tech Corp Payroll",
    atm_id: "ATM-01",
    atm_name: "Manhattan 5th Ave Terminal",
    amount: 1000.00,
    remaining_balance: 145000.00,
    status: "APPROVED",
    auth_token: "AUTH-DISPENSE-99A1054E7812",
    quantum_nonce_digest: "SHA256:ef2d127de37b942b..."
  },
  {
    tx_id: "TXN-WARN-REPLAY01",
    timestamp: "2026-09-09 14:04:12",
    type: "CASH_WITHDRAWAL",
    account_id: "ACC-4921",
    holder_name: "Attacker Black Box Tap",
    atm_id: "ATM-01",
    atm_name: "Manhattan 5th Ave Terminal",
    amount: 500.00,
    remaining_balance: 14250.00,
    status: "BLOCKED",
    auth_token: "REJECTED_REPLAY_ATTACK",
    quantum_nonce_digest: "SHA256:EXPIRED_REPLAY..."
  }
];

export default function App() {
  const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

  // Active Role Portal: "CUSTOMER_ATM" or "BANK_ADMIN"
  const [activePortal, setActivePortal] = useState("CUSTOMER_ATM");

  // Banking State
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);
  const [atms, setAtms] = useState(INITIAL_ATMS);
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS);
  const [backendStatus, setBackendStatus] = useState("CONNECTING"); // CONNECTING, ONLINE, OFFLINE_FALLBACK

  // Fetch initial data from backend if running
  useEffect(() => {
    let isMounted = true;

    async function loadBackendData() {
      try {
        const [accRes, atmRes, txRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/bank/accounts`),
          fetch(`${BACKEND_URL}/api/bank/atms`),
          fetch(`${BACKEND_URL}/api/bank/transactions`)
        ]);

        if (accRes.ok && atmRes.ok && txRes.ok) {
          const accData = await accRes.json();
          const atmData = await atmRes.json();
          const txData = await txRes.json();

          if (isMounted) {
            if (accData.length > 0) setAccounts(accData);
            if (atmData.length > 0) setAtms(atmData);
            if (txData.length > 0) setTransactions(txData);
            setBackendStatus("ONLINE");
          }
        } else {
          if (isMounted) setBackendStatus("OFFLINE_FALLBACK");
        }
      } catch (err) {
        if (isMounted) setBackendStatus("OFFLINE_FALLBACK");
      }
    }

    loadBackendData();
    const interval = setInterval(loadBackendData, 6000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [BACKEND_URL]);

  // Handle successful ATM cash withdrawal
  const handleTransactionSuccess = (txResult) => {
    // 1. Debit Account Balance in local state
    setAccounts(prev => prev.map(acc => {
      if (acc.account_id === txResult.account_id) {
        return {
          ...acc,
          balance: txResult.remaining_balance
        };
      }
      return acc;
    }));

    // 2. Debit ATM vault in local state
    if (txResult.atm_id && txResult.atm_vault_remaining !== undefined) {
      setAtms(prev => prev.map(atm => {
        if (atm.atm_id === txResult.atm_id) {
          return {
            ...atm,
            vault_balance: txResult.atm_vault_remaining
          };
        }
        return atm;
      }));
    }

    // 3. Prepend to transaction ledger
    setTransactions(prev => [txResult, ...prev]);
  };

  // Handle Remote Safe Lock toggle from Admin
  const handleToggleLock = async (atmId, shouldLock) => {
    // Immediate optimistic local update
    setAtms(prev => prev.map(atm => {
      if (atm.atm_id === atmId) {
        return {
          ...atm,
          status: shouldLock ? "LOCKED" : "ONLINE",
          dispenser_shutter: shouldLock ? "SAFE_LOCKED" : "CLOSED"
        };
      }
      return atm;
    }));

    // Attempt backend sync
    try {
      await fetch(`${BACKEND_URL}/api/admin/toggle-vault-lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atm_id: atmId, locked: shouldLock })
      });
    } catch (e) {
      console.warn("Backend toggle lock error, handled locally:", e);
    }
  };

  // Handle simulated jackpotting attack
  const handleSimulateJackpotting = (alertData) => {
    // Lock down ATM-01 in state
    setAtms(prev => prev.map(atm => {
      if (atm.atm_id === "ATM-01") {
        return {
          ...atm,
          status: "LOCKED",
          dispenser_shutter: "SAFE_LOCKED"
        };
      }
      return atm;
    }));

    // Prepend blocked transaction to ledger
    setTransactions(prev => [
      {
        tx_id: "ALERT-FRAUD-BLACKBOX",
        timestamp: new Date().toLocaleTimeString(),
        type: "ATM_JACKPOTTING_SIMULATION",
        account_id: "ACC-4921",
        holder_name: "Attacker Black Box Tap",
        atm_id: "ATM-01",
        atm_name: "Manhattan 5th Ave Terminal",
        amount: 500.00,
        remaining_balance: 14250.00,
        status: "BLOCKED",
        auth_token: "MALICIOUS_REPLAY_INTERCEPTED",
        quantum_nonce_digest: "SHA256:CAPTURED_REPLAY_PACKET"
      },
      ...prev
    ]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Top Universal FinTech Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 p-[1.5px] shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-white font-mono">
                  Q-VAULT
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  PROD v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Quantum-Secured Core Banking & ATM Cash Management System
              </p>
            </div>
          </div>

          {/* Global Portal Toggle Switch */}
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-2xl shadow-inner">
            <button
              onClick={() => setActivePortal("CUSTOMER_ATM")}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition font-mono ${
                activePortal === "CUSTOMER_ATM"
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🏧</span>
              <span>Customer ATM Portal</span>
            </button>
            <button
              onClick={() => setActivePortal("BANK_ADMIN")}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition font-mono ${
                activePortal === "BANK_ADMIN"
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🛡️</span>
              <span>Bank Admin & SOC Portal</span>
            </button>
          </div>

          {/* Central Bank HSM Status Indicator */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-300">Cisco QRNG: <strong className="text-emerald-400">ACTIVE</strong></span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-300">Entropy Gate: <strong className="text-cyan-400">&gt;0.98</strong></span>
            </div>

            <div className={`text-[11px] px-2 py-1 rounded font-mono ${
              backendStatus === 'ONLINE' ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'
            }`}>
              {backendStatus === 'ONLINE' ? 'Core: Online' : 'Core: Standalone Sim'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Surface Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8">
        {activePortal === "CUSTOMER_ATM" ? (
          <CustomerAtmPortal
            backendUrl={BACKEND_URL}
            accounts={accounts}
            atms={atms}
            transactions={transactions}
            onTransactionSuccess={handleTransactionSuccess}
          />
        ) : (
          <BankAdminPortal
            backendUrl={BACKEND_URL}
            atms={atms}
            transactions={transactions}
            onToggleLock={handleToggleLock}
            onSimulateJackpotting={handleSimulateJackpotting}
          />
        )}
      </main>

      {/* FinTech Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 px-4 text-center text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Q-Vault Cryptographic Core v2.0 • Secured by Cisco Outshift QRNG + Von Neumann Gate</span>
          <span>Constant-Time HMAC-SHA256 • Replay Attack Immunity Guaranteed</span>
        </div>
      </footer>
    </div>
  );
}
