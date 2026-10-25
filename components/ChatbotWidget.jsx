'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useTransactions } from '@/lib/useTransactions';
import { useGoals } from '@/lib/useGoals';
import { addTransaction, deleteTransaction } from '@/lib/firestoreService';
import { formatINR } from '@/lib/format';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/types';

const QUICK_ACTIONS = [
  '➕ Add ₹1,200 for Groceries',
  '💰 Add ₹65,000 Salary income',
  '📊 How much did I spend this month?',
  '🗑️ Delete last expense',
  '🎯 Check my goal progress',
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
      text: "👋 Hi! I'm your **FinPlan AI Copilot**. I can analyze your portfolio, add transactions, delete records, or give you instant spending summaries.\n\nTry typing: *\"Add ₹2,500 groceries expense\"* or *\"What is my total spend?\"*",
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

    // 1. DELETE / REMOVE TRANSACTION REQUEST
    if (text.startsWith('delete') || text.startsWith('remove')) {
      const isLast = text.includes('last');
      if (isLast) {
        if (!transactions || transactions.length === 0) {
          return {
            text: "You don't have any transactions to delete yet.",
            type: 'info',
          };
        }
        const lastTx = transactions[0];
        await deleteTransaction(user.uid, lastTx.id);
        return {
          text: `🗑️ Deleted the last transaction: **${lastTx.description || lastTx.category}** (${formatINR(lastTx.amount)})`,
          type: 'delete',
        };
      }

      // Try to find matching description or category or amount
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
          text: `🗑️ Successfully deleted: **${found.description || found.category}** (${formatINR(found.amount)}) from your portfolio.`,
          type: 'delete',
        };
      }

      return {
        text: "I couldn't find a matching transaction to delete. Try saying *\"Delete last expense\"* or specify the exact name/amount.",
        type: 'warning',
      };
    }

    // 2. ADD / INSERT TRANSACTION REQUEST
    const hasAddWord = text.includes('add') || text.includes('spent') || text.includes('spend') || text.includes('paid') || text.includes('bought') || text.includes('received') || text.includes('earned');
    const amountMatch = text.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);

    if (hasAddWord && amountMatch) {
      const rawNumber = amountMatch[1].replace(/,/g, '');
      const amount = parseFloat(rawNumber);

      if (isNaN(amount) || amount <= 0) {
        return { text: 'Please specify a valid positive amount.', type: 'warning' };
      }

      // Detect type
      const isIncome = text.includes('income') || text.includes('salary') || text.includes('earned') || text.includes('freelance') || text.includes('received') || text.includes('dividend');
      const txType = isIncome ? 'income' : 'expense';

      // Detect Category
      let matchedCategory = null;
      const categoriesPool = txType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

      for (const cat of categoriesPool) {
        if (text.includes(cat.toLowerCase())) {
          matchedCategory = cat;
          break;
        }
      }

      // Semantic defaults
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

      // Extract description
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
        text: `✅ **Transaction Recorded!**\n- **Type:** ${txType === 'income' ? 'Income 💰' : 'Expense 💳'}\n- **Amount:** ${formatINR(amount)}\n- **Category:** ${matchedCategory}\n- **Note:** ${description}`,
        type: 'success',
      };
    }

    // 3. EXPENSES & SUMMARY QUERY
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
        text: `📊 **Financial Snapshot (${now.toLocaleString('en-IN', { month: 'long' })})**:\n- **Total Income:** ${formatINR(totalIncome)}\n- **Total Expenses:** ${formatINR(totalExpense)}\n- **Net Savings:** ${formatINR(totalIncome - totalExpense)} (${totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0}% savings rate)\n- **Transactions recorded:** ${thisMonthExpenses.length} expense items.`,
        type: 'summary',
      };
    }

    // 4. GOALS STATUS QUERY
    if (text.includes('goal') || text.includes('target') || text.includes('vault')) {
      if (!goals || goals.length === 0) {
        return {
          text: "🎯 You haven't added any financial goals yet. Click **Goals** in the navigation bar to create your first goal vault!",
          type: 'info',
        };
      }
      const goalList = goals.map((g) => {
        const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
        return `• **${g.name}**: ${formatINR(g.currentAmount)} / ${formatINR(g.targetAmount)} (${pct}%)`;
      }).join('\n');

      return {
        text: `🎯 **Your Goal Vaults**:\n${goalList}\n\nKeep contributing regularly to stay on track!`,
        type: 'summary',
      };
    }

    // 5. GENERAL COPILOT ADVICE
    return {
      text: "I'm ready! You can command me with:\n• *\"Add ₹3,000 for Transport\"*\n• *\"Add 50000 Salary income\"*\n• *\"Delete last expense\"*\n• *\"How much did I spend?\"*\n• *\"Show my goals\"*",
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
          text: '❌ Something went wrong while updating your portfolio. Please try again.',
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
        <div className="mb-3 w-[92vw] sm:w-[410px] h-[520px] max-h-[82vh] card card-static flex flex-col overflow-hidden bg-white animate-in slide-in-from-bottom-3 fade-in duration-150">
          {/* Header */}
          <div className="px-4 py-3 bg-[#FEF08A] border-b-[3px] border-[#111827] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#111827] text-white flex items-center justify-center text-sm font-black shadow-[2px_2px_0px_#111827]">
                🤖
              </div>
              <div>
                <div className="flex items-center gap-1.5 leading-none">
                  <h3 className="font-extrabold text-xs sm:text-sm text-[#111827]">FinPlan Copilot</h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <span className="text-[10px] font-bold text-gray-700">AI Portfolio Manager</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setMessages([messages[0]])}
                title="Clear chat"
                className="p-1.5 rounded-lg border-2 border-[#111827] bg-white text-[11px] font-bold hover:bg-gray-100 transition-colors shadow-[1px_1px_0px_#111827]"
              >
                🧹
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="p-1.5 rounded-lg border-2 border-[#111827] bg-white text-xs font-black hover:bg-gray-100 transition-colors shadow-[1px_1px_0px_#111827]"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Quick Action Suggestion Chips */}
          <div className="px-3 py-2 bg-[#FFFDF7] border-b-2 border-gray-100 overflow-x-auto flex gap-1.5 shrink-0 no-scrollbar">
            {QUICK_ACTIONS.map((action, i) => (
              <button
                key={i}
                onClick={() => handleSend(action.replace(/^[^\w\s]+/, '').trim())}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap bg-white border border-[#111827] shadow-[1px_1px_0px_#111827] hover:bg-[#FEF08A] active:translate-x-[1px] active:translate-y-[1px] transition-all"
              >
                {action}
              </button>
            ))}
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-3.5 space-y-3 overflow-y-auto bg-[#FAFAF9]/60 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3 border-2 border-[#111827] font-medium leading-relaxed whitespace-pre-wrap ${
                    m.sender === 'user'
                      ? 'bg-[#FF5722] text-white shadow-[2px_2px_0px_#111827] rounded-tr-none'
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
                <span className="text-[9px] text-gray-600 mt-1 px-1 font-bold">
                  {m.sender === 'user' ? 'You' : 'FinPlan AI'} • {new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 font-bold bg-white p-2.5 rounded-xl border-2 border-[#111827] w-fit shadow-[2px_2px_0px_#111827]">
                <span className="animate-spin text-sm">⚙</span> Processing portfolio request...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-2.5 bg-white border-t-[3px] border-[#111827] flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Add 2000 for groceries, or delete last..."
              className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold bg-[#FAFAF9] border-2 border-[#111827] outline-none focus:shadow-[2px_2px_0px_#111827] transition-all placeholder:text-gray-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="px-3.5 py-2 rounded-xl bg-[#FF5722] text-white border-2 border-[#111827] text-xs font-black shadow-[2px_2px_0px_#111827] hover:bg-[#F4511E] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 transition-all shrink-0"
            >
              Send 🚀
            </button>
          </form>
        </div>
      )}

      {/* ── FLOATING TRIGGER PILL ────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FF5722] text-white border-[3px] border-[#111827] shadow-[4px_4px_0px_#111827] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px] transition-all font-black text-xs sm:text-sm group"
        aria-label="Open AI Copilot"
      >
        <span className="text-base sm:text-lg group-hover:scale-110 transition-transform">🤖</span>
        <span>{isOpen ? 'Close Copilot' : 'Ask FinPlan AI'}</span>
        {!isOpen && (
          <span className="w-2.5 h-2.5 rounded-full bg-[#A3E635] border border-[#111827] animate-pulse" />
        )}
      </button>
    </div>
  );
}
