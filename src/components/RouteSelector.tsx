'use client';

import type { SwapRoute } from '@/lib/multiHopRouter';

interface RouteSelectorProps {
  routes: SwapRoute[];
  selectedRouteId: string | null;
  outputSymbol?: string;
  disabled?: boolean;
  onSelectRoute: (routeId: string) => void;
}

export function RouteSelector({
  routes,
  selectedRouteId,
  outputSymbol,
  disabled = false,
  onSelectRoute,
}: RouteSelectorProps) {
  if (routes.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Routes</h3>
        <span className="text-xs text-gray-500">{routes.length} option{routes.length === 1 ? '' : 's'}</span>
      </div>

      <div className="mb-1 hidden grid-cols-[minmax(0,2.4fr)_0.9fr_0.8fr_0.75fr_0.75fr] items-center gap-3 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 sm:grid">
        <span>Route</span>
        <span className="text-right">Out</span>
        <span className="text-right">Gas</span>
        <span className="text-right">Impact</span>
        <span className="text-right">Fee</span>
      </div>

      <div className="space-y-1">
        {routes.map(route => {
          const isSelected = route.id === selectedRouteId;
          return (
            <button
              key={route.id}
              type="button"
              onClick={() => onSelectRoute(route.id)}
              disabled={disabled}
              className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
               } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <div className="grid min-w-0 gap-y-1 sm:grid-cols-[minmax(0,2.4fr)_0.9fr_0.8fr_0.75fr_0.75fr] sm:gap-x-3">
                <div className="text-sm font-semibold leading-5 text-gray-900 sm:col-span-5">
                  {route.routeString}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600">
                  <span className="text-gray-500">{route.provider}</span>
                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
                    {route.hops.length === 1 ? 'Direct' : `${route.hops.length}H`}
                  </span>
                  {route.rank === 0 && (
                    <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                      Best
                    </span>
                  )}
                  {route.isSimulated && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      Sim
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-600 sm:block sm:text-right">
                  <span className="text-gray-400 sm:hidden">Out</span>
                  <span className="font-medium text-gray-900">
                    {formatAmount(route.expectedOutput)} {outputSymbol}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-600 sm:block sm:text-right">
                  <span className="text-gray-400 sm:hidden">Gas</span>
                  <span className="font-medium text-gray-900">{formatInteger(route.estimatedTotalGas)}</span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-600 sm:block sm:text-right">
                  <span className="text-gray-400 sm:hidden">Impact</span>
                  <span className="font-medium text-gray-900">{route.priceImpact.toFixed(2)}%</span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-600 sm:block sm:text-right">
                  <span className="text-gray-400 sm:hidden">Fee</span>
                  <span className="font-medium text-gray-900">{route.totalFeePercentage.toFixed(2)}%</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatAmount(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

function formatInteger(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return Math.round(parsed).toLocaleString();
}
