'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useTransactions } from '@/lib/useTransactions';
import { useGoals } from '@/lib/useGoals';
import { addTransaction, deleteTransaction } from '@/lib/firestoreService';
import { formatINR } from '@/lib/format';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/types';

// ── Custom Finny Vector Logo ───────────────────────────────────────────────────
function FinnyLogo({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="6" fill="#111827" />
      <path
        d="M6 16L11 11L14 14L18 8"
        stroke="#A7F3D0"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 8H18V12"
        stroke="#A7F3D0"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="16" r="1.2" fill="#FEF08A" />
      <circle cx="11" cy="11" r="1.2" fill="#FEF08A" />
      <circle cx="14" cy="14" r="1.2" fill="#FEF08A" />
      <circle cx="18" cy="8" r="1.8" fill="#FF5722" />
    </svg>
  );
}

// ── Clean SVG Icons ───────────────────────────────────────────────────────────
function SendIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function ClearIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function CloseIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

const QUICK_ACTIONS = [
  'Add ₹1,200 Groceries',
  'Add ₹65,000 Salary',
  'Total spent this month?',
  'Delete last expense',
  'Goal progress',
];

export default function ChatbotWidget() {
  const { user } = useAuth();
  const { transactions } = useTransactions();
  const { goals } = useGoals();

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Hi! I'm **Finny**, your financial copilot. Ask me to record spending, add income, delete entries, or summarize your portfolio.",
      time: new Date(),
    },
  ]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [isOpen, messages]);

  // ── Natural Language Request Analyzer ──────────────────────────────────────────
  const processQuery = async (queryText) => {
    const text = queryText.trim().toLowerCase();

    // 1. DELETE / REMOVE REQUEST
    if (text.startsWith('delete') || text.startsWith('remove')) {
      const isLast = text.includes('last');
      if (isLast) {
        if (!transactions || transactions.length === 0) {
          return { text: 'No transactions found to delete.', type: 'info' };
        }
        const lastTx = transactions[0];
        await deleteTransaction(user.uid, lastTx.id);
        return {
          text: `Deleted last transaction: **${lastTx.description || lastTx.category}** (${formatINR(lastTx.amount)})`,
          type: 'delete',
        };
      }

      const amountMatch = text.match(/\d+(\.\d+)?/);
      const targetAmount = amountMatch ? parseFloat(amountMatch[0]) : null;

      const found = transactions.find((t) => {
        if (targetAmount && Math.abs(t.amount - targetAmount) < 1) return true;
        if (t.description && text.includes(t.description.toLowerCase())) return true;
        if (t.category && text.includes(t.category.toLowerCase())) return true;
        return false;
      });

      if (found) {
        await deleteTransaction(user.uid, found.id);
        return {
          text: `Deleted: **${found.description || found.category}** (${formatINR(found.amount)}) from your portfolio.`,
          type: 'delete',
        };
      }

      return {
        text: 'Transaction not found. Try "Delete last expense" or specify the exact name/amount.',
        type: 'warning',
      };
    }

    // 2. ADD / INSERT REQUEST
    const hasAddWord = text.includes('add') || text.includes('spent') || text.includes('spend') || text.includes('paid') || text.includes('bought') || text.includes('received') || text.includes('earned');
    const amountMatch = text.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);

    if (hasAddWord && amountMatch) {
      const rawNumber = amountMatch[1].replace(/,/g, '');
      const amount = parseFloat(rawNumber);

      if (isNaN(amount) || amount <= 0) {
        return { text: 'Please specify a valid amount.', type: 'warning' };
      }

      const isIncome = text.includes('income') || text.includes('salary') || text.includes('earned') || text.includes('freelance') || text.includes('received') || text.includes('dividend');
      const txType = isIncome ? 'income' : 'expense';

      let matchedCategory = null;
      const categoriesPool = txType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

      for (const cat of categoriesPool) {
        if (text.includes(cat.toLowerCase())) {
          matchedCategory = cat;
          break;
        }
      }

      if (!matchedCategory) {
        if (text.includes('food') || text.includes('dinner') || text.includes('lunch') || text.includes('swiggy') || text.includes('zomato')) matchedCategory = 'Food';
        else if (text.includes('grocery') || text.includes('milk') || text.includes('supermarket') || text.includes('blinkit')) matchedCategory = 'Groceries';
        else if (text.includes('uber') || text.includes('ola') || text.includes('fuel') || text.includes('petrol') || text.includes('metro')) matchedCategory = 'Transport';
        else if (text.includes('movie') || text.includes('netflix') || text.includes('game')) matchedCategory = 'Entertainment';
        else if (text.includes('doctor') || text.includes('medicine') || text.includes('hospital')) matchedCategory = 'Health';
        else if (text.includes('rent')) matchedCategory = 'Rent';
        else if (text.includes('emi') || text.includes('loan')) matchedCategory = 'EMI';
        else matchedCategory = txType === 'expense' ? 'Other' : 'Salary';
      }

      let description = queryText
        .replace(/add/i, '')
        .replace(/spent/i, '')
        .replace(/spend/i, '')
        .replace(/paid/i, '')
        .replace(/for/i, '')
        .replace(/on/i, '')
        .replace(/(?:₹|rs\.?|inr)?\s*\d+(?:,\d+)*(?:\.\d+)?/i, '')
        .trim();

      if (!description) description = matchedCategory;

      await addTransaction(user.uid, {
        type: txType,
        category: matchedCategory,
        amount,
        date: new Date(),
        description,
      });

      return {
        text: `Transaction recorded:\n• Type: ${txType === 'income' ? 'Income' : 'Expense'}\n• Amount: ${formatINR(amount)}\n• Category: ${matchedCategory}\n• Note: ${description}`,
        type: 'success',
      };
    }

    // 3. SPENDING SUMMARY QUERY
    if (text.includes('spend') || text.includes('expense') || text.includes('summary') || text.includes('total') || text.includes('how much')) {
      const now = new Date();
      const thisMonthExpenses = transactions.filter(
        (t) => t.type === 'expense' && t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear()
      );
      const totalExpense = thisMonthExpenses.reduce((sum, t) => sum + t.amount, 0);

      const thisMonthIncome = transactions.filter(
        (t) => t.type === 'income' && t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear()
      );
      const totalIncome = thisMonthIncome.reduce((sum, t) => sum + t.amount, 0);

      return {
        text: `Monthly Overview (${now.toLocaleString('en-IN', { month: 'short' })}):\n• Income: ${formatINR(totalIncome)}\n• Expenses: ${formatINR(totalExpense)}\n• Net Savings: ${formatINR(totalIncome - totalExpense)}`,
        type: 'summary',
      };
    }

    // 4. GOALS QUERY
    if (text.includes('goal') || text.includes('target') || text.includes('vault')) {
      if (!goals || goals.length === 0) {
        return { text: 'No active goals found. You can add one in the Goals tab.', type: 'info' };
      }
      const goalList = goals.map((g) => {
        const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
        return `• ${g.name}: ${formatINR(g.currentAmount)} / ${formatINR(g.targetAmount)} (${pct}%)`;
      }).join('\n');

      return {
        text: `Goal Status:\n${goalList}`,
        type: 'summary',
      };
    }

    // 5. DEFAULT HELPER
    return {
      text: 'Try asking:\n• "Add ₹2,000 for groceries"\n• "Add ₹50,000 salary"\n• "Delete last expense"\n• "Total spent this month?"',
      type: 'info',
    };
  };

  const handleSend = async (queryText = input) => {
    const q = queryText.trim();
    if (!q || !user) return;

    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: q,
      time: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await processQuery(q);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: response.text,
          type: response.type,
          time: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: 'Unable to process request. Please try again.',
          type: 'error',
          time: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {/* ── EXPANDED CHAT WINDOW ─────────────────────────────────────────────── */}
      {isOpen && (
        <div className="mb-3 w-[90vw] sm:w-[380px] h-[500px] max-h-[80vh] card card-static flex flex-col overflow-hidden bg-white shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-150">
          {/* Header */}
          <div className="px-4 py-3 bg-[#FEF08A] border-b-[2.5px] border-[#111827] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <FinnyLogo className="w-7 h-7 shrink-0" />
              <div>
                <h3 className="font-extrabold text-sm text-[#111827] leading-none">Finny</h3>
                <span className="text-[10px] font-bold text-gray-700">Financial Copilot</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setMessages([messages[0]])}
                title="Clear chat"
                className="p-1.5 rounded-lg border-2 border-[#111827] bg-white text-[#111827] hover:bg-gray-100 transition-colors shadow-[1px_1px_0px_#111827]"
              >
                <ClearIcon />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="p-1.5 rounded-lg border-2 border-[#111827] bg-white text-[#111827] hover:bg-gray-100 transition-colors shadow-[1px_1px_0px_#111827]"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Quick Action Suggestion Chips */}
          <div className="px-3 py-2 bg-[#FFFDF7] border-b border-gray-200 overflow-x-auto flex gap-1.5 shrink-0 no-scrollbar">
            {QUICK_ACTIONS.map((action, i) => (
              <button
                key={i}
                onClick={() => handleSend(action)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap bg-white border border-[#111827] shadow-[1px_1px_0px_#111827] hover:bg-[#FEF08A] active:translate-x-[0.5px] active:translate-y-[0.5px] transition-all"
              >
                {action}
              </button>
            ))}
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-3.5 space-y-3 overflow-y-auto bg-[#FAFAF9]/60 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-xl p-3 border-2 border-[#111827] font-medium leading-relaxed whitespace-pre-wrap ${
                    m.sender === 'user'
                      ? 'bg-[#FF5722] text-white shadow-[2px_2px_0px_#111827] rounded-tr-none font-semibold'
                      : m.type === 'success'
                      ? 'bg-[#A7F3D0] text-[#111827] shadow-[2px_2px_0px_#111827] rounded-tl-none font-semibold'
                      : m.type === 'delete'
                      ? 'bg-[#FECDD3] text-[#111827] shadow-[2px_2px_0px_#111827] rounded-tl-none font-semibold'
                      : m.type === 'summary'
                      ? 'bg-[#DDD6FE] text-[#111827] shadow-[2px_2px_0px_#111827] rounded-tl-none'
                      : 'bg-white text-[#111827] shadow-[2px_2px_0px_#111827] rounded-tl-none'
                  }`}
                >
                  {m.text}
                </div>
                <span className="text-[9px] text-gray-500 mt-0.5 px-1 font-bold">
                  {m.sender === 'user' ? 'You' : 'Finny'} • {new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 text-xs text-gray-600 font-bold bg-white p-2.5 rounded-xl border-2 border-[#111827] w-fit shadow-[2px_2px_0px_#111827]">
                <span className="animate-spin text-sm">⚙</span> Updating portfolio...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Field */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-2.5 bg-white border-t-2 border-[#111827] flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Finny or type a transaction..."
              className="flex-1 px-3 py-2 rounded-xl text-xs font-medium bg-[#FAFAF9] border-2 border-[#111827] outline-none focus:shadow-[2px_2px_0px_#111827] transition-all placeholder:text-gray-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="p-2.5 rounded-xl bg-[#FF5722] text-white border-2 border-[#111827] shadow-[2px_2px_0px_#111827] hover:bg-[#F4511E] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-40 transition-all shrink-0 flex items-center justify-center"
              title="Send"
            >
              <SendIcon />
            </button>
          </form>
        </div>
      )}

      {/* ── FLOATING TRIGGER BUTTON ("Ask Finny") ────────────────────────────── */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#FF5722] text-white border-[2.5px] border-[#111827] shadow-[3px_3px_0px_#111827] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] transition-all font-bold text-xs sm:text-sm group"
        aria-label="Ask Finny"
      >
        <FinnyLogo className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
        <span className="tracking-tight">{isOpen ? 'Close' : 'Ask Finny'}</span>
      </button>
    </div>
  );
}
