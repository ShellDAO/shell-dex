const pillars = [
  "DEX UI and interaction flows",
  "Shell SDK integration",
  "Local shell-chain testnet connectivity",
  "Agent assets under /agents",
];

export default function Home() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">ShellDAO / shell-dex</p>
        <h1>Shell DEX bootstrap workspace</h1>
        <p className="lede">
          This submodule is initialized and ready for iterative DEX feature
          development. The current goal is a clean, extensible baseline rather
          than a full product surface in the first commit.
        </p>
      </section>

      <section className="card">
        <h2>Phase 1 deliverables</h2>
        <ul>
          {pillars.map((pillar) => (
            <li key={pillar}>{pillar}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
