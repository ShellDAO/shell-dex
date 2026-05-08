import { Header } from '@/components/Header';
import { ChainSupportCards } from '@/components/ChainSupportCards';
import { SwapPanel } from '@/components/SwapPanel';

export default function Home() {
  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Swap Panel */}
          <div className="lg:col-span-1">
            <SwapPanel />
          </div>

          {/* Chain Support and Info */}
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Supported Networks
              </h2>
              <p className="text-gray-600 mb-6">
                Shell DEX M1 currently supports Arbitrum One and Shell Testnet.
                Select a network above to connect and view its status.
              </p>
              <ChainSupportCards />
            </section>

            <section className="border-t border-gray-200 pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                M1 Roadmap
              </h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-green-600 font-bold text-lg">✓</span>
                  <div>
                    <p className="font-semibold text-gray-900">
                      Network Support & Wallet Connect
                    </p>
                    <p className="text-sm text-gray-600">
                      Connect and switch between Arbitrum and Shell Testnet
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold text-lg">→</span>
                  <div>
                    <p className="font-semibold text-gray-900">
                      M2 - Swap Routing
                    </p>
                    <p className="text-sm text-gray-600">
                      Token selection, pricing, and path discovery
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold text-lg">→</span>
                  <div>
                    <p className="font-semibold text-gray-900">
                      M3 - Transaction Execution
                    </p>
                    <p className="text-sm text-gray-600">
                      Sign and submit swap transactions
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
