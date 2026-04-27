"use client";

import dynamic from "next/dynamic";

const App = dynamic(() => import("@/components/App"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-500">
      carregando…
    </div>
  ),
});

export default function HomePage() {
  return <App />;
}
