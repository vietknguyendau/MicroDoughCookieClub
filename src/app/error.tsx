"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="hand-caps text-3xl">Oops, a crumbly moment</h1>
      <p className="mt-2">Something went wrong on our side. Your info wasn&apos;t lost — please try again.</p>
      <button onClick={reset} className="btn btn-primary mt-6">Try again</button>
      {error.digest && <p className="mt-6 text-xs text-crumb">Error code: {error.digest}</p>}
    </div>
  );
}
