export default function Loading() {
  return (
    <div className="ohm-grille" aria-busy="true">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <p role="status" className="font-script text-[1.5rem] text-caramel-encre">
          On ouvre le journal du four…
        </p>
        <div className="mt-6 h-72 rounded-[14px] border-2 border-chocolat/20 bg-blanc-casse motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
