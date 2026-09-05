// Minimal page heading — just the title, no pill or subtitle, so it
// never eats into the page's vertical space.
export default function HeroBrief({ title }) {
  return (
    <div className="pt-4 pb-2 px-6 max-w-7xl mx-auto text-center">
      <h1 className="text-lg sm:text-xl font-heading font-black text-white tracking-tight">
        {title}
      </h1>
    </div>
  );
}
