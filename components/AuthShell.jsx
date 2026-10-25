'use client';

import AuthPreviewChart from './AuthPreviewChart';

export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl w-full card card-static overflow-hidden grid grid-cols-1 lg:grid-cols-12 bg-white">
        {/* LEFT: Hero Showcase & Live Preview Chart */}
        <div className="lg:col-span-7 p-6 sm:p-8 md:p-10 flex flex-col justify-between bg-[#FFFDF7] border-b-4 lg:border-b-0 lg:border-r-[3px] border-[#111827]">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FEF08A] border-2 border-[#111827] shadow-[2px_2px_0px_#111827]">
              <span>✦</span> FINPLAN INTELLIGENCE
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mt-4 text-[#111827] leading-tight">
              Your money, planned not just tracked.
            </h1>

            <p className="text-xs sm:text-sm text-gray-700 font-medium mt-3 leading-relaxed">
              FinPlan reads your salary, loans and spending, does the maths exactly, then turns it into a plan you can act on — net worth, cash flow and a downloadable report.
            </p>

            {/* Simple Visual Chart Showcase */}
            <div className="card p-4 my-5 bg-white space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b-2 border-gray-100">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Projected Cash Flow
                  </span>
                  <div className="text-base sm:text-lg font-black text-[#111827] flex items-center gap-2">
                    +₹47,000
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                      Surplus
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-bold">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#A7F3D0] border border-[#111827]" />
                    Income
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#FF5722] border border-[#111827]" />
                    Expenses & EMI
                  </span>
                </div>
              </div>

              {/* Chart Component */}
              <AuthPreviewChart />

              {/* Mini Highlights */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-100 text-center">
                <div className="bg-[#FEF08A]/40 rounded-lg p-1.5 border border-[#111827]/10">
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Savings Rate</p>
                  <p className="text-xs font-black text-[#111827]">48%</p>
                </div>
                <div className="bg-[#A7F3D0]/40 rounded-lg p-1.5 border border-[#111827]/10">
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Health Score</p>
                  <p className="text-xs font-black text-[#111827]">88 / 100</p>
                </div>
                <div className="bg-[#DDD6FE]/40 rounded-lg p-1.5 border border-[#111827]/10">
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Goals On Track</p>
                  <p className="text-xs font-black text-[#111827]">3 of 3</p>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Value Propositions */}
          <div className="space-y-2 pt-1">
            <div className="flex items-start gap-2.5 text-xs font-semibold text-gray-800">
              <span className="text-sm">⚡</span>
              <span><strong>Set up in about two minutes</strong> — just describe your money</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs font-semibold text-gray-800">
              <span className="text-sm">🔄</span>
              <span><strong>Salary, loans and expenses stay in sync</strong> automatically</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs font-semibold text-gray-800">
              <span className="text-sm">🔒</span>
              <span><strong>Private by default</strong> — delete everything anytime</span>
            </div>
          </div>
        </div>

        {/* RIGHT: Login / Registration Form */}
        <div className="lg:col-span-5 p-6 sm:p-8 md:p-10 flex flex-col justify-center space-y-4 bg-white">
          {title && <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111827]">{title}</h2>}
          {subtitle && <p className="text-xs sm:text-sm opacity-75">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
