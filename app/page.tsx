import { DexShell, Header } from '@/components';

export default function Home() {
  return (
    <>
      <Header />
      <main className="bg-gray-50 min-h-screen">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <DexShell />
        </div>
      </main>
    </>
  );
}
