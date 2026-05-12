/**
 * Supported blockchain networks for shell-dex M1.
 * 
 * Each chain definition includes:
 * - id: EVM chain ID
 * - name: Display name
 * - nativeCurrency: Native token metadata
 * - rpcUrls: Public RPC endpoints
 * - blockExplorers: Optional block explorer URLs
 * - features: M1 feature support flags
 */

export interface ChainConfig {
  id: number;
  name: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: {
    public: { http: string[] };
    default: { http: string[] };
  };
  blockExplorers?: {
    default: { name: string; url: string };
  };
  features: {
    walletConnect: boolean;
    networkSwitch: boolean;
    swapEnabled: boolean;
  };
}

/**
 * Arbitrum One mainnet configuration.
 */
export const arbitrumOne: ChainConfig = {
  id: 42161,
  name: 'Arbitrum One',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    public: {
      http: [
        'https://arb1.arbitrum.io/rpc',
        'https://arbitrum-one.publicnode.com',
      ],
    },
    default: {
      http: ['https://arb1.arbitrum.io/rpc'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arbiscan',
      url: 'https://arbiscan.io',
    },
  },
  features: {
    walletConnect: false,
    networkSwitch: true,
    swapEnabled: false, // M1: disabled; swap routing planned for M2/M3
  },
};

/**
 * Shell Chain Testnet configuration.
 * Custom EVM-compatible chain requiring explicit add-network on first visit.
 */
export const shellTestnet: ChainConfig = {
  id: 10,
  name: 'Shell Testnet',
  nativeCurrency: {
    name: 'SHELL',
    symbol: 'SHELL',
    decimals: 18,
  },
  rpcUrls: {
    public: {
      http: ['https://rpc.testnet.shell.network'],
    },
    default: {
      http: ['https://rpc.testnet.shell.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Shell Explorer',
      url: 'https://testnet.shell.network',
    },
  },
  features: {
    walletConnect: false,
    networkSwitch: true,
    swapEnabled: false, // M1: disabled; requires on-chain routing setup
  },
};

/**
 * Map of all supported chains by ID.
 */
export const supportedChains: Record<number, ChainConfig> = {
  [arbitrumOne.id]: arbitrumOne,
  [shellTestnet.id]: shellTestnet,
};

/**
 * List of all supported chains for network selector and feature detection.
 */
export const allChains: ChainConfig[] = [arbitrumOne, shellTestnet];

/**
 * Predefined chain IDs for type safety.
 */
export const chainIds = {
  arbitrumOne: 42161,
  shellTestnet: 10,
} as const;

export type SupportedChainId = typeof chainIds[keyof typeof chainIds];
