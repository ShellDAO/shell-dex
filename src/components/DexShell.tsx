'use client';

import React, { useMemo } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { ChainSupportCards } from './ChainSupportCards';
import { SwapPanel } from './SwapPanel';
import { useDexView, type DexViewId } from '@/hooks/useDexView';

interface ViewConfig {
  id: DexViewId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const views: ViewConfig[] = [
  {
    id: 'swap',
    label: 'Swap',
    description: 'Token swaps, quotes, slippage, and route-aware execution.',
    icon: ArrowUpDown,
  },
];

function SummaryCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-600">{detail}</p>
    </div>
  );
}

export function DexShell() {
  const { activeView, setActiveView } = useDexView();

  const activeConfig = useMemo(
    () => views.find((view) => view.id === activeView) ?? views[0],
    [activeView]
  );

  return (
    <div className="space-y-8">
      {/* <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
              Shell DEX MVP
            </span>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                A focused swap-first Shell DEX surface.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
                The interface is temporarily locked to the Swap flow so routing,
                execution, and compact trading UX stay front and center while the
                other surfaces remain hidden.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[420px]">
            <SummaryCard
              title="Primary flow"
              value="Swap"
              detail="Quote, route selection, approval, and execution"
            />
            <SummaryCard
              title="Supported chains"
              value="2"
              detail="Arbitrum One and Shell Testnet"
            />
            <SummaryCard
              title="Execution model"
              value="Client"
              detail="Wallet-driven flows with wagmi + viem"
            />
          </div>
        </div>
      </section> */}

      {/* <section className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          {views.map((view) => {
            const Icon = view.icon;
            const selected = view.id === activeView;

            return (
              <button
                key={view.id}
                type="button"
                onClick={() => setActiveView(view.id)}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  selected
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-xl p-2 ${
                      selected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{view.label}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-600">
                      {view.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-blue-700">{activeConfig.label}</p>
          <p className="mt-1 text-sm text-gray-600">{activeConfig.description}</p>
        </div>
      </section> */}

      <br />
      <br />

      {/* Swap Panel */}
      {activeView === 'swap' && (
        <section className="mx-auto max-w-[460px] space-y-4">
          <div>
            <SwapPanel />
          </div>
          {/* <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">Network readiness</h2>
            <p className="mt-1.5 text-sm text-gray-600">
              Validate RPC reachability and supported feature flags before wiring
              live routes and execution to each chain.
            </p>
            <div className="mt-4">
              <ChainSupportCards />
            </div>
          </section> */}

          {/* <section className="grid grid-cols-1 gap-3">
            <SummaryCard
              title="Routing"
              value="Multi-route"
              detail="Direct and multi-hop quoting are unified into one flow."
            />
            <SummaryCard
              title="Execution"
              value="Approval + swap"
              detail="Wallet-backed transaction states replace placeholder hashes."
            />
            <SummaryCard
              title="Safety"
              value="Slippage-aware"
              detail="Mounted-safe wallet UI with explicit failure states."
            />
          </section> */}
        </section>
      )}

    </div>
  );
}
